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

function parseIntEnv(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function parseListEnv(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

const port = parseIntEnv(process.env.PORT, 3847);
const host = process.env.HOST || "127.0.0.1";
const workspaceRoot = expandPath(process.env.CLAUDE_WORKSPACE || "~/claude-workspace");
const primaryAgentId = (process.env.PRIMARY_AGENT_ID || "overseer").trim();
const assistantName = process.env.ASSISTANT_NAME || "Overseer";
const model = process.env.MODEL || "claude-opus-4-5-20251101";
const authToken = process.env.CCP_AUTH_TOKEN || "";
const maxWsPayloadMb = parseIntEnv(process.env.MAX_WS_PAYLOAD_MB, 10);
const uploadMaxMb = parseIntEnv(process.env.UPLOAD_MAX_MB, 10);
const historyBlockLimit = parseIntEnv(process.env.HISTORY_BLOCK_LIMIT, 300);
const webToolsEnabled = (process.env.WEB_TOOLS_ENABLED || "false").toLowerCase() === "true";

const defaultOrigins = [
  `http://localhost:${port}`,
  `http://127.0.0.1:${port}`,
  `http://[::1]:${port}`,
  // Vite dev server
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];
const allowedOrigins = parseListEnv(process.env.ALLOWED_ORIGINS);

const baseTools = [
  "Bash",
  "Read",
  "Write",
  "Edit",
  "Grep",
  "Glob",
  "Skill",
  "Task",
];
const webTools = webToolsEnabled ? ["WebFetch", "WebSearch"] : [];

export const config = {
  // Server
  port,
  host,
  allowedOrigins: allowedOrigins.length > 0 ? allowedOrigins : defaultOrigins,
  maxWsPayloadBytes: maxWsPayloadMb * 1024 * 1024,
  uploadMaxBytes: uploadMaxMb * 1024 * 1024,
  historyBlockLimit,

  // Agent identity
  primaryAgentId,
  assistantName,

  // Claude workspace path (base path for all agent workspaces)
  workspaceRoot,

  // Model (Opus 4.5 - most intelligent model)
  model,

  // Session state file (relative to agent workspace)
  sessionFile: "state/session.json",

  // Security token for all requests
  authToken,

  // Allowed tools for Claude
  allowedTools: [...baseTools, ...webTools],
} as const;

export function getAgentWorkspace(agentId: string): string {
  return path.join(config.workspaceRoot, agentId);
}

export type Config = typeof config;
