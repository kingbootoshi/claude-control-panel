import express, { Express, Request, Response } from "express";
import { createServer, Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import fs from "fs/promises";
import { config } from "./config";
import { ClaudeSession, StreamEvent, ContentBlock, ImageMediaType } from "./claude-session";
import { logger } from "./utils/logger";
import { loadSessionHistory } from "./history";
import { listWorkspaceFiles, readWorkspaceFile, isPathSafe } from "./utils/files";

const log = logger.server;

interface Attachment {
  type: "image" | "file";
  name: string;
  data: string; // base64
  mimeType: string;
}

interface ClientMessage {
  type: "user_message" | "ping";
  agentId?: string;
  content?: string;
  attachments?: Attachment[];
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
  inputTokens?: number;
  preTokens?: number;
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
      log.info({ inputTokens: event.inputTokens, cost: event.costUsd }, "Turn complete - token count");
      return {
        ...base,
        type: "turn_complete",
        durationMs: event.durationMs,
        costUsd: event.costUsd,
        inputTokens: event.inputTokens,
      };

    case "compact_complete":
      return {
        ...base,
        type: "compact_complete",
        preTokens: event.preTokens,
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

  // Files API - list workspace files for an agent
  app.get("/api/files/:agentName", async (req: Request, res: Response) => {
    try {
      const { agentName } = req.params;
      const agentPath = path.join(config.workspace, agentName);
      const files = await listWorkspaceFiles(agentPath);
      res.json(files);
    } catch (error) {
      log.error({ error }, "Failed to list files");
      res.status(500).json({ error: "Failed to list files" });
    }
  });

  // Files API - read a specific file from agent workspace
  app.get("/api/files/:agentName/*", async (req: Request, res: Response) => {
    try {
      const { agentName } = req.params;
      const filePath = req.params[0]; // Everything after /api/files/:agentName/
      const agentPath = path.join(config.workspace, agentName);
      const fullPath = path.join(agentPath, filePath);

      // Security: ensure path doesn't escape workspace
      if (!isPathSafe(agentPath, filePath)) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      const content = await readWorkspaceFile(fullPath);
      res.json({ content });
    } catch (error) {
      log.error({ error }, "Failed to read file");
      res.status(500).json({ error: "Failed to read file" });
    }
  });

  // Fallback to index.html for SPA routing
  app.get("*", (_req: Request, res: Response) => {
    res.sendFile(path.join(webPath, "index.html"));
  });

  // WebSocket handling
  wss.on("connection", async (ws: WebSocket) => {
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

    // Load and send history from SDK session file
    const sessionId = session.getSessionId();
    if (sessionId) {
      const { blocks: history, lastTokenCount } = await loadSessionHistory(sessionId);
      if (history.length > 0 || lastTokenCount > 0) {
        ws.send(JSON.stringify({
          type: "history",
          agentId: defaultAgentId,
          blocks: history,
          lastTokenCount,
        }));
        log.info({ blocks: history.length, lastTokenCount }, "Sent SDK history to client");
      }
    }

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
          case "user_message": {
            const { content, attachments } = message;

            // Build content blocks if we have attachments
            if (attachments && attachments.length > 0) {
              const contentBlocks: ContentBlock[] = [];
              let textContent = content || "";

              for (const att of attachments) {
                if (att.type === "image") {
                  // Add image block for SDK
                  contentBlocks.push({
                    type: "image",
                    source: {
                      type: "base64",
                      media_type: att.mimeType as ImageMediaType,
                      data: att.data,
                    },
                  });
                  log.info({ name: att.name, mimeType: att.mimeType }, "Image attachment added");
                } else {
                  // Save non-image files to workspace/uploads/
                  const uploadsDir = path.join(config.workspace, "uploads");
                  await fs.mkdir(uploadsDir, { recursive: true });
                  const filename = `${Date.now()}-${att.name}`;
                  const filepath = path.join(uploadsDir, filename);
                  await fs.writeFile(filepath, Buffer.from(att.data, "base64"));
                  textContent += `\n\n[Attached file: ${filepath}]`;
                  log.info({ name: att.name, path: filepath }, "File attachment saved");
                }
              }

              // Add text content if present
              if (textContent.trim()) {
                contentBlocks.push({ type: "text", text: textContent });
              }

              if (contentBlocks.length > 0) {
                log.info({ blocks: contentBlocks.length, agentId: message.agentId }, "Multimodal message received");
                await session.sendMessage(contentBlocks);
              }
            } else if (content && content.trim()) {
              // Plain text message
              log.info({ chars: content.length, agentId: message.agentId }, "User message received");
              await session.sendMessage(content);
            }
            break;
          }

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
