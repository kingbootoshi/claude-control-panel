// ============================================
// Client → Server Messages
// ============================================

export interface Attachment {
  type: 'image' | 'file';
  name: string;
  data: string;      // base64
  mimeType: string;
}

export interface UserMessagePayload {
  type: 'user_message';
  agentId: string;
  content: string;
  attachments?: Attachment[];
}

export interface PingPayload {
  type: 'ping';
}

export type ClientMessage = UserMessagePayload | PingPayload;

// ============================================
// Server → Client Messages
// ============================================

export interface BaseServerMessage {
  agentId: string;
  timestamp?: string;
}

export interface InitMessage extends BaseServerMessage {
  type: 'init';
  sessionId: string;
  tools: string[];
}

export interface TextDeltaMessage extends BaseServerMessage {
  type: 'text_delta';
  content: string;
  messageId: string;
}

export interface TextCompleteMessage extends BaseServerMessage {
  type: 'text_complete';
  messageId: string;
}

export interface ToolStartMessage extends BaseServerMessage {
  type: 'tool_start';
  toolUseId: string;
  toolName: string;
  input: unknown;
}

export interface ToolResultMessage extends BaseServerMessage {
  type: 'tool_result';
  toolUseId: string;
  toolName: string;
  result: string;
  isError?: boolean;
}

export interface ThinkingMessage extends BaseServerMessage {
  type: 'thinking';
  content: string;
}

export interface TurnCompleteMessage extends BaseServerMessage {
  type: 'turn_complete';
  durationMs: number;
  costUsd?: number;
}

export interface ErrorMessage extends BaseServerMessage {
  type: 'error';
  content: string;
  fatal?: boolean;
}

export interface StatusMessage {
  type: 'status';
  connected: boolean;
  agents: Array<{
    id: string;
    name: string;
    sessionId: string | null;
    status: 'online' | 'offline' | 'busy';
  }>;
}

export interface PongMessage {
  type: 'pong';
}

export interface HistoryMessage {
  type: 'history';
  agentId: string;
  blocks: import('./ui').TerminalBlock[];
}

export type ServerMessage =
  | InitMessage
  | TextDeltaMessage
  | TextCompleteMessage
  | ToolStartMessage
  | ToolResultMessage
  | ThinkingMessage
  | TurnCompleteMessage
  | ErrorMessage
  | StatusMessage
  | PongMessage
  | HistoryMessage;
