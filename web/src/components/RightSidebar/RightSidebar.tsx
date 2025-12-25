import { useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon, FolderIcon, FileIcon, CloseIcon } from '../Icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface RightSidebarProps {
  summary: string | null;
  isOpen?: boolean;
  onClose?: () => void;
}

export function RightSidebar({ summary, isOpen, onClose }: RightSidebarProps) {
  const [contextExpanded, setContextExpanded] = useState(true);
  const [workspaceExpanded, setWorkspaceExpanded] = useState(true);

  return (
    <aside className={`right-sidebar ${isOpen ? 'open' : ''}`}>
      {/* Mobile close header */}
      {onClose && (
        <div className="right-sidebar-mobile-header">
          <span>Context</span>
          <button className="sidebar-close-btn" onClick={onClose} aria-label="Close panel">
            <CloseIcon />
          </button>
        </div>
      )}

      {/* Session Context Section */}
      <div className="right-sidebar-section">
        <div
          className="right-sidebar-header"
          onClick={() => setContextExpanded(!contextExpanded)}
        >
          <span className="right-sidebar-title">Session Context</span>
          <span className="right-sidebar-toggle">
            {contextExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
          </span>
        </div>
        <div className={`right-sidebar-content ${contextExpanded ? '' : 'collapsed'}`}>
          {summary ? (
            <div className="context-summary markdown-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
            </div>
          ) : (
            <div className="context-summary" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No previous session context available. Start a conversation to build context.
            </div>
          )}
        </div>
      </div>

      {/* Workspace Section */}
      <div className="right-sidebar-section">
        <div
          className="right-sidebar-header"
          onClick={() => setWorkspaceExpanded(!workspaceExpanded)}
        >
          <span className="right-sidebar-title">Workspace</span>
          <span className="right-sidebar-toggle">
            {workspaceExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
          </span>
        </div>
        <div className={`right-sidebar-content ${workspaceExpanded ? '' : 'collapsed'}`}>
          <div className="workspace-file">
            <FolderIcon />
            <span>knowledge/</span>
          </div>
          <div className="workspace-file">
            <FolderIcon />
            <span>tools/</span>
          </div>
          <div className="workspace-file">
            <FileIcon />
            <span>CLAUDE.md</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
