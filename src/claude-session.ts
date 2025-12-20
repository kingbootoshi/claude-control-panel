import { query, type SDKMessage, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { EventEmitter } from "events";
import fs from "fs/promises";
import path from "path";
import { config } from "./config";
import { MessageQueue } from "./message-queue";
import { logger } from "./utils/logger";

const log = logger.session;

export interface StreamEvent {
  type: "text" | "tool_use" | "tool_result" | "thinking" | "done" | "error" | "init";
  content?: string;
  tool?: string;
  input?: unknown;
  sessionId?: string;
}

export class ClaudeSession extends EventEmitter {
  private messageQueue: MessageQueue<string>;
  private isRunning = false;
  private sessionId: string | null = null;
  private sessionFile: string;

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
          this.emit("event", { type: "init", sessionId: message.session_id } as StreamEvent);
          log.info({ sessionId: message.session_id, tools: message.tools }, "Session initialized");
        }
        break;

      case "assistant":
        for (const block of message.message.content) {
          if (block.type === "text") {
            log.debug({ chars: block.text.length }, "Received text");
            this.emit("event", { type: "text", content: block.text } as StreamEvent);
          } else if (block.type === "tool_use") {
            log.info({ tool: block.name }, "Tool invoked");
            this.emit("event", {
              type: "tool_use",
              tool: block.name,
              input: block.input,
            } as StreamEvent);
          }
        }
        break;

      case "stream_event": {
        // Handle partial streaming messages (SDKPartialAssistantMessage)
        const streamEvent = message.event;
        if (
          streamEvent.type === "content_block_delta" &&
          "delta" in streamEvent &&
          streamEvent.delta.type === "text_delta"
        ) {
          this.emit("event", {
            type: "text",
            content: streamEvent.delta.text,
          } as StreamEvent);
        }
        break;
      }

      case "user":
        // Tool results come back as user messages
        for (const block of message.message.content) {
          if (typeof block === "object" && block.type === "tool_result") {
            this.emit("event", {
              type: "tool_result",
              tool: block.tool_use_id,
              content:
                typeof block.content === "string"
                  ? block.content
                  : JSON.stringify(block.content),
            } as StreamEvent);
          }
        }
        break;

      case "result":
        this.emit("event", { type: "done" } as StreamEvent);
        log.info({ turns: message.num_turns, cost: message.total_cost_usd }, "Query completed");
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
