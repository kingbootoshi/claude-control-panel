import { useEffect, useRef } from 'react';
import type { TerminalBlock } from '../../types';
import { MessageBlock } from './MessageBlock';

interface TerminalOutputProps {
  blocks: TerminalBlock[];
}

export function TerminalOutput({ blocks }: TerminalOutputProps) {
  const outputRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [blocks]);

  return (
    <div className="terminal-output" ref={outputRef}>
      {blocks.map(block => (
        <MessageBlock key={block.id} block={block} />
      ))}
    </div>
  );
}
