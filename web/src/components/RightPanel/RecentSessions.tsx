import type { Project, Terminal } from '../../types';

interface RecentSessionsProps {
  terminals: Terminal[];
  projects: Project[];
  onSessionClick: (terminalId: string) => void;
}

export function RecentSessions({ terminals, projects, onSessionClick }: RecentSessionsProps) {
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours === 0) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return diffMins <= 1 ? 'just now' : `${diffMins}m ago`;
    }
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  // Get active terminals sorted by most recent
  const recentTerminals = terminals
    .filter(t => t.status !== 'dead')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const getSessionName = (terminal: Terminal) => {
    if (terminal.projectId) {
      const project = projects.find(p => p.id === terminal.projectId);
      return project?.name ?? 'Project';
    }
    return 'research';
  };

  return (
    <div className="context-section">
      <div className="context-title">Recent Sessions</div>
      <div className="sessions-list">
        {recentTerminals.map(terminal => (
          <button
            key={terminal.id}
            className="session-card"
            onClick={() => onSessionClick(terminal.id)}
          >
            <div className="session-card-header">
              <span className="session-card-name">{getSessionName(terminal)}</span>
              <span className="session-card-time">{formatTime(terminal.createdAt)}</span>
            </div>
            <div className="session-card-preview">
              {terminal.projectId ? 'working on project...' : 'general conversation...'}
            </div>
            <div className="session-card-meta">
              <span>ghost</span>
              <span>--k tokens</span>
            </div>
          </button>
        ))}
        {recentTerminals.length === 0 && (
          <div className="sessions-empty">No recent sessions</div>
        )}
      </div>
    </div>
  );
}
