import express from "express";
import { createServer, type Server as HttpServer } from "http";
import path from "path";
import { WebSocketServer } from "ws";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import { config } from "./config";
import { createContextFactory } from "./trpc/context";
import { appRouter } from "./trpc/router";
import { logger } from "./utils/logger";
import type { TerminalManagerLike } from "./types";
import type { TmuxManager } from "./tmux-manager";
import type { CodexManager } from "./codex-manager";
import type { AgentWatcher } from "./agent-watcher";

const log = logger.server;

export interface ServerOptions {
  terminalManager: TerminalManagerLike;
  tmuxManager: TmuxManager;
  codexManager: CodexManager;
  agentWatcher: AgentWatcher;
}

export function createHttpServer(options: ServerOptions): { server: HttpServer; wssHandler: ReturnType<typeof applyWSSHandler> } {
  const { terminalManager, tmuxManager, codexManager, agentWatcher } = options;
  const app = express();
  const server = createServer(app);
  const { createHttpContext, createWsContext } = createContextFactory({ terminalManager, tmuxManager, codexManager, agentWatcher });
  const uploadLimitMb = Math.ceil(config.uploadMaxBytes / (1024 * 1024));

  app.use(express.json({ limit: `${uploadLimitMb}mb` }));

  // Log all incoming requests for debugging
  app.use((req, _res, next) => {
    log.info({
      method: req.method,
      url: req.url,
      ip: req.ip,
      origin: req.headers.origin,
      userAgent: req.headers['user-agent']?.slice(0, 50)
    }, "Incoming request");
    next();
  });

  app.use(
    "/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext: createHttpContext,
    })
  );

  const webPath = path.join(process.cwd(), "web", "dist");
  app.use(express.static(webPath));

  app.get("/health", (_req, res) => {
    res.json({
      status: terminalManager.hasConfig() ? "ok" : "setup_required",
      assistantName: terminalManager.getAssistantName(),
      terminals: terminalManager.list().length,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get("*", (_req, res) => {
    res.sendFile(path.join(webPath, "index.html"));
  });

  const wss = new WebSocketServer({
    server,
    path: "/trpc",
    maxPayload: config.maxWsPayloadBytes,
  });

  const wssHandler = applyWSSHandler({
    wss,
    router: appRouter,
    createContext: createWsContext,
  });

  wss.on("connection", (ws, req) => {
    const connectionMeta = {
      ip: req.socket.remoteAddress,
      origin: req.headers.origin,
      userAgent: req.headers["user-agent"],
    };
    log.info(
      connectionMeta,
      "Client connected"
    );
    ws.once("close", () => {
      log.info(connectionMeta, "Client disconnected");
    });
  });

  return { server, wssHandler };
}
