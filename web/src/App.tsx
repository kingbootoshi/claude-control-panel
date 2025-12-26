import { useState, useEffect, useCallback, useRef } from 'react';
import type { Agent, AgentStatus, Attachment, StreamEventMessage } from './types';
import { useTerminal } from './hooks/useTerminal';
import { trpc } from './trpc';
import { Sidebar } from './components/Sidebar';
import { TabBar } from './components/TabBar';
import { Terminal } from './components/Terminal';
import { WarningBanner } from './components/WarningBanner';
import { RightSidebar } from './components/RightSidebar';
import { FileViewer } from './components/FileViewer';
import { MobileHeader } from './components/MobileHeader';
import { MobileNav, type MobileTab } from './components/MobileNav';
import { QuickMenu } from './components/QuickMenu';
import { FilesView } from './components/FilesView';
import { SetupWizard } from './components/SetupWizard';
import { Settings } from './components/Settings';

const WARNING_THRESHOLD_TOKENS = 102400; // 80% of 128k
const MOBILE_BREAKPOINT = 768;

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
  const [activeAgentId, setActiveAgentId] = useState('');
  const [warningDismissed, setWarningDismissed] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [viewingFile, setViewingFile] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Mobile state
  const isMobile = useIsMobile();
  const [mobileTab, setMobileTab] = useState<'chat' | 'files'>('chat');
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);

  // Config query - determines if setup wizard is needed
  const configQuery = trpc.config.get.useQuery();
  const utils = trpc.useUtils();

  const { blocks, tokenCount, sessionSummary, addUserCommand, handleEvent, applyHistory, clearBlocks } = useTerminal();

  // Use ref to always have latest handleEvent in subscription callback
  const handleEventRef = useRef<(event: StreamEventMessage) => void>(handleEvent);
  useEffect(() => {
    handleEventRef.current = handleEvent;
  }, [handleEvent]);

  const agentsQuery = trpc.agents.list.useQuery();
  const sendMutation = trpc.chat.send.useMutation({
    onError: (error) => setConnectionError(error.message),
  });
  const historyQuery = trpc.history.get.useQuery(
    { agentId: activeAgentId },
    { enabled: Boolean(activeAgentId) }
  );

  const agents: Agent[] = (agentsQuery.data ?? []).map((agent) => ({
    ...agent,
    status: agent.status as AgentStatus,
    isTyping: false,
    currentTool: null,
  }));

  // Reset dismissed state when tokens drop below threshold
  useEffect(() => {
    if (tokenCount < WARNING_THRESHOLD_TOKENS) {
      setWarningDismissed(false);
    }
  }, [tokenCount]);

  useEffect(() => {
    if (agentsQuery.error) {
      setConnectionError(agentsQuery.error.message);
    }
  }, [agentsQuery.error]);

  useEffect(() => {
    if (!agents.length) return;
    if (!activeAgentId || !agents.some((agent) => agent.id === activeAgentId)) {
      setActiveAgentId(agents[0].id);
    }
  }, [agents, activeAgentId]);

  useEffect(() => {
    setViewingFile(null);
  }, [activeAgentId]);

  useEffect(() => {
    if (historyQuery.data) {
      applyHistory(historyQuery.data);
    }
  }, [historyQuery.data, applyHistory]);

  trpc.chat.events.useSubscription(
    { agentId: activeAgentId },
    {
      enabled: Boolean(activeAgentId),
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

  const agentBlocks = blocks.filter(b => b.agentId === activeAgentId);

  // Keyboard shortcuts (desktop only)
  useEffect(() => {
    if (isMobile) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+1-9 - switch tabs
      if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        if (index < agents.length) {
          setActiveAgentId(agents[index].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [agents, activeAgentId, isMobile]);

  const handleSubmit = useCallback((content: string, attachments?: Attachment[]) => {
    if ((!content.trim() && !attachments?.length) || !connected) return;

    // Add to local terminal immediately (with attachments for display)
    addUserCommand(activeAgentId, content, attachments);

    // Send to backend
    sendMutation.mutate({
      agentId: activeAgentId,
      content,
      attachments,
    });
  }, [activeAgentId, connected, sendMutation, addUserCommand]);

  const handleCompact = useCallback(() => {
    sendMutation.mutate({
      agentId: activeAgentId,
      content: '/compact',
    });
  }, [activeAgentId, sendMutation]);

  // Handle mobile tab changes
  const handleMobileTabChange = useCallback((tab: MobileTab) => {
    if (tab === 'menu') {
      setQuickMenuOpen(true);
    } else {
      setMobileTab(tab);
    }
  }, []);

  const activeAgent = agents.find(a => a.id === activeAgentId);

  // Handler for session restart after settings save
  const handleSessionRestart = useCallback(() => {
    // Invalidate all queries to get fresh data
    utils.invalidate();
    // Clear terminal blocks for fresh start
    if (activeAgentId) {
      clearBlocks(activeAgentId);
    }
  }, [utils, clearBlocks, activeAgentId]);

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

  // Mobile layout
  if (isMobile) {
    return (
      <div className="app-layout mobile">
        <MobileHeader
          agentName={activeAgent?.name || 'Agent'}
          status={activeAgent?.status || 'online'}
          tokenCount={tokenCount}
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
            <Terminal
              blocks={agentBlocks}
              onSubmit={handleSubmit}
              connected={connected}
              connectionError={connectionError}
            />
          )}

          {mobileTab === 'files' && activeAgent && (
            <FilesView agentId={activeAgent.id} />
          )}
        </main>

        <MobileNav
          activeTab={mobileTab}
          onTabChange={handleMobileTabChange}
        />

        <QuickMenu
          isOpen={quickMenuOpen}
          onClose={() => setQuickMenuOpen(false)}
          agents={agents}
          activeAgentId={activeAgentId}
          onAgentSelect={setActiveAgentId}
          sessionSummary={sessionSummary}
          tokenCount={tokenCount}
          onCompact={handleCompact}
          onSettingsClick={() => setShowSettings(true)}
        />
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="app-layout">
      <Sidebar
        agents={agents}
        activeAgentId={activeAgentId}
        onAgentSelect={setActiveAgentId}
        onCompact={handleCompact}
        onSettingsClick={() => setShowSettings(true)}
        tokenCount={tokenCount}
      />

      <main className="main-area">
        <TabBar
          agents={agents}
          activeAgentId={activeAgentId}
          onTabSelect={setActiveAgentId}
          tokenCount={tokenCount}
          onCompact={handleCompact}
        />

        {!warningDismissed && (
          <WarningBanner
            tokenCount={tokenCount}
            onCompact={handleCompact}
            onDismiss={() => setWarningDismissed(true)}
          />
        )}

        {viewingFile && activeAgent ? (
          <FileViewer
            agentId={activeAgent.id}
            filePath={viewingFile}
            onClose={() => setViewingFile(null)}
          />
        ) : (
          <Terminal
            blocks={agentBlocks}
            onSubmit={handleSubmit}
            connected={connected}
            connectionError={connectionError}
          />
        )}
      </main>

      {activeAgent && (
        <RightSidebar
          summary={sessionSummary}
          agentId={activeAgent.id}
          onFileSelect={setViewingFile}
        />
      )}
    </div>
  );
}
