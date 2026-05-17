import { Repositories } from "@repo/db";

// =============================================================================
// TYPES
// =============================================================================

interface UpdateProfileInput {
  nickname?: string;
  bio?: string;
}

// =============================================================================
// ERRORS
// =============================================================================

export class PlayerError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "PlayerError";
  }
}

// =============================================================================
// SERVICE
// =============================================================================

export class PlayerService {
  constructor(private readonly repos: Repositories) {}

  // ---------------------------------------------------------------------------
  // GET PUBLIC PROFILE
  // Fetches any player's public profile by their id
  // ---------------------------------------------------------------------------

  async getProfile(playerId: string) {
    const player = await this.repos.player.findById(playerId);

    if (!player) {
      throw new PlayerError("Player not found", "PLAYER_NOT_FOUND");
    }

    return player;
  }

  // ---------------------------------------------------------------------------
  // GET MY PROFILE
  // Fetches the logged-in player's own profile via their user_id from the token
  // ---------------------------------------------------------------------------

  async getMyProfile(userId: string) {
    const player = await this.repos.player.findByUserId(userId);

    if (!player) {
      throw new PlayerError("Player not found", "PLAYER_NOT_FOUND");
    }

    return player;
  }

  // ---------------------------------------------------------------------------
  // UPDATE PROFILE
  // Only the owner can update their own profile
  // ---------------------------------------------------------------------------

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const player = await this.repos.player.findByUserId(userId);

    if (!player) {
      throw new PlayerError("Player not found", "PLAYER_NOT_FOUND");
    }

    // If nickname is being changed, ensure it's not already taken
    if (input.nickname && input.nickname !== player.nickname) {
      const existing = await this.repos.player.findByNickname(input.nickname);
      if (existing) {
        throw new PlayerError("Nickname already in use", "NICKNAME_TAKEN");
      }
    }

    return this.repos.player.update(player.id, {
      nickname: input.nickname,
      bio: input.bio,
    });
  }
}