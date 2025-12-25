interface TokenDisplayProps {
  count: number;
  onCompact: () => void;
  contextLimit?: number;
}

const CONTEXT_LIMIT = 128000;
const WARNING_THRESHOLD = 0.8;
const CRITICAL_THRESHOLD = 0.95;

export function TokenDisplay({ count, onCompact, contextLimit = CONTEXT_LIMIT }: TokenDisplayProps) {
  const percentage = count / contextLimit;
  const status = percentage >= CRITICAL_THRESHOLD ? 'critical'
               : percentage >= WARNING_THRESHOLD ? 'warning'
               : 'normal';

  const formatted = count >= 1000
    ? `${(count / 1000).toFixed(1)}k`
    : count.toString();

  return (
    <div className={`token-display ${status}`}>
      <span className="token-count">{formatted} tokens</span>
      {status !== 'normal' && (
        <button className="compact-btn" onClick={onCompact} title="Compact session">
          ⟨⟩
        </button>
      )}
    </div>
  );
}
