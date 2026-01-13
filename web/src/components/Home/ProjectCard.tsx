import type { Project, Terminal } from '../../types';
import { FolderIcon } from '../Icons';

interface ProjectCardProps {
  project: Project;
  activeTerminal?: Terminal;
  onClick: () => void;
}

export function ProjectCard({ project, activeTerminal, onClick }: ProjectCardProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        return diffMins <= 1 ? 'Just now' : `${diffMins}m ago`;
      }
      return `${diffHours}h ago`;
    }
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Truncate path for display
  const displayPath = project.path.replace(/^\/Users\/[^/]+/, '~');

  return (
    <button className="project-card" onClick={onClick}>
      <div className="project-card-icon">
        <FolderIcon />
      </div>
      <div className="project-card-content">
        <div className="project-card-header">
          <span className="project-card-name">{project.name}</span>
          {activeTerminal && (
            <span className={`project-card-status ${activeTerminal.status}`} />
          )}
        </div>
        <span className="project-card-path">{displayPath}</span>
        <span className="project-card-meta">
          Last opened {formatDate(project.lastOpenedAt)}
        </span>
      </div>
    </button>
  );
}
