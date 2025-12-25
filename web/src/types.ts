export type AgentStatus = 'online' | 'offline' | 'busy';

export interface Agent {
  id: string;
  name: string;
  status: AgentStatus;
  sessionId: string | null;
  isTyping: boolean;
  currentTool: string | null;
}

export interface AgentConfig {
  name: string;
  workspacePath?: string;
  model?: string;
  systemPrompt?: string;
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
  | 'error'
  | 'system'
  | 'summary';

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
    | 'thinking'
    | 'turn_complete'
    | 'error'
    | 'init'
    | 'compact_complete';
  agentId: string;
  timestamp: string;
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
