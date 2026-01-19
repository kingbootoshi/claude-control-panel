import { useState, useEffect, useCallback, useRef } from 'react';
import type { Attachment, Project, Terminal, StreamEventMessage } from './types';
import { useTerminal } from './hooks/useTerminal';
import { useVisualViewport } from './hooks/useVisualViewport';
import { trpc } from './trpc';
import { Home } from './components/Home';
import { Sidebar, type NavItem } from './components/Sidebar';
import { Terminal as TerminalComponent } from './components/Terminal';
import { WarningBanner } from './components/WarningBanner';
import { MobileHeader } from './components/MobileHeader';
import { MobileNav, type MobileTab } from './components/MobileNav';
import { QuickMenu } from './components/QuickMenu';
import { FilesView } from './components/FilesView';
import { SetupWizard } from './components/SetupWizard';
import { Settings } from './components/Settings';
import { AddProjectModal } from './components/AddProjectModal';
import { AppShell, TopBar, StatusBar } from './components/Layout';
import { RightPanel } from './components/RightPanel';
import { ProjectsView } from './components/ProjectsView';
import { ProjectView } from './components/ProjectView';
// SPEC-v2: TmuxOrchestration and CodexDashboard moved to project-scoped Terminal view
// import { TmuxOrchestration } from './components/TmuxOrchestration';
// import { CodexDashboard } from './components/CodexDashboard';

const WARNING_THRESHOLD_TOKENS = 102400; // 80% of 128k
const MOBILE_BREAKPOINT = 768;

// SPEC-v2: Simplified view structure
// - home: dashboard with recent projects and active sessions
// - projects: full-screen project list
// - project: project view with chat/terminal/git/history tabs
type View = 'home' | 'projects' | 'project';

// Hook to detect mobile viewport
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
}

export default function App() {
  // Initialize visual viewport handling for mobile keyboard
  useVisualViewport();

  // View state
  const [view, setView] = useState<View>('home');
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // UI state
  const [warningDismissed, setWarningDismissed] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);
  // viewingFile moved to ProjectView component

  // Mobile state
  const isMobile = useIsMobile();
  const [mobileTab, setMobileTab] = useState<'chat' | 'files'>('chat');
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);

  // Config query - determines if setup wizard is needed
  const configQuery = trpc.config.get.useQuery();
  const utils = trpc.useUtils();

  // Projects and terminals queries
  const projectsQuery = trpc.projects.list.useQuery();
  const terminalsQuery = trpc.terminals.list.useQuery(undefined, {
    refetchInterval: 5000, // Poll for terminal status changes
  });

  // Mutations
  const spawnTerminalMutation = trpc.terminals.spawn.useMutation({
    onSuccess: (data) => {
      console.log('Terminal spawned:', data.terminalId);
      setActiveTerminalId(data.terminalId);
      setView('project');
      utils.terminals.list.invalidate();
    },
    onError: (error) => {
      console.error('Failed to spawn terminal:', error.message);
      setConnectionError(error.message);
    },
  });

  const sendMutation = trpc.terminals.send.useMutation({
    onError: (error) => setConnectionError(error.message),
  });

  const createProjectMutation = trpc.projects.create.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
      setShowAddProject(false);
    },
  });

  const resumeTerminalMutation = trpc.terminals.resume.useMutation({
    onSuccess: () => {
      utils.terminals.list.invalidate();
    },
    onError: (error) => setConnectionError(error.message),
  });

  // killTerminalMutation moved to ProjectView

  const { blocks, tokenCount, sessionSummary, addUserCommand, handleEvent, applyHistory, clearBlocks } = useTerminal();

  // Use ref to always have latest handleEvent in subscription callback
  const handleEventRef = useRef<(event: StreamEventMessage) => void>(handleEvent);
  useEffect(() => {
    handleEventRef.current = handleEvent;
  }, [handleEvent]);

  // History query - load when terminal changes
  const historyQuery = trpc.history.getByTerminal.useQuery(
    { terminalId: activeTerminalId! },
    { enabled: Boolean(activeTerminalId) }
  );

  const projects: Project[] = projectsQuery.data ?? [];
  const terminals: Terminal[] = terminalsQuery.data ?? [];

  // Get active terminal
  const activeTerminal = terminals.find(t => t.id === activeTerminalId);

  // Reset dismissed state when tokens drop below threshold
  useEffect(() => {
    if (tokenCount < WARNING_THRESHOLD_TOKENS) {
      setWarningDismissed(false);
    }
  }, [tokenCount]);

  // Apply history when it loads
  useEffect(() => {
    if (historyQuery.data) {
      applyHistory(historyQuery.data);
    }
  }, [historyQuery.data, applyHistory]);

  // File viewer state moved to ProjectView

  // Subscribe to terminal events
  trpc.terminals.events.useSubscription(
    { terminalId: activeTerminalId! },
    {
      enabled: Boolean(activeTerminalId),
      onStarted: () => {
        setConnected(true);
        setConnectionError(null);
      },
      onError: (error) => {
        setConnected(false);
        setConnectionError(error.message);
      },
      onData: (event) => {
        handleEventRef.current(event);
      },
      onComplete: () => {
        setConnected(false);
      },
    }
  );

  // Filter blocks by active terminal
  const terminalBlocks = blocks.filter(b => b.terminalId === activeTerminalId);

  // Keyboard shortcuts (desktop only)
  useEffect(() => {
    if (isMobile) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape - go back to home from project view
      if (e.key === 'Escape' && view === 'project') {
        setView('home');
        setActiveTerminalId(null);
        setActiveProjectId(null);
      }
      // Escape from projects list goes to home
      if (e.key === 'Escape' && view === 'projects') {
        setView('home');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, isMobile]);

  // Handlers
  const handleNewChat = useCallback(() => {
    console.log('handleNewChat called, spawning terminal...');
    spawnTerminalMutation.mutate({ projectId: null });
  }, [spawnTerminalMutation]);

  const handleProjectSelect = useCallback((projectId: string) => {
    // Check if there's an existing terminal for this project
    const existingTerminal = terminals.find(
      t => t.projectId === projectId && t.status !== 'dead'
    );

    if (existingTerminal) {
      // Resume existing terminal
      setActiveTerminalId(existingTerminal.id);
      setActiveProjectId(projectId);
      setView('project');
    } else {
      // Spawn new terminal for project
      setActiveProjectId(projectId);
      spawnTerminalMutation.mutate({ projectId });
    }
  }, [terminals, spawnTerminalMutation]);

  const handleResumeTerminal = useCallback((terminalId: string) => {
    const terminal = terminals.find(t => t.id === terminalId);
    if (!terminal && terminalId === 'ghost') {
      setActiveTerminalId(terminalId);
      setActiveProjectId(null);
      setView('project');
      return;
    }
    if (terminal) {
      // If terminal is closed, resume it first
      if (terminal.status === 'closed') {
        resumeTerminalMutation.mutate({ terminalId });
      }
      setActiveTerminalId(terminalId);
      setActiveProjectId(terminal.projectId);
      setView('project');
    }
  }, [terminals, resumeTerminalMutation]);

  // handleCloseTerminal moved to ProjectView

  const handleSubmit = useCallback((content: string, attachments?: Attachment[]) => {
    if ((!content.trim() && !attachments?.length) || !connected || !activeTerminalId) return;

    // Add to local terminal immediately (with attachments for display)
    addUserCommand(activeTerminalId, content, attachments);

    // Send to backend
    sendMutation.mutate({
      terminalId: activeTerminalId,
      content,
      attachments,
    });
  }, [activeTerminalId, connected, sendMutation, addUserCommand]);

  const handleCompact = useCallback(() => {
    if (!activeTerminalId) return;
    sendMutation.mutate({
      terminalId: activeTerminalId,
      content: '/compact',
    });
  }, [activeTerminalId, sendMutation]);

  // Handle mobile tab changes
  const handleMobileTabChange = useCallback((tab: MobileTab) => {
    if (tab === 'menu') {
      setQuickMenuOpen(true);
    } else {
      setMobileTab(tab);
    }
  }, []);

  // Handler for session restart after settings save
  const handleSessionRestart = useCallback(() => {
    // Invalidate all queries to get fresh data
    utils.invalidate();
    // Clear terminal blocks for fresh start
    if (activeTerminalId) {
      clearBlocks(activeTerminalId);
    }
  }, [utils, clearBlocks, activeTerminalId]);

  const handleAddProject = useCallback((name: string) => {
    createProjectMutation.mutate({ name });
  }, [createProjectMutation]);

  const handleGoHome = useCallback(() => {
    setView('home');
    setActiveTerminalId(null);
    setActiveProjectId(null);
  }, []);

  // Navigation handler for sidebar nav items (home sidebar)
  const handleNavClick = useCallback((nav: NavItem) => {
    switch (nav) {
      case 'home':
        setView('home');
        setActiveTerminalId(null);
        setActiveProjectId(null);
        break;
      case 'projects':
        setView('projects');
        break;
      case 'settings':
        setShowSettings(true);
        break;
      default:
        break;
    }
  }, []);

  // Get active nav item based on current view
  const getActiveNav = (): NavItem => {
    switch (view) {
      case 'home': return 'home';
      case 'projects': return 'projects';
      case 'project': return 'home'; // When in project, home is not active but we default to it
      default: return 'home';
    }
  };

  // Get assistant name from config
  const assistantName = configQuery.data?.assistantName ?? 'Claude';

  // Show loading while checking config
  if (configQuery.isLoading) {
    return (
      <div className="setup-wizard">
        <div className="setup-card">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // No config = show setup wizard
  if (!configQuery.data) {
    return (
      <SetupWizard
        onComplete={() => {
          configQuery.refetch();
          utils.invalidate();
        }}
      />
    );
  }

  // Show settings panel (works for both mobile and desktop)
  if (showSettings) {
    return (
      <Settings
        config={configQuery.data}
        onClose={() => setShowSettings(false)}
        onRestart={handleSessionRestart}
      />
    );
  }

  // Get active project info
  const activeProject = projects.find(p => p.id === activeProjectId);

  // Helper to get main content based on view (for home/projects views)
  const getHomeContent = () => {
    switch (view) {
      case 'projects':
        return (
          <ProjectsView
            projects={projects}
            terminals={terminals}
            onProjectSelect={handleProjectSelect}
            onNewProject={() => setShowAddProject(true)}
            onBack={handleGoHome}
          />
        );
      case 'home':
      default:
        return (
          <Home
            projects={projects}
            terminals={terminals}
            assistantName={assistantName}
            onProjectSelect={handleProjectSelect}
            onNewChat={handleNewChat}
            onNewProject={() => setShowAddProject(true)}
            onResumeTerminal={handleResumeTerminal}
          />
        );
    }
  };

  // Home/Projects views - Global layout with home sidebar
  if ((view === 'home' || view === 'projects') && !isMobile) {
    return (
      <>
        <AppShell
          topBar={
            <TopBar
              activeTab={view}
              connected={true}
              projectCount={projects.length}
            />
          }
          sidebar={
            <Sidebar
              mode="home"
              projectCount={projects.length}
              activeNav={getActiveNav()}
              onNavClick={handleNavClick}
              onSettingsClick={() => setShowSettings(true)}
            />
          }
          main={getHomeContent()}
          rightPanel={
            view === 'home' ? (
              <RightPanel
                mode="home"
                terminals={terminals}
                projects={projects}
                onSessionClick={handleResumeTerminal}
              />
            ) : undefined
          }
          statusBar={
            <StatusBar
              version="v0.1.0"
              projectCount={projects.length}
              agentCount={terminals.filter(t => t.status === 'running').length}
            />
          }
        />
        {showAddProject && (
          <AddProjectModal
            onSubmit={handleAddProject}
            onClose={() => setShowAddProject(false)}
            isLoading={createProjectMutation.isPending}
            error={createProjectMutation.error?.message}
          />
        )}
      </>
    );
  }

  // Mobile home view - simplified layout
  if (view === 'home' && isMobile) {
    return (
      <>
        <div className="app-shell mobile">
          <Home
            projects={projects}
            terminals={terminals}
            assistantName={assistantName}
            onProjectSelect={handleProjectSelect}
            onNewChat={handleNewChat}
            onNewProject={() => setShowAddProject(true)}
            onResumeTerminal={handleResumeTerminal}
          />
        </div>
        {showAddProject && (
          <AddProjectModal
            onSubmit={handleAddProject}
            onClose={() => setShowAddProject(false)}
            isLoading={createProjectMutation.isPending}
            error={createProjectMutation.error?.message}
          />
        )}
      </>
    );
  }

  // Mobile chat layout
  if (isMobile) {
    return (
      <div className="app-layout mobile">
        <MobileHeader
          agentName={activeProject?.name ?? assistantName}
          status={activeTerminal?.status ?? 'idle'}
          tokenCount={tokenCount}
          onBack={handleGoHome}
        />

        {!warningDismissed && (
          <WarningBanner
            tokenCount={tokenCount}
            onCompact={handleCompact}
            onDismiss={() => setWarningDismissed(true)}
          />
        )}

        <main className="main-area mobile">
          {mobileTab === 'chat' && (
            <TerminalComponent
              blocks={terminalBlocks}
              onSubmit={handleSubmit}
              connected={connected}
              connectionError={connectionError}
            />
          )}

          {mobileTab === 'files' && activeProjectId && (
            <FilesView projectId={activeProjectId} />
          )}

          {mobileTab === 'files' && !activeProjectId && (
            <FilesView />
          )}
        </main>

        <MobileNav
          activeTab={mobileTab}
          onTabChange={handleMobileTabChange}
        />

        <QuickMenu
          isOpen={quickMenuOpen}
          onClose={() => setQuickMenuOpen(false)}
          terminals={terminals}
          projects={projects}
          activeTerminalId={activeTerminalId}
          onTerminalSelect={handleResumeTerminal}
          sessionSummary={sessionSummary}
          tokenCount={tokenCount}
          onCompact={handleCompact}
          onSettingsClick={() => setShowSettings(true)}
          onHomeClick={handleGoHome}
        />
      </div>
    );
  }

  // Desktop project view - use new ProjectView component
  return (
    <ProjectView
      project={activeProject ?? null}
      terminal={activeTerminal ?? null}
      terminals={terminals}
      projects={projects}
      blocks={terminalBlocks}
      tokenCount={tokenCount}
      sessionSummary={sessionSummary}
      connected={connected}
      connectionError={connectionError}
      onSubmit={handleSubmit}
      onCompact={handleCompact}
      onBack={handleGoHome}
      onSettingsClick={() => setShowSettings(true)}
      onTerminalSelect={handleResumeTerminal}
      onNewChat={handleNewChat}
    />
  );
}
