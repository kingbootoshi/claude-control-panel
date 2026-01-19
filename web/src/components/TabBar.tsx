import type { Project, Terminal } from '../types';
import { TokenDisplay } from './TokenDisplay';
import { HomeIcon, PlusIcon } from './Icons';

interface TabBarProps {
  terminals: Terminal[];
  projects: Project[];
  activeTerminalId: string | null;
  onTabSelect: (id: string) => void;
  onNewChat: () => void;
  tokenCount: number;
  onCompact: () => void;
}

export function TabBar({
  terminals,
  projects,
  activeTerminalId,
  onTabSelect,
  onNewChat,
  tokenCount,
  onCompact
}: TabBarProps) {
  // Get active (non-dead) terminals
  const activeTerminals = terminals.filter(t => t.status !== 'dead');

  // Helper to get display name for terminal
  const getTerminalName = (terminal: Terminal) => {
    if (terminal.id === 'ghost') return 'Ghost';
    if (terminal.projectId) {
      const project = projects.find(p => p.id === terminal.projectId);
      return project?.name ?? terminal.projectId;
    }
    return 'Chat';
  };

  return (
    <div className="tab-bar">
      <div className="tab-bar-left">
        {activeTerminals.map(terminal => {
          const isGhost = terminal.id === 'ghost';
          return (
          <div
            key={terminal.id}
            className={`tab ${activeTerminalId === terminal.id ? 'active' : ''}`}
            onClick={() => onTabSelect(terminal.id)}
          >
            {isGhost && (
              <span className="text-amber-200">
                <HomeIcon />
              </span>
            )}
            <span>{getTerminalName(terminal)}</span>
            <span className={`status-dot ${terminal.status}`} style={{ marginLeft: '6px' }} />
          </div>
          );
        })}
        <div className="new-tab-btn" onClick={onNewChat} title="New Chat">
          <PlusIcon />
        </div>
      </div>
      <div className="tab-bar-right">
        <TokenDisplay count={tokenCount} onCompact={onCompact} />
      </div>
    </div>
  );
}
