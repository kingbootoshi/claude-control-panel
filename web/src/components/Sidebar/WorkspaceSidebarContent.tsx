import type { Project, Terminal } from '../../types';
import { ChatIcon, TasksIcon, FilesIcon, HistoryIcon, GitBranchIcon } from '../Icons';

interface WorkspaceSidebarContentProps {
  project: Project;
  terminal: Terminal | null;
  gitBranch?: string;
  uncommittedCount?: number;
}

export function WorkspaceSidebarContent({
  project,
  terminal,
  gitBranch = 'main',
  uncommittedCount = 0,
}: WorkspaceSidebarContentProps) {
  return (
    <>
      <div className="sidebar-header workspace">
        <div className="workspace-project">
          <span className="workspace-project-name">{project.name}</span>
          <span className="workspace-project-branch">
            <GitBranchIcon />
            {gitBranch}
          </span>
        </div>
      </div>
      <nav className="sidebar-nav">
        <button className="nav-item active">
          <ChatIcon />
          <span>chat</span>
          {terminal?.status === 'running' && (
            <span className="nav-status running" />
          )}
        </button>
        <button className="nav-item">
          <TasksIcon />
          <span>tasks</span>
        </button>
        <button className="nav-item">
          <FilesIcon />
          <span>files</span>
        </button>
        <button className="nav-item">
          <HistoryIcon />
          <span>history</span>
        </button>
        <button className="nav-item">
          <GitBranchIcon />
          <span>git</span>
          {uncommittedCount > 0 && (
            <span className="nav-badge">{uncommittedCount}</span>
          )}
        </button>
      </nav>
    </>
  );
}
