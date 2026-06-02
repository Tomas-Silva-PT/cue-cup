import { Repositories } from "@repo/db";

// =============================================================================
// ERRORS
// =============================================================================

export class SessionError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "SessionError";
  }
}

// =============================================================================
// SERVICE
// =============================================================================

export class SessionService {
  constructor(private readonly repos: Repositories) {}

  // ---------------------------------------------------------------------------
  // GET SESSION
  // ---------------------------------------------------------------------------

  async getSession(sessionId: string) {
    const session = await this.repos.session.findWithResult(sessionId);

    if (!session) {
      throw new SessionError("Session not found", "SESSION_NOT_FOUND");
    }

    return session;
  }

  // ---------------------------------------------------------------------------
  // PROPOSE RESULT
  // A participant proposes or updates the result of a session
  // If both players have proposed the same result, it is auto-confirmed
  // ---------------------------------------------------------------------------

  async proposeResult(
    userId: string,
    sessionId: string,
    scoreHome: number,
    scoreAway: number,
  ) {
    const { player, session } = await this.resolveParticipant(userId, sessionId);

    if (session.status !== "IN_PROGRESS" && session.status !== "COMPLETED") {
      throw new SessionError(
        "Cannot propose a result for this session",
        "INVALID_SESSION_STATUS"
      );
    }

    const existing = await this.repos.session.findResultBySession(sessionId);

    if (!existing) {
      // First proposal — create the result
      await this.repos.session.createResult({
        session: { connect: { id: sessionId } },
        score_home: scoreHome,
        score_away: scoreAway,
        status: "PROPOSED",
        proposer: { connect: { id: player.id } },
        confirmation_method: "MUTUAL_AGREEMENT",
        history: [],
      });
    } else {
      if (existing.status === "CONFIRMED") {
        throw new SessionError(
          "Result is already confirmed",
          "RESULT_ALREADY_CONFIRMED"
        );
      }

      // Update the result and append previous values to history
      await this.repos.session.updateResult(sessionId, {
        score_home: scoreHome,
        score_away: scoreAway,
        proposed_by: player.id,
      });
    }

    // Check if the other player already proposed the same result
    const updated = await this.repos.session.findResultBySession(sessionId);
    const otherProposedSame = await this.checkMutualAgreement(
      session.match_id,
      player.id,
      scoreHome,
      scoreAway,
      updated!
    );

    if (otherProposedSame) {
      await this.repos.session.confirmResult(
        sessionId,
        player.id,
        "MUTUAL_AGREEMENT"
      );
    }

    return this.repos.session.findWithResult(sessionId);
  }

  // ---------------------------------------------------------------------------
  // CONFIRM RESULT
  // The other participant confirms the proposed result
  // ---------------------------------------------------------------------------

  async confirmResult(userId: string, sessionId: string) {
    const { player, session } = await this.resolveParticipant(userId, sessionId);

    const result = await this.repos.session.findResultBySession(sessionId);

    if (!result) {
      throw new SessionError("No result has been proposed yet", "NO_RESULT");
    }

    if (result.status === "CONFIRMED") {
      throw new SessionError(
        "Result is already confirmed",
        "RESULT_ALREADY_CONFIRMED"
      );
    }

    if (result.status === "DISPUTED") {
      throw new SessionError(
        "Result is disputed. It must be resolved by an admin or referee.",
        "RESULT_DISPUTED"
      );
    }

    // The proposer cannot confirm their own result
    if (result.proposed_by === player.id) {
      throw new SessionError(
        "You cannot confirm your own proposed result",
        "CANNOT_CONFIRM_OWN_RESULT"
      );
    }

    const confirmed = await this.repos.session.confirmResult(sessionId, player.id, "MUTUAL_AGREEMENT");

    // Try to auto-complete the match based on bestOf rules
    await this.tryAutoCompleteMatch(session.match_id);

    return confirmed;
  }

  // ---------------------------------------------------------------------------
  // AUTO-COMPLETE MATCH
  // Called after a result is confirmed — checks if either side has reached
  // the wins needed based on bestOf config and completes the match if so
  // ---------------------------------------------------------------------------

  private async tryAutoCompleteMatch(matchId: string) {
    const match = await this.repos.match.findWithSessions(matchId);
    if (!match || match.status === "COMPLETED") return;

    // Get bestOf from phase config (tournament match) or challenge config
    let bestOf = 1;

    if (match.phase_group_id) {
      const group = await this.repos.phase.findGroupById(match.phase_group_id);
      if (group) {
        const phase = await this.repos.phase.findById(group.phase_id);
        if (phase?.config) {
          const config = phase.config as Record<string, unknown>;
          bestOf = (config.bestOf as number) ?? 1;
        }
      }
    } else if (match.challenge_id) {
      const challenge = await this.repos.challenge.findById(match.challenge_id);
      if (challenge?.config) {
        const config = challenge.config as Record<string, unknown>;
        bestOf = (config.bestOf as number) ?? 1;
      }
    }

    const winsNeeded = Math.ceil(bestOf / 2);

    // Count wins from confirmed session results
    let homeWins = 0;
    let awayWins = 0;

    for (const session of (match as any).sessions ?? []) {
      const result = session.result;
      if (!result || result.status !== "CONFIRMED") continue;
      if (result.score_home > result.score_away) homeWins++;
      else if (result.score_away > result.score_home) awayWins++;
    }

    // Auto-complete if either side reached winsNeeded
    if (homeWins >= winsNeeded) {
      await this.repos.match.setWinner(matchId, "HOME");
    } else if (awayWins >= winsNeeded) {
      await this.repos.match.setWinner(matchId, "AWAY");
    }
  }

  // ---------------------------------------------------------------------------
  // DISPUTE RESULT
  // A participant disputes the proposed result
  // ---------------------------------------------------------------------------

  async disputeResult(userId: string, sessionId: string) {
    const { player, session } = await this.resolveParticipant(userId, sessionId);

    const result = await this.repos.session.findResultBySession(sessionId);

    if (!result) {
      throw new SessionError("No result has been proposed yet", "NO_RESULT");
    }

    if (result.status === "CONFIRMED") {
      throw new SessionError(
        "Cannot dispute an already confirmed result",
        "RESULT_ALREADY_CONFIRMED"
      );
    }

    if (result.status === "DISPUTED") {
      throw new SessionError("Result is already disputed", "RESULT_ALREADY_DISPUTED");
    }

    // The proposer cannot dispute their own result
    if (result.proposed_by === player.id) {
      throw new SessionError(
        "You cannot dispute your own proposed result",
        "CANNOT_DISPUTE_OWN_RESULT"
      );
    }

    return this.repos.session.disputeResult(sessionId);
  }

  // ---------------------------------------------------------------------------
  // RESOLVE DISPUTE
  // An admin or referee sets the definitive result
  // ---------------------------------------------------------------------------

  async resolveDispute(
    userId: string,
    sessionId: string,
    scoreHome: number,
    scoreAway: number,
  ) {
    // Only admins or referees can resolve disputes
    const user = await this.repos.user.findById(userId);
    if (!user) {
      throw new SessionError("User not found", "USER_NOT_FOUND");
    }

    if (user.role !== "ADMIN" && user.role !== "REFEREE") {
      throw new SessionError("Not authorized", "UNAUTHORIZED");
    }

    const result = await this.repos.session.findResultBySession(sessionId);
    if (!result) {
      throw new SessionError("No result found for this session", "NO_RESULT");
    }

    if (result.status !== "DISPUTED") {
      throw new SessionError("Result is not disputed", "RESULT_NOT_DISPUTED");
    }

    // Update with the definitive scores
    await this.repos.session.updateResult(sessionId, {
      score_home: scoreHome,
      score_away: scoreAway,
      proposed_by: userId,
    });

    const confirmed = await this.repos.session.confirmResult(sessionId, userId, "REFEREE_DECISION");

    // Try to auto-complete the match based on bestOf rules
    await this.tryAutoCompleteMatch(session.match_id);

    return confirmed;
  }

  // ---------------------------------------------------------------------------
  // PRIVATE HELPERS
  // ---------------------------------------------------------------------------

  // Resolves the session and verifies the acting user is a match participant
  private async resolveParticipant(userId: string, sessionId: string) {
    const player = await this.repos.player.findByUserId(userId);
    if (!player) {
      throw new SessionError("Player not found", "PLAYER_NOT_FOUND");
    }

    const session = await this.repos.session.findById(sessionId);
    if (!session) {
      throw new SessionError("Session not found", "SESSION_NOT_FOUND");
    }

    const match = await this.repos.match.findWithParticipants(session.match_id);
    if (!match) {
      throw new SessionError("Match not found", "MATCH_NOT_FOUND");
    }

    const isParticipant = match.participants.some(
      (p) => p.player_id === player.id
    );

    if (!isParticipant) {
      throw new SessionError(
        "You are not a participant in this match",
        "UNAUTHORIZED"
      );
    }

    return { player, session, match };
  }

  // Checks if the other player already proposed the same result
  // Used for auto-confirmation on mutual agreement
  private async checkMutualAgreement(
    matchId: string,
    proposingPlayerId: string,
    scoreHome: number,
    scoreAway: number,
    currentResult: any,
  ): Promise<boolean> {
    // If the result was previously proposed by the other player
    // and the scores match, it's a mutual agreement
    if (
      currentResult.proposed_by !== proposingPlayerId &&
      currentResult.score_home === scoreHome &&
      currentResult.score_away === scoreAway
    ) {
      return true;
    }

    return false;
  }
}
