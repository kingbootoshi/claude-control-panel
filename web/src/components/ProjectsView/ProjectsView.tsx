import type { Project, Terminal } from '../../types';
import { FolderIcon, PlusIcon, ArrowLeftIcon } from '../Icons';

interface ProjectsViewProps {
  projects: Project[];
  terminals: Terminal[];
  onProjectSelect: (projectId: string) => void;
  onNewProject: () => void;
  onBack: () => void;
}

export function ProjectsView({
  projects,
  terminals,
  onProjectSelect,
  onNewProject,
  onBack,
}: ProjectsViewProps) {
  // Sort projects by lastOpenedAt (most recent first)
  const sortedProjects = [...projects].sort(
    (a, b) => new Date(b.lastOpenedAt).getTime() - new Date(a.lastOpenedAt).getTime()
  );

  // Get active terminals count per project
  const getActiveSessionCount = (projectId: string) => {
    return terminals.filter(t => t.projectId === projectId && t.status !== 'dead').length;
  };

  // Format date relative to now
  const formatLastOpened = (date: string) => {
    const now = new Date();
    const opened = new Date(date);
    const diffMs = now.getTime() - opened.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return opened.toLocaleDateString();
  };

  return (
    <div className="flex h-full flex-col bg-[var(--void-bg)]">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-[var(--void-border)] px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex size-8 items-center justify-center rounded border border-[var(--void-border)] bg-[var(--void-surface)] text-[var(--text-dim)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
            aria-label="Go back"
          >
            <ArrowLeftIcon />
          </button>
          <div>
            <h1 className="text-lg font-medium text-[var(--text)]">Projects</h1>
            <p className="text-xs text-[var(--text-muted)]">{projects.length} total</p>
          </div>
        </div>
        <button
          onClick={onNewProject}
          className="flex items-center gap-2 rounded border border-[var(--accent)] bg-[var(--accent)]/10 px-3 py-1.5 text-xs text-[var(--accent)] transition hover:bg-[var(--accent)]/20"
        >
          <PlusIcon />
          <span>New Project</span>
        </button>
      </header>

      {/* Project List */}
      <div className="flex-1 overflow-y-auto p-6">
        {sortedProjects.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-[var(--void-surface)]">
              <FolderIcon />
            </div>
            <h2 className="mb-2 text-base font-medium text-[var(--text)]">No projects yet</h2>
            <p className="mb-4 text-sm text-[var(--text-muted)]">
              Create your first project to get started
            </p>
            <button
              onClick={onNewProject}
              className="flex items-center gap-2 rounded border border-[var(--accent)] bg-[var(--accent)]/10 px-4 py-2 text-sm text-[var(--accent)] transition hover:bg-[var(--accent)]/20"
            >
              <PlusIcon />
              <span>New Project</span>
            </button>
          </div>
        ) : (
          <div className="grid gap-3">
            {sortedProjects.map(project => {
              const sessionCount = getActiveSessionCount(project.id);
              const hasActiveSessions = sessionCount > 0;

              return (
                <button
                  key={project.id}
                  onClick={() => onProjectSelect(project.id)}
                  className="group flex items-center gap-4 rounded-lg border border-[var(--void-border)] bg-[var(--void-surface)] p-4 text-left transition hover:border-[var(--accent-dim)]"
                >
                  {/* Icon */}
                  <div className="flex size-10 shrink-0 items-center justify-center rounded bg-[var(--void-elevated)] text-[var(--text-dim)] transition group-hover:text-[var(--accent)]">
                    <FolderIcon />
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-[var(--text)]">
                        {project.name}
                      </span>
                      {hasActiveSessions && (
                        <span className="shrink-0 rounded bg-[var(--accent)]/10 px-1.5 py-0.5 text-[10px] text-[var(--accent)]">
                          {sessionCount} active
                        </span>
                      )}
                    </div>
                    <div className="mt-1 truncate text-xs text-[var(--text-muted)]">
                      {project.path}
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="shrink-0 text-right">
                    <div className="text-xs text-[var(--text-dim)]">
                      {formatLastOpened(project.lastOpenedAt)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
