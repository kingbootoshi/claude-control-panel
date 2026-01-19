import { EventEmitter } from "events";
import { spawn, ChildProcess, exec } from "child_process";
import { promisify } from "util";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { config } from "./config";
import { logger } from "./utils/logger";

const execAsync = promisify(exec);
const log = logger.daemon;

export type CodexModel = "gpt-5.2-codex" | "gpt-5.1-codex-mini" | "gpt-5.1-codex-max" | "gpt-5.2" | "gpt-5.1-codex" | "gpt-5-codex";
export type CodexReasoningEffort = "minimal" | "low" | "medium" | "high" | "xhigh";
export type CodexSandbox = "read-only" | "workspace-write" | "danger-full-access";
export type CodexJobStatus = "queued" | "running" | "completed" | "failed" | "killed";

export interface FileChange {
  path: string;
  type: "added" | "modified" | "deleted";
  diff?: string;
}

export interface CodexJob {
  id: string;
  prompt: string;
  status: CodexJobStatus;
  model: CodexModel;
  reasoningEffort: CodexReasoningEffort;
  projectId?: string;
  parentSessionId?: string;
  workingDir: string;
  fullAuto: boolean;
  sandbox: CodexSandbox;
  startedAt: Date;
  completedAt?: Date;
  result?: string;
  filesChanged?: FileChange[];
  error?: string;
  output: string;
}

export interface CodexJobInput {
  prompt: string;
  model?: CodexModel;
  reasoningEffort?: CodexReasoningEffort;
  projectId?: string;
  parentSessionId?: string;
  workingDir?: string;
  fullAuto?: boolean;
  sandbox?: CodexSandbox;
}

export interface CodexOutputEvent {
  jobId: string;
  output: string;
  timestamp: string;
}

export interface CodexStatusEvent {
  jobId: string;
  status: CodexJobStatus;
  timestamp: string;
}

/**
 * Manages Codex CLI agent jobs.
 * Spawns codex processes, tracks their status, and captures output.
 */
export class CodexManager extends EventEmitter {
  private jobs: Map<string, CodexJob> = new Map();
  private processes: Map<string, ChildProcess> = new Map();
  private jobsDir: string;
  private initialized = false;

  constructor() {
    super();
    this.jobsDir = path.join(config.workspaceRoot, "state", "codex-jobs");
  }

  /**
   * Check if codex CLI is available.
   */
  async checkCodexAvailable(): Promise<boolean> {
    try {
      await execAsync("which codex");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Initialize the codex manager.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Ensure jobs directory exists
    await fs.mkdir(this.jobsDir, { recursive: true });

    // Load persisted jobs
    await this.loadPersistedJobs();

    this.initialized = true;
    log.info({ jobsDir: this.jobsDir }, "CodexManager initialized");
  }

  /**
   * Load persisted jobs from disk.
   */
  private async loadPersistedJobs(): Promise<void> {
    try {
      const files = await fs.readdir(this.jobsDir);
      for (const file of files) {
        if (!file.endsWith(".json")) continue;

        try {
          const content = await fs.readFile(path.join(this.jobsDir, file), "utf-8");
          const job = JSON.parse(content) as CodexJob;

          // Mark any running jobs as failed (server restarted)
          if (job.status === "running" || job.status === "queued") {
            job.status = "failed";
            job.error = "Server restarted while job was running";
            await this.persistJob(job);
          }

          this.jobs.set(job.id, job);
        } catch (e) {
          log.warn({ file, error: e }, "Failed to load job file");
        }
      }

      log.info({ loadedJobs: this.jobs.size }, "Loaded persisted codex jobs");
    } catch (error) {
      log.warn({ error }, "Failed to load persisted jobs");
    }
  }

  /**
   * Persist a job to disk.
   */
  private async persistJob(job: CodexJob): Promise<void> {
    const jobFile = path.join(this.jobsDir, `${job.id}.json`);
    await fs.writeFile(jobFile, JSON.stringify(job, null, 2));
  }

  /**
   * Create and start a new Codex job.
   */
  async createJob(input: CodexJobInput): Promise<CodexJob> {
    const codexAvailable = await this.checkCodexAvailable();
    if (!codexAvailable) {
      throw new Error("Codex CLI not found. Install with: npm i -g @openai/codex");
    }

    const id = crypto.randomUUID().slice(0, 8);
    const workingDir = input.workingDir || config.workspaceRoot;

    const job: CodexJob = {
      id,
      prompt: input.prompt,
      status: "queued",
      model: input.model || "gpt-5.2-codex",
      reasoningEffort: input.reasoningEffort || "xhigh",
      projectId: input.projectId,
      parentSessionId: input.parentSessionId,
      workingDir,
      fullAuto: input.fullAuto ?? true,
      sandbox: input.sandbox || "workspace-write",
      startedAt: new Date(),
      output: "",
    };

    this.jobs.set(id, job);
    await this.persistJob(job);

    // Start the job
    this.startJob(job);

    log.info({ jobId: id, prompt: input.prompt.slice(0, 50) }, "Created codex job");
    return job;
  }

  /**
   * Start a codex job.
   */
  private startJob(job: CodexJob): void {
    // Build command arguments for `codex exec`
    const args: string[] = ["exec"];

    // Model selection
    args.push("--model", job.model);

    // Reasoning effort via config override
    args.push("-c", `model_reasoning_effort=${job.reasoningEffort}`);

    // Sandbox mode
    args.push("--sandbox", job.sandbox);

    // Full auto mode (no confirmation prompts)
    if (job.fullAuto) {
      args.push("--full-auto");
    }

    // Working directory
    args.push("--cd", job.workingDir);

    // The prompt
    args.push(job.prompt);

    log.info({ jobId: job.id, args }, "Starting codex process");

    // Spawn the process
    const proc = spawn("codex", args, {
      cwd: job.workingDir,
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.processes.set(job.id, proc);

    // Update status
    job.status = "running";
    this.persistJob(job);
    this.emit("status", { jobId: job.id, status: "running", timestamp: new Date().toISOString() } as CodexStatusEvent);

    // Capture stdout
    proc.stdout?.on("data", (data: Buffer) => {
      const output = data.toString();
      job.output += output;
      this.emit("output", { jobId: job.id, output, timestamp: new Date().toISOString() } as CodexOutputEvent);
    });

    // Capture stderr
    proc.stderr?.on("data", (data: Buffer) => {
      const output = data.toString();
      job.output += output;
      this.emit("output", { jobId: job.id, output, timestamp: new Date().toISOString() } as CodexOutputEvent);
    });

    // Handle completion
    proc.on("close", async (code) => {
      job.completedAt = new Date();

      if (code === 0) {
        job.status = "completed";
        job.result = job.output;

        // Parse file changes from output
        job.filesChanged = this.parseFileChanges(job.output);
      } else {
        job.status = "failed";
        job.error = `Process exited with code ${code}`;
      }

      await this.persistJob(job);
      this.processes.delete(job.id);

      this.emit("status", {
        jobId: job.id,
        status: job.status,
        timestamp: new Date().toISOString(),
      } as CodexStatusEvent);

      log.info({ jobId: job.id, status: job.status, code }, "Codex job completed");
    });

    proc.on("error", async (error) => {
      job.status = "failed";
      job.error = error.message;
      job.completedAt = new Date();

      await this.persistJob(job);
      this.processes.delete(job.id);

      this.emit("status", {
        jobId: job.id,
        status: "failed",
        timestamp: new Date().toISOString(),
      } as CodexStatusEvent);

      log.error({ jobId: job.id, error }, "Codex job error");
    });
  }

  /**
   * Parse file changes from codex output.
   * This is a basic implementation - codex output format may vary.
   */
  private parseFileChanges(output: string): FileChange[] {
    const changes: FileChange[] = [];

    // Look for common patterns in codex output
    // This is heuristic and may need adjustment based on actual codex output format
    const lines = output.split("\n");

    for (const line of lines) {
      // Match patterns like "Created: path/to/file.ts"
      const createdMatch = line.match(/Created:\s+(.+)/);
      if (createdMatch) {
        changes.push({ path: createdMatch[1].trim(), type: "added" });
        continue;
      }

      // Match patterns like "Modified: path/to/file.ts"
      const modifiedMatch = line.match(/Modified:\s+(.+)/);
      if (modifiedMatch) {
        changes.push({ path: modifiedMatch[1].trim(), type: "modified" });
        continue;
      }

      // Match patterns like "Deleted: path/to/file.ts"
      const deletedMatch = line.match(/Deleted:\s+(.+)/);
      if (deletedMatch) {
        changes.push({ path: deletedMatch[1].trim(), type: "deleted" });
        continue;
      }
    }

    return changes;
  }

  /**
   * Get a job by ID.
   */
  getJob(jobId: string): CodexJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * List all jobs.
   */
  listJobs(): CodexJob[] {
    return Array.from(this.jobs.values()).sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  }

  /**
   * List jobs for a specific project.
   */
  listJobsByProject(projectId: string): CodexJob[] {
    return this.listJobs().filter((j) => j.projectId === projectId);
  }

  /**
   * Kill a running job.
   */
  async killJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    const proc = this.processes.get(jobId);
    if (proc) {
      proc.kill("SIGTERM");
      this.processes.delete(jobId);
    }

    job.status = "killed";
    job.completedAt = new Date();
    await this.persistJob(job);

    this.emit("status", {
      jobId,
      status: "killed",
      timestamp: new Date().toISOString(),
    } as CodexStatusEvent);

    log.info({ jobId }, "Killed codex job");
  }

  /**
   * Delete a job (must be completed/failed/killed).
   */
  async deleteJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (job.status === "running" || job.status === "queued") {
      throw new Error("Cannot delete running job - kill it first");
    }

    // Delete persisted file
    const jobFile = path.join(this.jobsDir, `${jobId}.json`);
    try {
      await fs.unlink(jobFile);
    } catch {
      // File may not exist
    }

    this.jobs.delete(jobId);
    log.info({ jobId }, "Deleted codex job");
  }

  /**
   * Send input to a running job.
   */
  async sendInput(jobId: string, input: string): Promise<void> {
    const proc = this.processes.get(jobId);
    if (!proc) {
      throw new Error(`No running process for job: ${jobId}`);
    }

    proc.stdin?.write(input + "\n");
    log.info({ jobId, inputLength: input.length }, "Sent input to codex job");
  }

  /**
   * Get job output.
   */
  getOutput(jobId: string): string {
    const job = this.jobs.get(jobId);
    return job?.output || "";
  }

  /**
   * Wait for a job to complete.
   */
  async waitForJob(jobId: string, timeout?: number): Promise<CodexJob> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (job.status !== "running" && job.status !== "queued") {
      return job;
    }

    return new Promise((resolve, reject) => {
      const timeoutId = timeout
        ? setTimeout(() => {
            reject(new Error(`Timeout waiting for job ${jobId}`));
          }, timeout)
        : null;

      const handler = (event: CodexStatusEvent) => {
        if (event.jobId !== jobId) return;
        if (event.status === "running" || event.status === "queued") return;

        if (timeoutId) clearTimeout(timeoutId);
        this.off("status", handler);

        const updatedJob = this.jobs.get(jobId);
        if (updatedJob) {
          resolve(updatedJob);
        } else {
          reject(new Error(`Job disappeared: ${jobId}`));
        }
      };

      this.on("status", handler);
    });
  }

  /**
   * Clean up resources.
   */
  async cleanup(): Promise<void> {
    // Kill all running processes
    for (const [jobId, proc] of this.processes.entries()) {
      proc.kill("SIGTERM");
      const job = this.jobs.get(jobId);
      if (job) {
        job.status = "killed";
        job.completedAt = new Date();
        await this.persistJob(job);
      }
    }
    this.processes.clear();
  }
}
