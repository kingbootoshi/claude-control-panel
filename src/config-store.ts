import fs from "fs/promises";
import path from "path";
import os from "os";

const CONFIG_PATH = path.join(os.homedir(), ".claude-workspace", ".ccp-config.json");

export interface CCPConfig {
  version: 1;
  primaryAgent: {
    id: string;
    name: string;
  };
}

export async function loadConfig(): Promise<CCPConfig | null> {
  try {
    const data = await fs.readFile(CONFIG_PATH, "utf-8");
    return JSON.parse(data) as CCPConfig;
  } catch {
    return null;
  }
}

export async function saveConfig(config: CCPConfig): Promise<void> {
  const dir = path.dirname(CONFIG_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export async function renameAgentWorkspace(
  workspaceRoot: string,
  oldId: string,
  newId: string
): Promise<void> {
  if (oldId === newId) return;
  const oldPath = path.join(workspaceRoot, oldId);
  const newPath = path.join(workspaceRoot, newId);

  // Check if old workspace exists
  try {
    await fs.access(oldPath);
    await fs.rename(oldPath, newPath);
  } catch {
    // Old workspace doesn't exist, nothing to rename
  }
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "agent";
}
