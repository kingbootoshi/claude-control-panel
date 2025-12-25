import type { TerminalBlock } from '../../types/ui';
import type { Attachment } from '../../types/messages';
import { TerminalOutput } from './TerminalOutput';
import { TerminalInput } from './TerminalInput';

interface TerminalProps {
  blocks: TerminalBlock[];
  onSubmit: (content: string, attachments?: Attachment[]) => void;
  connected: boolean;
  connectionError?: string | null;
}

export function Terminal({ blocks, onSubmit, connected, connectionError }: TerminalProps) {
  return (
    <div className="terminal-panel">
      {connectionError && (
        <div className="terminal-error-banner">{connectionError}</div>
      )}

      <TerminalOutput blocks={blocks} />

      <TerminalInput
        onSubmit={onSubmit}
        disabled={!connected}
        placeholder={connected ? 'Message Claude...' : 'Connecting...'}
      />
    </div>
  );
}
