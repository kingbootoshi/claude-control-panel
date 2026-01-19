import { EventEmitter } from "events";
import crypto from "crypto";
import { createLogger } from "./utils/logger";
import type { CaptureOpts, TmuxPane, TmuxSession } from "./types";

export type TmuxAgentType = "claude-code" | "codex" | "shell";
export type TmuxPaneStatus = "idle" | "running" | "waiting" | "complete" | "error";

export interface TmuxPaneState extends TmuxPane {
  index: number;
  agentType?: TmuxAgentType;
  agentId?: string;
  projectId?: string;
  status: TmuxPaneStatus;
  lastOutput: string;
  title?: string;
}

export interface TmuxSessionState extends TmuxSession {
  panes: TmuxPaneState[];
  layout: "tiled" | "even-horizontal" | "even-vertical" | "main-horizontal" | "main-vertical";
  createdAt: string;
}

export interface TmuxOutputEvent {
  paneId: string;
  output: string;
  timestamp: string;
}

export interface TmuxManagerEvents {
  output: (event: TmuxOutputEvent) => void;
  pane_status: (paneId: string, status: TmuxPaneStatus) => void;
}

const SESSION_PREFIX = "ccp-";
const DEFAULT_SESSION_NAME = "gcp";
const OUTPUT_POLL_INTERVAL = 500; // ms
const SESSION_FORMAT = "#{session_name}\t#{session_windows}\t#{session_created}\t#{session_attached}";
const PANE_FORMAT = "#{pane_id}\t#{session_name}\t#{window_index}\t#{pane_index}\t#{pane_current_path}\t#{pane_current_command}\t#{pane_active}\t#{pane_title}";

/**
 * Manages tmux sessions for multi-pane terminal orchestration.
 */
export class TmuxManager extends EventEmitter {
  private logger = createLogger("tmux");
  private session: TmuxSessionState | null = null;
  private paneOutputCache: Map<string, string> = new Map();
  private outputPollers: Map<string, NodeJS.Timeout> = new Map();
  private initialized = false;

  private withSessionPrefix(name: string): string {
    return name.startsWith(SESSION_PREFIX) ? name : `${SESSION_PREFIX}${name}`;
  }

  private stripSessionPrefix(name: string): string {
    return name.startsWith(SESSION_PREFIX) ? name.slice(SESSION_PREFIX.length) : name;
  }

  /**
   * Check if tmux is available on the system.
   */
  async isTmuxAvailable(): Promise<boolean> {
    const result = await this.runTmux(["-V"]);
    return result.exitCode === 0;
  }

  /**
   * Initialize the tmux manager.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const tmuxAvailable = await this.isTmuxAvailable();
    if (!tmuxAvailable) {
      this.logger.warn("tmux not found - tmux features will be unavailable");
      return;
    }

    await this.ensureSession(DEFAULT_SESSION_NAME);
    await this.refreshSessionState();
    this.initialized = true;
    this.logger.info({ sessionName: DEFAULT_SESSION_NAME }, "TmuxManager initialized");
  }

  /**
   * Ensure a tmux session exists.
   */
  async ensureSession(name: string): Promise<void> {
    const tmuxAvailable = await this.isTmuxAvailable();
    if (!tmuxAvailable) {
      this.logger.warn("tmux not found - tmux features will be unavailable");
      return;
    }

    const sessionName = this.withSessionPrefix(name);
    const exists = await this.sessionExists(sessionName);
    if (exists) return;

    const result = await this.runTmux(["new-session", "-d", "-s", sessionName]);
    if (result.exitCode !== 0) {
      this.logger.error({ sessionName, stderr: result.stderr }, "Failed to create tmux session");
      throw new Error(`Failed to create tmux session: ${result.stderr || "unknown error"}`);
    }

    this.logger.info({ sessionName }, "Created tmux session");
  }

  /**
   * List tmux sessions.
   */
  async listSessions(): Promise<TmuxSession[]> {
    const tmuxAvailable = await this.isTmuxAvailable();
    if (!tmuxAvailable) return [];

    const result = await this.runTmux(["list-sessions", "-F", SESSION_FORMAT]);
    if (result.exitCode !== 0) {
      this.logger.warn({ stderr: result.stderr }, "Failed to list tmux sessions");
      return [];
    }

    return result.stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => this.parseSessionLine(line))
      .filter((session): session is TmuxSession => session !== null);
  }

  /**
   * List panes for a session.
   */
  async listPanes(sessionName: string): Promise<TmuxPane[]> {
    return this.listPanesState(sessionName);
  }

  /**
   * Create a new pane in a session.
   */
  async createPane(sessionName: string, opts?: { cwd?: string; command?: string }): Promise<TmuxPane>;
  async createPane(options?: { cwd?: string; horizontal?: boolean }): Promise<TmuxPaneState>;
  async createPane(
    sessionNameOrOptions?: string | { cwd?: string; command?: string; horizontal?: boolean },
    opts?: { cwd?: string; command?: string }
  ): Promise<TmuxPaneState> {
    const resolved = this.resolveCreatePaneOptions(sessionNameOrOptions, opts);
    await this.ensureSession(resolved.sessionName);

    const tmuxSessionName = this.withSessionPrefix(resolved.sessionName);
    const args = ["split-window"];
    if (resolved.splitFlag) {
      args.push(resolved.splitFlag);
    }
    args.push("-t", tmuxSessionName, "-P", "-F", PANE_FORMAT);

    if (resolved.cwd) {
      args.push("-c", resolved.cwd);
    }
    if (resolved.command) {
      args.push(resolved.command);
    }

    const result = await this.runTmux(args);
    if (result.exitCode !== 0) {
      this.logger.error({ stderr: result.stderr }, "Failed to create tmux pane");
      throw new Error(`Failed to create tmux pane: ${result.stderr || "unknown error"}`);
    }

    const pane = this.parsePaneLine(result.stdout.trim());
    if (!pane) {
      throw new Error("Failed to parse tmux pane output");
    }

    if (resolved.sessionName === DEFAULT_SESSION_NAME) {
      await this.refreshSessionState();
      const refreshed = this.session?.panes.find((existing) => existing.id === pane.id);
      return refreshed || pane;
    }

    return pane;
  }

  /**
   * Kill a pane.
   */
  async killPane(paneId: string): Promise<void> {
    // Stop output polling
    this.stopOutputPolling(paneId);

    const result = await this.runTmux(["kill-pane", "-t", paneId]);
    if (result.exitCode !== 0) {
      this.logger.error({ paneId, stderr: result.stderr }, "Failed to kill pane");
      throw new Error(`Failed to kill pane: ${result.stderr || "unknown error"}`);
    }

    await this.refreshSessionState();
    this.logger.info({ paneId }, "Killed tmux pane");
  }

  /**
   * Kill a session.
   */
  async killSession(sessionName: string): Promise<void>;
  async killSession(): Promise<void>;
  async killSession(sessionName?: string): Promise<void> {
    const targetName = sessionName ?? DEFAULT_SESSION_NAME;
    const tmuxSessionName = this.withSessionPrefix(targetName);

    // Stop all output polling
    for (const paneId of this.outputPollers.keys()) {
      this.stopOutputPolling(paneId);
    }

    const result = await this.runTmux(["kill-session", "-t", tmuxSessionName]);
    if (result.exitCode !== 0) {
      this.logger.error({ sessionName: tmuxSessionName, stderr: result.stderr }, "Failed to kill session");
      throw new Error(`Failed to kill session: ${result.stderr || "unknown error"}`);
    }

    if (targetName === DEFAULT_SESSION_NAME) {
      this.session = null;
      this.paneOutputCache.clear();
    }

    this.logger.info({ sessionName: tmuxSessionName }, "Killed tmux session");
  }

  /**
   * Send keys to a specific pane.
   */
  async sendKeys(paneId: string, keys: string, opts: { enter?: boolean } = {}): Promise<void> {
    const args = ["send-keys", "-t", paneId, keys];
    if (opts.enter !== false) {
      args.push("Enter");
    }

    const result = await this.runTmux(args);
    if (result.exitCode !== 0) {
      this.logger.error({ paneId, stderr: result.stderr }, "Failed to send keys");
      throw new Error(`Failed to send keys: ${result.stderr || "unknown error"}`);
    }

    this.logger.info({ paneId, keysLength: keys.length }, "Sent keys to pane");
  }

  /**
   * Send a control key to a pane.
   */
  async sendControl(paneId: string, key: string): Promise<void> {
    const result = await this.runTmux(["send-keys", "-t", paneId, `C-${key}`]);
    if (result.exitCode !== 0) {
      this.logger.error({ paneId, stderr: result.stderr }, "Failed to send control key");
      throw new Error(`Failed to send control key: ${result.stderr || "unknown error"}`);
    }

    this.logger.info({ paneId, key }, "Sent control key to pane");
  }

  /**
   * Capture output from a pane.
   */
  async capturePane(paneId: string, opts: CaptureOpts = {}): Promise<string> {
    const args = ["capture-pane", "-t", paneId, "-p"];

    if (opts.join) args.push("-J");
    if (opts.escape) args.push("-e");

    if (opts.start !== undefined || opts.end !== undefined) {
      if (opts.start !== undefined) args.push("-S", opts.start);
      if (opts.end !== undefined) args.push("-E", opts.end);
    } else if (opts.lines !== undefined) {
      args.push("-S", `-${opts.lines}`);
    } else {
      args.push("-S", "-1000");
    }

    const result = await this.runTmux(args);
    if (result.exitCode !== 0) {
      this.logger.warn({ paneId, stderr: result.stderr }, "Failed to capture pane");
      return "";
    }

    return result.stdout;
  }

  /**
   * Start piping pane output to a log file.
   */
  async startPipePane(paneId: string, logPath: string): Promise<void> {
    const escapedPath = logPath.replace(/'/g, "'\\''");
    const command = `tee -a '${escapedPath}'`;

    const result = await this.runTmux(["pipe-pane", "-o", "-t", paneId, command]);
    if (result.exitCode !== 0) {
      this.logger.error({ paneId, stderr: result.stderr }, "Failed to start pipe-pane");
      throw new Error(`Failed to start pipe-pane: ${result.stderr || "unknown error"}`);
    }

    this.logger.info({ paneId, logPath }, "Started pipe-pane");
  }

  /**
   * Stop piping pane output.
   */
  async stopPipePane(paneId: string): Promise<void> {
    const result = await this.runTmux(["pipe-pane", "-t", paneId]);
    if (result.exitCode !== 0) {
      this.logger.error({ paneId, stderr: result.stderr }, "Failed to stop pipe-pane");
      throw new Error(`Failed to stop pipe-pane: ${result.stderr || "unknown error"}`);
    }

    this.logger.info({ paneId }, "Stopped pipe-pane");
  }

  /**
   * Refresh the session state from tmux.
   */
  async refreshSessionState(): Promise<void> {
    const tmuxAvailable = await this.isTmuxAvailable();
    if (!tmuxAvailable) {
      this.session = null;
      return;
    }

    const sessions = await this.listSessions();
    const sessionInfo = sessions.find((session) => session.name === DEFAULT_SESSION_NAME);
    if (!sessionInfo) {
      this.session = null;
      return;
    }

    const panes = await this.listPanesState(DEFAULT_SESSION_NAME);
    const existingPanes = this.session?.panes ?? [];

    const mergedPanes = panes.map((pane) => {
      const existing = existingPanes.find((candidate) => candidate.id === pane.id);
      return {
        ...pane,
        index: pane.paneIndex,
        agentType: existing?.agentType,
        agentId: existing?.agentId,
        projectId: existing?.projectId,
        status: existing?.status ?? "idle",
        lastOutput: existing?.lastOutput ?? "",
        title: existing?.title ?? pane.title,
      };
    });

    this.session = {
      ...sessionInfo,
      panes: mergedPanes,
      layout: this.session?.layout ?? "tiled",
      createdAt: this.session?.createdAt ?? sessionInfo.created,
    };
  }

  /**
   * Get the current session state.
   */
  getSession(): TmuxSessionState | null {
    return this.session;
  }

  /**
   * Start polling output from a pane.
   */
  startOutputPolling(paneId: string): void {
    if (this.outputPollers.has(paneId)) return;

    const poller = setInterval(async () => {
      const output = await this.capturePane(paneId, { lines: 100 });
      const cachedOutput = this.paneOutputCache.get(paneId) || "";

      if (output !== cachedOutput) {
        // Find the new content
        const newContent = output.slice(cachedOutput.length);
        this.paneOutputCache.set(paneId, output);

        // Update pane last output
        const pane = this.session?.panes.find((candidate) => candidate.id === paneId);
        if (pane) {
          pane.lastOutput = output;
        }

        // Emit output event
        this.emit("output", {
          paneId,
          output: newContent || output,
          timestamp: new Date().toISOString(),
        } as TmuxOutputEvent);
      }
    }, OUTPUT_POLL_INTERVAL);

    this.outputPollers.set(paneId, poller);
    this.logger.info({ paneId }, "Started output polling");
  }

  /**
   * Stop polling output from a pane.
   */
  stopOutputPolling(paneId: string): void {
    const poller = this.outputPollers.get(paneId);
    if (poller) {
      clearInterval(poller);
      this.outputPollers.delete(paneId);
      this.logger.info({ paneId }, "Stopped output polling");
    }
  }

  /**
   * Spawn a Claude Code agent in a pane.
   */
  async spawnClaudeCode(
    paneId: string,
    options: {
      cwd?: string;
      projectId?: string;
      resumeSessionId?: string;
    } = {}
  ): Promise<void> {
    const pane = this.session?.panes.find((candidate) => candidate.id === paneId);
    if (!pane) {
      throw new Error(`Pane not found: ${paneId}`);
    }

    // Build the claude command
    let cmd = "claude";
    if (options.resumeSessionId) {
      cmd += ` --resume ${options.resumeSessionId}`;
    }

    // Change directory if specified
    if (options.cwd) {
      await this.sendKeys(paneId, `cd \"${options.cwd}\"`, { enter: true });
      // Small delay for cd to complete
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Start Claude Code
    await this.sendKeys(paneId, cmd, { enter: true });

    // Update pane metadata
    pane.agentType = "claude-code";
    pane.agentId = crypto.randomUUID().slice(0, 8);
    pane.projectId = options.projectId;
    pane.status = "running";

    // Start output polling
    this.startOutputPolling(paneId);

    this.logger.info({ paneId, agentId: pane.agentId, projectId: options.projectId }, "Spawned Claude Code agent");
  }

  /**
   * Spawn a Codex agent in a pane.
   */
  async spawnCodex(
    paneId: string,
    options: {
      prompt: string;
      cwd?: string;
      projectId?: string;
      reasoning?: "low" | "medium" | "high" | "xhigh";
      sandbox?: "read-only" | "workspace-write";
    }
  ): Promise<void> {
    const pane = this.session?.panes.find((candidate) => candidate.id === paneId);
    if (!pane) {
      throw new Error(`Pane not found: ${paneId}`);
    }

    // Build the codex command
    let cmd = "codex";
    if (options.reasoning) {
      cmd += ` --reasoning ${options.reasoning}`;
    }
    if (options.sandbox) {
      cmd += ` --sandbox ${options.sandbox}`;
    }
    cmd += ` \"${options.prompt.replace(/\"/g, "\\\"")}\"`;

    // Change directory if specified
    if (options.cwd) {
      await this.sendKeys(paneId, `cd \"${options.cwd}\"`, { enter: true });
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Start Codex
    await this.sendKeys(paneId, cmd, { enter: true });

    // Update pane metadata
    pane.agentType = "codex";
    pane.agentId = crypto.randomUUID().slice(0, 8);
    pane.projectId = options.projectId;
    pane.status = "running";

    // Start output polling
    this.startOutputPolling(paneId);

    this.logger.info({ paneId, agentId: pane.agentId, prompt: options.prompt.slice(0, 50) }, "Spawned Codex agent");
  }

  /**
   * Spawn a shell in a pane.
   */
  async spawnShell(
    paneId: string,
    options: {
      cwd?: string;
      command?: string;
    } = {}
  ): Promise<void> {
    const pane = this.session?.panes.find((candidate) => candidate.id === paneId);
    if (!pane) {
      throw new Error(`Pane not found: ${paneId}`);
    }

    // Change directory if specified
    if (options.cwd) {
      await this.sendKeys(paneId, `cd \"${options.cwd}\"`, { enter: true });
    }

    // Run command if specified
    if (options.command) {
      await this.sendKeys(paneId, options.command, { enter: true });
    }

    // Update pane metadata
    pane.agentType = "shell";
    pane.agentId = crypto.randomUUID().slice(0, 8);
    pane.status = "idle";

    this.logger.info({ paneId, command: options.command }, "Spawned shell");
  }

  /**
   * Set the pane layout.
   */
  async setLayout(layout: TmuxSessionState["layout"]): Promise<void> {
    const tmuxSessionName = this.withSessionPrefix(DEFAULT_SESSION_NAME);
    const result = await this.runTmux(["select-layout", "-t", tmuxSessionName, layout]);
    if (result.exitCode !== 0) {
      this.logger.error({ layout, stderr: result.stderr }, "Failed to set layout");
      throw new Error(`Failed to set layout: ${result.stderr || "unknown error"}`);
    }

    if (this.session) {
      this.session.layout = layout;
    }

    this.logger.info({ layout }, "Set tmux layout");
  }

  /**
   * Focus a specific pane.
   */
  async focusPane(paneId: string): Promise<void> {
    const result = await this.runTmux(["select-pane", "-t", paneId]);
    if (result.exitCode !== 0) {
      this.logger.error({ paneId, stderr: result.stderr }, "Failed to focus pane");
      throw new Error(`Failed to focus pane: ${result.stderr || "unknown error"}`);
    }

    await this.refreshSessionState();
    this.logger.info({ paneId }, "Focused pane");
  }

  /**
   * Resize a pane.
   */
  async resizePane(
    paneId: string,
    direction: "up" | "down" | "left" | "right",
    amount: number = 5
  ): Promise<void> {
    const dirFlag = {
      up: "-U",
      down: "-D",
      left: "-L",
      right: "-R",
    }[direction];

    const result = await this.runTmux(["resize-pane", "-t", paneId, dirFlag, amount.toString()]);
    if (result.exitCode !== 0) {
      this.logger.error({ paneId, stderr: result.stderr }, "Failed to resize pane");
      throw new Error(`Failed to resize pane: ${result.stderr || "unknown error"}`);
    }

    this.logger.info({ paneId, direction, amount }, "Resized pane");
  }

  /**
   * Broadcast input to all panes.
   */
  async broadcast(keys: string, options: { enter?: boolean } = {}): Promise<void> {
    if (!this.session) return;

    for (const pane of this.session.panes) {
      await this.sendKeys(pane.id, keys, options);
    }

    this.logger.info({ panesCount: this.session.panes.length }, "Broadcast to all panes");
  }

  /**
   * Clean up resources.
   */
  async cleanup(): Promise<void> {
    for (const paneId of this.outputPollers.keys()) {
      this.stopOutputPolling(paneId);
    }
    this.paneOutputCache.clear();
  }

  private async listPanesState(sessionName: string): Promise<TmuxPaneState[]> {
    const tmuxAvailable = await this.isTmuxAvailable();
    if (!tmuxAvailable) return [];

    const tmuxSessionName = this.withSessionPrefix(sessionName);
    const result = await this.runTmux(["list-panes", "-t", tmuxSessionName, "-F", PANE_FORMAT]);
    if (result.exitCode !== 0) {
      this.logger.warn({ sessionName, stderr: result.stderr }, "Failed to list tmux panes");
      return [];
    }

    return result.stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => this.parsePaneLine(line))
      .filter((pane): pane is TmuxPaneState => pane !== null);
  }

  private parseSessionLine(line: string): TmuxSession | null {
    const [rawName, windowsRaw, createdRaw, attachedRaw] = line.split("\t");
    if (!rawName) return null;
    if (!rawName.startsWith(SESSION_PREFIX)) return null;

    const windows = Number.parseInt(windowsRaw, 10);
    if (!Number.isFinite(windows)) {
      this.logger.warn({ rawName, windowsRaw }, "Invalid tmux session window count");
      return null;
    }

    const createdUnix = Number(createdRaw);
    const created = Number.isFinite(createdUnix)
      ? new Date(createdUnix * 1000).toISOString()
      : createdRaw;

    return {
      name: this.stripSessionPrefix(rawName),
      windows,
      created,
      attached: attachedRaw === "1",
    };
  }

  private parsePaneLine(line: string): TmuxPaneState | null {
    const [
      id,
      sessionRaw,
      windowIndexRaw,
      paneIndexRaw,
      cwdRaw,
      commandRaw,
      activeRaw,
      titleRaw,
    ] = line.split("\t");

    if (!id) return null;

    const windowIndex = Number.parseInt(windowIndexRaw, 10);
    const paneIndex = Number.parseInt(paneIndexRaw, 10);
    if (!Number.isFinite(windowIndex) || !Number.isFinite(paneIndex)) {
      this.logger.warn({ id, windowIndexRaw, paneIndexRaw }, "Invalid tmux pane indexes");
      return null;
    }

    const sessionName = sessionRaw ? this.stripSessionPrefix(sessionRaw) : DEFAULT_SESSION_NAME;

    return {
      id,
      sessionName,
      windowIndex,
      paneIndex,
      cwd: cwdRaw || "",
      command: commandRaw || "",
      active: activeRaw === "1",
      index: paneIndex,
      status: "idle",
      lastOutput: "",
      title: titleRaw || undefined,
    };
  }

  private resolveCreatePaneOptions(
    sessionNameOrOptions?: string | { cwd?: string; command?: string; horizontal?: boolean },
    opts?: { cwd?: string; command?: string }
  ): { sessionName: string; cwd?: string; command?: string; splitFlag?: "-h" | "-v" } {
    if (typeof sessionNameOrOptions === "string") {
      return {
        sessionName: sessionNameOrOptions,
        cwd: opts?.cwd,
        command: opts?.command,
      };
    }

    if (sessionNameOrOptions) {
      return {
        sessionName: DEFAULT_SESSION_NAME,
        cwd: sessionNameOrOptions.cwd,
        command: sessionNameOrOptions.command,
        splitFlag: sessionNameOrOptions.horizontal ? "-h" : "-v",
      };
    }

    return { sessionName: DEFAULT_SESSION_NAME };
  }

  private async sessionExists(sessionName: string): Promise<boolean> {
    const result = await this.runTmux(["has-session", "-t", sessionName]);
    return result.exitCode === 0;
  }

  private async runTmux(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    try {
      const proc = Bun.spawn({
        cmd: ["tmux", ...args],
        stdout: "pipe",
        stderr: "pipe",
      });

      const stdoutPromise = proc.stdout ? new Response(proc.stdout).text() : Promise.resolve("");
      const stderrPromise = proc.stderr ? new Response(proc.stderr).text() : Promise.resolve("");
      const [stdout, stderr, exitCode] = await Promise.all([
        stdoutPromise,
        stderrPromise,
        proc.exited,
      ]);

      return {
        stdout,
        stderr,
        exitCode: exitCode ?? 1,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { stdout: "", stderr: message, exitCode: 127 };
    }
  }
}
