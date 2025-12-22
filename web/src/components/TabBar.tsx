import type { Agent } from '../types/agents';
import { CloseIcon, PlusIcon } from './Icons';

interface TabBarProps {
  agents: Agent[];
  activeAgentId: string;
  onTabSelect: (id: string) => void;
  onTabClose: (id: string) => void;
  onNewTab: () => void;
}

export function TabBar({ agents, activeAgentId, onTabSelect, onTabClose, onNewTab }: TabBarProps) {
  return (
    <div className="tab-bar">
      {agents.map(agent => (
        <div
          key={agent.id}
          className={`tab ${activeAgentId === agent.id ? 'active' : ''}`}
          onClick={() => onTabSelect(agent.id)}
        >
          <span>{agent.name}</span>
          {agents.length > 1 && (
            <span
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(agent.id);
              }}
            >
              <CloseIcon />
            </span>
          )}
        </div>
      ))}
      <div className="new-tab-btn" onClick={onNewTab}>
        <PlusIcon />
      </div>
      <div className="tab-bar-hint">
        Ctrl+N
      </div>
    </div>
  );
}
