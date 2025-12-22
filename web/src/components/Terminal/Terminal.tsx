import type { TerminalBlock } from '../../types/ui';
import { TerminalOutput } from './TerminalOutput';
import { TerminalInput } from './TerminalInput';

interface TerminalProps {
  agentName: string;
  blocks: TerminalBlock[];
  onSubmit: (content: string) => void;
  connected: boolean;
  connectionError?: string | null;
}

export function Terminal({ agentName, blocks, onSubmit, connected, connectionError }: TerminalProps) {
  return (
    <div className="terminal-panel">
      <div className="terminal-header">
        <span className="terminal-title">{agentName}()</span>
        {connectionError && (
          <span className="terminal-error">{connectionError}</span>
        )}
      </div>

      <TerminalOutput blocks={blocks} />

      <TerminalInput
        onSubmit={onSubmit}
        disabled={!connected}
        placeholder={connected ? 'Message Claude...' : 'Connecting...'}
      />
    </div>
  );
}
