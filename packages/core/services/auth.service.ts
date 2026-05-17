import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Repositories } from "@repo/db";

// =============================================================================
// TYPES
// =============================================================================

interface TokenPayload {
  userId: string;
  role: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface RegisterInput {
  email: string;
  password: string;
  nickname: string;
  name: string;
}

interface LoginInput {
  email: string;
  password: string;
}

// =============================================================================
// ERRORS
// =============================================================================

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "AuthError";
  }
}

// =============================================================================
// CONFIG
// =============================================================================

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET!;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET!;
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

// =============================================================================
// SERVICE
// =============================================================================

export class AuthService {
  constructor(private readonly repos: Repositories) {}

  // ---------------------------------------------------------------------------
  // REGISTER
  // ---------------------------------------------------------------------------

  async register(input: RegisterInput): Promise<AuthTokens> {
    // Check if email is already taken
    const existingUser = await this.repos.user.findByEmail(input.email);
    if (existingUser) {
      throw new AuthError("Email already in use", "EMAIL_TAKEN");
    }

    // Check if nickname is already taken
    const existingPlayer = await this.repos.player.findByNickname(input.nickname);
    if (existingPlayer) {
      throw new AuthError("Nickname already in use", "NICKNAME_TAKEN");
    }

    // Hash password
    const password_hash = await bcrypt.hash(input.password, 10);

    // Create User + Player atomically
    const user = await this.repos.user.create({
      email: input.email,
      password_hash,
      name: input.name,
      player: {
        create: {
          nickname: input.nickname,
        },
      },
    });

    return this.issueTokens(user.id, user.role);
  }

  // ---------------------------------------------------------------------------
  // LOGIN
  // ---------------------------------------------------------------------------

  async login(input: LoginInput): Promise<AuthTokens> {
    // Find user by email
    const user = await this.repos.user.findByEmail(input.email);
    if (!user) {
      // Use same error as wrong password to avoid email enumeration
      throw new AuthError("Invalid credentials", "INVALID_CREDENTIALS");
    }

    // Check account is active
    if (!user.is_active) {
      throw new AuthError("Account is disabled", "ACCOUNT_DISABLED");
    }

    // Verify password
    const passwordValid = await bcrypt.compare(input.password, user.password_hash);
    if (!passwordValid) {
      throw new AuthError("Invalid credentials", "INVALID_CREDENTIALS");
    }

    return this.issueTokens(user.id, user.role);
  }

  // ---------------------------------------------------------------------------
  // REFRESH
  // ---------------------------------------------------------------------------

  async refresh(refreshToken: string): Promise<AuthTokens> {
    // Verify the refresh token signature
    let payload: TokenPayload;
    try {
      payload = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET) as TokenPayload;
    } catch {
      throw new AuthError("Invalid refresh token", "INVALID_REFRESH_TOKEN");
    }

    // Check the token exists in the database and hasn't been invalidated
    const storedToken = await this.repos.user.findRefreshToken(refreshToken);
    if (!storedToken) {
      throw new AuthError("Refresh token not found", "INVALID_REFRESH_TOKEN");
    }

    // Check it hasn't expired
    if (storedToken.expires_at < new Date()) {
      await this.repos.user.deleteRefreshToken(refreshToken);
      throw new AuthError("Refresh token expired", "REFRESH_TOKEN_EXPIRED");
    }

    // Check the user is still active
    const user = await this.repos.user.findById(payload.userId);
    if (!user || !user.is_active) {
      throw new AuthError("Account is disabled", "ACCOUNT_DISABLED");
    }

    // Rotate the refresh token — invalidate the old one, issue a new pair
    await this.repos.user.deleteRefreshToken(refreshToken);
    return this.issueTokens(user.id, user.role);
  }

  // ---------------------------------------------------------------------------
  // LOGOUT
  // ---------------------------------------------------------------------------

  async logout(refreshToken: string): Promise<void> {
    // Silently ignore if token doesn't exist — logout should always succeed
    await this.repos.user.deleteRefreshToken(refreshToken).catch(() => {});
  }

  // ---------------------------------------------------------------------------
  // VERIFY ACCESS TOKEN
  // Called by API middleware on every protected request
  // ---------------------------------------------------------------------------

  verifyAccessToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, ACCESS_TOKEN_SECRET) as TokenPayload;
    } catch {
      throw new AuthError("Invalid access token", "INVALID_ACCESS_TOKEN");
    }
  }

  // ---------------------------------------------------------------------------
  // PRIVATE HELPERS
  // ---------------------------------------------------------------------------

  private async issueTokens(userId: string, role: string): Promise<AuthTokens> {
    const payload: TokenPayload = { userId, role };

    const accessToken = jwt.sign(payload, ACCESS_TOKEN_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });

    const refreshToken = jwt.sign(payload, REFRESH_TOKEN_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRY,
    });

    // Persist refresh token in the database
    await this.repos.user.createRefreshToken({
      token: refreshToken,
      user: { connect: { id: userId } },
      expires_at: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
    });

    return { accessToken, refreshToken };
  }
}
