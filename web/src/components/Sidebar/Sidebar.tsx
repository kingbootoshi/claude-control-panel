import type { Project, Terminal } from '../../types';
import { HomeSidebarContent, type HomeNavItem } from './HomeSidebarContent';
import { WorkspaceSidebarContent } from './WorkspaceSidebarContent';
import { ChatSidebarContent } from './ChatSidebarContent';

// SPEC-v2: Two sidebar modes - home (global) and project (project-scoped)
// 'workspace' and 'chat' modes merged into 'project' mode
export type SidebarMode = 'home' | 'workspace' | 'chat' | 'project';

// Global nav items (home sidebar only)
export type NavItem = HomeNavItem;

// Project nav items (project sidebar) - will be used by ProjectSidebar
export type ProjectNavItem = 'chat' | 'terminal' | 'git' | 'history';

interface SidebarProps {
  mode: SidebarMode;
  // Home mode props
  projectCount?: number;
  activeNav?: NavItem;
  onNavClick?: (nav: NavItem) => void;
  // Workspace mode props
  project?: Project | null;
  terminal?: Terminal | null;
  gitBranch?: string;
  uncommittedCount?: number;
  // Chat mode props
  terminals?: Terminal[];
  projects?: Project[];
  activeTerminalId?: string | null;
  onTerminalSelect?: (id: string) => void;
  onTerminalClose?: (id: string) => void;
  tokenCount?: number;
  // Shared props
  onCompact?: () => void;
  onSettingsClick: () => void;
  onHomeClick?: () => void;
}

export function Sidebar({
  mode,
  projectCount = 0,
  activeNav = 'home',
  onNavClick,
  project,
  terminal,
  gitBranch,
  uncommittedCount,
  terminals = [],
  projects = [],
  activeTerminalId,
  onTerminalSelect,
  onTerminalClose,
  tokenCount = 0,
  onCompact,
  onSettingsClick,
  onHomeClick,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      {mode === 'home' && (
        <HomeSidebarContent
          projectCount={projectCount}
          activeNav={activeNav}
          onNavClick={onNavClick}
          onSettingsClick={onSettingsClick}
        />
      )}
      {mode === 'workspace' && project && (
        <WorkspaceSidebarContent
          project={project}
          terminal={terminal ?? null}
          gitBranch={gitBranch}
          uncommittedCount={uncommittedCount}
        />
      )}
      {mode === 'chat' && (
        <ChatSidebarContent
          terminals={terminals}
          projects={projects}
          activeTerminalId={activeTerminalId ?? null}
          onTerminalSelect={onTerminalSelect ?? (() => {})}
          onTerminalClose={onTerminalClose ?? (() => {})}
          onCompact={onCompact ?? (() => {})}
          onSettingsClick={onSettingsClick}
          onHomeClick={onHomeClick ?? (() => {})}
          tokenCount={tokenCount}
        />
      )}
    </aside>
  );
}
