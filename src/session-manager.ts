import { EventEmitter } from "events";
import fs from "fs/promises";
import path from "path";
import { ClaudeSession } from "./claude-session";
import { config, getAgentWorkspace, getRuntimeConfig } from "./config";
import { loadConfig, saveConfig, slugify, renameAgentWorkspace, type CCPConfig } from "./config-store";
import type { MessageContent, SessionLike, StreamEvent } from "./types";
import { logger } from "./utils/logger";

const log = logger.daemon;

/**
 * Null session that does nothing - used when no config exists.
 */
class NullSession extends EventEmitter implements SessionLike {
  async sendMessage(_content: MessageContent): Promise<void> {
    throw new Error("No session active - please complete setup first");
  }
  getSessionId(): string | null {
    return null;
  }
}

/**
 * Manages the Claude session lifecycle.
 * Allows starting, stopping, and restarting the session.
 */
export class SessionManager extends EventEmitter implements SessionLike {
  private session: SessionLike;
  private runtimeConfig: { primaryAgentId: string; assistantName: string } | null = null;
  private eventHandler: (event: StreamEvent) => void;

  constructor() {
    super();
    this.session = new NullSession();
    this.eventHandler = (event: StreamEvent) => this.emit("event", event);
  }

  async initialize(): Promise<void> {
    this.runtimeConfig = await getRuntimeConfig();
    if (this.runtimeConfig) {
      await this.startSession();
    } else {
      log.info("No config found - waiting for setup wizard");
    }
  }

  private async startSession(): Promise<void> {
    if (!this.runtimeConfig) return;

    // Ensure workspace exists
    const workspacePath = getAgentWorkspace(this.runtimeConfig.primaryAgentId);
    await fs.mkdir(workspacePath, { recursive: true });
    await fs.mkdir(path.join(workspacePath, "knowledge"), { recursive: true });
    await fs.mkdir(path.join(workspacePath, "tools"), { recursive: true });
    await fs.mkdir(path.join(workspacePath, "state"), { recursive: true });

    // Create the real session
    const realSession = new ClaudeSession();
    realSession.on("event", this.eventHandler);
    await realSession.start();
    this.session = realSession;

    log.info({ agentId: this.runtimeConfig.primaryAgentId }, "Session started");
  }

  private async stopSession(): Promise<void> {
    if (this.session instanceof ClaudeSession) {
      this.session.off("event", this.eventHandler);
      await this.session.stop();
    }
    this.session = new NullSession();
  }

  async restart(): Promise<void> {
    await this.stopSession();
    this.runtimeConfig = await getRuntimeConfig();
    if (this.runtimeConfig) {
      await this.startSession();
    }
  }

  async setupAgent(name: string, claudeMd: string): Promise<{ agentId: string }> {
    const id = slugify(name);
    const existingConfig = await loadConfig();
    const oldId = existingConfig?.primaryAgent.id;

    // If ID changed and old workspace exists, rename it
    if (oldId && oldId !== id) {
      await renameAgentWorkspace(config.workspaceRoot, oldId, id);
    }

    // Create new config
    const newConfig: CCPConfig = {
      version: 1,
      primaryAgent: { id, name },
    };

    // Ensure workspace directories exist
    const workspacePath = getAgentWorkspace(id);
    await fs.mkdir(workspacePath, { recursive: true });
    await fs.mkdir(path.join(workspacePath, "knowledge"), { recursive: true });
    await fs.mkdir(path.join(workspacePath, "tools"), { recursive: true });
    await fs.mkdir(path.join(workspacePath, "state"), { recursive: true });

    // Write CLAUDE.md
    await fs.writeFile(path.join(workspacePath, "CLAUDE.md"), claudeMd);

    // Save config
    await saveConfig(newConfig);

    log.info({ agentId: id, name }, "Agent configured");

    return { agentId: id };
  }

  // SessionLike interface implementation
  async sendMessage(content: MessageContent): Promise<void> {
    return this.session.sendMessage(content);
  }

  getSessionId(): string | null {
    return this.session.getSessionId();
  }

  getConfig(): { primaryAgentId: string; assistantName: string } | null {
    return this.runtimeConfig;
  }

  hasConfig(): boolean {
    return this.runtimeConfig !== null;
  }
}
