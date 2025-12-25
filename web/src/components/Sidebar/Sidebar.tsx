import type { Agent } from '../../types/agents';
import { CompactIcon } from '../Icons';

interface SidebarProps {
  agents: Agent[];
  activeAgentId: string;
  onAgentSelect: (id: string) => void;
  onCompact: () => void;
  tokenCount: number;
}

export function Sidebar({ agents, activeAgentId, onAgentSelect, onCompact, tokenCount }: SidebarProps) {
  const formatTokens = (count: number) => {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count.toString();
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <span>Claude Control Panel</span>
        </div>
      </div>

      {/* Agents section */}
      <div className="sidebar-section">
        <div className="sidebar-section-title">Agents</div>
        {agents.map(agent => (
          <div
            key={agent.id}
            className={`sidebar-item ${activeAgentId === agent.id ? 'active' : ''}`}
            onClick={() => onAgentSelect(agent.id)}
          >
            <span className="mono">{agent.id === 'ghost' ? '◇' : '○'}</span>
            <span>{agent.name}</span>
            <span className={`status-dot ${agent.status}`} />
          </div>
        ))}
      </div>

      {/* Actions section */}
      <div className="sidebar-section sidebar-actions">
        <div className="sidebar-section-title">Actions</div>
        <button className="sidebar-action-btn" onClick={onCompact}>
          <CompactIcon />
          <span>Compact Session</span>
          <span className="action-meta">{formatTokens(tokenCount)}</span>
        </button>
      </div>
    </aside>
  );
}
