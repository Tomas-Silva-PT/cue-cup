import { Repositories } from "@repo/db";

// =============================================================================
// TYPES
// =============================================================================

interface Standing {
  participantId: string;
  playerId: string;
  wins: number;
  losses: number;
  draws: number;
  matchesPlayed: number;
  points: number;
  scoreDiff: number; // total score for - score against
}

// =============================================================================
// ERRORS
// =============================================================================

export class MatchError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "MatchError";
  }
}

// =============================================================================
// SERVICE
// =============================================================================

export class MatchService {
  constructor(private readonly repos: Repositories) {}

  // ---------------------------------------------------------------------------
  // GET MATCH
  // ---------------------------------------------------------------------------

  async getMatch(matchId: string) {
    const match = await this.repos.match.findWithSessions(matchId);

    if (!match) {
      throw new MatchError("Match not found", "MATCH_NOT_FOUND");
    }

    return match;
  }

  // ---------------------------------------------------------------------------
  // START MATCH
  // Moves a match from SCHEDULED/AWAITING_SCHEDULE to ONGOING
  // Creates the first session automatically
  // Only a participant of the match can start it
  // ---------------------------------------------------------------------------

  async startMatch(userId: string, matchId: string) {
    const { match } = await this.resolveParticipant(userId, matchId);

    if (
      match.status !== "SCHEDULED" &&
      match.status !== "AWAITING_SCHEDULE"
    ) {
      throw new MatchError(
        "Match cannot be started at this stage",
        "INVALID_STATUS"
      );
    }

    await this.repos.match.updateStatus(matchId, "ONGOING");

    // Create the first session
    await this.repos.session.create({
      match: { connect: { id: matchId } },
      number: 1,
      status: "IN_PROGRESS",
    });

    return this.repos.match.findWithSessions(matchId);
  }

  // ---------------------------------------------------------------------------
  // PAUSE MATCH
  // Ends the current session and marks the match as PAUSED
  // Only a participant of the match can pause it
  // ---------------------------------------------------------------------------

  async pauseMatch(userId: string, matchId: string) {
    const { match } = await this.resolveParticipant(userId, matchId);

    if (match.status !== "ONGOING") {
      throw new MatchError("Match is not ongoing", "MATCH_NOT_ONGOING");
    }

    // Complete the current active session
    const activeSession = await this.repos.session.findActiveByMatch(matchId);
    if (activeSession) {
      await this.repos.session.complete(activeSession.id);
    }

    return this.repos.match.updateStatus(matchId, "PAUSED");
  }

  // ---------------------------------------------------------------------------
  // RESUME MATCH
  // Creates a new session and moves the match back to ONGOING
  // Only a participant of the match can resume it
  // ---------------------------------------------------------------------------

  async resumeMatch(userId: string, matchId: string) {
    const { match } = await this.resolveParticipant(userId, matchId);

    if (match.status !== "PAUSED") {
      throw new MatchError("Match is not paused", "MATCH_NOT_PAUSED");
    }

    const nextNumber = await this.repos.session.nextSessionNumber(matchId);

    await this.repos.match.updateStatus(matchId, "ONGOING");

    await this.repos.session.create({
      match: { connect: { id: matchId } },
      number: nextNumber,
      status: "IN_PROGRESS",
    });

    return this.repos.match.findWithSessions(matchId);
  }

  // ---------------------------------------------------------------------------
  // COMPLETE MATCH
  // Aggregates confirmed session results to determine the winner
  // Only a participant of the match can complete it
  // ---------------------------------------------------------------------------

  async completeMatch(userId: string, matchId: string) {
    const { match } = await this.resolveParticipant(userId, matchId);

    if (match.status !== "ONGOING") {
      throw new MatchError("Match is not ongoing", "MATCH_NOT_ONGOING");
    }

    // Ensure no session is still in progress
    const activeSession = await this.repos.session.findActiveByMatch(matchId);
    if (activeSession) {
      throw new MatchError(
        "There is still an active session. Pause or complete it first.",
        "SESSION_STILL_ACTIVE"
      );
    }

    // Aggregate scores from all confirmed sessions
    const sessions = await this.repos.session.findByMatch(matchId);
    let homeScore = 0;
    let awayScore = 0;

    for (const session of sessions) {
      const result = await this.repos.session.findResultBySession(session.id);

      if (!result || result.status !== "CONFIRMED") {
        throw new MatchError(
          "All session results must be confirmed before completing the match",
          "UNCONFIRMED_RESULTS"
        );
      }

      homeScore += result.score_home;
      awayScore += result.score_away;
    }

    if (homeScore === awayScore) {
      throw new MatchError(
        "Match cannot end in a draw. Resolve the tie first.",
        "MATCH_DRAW"
      );
    }

    const winner = homeScore > awayScore ? "HOME" : "AWAY";
    return this.repos.match.setWinner(matchId, winner);
  }

  // ---------------------------------------------------------------------------
  // WALKOVER / FORFEIT
  // Two scenarios:
  //   1. Participant forfeits — they concede, opponent wins automatically
  //   2. Tournament creator awards walkover — they choose which side wins
  //      (e.g. opponent no-show)
  // ---------------------------------------------------------------------------

  async walkover(userId: string, matchId: string, winningSide?: "HOME" | "AWAY") {
    const match = await this.repos.match.findWithParticipants(matchId);
    if (!match) {
      throw new MatchError("Match not found", "MATCH_NOT_FOUND");
    }

    if (match.status === "COMPLETED" || match.status === "WALKOVER") {
      throw new MatchError("Match is already finished", "MATCH_ALREADY_FINISHED");
    }

    const player = await this.repos.player.findByUserId(userId);
    if (!player) {
      throw new MatchError("Player not found", "PLAYER_NOT_FOUND");
    }

    const myParticipant = match.participants.find(
      (p) => p.player_id === player.id
    );
    const isParticipant = !!myParticipant;

    let resolvedWinner: "HOME" | "AWAY";

    if (isParticipant) {
      // Participant forfeiting — they lose, opponent wins
      resolvedWinner = myParticipant!.side === "HOME" ? "AWAY" : "HOME";
    } else if (match.context === "TOURNAMENT") {
      // Check if acting user is the tournament creator
      const group = await this.repos.phase.findGroupById(match.phase_group_id!);
      const phase = await this.repos.phase.findById(group!.phase_id);
      const tournament = await this.repos.tournament.findById(phase!.tournament_id);

      if (tournament?.created_by !== player.id) {
        throw new MatchError("Not authorized", "UNAUTHORIZED");
      }

      // Creator must specify which side wins
      if (!winningSide) {
        throw new MatchError(
          "You must specify which side wins the walkover",
          "WINNING_SIDE_REQUIRED"
        );
      }

      resolvedWinner = winningSide;
    } else {
      throw new MatchError("Not authorized", "UNAUTHORIZED");
    }

    return this.repos.match.update(matchId, {
      status: "WALKOVER",
      winner: resolvedWinner,
    });
  }

  // ---------------------------------------------------------------------------
  // CALCULATE GROUP STANDINGS
  // Aggregates match results for all participants in a group
  // Sets final_position on PhaseGroupParticipant based on standings
  // Called before completing a phase to determine who advances
  // ---------------------------------------------------------------------------

  async calculateGroupStandings(groupId: string) {
    const group = await this.repos.phase.findGroupWithParticipants(groupId);
    if (!group) {
      throw new MatchError("Group not found", "GROUP_NOT_FOUND");
    }

    const matches = await this.repos.match.findByGroup(groupId);
    const completedMatches = matches.filter(
      (m) => m.status === "COMPLETED" || m.status === "WALKOVER"
    );

    // Build standings map keyed by player_id
    const standingsMap = new Map<string, Standing>();

    // Initialise standings for all participants
    for (const gp of group.phaseGroupParticipants) {
      standingsMap.set(gp.participant.player_id, {
        participantId: gp.tournament_participant_id,
        playerId: gp.participant.player_id,
        wins: 0,
        losses: 0,
        draws: 0,
        matchesPlayed: 0,
        points: 0,
        scoreDiff: 0,
      });
    }

    // Accumulate results from completed matches
    for (const match of completedMatches) {
      const matchWithParticipants = await this.repos.match.findWithParticipants(match.id);
      if (!matchWithParticipants) continue;

      const homePlayer = matchWithParticipants.participants.find((p) => p.side === "HOME");
      const awayPlayer = matchWithParticipants.participants.find((p) => p.side === "AWAY");

      if (!homePlayer || !awayPlayer) continue;

      const homeStanding = standingsMap.get(homePlayer.player_id);
      const awayStanding = standingsMap.get(awayPlayer.player_id);

      if (!homeStanding || !awayStanding) continue;

      // Get aggregated scores from confirmed session results
      const sessions = await this.repos.session.findByMatch(match.id);
      let homeScore = 0;
      let awayScore = 0;

      for (const session of sessions) {
        const result = await this.repos.session.findResultBySession(session.id);
        if (result?.status === "CONFIRMED") {
          homeScore += result.score_home;
          awayScore += result.score_away;
        }
      }

      homeStanding.matchesPlayed++;
      awayStanding.matchesPlayed++;
      homeStanding.scoreDiff += homeScore - awayScore;
      awayStanding.scoreDiff += awayScore - homeScore;

      if (match.winner === "HOME") {
        homeStanding.wins++;
        homeStanding.points += 3;
        awayStanding.losses++;
      } else if (match.winner === "AWAY") {
        awayStanding.wins++;
        awayStanding.points += 3;
        homeStanding.losses++;
      } else {
        homeStanding.draws++;
        homeStanding.points += 1;
        awayStanding.draws++;
        awayStanding.points += 1;
      }
    }

    // Sort standings: points → wins → score diff
    const sorted = Array.from(standingsMap.values()).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.scoreDiff - a.scoreDiff;
    });

    // Set final_position on each PhaseGroupParticipant
    for (let i = 0; i < sorted.length; i++) {
      await this.repos.phase.setFinalPosition(
        groupId,
        sorted[i].participantId,
        i + 1
      );
    }

    return sorted;
  }

  // ---------------------------------------------------------------------------
  // PRIVATE HELPERS
  // ---------------------------------------------------------------------------

  // Resolves the match and verifies the acting user is a participant
  private async resolveParticipant(userId: string, matchId: string) {
    const player = await this.repos.player.findByUserId(userId);
    if (!player) {
      throw new MatchError("Player not found", "PLAYER_NOT_FOUND");
    }

    const match = await this.repos.match.findWithParticipants(matchId);
    if (!match) {
      throw new MatchError("Match not found", "MATCH_NOT_FOUND");
    }

    const isParticipant = match.participants.some(
      (p) => p.player_id === player.id
    );

    if (!isParticipant) {
      throw new MatchError("You are not a participant in this match", "UNAUTHORIZED");
    }

    return { player, match };
  }
}