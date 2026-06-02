import "dotenv/config";
import { buildApp } from "./app";
import { config } from "./config";

// =============================================================================
// SERVER
// =============================================================================
// The entry point of the application.
//
// Its only job is to:
//   1. Build the Fastify app (via buildApp)
//   2. Start listening on the configured host and port
//   3. Handle startup errors and graceful shutdown
//
// Keeping this separate from app.ts means the app can be imported in tests
// without actually binding to a port — tests call buildApp() directly,
// while the real server calls buildApp() + listen().
// =============================================================================

async function start() {
  const app = await buildApp();

  try {
    await app.listen({ host: config.host, port: config.port });
    console.log(`🚀 Server running at http://${config.host}:${config.port}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

// Graceful shutdown — ensures in-flight requests complete before closing
process.on("SIGINT", async () => {
  const app = await buildApp();
  await app.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  const app = await buildApp();
  await app.close();
  process.exit(0);
});

start();
