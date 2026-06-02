// =============================================================================
// CONFIG
// =============================================================================
// Centralises all environment variable access in one place.
// Every other file imports from here instead of reading process.env directly.
// This way if a variable is missing, the app fails immediately on startup
// with a clear error — rather than failing silently at runtime when the
// variable is first used.
// =============================================================================

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  // Server
  host: optional("HOST", "0.0.0.0"),
  port: parseInt(optional("PORT", "3000"), 10),
  nodeEnv: optional("NODE_ENV", "development"),

  // Auth
  accessTokenSecret: required("ACCESS_TOKEN_SECRET"),
  refreshTokenSecret: required("REFRESH_TOKEN_SECRET"),

  // Cookies
  cookieSecret: required("COOKIE_SECRET"),

  // Database
  databaseUrl: required("DATABASE_URL"),
} as const;

export type Config = typeof config;
