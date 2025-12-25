import { useState, useEffect } from 'react';
import { CloseIcon } from '../Icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface FileViewerProps {
  agentName: string;
  filePath: string;
  onClose: () => void;
}

export function FileViewer({ agentName, filePath, onClose }: FileViewerProps) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    fetch(`/api/files/${agentName}/${filePath}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load file');
        return res.json();
      })
      .then(data => {
        setContent(data.content);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [agentName, filePath]);

  return (
    <div className="file-viewer-panel">
      <div className="file-viewer-header">
        <div className="file-viewer-path">
          <span className="file-viewer-agent">{agentName}</span>
          <span className="file-viewer-separator">/</span>
          <span className="file-viewer-file">{filePath}</span>
        </div>
        <button className="file-viewer-close" onClick={onClose} aria-label="Close file">
          <CloseIcon />
        </button>
      </div>

      <div className="file-viewer-content">
        {loading && (
          <div className="file-viewer-loading">Loading...</div>
        )}

        {error && (
          <div className="file-viewer-error">{error}</div>
        )}

        {!loading && !error && (
          <div className="markdown-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
