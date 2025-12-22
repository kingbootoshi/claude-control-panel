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
