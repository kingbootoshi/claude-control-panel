import fs from "fs/promises";
import path from "path";

export interface FileEntry {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileEntry[];
}

/**
 * List all files and directories in a workspace directory recursively
 */
export async function listWorkspaceFiles(dir: string): Promise<FileEntry[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files: FileEntry[] = [];

    for (const entry of entries) {
      // Skip hidden files and node_modules
      if (entry.name.startsWith(".") || entry.name === "node_modules") {
        continue;
      }

      const fullPath = path.join(dir, entry.name);
      const relativePath = entry.name;

      if (entry.isDirectory()) {
        const children = await listWorkspaceFiles(fullPath);
        files.push({
          name: entry.name,
          path: relativePath,
          type: "directory",
          children,
        });
      } else {
        files.push({
          name: entry.name,
          path: relativePath,
          type: "file",
        });
      }
    }

    return files;
  } catch (error) {
    // Directory doesn't exist or can't be read
    return [];
  }
}

/**
 * Read the content of a file in the workspace
 */
export async function readWorkspaceFile(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return content;
  } catch (error) {
    throw new Error(`Failed to read file: ${filePath}`);
  }
}

/**
 * Check if a path is safe (doesn't escape the workspace)
 */
export function isPathSafe(basePath: string, requestedPath: string): boolean {
  const resolvedPath = path.resolve(basePath, requestedPath);
  return resolvedPath.startsWith(path.resolve(basePath));
}
