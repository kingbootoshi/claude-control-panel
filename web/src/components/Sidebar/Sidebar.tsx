import type { Project, Terminal } from '../../types';
import { CompactIcon, GearIcon, HomeIcon, CloseIcon } from '../Icons';

interface SidebarProps {
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

export function Sidebar({
  terminals,
  projects,
  activeTerminalId,
  onTerminalSelect,
  onTerminalClose,
  onCompact,
  onSettingsClick,
  onHomeClick,
  tokenCount
}: SidebarProps) {
  const formatTokens = (count: number) => {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count.toString();
  };

  // Get active terminals only (running, starting, idle)
  const activeTerminals = terminals.filter(t => t.status === 'running' || t.status === 'starting' || t.status === 'idle');

  // Helper to get display name for terminal
  const getTerminalName = (terminal: Terminal) => {
    if (terminal.projectId) {
      const project = projects.find(p => p.id === terminal.projectId);
      return project?.name ?? terminal.projectId;
    }
    return 'General Chat';
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <span>Claude Control Panel</span>
        </div>
      </div>

      {/* Home button */}
      <div className="sidebar-section">
        <button className="sidebar-action-btn" onClick={onHomeClick}>
          <HomeIcon />
          <span>Home</span>
        </button>
      </div>

      {/* Active terminals section */}
      {activeTerminals.length > 0 && (
        <div className="sidebar-section">
          <div className="sidebar-section-title">Active Sessions</div>
          {activeTerminals.map(terminal => (
            <div
              key={terminal.id}
              className={`sidebar-item ${activeTerminalId === terminal.id ? 'active' : ''}`}
            >
              <div className="sidebar-item-main" onClick={() => onTerminalSelect(terminal.id)}>
                <span className="mono">{terminal.projectId ? '~' : '>'}</span>
                <span>{getTerminalName(terminal)}</span>
                <span className={`status-dot ${terminal.status}`} />
              </div>
              <button
                className="sidebar-item-action"
                onClick={(e) => { e.stopPropagation(); onTerminalClose(terminal.id); }}
                title="Close session"
              >
                <CloseIcon />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Actions section */}
      <div className="sidebar-section sidebar-actions">
        <div className="sidebar-section-title">Actions</div>
        <button className="sidebar-action-btn" onClick={onCompact} disabled={!activeTerminalId}>
          <CompactIcon />
          <span>Compact Session</span>
          <span className="action-meta">{formatTokens(tokenCount)}</span>
        </button>
        <button className="sidebar-action-btn" onClick={onSettingsClick}>
          <GearIcon />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}
