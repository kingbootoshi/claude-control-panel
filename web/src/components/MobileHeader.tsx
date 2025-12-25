import { MenuIcon, PanelRightIcon } from './Icons';

interface MobileHeaderProps {
  agentName: string;
  status: 'online' | 'offline' | 'busy';
  tokenCount: number;
  onLeftToggle: () => void;
  onRightToggle: () => void;
}

export function MobileHeader({ agentName, status, tokenCount, onLeftToggle, onRightToggle }: MobileHeaderProps) {
  const formatTokens = (count: number) => {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count.toString();
  };

  return (
    <header className="mobile-header">
      <button className="mobile-header-btn" onClick={onLeftToggle} aria-label="Open navigation">
        <MenuIcon />
      </button>

      <div className="mobile-header-center">
        <span className="mobile-header-title">{agentName}</span>
        <span className={`mobile-header-status ${status}`} />
        <span className="mobile-header-tokens">{formatTokens(tokenCount)}</span>
      </div>

      <button className="mobile-header-btn" onClick={onRightToggle} aria-label="Open context panel">
        <PanelRightIcon />
      </button>
    </header>
  );
}
