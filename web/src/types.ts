export type TerminalStatus = 'starting' | 'running' | 'idle' | 'closed' | 'dead';
export type ChildAgentStatus = 'running' | 'complete' | 'failed';

// Project - tracked directory on filesystem
export interface Project {
  id: string;
  name: string;
  path: string;
  createdAt: string;
  lastOpenedAt: string;
}

// Child Agent - codex job linked to a Claude session
export interface ChildAgent {
  id: string;
  parentSessionId: string;
  tmuxSession: string;
  status: ChildAgentStatus;
  startedAt: string;
  completedAt?: string;
}

export type ChildAgentEventType = 'started' | 'completed' | 'failed';

export interface ChildAgentEvent {
  sessionId: string;
  childAgent: ChildAgent;
  event: ChildAgentEventType;
}

// Terminal - running Claude session
export interface Terminal {
  id: string;
  projectId: string | null;  // null = non-project chat
  sessionId: string | null;
  status: TerminalStatus;
  createdAt: string;
  isPersistent?: boolean;
  childAgents?: ChildAgent[];
}

// Session Summary - for history list
export interface SessionSummary {
  sessionId: string;
  projectId: string;
  createdAt: string;
  lastMessagePreview: string | null;
  tokenCount: number;
  status: TerminalStatus;
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

// Session Metrics
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
  compactedAt: string;
  preTokens: number;
  postTokens: number;
  trigger: 'auto' | 'manual';
  instructionsUsed: string;
}

export interface SmartCompactConfig {
  enabled: boolean;
  thresholdTokens: number;
  warningThresholdTokens: number;
  customInstructions: string | null;
}

// Ghost Session
export interface GhostStatus {
  exists: boolean;
  status?: TerminalStatus;
  sessionId?: string | null;
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

// Tmux types
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

export type TmuxAgentType = 'claude-code' | 'codex' | 'shell';
export type TmuxPaneStatus = 'idle' | 'running' | 'waiting' | 'complete' | 'error';

export interface TmuxPaneState extends TmuxPane {
  index: number;
  agentType?: TmuxAgentType;
  agentId?: string;
  projectId?: string;
  status: TmuxPaneStatus;
  lastOutput: string;
  title?: string;
}

export interface TmuxSessionState extends TmuxSession {
  panes: TmuxPaneState[];
  layout: 'tiled' | 'even-horizontal' | 'even-vertical' | 'main-horizontal' | 'main-vertical';
  createdAt: string;
}

export interface TmuxOutputEvent {
  paneId: string;
  output: string;
  timestamp: string;
}

// Codex types
export type CodexModel = 'gpt-5.2-codex' | 'gpt-5.1-codex-mini' | 'gpt-5.1-codex-max' | 'gpt-5.2' | 'gpt-5.1-codex' | 'gpt-5-codex';
export type CodexReasoningEffort = 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
export type CodexSandbox = 'read-only' | 'workspace-write' | 'danger-full-access';
export type CodexJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'killed';

export interface FileChange {
  path: string;
  type: 'added' | 'modified' | 'deleted';
  diff?: string;
}

export interface CodexJob {
  id: string;
  prompt: string;
  status: CodexJobStatus;
  model: CodexModel;
  reasoningEffort: CodexReasoningEffort;
  projectId?: string;
  workingDir: string;
  fullAuto: boolean;
  sandbox: CodexSandbox;
  startedAt: string;
  completedAt?: string;
  result?: string;
  filesChanged?: FileChange[];
  error?: string;
  output: string;
}

export interface CodexOutputEvent {
  jobId: string;
  output: string;
  timestamp: string;
}

export interface CodexStatusEvent {
  jobId: string;
  status: CodexJobStatus;
  timestamp: string;
}

// Git types
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
