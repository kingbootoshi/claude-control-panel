import { useState, useEffect } from 'react';
import { trpc } from '../../trpc';
import type { CCPConfig } from '../../types';
import { ChevronLeftIcon } from '../Icons';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'agent';
}

interface SettingsProps {
  config: CCPConfig;
  onClose: () => void;
  onRestart: () => void;
}

export function Settings({ config, onClose, onRestart }: SettingsProps) {
  const [name, setName] = useState(config.primaryAgent.name);
  const [claudeMd, setClaudeMd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Load current CLAUDE.md
  const claudeMdQuery = trpc.files.read.useQuery(
    { agentId: config.primaryAgent.id, path: 'CLAUDE.md' },
    { enabled: !!config.primaryAgent.id }
  );

  useEffect(() => {
    if (claudeMdQuery.data?.content) {
      setClaudeMd(claudeMdQuery.data.content);
    }
  }, [claudeMdQuery.data]);

  const saveMutation = trpc.config.save.useMutation({
    onSuccess: () => {
      setSaved(true);
      setError(null);
    },
    onError: (err) => {
      setError(err.message);
      setSaved(false);
    },
  });

  const restartMutation = trpc.session.restart.useMutation({
    onSuccess: () => {
      onRestart();
      onClose();
    },
    onError: (err) => {
      setError(`Restart failed: ${err.message}`);
    },
  });

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Agent name is required');
      return;
    }

    await saveMutation.mutateAsync({ name: name.trim(), claudeMd });
    await restartMutation.mutateAsync();
  };

  const hasChanges = name !== config.primaryAgent.name || claudeMd !== (claudeMdQuery.data?.content ?? '');
  const newAgentId = slugify(name);
  const agentIdChanged = newAgentId !== config.primaryAgent.id;

  return (
    <div className="settings-panel">
      <header className="settings-header">
        <button className="settings-back" onClick={onClose} type="button">
          <ChevronLeftIcon />
          <span>Back</span>
        </button>
        <h2>Settings</h2>
      </header>

      <div className="settings-content">
        {error && <div className="settings-error">{error}</div>}
        {saved && !error && <div className="settings-success">Settings saved!</div>}

        <section>
          <h3>Agent</h3>
          <label>
            Name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {agentIdChanged && (
              <span className="settings-warning">
                Workspace will be renamed from {config.primaryAgent.id} to {newAgentId}
              </span>
            )}
          </label>
        </section>

        <section>
          <h3>CLAUDE.md</h3>
          {claudeMdQuery.isLoading ? (
            <div className="settings-loading">Loading...</div>
          ) : (
            <textarea
              value={claudeMd}
              onChange={(e) => setClaudeMd(e.target.value)}
              rows={20}
            />
          )}
        </section>

        <button
          className="settings-save"
          onClick={handleSave}
          disabled={!hasChanges || saveMutation.isPending || restartMutation.isPending}
        >
          {saveMutation.isPending || restartMutation.isPending
            ? 'Saving & Restarting...'
            : 'Save & Restart Session'}
        </button>
      </div>
    </div>
  );
}
