import { useState, useEffect, useCallback } from 'react';
import type { Agent } from './types/agents';
import type { Attachment } from './types/messages';
import { useWebSocket } from './hooks/useWebSocket';
import { useTerminal } from './hooks/useTerminal';
import { Sidebar } from './components/Sidebar';
import { TabBar } from './components/TabBar';
import { Terminal } from './components/Terminal';
import { WarningBanner } from './components/WarningBanner';
import { RightSidebar } from './components/RightSidebar';
import { MobileHeader } from './components/MobileHeader';
import { MobileNav, type MobileTab } from './components/MobileNav';
import { QuickMenu } from './components/QuickMenu';
import { FilesView } from './components/FilesView';

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
  const [agents, setAgents] = useState<Agent[]>([
    {
      id: 'ghost',
      name: 'Ghost',
      status: 'online',
      sessionId: null,
      isTyping: false,
      currentTool: null,
    },
  ]);

  const [activeAgentId, setActiveAgentId] = useState('ghost');
  const [warningDismissed, setWarningDismissed] = useState(false);

  // Mobile state
  const isMobile = useIsMobile();
  const [mobileTab, setMobileTab] = useState<'chat' | 'files'>('chat');
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);

  const { blocks, tokenCount, sessionSummary, addUserCommand, handleServerMessage, clearBlocks } = useTerminal();
  const { connected, send, connectionError } = useWebSocket(handleServerMessage);

  // Reset dismissed state when tokens drop below threshold
  useEffect(() => {
    if (tokenCount < WARNING_THRESHOLD_TOKENS) {
      setWarningDismissed(false);
    }
  }, [tokenCount]);

  const agentBlocks = blocks.filter(b => b.agentId === activeAgentId);

  // Keyboard shortcuts (desktop only)
  useEffect(() => {
    if (isMobile) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+N or Cmd+N - new agent
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        addNewAgent();
      }
      // Ctrl+1-9 - switch tabs
      if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        if (index < agents.length) {
          setActiveAgentId(agents[index].id);
        }
      }
      // Ctrl+Tab - cycle tabs
      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault();
        const currentIndex = agents.findIndex(a => a.id === activeAgentId);
        const nextIndex = (currentIndex + 1) % agents.length;
        setActiveAgentId(agents[nextIndex].id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [agents, activeAgentId, isMobile]);

  const addNewAgent = useCallback(() => {
    const newAgent: Agent = {
      id: crypto.randomUUID(),
      name: `agent-${agents.length + 1}`,
      status: 'online',
      sessionId: null,
      isTyping: false,
      currentTool: null,
    };
    setAgents(prev => [...prev, newAgent]);
    setActiveAgentId(newAgent.id);
  }, [agents.length]);

  const closeAgent = useCallback((id: string) => {
    if (agents.length <= 1) return;
    setAgents(prev => prev.filter(a => a.id !== id));
    if (activeAgentId === id) {
      setActiveAgentId(agents[0].id === id ? agents[1].id : agents[0].id);
    }
    clearBlocks(id);
  }, [agents, activeAgentId, clearBlocks]);

  const handleSubmit = useCallback((content: string, attachments?: Attachment[]) => {
    if ((!content.trim() && !attachments?.length) || !connected) return;

    // Add to local terminal immediately (with attachments for display)
    addUserCommand(activeAgentId, content, attachments);

    // Send to backend
    send({
      type: 'user_message',
      agentId: activeAgentId,
      content,
      attachments,
    });
  }, [activeAgentId, connected, send, addUserCommand]);

  const handleCompact = useCallback(() => {
    send({
      type: 'user_message',
      agentId: activeAgentId,
      content: '/compact',
    });
  }, [activeAgentId, send]);

  // Handle mobile tab changes
  const handleMobileTabChange = useCallback((tab: MobileTab) => {
    if (tab === 'menu') {
      setQuickMenuOpen(true);
    } else {
      setMobileTab(tab);
    }
  }, []);

  const activeAgent = agents.find(a => a.id === activeAgentId);

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

          {mobileTab === 'files' && (
            <FilesView agentName={activeAgent?.name || 'Ghost'} />
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
        tokenCount={tokenCount}
      />

      <main className="main-area">
        <TabBar
          agents={agents}
          activeAgentId={activeAgentId}
          onTabSelect={setActiveAgentId}
          onTabClose={closeAgent}
          onNewTab={addNewAgent}
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

        <Terminal
          blocks={agentBlocks}
          onSubmit={handleSubmit}
          connected={connected}
          connectionError={connectionError}
        />
      </main>

      <RightSidebar summary={sessionSummary} />
    </div>
  );
}
