import fs from "fs/promises";
import { config, getAgentWorkspace } from "./config";
import { ClaudeSession } from "./claude-session";
import { createHttpServer } from "./server";
import { logger } from "./utils/logger";

const log = logger.daemon;

async function ensureWorkspaceExists(): Promise<void> {
  const workspacePath = getAgentWorkspace(config.primaryAgentId);
  await fs.mkdir(workspacePath, { recursive: true });
}

async function main() {
  log.info("═══════════════════════════════════════════════════════════");
  log.info("                  CLAUDE CONTROL PANEL                     ");
  log.info("═══════════════════════════════════════════════════════════");
  if (!config.authToken) {
    log.fatal("CCP_AUTH_TOKEN is required");
    process.exit(1);
  }
  log.info({ assistant: config.assistantName }, "Assistant configured");
  log.info({ agentId: config.primaryAgentId }, "Primary agent");
  log.info({ workspace: getAgentWorkspace(config.primaryAgentId) }, "Workspace path");
  log.info({ host: config.host, port: config.port }, "Server listening");
  log.info({ model: config.model }, "Model");
  log.info("═══════════════════════════════════════════════════════════");

  // Ensure workspace directory exists
  await ensureWorkspaceExists();

  // Create Claude session (uses Agent SDK with OAuth - no API key needed)
  const session = new ClaudeSession();
  await session.start();

  // Create and start HTTP/WebSocket server
  const { server, wssHandler } = createHttpServer(session);

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
