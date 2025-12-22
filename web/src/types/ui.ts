export type TerminalBlockType =
  | 'user_command'
  | 'text'
  | 'text_streaming'
  | 'tool_use'
  | 'tool_result'
  | 'thinking'
  | 'error'
  | 'system';

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
}
