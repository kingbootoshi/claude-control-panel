import { ChatIcon, FolderIcon, ClockIcon } from '../Icons';

interface QuickActionsProps {
  onNewChat: () => void;
  onNewProject: () => void;
  onResumeLast: () => void;
  resumeProjectName?: string;
  hasResumeTarget: boolean;
}

export function QuickActions({
  onNewChat,
  onNewProject,
  onResumeLast,
  resumeProjectName,
  hasResumeTarget,
}: QuickActionsProps) {
  return (
    <section className="quick-actions-section">
      <div className="section-label">Quick Actions</div>
      <div className="quick-actions">
        <button className="quick-action" onClick={onNewChat}>
          <div className="quick-action-icon">
            <ChatIcon />
          </div>
          <div className="quick-action-text">
            <span className="quick-action-title">New Chat</span>
            <span className="quick-action-desc">Start a conversation</span>
          </div>
        </button>

        <button className="quick-action" onClick={onNewProject}>
          <div className="quick-action-icon">
            <FolderIcon />
          </div>
          <div className="quick-action-text">
            <span className="quick-action-title">New Project</span>
            <span className="quick-action-desc">Create or import a new project</span>
          </div>
        </button>

        {hasResumeTarget && (
          <button className="quick-action" onClick={onResumeLast}>
            <div className="quick-action-icon">
              <ClockIcon />
            </div>
            <div className="quick-action-text">
              <span className="quick-action-title">Resume Last</span>
              <span className="quick-action-desc">
                Continue {resumeProjectName ?? 'previous'} session
              </span>
            </div>
          </button>
        )}
      </div>
    </section>
  );
}
