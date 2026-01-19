import { useState, useCallback } from 'react';
import { trpc } from '../../trpc';
import type { SessionSummary } from '../../types';
import './HistoryView.css';

interface HistoryViewProps {
  projectId: string | null;
  onSessionSelect?: (sessionId: string) => void;
}

export function HistoryView({ projectId, onSessionSelect }: HistoryViewProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const utils = trpc.useUtils();

  // Query sessions for project
  const sessionsQuery = trpc.history.listByProject.useQuery(
    { projectId: projectId! },
    { enabled: Boolean(projectId) }
  );

  // Delete mutation
  const deleteMutation = trpc.history.delete.useMutation({
    onSuccess: () => {
      utils.history.listByProject.invalidate({ projectId: projectId! });
      setDeleteConfirm(null);
    },
  });

  const sessions: SessionSummary[] = sessionsQuery.data ?? [];

  const handleSelectSession = useCallback((sessionId: string) => {
    setSelectedSessionId(sessionId);
    onSessionSelect?.(sessionId);
  }, [onSessionSelect]);

  const handleDeleteClick = useCallback((sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirm(sessionId);
  }, []);

  const handleConfirmDelete = useCallback((sessionId: string) => {
    deleteMutation.mutate({ sessionId });
  }, [deleteMutation]);

  const handleCancelDelete = useCallback(() => {
    setDeleteConfirm(null);
  }, []);

  if (!projectId) {
    return (
      <div className="history-view-empty">
        <div className="empty-state">
          <HistoryIcon />
          <h3>No Project Selected</h3>
          <p>Select a project to view session history</p>
        </div>
      </div>
    );
  }

  if (sessionsQuery.isLoading) {
    return (
      <div className="history-view-loading">
        <div className="loading-spinner" />
        <p>Loading session history...</p>
      </div>
    );
  }

  if (sessionsQuery.isError) {
    return (
      <div className="history-view-error">
        <p>Error: {sessionsQuery.error.message}</p>
        <button onClick={() => sessionsQuery.refetch()}>Retry</button>
      </div>
    );
  }

  return (
    <div className="history-view">
      {/* Header */}
      <div className="history-header">
        <h2 className="history-title">
          <HistoryIcon />
          Session History
        </h2>
        <span className="session-count">{sessions.length} sessions</span>
      </div>

      {/* Session List */}
      <div className="session-list">
        {sessions.length === 0 ? (
          <div className="empty-sessions">
            <p>No sessions found for this project</p>
          </div>
        ) : (
          sessions.map(session => (
            <div
              key={session.sessionId}
              className={`session-item ${selectedSessionId === session.sessionId ? 'selected' : ''}`}
              onClick={() => handleSelectSession(session.sessionId)}
            >
              {deleteConfirm === session.sessionId ? (
                <div className="delete-confirm">
                  <span>Delete this session?</span>
                  <div className="delete-actions">
                    <button
                      className="confirm-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleConfirmDelete(session.sessionId);
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                    </button>
                    <button
                      className="cancel-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCancelDelete();
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="session-main">
                    <div className="session-header">
                      <span className={`session-status ${session.status}`}>
                        {session.status}
                      </span>
                      <span className="session-date">
                        {formatDate(session.createdAt)}
                      </span>
                    </div>
                    <div className="session-preview">
                      {session.lastMessagePreview || 'No messages'}
                    </div>
                    <div className="session-meta">
                      <span className="meta-item">
                        <TokenIcon />
                        {formatTokens(session.tokenCount)}
                      </span>
                      <span className="meta-item session-id">
                        {session.sessionId.slice(0, 8)}
                      </span>
                    </div>
                  </div>
                  <div className="session-actions">
                    <button
                      className="action-btn resume"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSessionSelect?.(session.sessionId);
                      }}
                      title="Resume session"
                    >
                      <PlayIcon />
                    </button>
                    <button
                      className="action-btn delete"
                      onClick={(e) => handleDeleteClick(session.sessionId, e)}
                      title="Delete session"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="history-footer">
        <span className="footer-text">
          Sessions are stored locally and can be resumed
        </span>
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return String(tokens);
}

function HistoryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function TokenIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 9h6M9 15h6M9 12h6" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export default HistoryView;
