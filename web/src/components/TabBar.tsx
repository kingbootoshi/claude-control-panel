import type { Agent } from '../types';
import { TokenDisplay } from './TokenDisplay';

interface TabBarProps {
  agents: Agent[];
  activeAgentId: string;
  onTabSelect: (id: string) => void;
  tokenCount: number;
  onCompact: () => void;
}

export function TabBar({ agents, activeAgentId, onTabSelect, tokenCount, onCompact }: TabBarProps) {
  return (
    <div className="tab-bar">
      <div className="tab-bar-left">
        {agents.map(agent => (
          <div
            key={agent.id}
            className={`tab ${activeAgentId === agent.id ? 'active' : ''}`}
            onClick={() => onTabSelect(agent.id)}
          >
            <span>{agent.name}</span>
          </div>
        ))}
      </div>
      <div className="tab-bar-right">
        <TokenDisplay count={tokenCount} onCompact={onCompact} />
      </div>
    </div>
  );
}
