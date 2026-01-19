import { config } from "./config";
import { GHOST_TERMINAL_ID, TerminalManager } from "./terminal-manager";
import { TmuxManager } from "./tmux-manager";
import { CodexManager } from "./codex-manager";
import { AgentWatcher } from "./agent-watcher";
import { createHttpServer } from "./server";
import { logger } from "./utils/logger";

const log = logger.daemon;

async function main() {
  log.info("═══════════════════════════════════════════════════════════");
  log.info("                  GHOST CONTROL PANEL                      ");
  log.info("═══════════════════════════════════════════════════════════");
  if (!config.authToken) {
    log.fatal("CCP_AUTH_TOKEN is required");
    process.exit(1);
  }
  log.info({ host: config.host, port: config.port }, "Server config");
  log.info({ model: config.model }, "Model");
  log.info({ workspaceRoot: config.workspaceRoot }, "Workspace root");
  log.info("═══════════════════════════════════════════════════════════");

  // Create terminal manager (handles multiple Claude sessions)
  const terminalManager = new TerminalManager();
  await terminalManager.initialize();

  const ghostTerminal = terminalManager.get(GHOST_TERMINAL_ID);
  if (ghostTerminal && ghostTerminal.status !== "running" && ghostTerminal.status !== "starting") {
    log.info({ terminalId: GHOST_TERMINAL_ID }, "Resuming ghost terminal");
    await terminalManager.resume(GHOST_TERMINAL_ID);
  }

  // Create tmux manager (multi-pane terminal orchestration)
  const tmuxManager = new TmuxManager();
  await tmuxManager.initialize();

  // Create codex manager (GPT Codex agent jobs)
  const codexManager = new CodexManager();
  await codexManager.initialize();

  const agentWatcher = new AgentWatcher(terminalManager);
  agentWatcher.start();

  // Log assistant name if configured
  const assistantName = terminalManager.getAssistantName();
  if (assistantName !== "Claude") {
    log.info({ assistant: assistantName }, "Assistant configured");
  } else {
    log.info("Awaiting setup wizard completion...");
  }

  // Create and start HTTP/WebSocket server
  const { server, wssHandler } = createHttpServer({ terminalManager, tmuxManager, codexManager, agentWatcher });

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

    // Clean up managers
    await tmuxManager.cleanup();
    await codexManager.cleanup();
    agentWatcher.stop();

    // Kill all terminals
    const terminals = terminalManager.list();
    for (const terminal of terminals) {
      if (terminal.id === GHOST_TERMINAL_ID) {
        await terminalManager.close(terminal.id);
        continue;
      }
      await terminalManager.kill(terminal.id);
    }

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
