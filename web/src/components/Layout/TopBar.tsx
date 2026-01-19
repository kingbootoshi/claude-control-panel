interface TopBarProps {
  activeTab: string;
  connected: boolean;
  projectCount: number;
}

export function TopBar({ activeTab, connected, projectCount }: TopBarProps) {
  return (
    <header className="top-bar">
      <div className="top-bar-tabs">
        <button className="top-bar-tab active">{activeTab}</button>
      </div>
      <div className="top-bar-spacer" />
      <div className="top-bar-status">
        <div className="top-bar-status-item">
          <span className={`status-indicator ${connected ? 'connected' : ''}`} />
          <span>{connected ? 'connected' : 'disconnected'}</span>
        </div>
        <div className="top-bar-status-item">
          <span>{projectCount} projects</span>
        </div>
      </div>
    </header>
  );
}
