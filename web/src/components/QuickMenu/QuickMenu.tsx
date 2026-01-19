import { useState } from 'react';
import type { Project, Terminal } from '../../types';
import { CompactIcon, ChevronDownIcon, ChevronRightIcon, GearIcon, HomeIcon } from '../Icons';
import { trpc } from '../../trpc';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface QuickMenuProps {
  isOpen: boolean;
  onClose: () => void;
  terminals: Terminal[];
  projects: Project[];
  activeTerminalId: string | null;
  onTerminalSelect: (id: string) => void;
  sessionSummary: string | null;
  tokenCount: number;
  onCompact: () => void;
  onSettingsClick: () => void;
  onHomeClick: () => void;
}

export function QuickMenu({
  isOpen,
  onClose,
  terminals,
  projects,
  activeTerminalId,
  onTerminalSelect,
  sessionSummary,
  tokenCount,
  onCompact,
  onSettingsClick,
  onHomeClick,
}: QuickMenuProps) {
  const [contextExpanded, setContextExpanded] = useState(false);
  const utils = trpc.useUtils();
  const ghostQuery = trpc.ghost.get.useQuery(undefined, { refetchInterval: 5000 });

  const formatTokens = (count: number) => {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count.toString();
  };

  const handleCompact = () => {
    onCompact();
    onClose();
  };

  const handleTerminalSelect = (id: string) => {
    onTerminalSelect(id);
    onClose();
  };

  const handleHomeClick = () => {
    onHomeClick();
    onClose();
  };

  const ghostStartMutation = trpc.ghost.start.useMutation({
    onSuccess: ({ terminalId }) => {
      utils.terminals.list.invalidate();
      handleTerminalSelect(terminalId);
    },
  });

  const handleGhostStart = () => {
    ghostStartMutation.mutate();
  };

  // Get active (non-dead) terminals, excluding ghost
  const activeTerminals = terminals.filter(t => t.status !== 'dead' && t.id !== 'ghost');

  const ghostTerminal = terminals.find(t => t.id === 'ghost') ?? null;
  const ghostExists = Boolean(ghostTerminal) || ghostQuery.data?.exists === true;
  const ghostStatus = ghostQuery.data && 'status' in ghostQuery.data
    ? ghostQuery.data.status
    : ghostTerminal?.status;
  const isGhostActive = activeTerminalId === 'ghost';

  // Helper to get display name for terminal
  const getTerminalName = (terminal: Terminal) => {
    if (terminal.projectId) {
      const project = projects.find(p => p.id === terminal.projectId);
      return project?.name ?? terminal.projectId;
    }
    if (terminal.id === 'ghost') return 'Ghost';
    return 'General Chat';
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={`quick-menu-overlay ${isOpen ? 'open' : ''}`}
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <div className={`quick-menu ${isOpen ? 'open' : ''}`}>
        {/* Drag handle */}
        <div className="quick-menu-handle" />

        {/* Sessions Section */}
        <div className="quick-menu-section">
          <div className="quick-menu-section-title">SESSIONS</div>
          <button
            className={`quick-menu-item ${isGhostActive ? 'active' : ''}`}
            onClick={handleGhostStart}
            disabled={ghostStartMutation.isPending}
          >
            <span className="quick-menu-item-icon"><HomeIcon /></span>
            <span className="quick-menu-item-label">Ghost</span>
            {ghostExists ? (
              <span className={`quick-menu-status ${ghostStatus ?? 'idle'}`} />
            ) : (
              <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-200">
                Start
              </span>
            )}
          </button>
          {activeTerminals.map(terminal => (
            <button
              key={terminal.id}
              className={`quick-menu-item ${terminal.id === activeTerminalId ? 'active' : ''}`}
              onClick={() => handleTerminalSelect(terminal.id)}
            >
              <span className="quick-menu-item-icon">{terminal.projectId ? '~' : '>'}</span>
              <span className="quick-menu-item-label">{getTerminalName(terminal)}</span>
              <span className={`quick-menu-status ${terminal.status}`} />
            </button>
          ))}
        </div>

        {/* Context Section */}
        <div className="quick-menu-section">
          <button
            className="quick-menu-section-header"
            onClick={() => setContextExpanded(!contextExpanded)}
          >
            <span className="quick-menu-section-title">SESSION CONTEXT</span>
            <span className="quick-menu-toggle">
              {contextExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
            </span>
          </button>
          {contextExpanded && (
            <div className="quick-menu-context">
              {sessionSummary ? (
                <div className="context-summary markdown-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{sessionSummary}</ReactMarkdown>
                </div>
              ) : (
                <div className="context-empty">No session context available.</div>
              )}
            </div>
          )}
        </div>

        {/* Actions Section */}
        <div className="quick-menu-section">
          <div className="quick-menu-section-title">ACTIONS</div>

          <button className="quick-menu-item" onClick={handleHomeClick}>
            <span className="quick-menu-item-icon"><HomeIcon /></span>
            <span className="quick-menu-item-label">Home</span>
          </button>

          <button className="quick-menu-item" onClick={handleCompact} disabled={!activeTerminalId}>
            <span className="quick-menu-item-icon"><CompactIcon /></span>
            <span className="quick-menu-item-label">Compact Session</span>
            <span className="quick-menu-item-badge">{formatTokens(tokenCount)}</span>
          </button>

          <button className="quick-menu-item" onClick={() => { onSettingsClick(); onClose(); }}>
            <span className="quick-menu-item-icon"><GearIcon /></span>
            <span className="quick-menu-item-label">Settings</span>
          </button>
        </div>
      </div>
    </>
  );
}
