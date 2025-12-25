interface MobileHeaderProps {
  agentName: string;
  status: 'online' | 'offline' | 'busy';
  tokenCount: number;
}

export function MobileHeader({ agentName, status, tokenCount }: MobileHeaderProps) {
  const formatTokens = (count: number) => {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count.toString();
  };

  return (
    <header className="mobile-header">
      <div className="mobile-header-left">
        <span className="mobile-header-title">{agentName}</span>
        <span className={`mobile-header-status ${status}`} />
        <span className="mobile-header-tokens">{formatTokens(tokenCount)}</span>
      </div>
    </header>
  );
}
