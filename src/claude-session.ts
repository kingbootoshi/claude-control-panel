import { query, type SDKMessage, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { EventEmitter } from "events";
import fs from "fs/promises";
import path from "path";
import { config } from "./config";
import { MessageQueue } from "./message-queue";
import { logger } from "./utils/logger";
import type { ClaudeSessionOptions, ContentBlock, MessageContent, StreamEvent } from "./types";

const log = logger.session;

export class ClaudeSession extends EventEmitter {
  private messageQueue: MessageQueue<MessageContent>;
  private isRunning = false;
  private sessionId: string | null = null;
  private options: ClaudeSessionOptions;
  private currentMessageId: string | null = null;
  private currentTextBlockIndex: number = -1;
  private hasStreamedContent: boolean = false; // Track if we've streamed this turn
  private currentBlockIsText: boolean = false; // Track if current block is text
  private lastStepUsage: { inputTokens: number; cacheCreationTokens: number; cacheReadTokens: number } | null = null;
  private toolUseNameMap: Map<string, string> = new Map();
  private currentThinkingId: string | null = null;
  private currentThinkingBlockIndex: number = -1;

  constructor(options: ClaudeSessionOptions) {
    super();
    this.messageQueue = new MessageQueue();
    this.options = options;
  }

  async start(): Promise<void> {
    // Use provided resumeSessionId if available, otherwise try to load from file
    this.sessionId = this.options.resumeSessionId || await this.loadSessionId();
    this.isRunning = true;
    this.runQueryLoop();
    log.info({ sessionId: this.sessionId || "new", cwd: this.options.cwd }, "Session started");
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    this.messageQueue.close();
  }

  async sendMessage(content: MessageContent): Promise<void> {
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
        message: { role: "user", content: content as string | ContentBlock[] },
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
          cwd: this.options.cwd,
          model: config.model,
          resume: this.sessionId || undefined,
          permissionMode: "bypassPermissions",
          allowDangerouslySkipPermissions: true,
          settingSources: ["user", "project"], // Load ~/.claude/skills + workspace CLAUDE.md
          allowedTools: [...config.allowedTools],
          includePartialMessages: true,
          maxThinkingTokens: config.maxThinkingTokens,
        },
      });

      for await (const message of q) {
        await this.handleMessage(message);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorStack = err instanceof Error ? err.stack : undefined;
      log.error({ error: errorMessage, stack: errorStack }, "Query loop error");
      this.emit("event", { type: "error", content: errorMessage } as StreamEvent);
    }
  }

  private async handleMessage(message: SDKMessage): Promise<void> {
    log.info({ type: message.type, subtype: (message as { subtype?: string }).subtype }, "Received SDK message");
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
        } else if (message.subtype === "compact_boundary") {
          const preTokens = (message as { compact_metadata?: { pre_tokens?: number } }).compact_metadata?.pre_tokens;
          this.emit("event", {
            type: "compact_complete",
            preTokens,
          } as StreamEvent);
          log.info({ preTokens }, "Session compacted");
        }
        break;

      case "assistant":
        if (message.message.usage) {
          this.lastStepUsage = {
            inputTokens: message.message.usage.input_tokens ?? 0,
            cacheCreationTokens: message.message.usage.cache_creation_input_tokens ?? 0,
            cacheReadTokens: message.message.usage.cache_read_input_tokens ?? 0,
          };
        }
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
            this.toolUseNameMap.set(block.id, block.name);
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

          // Check if this is a thinking block starting
          if ("content_block" in streamEvent && streamEvent.content_block?.type === "thinking") {
            this.currentThinkingBlockIndex++;
            this.currentThinkingId = crypto.randomUUID();
            this.emit("event", {
              type: "thinking_start",
              thinkingId: this.currentThinkingId,
            } as StreamEvent);
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
            // Stream thinking content incrementally
            this.emit("event", {
              type: "thinking_delta",
              thinkingId: this.currentThinkingId || crypto.randomUUID(),
              content: (streamEvent.delta as { thinking: string }).thinking,
            } as StreamEvent);
          }
        } else if (streamEvent.type === "content_block_stop") {
          // Content block finished - emit appropriate complete event
          if (this.currentThinkingId) {
            // This was a thinking block
            this.emit("event", {
              type: "thinking_complete",
              thinkingId: this.currentThinkingId,
            } as StreamEvent);
            this.currentThinkingId = null;
          } else if (this.currentMessageId && this.currentBlockIsText) {
            // This was a text block
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

            const toolName = this.toolUseNameMap.get(block.tool_use_id);
            if (toolName) {
              this.toolUseNameMap.delete(block.tool_use_id);
            }
            this.emit("event", {
              type: "tool_result",
              toolUseId: block.tool_use_id,
              toolName,
              result: resultContent,
              isError: block.is_error,
            } as StreamEvent);
          }
        }
        break;

      case "result": {
        // Calculate cumulative input tokens and current context tokens separately
        const usage = (message as {
          usage?: {
            input_tokens?: number;
            cache_creation_input_tokens?: number;
            cache_read_input_tokens?: number;
          };
        }).usage;
        const totalInputTokensSpent = (usage?.input_tokens || 0) +
          (usage?.cache_creation_input_tokens || 0) +
          (usage?.cache_read_input_tokens || 0);
        const currentContextTokens = (this.lastStepUsage?.inputTokens || 0) +
          (this.lastStepUsage?.cacheCreationTokens || 0) +
          (this.lastStepUsage?.cacheReadTokens || 0);

        this.emit("event", {
          type: "turn_complete",
          durationMs: message.duration_ms,
          costUsd: message.total_cost_usd,
          currentContextTokens,
          totalInputTokensSpent,
        } as StreamEvent);
        log.info({ turns: message.num_turns, cost: message.total_cost_usd }, "Query completed");
        // Reset message tracking for next turn
        this.currentMessageId = null;
        this.currentTextBlockIndex = -1;
        this.hasStreamedContent = false;
        this.lastStepUsage = null;
        this.currentThinkingId = null;
        this.currentThinkingBlockIndex = -1;
        break;
      }
    }
  }

  private async loadSessionId(): Promise<string | null> {
    try {
      const data = await fs.readFile(this.options.sessionFile, "utf-8");
      const { sessionId } = JSON.parse(data);
      return sessionId;
    } catch {
      return null;
    }
  }

  private async saveSessionId(sessionId: string): Promise<void> {
    const stateDir = path.dirname(this.options.sessionFile);
    await fs.mkdir(stateDir, { recursive: true });
    await fs.writeFile(this.options.sessionFile, JSON.stringify({ sessionId }, null, 2));
  }
}
