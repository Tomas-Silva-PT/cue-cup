import { Repositories } from "@repo/db";

// =============================================================================
// TYPES
// =============================================================================

interface CreateTeamInput {
  name: string;
  slug: string;
  description?: string;
}

interface UpdateTeamInput {
  name?: string;
  description?: string;
}

// =============================================================================
// ERRORS
// =============================================================================

export class TeamError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "TeamError";
  }
}

// =============================================================================
// SERVICE
// =============================================================================

export class TeamService {
  constructor(private readonly repos: Repositories) {}

  // ---------------------------------------------------------------------------
  // CREATE TEAM
  // ---------------------------------------------------------------------------

  async createTeam(userId: string, input: CreateTeamInput) {
    const player = await this.repos.player.findByUserId(userId);
    if (!player) {
      throw new TeamError("Player not found", "PLAYER_NOT_FOUND");
    }

    // Check slug is not already taken
    const existing = await this.repos.team.findBySlug(input.slug);
    if (existing) {
      throw new TeamError("Slug already in use", "SLUG_TAKEN");
    }

    return this.repos.team.create({
      name: input.name,
      slug: input.slug,
      description: input.description,
      creator: { connect: { id: player.id } },
      members: {
        create: {
          player_id: player.id,
          role: "OWNER",
        },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // GET TEAM
  // ---------------------------------------------------------------------------

  async getTeam(teamId: string) {
    const team = await this.repos.team.findWithMembers(teamId);

    if (!team) {
      throw new TeamError("Team not found", "TEAM_NOT_FOUND");
    }

    return team;
  }

  // ---------------------------------------------------------------------------
  // UPDATE TEAM
  // Only the OWNER can update the team
  // ---------------------------------------------------------------------------

  async updateTeam(userId: string, teamId: string, input: UpdateTeamInput) {
    const { player, team } = await this.resolveOwner(userId, teamId);

    return this.repos.team.update(team.id, {
      name: input.name,
      description: input.description,
    });
  }

  // ---------------------------------------------------------------------------
  // DELETE TEAM
  // Only the OWNER can delete the team
  // ---------------------------------------------------------------------------

  async deleteTeam(userId: string, teamId: string) {
    await this.resolveOwner(userId, teamId);
    return this.repos.team.delete(teamId);
  }

  // ---------------------------------------------------------------------------
  // ADD MEMBER
  // Only the OWNER can add members
  // ---------------------------------------------------------------------------

  async addMember(userId: string, teamId: string, playerId: string) {
    const { team } = await this.resolveOwner(userId, teamId);

    // Check player exists
    const player = await this.repos.player.findById(playerId);
    if (!player) {
      throw new TeamError("Player not found", "PLAYER_NOT_FOUND");
    }

    // Check player is not already a member
    const existing = await this.repos.team.findMember(teamId, playerId);
    if (existing) {
      throw new TeamError("Player is already a member", "ALREADY_A_MEMBER");
    }

    return this.repos.team.addMember(team.id, playerId, "MEMBER");
  }

  // ---------------------------------------------------------------------------
  // REMOVE MEMBER
  // OWNER can remove anyone, MEMBER can only remove themselves
  // ---------------------------------------------------------------------------

  async removeMember(userId: string, teamId: string, playerId: string) {
    const player = await this.repos.player.findByUserId(userId);
    if (!player) {
      throw new TeamError("Player not found", "PLAYER_NOT_FOUND");
    }

    const team = await this.repos.team.findById(teamId);
    if (!team || !team.is_active) {
      throw new TeamError("Team not found", "TEAM_NOT_FOUND");
    }

    const actingMember = await this.repos.team.findMember(teamId, player.id);
    if (!actingMember) {
      throw new TeamError("You are not a member of this team", "NOT_A_MEMBER");
    }

    const isOwner = actingMember.role === "OWNER";
    const isSelf = player.id === playerId;

    // A member can only remove themselves; an owner can remove anyone
    if (!isOwner && !isSelf) {
      throw new TeamError("Not authorized to remove this member", "UNAUTHORIZED");
    }

    // Owner cannot remove themselves — team would be left without an owner
    if (isOwner && isSelf) {
      throw new TeamError(
        "Owner cannot leave the team. Transfer ownership first.",
        "OWNER_CANNOT_LEAVE"
      );
    }

    // Check the target player is actually a member
    const targetMember = await this.repos.team.findMember(teamId, playerId);
    if (!targetMember) {
      throw new TeamError("Player is not a member of this team", "NOT_A_MEMBER");
    }

    return this.repos.team.removeMember(teamId, playerId);
  }

  // ---------------------------------------------------------------------------
  // PRIVATE HELPERS
  // ---------------------------------------------------------------------------

  // Resolves the acting player and verifies they are the team OWNER
  private async resolveOwner(userId: string, teamId: string) {
    const player = await this.repos.player.findByUserId(userId);
    if (!player) {
      throw new TeamError("Player not found", "PLAYER_NOT_FOUND");
    }

    const team = await this.repos.team.findById(teamId);
    if (!team || !team.is_active) {
      throw new TeamError("Team not found", "TEAM_NOT_FOUND");
    }

    const member = await this.repos.team.findMember(teamId, player.id);
    if (!member || member.role !== "OWNER") {
      throw new TeamError("Not authorized", "UNAUTHORIZED");
    }

    return { player, team, member };
  }
}