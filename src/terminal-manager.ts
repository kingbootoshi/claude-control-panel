import { EventEmitter } from "events";
import crypto from "crypto";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { ClaudeSession } from "./claude-session";
import { config } from "./config";
import { loadConfig } from "./config-store";
import { getProject, updateLastOpened } from "./project-store";
import { loadTerminals, upsertTerminal, updateTerminalStatus, updateTerminalSessionId, deleteTerminal } from "./terminal-store";
import type { ChildAgent, MessageContent, SessionMetrics, StreamEvent, Terminal, TerminalEvent, TerminalManagerLike } from "./types";
import { logger } from "./utils/logger";

const log = logger.daemon;
export const GHOST_TERMINAL_ID = "ghost";

export function isGhostSession(terminalId: string): boolean {
  return terminalId === GHOST_TERMINAL_ID;
}

/**
 * Manages multiple Claude sessions (terminals).
 * Terminals can be project-scoped (runs in project directory) or
 * non-project ghost sessions (runs in user home).
 */
export class TerminalManager extends EventEmitter implements TerminalManagerLike {
  private terminals: Map<string, ClaudeSession> = new Map();
  private terminalMeta: Map<string, Terminal> = new Map();
  private assistantName: string = "Claude";

  async initialize(): Promise<void> {
    // Load config to get assistant name
    const ccpConfig = await loadConfig();
    if (ccpConfig) {
      this.assistantName = ccpConfig.assistantName || "Claude";
    }

    // Ensure workspace directories exist
    await fs.mkdir(path.join(config.workspaceRoot, "state", "terminals"), { recursive: true });
    await fs.mkdir(path.join(config.workspaceRoot, "projects"), { recursive: true });
    await fs.mkdir(path.join(config.workspaceRoot, "knowledge"), { recursive: true });
    await fs.mkdir(path.join(config.workspaceRoot, "tools"), { recursive: true });

    // Load persisted terminals from disk
    const persistedTerminals = await loadTerminals();
    for (const terminal of persistedTerminals) {
      let needsPersist = false;

      // Mark any previously "running" or "starting" terminals as closed (server restarted)
      if (terminal.status === "running" || terminal.status === "starting") {
        terminal.status = "closed";
        needsPersist = true;
      }

      if (isGhostSession(terminal.id) && !terminal.isPersistent) {
        terminal.isPersistent = true;
        needsPersist = true;
      }

      if (!terminal.childAgents) {
        terminal.childAgents = [];
        needsPersist = true;
      }

      if (needsPersist) {
        await upsertTerminal(terminal);
      }
      this.terminalMeta.set(terminal.id, terminal);
    }

    log.info({ workspaceRoot: config.workspaceRoot, loadedTerminals: persistedTerminals.length }, "TerminalManager initialized");
  }

  /**
   * Spawn a new terminal.
   * @param projectId - Project ID or null for ghost session
   * @returns Terminal ID
   */
  async spawn(projectId: string | null): Promise<string> {
    if (projectId === null) {
      return this.getOrCreateGhost();
    }

    const id = crypto.randomUUID().slice(0, 8);

    // Each terminal gets its own unique session file
    // Sessions are stored per-terminal, not per-project or workspace
    const terminalsDir = path.join(config.workspaceRoot, "state", "terminals");
    await fs.mkdir(terminalsDir, { recursive: true });
    const sessionFile = path.join(terminalsDir, `${id}.json`);

    // Project terminal - runs in project directory
    const project = await getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }
    const cwd = project.path;

    // Update last opened timestamp
    await updateLastOpened(projectId);

    log.info({ terminalId: id, projectId, cwd, sessionFile }, "Spawning project terminal");

    // Create terminal metadata
    const meta: Terminal = {
      id,
      projectId,
      sessionId: null,
      status: "starting",
      createdAt: new Date().toISOString(),
      childAgents: [],
    };
    this.terminalMeta.set(id, meta);
    await upsertTerminal(meta);

    // Create and start the session
    const session = new ClaudeSession({ cwd, sessionFile });

    // Forward events with terminal ID
    session.on("event", (event: StreamEvent) => {
      // Update session ID when we get init event
      if (event.type === "init" && event.sessionId) {
        const terminalMeta = this.terminalMeta.get(id);
        if (terminalMeta) {
          terminalMeta.sessionId = event.sessionId;
          terminalMeta.status = "running";
          // Persist the session ID
          updateTerminalSessionId(id, event.sessionId);
          updateTerminalStatus(id, "running");
        }
      }

      this.emit("terminal_event", { terminalId: id, event } as TerminalEvent);
    });

    await session.start();
    this.terminals.set(id, session);

    // Update status to running
    meta.status = "running";
    meta.sessionId = session.getSessionId();
    await upsertTerminal(meta);

    return id;
  }

  /**
   * Get or create the ghost terminal.
   */
  async getOrCreateGhost(): Promise<string> {
    const existing = this.terminalMeta.get(GHOST_TERMINAL_ID);
    if (existing) {
      if (!existing.isPersistent) {
        existing.isPersistent = true;
        await upsertTerminal(existing);
      }

      const hasSession = this.terminals.has(GHOST_TERMINAL_ID);
      if (!hasSession) {
        if (existing.status === "running" || existing.status === "starting") {
          existing.status = "closed";
          await updateTerminalStatus(GHOST_TERMINAL_ID, "closed");
        }

        if (existing.status === "closed" || existing.status === "idle" || existing.status === "dead") {
          await this.resume(GHOST_TERMINAL_ID);
        }
      }

      return existing.id;
    }

    const id = GHOST_TERMINAL_ID;
    const terminalsDir = path.join(config.workspaceRoot, "state", "terminals");
    await fs.mkdir(terminalsDir, { recursive: true });
    const sessionFile = path.join(terminalsDir, `${id}.json`);
    const cwd = os.homedir();

    log.info({ terminalId: id, cwd, sessionFile }, "Spawning ghost terminal");

    const meta: Terminal = {
      id,
      projectId: null,
      sessionId: null,
      status: "starting",
      createdAt: new Date().toISOString(),
      isPersistent: true,
      childAgents: [],
    };
    this.terminalMeta.set(id, meta);
    await upsertTerminal(meta);

    const session = new ClaudeSession({ cwd, sessionFile });

    session.on("event", (event: StreamEvent) => {
      if (event.type === "init" && event.sessionId) {
        const terminalMeta = this.terminalMeta.get(id);
        if (terminalMeta) {
          terminalMeta.sessionId = event.sessionId;
          terminalMeta.status = "running";
          updateTerminalSessionId(id, event.sessionId);
          updateTerminalStatus(id, "running");
        }
      }

      this.emit("terminal_event", { terminalId: id, event } as TerminalEvent);
    });

    await session.start();
    this.terminals.set(id, session);

    meta.status = "running";
    meta.sessionId = session.getSessionId();
    await upsertTerminal(meta);

    return id;
  }

  /**
   * Send a message to a specific terminal.
   */
  async send(terminalId: string, content: MessageContent): Promise<void> {
    const session = this.terminals.get(terminalId);
    if (!session) {
      throw new Error(`Terminal not found: ${terminalId}`);
    }
    await session.sendMessage(content);
  }

  /**
   * Close a terminal (can be resumed later).
   * Stops the session but keeps metadata for resuming.
   */
  async close(terminalId: string): Promise<void> {
    const session = this.terminals.get(terminalId);
    if (session) {
      await session.stop();
      this.terminals.delete(terminalId);
    }

    const meta = this.terminalMeta.get(terminalId);
    if (meta) {
      meta.status = "closed";
      await updateTerminalStatus(terminalId, "closed");
    }

    log.info({ terminalId }, "Terminal closed");
  }

  /**
   * Resume a closed terminal.
   * Creates a new session that resumes from the saved session ID.
   */
  async resume(terminalId: string): Promise<void> {
    const meta = this.terminalMeta.get(terminalId);
    if (!meta) {
      throw new Error(`Terminal not found: ${terminalId}`);
    }

    if (meta.status === "running" || meta.status === "starting") {
      throw new Error(`Terminal is already running: ${terminalId}`);
    }

    // Determine cwd based on project
    let cwd: string;
    if (meta.projectId) {
      const project = await getProject(meta.projectId);
      if (!project) {
        throw new Error(`Project not found: ${meta.projectId}`);
      }
      cwd = project.path;
      await updateLastOpened(meta.projectId);
    } else if (isGhostSession(meta.id)) {
      cwd = os.homedir();
    } else {
      cwd = config.workspaceRoot;
    }

    const sessionFile = path.join(config.workspaceRoot, "state", "terminals", `${terminalId}.json`);

    // Create session with resume
    const session = new ClaudeSession({
      cwd,
      sessionFile,
      resumeSessionId: meta.sessionId || undefined,
    });

    // Forward events with terminal ID
    session.on("event", (event: StreamEvent) => {
      if (event.type === "init" && event.sessionId) {
        const terminalMeta = this.terminalMeta.get(terminalId);
        if (terminalMeta) {
          terminalMeta.sessionId = event.sessionId;
          terminalMeta.status = "running";
          updateTerminalSessionId(terminalId, event.sessionId);
          updateTerminalStatus(terminalId, "running");
        }
      }
      this.emit("terminal_event", { terminalId, event } as TerminalEvent);
    });

    await session.start();
    this.terminals.set(terminalId, session);

    meta.status = "running";
    await updateTerminalStatus(terminalId, "running");

    log.info({ terminalId, sessionId: meta.sessionId }, "Terminal resumed");
  }

  /**
   * Kill a terminal permanently (cannot be resumed).
   * Removes all data associated with the terminal.
   */
  async kill(terminalId: string): Promise<void> {
    const session = this.terminals.get(terminalId);
    if (session) {
      await session.stop();
      this.terminals.delete(terminalId);
    }

    // Delete session file
    const sessionFile = path.join(config.workspaceRoot, "state", "terminals", `${terminalId}.json`);
    try {
      await fs.unlink(sessionFile);
    } catch {
      // File may not exist
    }

    // Remove from store and memory
    await deleteTerminal(terminalId);
    this.terminalMeta.delete(terminalId);

    log.info({ terminalId }, "Terminal killed permanently");
  }

  /**
   * List all terminals.
   */
  list(): Terminal[] {
    return Array.from(this.terminalMeta.values());
  }

  /**
   * List child agents for a Claude session.
   */
  listChildAgents(sessionId: string): ChildAgent[] {
    const terminal = this.findBySessionId(sessionId);
    return terminal?.childAgents ?? [];
  }

  /**
   * Get a specific terminal.
   */
  get(terminalId: string): Terminal | undefined {
    return this.terminalMeta.get(terminalId);
  }

  /**
   * List terminals for a specific project (or non-project terminals if null).
   */
  listByProject(projectId: string | null): Terminal[] {
    return Array.from(this.terminalMeta.values()).filter(
      (t) => t.projectId === projectId
    );
  }

  /**
   * Check if config exists.
   */
  hasConfig(): boolean {
    // For now, just check if workspace root exists
    return true;
  }

  /**
   * Get assistant name from config.
   */
  getAssistantName(): string {
    return this.assistantName;
  }

  /**
   * Get session ID for a terminal.
   */
  getSessionId(terminalId: string): string | null {
    const session = this.terminals.get(terminalId);
    return session?.getSessionId() || null;
  }

  /**
   * Upsert a child agent linked to a Claude session.
   */
  async upsertChildAgent(childAgent: ChildAgent): Promise<boolean> {
    const terminal = this.findBySessionId(childAgent.parentSessionId);
    if (!terminal) {
      log.debug({ parentSessionId: childAgent.parentSessionId, childAgentId: childAgent.id }, "No terminal for child agent");
      return false;
    }

    const existingIndex = terminal.childAgents.findIndex((agent) => agent.id === childAgent.id);
    if (existingIndex >= 0) {
      terminal.childAgents[existingIndex] = childAgent;
    } else {
      terminal.childAgents.push(childAgent);
    }

    await upsertTerminal(terminal);
    return true;
  }

  private findBySessionId(sessionId: string): Terminal | undefined {
    return Array.from(this.terminalMeta.values()).find((terminal) => terminal.sessionId === sessionId);
  }

  /**
   * Get metrics for a running terminal session.
   */
  getMetrics(terminalId: string): SessionMetrics | null {
    const session = this.terminals.get(terminalId);
    return session ? session.getMetrics() : null;
  }

  /**
   * Trigger a manual compaction for a running terminal session.
   */
  async triggerCompact(terminalId: string, instructions?: string): Promise<void> {
    const session = this.terminals.get(terminalId);
    if (!session) {
      throw new Error(`Terminal not found: ${terminalId}`);
    }

    const trimmed = instructions?.trim() || null;
    await session.compactNow(trimmed);
  }
}
