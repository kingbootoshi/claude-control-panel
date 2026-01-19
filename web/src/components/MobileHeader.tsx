import type { TerminalStatus } from '../types';
import { ChevronLeftIcon } from './Icons';

interface MobileHeaderProps {
  agentName: string;
  status: TerminalStatus;
  tokenCount: number;
  onBack?: () => void;
}

export function MobileHeader({ agentName, status, tokenCount, onBack }: MobileHeaderProps) {
  const formatTokens = (count: number) => {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count.toString();
  };

  // Map terminal status to display status
  const displayStatus = status === 'running' ? 'online' : status === 'starting' ? 'busy' : 'offline';

  return (
    <header className="mobile-header">
      {onBack && (
        <button className="mobile-header-back" onClick={onBack}>
          <ChevronLeftIcon />
        </button>
      )}
      <div className="mobile-header-left">
        <span className="mobile-header-title">{agentName}</span>
        <span className={`mobile-header-status ${displayStatus}`} />
        <span className="mobile-header-tokens">{formatTokens(tokenCount)}</span>
      </div>
    </header>
  );
}
