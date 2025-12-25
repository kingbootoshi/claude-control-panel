import { useEffect, useState } from 'react';
import { FolderIcon, FileIcon, ChevronLeftIcon, ChevronRightIcon } from '../Icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { trpc } from '../../trpc';
import type { FileEntry } from '../../types';

interface FilesViewProps {
  agentId: string;
}

export function FilesView({ agentId }: FilesViewProps) {
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [viewingFile, setViewingFile] = useState<string | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);

  const filesQuery = trpc.files.list.useQuery({ agentId }, { enabled: Boolean(agentId) });
  const fileQuery = trpc.files.read.useQuery(
    { agentId, path: selectedFilePath || '' },
    { enabled: Boolean(agentId && selectedFilePath) }
  );

  useEffect(() => {
    setCurrentPath([]);
    setViewingFile(null);
    setSelectedFilePath(null);
  }, [agentId]);

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

  // Handle file/folder click
  const handleItemClick = (item: FileEntry) => {
    if (item.type === 'directory') {
      setCurrentPath([...currentPath, item.name]);
    } else if (item.name.endsWith('.md')) {
      const filePath = [...currentPath, item.name].join('/');
      setSelectedFilePath(filePath);
      setViewingFile(item.name);
    }
  };

  // Go back in directory
  const handleBack = () => {
    if (viewingFile) {
      setViewingFile(null);
      setSelectedFilePath(null);
    } else if (currentPath.length > 0) {
      setCurrentPath(currentPath.slice(0, -1));
    }
  };

  // Render breadcrumb
  const renderBreadcrumb = () => {
    const parts = viewingFile
      ? [...currentPath, viewingFile]
      : currentPath;

    return (
      <div className="files-breadcrumb">
        <span className="files-breadcrumb-root">{agentId}</span>
        {parts.map((part, i) => (
          <span key={i}>
            <span className="files-breadcrumb-separator">/</span>
            <span className="files-breadcrumb-part">{part}</span>
          </span>
        ))}
      </div>
    );
  };

  // File viewer mode
  if (viewingFile) {
    return (
      <div className="files-view">
        <div className="files-header">
          <button className="files-back-btn" onClick={handleBack}>
            <ChevronLeftIcon />
          </button>
          {renderBreadcrumb()}
        </div>
        <div className="file-viewer">
          <div className="markdown-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{fileQuery.data?.content || ''}</ReactMarkdown>
          </div>
        </div>
      </div>
    );
  }

  // Browser mode
  return (
    <div className="files-view">
      <div className="files-header">
        {currentPath.length > 0 && (
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
