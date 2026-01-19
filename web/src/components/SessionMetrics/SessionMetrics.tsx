import { trpc } from '../../trpc';

interface SessionMetricsProps {
  terminalId: string;
}

const WARNING_RATIO = 0.7;
const CRITICAL_RATIO = 0.9;

function trimTrailingZeros(value: string): string {
  return value.endsWith('.0') ? value.slice(0, -2) : value;
}

function formatCompactNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${trimTrailingZeros((value / 1_000_000).toFixed(1))}m`;
  }
  if (value >= 1_000) {
    return `${trimTrailingZeros((value / 1_000).toFixed(1))}k`;
  }
  return value.toString();
}

function formatUsd(value: number): string {
  return `$${value.toFixed(4)}`;
}

function formatTimestamp(value: string | null): string {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString();
}

export function SessionMetrics({ terminalId }: SessionMetricsProps) {
  const utils = trpc.useUtils();
  const metricsQuery = trpc.metrics.get.useQuery(
    { terminalId },
    { enabled: Boolean(terminalId) }
  );

  const compactMutation = trpc.metrics.compact.useMutation({
    onSuccess: () => {
      void utils.metrics.get.invalidate({ terminalId });
    },
  });

  const metrics = metricsQuery.data?.metrics ?? null;
  const contextLimitTokens = metricsQuery.data?.contextLimitTokens ?? 0;
  const currentContextTokens = metrics?.currentContextTokens ?? 0;
  const totalTokensSpent = metrics
    ? metrics.totalInputTokensSpent + metrics.totalOutputTokens
    : 0;
  const contextRatio = contextLimitTokens > 0
    ? currentContextTokens / contextLimitTokens
    : 0;
  const status = contextRatio >= CRITICAL_RATIO
    ? 'critical'
    : contextRatio >= WARNING_RATIO
      ? 'warning'
      : 'normal';

  const progressWidth = Math.min(contextRatio, 1) * 100;
  const barColor = status === 'critical'
    ? 'bg-red-500'
    : status === 'warning'
      ? 'bg-amber-400'
      : 'bg-emerald-500';
  const toneColor = status === 'critical'
    ? 'text-red-300'
    : status === 'warning'
      ? 'text-amber-300'
      : 'text-emerald-300';

  const contextLabel = contextLimitTokens > 0
    ? `${formatCompactNumber(currentContextTokens)} / ${formatCompactNumber(contextLimitTokens)}`
    : formatCompactNumber(currentContextTokens);

  const recentCompactions = metrics?.compactionHistory
    ? metrics.compactionHistory.slice(-3).reverse()
    : [];

  const handleCompact = () => {
    if (compactMutation.isPending) return;
    compactMutation.mutate({ terminalId });
  };

  return (
    <div className="rounded-md border border-void-border bg-void-elevated/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-dim)]">
            Session Metrics
          </div>
          <div className={`mt-1 text-sm font-semibold ${toneColor}`}>
            {contextLabel}
          </div>
          <div className="mt-1 text-[11px] text-[var(--text-muted)]">
            Current context tokens
          </div>
        </div>
        <button
          className="rounded-sm border border-void-border bg-void-surface px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text)] transition hover:border-amber-500/60 hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={handleCompact}
          disabled={compactMutation.isPending || metricsQuery.isLoading || Boolean(metricsQuery.error)}
        >
          Compact Now
        </button>
      </div>

      <div className="mt-3 h-2 w-full rounded-full bg-void-border/80">
        <div
          className={`h-2 rounded-full ${barColor}`}
          style={{ width: `${progressWidth}%` }}
        />
      </div>

      {metricsQuery.isLoading && (
        <div className="mt-3 text-xs text-[var(--text-dim)]">Loading metrics...</div>
      )}

      {metricsQuery.error && (
        <div className="mt-3 text-xs text-red-400">Metrics unavailable</div>
      )}

      {!metricsQuery.isLoading && !metricsQuery.error && metrics && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-md border border-void-border/80 bg-void-surface/60 p-2">
              <div className="text-[var(--text-dim)]">Total tokens spent</div>
              <div className="mt-1 text-sm font-semibold text-[var(--text)]">
                {formatCompactNumber(totalTokensSpent)}
              </div>
            </div>
            <div className="rounded-md border border-void-border/80 bg-void-surface/60 p-2">
              <div className="text-[var(--text-dim)]">Total cost USD</div>
              <div className="mt-1 text-sm font-semibold text-[var(--text)]">
                {formatUsd(metrics.totalCostUsd)}
              </div>
            </div>
            <div className="rounded-md border border-void-border/80 bg-void-surface/60 p-2">
              <div className="text-[var(--text-dim)]">Turn count</div>
              <div className="mt-1 text-sm font-semibold text-[var(--text)]">
                {metrics.turnCount.toLocaleString()}
              </div>
            </div>
            <div className="rounded-md border border-void-border/80 bg-void-surface/60 p-2">
              <div className="text-[var(--text-dim)]">Compactions</div>
              <div className="mt-1 text-sm font-semibold text-[var(--text)]">
                {metrics.compactionCount.toLocaleString()}
              </div>
            </div>
            <div className="col-span-2 rounded-md border border-void-border/80 bg-void-surface/60 p-2">
              <div className="text-[var(--text-dim)]">Last compacted</div>
              <div className="mt-1 text-sm font-semibold text-[var(--text)]">
                {formatTimestamp(metrics.lastCompactedAt)}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-dim)]">
              Compaction History
            </div>
            {recentCompactions.length === 0 ? (
              <div className="mt-2 text-xs text-[var(--text-dim)]">No compactions yet</div>
            ) : (
              <div className="mt-2 space-y-2 text-xs">
                {recentCompactions.map((record) => (
                  <div
                    key={`${record.compactedAt}-${record.preTokens}`}
                    className="rounded-md border border-void-border/80 bg-void-surface/60 px-3 py-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="uppercase tracking-[0.16em] text-[var(--text-dim)]">
                        {record.trigger}
                      </span>
                      <span className="text-[var(--text-muted)]">
                        {formatTimestamp(record.compactedAt)}
                      </span>
                    </div>
                    <div className="mt-1 text-[var(--text)]">
                      {formatCompactNumber(record.preTokens)} to {formatCompactNumber(record.postTokens)} tokens
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {!metricsQuery.isLoading && !metricsQuery.error && !metrics && (
        <div className="mt-3 text-xs text-[var(--text-dim)]">
          No active session metrics available.
        </div>
      )}
    </div>
  );
}
