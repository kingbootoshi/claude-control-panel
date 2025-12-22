import { useState } from 'react';
import { ChevronRightIcon, ChevronDownIcon, CheckIcon, LoadingIcon, ErrorIcon } from '../Icons';

interface ToolBlockProps {
  name: string;
  input: unknown;
  result?: string;
  isError?: boolean;
}

export function ToolBlock({ name, input, result, isError }: ToolBlockProps) {
  const [expanded, setExpanded] = useState(false);

  const isComplete = result !== undefined;

  return (
    <div className={`tool-block ${isError ? 'error' : ''}`}>
      <div
        className="tool-header"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="tool-icon">
          {isError ? <ErrorIcon /> : isComplete ? <CheckIcon /> : <LoadingIcon />}
        </span>
        <span className="tool-name">{name}</span>
        <span className="tool-toggle">
          {expanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
        </span>
      </div>

      {expanded && (
        <div className="tool-details">
          <div className="tool-input">
            <div className="tool-label">Input</div>
            <pre>{JSON.stringify(input, null, 2)}</pre>
          </div>
          {result && (
            <div className="tool-output">
              <div className="tool-label">Output</div>
              <pre>{result}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
