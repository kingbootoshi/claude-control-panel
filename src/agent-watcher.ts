import { EventEmitter } from "events";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { createLogger } from "./utils/logger";
import type { ChildAgent, ChildAgentEvent, ChildAgentEventType, ChildAgentStatus } from "./types";
import type { TerminalManager } from "./terminal-manager";

const log = createLogger("agent-watcher");
const POLL_INTERVAL_MS = 2000;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getStringFromRecord(record: UnknownRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    const str = getString(value);
    if (str) return str;
  }
  return null;
}

function getNestedString(record: UnknownRecord, key: string, keys: string[]): string | null {
  const nested = record[key];
  if (!isRecord(nested)) return null;
  return getStringFromRecord(nested, keys);
}

function mapStatus(status: string | null): ChildAgentStatus {
  const normalized = status?.toLowerCase() ?? "running";
  if (["completed", "complete", "success", "succeeded"].includes(normalized)) {
    return "complete";
  }
  if (["failed", "error", "killed"].includes(normalized)) {
    return "failed";
  }
  return "running";
}

function getEventType(previous: ChildAgentStatus | undefined, next: ChildAgentStatus): ChildAgentEventType | null {
  if (next === "running" && previous !== "running") return "started";
  if (next === "complete" && previous !== "complete") return "completed";
  if (next === "failed" && previous !== "failed") return "failed";
  return null;
}

function getErrorCode(error: unknown): string | null {
  if (isRecord(error) && typeof error.code === "string") {
    return error.code;
  }
  return null;
}

export class AgentWatcher extends EventEmitter {
  private readonly jobsDir: string;
  private readonly terminalManager: TerminalManager;
  private poller: NodeJS.Timeout | null = null;
  private polling = false;
  private fileMtimes: Map<string, number> = new Map();
  private jobStatuses: Map<string, ChildAgentStatus> = new Map();

  constructor(terminalManager: TerminalManager, jobsDir?: string) {
    super();
    this.terminalManager = terminalManager;
    this.jobsDir = jobsDir ?? path.join(os.homedir(), ".codex-agent", "jobs");
  }

  start(): void {
    if (this.poller) return;
    void this.poll();
    this.poller = setInterval(() => {
      void this.poll();
    }, POLL_INTERVAL_MS);
    log.info({ jobsDir: this.jobsDir, intervalMs: POLL_INTERVAL_MS }, "Agent watcher started");
  }

  stop(): void {
    if (!this.poller) return;
    clearInterval(this.poller);
    this.poller = null;
    log.info("Agent watcher stopped");
  }

  private async poll(): Promise<void> {
    if (this.polling) return;
    this.polling = true;

    try {
      const entries = await fs.readdir(this.jobsDir);
      for (const entry of entries) {
        if (!entry.endsWith(".json")) continue;
        const filePath = path.join(this.jobsDir, entry);
        let stats;
        try {
          stats = await fs.stat(filePath);
        } catch (error) {
          log.debug({ filePath, error }, "Failed to stat job file");
          continue;
        }

        const lastSeen = this.fileMtimes.get(filePath);
        if (lastSeen && lastSeen >= stats.mtimeMs) continue;

        this.fileMtimes.set(filePath, stats.mtimeMs);
        await this.processFile(filePath, entry);
      }
    } catch (error) {
      const code = getErrorCode(error);
      if (code !== "ENOENT") {
        log.warn({ error, jobsDir: this.jobsDir }, "Failed to read codex-agent jobs directory");
      }
    } finally {
      this.polling = false;
    }
  }

  private async processFile(filePath: string, fileName: string): Promise<void> {
    let content: string;
    try {
      content = await fs.readFile(filePath, "utf-8");
    } catch (error) {
      log.debug({ filePath, error }, "Failed to read job file");
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content) as unknown;
    } catch (error) {
      log.warn({ filePath, error }, "Failed to parse job file JSON");
      return;
    }

    const childAgent = this.parseJob(parsed, fileName);
    if (!childAgent) return;

    const previousStatus = this.jobStatuses.get(childAgent.id);
    this.jobStatuses.set(childAgent.id, childAgent.status);

    const eventType = getEventType(previousStatus, childAgent.status);
    const linked = await this.terminalManager.upsertChildAgent(childAgent);
    if (!linked) {
      log.debug({ childAgentId: childAgent.id, parentSessionId: childAgent.parentSessionId }, "Child agent not linked to terminal");
    }

    if (eventType) {
      const event: ChildAgentEvent = {
        sessionId: childAgent.parentSessionId,
        childAgent,
        event: eventType,
      };
      this.emit("child_agent", event);
    }
  }

  private parseJob(data: unknown, fileName: string): ChildAgent | null {
    if (!isRecord(data)) {
      log.debug({ fileName }, "Job file is not a JSON object");
      return null;
    }

    const fallbackId = fileName.endsWith(".json") ? fileName.slice(0, -5) : fileName;
    const id = getStringFromRecord(data, ["id"]) ?? getString(fallbackId);
    if (!id) {
      log.debug({ fileName }, "Job file missing id");
      return null;
    }

    const parentSessionKeys = ["parentSessionId", "parent_session_id", "parentSession", "parent_session", "claudeSessionId", "claude_session_id"];
    const parentSessionId =
      getStringFromRecord(data, parentSessionKeys) ??
      getNestedString(data, "metadata", parentSessionKeys) ??
      getNestedString(data, "meta", parentSessionKeys);
    if (!parentSessionId) {
      log.debug({ fileName, jobId: id }, "Job file missing parent session id");
      return null;
    }

    const tmuxKeys = ["tmuxSession", "tmux_session", "tmux", "tmuxName", "tmux_name"];
    const tmuxSession =
      getStringFromRecord(data, tmuxKeys) ??
      getNestedString(data, "metadata", tmuxKeys) ??
      getNestedString(data, "meta", tmuxKeys);
    if (!tmuxSession) {
      log.debug({ fileName, jobId: id }, "Job file missing tmux session name");
      return null;
    }

    const startedAt =
      getStringFromRecord(data, ["startedAt", "started_at"]) ??
      getStringFromRecord(data, ["createdAt", "created_at"]);
    if (!startedAt) {
      log.debug({ fileName, jobId: id }, "Job file missing startedAt timestamp");
      return null;
    }

    const completedAt = getStringFromRecord(data, ["completedAt", "completed_at"]) ?? undefined;
    const status = mapStatus(getStringFromRecord(data, ["status"]));

    return {
      id,
      parentSessionId,
      tmuxSession,
      status,
      startedAt,
      completedAt,
    };
  }
}
