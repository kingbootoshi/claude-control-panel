import { useState, useEffect, useCallback } from 'react';
import { skipToken } from '@tanstack/react-query';
import { trpc } from '../../trpc';
import type { TmuxPane, TmuxSession } from '../../types';
import './TmuxOrchestration.css';

export function TmuxOrchestration() {
  const [selectedSessionName, setSelectedSessionName] = useState<string | null>(null);
  const [focusedPaneId, setFocusedPaneId] = useState<string | null>(null);
  const [paneOutputs, setPaneOutputs] = useState<Record<string, string>>({});
  const [inputValue, setInputValue] = useState('');

  // Queries
  const availableQuery = trpc.tmux.available.useQuery();
  const tmuxAvailable = availableQuery.data ?? false;

  const sessionsQuery = trpc.tmux.sessions.useQuery(undefined, {
    enabled: tmuxAvailable,
  });

  const panesQuery = trpc.tmux.panes.useQuery(
    selectedSessionName ? { sessionName: selectedSessionName } : skipToken,
    { enabled: tmuxAvailable && Boolean(selectedSessionName) }
  );

  const captureQuery = trpc.tmux.capture.useQuery(
    focusedPaneId ? { paneId: focusedPaneId } : skipToken,
    { enabled: tmuxAvailable && Boolean(focusedPaneId) }
  );

  // Mutations
  const sendKeysMutation = trpc.tmux.sendKeys.useMutation();
  const sendControlMutation = trpc.tmux.sendControl.useMutation();

  const sessions = sessionsQuery.data ?? [];
  const panes = panesQuery.data ?? [];
  const visiblePanes = selectedSessionName
    ? panes.filter((pane) => pane.sessionName === selectedSessionName)
    : panes;

  useEffect(() => {
    if (sessions.length === 0) {
      setSelectedSessionName(null);
      return;
    }

    if (!selectedSessionName || !sessions.some((session) => session.name === selectedSessionName)) {
      setSelectedSessionName(sessions[0].name);
    }
  }, [sessions, selectedSessionName]);

  useEffect(() => {
    if (visiblePanes.length === 0) {
      setFocusedPaneId(null);
      return;
    }

    if (!focusedPaneId || !visiblePanes.some((pane) => pane.id === focusedPaneId)) {
      setFocusedPaneId(visiblePanes[0].id);
    }
  }, [visiblePanes, focusedPaneId]);

  useEffect(() => {
    if (!focusedPaneId) return;
    const output = captureQuery.data;
    if (output === undefined) return;

    setPaneOutputs((prev) => ({
      ...prev,
      [focusedPaneId]: output,
    }));
  }, [focusedPaneId, captureQuery.data]);

  // Handlers
  const handleRefreshSessions = useCallback(() => {
    sessionsQuery.refetch();
    if (selectedSessionName) {
      panesQuery.refetch();
    }
    if (focusedPaneId) {
      captureQuery.refetch();
    }
  }, [sessionsQuery, panesQuery, captureQuery, selectedSessionName, focusedPaneId]);

  const handleSendKeys = useCallback(() => {
    if (!focusedPaneId || !inputValue.trim()) return;
    sendKeysMutation.mutate({ paneId: focusedPaneId, keys: inputValue, enter: true });
    setInputValue('');
    captureQuery.refetch();
  }, [focusedPaneId, inputValue, sendKeysMutation, captureQuery]);

  const handleSendControl = useCallback((paneId: string, key: string) => {
    if (!paneId) return;
    sendControlMutation.mutate({ paneId, key });
    if (paneId === focusedPaneId) {
      captureQuery.refetch();
    }
  }, [sendControlMutation, captureQuery, focusedPaneId]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendKeys();
    }
  }, [handleSendKeys]);

  const handleCopyAttachCommand = useCallback(async (command: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(command);
        return;
      } catch {
        // Fallback to execCommand.
      }
    }

    const textarea = document.createElement('textarea');
    textarea.value = command;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }, []);

  const getLayoutClass = (count: number) => {
    if (count <= 1) return '';
    if (count === 2) return 'layout-2x1';
    if (count === 3) return 'layout-3';
    return '';
  };

  const getAttachCommand = (session: TmuxSession) => `tmux attach -t ccp-${session.name}`;

  const getPaneTitle = (pane: TmuxPane) => {
    const location = `${pane.windowIndex}.${pane.paneIndex}`;
    return pane.command ? pane.command : `Pane ${location}`;
  };

  if (availableQuery.isLoading) {
    return (
      <div className="tmux-empty">
        <div className="tmux-empty-content">
          <TerminalIcon />
          <h3>Checking tmux availability</h3>
          <p>Waiting for tmux status...</p>
        </div>
      </div>
    );
  }

  if (availableQuery.isError) {
    return (
      <div className="tmux-empty">
        <div className="tmux-empty-content">
          <TerminalIcon />
          <h3>Unable to check tmux</h3>
          <p>Try again or check server logs.</p>
        </div>
      </div>
    );
  }

  if (!tmuxAvailable) {
    return (
      <div className="tmux-empty">
        <div className="tmux-empty-content">
          <TerminalIcon />
          <h3>tmux not available</h3>
          <p>Install tmux to enable orchestration features.</p>
          <p className="hint">Install tmux with: brew install tmux</p>
        </div>
      </div>
    );
  }

  if (sessionsQuery.isLoading) {
    return (
      <div className="tmux-empty">
        <div className="tmux-empty-content">
          <TerminalIcon />
          <h3>Loading tmux sessions</h3>
          <p>Fetching available tmux sessions...</p>
        </div>
      </div>
    );
  }

  if (sessionsQuery.isError && sessions.length === 0) {
    return (
      <div className="tmux-empty">
        <div className="tmux-empty-content">
          <TerminalIcon />
          <h3>Unable to load tmux sessions</h3>
          <p>Check the daemon logs and try again.</p>
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="tmux-empty">
        <div className="tmux-empty-content">
          <TerminalIcon />
          <h3>No tmux sessions</h3>
          <p>Start a tmux session to see panes here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tmux-orchestration">
      <div className="pane-toolbar">
        <button
          className="inline-flex items-center gap-2 rounded border border-[var(--void-border)] bg-[var(--void-elevated)] px-2 py-1 text-[11px] text-[var(--text-dim)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
          onClick={handleRefreshSessions}
          type="button"
        >
          Refresh Sessions
        </button>
        <div className="toolbar-spacer" />
        {sessionsQuery.isFetching && (
          <span className="text-[10px] text-[var(--text-muted)]">Refreshing...</span>
        )}
      </div>

      <div className="flex flex-col gap-4 overflow-hidden p-4">
        {sessionsQuery.isError && (
          <div className="rounded border border-[var(--red)] bg-[var(--void-surface)] px-3 py-2 text-[11px] text-[var(--red)]">
            Failed to load tmux sessions.
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {sessions.map((session) => {
            const attachCommand = getAttachCommand(session);
            const isSelected = selectedSessionName === session.name;

            return (
              <button
                key={session.name}
                type="button"
                onClick={() => setSelectedSessionName(session.name)}
                className={`rounded border px-3 py-2 text-left transition ${
                  isSelected
                    ? 'border-[var(--accent)] bg-[var(--void-surface)]'
                    : 'border-[var(--void-border)] bg-[var(--void-deep)] hover:border-[var(--accent-dim)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        session.attached ? 'bg-[var(--green)]' : 'bg-[var(--text-muted)]'
                      }`}
                    />
                    <span className="text-[12px] text-[var(--text)]">{session.name}</span>
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {session.windows} window{session.windows === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 rounded bg-[var(--void-elevated)] px-2 py-1 text-[10px] text-[var(--text-dim)]">
                    {attachCommand}
                  </code>
                  <button
                    type="button"
                    className="rounded border border-[var(--void-border)] bg-[var(--void-elevated)] px-2 py-1 text-[10px] text-[var(--text-dim)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleCopyAttachCommand(attachCommand);
                    }}
                  >
                    Copy
                  </button>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[11px] text-[var(--text-dim)]">
          <span>Panes</span>
          {panesQuery.isFetching && <span className="text-[10px] text-[var(--text-muted)]">Updating...</span>}
        </div>

        {panesQuery.isError && (
          <div className="rounded border border-[var(--red)] bg-[var(--void-surface)] px-3 py-2 text-[11px] text-[var(--red)]">
            Failed to load tmux panes.
          </div>
        )}

        <div className={`pane-grid ${getLayoutClass(visiblePanes.length)}`}>
          {visiblePanes.map((pane) => (
            <div
              key={pane.id}
              className={`pane ${focusedPaneId === pane.id ? 'focused' : ''}`}
              onClick={() => setFocusedPaneId(pane.id)}
            >
              <div className="pane-header">
                <span
                  className={`h-2 w-2 rounded-full ${
                    pane.active ? 'bg-[var(--green)]' : 'bg-[var(--text-muted)]'
                  }`}
                />
                <span className="pane-header-title">{getPaneTitle(pane)}</span>
                <span className="text-[10px] text-[var(--text-muted)] truncate" title={pane.cwd}>
                  {pane.cwd}
                </span>
                <div className="pane-header-actions">
                  <button
                    type="button"
                    className="rounded border border-[var(--void-border)] bg-[var(--void-elevated)] px-2 py-0.5 text-[10px] text-[var(--text-dim)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleSendControl(pane.id, 'c');
                    }}
                  >
                    Ctrl+C
                  </button>
                </div>
              </div>
              <div className="pane-content">
                <pre className="pane-output">
                  {paneOutputs[pane.id] || (focusedPaneId === pane.id ? captureQuery.data : '') || 'No output yet...'}
                </pre>
              </div>
              {focusedPaneId === pane.id && (
                <div className="pane-input">
                  <span className="pane-input-prompt">{'>'}</span>
                  <input
                    type="text"
                    className="pane-input-field"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type to send to pane..."
                  />
                  <div className="flex items-center gap-1">
                    {['c', 'd', 'z'].map((key) => (
                      <button
                        key={key}
                        type="button"
                        className="rounded border border-[var(--void-border)] bg-[var(--void-elevated)] px-1.5 py-0.5 text-[9px] uppercase text-[var(--text-dim)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
                        onClick={() => handleSendControl(pane.id, key)}
                      >
                        Ctrl+{key}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {visiblePanes.length === 0 && (
            <div className="pane empty-pane">
              <div className="empty-pane-content">
                <TerminalIcon />
                <p>No panes for this session</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Icons
function TerminalIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

export default TmuxOrchestration;
