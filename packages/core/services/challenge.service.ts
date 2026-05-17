import { Repositories } from "@repo/db";
import { JsonValue } from "../types";

// =============================================================================
// TYPES
// =============================================================================

interface SendChallengeInput {
  challengedId: string;
  sportId: string;
  requestNote?: string;
  config?: JsonValue;
}

// =============================================================================
// ERRORS
// =============================================================================

export class ChallengeError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "ChallengeError";
  }
}

// =============================================================================
// SERVICE
// =============================================================================

export class ChallengeService {
  constructor(private readonly repos: Repositories) {}

  // ---------------------------------------------------------------------------
  // SEND CHALLENGE
  // ---------------------------------------------------------------------------

  async send(userId: string, input: SendChallengeInput) {
    const challenger = await this.repos.player.findByUserId(userId);
    if (!challenger) {
      throw new ChallengeError("Player not found", "PLAYER_NOT_FOUND");
    }

    // A player cannot challenge themselves
    if (challenger.id === input.challengedId) {
      throw new ChallengeError(
        "You cannot challenge yourself",
        "SELF_CHALLENGE"
      );
    }

    // Check the challenged player exists
    const challenged = await this.repos.player.findById(input.challengedId);
    if (!challenged) {
      throw new ChallengeError("Challenged player not found", "PLAYER_NOT_FOUND");
    }

    // Check the sport exists
    const sport = await this.repos.sport.findById(input.sportId);
    if (!sport || !sport.is_active) {
      throw new ChallengeError("Sport not found", "SPORT_NOT_FOUND");
    }

    // Check there is no pending challenge already between these two players
    const existing = await this.repos.challenge.findBetweenPlayers(
      challenger.id,
      input.challengedId
    );

    const hasPending = existing.some((c) => c.status === "PENDING");
    if (hasPending) {
      throw new ChallengeError(
        "There is already a pending challenge between you and this player",
        "CHALLENGE_ALREADY_PENDING"
      );
    }

    return this.repos.challenge.create({
      challenger: { connect: { id: challenger.id } },
      challenged: { connect: { id: input.challengedId } },
      sport: { connect: { id: input.sportId } },
      request_note: input.requestNote,
      config: input.config ?? {},
    });
  }

  // ---------------------------------------------------------------------------
  // ACCEPT CHALLENGE
  // Only the challenged player can accept
  // ---------------------------------------------------------------------------

  async accept(userId: string, challengeId: string) {
    const { player, challenge } = await this.resolveChallenged(userId, challengeId);

    if (challenge.status !== "PENDING") {
      throw new ChallengeError(
        "Challenge is no longer pending",
        "CHALLENGE_NOT_PENDING"
      );
    }

    const updated = await this.repos.challenge.updateStatus(challengeId, "ACCEPTED");

    // Create the first match for this challenge
    await this.repos.match.create({
        context: "CHALLENGE",
        status: "AWAITING_SCHEDULE",
        challenge: { connect: { id: challengeId } },
        participants: {
          create: [
            { player_id: challenge.challenger_id, side: "HOME" },
            { player_id: player.id,               side: "AWAY" },
          ],
        },
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // REJECT CHALLENGE
  // Only the challenged player can reject
  // ---------------------------------------------------------------------------

  async reject(userId: string, challengeId: string, responseNote?: string) {
    const { challenge } = await this.resolveChallenged(userId, challengeId);

    if (challenge.status !== "PENDING") {
      throw new ChallengeError(
        "Challenge is no longer pending",
        "CHALLENGE_NOT_PENDING"
      );
    }

    return this.repos.challenge.update(challengeId, {
      status: "REJECTED",
      response_note: responseNote,
      responded_at: new Date(),
    });
  }

  // ---------------------------------------------------------------------------
  // WITHDRAW CHALLENGE
  // Only the challenger can withdraw their own challenge
  // ---------------------------------------------------------------------------

  async withdraw(userId: string, challengeId: string) {
    const { challenge } = await this.resolveChallenger(userId, challengeId);

    if (challenge.status !== "PENDING") {
      throw new ChallengeError(
        "Only pending challenges can be withdrawn",
        "CHALLENGE_NOT_PENDING"
      );
    }

    return this.repos.challenge.updateStatus(challengeId, "WITHDRAWN");
  }

  // ---------------------------------------------------------------------------
  // GET CHALLENGE
  // ---------------------------------------------------------------------------

  async getChallenge(challengeId: string) {
    const challenge = await this.repos.challenge.findWithMatches(challengeId);

    if (!challenge) {
      throw new ChallengeError("Challenge not found", "CHALLENGE_NOT_FOUND");
    }

    return challenge;
  }

  // ---------------------------------------------------------------------------
  // GET MY CHALLENGES
  // Returns sent and received challenges for the logged-in player
  // ---------------------------------------------------------------------------

  async getMyChallenges(userId: string) {
    const player = await this.repos.player.findByUserId(userId);
    if (!player) {
      throw new ChallengeError("Player not found", "PLAYER_NOT_FOUND");
    }

    const [sent, received] = await Promise.all([
      this.repos.challenge.findSentByPlayer(player.id),
      this.repos.challenge.findReceivedByPlayer(player.id),
    ]);

    return { sent, received };
  }

  // ---------------------------------------------------------------------------
  // PRIVATE HELPERS
  // ---------------------------------------------------------------------------

  // Resolves the acting player and verifies they are the challenger
  private async resolveChallenger(userId: string, challengeId: string) {
    const player = await this.repos.player.findByUserId(userId);
    if (!player) {
      throw new ChallengeError("Player not found", "PLAYER_NOT_FOUND");
    }

    const challenge = await this.repos.challenge.findById(challengeId);
    if (!challenge || !challenge.is_active) {
      throw new ChallengeError("Challenge not found", "CHALLENGE_NOT_FOUND");
    }

    if (challenge.challenger_id !== player.id) {
      throw new ChallengeError("Not authorized", "UNAUTHORIZED");
    }

    return { player, challenge };
  }

  // Resolves the acting player and verifies they are the challenged
  private async resolveChallenged(userId: string, challengeId: string) {
    const player = await this.repos.player.findByUserId(userId);
    if (!player) {
      throw new ChallengeError("Player not found", "PLAYER_NOT_FOUND");
    }

    const challenge = await this.repos.challenge.findById(challengeId);
    if (!challenge || !challenge.is_active) {
      throw new ChallengeError("Challenge not found", "CHALLENGE_NOT_FOUND");
    }

    if (challenge.challenged_id !== player.id) {
      throw new ChallengeError("Not authorized", "UNAUTHORIZED");
    }

    return { player, challenge };
  }
}