interface WarningBannerProps {
  tokenCount: number;
  onCompact: () => void;
  onDismiss: () => void;
  contextLimit?: number;
}

const CONTEXT_LIMIT = 128000;
const WARNING_THRESHOLD = 0.8;
const CRITICAL_THRESHOLD = 0.95;

export function WarningBanner({ tokenCount, onCompact, onDismiss, contextLimit = CONTEXT_LIMIT }: WarningBannerProps) {
  const percentage = tokenCount / contextLimit;

  if (percentage < WARNING_THRESHOLD) return null;

  const isCritical = percentage >= CRITICAL_THRESHOLD;
  const percentDisplay = Math.round(percentage * 100);

  return (
    <div className={`warning-banner ${isCritical ? 'critical' : 'warning'}`}>
      <span>⚠️ Context at {percentDisplay}% capacity. Consider compacting to preserve memory.</span>
      <button onClick={onCompact}>Compact Now</button>
      {!isCritical && <button onClick={onDismiss}>Dismiss</button>}
    </div>
  );
}
