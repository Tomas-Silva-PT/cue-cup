import { Repositories } from "@repo/db";

// =============================================================================
// TYPES
// =============================================================================

interface CreateTournamentInput {
  name: string;
  slug: string;
  description?: string;
  sportId: string;
  visibility: "PUBLIC" | "PRIVATE";
  minPlayers?: number;
  maxPlayers?: number;
  teamBased?: boolean;
}

interface UpdateTournamentInput {
  name?: string;
  description?: string;
  minPlayers?: number;
  maxPlayers?: number;
}

// =============================================================================
// ERRORS
// =============================================================================

export class TournamentError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "TournamentError";
  }
}

// =============================================================================
// SERVICE
// =============================================================================

export class TournamentService {
  constructor(private readonly repos: Repositories) { }

  // ---------------------------------------------------------------------------
  // CREATE TOURNAMENT
  // ---------------------------------------------------------------------------

  async createTournament(userId: string, input: CreateTournamentInput) {
    const player = await this.repos.player.findByUserId(userId);
    if (!player) {
      throw new TournamentError("Player not found", "PLAYER_NOT_FOUND");
    }

    const sport = await this.repos.sport.findById(input.sportId);
    if (!sport || !sport.is_active) {
      throw new TournamentError("Sport not found", "SPORT_NOT_FOUND");
    }

    const existing = await this.repos.tournament.findBySlug(input.slug);
    if (existing) {
      throw new TournamentError("Slug already in use", "SLUG_TAKEN");
    }

    // Generate an invite code for non-public tournaments
    const inviteCode =
      input.visibility !== "PUBLIC"
        ? this.generateInviteCode()
        : null;

    return this.repos.tournament.create({
      name: input.name,
      slug: input.slug,
      description: input.description,
      sport: { connect: { id: input.sportId } },
      creator: { connect: { id: player.id } },
      visibility: input.visibility,
      min_players: input.minPlayers ?? 2,
      max_players: input.maxPlayers,
      teamBased: input.teamBased ?? false,
      status: "DRAFT",
      invitation_code: inviteCode,
    });
  }

  async getTournaments(publicOnly = false) {
    return publicOnly ? this.repos.tournament.findPublic() : this.repos.tournament.findAll();
  }

  // ---------------------------------------------------------------------------
  // GET TOURNAMENT
  // ---------------------------------------------------------------------------

  async getTournament(tournamentId: string) {
    const tournament = await this.repos.tournament.findWithPhases(tournamentId);

    if (!tournament || !tournament.is_active) {
      throw new TournamentError("Tournament not found", "TOURNAMENT_NOT_FOUND");
    }

    return tournament;
  }

  // ---------------------------------------------------------------------------
  // JOIN TOURNAMENT
  // ---------------------------------------------------------------------------

  async joinTournament(userId: string, inviteCode?: string, tournamentId?: string) {
    const player = await this.repos.player.findByUserId(userId);
    if (!player) {
      throw new TournamentError("Player not found", "PLAYER_NOT_FOUND");
    }

    let tournament;
    if(tournamentId) {
      tournament = await this.repos.tournament.findById(tournamentId);
    } else if (inviteCode) {
      tournament = await this.repos.tournament.findByInvitationCode(inviteCode);
    }
    
    if(!tournament) {
      throw new TournamentError("Tournament ID or invite code is required", "TOURNAMENT_ID_OR_INVITE_CODE_REQUIRED");
    }

    if (!tournament.is_active) {
      throw new TournamentError("Tournament is not active", "TOURNAMENT_NOT_ACTIVE");
    }

    // Only OPEN tournaments can be joined
    if (tournament.status !== "OPEN") {
      throw new TournamentError(
        "Tournament is not open for registration",
        "TOURNAMENT_NOT_OPEN"
      );
    }

    // Private tournaments require an invite code
    if (tournament.visibility === "PRIVATE") {
      if (!inviteCode) {
        throw new TournamentError("Invite code is required", "INVITE_CODE_REQUIRED");
      }
      if (inviteCode !== tournament.invitation_code) {
        throw new TournamentError("Invalid invite code", "INVALID_INVITE_CODE");
      }
    }

    // Check player is not already a participant
    const existing = await this.repos.tournament.findParticipant(
      tournament.id,
      player.id
    );
    if (existing) {
      throw new TournamentError(
        "You are already a participant",
        "ALREADY_PARTICIPATING"
      );
    }

    // Check max players limit
    if (tournament.max_players) {
      const participants = await this.repos.tournament.findParticipants(tournament.id);
      const confirmed = participants.filter((p) => p.status === "ACCEPTED");
      if (confirmed.length >= tournament.max_players) {
        throw new TournamentError("Tournament is full", "TOURNAMENT_FULL");
      }
    }

    return this.repos.tournament.addParticipant(tournament.id, player.id);
  }

  // ---------------------------------------------------------------------------
  // INVITE PLAYER
  // Only the tournament creator can invite players
  // ---------------------------------------------------------------------------

  async invitePlayer(userId: string, tournamentId: string, playerId: string) {
    const { tournament } = await this.resolveCreator(userId, tournamentId);

    if (tournament.status !== "OPEN" && tournament.status !== "DRAFT") {
      throw new TournamentError(
        "Cannot invite players at this stage",
        "TOURNAMENT_NOT_OPEN"
      );
    }

    // Check the invited player exists
    const invited = await this.repos.player.findById(playerId);
    if (!invited) {
      throw new TournamentError("Player not found", "PLAYER_NOT_FOUND");
    }

    // Check there is no pending invite already
    const existingInvite = await this.repos.tournament.findInviteByPlayer(
      tournamentId,
      playerId
    );
    if (existingInvite) {
      throw new TournamentError(
        "Player already has a pending invite",
        "INVITE_ALREADY_PENDING"
      );
    }

    // Check player is not already a participant
    const existingParticipant = await this.repos.tournament.findParticipant(
      tournamentId,
      playerId
    );
    if (existingParticipant) {
      throw new TournamentError(
        "Player is already a participant",
        "ALREADY_PARTICIPATING"
      );
    }

    const creator = await this.repos.player.findByUserId(userId);

    return this.repos.tournament.createInvite({
      tournament: { connect: { id: tournamentId } },
      sender: { connect: { id: creator!.id } },
      invitedPlayer: { connect: { id: playerId } },
    });
  }

  // ---------------------------------------------------------------------------
  // ACCEPT INVITE
  // ---------------------------------------------------------------------------

  async acceptInvite(userId: string, inviteId: string) {
    const { player, invite } = await this.resolveInvite(userId, inviteId);

    await this.repos.tournament.updateInviteStatus(inviteId, "ACCEPTED");

    // Add the player as a confirmed participant
    return this.repos.tournament.addParticipant(
      invite.tournament_id,
      player.id
    );
  }

  // ---------------------------------------------------------------------------
  // REJECT INVITE
  // ---------------------------------------------------------------------------

  async rejectInvite(userId: string, inviteId: string) {
    await this.resolveInvite(userId, inviteId);
    return this.repos.tournament.updateInviteStatus(inviteId, "REJECTED");
  }

  // ---------------------------------------------------------------------------
  // OPEN TOURNAMENT
  // Moves the tournament from DRAFT to OPEN — enables registration
  // Only the creator can do this
  // ---------------------------------------------------------------------------

  async openTournament(userId: string, tournamentId: string) {
    const { tournament } = await this.resolveCreator(userId, tournamentId);

    if (tournament.status !== "DRAFT") {
      throw new TournamentError(
        "Only draft tournaments can be opened for registration",
        "INVALID_STATUS_TRANSITION"
      );
    }

    return this.repos.tournament.update(tournamentId, { status: "OPEN" });
  }

  // ---------------------------------------------------------------------------
  // START TOURNAMENT
  // Moves the tournament from OPEN/DRAFT to ONGOING
  // Only the creator can do this
  // ---------------------------------------------------------------------------

  async startTournament(userId: string, tournamentId: string) {
    const { tournament } = await this.resolveCreator(userId, tournamentId);

    if (tournament.status !== "OPEN" && tournament.status !== "DRAFT") {
      throw new TournamentError(
        "Tournament cannot be started at this stage",
        "INVALID_STATUS_TRANSITION"
      );
    }

    // Check minimum players requirement
    const participants = await this.repos.tournament.findParticipants(tournamentId);
    const confirmed = participants.filter((p) => p.status === "ACCEPTED");

    if (confirmed.length < tournament.min_players) {
      throw new TournamentError(
        `Not enough players. Minimum is ${tournament.min_players}, currently have ${confirmed.length}.`,
        "NOT_ENOUGH_PLAYERS"
      );
    }

    return this.repos.tournament.update(tournamentId, { status: "ONGOING" });
  }

  // ---------------------------------------------------------------------------
  // CANCEL TOURNAMENT
  // Only the creator can cancel
  // ---------------------------------------------------------------------------

  async cancelTournament(userId: string, tournamentId: string) {
    const { tournament } = await this.resolveCreator(userId, tournamentId);

    if (tournament.status === "COMPLETED" || tournament.status === "CANCELED") {
      throw new TournamentError(
        "Tournament cannot be cancelled at this stage",
        "INVALID_STATUS_TRANSITION"
      );
    }

    return this.repos.tournament.update(tournamentId, { status: "CANCELED" });
  }

  // ---------------------------------------------------------------------------
  // PRIVATE HELPERS
  // ---------------------------------------------------------------------------

  // Resolves the acting player and verifies they are the tournament creator
  private async resolveCreator(userId: string, tournamentId: string) {
    const player = await this.repos.player.findByUserId(userId);
    if (!player) {
      throw new TournamentError("Player not found", "PLAYER_NOT_FOUND");
    }

    const tournament = await this.repos.tournament.findById(tournamentId);
    if (!tournament || !tournament.is_active) {
      throw new TournamentError("Tournament not found", "TOURNAMENT_NOT_FOUND");
    }

    if (tournament.created_by !== player.id) {
      throw new TournamentError("Not authorized", "UNAUTHORIZED");
    }

    return { player, tournament };
  }

  // Resolves an invite and verifies it belongs to the acting player
  private async resolveInvite(userId: string, inviteId: string) {
    const player = await this.repos.player.findByUserId(userId);
    if (!player) {
      throw new TournamentError("Player not found", "PLAYER_NOT_FOUND");
    }

    const invite = await this.repos.tournament.findInvite(inviteId);
    if (!invite) {
      throw new TournamentError("Invite not found", "INVITE_NOT_FOUND");
    }

    if (invite.invited_player_id !== player.id) {
      throw new TournamentError("Not authorized", "UNAUTHORIZED");
    }

    if (invite.status !== "PENDING") {
      throw new TournamentError(
        "Invite is no longer pending",
        "INVITE_NOT_PENDING"
      );
    }

    // Check invite hasn't expired
    if (invite.expires_at && invite.expires_at < new Date()) {
      await this.repos.tournament.updateInviteStatus(inviteId, "EXPIRED");
      throw new TournamentError("Invite has expired", "INVITE_EXPIRED");
    }

    return { player, invite };
  }

  // Generates a random 8-character uppercase invite code
  private generateInviteCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }
}