import { HomeIcon, FolderIcon, GearIcon } from '../Icons';

// SPEC-v2: Global sidebar only has home, projects, settings
// Orchestration and codex moved to project-scoped Terminal view
export type HomeNavItem = 'home' | 'projects' | 'settings';

interface HomeSidebarContentProps {
  projectCount: number;
  activeNav?: HomeNavItem;
  onNavClick?: (nav: HomeNavItem) => void;
  onSettingsClick: () => void;
}

export function HomeSidebarContent({
  projectCount,
  activeNav = 'home',
  onNavClick,
  onSettingsClick,
}: HomeSidebarContentProps) {
  const handleNav = (nav: HomeNavItem) => {
    if (nav === 'settings') {
      onSettingsClick();
    } else if (onNavClick) {
      onNavClick(nav);
    }
  };

  return (
    <>
      <div className="sidebar-header">
        <span className="sidebar-header-label">Control Panel</span>
      </div>
      <nav className="sidebar-nav">
        <button
          className={`nav-item ${activeNav === 'home' ? 'active' : ''}`}
          onClick={() => handleNav('home')}
        >
          <HomeIcon />
          <span>home</span>
        </button>
        <button
          className={`nav-item ${activeNav === 'projects' ? 'active' : ''}`}
          onClick={() => handleNav('projects')}
        >
          <FolderIcon />
          <span>projects</span>
          <span className="nav-badge">{projectCount}</span>
        </button>
        <div className="nav-divider" />
        <button
          className={`nav-item ${activeNav === 'settings' ? 'active' : ''}`}
          onClick={() => handleNav('settings')}
        >
          <GearIcon />
          <span>settings</span>
        </button>
      </nav>
    </>
  );
}
