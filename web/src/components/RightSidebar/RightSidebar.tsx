import { useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon, FolderIcon, FileIcon } from '../Icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { trpc } from '../../trpc';
import type { FileEntry } from '../../types';

interface RightSidebarProps {
  summary: string | null;
  agentId: string;
  onFileSelect: (filePath: string) => void;
}

// Recursive component for file tree
function FileTreeItem({
  item,
  depth = 0,
  basePath = '',
  onFileClick,
}: {
  item: FileEntry;
  depth?: number;
  basePath?: string;
  onFileClick: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const fullPath = basePath ? `${basePath}/${item.name}` : item.name;

  if (item.type === 'directory') {
    return (
      <div>
        <div
          className="workspace-file clickable"
          style={{ paddingLeft: `${depth * 12}px` }}
          onClick={() => setExpanded(!expanded)}
        >
          <span className="workspace-file-toggle">
            {expanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
          </span>
          <FolderIcon />
          <span>{item.name}/</span>
        </div>
        {expanded && item.children && (
          <div className="workspace-folder-children">
            {item.children
              .sort((a, b) => {
                if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
                return a.name.localeCompare(b.name);
              })
              .map(child => (
                <FileTreeItem
                  key={`${fullPath}/${child.path}`}
                  item={child}
                  depth={depth + 1}
                  basePath={fullPath}
                  onFileClick={onFileClick}
                />
              ))}
          </div>
        )}
      </div>
    );
  }

  const isViewable = item.name.endsWith('.md') || item.name.endsWith('.json');

  return (
    <div
      className={`workspace-file ${isViewable ? 'clickable' : ''}`}
      style={{ paddingLeft: `${depth * 12 + 16}px` }}
      onClick={() => isViewable && onFileClick(fullPath)}
    >
      <FileIcon />
      <span>{item.name}</span>
    </div>
  );
}

export function RightSidebar({ summary, agentId, onFileSelect }: RightSidebarProps) {
  const [contextExpanded, setContextExpanded] = useState(true);
  const [workspaceExpanded, setWorkspaceExpanded] = useState(true);

  const filesQuery = trpc.files.list.useQuery(
    { agentId },
    { enabled: Boolean(agentId && workspaceExpanded) }
  );

  return (
    <aside className="right-sidebar">
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
          {filesQuery.isLoading ? (
            <div className="workspace-loading">Loading...</div>
          ) : filesQuery.error ? (
            <div className="workspace-empty">Failed to load files</div>
          ) : (filesQuery.data ?? []).length === 0 ? (
            <div className="workspace-empty">No files in workspace</div>
          ) : (
            (filesQuery.data ?? [])
              .sort((a, b) => {
                if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
                return a.name.localeCompare(b.name);
              })
              .map(item => (
                <FileTreeItem
                  key={item.path}
                  item={item}
                  onFileClick={onFileSelect}
                />
              ))
          )}
        </div>
      </div>
    </aside>
  );
}
