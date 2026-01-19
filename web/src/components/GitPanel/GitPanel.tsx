import { useState, useCallback } from 'react';
import './GitPanel.css';

export type FileStatus = 'added' | 'modified' | 'deleted';

export interface GitFile {
  path: string;
  status: FileStatus;
  additions: number;
  deletions: number;
  staged: boolean;
}

export interface DiffLine {
  type: 'add' | 'del' | 'context';
  lineNumber?: number;
  content: string;
}

interface GitPanelProps {
  branch?: string;
  files?: GitFile[];
  onCommit?: (message: string) => void;
  onCommitAndPush?: (message: string) => void;
  onPush?: () => void;
  onPull?: () => void;
  onSync?: () => void;
  onStageFile?: (path: string) => void;
  onUnstageFile?: (path: string) => void;
  onStageAll?: () => void;
  onUnstageAll?: () => void;
}

// Sample data for demo
const sampleFiles: GitFile[] = [
  { path: 'src/auth/github.ts', status: 'added', additions: 127, deletions: 0, staged: true },
  { path: 'src/server.ts', status: 'modified', additions: 12, deletions: 3, staged: true },
  { path: 'package.json', status: 'modified', additions: 2, deletions: 0, staged: true },
  { path: 'src/config.ts', status: 'modified', additions: 5, deletions: 1, staged: false },
  { path: 'web/src/App.tsx', status: 'modified', additions: 8, deletions: 2, staged: false },
];

const sampleDiff: DiffLine[] = [
  { type: 'add', lineNumber: 1, content: "import { OAuthApp } from '@octokit/oauth-app'" },
  { type: 'add', lineNumber: 2, content: "import { config } from '../config'" },
  { type: 'add', lineNumber: 3, content: '' },
  { type: 'add', lineNumber: 4, content: 'export const githubOAuth = new OAuthApp({' },
  { type: 'add', lineNumber: 5, content: '  clientId: config.GITHUB_CLIENT_ID,' },
  { type: 'add', lineNumber: 6, content: '  clientSecret: config.GITHUB_CLIENT_SECRET,' },
  { type: 'add', lineNumber: 7, content: '})' },
  { type: 'add', lineNumber: 8, content: '' },
  { type: 'add', lineNumber: 9, content: 'export async function handleCallback(code: string) {' },
  { type: 'add', lineNumber: 10, content: '  const { authentication } = await githubOAuth' },
  { type: 'add', lineNumber: 11, content: '    .createToken({ code })' },
  { type: 'add', lineNumber: 12, content: '  return authentication' },
  { type: 'add', lineNumber: 13, content: '}' },
  { type: 'add', lineNumber: 14, content: '' },
  { type: 'add', lineNumber: 15, content: 'export function getAuthUrl() {' },
  { type: 'add', lineNumber: 16, content: '  return githubOAuth.getWebFlowAuthorizationUrl({' },
  { type: 'add', lineNumber: 17, content: "    scopes: ['repo', 'user']" },
  { type: 'add', lineNumber: 18, content: '  })' },
  { type: 'add', lineNumber: 19, content: '}' },
];

export function GitPanel({
  branch = 'main',
  files = sampleFiles,
  onCommit,
  onCommitAndPush,
  onPush,
  onPull,
  onSync,
  onStageFile,
  onUnstageFile,
  onStageAll,
  onUnstageAll,
}: GitPanelProps) {
  const [selectedFile, setSelectedFile] = useState<GitFile | null>(files[0] || null);
  const [commitMessage, setCommitMessage] = useState(
    `feat: add github oauth integration

- Added OAuth flow with @octokit/oauth-app
- Added callback route handler
- Updated server configuration`
  );

  const stagedFiles = files.filter(f => f.staged);
  const unstagedFiles = files.filter(f => !f.staged);

  const handleCommit = useCallback(() => {
    if (commitMessage.trim()) {
      onCommit?.(commitMessage.trim());
    }
  }, [commitMessage, onCommit]);

  const handleCommitAndPush = useCallback(() => {
    if (commitMessage.trim()) {
      onCommitAndPush?.(commitMessage.trim());
    }
  }, [commitMessage, onCommitAndPush]);

  const toggleFileStaged = useCallback((file: GitFile) => {
    if (file.staged) {
      onUnstageFile?.(file.path);
    } else {
      onStageFile?.(file.path);
    }
  }, [onStageFile, onUnstageFile]);

  return (
    <div className="git-panel">
      {/* Main Content */}
      <div className="git-main">
        {/* Header */}
        <div className="git-header">
          <span className="git-title">Git Changes</span>
          <div className="branch-selector">
            <BranchIcon />
            <span className="branch-name">{branch}</span>
            <span className="branch-arrow">v</span>
          </div>
        </div>

        {/* Toolbar */}
        <div className="git-toolbar">
          <button className="git-btn" onClick={onSync}>
            <SyncIcon />
            sync
          </button>
          <button className="git-btn" onClick={onPull}>
            <PullIcon />
            pull
          </button>
          <button className="git-btn primary" onClick={onPush}>
            <PushIcon />
            push
          </button>
        </div>

        {/* Content */}
        <div className="git-content">
          {/* Staged Changes */}
          <div className="git-section">
            <div className="section-header">
              <div>
                <span className="section-title">Staged Changes</span>
                <span className="section-count">({stagedFiles.length} files)</span>
              </div>
              <div className="section-actions">
                <button className="section-btn" onClick={onUnstageAll}>unstage all</button>
              </div>
            </div>
            <div className="file-list">
              {stagedFiles.map(file => (
                <FileItem
                  key={file.path}
                  file={file}
                  selected={selectedFile?.path === file.path}
                  onClick={() => setSelectedFile(file)}
                  onToggle={() => toggleFileStaged(file)}
                />
              ))}
            </div>
          </div>

          {/* Unstaged Changes */}
          <div className="git-section">
            <div className="section-header">
              <div>
                <span className="section-title">Unstaged Changes</span>
                <span className="section-count">({unstagedFiles.length} files)</span>
              </div>
              <div className="section-actions">
                <button className="section-btn" onClick={onStageAll}>stage all</button>
              </div>
            </div>
            <div className="file-list">
              {unstagedFiles.map(file => (
                <FileItem
                  key={file.path}
                  file={file}
                  selected={selectedFile?.path === file.path}
                  onClick={() => setSelectedFile(file)}
                  onToggle={() => toggleFileStaged(file)}
                />
              ))}
            </div>
          </div>

          {/* Commit Form */}
          <div className="git-section">
            <div className="section-header">
              <span className="section-title">Commit</span>
            </div>
            <div className="commit-form">
              <textarea
                className="commit-input"
                rows={4}
                placeholder="Commit message..."
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
              />
              <div className="commit-actions">
                <button
                  className="commit-btn primary"
                  onClick={handleCommit}
                  disabled={!commitMessage.trim() || stagedFiles.length === 0}
                >
                  commit
                </button>
                <button
                  className="commit-btn secondary"
                  onClick={handleCommitAndPush}
                  disabled={!commitMessage.trim() || stagedFiles.length === 0}
                >
                  commit & push
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Diff Panel */}
      <div className="diff-panel">
        <div className="diff-header">
          <div className="diff-file">{selectedFile?.path || 'No file selected'}</div>
          {selectedFile && (
            <div className="diff-stats">
              {selectedFile.additions > 0 && (
                <span className="diff-add">+{selectedFile.additions} additions</span>
              )}
              {selectedFile.deletions > 0 && (
                <span className="diff-del">-{selectedFile.deletions} deletions</span>
              )}
            </div>
          )}
        </div>
        <div className="diff-content">
          {sampleDiff.map((line, i) => (
            <div key={i} className={`diff-line ${line.type}`}>
              <span className="diff-line-num">{line.lineNumber || ''}</span>
              <span className="diff-line-code">
                {line.type === 'add' ? '+ ' : line.type === 'del' ? '- ' : '  '}
                {line.content}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="git-footer">
        <span className="footer-item">branch: <span className="value">{branch}</span></span>
        <span className="footer-item"><span className="accent">{stagedFiles.length}</span> staged</span>
        <span className="footer-item"><span className="value">{unstagedFiles.length}</span> unstaged</span>
      </div>
    </div>
  );
}

// File Item Component
interface FileItemProps {
  file: GitFile;
  selected: boolean;
  onClick: () => void;
  onToggle: () => void;
}

function FileItem({ file, selected, onClick, onToggle }: FileItemProps) {
  return (
    <div
      className={`file-item ${selected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <div
        className={`file-checkbox ${file.staged ? 'checked' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        {file.staged && <CheckIcon />}
      </div>
      <span className={`file-status ${file.status}`} />
      <span className="file-path">{file.path}</span>
      <span className="file-changes">
        {file.additions > 0 && <span className="file-add">+{file.additions}</span>}
        {file.deletions > 0 && <span className="file-del">-{file.deletions}</span>}
      </span>
    </div>
  );
}

// Icons
function BranchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="6" cy="6" r="3" />
      <circle cx="18" cy="18" r="3" />
      <path d="M6 9v6a3 3 0 003 3h6" />
    </svg>
  );
}

function SyncIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function PullIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 4v12m0 0l-4-4m4 4l4-4M6 20h12" />
    </svg>
  );
}

function PushIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20V8m0 0l-4 4m4-4l4 4M6 4h12" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default GitPanel;
