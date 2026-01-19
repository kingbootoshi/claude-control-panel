interface Agent {
  name: string;
  status: 'ready' | 'busy' | 'offline';
}

interface AgentStatusProps {
  agents: Agent[];
}

export function AgentStatus({ agents }: AgentStatusProps) {
  return (
    <div className="context-section">
      <div className="context-title">Agents</div>
      <div className="agent-list">
        {agents.map(agent => (
          <div key={agent.name} className="agent-item">
            <span className="agent-name">{agent.name}</span>
            <span className={`agent-status ${agent.status}`}>
              <span className="agent-dot" />
              {agent.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
