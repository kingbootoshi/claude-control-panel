import { useState } from 'react';
import type { Agent } from '../../types';
import { CompactIcon, ChevronDownIcon, ChevronRightIcon, GearIcon, PlusIcon } from '../Icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface QuickMenuProps {
  isOpen: boolean;
  onClose: () => void;
  agents: Agent[];
  activeAgentId: string;
  onAgentSelect: (id: string) => void;
  sessionSummary: string | null;
  tokenCount: number;
  onCompact: () => void;
  onSettingsClick: () => void;
}

export function QuickMenu({
  isOpen,
  onClose,
  agents,
  activeAgentId,
  onAgentSelect,
  sessionSummary,
  tokenCount,
  onCompact,
  onSettingsClick,
}: QuickMenuProps) {
  const [contextExpanded, setContextExpanded] = useState(false);

  const formatTokens = (count: number) => {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count.toString();
  };

  const handleCompact = () => {
    onCompact();
    onClose();
  };

  const handleAgentSelect = (id: string) => {
    onAgentSelect(id);
    onClose();
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

        {/* Agents Section */}
        <div className="quick-menu-section">
          <div className="quick-menu-section-title">AGENTS</div>
          {agents.map(agent => (
            <button
              key={agent.id}
              className={`quick-menu-item ${agent.id === activeAgentId ? 'active' : ''}`}
              onClick={() => handleAgentSelect(agent.id)}
            >
              <span className="quick-menu-item-icon">◆</span>
              <span className="quick-menu-item-label">{agent.name}</span>
              <span className={`quick-menu-status ${agent.status}`} />
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

          <button className="quick-menu-item" onClick={handleCompact}>
            <span className="quick-menu-item-icon"><CompactIcon /></span>
            <span className="quick-menu-item-label">Compact Session</span>
            <span className="quick-menu-item-badge">{formatTokens(tokenCount)}</span>
          </button>

          <button className="quick-menu-item" disabled>
            <span className="quick-menu-item-icon"><PlusIcon /></span>
            <span className="quick-menu-item-label">New Chat</span>
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
