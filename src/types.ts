export type AgentStatus = "online" | "offline" | "busy";

export interface AgentInfo {
  id: string;
  name: string;
  sessionId: string | null;
  status: AgentStatus;
}

export interface Attachment {
  type: "image" | "file";
  name: string;
  data: string;
  mimeType: string;
}

export type TerminalBlockType =
  | "user_command"
  | "text"
  | "text_streaming"
  | "tool_use"
  | "tool_result"
  | "thinking"
  | "error"
  | "system"
  | "summary";

export interface TerminalBlock {
  id: string;
  type: TerminalBlockType;
  agentId: string;
  timestamp: number;

  // Content varies by type
  content?: string;

  // For streaming text
  isStreaming?: boolean;
  messageId?: string;

  // For tool blocks
  toolUseId?: string;
  toolName?: string;
  toolInput?: unknown;
  toolResult?: string;
  toolError?: boolean;

  // For collapsible sections
  collapsed?: boolean;

  // For attachments (images, files)
  attachments?: Array<{
    type: "image" | "file";
    name: string;
    data?: string;
    mimeType: string;
  }>;
}

export interface FileEntry {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileEntry[];
}

export type TextContent = { type: "text"; text: string };
export type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
export type ImageContent = {
  type: "image";
  source: {
    type: "base64";
    media_type: ImageMediaType;
    data: string;
  };
};
export type ContentBlock = TextContent | ImageContent;
export type MessageContent = string | ContentBlock[];

export interface StreamEvent {
  type:
    | "text_delta"
    | "text_complete"
    | "tool_start"
    | "tool_result"
    | "thinking"
    | "turn_complete"
    | "error"
    | "init"
    | "compact_complete";
  content?: string;
  messageId?: string;
  toolUseId?: string;
  toolName?: string;
  input?: unknown;
  result?: string;
  isError?: boolean;
  sessionId?: string;
  tools?: string[];
  durationMs?: number;
  costUsd?: number;
  currentContextTokens?: number;
  totalInputTokensSpent?: number;
  preTokens?: number;
}

export interface StreamEventMessage extends StreamEvent {
  agentId: string;
  timestamp: string;
}

export interface HistoryResult {
  blocks: TerminalBlock[];
  lastContextTokens: number;
}

export interface SessionLike {
  sendMessage(content: MessageContent): Promise<void>;
  getSessionId(): string | null;
  on(event: "event", listener: (event: StreamEvent) => void): this;
  off(event: "event", listener: (event: StreamEvent) => void): this;
}
