import type { Project, Terminal } from '../../types';
import { ProjectCard } from './ProjectCard';
import { FolderIcon, ChatIcon, PlusIcon, ClockIcon } from '../Icons';

interface HomeProps {
  projects: Project[];
  terminals: Terminal[];
  assistantName: string;
  onProjectSelect: (projectId: string) => void;
  onNewChat: () => void;
  onNewProject: () => void;
  onResumeTerminal: (terminalId: string) => void;
  onSettingsClick: () => void;
}

export function Home({
  projects,
  terminals,
  assistantName,
  onProjectSelect,
  onNewChat,
  onNewProject,
  onResumeTerminal,
  onSettingsClick,
}: HomeProps) {
  // Get running terminals (not dead)
  const activeTerminals = terminals.filter(t => t.status !== 'dead');

  // Sort projects by lastOpenedAt (most recent first)
  const sortedProjects = [...projects].sort(
    (a, b) => new Date(b.lastOpenedAt).getTime() - new Date(a.lastOpenedAt).getTime()
  );

  // Get the most recent non-project terminal for "Resume Chat"
  const lastNonProjectTerminal = activeTerminals
    .filter(t => t.projectId === null)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  return (
    <div className="home-layout">
      <aside className="home-sidebar">
        <div className="home-sidebar-header">
          <span className="home-logo">{assistantName}</span>
        </div>

        <nav className="home-nav">
          <button className="home-nav-item active">
            <span className="home-nav-icon">~</span>
            <span>Home</span>
          </button>
          <button className="home-nav-item" onClick={onSettingsClick}>
            <span className="home-nav-icon">*</span>
            <span>Settings</span>
          </button>
        </nav>
      </aside>

      <main className="home-main">
        <header className="home-header">
          <h1>Welcome back</h1>
          <p className="home-subtitle">What would you like to work on?</p>
        </header>

        <section className="home-quick-actions">
          <button className="quick-action-card" onClick={onNewChat}>
            <div className="quick-action-icon">
              <ChatIcon />
            </div>
            <div className="quick-action-content">
              <span className="quick-action-title">New Chat</span>
              <span className="quick-action-desc">Start a conversation</span>
            </div>
          </button>

          <button className="quick-action-card" onClick={onNewProject}>
            <div className="quick-action-icon">
              <PlusIcon />
            </div>
            <div className="quick-action-content">
              <span className="quick-action-title">Add Project</span>
              <span className="quick-action-desc">Track a directory</span>
            </div>
          </button>

          {lastNonProjectTerminal && (
            <button
              className="quick-action-card"
              onClick={() => onResumeTerminal(lastNonProjectTerminal.id)}
            >
              <div className="quick-action-icon">
                <ClockIcon />
              </div>
              <div className="quick-action-content">
                <span className="quick-action-title">Resume Chat</span>
                <span className="quick-action-desc">Continue last session</span>
              </div>
            </button>
          )}
        </section>

        {sortedProjects.length > 0 && (
          <section className="home-projects">
            <div className="home-section-header">
              <h2>Projects</h2>
              <span className="home-section-count">{projects.length}</span>
            </div>
            <div className="projects-grid">
              {sortedProjects.map(project => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  activeTerminal={activeTerminals.find(t => t.projectId === project.id)}
                  onClick={() => onProjectSelect(project.id)}
                />
              ))}
            </div>
          </section>
        )}

        {sortedProjects.length === 0 && (
          <section className="home-empty">
            <FolderIcon />
            <h3>No projects yet</h3>
            <p>Add a project directory to get started, or just start a chat.</p>
            <button className="home-empty-action" onClick={onNewProject}>
              Add Your First Project
            </button>
          </section>
        )}
      </main>

      {activeTerminals.length > 0 && (
        <aside className="home-right">
          <div className="home-right-header">
            <h3>Active Sessions</h3>
          </div>
          <div className="home-sessions-list">
            {activeTerminals.map(terminal => {
              const project = projects.find(p => p.id === terminal.projectId);
              return (
                <button
                  key={terminal.id}
                  className="home-session-item"
                  onClick={() => onResumeTerminal(terminal.id)}
                >
                  <span className={`home-session-status ${terminal.status}`} />
                  <span className="home-session-name">
                    {project?.name ?? 'General Chat'}
                  </span>
                  <span className="home-session-id">{terminal.id}</span>
                </button>
              );
            })}
          </div>
        </aside>
      )}
    </div>
  );
}
