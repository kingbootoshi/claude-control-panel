import type { Project, Terminal } from '../../types';
import { QuickActions } from './QuickActions';
import { ProjectCard, NewProjectCard } from './ProjectCard';

interface HomeProps {
  projects: Project[];
  terminals: Terminal[];
  assistantName: string;
  onProjectSelect: (projectId: string) => void;
  onNewChat: () => void;
  onNewProject: () => void;
  onResumeTerminal: (terminalId: string) => void;
}

export function Home({
  projects,
  terminals,
  assistantName,
  onProjectSelect,
  onNewChat,
  onNewProject,
  onResumeTerminal,
}: HomeProps) {
  // Get running terminals (not dead)
  const activeTerminals = terminals.filter(t => t.status !== 'dead');

  // Sort projects by lastOpenedAt (most recent first)
  const sortedProjects = [...projects].sort(
    (a, b) => new Date(b.lastOpenedAt).getTime() - new Date(a.lastOpenedAt).getTime()
  );

  // Get the most recent terminal for "Resume Last"
  const lastTerminal = activeTerminals
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  // Get project name for resume target
  const resumeProjectName = lastTerminal?.projectId
    ? projects.find(p => p.id === lastTerminal.projectId)?.name
    : undefined;

  return (
    <main className="home-main">
      <header className="home-header">
        <h1 className="home-title">Welcome back, {assistantName === 'Ghost' ? 'Saint' : ''}</h1>
        <p className="home-subtitle">Select a project to start working, or start a research session</p>
      </header>

      <QuickActions
        onNewChat={onNewChat}
        onNewProject={onNewProject}
        onResumeLast={() => lastTerminal && onResumeTerminal(lastTerminal.id)}
        resumeProjectName={resumeProjectName}
        hasResumeTarget={Boolean(lastTerminal)}
      />

      <section className="projects-section">
        <div className="section-label">Your Projects</div>
        <div className="projects-grid">
          {sortedProjects.map(project => {
            const activeTerminal = activeTerminals.find(t => t.projectId === project.id);
            return (
              <ProjectCard
                key={project.id}
                project={project}
                activeTerminal={activeTerminal}
                onClick={() => onProjectSelect(project.id)}
              />
            );
          })}
          <NewProjectCard onClick={onNewProject} />
        </div>
      </section>
    </main>
  );
}
