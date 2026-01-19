import type { Project, Terminal } from '../../types';
import { ChatIcon, TerminalIcon, GitBranchIcon, HistoryIcon, ChevronLeftIcon, GearIcon } from '../Icons';
import type { ProjectNavItem } from './Sidebar';

interface ProjectSidebarProps {
  project: Project | null;
  terminal: Terminal | null;
  activeNav: ProjectNavItem;
  onNavClick: (nav: ProjectNavItem) => void;
  onBackClick: () => void;
  onSettingsClick: () => void;
  tokenCount?: number;
  childAgentCount?: number;
}

export function ProjectSidebar({
  project,
  terminal,
  activeNav,
  onNavClick,
  onBackClick,
  onSettingsClick,
  tokenCount = 0,
  childAgentCount = 0,
}: ProjectSidebarProps) {
  const formatTokens = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}m`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count.toString();
  };

  const navItems: { id: ProjectNavItem; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'chat', label: 'Chat', icon: <ChatIcon />, badge: childAgentCount > 0 ? `[${childAgentCount}]` : undefined },
    { id: 'terminal', label: 'Terminal', icon: <TerminalIcon /> },
    { id: 'git', label: 'Git', icon: <GitBranchIcon /> },
    { id: 'history', label: 'History', icon: <HistoryIcon /> },
  ];

  return (
    <>
      {/* Header with back button */}
      <div className="sidebar-header">
        <button
          className="flex items-center gap-2 text-[var(--text-dim)] transition hover:text-[var(--text)]"
          onClick={onBackClick}
          aria-label="Go back to home"
        >
          <ChevronLeftIcon />
          <span className="text-[11px] uppercase tracking-wider">Back</span>
        </button>
      </div>

      {/* Project info */}
      <div className="border-b border-[var(--void-border)] px-3 py-3">
        <div className="text-sm font-medium text-[var(--text)]">
          {project?.name ?? 'General'}
        </div>
        {project?.path && (
          <div className="mt-1 truncate text-[10px] text-[var(--text-muted)]" title={project.path}>
            {project.path}
          </div>
        )}
        {terminal && (
          <div className="mt-2 flex items-center gap-2">
            <span className={`size-2 rounded-full ${
              terminal.status === 'running' ? 'bg-[var(--green)]' :
              terminal.status === 'idle' ? 'bg-[var(--yellow)]' :
              'bg-[var(--text-muted)]'
            }`} />
            <span className="text-[10px] text-[var(--text-dim)]">
              {terminal.status}
            </span>
            {tokenCount > 0 && (
              <span className="ml-auto text-[10px] text-[var(--text-muted)]">
                {formatTokens(tokenCount)} tokens
              </span>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav flex-1">
        {navItems.map(item => (
          <button
            key={item.id}
            className={`nav-item ${activeNav === item.id ? 'active' : ''}`}
            onClick={() => onNavClick(item.id)}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.badge && (
              <span className="ml-auto text-[10px] text-[var(--accent)]">{item.badge}</span>
            )}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-[var(--void-border)] p-3">
        <button
          className="nav-item w-full"
          onClick={onSettingsClick}
        >
          <GearIcon />
          <span>Settings</span>
        </button>
      </div>
    </>
  );
}
