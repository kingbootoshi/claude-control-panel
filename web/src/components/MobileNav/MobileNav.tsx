import { ChatIcon, FolderIcon, MoreHorizontalIcon } from '../Icons';

export type MobileTab = 'chat' | 'files' | 'menu';

interface MobileNavProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
}

export function MobileNav({ activeTab, onTabChange }: MobileNavProps) {
  return (
    <nav className="mobile-nav">
      <button
        className={`mobile-nav-item ${activeTab === 'chat' ? 'active' : ''}`}
        onClick={() => onTabChange('chat')}
        aria-label="Chat"
      >
        <ChatIcon />
        <span className="mobile-nav-label">Chat</span>
      </button>

      <button
        className={`mobile-nav-item ${activeTab === 'files' ? 'active' : ''}`}
        onClick={() => onTabChange('files')}
        aria-label="Files"
      >
        <FolderIcon />
        <span className="mobile-nav-label">Files</span>
      </button>

      <button
        className={`mobile-nav-item ${activeTab === 'menu' ? 'active' : ''}`}
        onClick={() => onTabChange('menu')}
        aria-label="Menu"
      >
        <MoreHorizontalIcon />
        <span className="mobile-nav-label">More</span>
      </button>
    </nav>
  );
}
