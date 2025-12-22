import fs from "fs/promises";
import path from "path";
import os from "os";
import { createLogger } from "./utils/logger";

const log = createLogger("history");

interface HistoryBlock {
  id: string;
  type: "user_command" | "text" | "tool_use" | "system";
  agentId: string;
  timestamp: number;
  content?: string;
  toolName?: string;
  toolInput?: unknown;
  toolResult?: string;
  toolUseId?: string;
  toolError?: boolean;
  attachments?: Array<{
    type: "image" | "file";
    name: string;
    data?: string;
    mimeType: string;
  }>;
}

interface SDKContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: string | Array<{ type: string; text?: string }>;
  is_error?: boolean;
  source?: {
    type: string;
    media_type?: string;
    data?: string;
  };
}

interface SDKMessage {
  type: string;
  subtype?: string;
  message?: {
    role: string;
    content: string | SDKContentBlock[];
  };
  timestamp?: number;
  session_id?: string;
}

async function findSessionFile(sessionId: string): Promise<string | null> {
  const claudeDir = path.join(os.homedir(), ".claude", "projects");

  try {
    const searchDir = async (dir: string): Promise<string | null> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          const found = await searchDir(fullPath);
          if (found) return found;
        } else if (entry.name === `${sessionId}.jsonl`) {
          return fullPath;
        }
      }

      return null;
    };

    return await searchDir(claudeDir);
  } catch (error) {
    log.warn({ error, claudeDir }, "Failed to search for session file");
    return null;
  }
}

// Filter out image metadata strings that Claude adds
function cleanImageMetadata(text: string): string {
  // Remove patterns like "[Image: original 1072x2008, displayed at 1068x2000. Multiply coordinates by 1.00 to map to original image.]"
  return text.replace(/\[Image: original \d+x\d+, displayed at \d+x\d+\. Multiply coordinates by [\d.]+ to map to original image\.\]\s*/g, "").trim();
}

function parseToolResultContent(content: SDKContentBlock["content"]): string {
  if (typeof content === "string") {
    return cleanImageMetadata(content);
  }
  if (Array.isArray(content)) {
    return cleanImageMetadata(
      content
        .filter(c => c.type === "text" && c.text)
        .map(c => c.text)
        .join("\n")
    );
  }
  return String(content || "");
}

export async function loadSessionHistory(
  sessionId: string,
  limit: number = 25
): Promise<HistoryBlock[]> {
  const filePath = await findSessionFile(sessionId);

  if (!filePath) {
    log.info({ sessionId }, "No session file found");
    return [];
  }

  log.info({ filePath, sessionId }, "Loading session history");

  try {
    const fileContent = await fs.readFile(filePath, "utf-8");
    const lines = fileContent.trim().split("\n").filter(Boolean);

    const blocks: HistoryBlock[] = [];
    const toolBlockMap = new Map<string, HistoryBlock>();
    const agentId = "ghost";

    for (const line of lines) {
      try {
        const msg: SDKMessage = JSON.parse(line);
        const timestamp = msg.timestamp || Date.now();

        // User messages
        if (msg.type === "user" && msg.message?.role === "user") {
          const content = msg.message.content;

          // Handle string content (plain user message)
          if (typeof content === "string") {
            const cleanedContent = cleanImageMetadata(content);
            if (cleanedContent) {
              blocks.push({
                id: crypto.randomUUID(),
                type: "user_command",
                agentId,
                timestamp,
                content: cleanedContent,
              });
            }
            continue;
          }

          // Handle array content
          if (Array.isArray(content)) {
            // Check for tool results - attach to existing tool blocks
            const toolResults = content.filter(c => c.type === "tool_result");
            if (toolResults.length > 0) {
              for (const result of toolResults) {
                const toolBlock = toolBlockMap.get(result.tool_use_id || "");
                if (toolBlock) {
                  toolBlock.toolResult = parseToolResultContent(result.content);
                  toolBlock.toolError = result.is_error || false;
                }
              }
              continue; // Don't create a block for tool_result messages
            }

            // Regular user message with text/images
            const textParts = content
              .filter(c => c.type === "text" && c.text)
              .map(c => cleanImageMetadata(c.text as string))
              .filter(t => t); // Remove empty strings after cleaning

            const images = content.filter(c => c.type === "image" && c.source);

            // Only create block if there's actual content (not just image metadata)
            if (textParts.length > 0 || images.length > 0) {
              const cleanedText = textParts.join("\n");
              // Skip if only images but no text (image-only metadata messages)
              if (!cleanedText && images.length === 0) {
                continue;
              }
              blocks.push({
                id: crypto.randomUUID(),
                type: "user_command",
                agentId,
                timestamp,
                content: cleanedText,
                attachments: images.length > 0 ? images.map(img => ({
                  type: "image" as const,
                  name: "image",
                  data: img.source?.data,
                  mimeType: img.source?.media_type || "image/png",
                })) : undefined,
              });
            }
          }
          continue;
        }

        // Assistant messages
        if (msg.type === "assistant" && msg.message?.content) {
          const content = msg.message.content;

          if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === "text" && block.text) {
                const cleanedText = cleanImageMetadata(block.text);
                if (cleanedText) {  // Only add if there's content after cleaning
                  blocks.push({
                    id: crypto.randomUUID(),
                    type: "text",
                    agentId,
                    timestamp,
                    content: cleanedText,
                  });
                }
              } else if (block.type === "tool_use" && block.id) {
                const toolBlock: HistoryBlock = {
                  id: crypto.randomUUID(),
                  type: "tool_use",
                  agentId,
                  timestamp,
                  toolUseId: block.id,
                  toolName: block.name,
                  toolInput: block.input,
                };
                blocks.push(toolBlock);
                toolBlockMap.set(block.id, toolBlock);
              }
            }
          }
          continue;
        }

        // System init message
        if (msg.type === "system" && msg.subtype === "init") {
          blocks.push({
            id: crypto.randomUUID(),
            type: "system",
            agentId,
            timestamp,
            content: `Session initialized: ${msg.session_id?.slice(0, 8)}...`,
          });
        }
      } catch {
        // Skip malformed lines
      }
    }

    log.info({ totalBlocks: blocks.length, limit }, "Parsed history blocks");

    // Return last N blocks
    return blocks.slice(-limit);
  } catch (error) {
    log.error({ error, filePath }, "Failed to load session history");
    return [];
  }
}
