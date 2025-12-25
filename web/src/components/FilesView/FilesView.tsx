import { useState, useEffect } from 'react';
import { FolderIcon, FileIcon, ChevronLeftIcon, ChevronRightIcon } from '../Icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileEntry[];
}

interface FilesViewProps {
  agentName: string;
}

export function FilesView({ agentName }: FilesViewProps) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [viewingFile, setViewingFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch file list
  useEffect(() => {
    async function fetchFiles() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/files/${agentName}`);
        if (!res.ok) {
          throw new Error('Failed to load files');
        }
        const data = await res.json();
        setFiles(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load files');
      } finally {
        setLoading(false);
      }
    }
    fetchFiles();
  }, [agentName]);

  // Get files at current path
  const getCurrentFiles = (): FileEntry[] => {
    let current = files;
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
  const handleItemClick = async (item: FileEntry) => {
    if (item.type === 'directory') {
      setCurrentPath([...currentPath, item.name]);
    } else if (item.name.endsWith('.md')) {
      // Load markdown file
      try {
        const filePath = [...currentPath, item.name].join('/');
        const res = await fetch(`/api/files/${agentName}/${filePath}`);
        if (!res.ok) throw new Error('Failed to load file');
        const data = await res.json();
        setFileContent(data.content);
        setViewingFile(item.name);
      } catch (err) {
        setError('Failed to load file');
      }
    }
  };

  // Go back in directory
  const handleBack = () => {
    if (viewingFile) {
      setViewingFile(null);
      setFileContent('');
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
        <span className="files-breadcrumb-root">{agentName}</span>
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
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{fileContent}</ReactMarkdown>
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

      {loading && (
        <div className="files-loading">Loading files...</div>
      )}

      {error && (
        <div className="files-error">{error}</div>
      )}

      {!loading && !error && (
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
