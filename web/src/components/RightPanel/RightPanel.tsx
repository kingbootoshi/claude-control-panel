import type { Project, Terminal } from '../../types';
import { AgentStatus } from './AgentStatus';
import { RecentSessions } from './RecentSessions';

export type RightPanelMode = 'home' | 'chat';

interface RightPanelProps {
  mode: RightPanelMode;
  terminals: Terminal[];
  projects: Project[];
  onSessionClick: (terminalId: string) => void;
  // Chat mode props
  summary?: string | null;
  projectId?: string | null;
  onFileSelect?: (path: string) => void;
}

export function RightPanel({
  mode,
  terminals,
  projects,
  onSessionClick,
}: RightPanelProps) {
  // Default agents - in real app this would come from backend
  const agents = [
    { name: 'claude-code', status: 'ready' as const },
    { name: 'ghost', status: 'ready' as const },
  ];

  return (
    <aside className="right-panel">
      {mode === 'home' && (
        <>
          <AgentStatus agents={agents} />
          <RecentSessions
            terminals={terminals}
            projects={projects}
            onSessionClick={onSessionClick}
          />
        </>
      )}
      {mode === 'chat' && (
        <>
          <AgentStatus agents={agents} />
          <RecentSessions
            terminals={terminals}
            projects={projects}
            onSessionClick={onSessionClick}
          />
        </>
      )}
    </aside>
  );
}
