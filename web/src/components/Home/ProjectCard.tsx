import type { Project, Terminal } from '../../types';
import { FolderIcon } from '../Icons';

interface ProjectCardProps {
  project: Project;
  activeTerminal?: Terminal;
  taskCount?: number;
  uncommittedCount?: number;
  gitBranch?: string;
  onClick: () => void;
}

export function ProjectCard({
  project,
  activeTerminal,
  taskCount = 0,
  uncommittedCount = 0,
  gitBranch = 'main',
  onClick,
}: ProjectCardProps) {
  // Truncate path for display
  const displayPath = project.path.replace(/^\/Users\/[^/]+/, '~');

  const isRunning = activeTerminal?.status === 'running';

  return (
    <button className="project-card" onClick={onClick}>
      <div className="project-card-top">
        <div className="project-card-icon">
          <FolderIcon />
        </div>
        <div className="project-card-info">
          <span className="project-card-name">{project.name}</span>
          <span className="project-card-path">{displayPath}</span>
        </div>
      </div>
      <div className="project-card-meta">
        <span className="project-stat">{taskCount} tasks</span>
        <span className="project-stat">{uncommittedCount} uncommitted</span>
      </div>
      <div className="project-card-footer">
        {isRunning ? (
          <span className="status-badge active">
            <span className="badge-dot" />
            ghost running
          </span>
        ) : (
          <span className="status-badge">idle</span>
        )}
        <span className="status-badge">{gitBranch}</span>
      </div>
    </button>
  );
}

interface NewProjectCardProps {
  onClick: () => void;
}

export function NewProjectCard({ onClick }: NewProjectCardProps) {
  return (
    <button className="project-card new-project-card" onClick={onClick}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      <span>New Project</span>
    </button>
  );
}
