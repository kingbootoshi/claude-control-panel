import { useState, useEffect } from 'react';
import { trpc } from '../../trpc';
import type { CCPConfig } from '../../types';
import { ChevronLeftIcon } from '../Icons';

interface SettingsProps {
  config: CCPConfig;
  onClose: () => void;
  onRestart: () => void;
}

export function Settings({ config, onClose, onRestart }: SettingsProps) {
  const [name, setName] = useState(config.assistantName);
  const [claudeMd, setClaudeMd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Load current CLAUDE.md from workspace
  const claudeMdQuery = trpc.files.read.useQuery(
    { basePath: '', filePath: 'CLAUDE.md' },  // Empty basePath means workspace root
    { retry: false }  // Don't retry if file doesn't exist
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
      // Call onRestart after save
      setTimeout(() => {
        onRestart();
        onClose();
      }, 500);
    },
    onError: (err) => {
      setError(err.message);
      setSaved(false);
    },
  });

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Assistant name is required');
      return;
    }

    await saveMutation.mutateAsync({ name: name.trim(), claudeMd });
  };

  const hasChanges = name !== config.assistantName || claudeMd !== (claudeMdQuery.data?.content ?? '');

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
          <h3>Assistant</h3>
          <label>
            Name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Claude"
            />
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
              placeholder="# Instructions for Claude&#10;&#10;Enter your custom instructions here..."
            />
          )}
        </section>

        <button
          className="settings-save"
          onClick={handleSave}
          disabled={!hasChanges || saveMutation.isPending}
        >
          {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
