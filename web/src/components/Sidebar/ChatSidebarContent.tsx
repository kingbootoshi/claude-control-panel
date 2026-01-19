import type { Project, Terminal } from '../../types';
import { CompactIcon, GearIcon, ChevronLeftIcon, CloseIcon, HomeIcon } from '../Icons';
import { trpc } from '../../trpc';

interface ChatSidebarContentProps {
  terminals: Terminal[];
  projects: Project[];
  activeTerminalId: string | null;
  onTerminalSelect: (id: string) => void;
  onTerminalClose: (id: string) => void;
  onCompact: () => void;
  onSettingsClick: () => void;
  onHomeClick: () => void;
  tokenCount: number;
}

export function ChatSidebarContent({
  terminals,
  projects,
  activeTerminalId,
  onTerminalSelect,
  onTerminalClose,
  onCompact,
  onSettingsClick,
  onHomeClick,
  tokenCount,
}: ChatSidebarContentProps) {
  const ghostQuery = trpc.ghost.get.useQuery(undefined, { refetchInterval: 5000 });

  const formatTokens = (count: number) => {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count.toString();
  };

  const isActiveStatus = (status: Terminal['status']) =>
    status === 'running' || status === 'starting' || status === 'idle';

  // Get active terminals only
  const activeTerminals = terminals.filter(
    t => isActiveStatus(t.status)
  );

  const ghostFromList = terminals.find(t => t.id === 'ghost') ?? null;
  const ghostExists = Boolean(ghostFromList) || ghostQuery.data?.exists === true;
  const ghostTerminal = ghostExists ? ghostFromList : null;

  const orderedTerminals = ghostTerminal && isActiveStatus(ghostTerminal.status)
    ? [ghostTerminal, ...activeTerminals.filter(t => t.id !== 'ghost')]
    : activeTerminals;

  // Get terminal display name
  const getTerminalName = (terminal: Terminal) => {
    if (terminal.projectId) {
      const project = projects.find(p => p.id === terminal.projectId);
      return project?.name ?? 'Project';
    }
    if (terminal.id === 'ghost') return 'Ghost';
    return 'General Chat';
  };

  return (
    <>
      {/* Back button at top */}
      <button className="sidebar-back-btn" onClick={onHomeClick}>
        <ChevronLeftIcon />
        <span>Home</span>
      </button>

      <div className="sidebar-header">
        <span className="sidebar-header-label">Sessions</span>
      </div>
      <div className="sidebar-section sidebar-sessions">
        {orderedTerminals.map(terminal => {
          const isActive = activeTerminalId === terminal.id;
          const isGhost = terminal.id === 'ghost';
          return (
            <div
              key={terminal.id}
              className={`session-item ${isActive ? 'active' : ''}`}
              onClick={() => onTerminalSelect(terminal.id)}
            >
              <span className={`session-status ${terminal.status}`} />
              {isGhost && (
                <span className="text-amber-200">
                  <HomeIcon />
                </span>
              )}
              <span className="session-name">{getTerminalName(terminal)}</span>
              {isGhost && (
                <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] tracking-wide text-amber-200">
                  (Ghost)
                </span>
              )}
              <span className="session-id">{terminal.id.slice(0, 8)}</span>
              <button
                className="session-close"
                onClick={(e) => {
                  e.stopPropagation();
                  onTerminalClose(terminal.id);
                }}
              >
                <CloseIcon />
              </button>
            </div>
          );
        })}
        {activeTerminals.length === 0 && (
          <div className="sessions-empty">No active sessions</div>
        )}
      </div>

      {/* Actions at bottom */}
      <div className="sidebar-actions-bottom">
        <button className="sidebar-action-btn" onClick={onCompact} disabled={!activeTerminalId}>
          <CompactIcon />
          <span>Compact</span>
          <span className="action-meta">{formatTokens(tokenCount)}</span>
        </button>
        <button className="sidebar-action-btn" onClick={onSettingsClick}>
          <GearIcon />
          <span>Settings</span>
        </button>
      </div>
    </>
  );
}
