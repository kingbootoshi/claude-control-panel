import type { TerminalBlock } from '../../types';
import { ToolBlock } from './ToolBlock';
import { useState } from 'react';
import { ChevronRightIcon, ChevronDownIcon, FileIcon } from '../Icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MessageBlockProps {
  block: TerminalBlock;
}

function ThinkingBlock({
  content,
  collapsed: initialCollapsed,
  isStreaming,
}: {
  content: string;
  collapsed?: boolean;
  isStreaming?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed ?? !isStreaming);

  return (
    <div className={`thinking-block ${isStreaming ? 'streaming' : ''}`}>
      <div
        className="thinking-header"
        onClick={() => setCollapsed(!collapsed)}
      >
        <span className="thinking-toggle">
          {collapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
        </span>
        {isStreaming && <span className="thinking-indicator" />}
        <span>{isStreaming ? 'Thinking...' : 'Thought process'}</span>
      </div>
      {!collapsed && (
        <div className="thinking-content">
          {content}
          {isStreaming && <span className="cursor-blink">|</span>}
        </div>
      )}
    </div>
  );
}

export function MessageBlock({ block }: MessageBlockProps) {
  switch (block.type) {
    case 'user_command':
      return (
        <div className="message-block user-message">
          <div className="terminal-line command">
            <span className="prompt">$</span> {block.content}
          </div>
          {block.attachments && block.attachments.length > 0 && (
            <div className="attachment-grid">
              {block.attachments.map((att, i) =>
                att.type === 'image' && att.data ? (
                  <img
                    key={i}
                    src={`data:${att.mimeType};base64,${att.data}`}
                    alt={att.name}
                  />
                ) : (
                  <div key={i} className="file-attachment">
                    <FileIcon />
                    <span>{att.name}</span>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      );

    case 'text':
    case 'text_streaming':
      return (
        <div className="message-block assistant-message">
          <div className="terminal-line output markdown-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.content || ''}</ReactMarkdown>
            {block.isStreaming && <span className="cursor-blink">|</span>}
          </div>
        </div>
      );

    case 'tool_use':
      return (
        <div className="message-block tool-message">
          <ToolBlock
            name={block.toolName!}
            input={block.toolInput}
            result={block.toolResult}
            isError={block.toolError}
          />
        </div>
      );

    case 'thinking':
    case 'thinking_streaming':
      return (
        <div className="message-block assistant-message">
          <ThinkingBlock
            content={block.content || ''}
            collapsed={block.collapsed}
            isStreaming={block.isStreaming}
          />
        </div>
      );

    case 'error':
      return (
        <div className="message-block assistant-message">
          <div className="terminal-line error">
            {block.content}
          </div>
        </div>
      );

    case 'system':
      return (
        <div className="message-block system-message">
          <div className="terminal-line dim">
            {block.content}
          </div>
        </div>
      );

    case 'summary':
      return (
        <div className="message-block summary-message">
          <div className="summary-header">
            <span className="summary-label">📋 Previous Session Summary</span>
          </div>
          <div className="summary-content markdown-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.content || ''}</ReactMarkdown>
          </div>
        </div>
      );

    default:
      return null;
  }
}
