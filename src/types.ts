export type TerminalStatus = "starting" | "running" | "idle" | "closed" | "dead";
export type ChildAgentStatus = "running" | "complete" | "failed";

// Project - tracked directory on filesystem
export interface Project {
  id: string;              // slug (e.g., "claude-control-panel")
  name: string;            // display name
  path: string;            // absolute filesystem path
  createdAt: string;       // ISO date
  lastOpenedAt: string;    // ISO date
}

export interface ChildAgent {
  id: string;              // codex job id
  parentSessionId: string; // Claude session that spawned it
  tmuxSession: string;     // tmux session name
  status: ChildAgentStatus;
  startedAt: string;
  completedAt?: string;
}

export type ChildAgentEventType = "started" | "completed" | "failed";

export interface ChildAgentEvent {
  sessionId: string;
  childAgent: ChildAgent;
  event: ChildAgentEventType;
}

// Terminal - running Claude session
export interface Terminal {
  id: string;
  projectId: string | null;  // null = non-project chat (workspace root)
  sessionId: string | null;  // Claude's session ID for resume
  status: TerminalStatus;
  createdAt: string;         // ISO date
  isPersistent?: boolean;
  childAgents: ChildAgent[];
}

export interface SessionSummary {
  sessionId: string;
  projectId: string;
  createdAt: string;
  lastMessagePreview: string | null;
  tokenCount: number;
  status: TerminalStatus;
}

// Terminal event with terminalId for routing
export interface TerminalEvent {
  terminalId: string;
  event: StreamEvent;
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
  terminalId: string;  // was agentId
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

export interface GitStatus {
  staged: string[];
  unstaged: string[];
  untracked: string[];
}

export interface GitCommit {
  hash: string;
  author: string;
  date: string;
  message: string;
}

export interface GitDiff {
  file: string;
  hunks: Array<{
    header: string;
    lines: string[];
  }>;
}

export interface GitBranch {
  name: string;
  current: boolean;
}

export interface TmuxSession {
  name: string;
  windows: number;
  created: string;
  attached: boolean;
}

export interface TmuxPane {
  id: string;
  sessionName: string;
  windowIndex: number;
  paneIndex: number;
  cwd: string;
  command: string;
  active: boolean;
}

export interface CaptureOpts {
  lines?: number;
  start?: string;
  end?: string;
  join?: boolean;
  escape?: boolean;
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
    | "thinking_start"
    | "thinking_delta"
    | "thinking_complete"
    | "turn_complete"
    | "error"
    | "init"
    | "compact_complete";
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

export interface StreamEventMessage extends StreamEvent {
  terminalId: string;  // was agentId
  timestamp: string;
}

export interface HistoryResult {
  blocks: TerminalBlock[];
  lastContextTokens: number;
}

// ClaudeSession options - cwd and session file location
export interface ClaudeSessionOptions {
  cwd: string;           // working directory (project path or workspace root)
  sessionFile: string;   // where to persist session ID
  resumeSessionId?: string;
}

export interface SessionLike {
  sendMessage(content: MessageContent): Promise<void>;
  getSessionId(): string | null;
  on(event: "event", listener: (event: StreamEvent) => void): this;
  off(event: "event", listener: (event: StreamEvent) => void): this;
}

// Terminal manager interface - manages multiple sessions
export interface TerminalManagerLike {
  getOrCreateGhost(): Promise<string>;
  spawn(projectId: string | null): Promise<string>;
  send(terminalId: string, content: MessageContent): Promise<void>;
  close(terminalId: string): Promise<void>;
  resume(terminalId: string): Promise<void>;
  kill(terminalId: string): Promise<void>;
  list(): Terminal[];
  get(terminalId: string): Terminal | undefined;
  getMetrics(terminalId: string): SessionMetrics | null;
  triggerCompact(terminalId: string, instructions?: string): Promise<void>;
  listChildAgents(sessionId: string): ChildAgent[];
  hasConfig(): boolean;
  getAssistantName(): string;
  on(event: "terminal_event", listener: (data: TerminalEvent) => void): this;
  off(event: "terminal_event", listener: (data: TerminalEvent) => void): this;
}

// Legacy interface - kept for backward compatibility during migration
export interface SessionManagerLike extends SessionLike {
  restart(): Promise<void>;
  setupAgent(name: string, claudeMd: string): Promise<{ agentId: string }>;
  getConfig(): { primaryAgentId: string; assistantName: string } | null;
  hasConfig(): boolean;
}

export interface SessionMetrics {
  currentContextTokens: number;
  totalInputTokensSpent: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  turnCount: number;
  compactionCount: number;
  lastCompactedAt: string | null;
  compactionHistory: CompactionRecord[];
}

export interface CompactionRecord {
  compactedAt: string;          // ISO timestamp
  preTokens: number;            // tokens before compaction
  postTokens: number;           // tokens after compaction
  trigger: "auto" | "manual";   // what triggered it
  instructionsUsed: string;     // custom instructions sent
}

export interface SmartCompactConfig {
  enabled: boolean;
  thresholdTokens: number;
  warningThresholdTokens: number;
  customInstructions: string | null;
}
