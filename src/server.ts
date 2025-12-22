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
  agentId?: string;
  content?: string;
}

interface ServerMessage {
  type: string;
  agentId: string;
  timestamp: string;
  // Varying fields based on type
  content?: string;
  messageId?: string;
  toolUseId?: string;
  toolName?: string;
  input?: unknown;
  result?: string;
  isError?: boolean;
  sessionId?: string;
  tools?: string[];
  durationMs?: number;
  costUsd?: number;
  connected?: boolean;
  agents?: Array<{
    id: string;
    name: string;
    sessionId: string | null;
    status: string;
  }>;
}

function mapEventToMessage(event: StreamEvent, agentId: string): ServerMessage {
  const base = {
    agentId,
    timestamp: new Date().toISOString(),
  };

  switch (event.type) {
    case "text_delta":
      return {
        ...base,
        type: "text_delta",
        content: event.content,
        messageId: event.messageId,
      };

    case "text_complete":
      return {
        ...base,
        type: "text_complete",
        messageId: event.messageId,
      };

    case "tool_start":
      return {
        ...base,
        type: "tool_start",
        toolUseId: event.toolUseId,
        toolName: event.toolName,
        input: event.input,
      };

    case "tool_result":
      return {
        ...base,
        type: "tool_result",
        toolUseId: event.toolUseId,
        result: event.result,
        isError: event.isError,
      };

    case "thinking":
      return {
        ...base,
        type: "thinking",
        content: event.content,
      };

    case "turn_complete":
      return {
        ...base,
        type: "turn_complete",
        durationMs: event.durationMs,
        costUsd: event.costUsd,
      };

    case "error":
      return {
        ...base,
        type: "error",
        content: event.content,
      };

    case "init":
      return {
        ...base,
        type: "init",
        sessionId: event.sessionId,
        tools: event.tools,
      };

    default:
      return {
        ...base,
        type: event.type,
        content: event.content,
      };
  }
}

export function createHttpServer(session: ClaudeSession): HttpServer {
  const app: Express = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  // Default agent ID (single agent for now)
  const defaultAgentId = "ghost";

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
      agentId: defaultAgentId,
      timestamp: new Date().toISOString(),
      connected: true,
      agents: [
        {
          id: defaultAgentId,
          name: config.assistantName,
          sessionId: session.getSessionId(),
          status: "online",
        },
      ],
    };
    ws.send(JSON.stringify(statusMessage));

    // Subscribe to session events
    const eventHandler = (event: StreamEvent) => {
      if (ws.readyState === WebSocket.OPEN) {
        const message = mapEventToMessage(event, defaultAgentId);
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
              log.info({ chars: message.content.length, agentId: message.agentId }, "User message received");
              await session.sendMessage(message.content);
            }
            break;

          case "ping":
            ws.send(JSON.stringify({
              type: "pong",
              agentId: defaultAgentId,
              timestamp: new Date().toISOString(),
            }));
            break;

          default:
            log.warn({ message }, "Unknown message type");
        }
      } catch (error) {
        log.error({ error }, "Error handling message");
        ws.send(
          JSON.stringify({
            type: "error",
            agentId: defaultAgentId,
            timestamp: new Date().toISOString(),
            content: "Failed to process message",
          })
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
