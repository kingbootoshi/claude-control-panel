import { useState } from 'react';

interface AddProjectModalProps {
  onSubmit: (name: string) => void;
  onClose: () => void;
  isLoading: boolean;
  error?: string;
}

export function AddProjectModal({ onSubmit, onClose, isLoading, error }: AddProjectModalProps) {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name.trim());
    }
  };

  const canSubmit = name.trim() && !isLoading;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <h2>New Project</h2>

        {error && <div className="modal-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label>
            Project Name
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="My Project"
              autoFocus
            />
          </label>

          <div className="modal-actions">
            <button type="button" className="modal-cancel" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="modal-submit"
              disabled={!canSubmit}
            >
              {isLoading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
