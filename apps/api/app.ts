import Fastify from "fastify";
import cookie from "@fastify/cookie";
import errorPlugin from "./plugins/error.plugin";
import authPlugin from "./plugins/auth.plugin";
import { config } from "./config";
import cors from "@fastify/cors";

// =============================================================================
// APP
// =============================================================================
// Creates and configures the Fastify instance.
//
// This file is responsible for:
//   1. Creating the Fastify instance with logging and other global options
//   2. Registering plugins in the correct order (error handler first,
//      then auth, then routes)
//   3. Exporting the app for use in server.ts and in tests
//
// Keeping app creation separate from server startup (server.ts) means
// tests can import the app directly without starting a real HTTP server.
// =============================================================================

export async function buildApp() {
  const app = Fastify({
    logger:
      config.nodeEnv === "development"
        ? { level: "info", transport: { target: "pino-pretty" } }
        : { level: "warn" },
  });

  // CORS support — required for accepting requests from the frontend
  await app.register(cors, {
    origin: process.env.WEB_URL ?? "http://localhost:3001",
    credentials: true, // required for cookies to be sent cross-origin
  });

  // --------------------------------------------------------------------------
  // PLUGINS
  // Registered in order — each plugin is available to everything registered
  // after it. Error handler must come first so it catches errors from all
  // subsequent plugins and routes.
  // --------------------------------------------------------------------------

  // Cookie support — required for reading/writing HttpOnly JWT cookies
  await app.register(cookie, {
    secret: config.cookieSecret,
    hook: "onRequest",
  });

  // Global error handler — maps domain errors to HTTP responses
  await app.register(errorPlugin);

  // Auth decorator — adds `app.authenticate` hook for protecting routes
  await app.register(authPlugin);

  // --------------------------------------------------------------------------
  // ROUTES
  // Each route file is registered under its own prefix.
  // Routes are imported here lazily to keep startup fast.
  // --------------------------------------------------------------------------

  const { sportRoutes } = await import("./routes/sport.routes");
  const { authRoutes } = await import("./routes/auth.routes");
  const { playerRoutes } = await import("./routes/player.routes");
  const { teamRoutes } = await import("./routes/team.routes");
  const { challengeRoutes } = await import("./routes/challenge.routes");
  const { tournamentRoutes } = await import("./routes/tournament.routes");
  const { phaseRoutes, matchRoutes, sessionRoutes, scheduleRoutes } =
    await import("./routes/phase-match-session-schedule.routes");

  await app.register(sportRoutes, { prefix: "/sports" });
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(playerRoutes, { prefix: "/players" });
  await app.register(teamRoutes, { prefix: "/teams" });
  await app.register(challengeRoutes, { prefix: "/challenges" });
  await app.register(tournamentRoutes, { prefix: "/tournaments" });
  await app.register(phaseRoutes, { prefix: "/tournaments" });
  await app.register(matchRoutes, { prefix: "/matches" });
  await app.register(sessionRoutes, { prefix: "/sessions" });
  await app.register(scheduleRoutes, { prefix: "/schedule" });

  return app;
}
