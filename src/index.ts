import { config } from "./config";
import { ClaudeSession } from "./claude-session";
import { createHttpServer } from "./server";
import { logger } from "./utils/logger";

const log = logger.daemon;

async function main() {
  log.info("═══════════════════════════════════════════════════════════");
  log.info("                  CLAUDE CONTROL PANEL                     ");
  log.info("═══════════════════════════════════════════════════════════");
  log.info({ assistant: config.assistantName }, "Assistant configured");
  log.info({ workspace: config.workspace }, "Workspace path");
  log.info({ port: config.port }, "Server port");
  log.info({ model: config.model }, "Model");
  log.info("═══════════════════════════════════════════════════════════");

  // Create Claude session (uses Agent SDK with OAuth - no API key needed)
  const session = new ClaudeSession();
  await session.start();

  // Create and start HTTP/WebSocket server
  const server = createHttpServer(session);

  server.listen(config.port, () => {
    log.info({ url: `http://localhost:${config.port}` }, "HTTP server listening");
    log.info({ url: `ws://localhost:${config.port}` }, "WebSocket available");
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    log.warn({ signal }, "Shutdown signal received");

    server.close(() => {
      log.info("HTTP server closed");
    });

    await session.stop();

    log.info("Shutdown complete");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Handle uncaught errors
  process.on("uncaughtException", (error) => {
    log.fatal({ error }, "Uncaught exception");
    shutdown("uncaughtException");
  });

  process.on("unhandledRejection", (reason) => {
    log.error({ reason }, "Unhandled rejection");
  });
}

main().catch((error) => {
  log.fatal({ error }, "Fatal error during startup");
  process.exit(1);
});
