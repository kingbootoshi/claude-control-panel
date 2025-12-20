import { useState, useRef, useEffect, useCallback } from 'react';

// Types
interface Agent {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'busy';
  messages: Message[];
}

interface Message {
  id: string;
  type: 'command' | 'output' | 'warning' | 'error' | 'dim';
  content: string;
  indent?: boolean;
}

interface Config {
  agentName: string;
  workspacePath: string;
}

// Icons
const FolderIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
  </svg>
);

const FileIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <path d="M14 2v6h6" />
  </svg>
);

const CloseIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

// Main App
export default function App() {
  const [config] = useState<Config>({
    agentName: 'Ghost', // Will be loaded from server
    workspacePath: '~/claude-workspace',
  });

  const [agents, setAgents] = useState<Agent[]>([
    {
      id: '1',
      name: config.agentName,
      status: 'online',
      messages: [
        { id: '1', type: 'output', content: `${config.agentName} Control Panel v1.0` },
        { id: '2', type: 'dim', content: 'Type a command to begin...' },
      ],
    },
  ]);

  const [activeAgentId, setActiveAgentId] = useState('1');
  const [connected, setConnected] = useState(false);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const activeAgent = agents.find(a => a.id === activeAgentId);

  // Focus input on load and tab switch
  useEffect(() => {
    inputRef.current?.focus();
  }, [activeAgentId]);

  // Auto-scroll
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [activeAgent?.messages]);

  // Keyboard shortcuts
  useEffect(() => {
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
  }, [agents, activeAgentId]);

  // WebSocket connection
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleServerMessage(data);
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    };

    return () => ws.close();
  }, []);

  const handleServerMessage = useCallback((data: { type: string; content?: string }) => {
    if (data.type === 'text' && data.content) {
      addMessage(activeAgentId, 'output', data.content);
    } else if (data.type === 'error' && data.content) {
      addMessage(activeAgentId, 'error', data.content);
    }
  }, [activeAgentId]);

  const addMessage = (agentId: string, type: Message['type'], content: string, indent?: boolean) => {
    setAgents(prev => prev.map(agent => {
      if (agent.id === agentId) {
        return {
          ...agent,
          messages: [...agent.messages, {
            id: crypto.randomUUID(),
            type,
            content,
            indent,
          }],
        };
      }
      return agent;
    }));
  };

  const addNewAgent = () => {
    const newAgent: Agent = {
      id: crypto.randomUUID(),
      name: `agent-${agents.length + 1}`,
      status: 'online',
      messages: [
        { id: '1', type: 'output', content: `New agent instance created` },
        { id: '2', type: 'dim', content: 'Ready for commands...' },
      ],
    };
    setAgents(prev => [...prev, newAgent]);
    setActiveAgentId(newAgent.id);
  };

  const closeAgent = (id: string) => {
    if (agents.length <= 1) return; // Keep at least one
    setAgents(prev => prev.filter(a => a.id !== id));
    if (activeAgentId === id) {
      setActiveAgentId(agents[0].id === id ? agents[1].id : agents[0].id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Add command to messages
    addMessage(activeAgentId, 'command', `$ ${input}`);

    // TODO: Send to server via WebSocket
    // For now, mock response
    setTimeout(() => {
      addMessage(activeAgentId, 'output', 'Processing command...');
    }, 100);

    setInput('');
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <span>□</span>
            <span>CONTROL PANEL</span>
          </div>
        </div>

        {/* Agents section */}
        <div className="sidebar-section">
          <div className="sidebar-section-title">Agents</div>
          {agents.map(agent => (
            <div
              key={agent.id}
              className={`sidebar-item ${activeAgentId === agent.id ? 'active' : ''}`}
              onClick={() => setActiveAgentId(agent.id)}
            >
              <span>{agent.id === '1' ? '◇' : '○'}</span>
              <span>{agent.name}</span>
              <span className={`status-dot ${agent.status}`} />
            </div>
          ))}
        </div>

        {/* Workspace section */}
        <div className="sidebar-section">
          <div className="sidebar-section-title">Workspace</div>
          <div className="sidebar-item">
            <FolderIcon />
            <span>knowledge/</span>
          </div>
          <div className="sidebar-item">
            <FolderIcon />
            <span>tools/</span>
          </div>
          <div className="sidebar-item">
            <FileIcon />
            <span>CLAUDE.md</span>
          </div>
        </div>

        {/* Resources section */}
        <div className="sidebar-section" style={{ marginTop: 'auto' }}>
          <div className="sidebar-section-title">Resources</div>
          <div className="resource-item">
            <span className="icon">💰</span>
            <span className="value">$0.00 today</span>
          </div>
          <div className="resource-item">
            <span className="icon">🧠</span>
            <span className="value">0/200k tokens</span>
          </div>
          <div className="resource-item">
            <span className="icon">⚡</span>
            <span className="value">{agents.length} agents</span>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <main className="main-area">
        {/* Tab bar */}
        <div className="tab-bar">
          {agents.map(agent => (
            <div
              key={agent.id}
              className={`tab ${activeAgentId === agent.id ? 'active' : ''}`}
              onClick={() => setActiveAgentId(agent.id)}
            >
              <span>{agent.name}</span>
              {agents.length > 1 && (
                <span
                  className="tab-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeAgent(agent.id);
                  }}
                >
                  <CloseIcon />
                </span>
              )}
            </div>
          ))}
          <div className="new-tab-btn" onClick={addNewAgent}>
            <PlusIcon />
          </div>
          <div className="tab-bar-hint">
            Ctrl+N
          </div>
        </div>

        {/* Terminal panel */}
        <div className="terminal-panel">
          {/* Terminal header */}
          <div className="terminal-header">
            <div className="traffic-lights">
              <div className="traffic-light red" />
              <div className="traffic-light yellow" />
              <div className="traffic-light green" />
            </div>
            <span className="terminal-title">{activeAgent?.name}()</span>
            <div className="terminal-actions">
              <button className="terminal-action">
                OPEN →
              </button>
            </div>
          </div>

          {/* Terminal output */}
          <div className="terminal-output" ref={outputRef}>
            {activeAgent?.messages.map(msg => (
              <div key={msg.id} className={`terminal-line ${msg.type}`}>
                {msg.indent ? <span className="indent">└ </span> : null}
                {msg.content}
              </div>
            ))}
          </div>

          {/* Terminal input */}
          <div className="terminal-input-area">
            <form onSubmit={handleSubmit} className="terminal-input-row">
              <span className="terminal-prompt">$</span>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={connected ? '_' : 'Connecting...'}
                className="terminal-input"
                disabled={!connected}
                autoComplete="off"
                spellCheck={false}
              />
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
