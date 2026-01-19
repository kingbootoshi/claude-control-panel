import fs from "fs/promises";
import path from "path";
import os from "os";

const CONFIG_PATH = path.join(os.homedir(), ".claude-workspace", ".ccp-config.json");

// V1 config - legacy format with agentId
interface CCPConfigV1 {
  version: 1;
  primaryAgent: {
    id: string;
    name: string;
  };
}

// V2 config - simplified, no agentId
export interface CCPConfig {
  version: 2;
  assistantName: string;
  // CLAUDE.md is stored in ~/.claude-workspace/CLAUDE.md directly
}

// Union type for loading
type CCPConfigAny = CCPConfigV1 | CCPConfig;

export async function loadConfig(): Promise<CCPConfig | null> {
  try {
    const data = await fs.readFile(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(data) as CCPConfigAny;

    // Migrate v1 to v2
    if (parsed.version === 1) {
      const v1 = parsed as CCPConfigV1;
      const v2: CCPConfig = {
        version: 2,
        assistantName: v1.primaryAgent.name,
      };
      await saveConfig(v2);
      return v2;
    }

    return parsed as CCPConfig;
  } catch {
    return null;
  }
}

export async function saveConfig(config: CCPConfig): Promise<void> {
  const dir = path.dirname(CONFIG_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export async function setupAssistant(name: string, claudeMd: string): Promise<void> {
  const workspaceRoot = path.join(os.homedir(), ".claude-workspace");

  // Save config
  const newConfig: CCPConfig = {
    version: 2,
    assistantName: name,
  };
  await saveConfig(newConfig);

  // Write CLAUDE.md to workspace root
  await fs.mkdir(workspaceRoot, { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, "CLAUDE.md"), claudeMd);

  // Create workspace directories
  await fs.mkdir(path.join(workspaceRoot, "knowledge"), { recursive: true });
  await fs.mkdir(path.join(workspaceRoot, "tools"), { recursive: true });
  await fs.mkdir(path.join(workspaceRoot, "state"), { recursive: true });
  await fs.mkdir(path.join(workspaceRoot, "projects"), { recursive: true });
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "assistant";
}
