import { createLogger } from "./utils/logger";
import type { GitBranch, GitCommit, GitDiff, GitStatus } from "./types";

interface GitCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class GitManager {
  private logger = createLogger("git");

  async status(cwd: string): Promise<GitStatus> {
    const args = ["status", "--porcelain=v1", "-z"];
    const result = await this.runGit(args, cwd);
    this.assertSuccess(result, args, cwd);
    return this.parseStatus(result.stdout);
  }

  async diff(cwd: string, opts?: { filePath?: string; staged?: boolean }): Promise<GitDiff[]> {
    const args = ["diff", "--no-color"];
    if (opts?.staged) {
      args.push("--cached");
    }
    if (opts?.filePath) {
      args.push("--", opts.filePath);
    }
    const result = await this.runGit(args, cwd);
    this.assertSuccess(result, args, cwd);
    return this.parseDiff(result.stdout);
  }

  async log(cwd: string, limit = 50): Promise<GitCommit[]> {
    const format = "%H%x1f%an%x1f%ad%x1f%s";
    const args = ["log", "-n", String(limit), "--date=iso-strict", `--pretty=format:${format}`];
    const result = await this.runGit(args, cwd);
    this.assertSuccess(result, args, cwd);
    return this.parseLog(result.stdout);
  }

  async stage(cwd: string, filePath: string): Promise<void> {
    const args = ["add", "--", filePath];
    const result = await this.runGit(args, cwd);
    this.assertSuccess(result, args, cwd);
  }

  async unstage(cwd: string, filePath: string): Promise<void> {
    const args = ["reset", "--", filePath];
    const result = await this.runGit(args, cwd);
    this.assertSuccess(result, args, cwd);
  }

  async branches(cwd: string): Promise<GitBranch[]> {
    const args = ["branch", "--list", "--format=%(refname:short)\t%(HEAD)"];
    const result = await this.runGit(args, cwd);
    this.assertSuccess(result, args, cwd);
    return this.parseBranches(result.stdout);
  }

  private parseStatus(output: string): GitStatus {
    const staged = new Set<string>();
    const unstaged = new Set<string>();
    const untracked = new Set<string>();

    const entries = output.split("\0");
    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i];
      if (!entry || entry.length < 3) continue;

      const status = entry.slice(0, 2);
      if (status === "??") {
        const filePath = entry.slice(3).trim();
        if (filePath) {
          untracked.add(filePath);
        }
        continue;
      }

      let filePath = entry.slice(3);
      if ((status[0] === "R" || status[0] === "C") && entries[i + 1]) {
        filePath = entries[i + 1];
        i += 1;
      }

      const normalized = filePath.trim();
      if (!normalized) continue;

      if (status[0] !== " " && status[0] !== "?") {
        staged.add(normalized);
      }
      if (status[1] !== " " && status[1] !== "?") {
        unstaged.add(normalized);
      }
    }

    return {
      staged: Array.from(staged).sort(),
      unstaged: Array.from(unstaged).sort(),
      untracked: Array.from(untracked).sort(),
    };
  }

  private parseDiff(output: string): GitDiff[] {
    if (!output.trim()) return [];

    const diffs: GitDiff[] = [];
    const lines = output.split("\n");
    let current: GitDiff | null = null;
    let currentHunk: { header: string; lines: string[] } | null = null;

    const finalizeHunk = () => {
      if (current && currentHunk) {
        current.hunks.push(currentHunk);
        currentHunk = null;
      }
    };

    const finalizeFile = () => {
      if (current) {
        finalizeHunk();
        diffs.push(current);
        current = null;
      }
    };

    for (const line of lines) {
      if (line.startsWith("diff --git ")) {
        finalizeFile();
        const match = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
        const filePath = match ? match[2] : line.replace(/^diff --git /, "").trim();
        current = { file: filePath, hunks: [] };
        continue;
      }

      if (!current) continue;

      if (line.startsWith("@@")) {
        finalizeHunk();
        currentHunk = { header: line, lines: [] };
        continue;
      }

      if (line.startsWith("Binary files ") || line.startsWith("GIT binary patch")) {
        if (!currentHunk) {
          currentHunk = { header: "binary", lines: [] };
        }
        currentHunk.lines.push(line);
        continue;
      }

      if (currentHunk) {
        currentHunk.lines.push(line);
      }
    }

    finalizeFile();
    return diffs;
  }

  private parseLog(output: string): GitCommit[] {
    const trimmed = output.trim();
    if (!trimmed) return [];

    return trimmed.split("\n").map((line) => {
      const [hash, author, date, message] = line.split("\x1f");
      return {
        hash: hash ?? "",
        author: author ?? "",
        date: date ?? "",
        message: message ?? "",
      };
    });
  }

  private parseBranches(output: string): GitBranch[] {
    const lines = output.split("\n").filter(Boolean);
    return lines.map((line) => {
      const [name, head] = line.split("\t");
      return {
        name: name?.trim() ?? "",
        current: (head ?? "").trim() === "*",
      };
    }).filter((branch) => branch.name);
  }

  private assertSuccess(result: GitCommandResult, args: string[], cwd: string): void {
    if (result.exitCode === 0) return;

    this.logger.error({ args, cwd, stderr: result.stderr }, "Git command failed");
    const details = result.stderr ? result.stderr.trim() : "unknown error";
    throw new Error(`Git command failed: ${details}`);
  }

  private async runGit(args: string[], cwd: string): Promise<GitCommandResult> {
    try {
      const proc = Bun.spawn({
        cmd: ["git", ...args],
        cwd,
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
