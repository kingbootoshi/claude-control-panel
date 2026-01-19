import { useEffect, useState } from 'react';
import { FolderIcon, FileIcon, ChevronLeftIcon, ChevronRightIcon } from '../Icons';
import { trpc } from '../../trpc';
import type { FileEntry } from '../../types';

interface FilesViewProps {
  projectId?: string;
}

export function FilesView({ projectId }: FilesViewProps) {
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [viewingFile, setViewingFile] = useState<string | null>(null);

  // Use project files if projectId is set, otherwise use workspace files
  const projectFilesQuery = trpc.files.listProject.useQuery(
    { projectId: projectId! },
    { enabled: Boolean(projectId) }
  );

  const workspaceFilesQuery = trpc.files.listWorkspace.useQuery(
    undefined,
    { enabled: !projectId }
  );

  const filesQuery = projectId ? projectFilesQuery : workspaceFilesQuery;

  // Reset state when projectId changes
  useEffect(() => {
    setCurrentPath([]);
    setViewingFile(null);
  }, [projectId]);

  // Get files at current path
  const getCurrentFiles = (): FileEntry[] => {
    let current = filesQuery.data ?? [];
    for (const segment of currentPath) {
      const found = current.find(f => f.name === segment && f.type === 'directory');
      if (found?.children) {
        current = found.children;
      } else {
        return [];
      }
    }
    return current;
  };

  // Check if file is viewable
  const isViewableFile = (name: string) => {
    return name.endsWith('.md') || name.endsWith('.json') || name.endsWith('.txt');
  };

  // Handle file/folder click
  const handleItemClick = (item: FileEntry) => {
    if (item.type === 'directory') {
      setCurrentPath([...currentPath, item.name]);
    } else if (isViewableFile(item.name)) {
      setViewingFile(item.name);
    }
  };

  // Go back in directory
  const handleBack = () => {
    if (viewingFile) {
      setViewingFile(null);
    } else if (currentPath.length > 0) {
      setCurrentPath(currentPath.slice(0, -1));
    }
  };

  // Render breadcrumb
  const renderBreadcrumb = () => {
    const parts = viewingFile
      ? [...currentPath, viewingFile]
      : currentPath;

    const rootName = projectId ?? 'Workspace';

    return (
      <div className="files-breadcrumb">
        <span className="files-breadcrumb-root">{rootName}</span>
        {parts.map((part, i) => (
          <span key={i}>
            <span className="files-breadcrumb-separator">/</span>
            <span className="files-breadcrumb-part">{part}</span>
          </span>
        ))}
      </div>
    );
  };

  // File viewer mode - we need to read the file content
  // For now, show files directly from the tree - actual content reading
  // would require using the files.read endpoint with basePath
  // This is a simplified view for mobile

  // Browser mode
  return (
    <div className="files-view">
      <div className="files-header">
        {(currentPath.length > 0 || viewingFile) && (
          <button className="files-back-btn" onClick={handleBack}>
            <ChevronLeftIcon />
          </button>
        )}
        {renderBreadcrumb()}
      </div>

      {filesQuery.isLoading && (
        <div className="files-loading">Loading files...</div>
      )}

      {filesQuery.error && (
        <div className="files-error">{filesQuery.error.message}</div>
      )}

      {!filesQuery.isLoading && !filesQuery.error && (
        <div className="files-list">
          {getCurrentFiles().length === 0 ? (
            <div className="files-empty">No files in this directory</div>
          ) : (
            getCurrentFiles()
              .sort((a, b) => {
                // Directories first, then files
                if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
                return a.name.localeCompare(b.name);
              })
              .map(item => (
                <button
                  key={item.path}
                  className="file-item"
                  onClick={() => handleItemClick(item)}
                >
                  {item.type === 'directory' ? <FolderIcon /> : <FileIcon />}
                  <span className="file-item-name">{item.name}</span>
                  {item.type === 'directory' && (
                    <span className="file-item-arrow"><ChevronRightIcon /></span>
                  )}
                </button>
              ))
          )}
        </div>
      )}
    </div>
  );
}
