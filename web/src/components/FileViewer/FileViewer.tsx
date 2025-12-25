import { CloseIcon } from '../Icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { trpc } from '../../trpc';

interface FileViewerProps {
  agentId: string;
  filePath: string;
  onClose: () => void;
}

function JsonViewer({ content }: { content: string }) {
  try {
    const parsed = JSON.parse(content);
    const formatted = JSON.stringify(parsed, null, 2);
    return (
      <pre className="json-viewer">
        <code>{formatJsonWithColors(formatted)}</code>
      </pre>
    );
  } catch {
    return <pre className="json-viewer"><code>{content}</code></pre>;
  }
}

function formatJsonWithColors(json: string): React.ReactNode[] {
  const lines = json.split('\n');
  return lines.map((line, i) => {
    const colored = line
      .replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:')
      .replace(/: "([^"]*)"/g, ': <span class="json-string">"$1"</span>')
      .replace(/: (\d+\.?\d*)/g, ': <span class="json-number">$1</span>')
      .replace(/: (true|false)/g, ': <span class="json-boolean">$1</span>')
      .replace(/: (null)/g, ': <span class="json-null">$1</span>');
    return (
      <div key={i} dangerouslySetInnerHTML={{ __html: colored }} />
    );
  });
}

export function FileViewer({ agentId, filePath, onClose }: FileViewerProps) {
  const fileQuery = trpc.files.read.useQuery(
    { agentId, path: filePath },
    { enabled: Boolean(agentId && filePath) }
  );

  const isJson = filePath.endsWith('.json');

  return (
    <div className="file-viewer-panel">
      <div className="file-viewer-header">
        <div className="file-viewer-path">
          <span className="file-viewer-agent">{agentId}</span>
          <span className="file-viewer-separator">/</span>
          <span className="file-viewer-file">{filePath}</span>
        </div>
        <button className="file-viewer-close" onClick={onClose} aria-label="Close file">
          <CloseIcon />
        </button>
      </div>

      <div className="file-viewer-content">
        {fileQuery.isLoading && (
          <div className="file-viewer-loading">Loading...</div>
        )}

        {fileQuery.error && (
          <div className="file-viewer-error">{fileQuery.error.message}</div>
        )}

        {!fileQuery.isLoading && !fileQuery.error && (
          isJson ? (
            <JsonViewer content={fileQuery.data?.content || ''} />
          ) : (
            <div className="markdown-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{fileQuery.data?.content || ''}</ReactMarkdown>
            </div>
          )
        )}
      </div>
    </div>
  );
}
