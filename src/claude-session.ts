import { query, type SDKMessage, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { EventEmitter } from "events";
import fs from "fs/promises";
import path from "path";
import { config } from "./config";
import { MessageQueue } from "./message-queue";
import { logger } from "./utils/logger";

const log = logger.session;

export interface StreamEvent {
  type: "text_delta" | "text_complete" | "tool_start" | "tool_result" | "thinking" | "turn_complete" | "error" | "init";
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
}

export class ClaudeSession extends EventEmitter {
  private messageQueue: MessageQueue<string>;
  private isRunning = false;
  private sessionId: string | null = null;
  private sessionFile: string;
  private currentMessageId: string | null = null;
  private currentTextBlockIndex: number = -1;
  private hasStreamedContent: boolean = false; // Track if we've streamed this turn
  private currentBlockIsText: boolean = false; // Track if current block is text

  constructor() {
    super();
    this.messageQueue = new MessageQueue();
    this.sessionFile = path.join(config.workspace, config.sessionFile);
  }

  async start(): Promise<void> {
    this.sessionId = await this.loadSessionId();
    this.isRunning = true;
    this.runQueryLoop();
    log.info({ sessionId: this.sessionId || "new" }, "Session started");
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    this.messageQueue.close();
  }

  async sendMessage(content: string): Promise<void> {
    this.messageQueue.push(content);
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  private async *createMessageGenerator(): AsyncGenerator<SDKUserMessage> {
    while (this.isRunning) {
      const content = await this.messageQueue.pop();
      if (content === null) break;

      yield {
        type: "user",
        message: { role: "user", content },
        parent_tool_use_id: null,
        session_id: this.sessionId || "",
      };
    }
  }

  private async runQueryLoop(): Promise<void> {
    try {
      const q = query({
        prompt: this.createMessageGenerator(),
        options: {
          cwd: config.workspace,
          model: config.model,
          resume: this.sessionId || undefined,
          permissionMode: "bypassPermissions",
          allowDangerouslySkipPermissions: true,
          settingSources: ["project"], // Load CLAUDE.md
          includePartialMessages: true,
        },
      });

      for await (const message of q) {
        await this.handleMessage(message);
      }
    } catch (err) {
      log.error({ error: err }, "Query loop error");
      this.emit("event", { type: "error", content: String(err) } as StreamEvent);
    }
  }

  private async handleMessage(message: SDKMessage): Promise<void> {
    switch (message.type) {
      case "system":
        if (message.subtype === "init") {
          this.sessionId = message.session_id;
          await this.saveSessionId(message.session_id);
          this.emit("event", {
            type: "init",
            sessionId: message.session_id,
            tools: message.tools,
          } as StreamEvent);
          log.info({ sessionId: message.session_id, tools: message.tools }, "Session initialized");
        }
        break;

      case "assistant":
        // Generate a new message ID for this assistant turn if not already set by streaming
        if (!this.currentMessageId) {
          this.currentMessageId = crypto.randomUUID();
        }
        this.currentTextBlockIndex = -1;

        for (const block of message.message.content) {
          if (block.type === "text") {
            // Skip text if we already streamed it via stream_event
            if (this.hasStreamedContent) {
              log.debug({ chars: block.text.length }, "Skipping already-streamed text");
              continue;
            }
            // Complete text block (non-streaming fallback)
            this.emit("event", {
              type: "text_delta",
              content: block.text,
              messageId: this.currentMessageId,
            } as StreamEvent);
            this.emit("event", {
              type: "text_complete",
              messageId: this.currentMessageId,
            } as StreamEvent);
            log.debug({ chars: block.text.length }, "Received text");
          } else if (block.type === "tool_use") {
            log.info({ tool: block.name }, "Tool invoked");
            this.emit("event", {
              type: "tool_start",
              toolUseId: block.id,
              toolName: block.name,
              input: block.input,
            } as StreamEvent);
          }
        }
        break;

      case "stream_event": {
        // Handle partial streaming messages
        const streamEvent = message.event;

        if (streamEvent.type === "content_block_start") {
          // New content block starting
          this.currentTextBlockIndex++;
          this.currentBlockIsText = false; // Reset for new block
          if (!this.currentMessageId) {
            this.currentMessageId = crypto.randomUUID();
          }
        } else if (
          streamEvent.type === "content_block_delta" &&
          "delta" in streamEvent
        ) {
          if (streamEvent.delta.type === "text_delta") {
            this.hasStreamedContent = true; // Mark that we've streamed content
            this.currentBlockIsText = true; // Mark this block as text
            this.emit("event", {
              type: "text_delta",
              content: streamEvent.delta.text,
              messageId: this.currentMessageId || crypto.randomUUID(),
            } as StreamEvent);
          } else if (streamEvent.delta.type === "thinking_delta" && "thinking" in streamEvent.delta) {
            this.emit("event", {
              type: "thinking",
              content: (streamEvent.delta as { thinking: string }).thinking,
            } as StreamEvent);
          }
        } else if (streamEvent.type === "content_block_stop") {
          // Content block finished - only emit text_complete for text blocks
          if (this.currentMessageId && this.currentBlockIsText) {
            this.emit("event", {
              type: "text_complete",
              messageId: this.currentMessageId,
            } as StreamEvent);
          }
          this.currentBlockIsText = false; // Reset for next block
        }
        break;
      }

      case "user":
        // Tool results come back as user messages
        for (const block of message.message.content) {
          if (typeof block === "object" && block.type === "tool_result") {
            const resultContent = typeof block.content === "string"
              ? block.content
              : JSON.stringify(block.content);

            this.emit("event", {
              type: "tool_result",
              toolUseId: block.tool_use_id,
              result: resultContent,
              isError: block.is_error,
            } as StreamEvent);
          }
        }
        break;

      case "result":
        this.emit("event", {
          type: "turn_complete",
          durationMs: message.duration_ms,
          costUsd: message.cost_usd,
        } as StreamEvent);
        log.info({ turns: message.num_turns, cost: message.cost_usd }, "Query completed");
        // Reset message tracking for next turn
        this.currentMessageId = null;
        this.currentTextBlockIndex = -1;
        this.hasStreamedContent = false;
        break;
    }
  }

  private async loadSessionId(): Promise<string | null> {
    try {
      const data = await fs.readFile(this.sessionFile, "utf-8");
      const { sessionId } = JSON.parse(data);
      return sessionId;
    } catch {
      return null;
    }
  }

  private async saveSessionId(sessionId: string): Promise<void> {
    const stateDir = path.dirname(this.sessionFile);
    await fs.mkdir(stateDir, { recursive: true });
    await fs.writeFile(this.sessionFile, JSON.stringify({ sessionId }, null, 2));
  }
}
