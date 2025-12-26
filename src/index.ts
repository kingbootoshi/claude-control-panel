import { config } from "./config";
import { SessionManager } from "./session-manager";
import { createHttpServer } from "./server";
import { logger } from "./utils/logger";

const log = logger.daemon;

async function main() {
  log.info("═══════════════════════════════════════════════════════════");
  log.info("                  CLAUDE CONTROL PANEL                     ");
  log.info("═══════════════════════════════════════════════════════════");
  if (!config.authToken) {
    log.fatal("CCP_AUTH_TOKEN is required");
    process.exit(1);
  }
  log.info({ host: config.host, port: config.port }, "Server config");
  log.info({ model: config.model }, "Model");
  log.info("═══════════════════════════════════════════════════════════");

  // Create session manager (handles conditional startup)
  const sessionManager = new SessionManager();
  await sessionManager.initialize();

  // Log runtime config if available
  const runtimeConfig = sessionManager.getConfig();
  if (runtimeConfig) {
    log.info({ assistant: runtimeConfig.assistantName }, "Assistant configured");
    log.info({ agentId: runtimeConfig.primaryAgentId }, "Primary agent");
  } else {
    log.info("Awaiting setup wizard completion...");
  }

  // Create and start HTTP/WebSocket server
  const { server, wssHandler } = createHttpServer(sessionManager);

  server.listen(config.port, config.host, () => {
    log.info({ url: `http://${config.host}:${config.port}` }, "HTTP server listening");
    log.info({ url: `ws://${config.host}:${config.port}/trpc` }, "WebSocket available");
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    log.warn({ signal }, "Shutdown signal received");

    wssHandler.broadcastReconnectNotification();
    server.close(() => {
      log.info("HTTP server closed");
    });

    // SessionManager cleanup happens automatically

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
