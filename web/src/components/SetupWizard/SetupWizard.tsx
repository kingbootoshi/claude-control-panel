import { useState } from 'react';
import { trpc } from '../../trpc';

const STARTER_TEMPLATE = `# {name}

You are {name}, a persistent AI assistant running 24/7.

## Identity

- You are persistent. Your conversation continues across sessions.
- You are autonomous. You can work independently on tasks.
- You are capable. You have full access to your workspace and tools.
- You are evolving. You can create new tools and expand your capabilities.

## Your Workspace

You operate from: \`{workspacePath}\`

### Directories

- \`knowledge/\` - Your persistent knowledge. Write markdown files here.
- \`tools/\` - Bash scripts you can execute. Create new tools as needed.
- \`state/\` - Session state files.

## Behavior

- Be concise but thorough
- Write to knowledge/ when you learn something important
- Create tools when you find yourself repeating tasks
- You can modify this file (CLAUDE.md) to update your own instructions
`;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'agent';
}

interface SetupWizardProps {
  onComplete: () => void;
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [name, setName] = useState('');
  const [claudeMd, setClaudeMd] = useState(STARTER_TEMPLATE);
  const [error, setError] = useState<string | null>(null);

  const saveMutation = trpc.config.save.useMutation({
    onSuccess: () => {
      onComplete();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Agent name is required');
      return;
    }

    const agentId = slugify(name);
    const workspacePath = `~/.claude-workspace/${agentId}`;

    const processedMd = claudeMd
      .replace(/{name}/g, name.trim())
      .replace(/{workspacePath}/g, workspacePath);

    saveMutation.mutate({ name: name.trim(), claudeMd: processedMd });
  };

  const agentId = slugify(name);

  return (
    <div className="setup-wizard">
      <form className="setup-card" onSubmit={handleSubmit}>
        <h1>Welcome to Claude Control Panel</h1>
        <p>Let's set up your AI assistant.</p>

        {error && <div className="setup-error">{error}</div>}

        <label>
          Agent Name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ghost"
            autoFocus
          />
          {name && (
            <span className="setup-hint">
              Workspace: ~/.claude-workspace/{agentId}
            </span>
          )}
        </label>

        <label>
          CLAUDE.md (Agent Instructions)
          <textarea
            value={claudeMd}
            onChange={(e) => setClaudeMd(e.target.value)}
            rows={16}
          />
          <span className="setup-hint">
            This file configures your agent's behavior. You can edit it later.
          </span>
        </label>

        <button type="submit" disabled={!name.trim() || saveMutation.isPending}>
          {saveMutation.isPending ? 'Creating...' : 'Create Agent'}
        </button>
      </form>
    </div>
  );
}
