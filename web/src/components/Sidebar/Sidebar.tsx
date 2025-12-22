import type { Agent } from '../../types/agents';
import { FolderIcon, FileIcon } from '../Icons';

interface SidebarProps {
  agents: Agent[];
  activeAgentId: string;
  onAgentSelect: (id: string) => void;
}

export function Sidebar({ agents, activeAgentId, onAgentSelect }: SidebarProps) {
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
    </aside>
  );
}
