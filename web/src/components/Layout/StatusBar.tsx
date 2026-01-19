interface StatusBarProps {
  version: string;
  projectCount: number;
  agentCount: number;
}

export function StatusBar({ version, projectCount, agentCount }: StatusBarProps) {
  return (
    <footer className="status-bar">
      <div className="status-bar-left">
        <span className="status-bar-item">
          ccp <span className="value">{version}</span>
        </span>
      </div>
      <div className="status-bar-right">
        <span className="status-bar-item">
          <span className="value">{projectCount}</span> projects
        </span>
        <span className="status-bar-item accent">
          {agentCount} agents ready
        </span>
      </div>
    </footer>
  );
}
