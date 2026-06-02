import { FastifyInstance, FastifyError } from "fastify";
import fp from "fastify-plugin";
import {
  AuthError,
  PlayerError,
  TeamError,
  ChallengeError,
  TournamentError,
  PhaseError,
  MatchError,
  SessionError,
  ScheduleError,
} from "@repo/core";

// =============================================================================
// ERROR PLUGIN
// =============================================================================
// Fastify's global error handler — every unhandled error thrown anywhere in
// a route handler ends up here.
//
// Its responsibilities are:
//   1. Map domain errors (from core services) to appropriate HTTP status codes
//   2. Format all errors into a consistent JSON response shape
//   3. Ensure unexpected errors (bugs) return 500 without leaking internals
//
// Without this, Fastify would return its own default error format which
// doesn't align with our domain error codes, and internal errors might
// leak stack traces to clients.
// =============================================================================

// Domain error classes — used to identify errors thrown by core services
const DOMAIN_ERRORS = [
  AuthError,
  PlayerError,
  TeamError,
  ChallengeError,
  TournamentError,
  PhaseError,
  MatchError,
  SessionError,
  ScheduleError,
];

// Maps domain error codes to HTTP status codes
const ERROR_STATUS_MAP: Record<string, number> = {
  // 404 — Not Found
  PLAYER_NOT_FOUND: 404,
  TOURNAMENT_NOT_FOUND: 404,
  CHALLENGE_NOT_FOUND: 404,
  PHASE_NOT_FOUND: 404,
  MATCH_NOT_FOUND: 404,
  SESSION_NOT_FOUND: 404,
  TEAM_NOT_FOUND: 404,
  INVITE_NOT_FOUND: 404,
  PROPOSAL_NOT_FOUND: 404,
  SPORT_NOT_FOUND: 404,
  GROUP_NOT_FOUND: 404,
  USER_NOT_FOUND: 404,

  // 409 — Conflict
  EMAIL_TAKEN: 409,
  NICKNAME_TAKEN: 409,
  SLUG_TAKEN: 409,
  ALREADY_PARTICIPATING: 409,
  ALREADY_A_MEMBER: 409,
  INVITE_ALREADY_PENDING: 409,
  CHALLENGE_ALREADY_PENDING: 409,
  ORDER_TAKEN: 409,

  // 403 — Forbidden
  UNAUTHORIZED: 403,
  CANNOT_CONFIRM_OWN_RESULT: 403,
  CANNOT_DISPUTE_OWN_RESULT: 403,
  CANNOT_RESPOND_TO_OWN_PROPOSAL: 403,
  OWNER_CANNOT_LEAVE: 403,
  NOT_A_MEMBER: 403,

  // 401 — Unauthorized
  INVALID_CREDENTIALS: 401,
  INVALID_ACCESS_TOKEN: 401,
  INVALID_REFRESH_TOKEN: 401,
  REFRESH_TOKEN_EXPIRED: 401,
  ACCOUNT_DISABLED: 401,

  // 422 — Unprocessable Entity
  TOURNAMENT_NOT_OPEN: 422,
  TOURNAMENT_FULL: 422,
  NOT_ENOUGH_PLAYERS: 422,
  INVALID_STATUS: 422,
  INVALID_STATUS_TRANSITION: 422,
  MATCH_NOT_ONGOING: 422,
  MATCH_NOT_PAUSED: 422,
  MATCH_ALREADY_FINISHED: 422,
  SESSION_STILL_ACTIVE: 422,
  UNCONFIRMED_RESULTS: 422,
  MATCH_DRAW: 422,
  RESULT_ALREADY_CONFIRMED: 422,
  RESULT_ALREADY_DISPUTED: 422,
  RESULT_NOT_DISPUTED: 422,
  RESULT_DISPUTED: 422,
  NO_RESULT: 422,
  INVITE_NOT_PENDING: 422,
  INVITE_EXPIRED: 422,
  CHALLENGE_NOT_PENDING: 422,
  PROPOSAL_NOT_PENDING: 422,
  INVALID_DATETIME: 422,
  SELF_CHALLENGE: 422,
  PHASE_ALREADY_STARTED: 422,
  PHASE_ALREADY_ACTIVE: 422,
  PHASE_NOT_ONGOING: 422,
  INCOMPLETE_MATCHES: 422,
  PREVIOUS_PHASE_NOT_COMPLETED: 422,
  NOT_ENOUGH_PARTICIPANTS: 422,
  TOURNAMENT_NOT_ONGOING: 422,
  INVALID_MATCH_STATUS: 422,
  INVALID_SESSION_STATUS: 422,
  RESULT_ALREADY_CONFIRMED_SESSION: 422,
};

function isDomainError(
  error: unknown
): error is InstanceType<(typeof DOMAIN_ERRORS)[number]> {
  return DOMAIN_ERRORS.some((DomainError) => error instanceof DomainError);
}

async function errorPlugin(fastify: FastifyInstance) {
  fastify.setErrorHandler((error, request, reply) => {
    // ------------------------------------------------------------------
    // Fastify validation errors (JSON Schema)
    // These are thrown automatically by Fastify when request body,
    // params or querystring don't match the route schema.
    // ------------------------------------------------------------------
    if (error.validation) {
      return reply.status(400).send({
        statusCode: 400,
        error: "VALIDATION_ERROR",
        message: error.message,
      });
    }

    // ------------------------------------------------------------------
    // Domain errors from core services
    // ------------------------------------------------------------------
    if (isDomainError(error)) {
      const code = (error as any).code as string;
      const statusCode = ERROR_STATUS_MAP[code] ?? 422;

      return reply.status(statusCode).send({
        statusCode,
        error: code,
        message: error.message,
      });
    }

    // ------------------------------------------------------------------
    // Unexpected errors — bugs, database failures, etc.
    // Log the full error internally but never leak details to the client.
    // ------------------------------------------------------------------
    fastify.log.error(error);

    return reply.status(500).send({
      statusCode: 500,
      error: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
    });
  });
}

export default fp(errorPlugin, {
  name: "error-plugin",
});
