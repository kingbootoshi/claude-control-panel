import type { Agent } from '../../types/agents';
import { CompactIcon, CloseIcon } from '../Icons';

interface SidebarProps {
  agents: Agent[];
  activeAgentId: string;
  onAgentSelect: (id: string) => void;
  onCompact: () => void;
  tokenCount: number;
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ agents, activeAgentId, onAgentSelect, onCompact, tokenCount, isOpen, onClose }: SidebarProps) {
  const formatTokens = (count: number) => {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count.toString();
  };

  const handleAgentSelect = (id: string) => {
    onAgentSelect(id);
    onClose?.();
  };

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <span>Claude Control Panel</span>
        </div>
        {onClose && (
          <button className="sidebar-close-btn" onClick={onClose} aria-label="Close menu">
            <CloseIcon />
          </button>
        )}
      </div>

      {/* Agents section */}
      <div className="sidebar-section">
        <div className="sidebar-section-title">Agents</div>
        {agents.map(agent => (
          <div
            key={agent.id}
            className={`sidebar-item ${activeAgentId === agent.id ? 'active' : ''}`}
            onClick={() => handleAgentSelect(agent.id)}
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
