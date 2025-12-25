import type { TerminalBlock } from '../../types/ui';
import type { Attachment } from '../../types/messages';
import { TerminalOutput } from './TerminalOutput';
import { TerminalInput } from './TerminalInput';
import { TokenDisplay } from '../TokenDisplay';

interface TerminalProps {
  agentName: string;
  blocks: TerminalBlock[];
  onSubmit: (content: string, attachments?: Attachment[]) => void;
  connected: boolean;
  connectionError?: string | null;
  tokenCount: number;
  onCompact: () => void;
}

export function Terminal({ agentName, blocks, onSubmit, connected, connectionError, tokenCount, onCompact }: TerminalProps) {
  return (
    <div className="terminal-panel">
      <div className="terminal-header">
        <span className="terminal-title">{agentName}()</span>
        {connectionError && (
          <span className="terminal-error">{connectionError}</span>
        )}
        <TokenDisplay count={tokenCount} onCompact={onCompact} />
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
