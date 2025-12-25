import type { Agent } from '../../types/agents';
import { FolderIcon, FileIcon, CompactIcon } from '../Icons';

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
          <span>Claude Control Panel (CCP)</span>
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
            <span>{agent.id === 'ghost' ? '◇' : '○'}</span>
            <span>{agent.name}</span>
            <span className={`status-dot ${agent.status}`} />
          </div>
        ))}
      </div>

      {/* Workspace section */}
      <div className="sidebar-section">
        <div className="sidebar-section-title">Workspace</div>
        <div className="sidebar-item">
          <FolderIcon />
          <span>knowledge/</span>
        </div>
        <div className="sidebar-item">
          <FolderIcon />
          <span>tools/</span>
        </div>
        <div className="sidebar-item">
          <FileIcon />
          <span>CLAUDE.md</span>
        </div>
      </div>

      {/* Actions section */}
      <div className="sidebar-section">
        <div className="sidebar-section-title">Actions</div>
        <button className="sidebar-action-btn" onClick={onCompact}>
          <CompactIcon />
          <span>Compact Session</span>
          <span className="action-meta">{formatTokens(tokenCount)}</span>
        </button>
      </div>

      {/* Future: Processes section placeholder */}
      {/*
      <div className="sidebar-section">
        <div className="sidebar-section-title">Processes</div>
        <div className="sidebar-item dim">
          <span>No background tasks</span>
        </div>
      </div>
      */}
    </aside>
  );
}
