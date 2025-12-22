import type { TerminalBlock } from '../../types/ui';
import { ToolBlock } from './ToolBlock';
import { useState } from 'react';
import { ChevronRightIcon, ChevronDownIcon } from '../Icons';

interface MessageBlockProps {
  block: TerminalBlock;
}

function ThinkingBlock({ content, collapsed: initialCollapsed }: { content: string; collapsed?: boolean }) {
  const [collapsed, setCollapsed] = useState(initialCollapsed ?? true);

  return (
    <div className="thinking-block">
      <div
        className="thinking-header"
        onClick={() => setCollapsed(!collapsed)}
      >
        <span className="thinking-toggle">
          {collapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
        </span>
        <span>Thinking...</span>
      </div>
      {!collapsed && (
        <div className="thinking-content">
          {content}
        </div>
      )}
    </div>
  );
}

export function MessageBlock({ block }: MessageBlockProps) {
  switch (block.type) {
    case 'user_command':
      return (
        <div className="terminal-line command">
          <span className="prompt">$</span> {block.content}
        </div>
      );

    case 'text':
    case 'text_streaming':
      return (
        <div className="terminal-line output">
          {block.content}
          {block.isStreaming && <span className="cursor-blink">|</span>}
        </div>
      );

    case 'tool_use':
      return (
        <ToolBlock
          name={block.toolName!}
          input={block.toolInput}
          result={block.toolResult}
          isError={block.toolError}
        />
      );

    case 'thinking':
      return (
        <ThinkingBlock
          content={block.content!}
          collapsed={block.collapsed}
        />
      );

    case 'error':
      return (
        <div className="terminal-line error">
          {block.content}
        </div>
      );

    case 'system':
      return (
        <div className="terminal-line dim">
          {block.content}
        </div>
      );

    default:
      return null;
  }
}
