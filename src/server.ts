import express, { Express, Request, Response } from "express";
import { createServer, Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import { config } from "./config";
import { ClaudeSession, StreamEvent } from "./claude-session";
import { logger } from "./utils/logger";

const log = logger.server;

interface ClientMessage {
  type: "user_message" | "ping";
  content?: string;
}

interface ServerMessage {
  type: "text" | "tool_use" | "tool_result" | "thinking" | "done" | "error" | "status" | "pong" | "init";
  content?: string;
  tool?: string;
  input?: unknown;
  sessionId?: string;
  status?: {
    connected: boolean;
    sessionId: string | null;
    assistantName: string;
  };
}

export function createHttpServer(session: ClaudeSession): HttpServer {
  const app: Express = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  // Middleware
  app.use(express.json());

  // Serve static files from web UI
  const webPath = path.join(process.cwd(), "web", "dist");
  app.use(express.static(webPath));

  // Health check endpoint
  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      assistantName: config.assistantName,
      sessionId: session.getSessionId(),
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // API endpoint for session info
  app.get("/api/session", (_req: Request, res: Response) => {
    res.json({
      assistantName: config.assistantName,
      sessionId: session.getSessionId(),
      // Note: Messages are managed by the Agent SDK, not stored locally
    });
  });

  // Fallback to index.html for SPA routing
  app.get("*", (_req: Request, res: Response) => {
    res.sendFile(path.join(webPath, "index.html"));
  });

  // WebSocket handling
  wss.on("connection", (ws: WebSocket) => {
    log.info("Client connected");

    // Send initial status
    const statusMessage: ServerMessage = {
      type: "status",
      status: {
        connected: true,
        sessionId: session.getSessionId(),
        assistantName: config.assistantName,
      },
    };
    ws.send(JSON.stringify(statusMessage));

    // Subscribe to session events
    const eventHandler = (event: StreamEvent) => {
      if (ws.readyState === WebSocket.OPEN) {
        const message: ServerMessage = {
          type: event.type,
          content: event.content,
          tool: event.tool,
          input: event.input,
          sessionId: event.sessionId,
        };
        ws.send(JSON.stringify(message));
      }
    };

    session.on("event", eventHandler);

    // Handle incoming messages
    ws.on("message", async (data: Buffer) => {
      try {
        const message: ClientMessage = JSON.parse(data.toString());

        switch (message.type) {
          case "user_message":
            if (message.content && message.content.trim()) {
              log.info({ chars: message.content.length }, "User message received");
              await session.sendMessage(message.content);
            }
            break;

          case "ping":
            ws.send(JSON.stringify({ type: "pong" } as ServerMessage));
            break;

          default:
            log.warn({ message }, "Unknown message type");
        }
      } catch (error) {
        log.error({ error }, "Error handling message");
        ws.send(
          JSON.stringify({
            type: "error",
            content: "Failed to process message",
          } as ServerMessage)
        );
      }
    });

    // Handle disconnection
    ws.on("close", () => {
      log.info("Client disconnected");
      session.off("event", eventHandler);
    });

    // Handle errors
    ws.on("error", (error) => {
      log.error({ error }, "WebSocket error");
      session.off("event", eventHandler);
    });
  });

  // Broadcast to all connected clients
  const broadcast = (message: ServerMessage) => {
    const data = JSON.stringify(message);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  };

  // Expose broadcast function on server
  (server as HttpServer & { broadcast: typeof broadcast }).broadcast = broadcast;

  return server;
}
