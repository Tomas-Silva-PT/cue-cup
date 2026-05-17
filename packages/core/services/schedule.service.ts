import { Repositories } from "@repo/db";

// =============================================================================
// ERRORS
// =============================================================================

export class ScheduleError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "ScheduleError";
  }
}

// =============================================================================
// SERVICE
// =============================================================================

export class ScheduleService {
  constructor(private readonly repos: Repositories) {}

  // ---------------------------------------------------------------------------
  // PROPOSE SCHEDULE
  // A participant proposes a date/time for a match
  // Any existing pending proposals are expired before creating a new one
  // ---------------------------------------------------------------------------

  async proposeSchedule(
    userId: string,
    matchId: string,
    datetime: Date,
    location?: string,
    note?: string,
  ) {
    const { player, match } = await this.resolveParticipant(userId, matchId);

    if (
      match.status !== "AWAITING_SCHEDULE" &&
      match.status !== "SCHEDULED"
    ) {
      throw new ScheduleError(
        "Match is not awaiting a schedule",
        "INVALID_MATCH_STATUS"
      );
    }

    // Proposed datetime must be in the future
    if (datetime <= new Date()) {
      throw new ScheduleError(
        "Proposed time must be in the future",
        "INVALID_DATETIME"
      );
    }

    // Expire any existing pending proposals for this match
    await this.repos.scheduleProposal.expireAllPendingByMatch(matchId);

    // Create the new proposal
    const proposal = await this.repos.scheduleProposal.create({
      match: { connect: { id: matchId } },
      proposer: { connect: { id: player.id } },
      proposed_time: datetime,
      location,
      note,
      status: "PENDING",
    });

    // Move match to AWAITING_SCHEDULE if it was already SCHEDULED
    if (match.status === "SCHEDULED") {
      await this.repos.match.updateStatus(matchId, "AWAITING_SCHEDULE");
    }

    return proposal;
  }

  // ---------------------------------------------------------------------------
  // ACCEPT SCHEDULE
  // The other participant accepts a pending proposal
  // Match is moved to SCHEDULED with the agreed datetime
  // ---------------------------------------------------------------------------

  async acceptSchedule(userId: string, proposalId: string) {
    const { player, proposal } = await this.resolveResponder(userId, proposalId);

    const updated = await this.repos.scheduleProposal.respond(
      proposalId,
      "ACCEPTED",
      player.id,
    );

    // Set the agreed datetime on the match and move to SCHEDULED
    await this.repos.match.updateStatus(proposal.match_id, "SCHEDULED");

    return updated;
  }

  // ---------------------------------------------------------------------------
  // REJECT SCHEDULE
  // The other participant rejects a pending proposal
  // Match remains AWAITING_SCHEDULE for a new proposal
  // ---------------------------------------------------------------------------

  async rejectSchedule(
    userId: string,
    proposalId: string,
    responseNote?: string,
  ) {
    const { player } = await this.resolveResponder(userId, proposalId);

    return this.repos.scheduleProposal.respond(
      proposalId,
      "REJECTED",
      player.id,
      responseNote,
    );
  }

  // ---------------------------------------------------------------------------
  // GET MATCH SCHEDULE
  // Fetches all proposals for a match, ordered by most recent first
  // ---------------------------------------------------------------------------

  async getMatchSchedule(matchId: string) {
    const match = await this.repos.match.findById(matchId);
    if (!match) {
      throw new ScheduleError("Match not found", "MATCH_NOT_FOUND");
    }

    return this.repos.scheduleProposal.findByMatch(matchId);
  }

  // ---------------------------------------------------------------------------
  // PRIVATE HELPERS
  // ---------------------------------------------------------------------------

  // Resolves the match and verifies the acting user is a participant
  private async resolveParticipant(userId: string, matchId: string) {
    const player = await this.repos.player.findByUserId(userId);
    if (!player) {
      throw new ScheduleError("Player not found", "PLAYER_NOT_FOUND");
    }

    const match = await this.repos.match.findWithParticipants(matchId);
    if (!match) {
      throw new ScheduleError("Match not found", "MATCH_NOT_FOUND");
    }

    const isParticipant = match.participants.some(
      (p) => p.player_id === player.id
    );

    if (!isParticipant) {
      throw new ScheduleError(
        "You are not a participant in this match",
        "UNAUTHORIZED"
      );
    }

    return { player, match };
  }

  // Resolves a proposal and verifies the acting user is the responder
  // (i.e. they did NOT create the proposal)
  private async resolveResponder(userId: string, proposalId: string) {
    const player = await this.repos.player.findByUserId(userId);
    if (!player) {
      throw new ScheduleError("Player not found", "PLAYER_NOT_FOUND");
    }

    const proposal = await this.repos.scheduleProposal.findById(proposalId);
    if (!proposal) {
      throw new ScheduleError("Proposal not found", "PROPOSAL_NOT_FOUND");
    }

    if (proposal.status !== "PENDING") {
      throw new ScheduleError(
        "Proposal is no longer pending",
        "PROPOSAL_NOT_PENDING"
      );
    }

    // The proposer cannot accept or reject their own proposal
    if (proposal.proposed_by === player.id) {
      throw new ScheduleError(
        "You cannot respond to your own proposal",
        "CANNOT_RESPOND_TO_OWN_PROPOSAL"
      );
    }

    // Verify the player is actually a participant in the match
    const match = await this.repos.match.findWithParticipants(proposal.match_id);
    const isParticipant = match?.participants.some(
      (p) => p.player_id === player.id
    );

    if (!isParticipant) {
      throw new ScheduleError(
        "You are not a participant in this match",
        "UNAUTHORIZED"
      );
    }

    return { player, proposal };
  }
}