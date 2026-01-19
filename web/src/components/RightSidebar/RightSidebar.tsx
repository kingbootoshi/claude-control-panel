import { useState, useMemo } from 'react';
import { ChevronDownIcon, ChevronRightIcon, FolderIcon, FileIcon } from '../Icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { trpc } from '../../trpc';
import { SessionMetrics } from '../SessionMetrics';
import type { FileEntry, TerminalBlock } from '../../types';

type FileChangeType = 'read' | 'modified' | 'created';

interface FileChange {
  path: string;
  type: FileChangeType;
  count: number;
}

interface RightSidebarProps {
  summary: string | null;
  projectId: string | null;
  terminalId: string | null;
  blocks?: TerminalBlock[];
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

// Extract file changes from tool_use blocks
function extractFileChanges(blocks: TerminalBlock[]): FileChange[] {
  const fileMap = new Map<string, { type: FileChangeType; count: number }>();

  for (const block of blocks) {
    if (block.type !== 'tool_use' || !block.toolName || !block.toolInput) continue;

    const input = block.toolInput as Record<string, unknown>;
    let filePath: string | undefined;
    let changeType: FileChangeType | undefined;

    // Detect file operations from tool names
    switch (block.toolName) {
      case 'Read':
        filePath = input.file_path as string | undefined;
        changeType = 'read';
        break;
      case 'Edit':
        filePath = input.file_path as string | undefined;
        changeType = 'modified';
        break;
      case 'Write':
        filePath = input.file_path as string | undefined;
        changeType = 'created';
        break;
      case 'Bash':
        // Could parse bash commands for file ops, but skip for now
        break;
    }

    if (filePath && changeType) {
      const existing = fileMap.get(filePath);
      if (existing) {
        // Upgrade type: read -> modified -> created takes precedence
        const priority: Record<FileChangeType, number> = { read: 0, modified: 1, created: 2 };
        if (priority[changeType] > priority[existing.type]) {
          existing.type = changeType;
        }
        existing.count++;
      } else {
        fileMap.set(filePath, { type: changeType, count: 1 });
      }
    }
  }

  return Array.from(fileMap.entries())
    .map(([path, data]) => ({ path, ...data }))
    .sort((a, b) => {
      // Sort by type (created, modified, read) then by path
      const typePriority: Record<FileChangeType, number> = { created: 0, modified: 1, read: 2 };
      const typeDiff = typePriority[a.type] - typePriority[b.type];
      if (typeDiff !== 0) return typeDiff;
      return a.path.localeCompare(b.path);
    });
}

export function RightSidebar({ summary, projectId, terminalId, blocks = [], onFileSelect }: RightSidebarProps) {
  const [contextExpanded, setContextExpanded] = useState(true);
  const [changesExpanded, setChangesExpanded] = useState(true);
  const [workspaceExpanded, setWorkspaceExpanded] = useState(true);

  // Extract file changes from current session blocks
  const fileChanges = useMemo(() => extractFileChanges(blocks), [blocks]);

  // Use project files if projectId is set, otherwise use workspace files
  const projectFilesQuery = trpc.files.listProject.useQuery(
    { projectId: projectId! },
    { enabled: Boolean(projectId && workspaceExpanded) }
  );

  const workspaceFilesQuery = trpc.files.listWorkspace.useQuery(
    undefined,
    { enabled: Boolean(!projectId && workspaceExpanded) }
  );

  const filesQuery = projectId ? projectFilesQuery : workspaceFilesQuery;
  const sectionTitle = projectId ? 'Project Files' : 'Workspace';

  return (
    <aside className="right-sidebar">
      {terminalId && (
        <div className="border-b border-void-border p-4">
          <SessionMetrics terminalId={terminalId} />
        </div>
      )}
      {/* Session Changes Section */}
      {fileChanges.length > 0 && (
        <div className="right-sidebar-section">
          <div
            className="right-sidebar-header"
            onClick={() => setChangesExpanded(!changesExpanded)}
          >
            <span className="right-sidebar-title">
              Session Changes
              <span className="changes-count">({fileChanges.length})</span>
            </span>
            <span className="right-sidebar-toggle">
              {changesExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
            </span>
          </div>
          <div className={`right-sidebar-content ${changesExpanded ? '' : 'collapsed'}`}>
            <div className="session-changes">
              {fileChanges.map(change => (
                <div
                  key={change.path}
                  className={`change-item change-${change.type}`}
                  onClick={() => onFileSelect(change.path)}
                >
                  <span className={`change-indicator ${change.type}`} />
                  <span className="change-path" title={change.path}>
                    {change.path.split('/').pop()}
                  </span>
                  {change.count > 1 && (
                    <span className="change-count">{change.count}x</span>
                  )}
                </div>
              ))}
            </div>
          </div>
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

      {/* Workspace/Project Section */}
      <div className="right-sidebar-section">
        <div
          className="right-sidebar-header"
          onClick={() => setWorkspaceExpanded(!workspaceExpanded)}
        >
          <span className="right-sidebar-title">{sectionTitle}</span>
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
            <div className="workspace-empty">No files</div>
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
