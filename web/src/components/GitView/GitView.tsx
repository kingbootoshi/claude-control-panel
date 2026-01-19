import { useState, useCallback } from 'react';
import { trpc } from '../../trpc';
import type { GitStatus, GitDiff, GitCommit } from '../../types';
import './GitView.css';

interface GitViewProps {
  projectId: string | null;
}

export function GitView({ projectId }: GitViewProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'changes' | 'history'>('changes');

  // Queries - only run if we have a project
  const statusQuery = trpc.git.status.useQuery(
    { projectId: projectId! },
    { enabled: Boolean(projectId), refetchInterval: 5000 }
  );
  const branchesQuery = trpc.git.branches.useQuery(
    { projectId: projectId! },
    { enabled: Boolean(projectId) }
  );
  const diffQuery = trpc.git.diff.useQuery(
    { projectId: projectId!, filePath: selectedFile ?? undefined },
    { enabled: Boolean(projectId) && Boolean(selectedFile) }
  );
  const logQuery = trpc.git.log.useQuery(
    { projectId: projectId! },
    { enabled: Boolean(projectId) && viewMode === 'history' }
  );

  // Mutations
  const stageMutation = trpc.git.stage.useMutation({
    onSuccess: () => statusQuery.refetch(),
  });
  const unstageMutation = trpc.git.unstage.useMutation({
    onSuccess: () => statusQuery.refetch(),
  });

  const currentBranch = branchesQuery.data?.find(b => b.current)?.name ?? 'unknown';
  const status: GitStatus = statusQuery.data ?? { staged: [], unstaged: [], untracked: [] };
  const diffs: GitDiff[] = diffQuery.data ?? [];
  const commits: GitCommit[] = logQuery.data ?? [];

  const handleStage = useCallback((filePath: string) => {
    if (!projectId) return;
    stageMutation.mutate({ projectId, filePath });
  }, [projectId, stageMutation]);

  const handleUnstage = useCallback((filePath: string) => {
    if (!projectId) return;
    unstageMutation.mutate({ projectId, filePath });
  }, [projectId, unstageMutation]);

  const handleStageAll = useCallback(() => {
    if (!projectId) return;
    const allUnstaged = [...status.unstaged, ...status.untracked];
    allUnstaged.forEach(filePath => {
      stageMutation.mutate({ projectId, filePath });
    });
  }, [projectId, status, stageMutation]);

  const handleUnstageAll = useCallback(() => {
    if (!projectId) return;
    status.staged.forEach(filePath => {
      unstageMutation.mutate({ projectId, filePath });
    });
  }, [projectId, status, unstageMutation]);

  if (!projectId) {
    return (
      <div className="git-view-empty">
        <div className="empty-state">
          <BranchIcon />
          <h3>No Project Selected</h3>
          <p>Select a project to view git status</p>
        </div>
      </div>
    );
  }

  if (statusQuery.isLoading) {
    return (
      <div className="git-view-loading">
        <div className="loading-spinner" />
        <p>Loading git status...</p>
      </div>
    );
  }

  if (statusQuery.isError) {
    return (
      <div className="git-view-error">
        <p>Error: {statusQuery.error.message}</p>
        <button onClick={() => statusQuery.refetch()}>Retry</button>
      </div>
    );
  }

  const allChanges = [...status.staged, ...status.unstaged, ...status.untracked];

  return (
    <div className="git-view">
      {/* Header */}
      <div className="git-header">
        <div className="git-branch">
          <BranchIcon />
          <span className="branch-name">{currentBranch}</span>
        </div>
        <div className="git-tabs">
          <button
            className={`tab-btn ${viewMode === 'changes' ? 'active' : ''}`}
            onClick={() => setViewMode('changes')}
          >
            Changes
          </button>
          <button
            className={`tab-btn ${viewMode === 'history' ? 'active' : ''}`}
            onClick={() => setViewMode('history')}
          >
            History
          </button>
        </div>
      </div>

      {viewMode === 'changes' ? (
        <div className="git-changes">
          {/* Staged */}
          <div className="git-section">
            <div className="section-header">
              <span className="section-title">Staged ({status.staged.length})</span>
              {status.staged.length > 0 && (
                <button className="section-action" onClick={handleUnstageAll}>
                  Unstage All
                </button>
              )}
            </div>
            <div className="file-list">
              {status.staged.map(file => (
                <FileItem
                  key={file}
                  path={file}
                  status="staged"
                  selected={selectedFile === file}
                  onClick={() => setSelectedFile(file)}
                  onAction={() => handleUnstage(file)}
                  actionLabel="Unstage"
                />
              ))}
              {status.staged.length === 0 && (
                <div className="empty-section">No staged changes</div>
              )}
            </div>
          </div>

          {/* Unstaged */}
          <div className="git-section">
            <div className="section-header">
              <span className="section-title">
                Changes ({status.unstaged.length + status.untracked.length})
              </span>
              {(status.unstaged.length + status.untracked.length) > 0 && (
                <button className="section-action" onClick={handleStageAll}>
                  Stage All
                </button>
              )}
            </div>
            <div className="file-list">
              {status.unstaged.map(file => (
                <FileItem
                  key={file}
                  path={file}
                  status="modified"
                  selected={selectedFile === file}
                  onClick={() => setSelectedFile(file)}
                  onAction={() => handleStage(file)}
                  actionLabel="Stage"
                />
              ))}
              {status.untracked.map(file => (
                <FileItem
                  key={file}
                  path={file}
                  status="untracked"
                  selected={selectedFile === file}
                  onClick={() => setSelectedFile(file)}
                  onAction={() => handleStage(file)}
                  actionLabel="Stage"
                />
              ))}
              {status.unstaged.length === 0 && status.untracked.length === 0 && (
                <div className="empty-section">No unstaged changes</div>
              )}
            </div>
          </div>

          {/* Diff Panel */}
          {selectedFile && (
            <div className="diff-panel">
              <div className="diff-header">
                <span className="diff-file">{selectedFile}</span>
              </div>
              <div className="diff-content">
                {diffQuery.isLoading && <div className="diff-loading">Loading diff...</div>}
                {diffs.map((diff, i) => (
                  <div key={i} className="diff-file-section">
                    {diff.hunks.map((hunk, j) => (
                      <div key={j} className="diff-hunk">
                        <div className="hunk-header">{hunk.header}</div>
                        {hunk.lines.map((line, k) => (
                          <div
                            key={k}
                            className={`diff-line ${
                              line.startsWith('+') ? 'add' :
                              line.startsWith('-') ? 'del' : 'context'
                            }`}
                          >
                            <span className="line-content">{line}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
                {!diffQuery.isLoading && diffs.length === 0 && (
                  <div className="diff-empty">No diff available</div>
                )}
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="git-summary">
            <span className="summary-item">
              <span className="label">Total:</span>
              <span className="value">{allChanges.length} files</span>
            </span>
            <span className="summary-item">
              <span className="label">Staged:</span>
              <span className="value staged">{status.staged.length}</span>
            </span>
            <span className="summary-item">
              <span className="label">Unstaged:</span>
              <span className="value">{status.unstaged.length + status.untracked.length}</span>
            </span>
          </div>
        </div>
      ) : (
        <div className="git-history">
          {logQuery.isLoading && (
            <div className="history-loading">Loading history...</div>
          )}
          <div className="commit-list">
            {commits.map(commit => (
              <div key={commit.hash} className="commit-item">
                <div className="commit-header">
                  <span className="commit-hash">{commit.hash.slice(0, 7)}</span>
                  <span className="commit-date">{formatDate(commit.date)}</span>
                </div>
                <div className="commit-message">{commit.message}</div>
                <div className="commit-author">{commit.author}</div>
              </div>
            ))}
            {!logQuery.isLoading && commits.length === 0 && (
              <div className="empty-section">No commits yet</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface FileItemProps {
  path: string;
  status: 'staged' | 'modified' | 'untracked';
  selected: boolean;
  onClick: () => void;
  onAction: () => void;
  actionLabel: string;
}

function FileItem({ path, status, selected, onClick, onAction, actionLabel }: FileItemProps) {
  return (
    <div
      className={`file-item ${selected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <span className={`file-status ${status}`} />
      <span className="file-path">{path}</span>
      <button
        className="file-action"
        onClick={(e) => {
          e.stopPropagation();
          onAction();
        }}
      >
        {actionLabel}
      </button>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

function BranchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="6" cy="6" r="3" />
      <circle cx="18" cy="18" r="3" />
      <path d="M6 9v6a3 3 0 003 3h6" />
    </svg>
  );
}

export default GitView;
