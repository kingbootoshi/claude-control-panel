export type TerminalStatus = 'starting' | 'running' | 'idle' | 'closed' | 'dead';

// Project - tracked directory on filesystem
export interface Project {
  id: string;
  name: string;
  path: string;
  createdAt: string;
  lastOpenedAt: string;
}

// Terminal - running Claude session
export interface Terminal {
  id: string;
  projectId: string | null;  // null = non-project chat
  sessionId: string | null;
  status: TerminalStatus;
  createdAt: string;
}

export interface Attachment {
  type: 'image' | 'file';
  name: string;
  data: string;      // base64
  mimeType: string;
}

export type TerminalBlockType =
  | 'user_command'
  | 'text'
  | 'text_streaming'
  | 'tool_use'
  | 'tool_result'
  | 'thinking'
  | 'thinking_streaming'
  | 'error'
  | 'system'
  | 'summary';

export interface TerminalBlock {
  id: string;
  type: TerminalBlockType;
  terminalId: string;  // was agentId
  timestamp: number;

  // Content varies by type
  content?: string;

  // For streaming text
  isStreaming?: boolean;
  messageId?: string;

  // For thinking blocks
  thinkingId?: string;

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
    type: 'image' | 'file';
    name: string;
    data?: string;     // base64 for images
    mimeType: string;
  }>;
}

export interface StreamEventMessage {
  type:
    | 'text_delta'
    | 'text_complete'
    | 'tool_start'
    | 'tool_result'
    | 'thinking_start'
    | 'thinking_delta'
    | 'thinking_complete'
    | 'turn_complete'
    | 'error'
    | 'init'
    | 'compact_complete';
  terminalId: string;  // was agentId
  timestamp: string;
  content?: string;
  messageId?: string;
  thinkingId?: string;
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

export interface HistoryResult {
  blocks: TerminalBlock[];
  lastContextTokens: number;
}

export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileEntry[];
}

export interface CCPConfig {
  version: 2;
  assistantName: string;
}
