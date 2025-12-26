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
import type { SessionManagerLike } from "./types";

const log = logger.server;

export function createHttpServer(sessionManager: SessionManagerLike): { server: HttpServer; wssHandler: ReturnType<typeof applyWSSHandler> } {
  const app = express();
  const server = createServer(app);
  const { createHttpContext, createWsContext } = createContextFactory(sessionManager);
  const uploadLimitMb = Math.ceil(config.uploadMaxBytes / (1024 * 1024));

  app.use(express.json({ limit: `${uploadLimitMb}mb` }));

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
    const runtimeConfig = sessionManager.getConfig();
    res.json({
      status: sessionManager.hasConfig() ? "ok" : "setup_required",
      assistantName: runtimeConfig?.assistantName ?? "Unconfigured",
      sessionId: sessionManager.getSessionId(),
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
