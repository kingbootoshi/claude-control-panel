import { useState } from 'react';
import type { Project, Terminal, TerminalBlock, Attachment } from '../../types';
import type { ProjectNavItem } from '../Sidebar';
import { trpc } from '../../trpc';
import { ProjectSidebar } from '../Sidebar/ProjectSidebar';
import { Terminal as TerminalComponent } from '../Terminal';
import { TmuxOrchestration } from '../TmuxOrchestration';
import { GitView } from '../GitView';
import { HistoryView } from '../HistoryView';
import { RightSidebar } from '../RightSidebar';
import { AppShell, TopBar, StatusBar } from '../Layout';
import { TabBar } from '../TabBar';
import { WarningBanner } from '../WarningBanner';

const WARNING_THRESHOLD_TOKENS = 102400;

interface ProjectViewProps {
  project: Project | null;
  terminal: Terminal | null;
  terminals: Terminal[];
  projects: Project[];
  blocks: TerminalBlock[];
  tokenCount: number;
  sessionSummary: string | null;
  connected: boolean;
  connectionError: string | null;
  onSubmit: (content: string, attachments?: Attachment[]) => void;
  onCompact: () => void;
  onBack: () => void;
  onSettingsClick: () => void;
  onTerminalSelect: (terminalId: string) => void;
  onNewChat: () => void;
}

export function ProjectView({
  project,
  terminal,
  terminals,
  projects,
  blocks,
  tokenCount,
  sessionSummary,
  connected,
  connectionError,
  onSubmit,
  onCompact,
  onBack,
  onSettingsClick,
  onTerminalSelect,
  onNewChat,
}: ProjectViewProps) {
  const [activeNav, setActiveNav] = useState<ProjectNavItem>('chat');
  const [warningDismissed, setWarningDismissed] = useState(false);
  // viewingFile will be used when FileViewer is integrated
  const [, setViewingFile] = useState<string | null>(null);

  // Get child agents for the current terminal session
  const childAgentsQuery = trpc.sessions.children.useQuery(
    { sessionId: terminal?.id ?? '' },
    { enabled: Boolean(terminal?.id), refetchInterval: 5000 }
  );
  const childAgentCount = childAgentsQuery.data?.length ?? terminal?.childAgents?.length ?? 0;

  // Render main content based on active nav
  const renderMainContent = () => {
    switch (activeNav) {
      case 'terminal':
        return <TmuxOrchestration />;
      case 'git':
        return <GitView projectId={project?.id ?? null} />;
      case 'history':
        return (
          <HistoryView
            projectId={project?.id ?? null}
            onSessionSelect={onTerminalSelect}
          />
        );
      case 'chat':
      default:
        return (
          <main className="main-area">
            <TabBar
              terminals={terminals}
              projects={projects}
              activeTerminalId={terminal?.id ?? null}
              onTabSelect={onTerminalSelect}
              onNewChat={onNewChat}
              tokenCount={tokenCount}
              onCompact={onCompact}
            />

            {!warningDismissed && tokenCount >= WARNING_THRESHOLD_TOKENS && (
              <WarningBanner
                tokenCount={tokenCount}
                onCompact={onCompact}
                onDismiss={() => setWarningDismissed(true)}
              />
            )}

            <TerminalComponent
              blocks={blocks}
              onSubmit={onSubmit}
              connected={connected}
              connectionError={connectionError}
            />
          </main>
        );
    }
  };

  return (
    <AppShell
      topBar={
        <TopBar
          activeTab={project?.name ?? 'General'}
          connected={connected}
          projectCount={projects.length}
        />
      }
      sidebar={
        <aside className="sidebar">
          <ProjectSidebar
            project={project}
            terminal={terminal}
            activeNav={activeNav}
            onNavClick={setActiveNav}
            onBackClick={onBack}
            onSettingsClick={onSettingsClick}
            tokenCount={tokenCount}
            childAgentCount={childAgentCount}
          />
        </aside>
      }
      main={renderMainContent()}
      rightPanel={
        activeNav === 'chat' ? (
          <RightSidebar
            summary={sessionSummary}
            projectId={project?.id ?? null}
            terminalId={terminal?.id ?? null}
            blocks={blocks}
            onFileSelect={setViewingFile}
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
  );
}
