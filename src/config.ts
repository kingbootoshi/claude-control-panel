import { config as loadEnv } from "dotenv";
import path from "path";
import os from "os";

loadEnv();

function expandPath(p: string): string {
  if (p.startsWith("~")) {
    return path.join(os.homedir(), p.slice(1));
  }
  return p;
}

export const config = {
  // Server (default 3847 to avoid conflicts)
  port: parseInt(process.env.PORT || "3847", 10),

  // Claude workspace path (base path for all agent workspaces)
  workspace: expandPath(process.env.CLAUDE_WORKSPACE || "~/.claude-workspace"),

  // Assistant name (configurable)
  assistantName: process.env.ASSISTANT_NAME || "Claude",

  // Model (Opus 4.5 - most intelligent model)
  model: process.env.MODEL || "claude-opus-4-5-20251101",

  // Session state file (relative to workspace)
  sessionFile: "state/session.json",

  // Allowed tools for Claude
  allowedTools: [
    "Bash",
    "Read",
    "Write",
    "Edit",
    "Grep",
    "Glob",
    "WebFetch",
    "WebSearch",
    "Skill",
    "Task",
  ] as const,
} as const;

export type Config = typeof config;
