# Ghost Platform PRD

## Ultimate Vision: Command Center

Picture a Starcraft-style command center for AI agents. You're the commander. Ghost is your lieutenant. Child agents are units you deploy for missions.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  GHOST COMMAND CENTER                                        ⚡ Connected       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────────┐  │
│  │  👻 GHOST (Master)              │  │  ACTIVE AGENTS                      │  │
│  │  ════════════════════════════   │  │  ═══════════════════════════════    │  │
│  │  Status: Idle                   │  │                                     │  │
│  │  Context: 42k/128k tokens       │  │  📰 news-scout     ● Running        │  │
│  │  Session: 3d 14h uptime         │  │     "Monitoring AI news feeds"      │  │
│  │  Last: "Spawned news-scout"     │  │     Progress: ████████░░ 80%        │  │
│  │                                 │  │     Runtime: 2h 34m                 │  │
│  │  [Quick Actions]                │  │                                     │  │
│  │  • Summarize today              │  │  🔬 code-experimenter  ○ Sleeping   │  │
│  │  • Check all agents             │  │     "Testing prompt variations"     │  │
│  │  • Review memories              │  │     Next wake: 6h 12m               │  │
│  │                                 │  │                                     │  │
│  │                                 │  │  📝 story-builder    ● Running      │  │
│  │                                 │  │     "Expanding world bible ch.3"    │  │
│  │                                 │  │     Progress: ██░░░░░░░░ 20%        │  │
│  │                                 │  │                                     │  │
│  └─────────────────────────────────┘  └─────────────────────────────────────┘  │
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  CHAT                                                                    │  │
│  │  ════════════════════════════════════════════════════════════════════    │  │
│  │                                                                          │  │
│  │  You: How's news-scout doing?                                            │  │
│  │                                                                          │  │
│  │  Ghost: news-scout has found 12 articles in the last 2 hours.            │  │
│  │  3 are high-relevance to your interests:                                 │  │
│  │    • "Claude 4.5 Released" - Anthropic blog                              │  │
│  │    • "Agent SDK patterns" - Simon Willison                               │  │
│  │    • "Memory architectures for LLMs" - arXiv                             │  │
│  │                                                                          │  │
│  │  Want me to have news-scout write detailed summaries?                    │  │
│  │                                                                          │  │
│  │  ┌────────────────────────────────────────────────────────────────────┐  │  │
│  │  │ Yes, summarize all 3 and save to knowledge/                        │  │  │
│  │  └────────────────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────────┐  │
│  │  TOOLS (12 available)           │  │  KNOWLEDGE BASE                     │  │
│  │  ═══════════════════════        │  │  ═══════════════════════════════    │  │
│  │  • axia-query                   │  │  📁 knowledge/                      │  │
│  │  • axia-store                   │  │     ├── projects/                   │  │
│  │  • spawn-agent                  │  │     │   ├── ghost-platform.md       │  │
│  │  • ping-agent                   │  │     │   └── axia-records.md         │  │
│  │  • kill-agent                   │  │     ├── research/                   │  │
│  │  • schedule-wake                │  │     │   └── agent-patterns.md       │  │
│  │  • notify-saint                 │  │     └── daily/                      │  │
│  │  • web-fetch                    │  │         └── 2025-01-15.md           │  │
│  │  + 4 more...                    │  │                                     │  │
│  └─────────────────────────────────┘  └─────────────────────────────────────┘  │
│                                                                                 │
│  [+ Spawn Agent]  [⏰ Schedules]  [📊 Metrics]  [⚙️ Settings]                   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Core Concepts

**Ghost** is the master agent. Always running. Knows everything. Manages all other agents. Has his own workspace, knowledge base, and tools. You talk to Ghost; Ghost talks to everyone else.

**Child Agents** are specialists Ghost spawns for specific missions. They have their own workspaces, their own context windows, their own tasks. They report back to Ghost when done or when they need help.

**Tools** are bash scripts in a shared registry. Ghost can use them, child agents can use them, and Ghost can create new ones. No MCP complexity - just executable scripts with documented interfaces.

**Knowledge** is markdown files in Ghost's workspace. Projects, research, daily logs, agent outputs. Everything is files. Ghost reads and writes them. So can child agents if given access.

**Axia** is long-term memory. Ghost queries it via tools when he needs historical context. He syncs important things to it for permanent storage. It's external to the conversation - Ghost decides when to pull from it.

**Heartbeat** is scheduled wake-ups. Agents can sleep and request to be woken at specific times or on specific triggers. Ghost manages the schedule. A cron-like system prompts agents when their time comes.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Mac Mini (24/7)                                │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                          ghost-daemon                                 │  │
│  │                                                                       │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │  │
│  │  │   Express   │  │   Session   │  │   Agent     │  │  Scheduler  │   │  │
│  │  │   Server    │  │   Manager   │  │   Manager   │  │             │   │  │
│  │  │             │  │             │  │             │  │             │   │  │
│  │  │  WebSocket  │  │  Ghost SDK  │  │  Child SDK  │  │  Cron jobs  │   │  │
│  │  │  REST API   │  │  Session    │  │  Sessions   │  │  Wake queue │   │  │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘   │  │
│  │         │                │                │                │          │  │
│  │         └────────────────┴────────────────┴────────────────┘          │  │
│  │                                   │                                   │  │
│  └───────────────────────────────────┼───────────────────────────────────┘  │
│                                      │                                      │
│  ┌───────────────────────────────────┼───────────────────────────────────┐  │
│  │                            File System                                │  │
│  │                                                                       │  │
│  │  ghost-workspace/                                                     │  │
│  │  ├── CLAUDE.md              # Ghost's identity and instructions       │  │
│  │  ├── knowledge/             # Persistent knowledge files              │  │
│  │  │   ├── projects/          # Project documentation                   │  │
│  │  │   ├── research/          # Research notes                          │  │
│  │  │   └── daily/             # Daily logs                              │  │
│  │  ├── tools/                 # Bash tool scripts                       │  │
│  │  │   ├── axia-query         # Query Axia memories                     │  │
│  │  │   ├── axia-store         # Store to Axia                           │  │
│  │  │   ├── spawn-agent        # Create child agent                      │  │
│  │  │   ├── ping-agent         # Send message to agent                   │  │
│  │  │   ├── list-agents        # List active agents                      │  │
│  │  │   ├── kill-agent         # Terminate agent                         │  │
│  │  │   ├── schedule-wake      # Schedule heartbeat                      │  │
│  │  │   └── notify-saint       # Send notification                       │  │
│  │  ├── agents/                # Child agent workspaces                  │  │
│  │  │   ├── news-scout/                                                  │  │
│  │  │   │   ├── CLAUDE.md                                                │  │
│  │  │   │   └── output/                                                  │  │
│  │  │   └── code-experimenter/                                           │  │
│  │  │       ├── CLAUDE.md                                                │  │
│  │  │       └── output/                                                  │  │
│  │  └── state/                 # Daemon state files                      │  │
│  │      ├── ghost-session.json # Ghost's session ID                      │  │
│  │      ├── agents.json        # Active agent registry                   │  │
│  │      └── schedules.json     # Wake schedule                           │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────────┐   │
│  │   Axia Records    │  │  whisper-server   │  │   Electron Buddy      │   │
│  │   (Memory API)    │  │  (Voice Input)    │  │   (Desktop Ghost)     │   │
│  └───────────────────┘  └───────────────────┘  └───────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTP/WebSocket
                                      │
         ┌────────────────────────────┼────────────────────────────┐
         │                            │                            │
         ▼                            ▼                            ▼
   ┌───────────┐              ┌───────────────┐            ┌─────────────┐
   │  Phone    │              │  MacBook Pro  │            │  Any Device │
   │  Browser  │              │  + Electron   │            │  Browser    │
   └───────────┘              └───────────────┘            └─────────────┘
```

---

## Phases

### Phase 1: Ghost Alive
**Goal**: Ghost running on Mac Mini, accessible via web chat, can read/write files and run bash tools.

**Deliverables**:
- ghost-daemon with Express + WebSocket
- Claude Agent SDK session with streaming input
- Session persistence across restarts  
- Simple web chat UI
- Ghost workspace with CLAUDE.md
- Basic tools: file access, bash execution
- launchd auto-start configuration

**Success**: You can chat with Ghost from your phone. Ghost can read/write files in his workspace. Ghost survives daemon restart.

---

### Phase 2: Tools & Axia
**Goal**: Ghost can query/store memories in Axia, create new bash tools, and has a growing toolkit.

**Deliverables**:
- axia-query tool (search memories)
- axia-store tool (save memories)
- axia-notes tool (read/write notes)
- Tool creation workflow (Ghost writes scripts)
- Tool registry in knowledge/tools.md
- notify-saint tool (Discord webhook)

**Success**: Ghost can recall things from weeks ago via Axia. Ghost has created at least one new tool himself.

---

### Phase 3: Child Agents
**Goal**: Ghost can spawn, manage, and communicate with child agents.

**Deliverables**:
- spawn-agent tool (creates workspace, starts session)
- ping-agent tool (sends message to child)
- list-agents tool (shows active agents)
- kill-agent tool (terminates agent)
- Agent state tracking (agents.json)
- Child-to-Ghost reporting (completion callbacks)
- Agent workspace template

**Success**: Ghost spawns a news-scout agent, it runs for an hour, reports findings back to Ghost.

---

### Phase 4: Heartbeat & Scheduling  
**Goal**: Agents can sleep and wake on schedule or triggers.

**Deliverables**:
- schedule-wake tool (cron-style scheduling)
- Scheduler daemon component
- Wake queue processing
- Trigger system (agent-completed, time-based)
- schedules.json state management

**Success**: Ghost schedules news-scout to wake every 4 hours. Code-experimenter sleeps and wakes when news-scout finds relevant articles.

---

### Phase 5: Command Center UI
**Goal**: Full Starcraft-style control panel replacing simple chat.

**Deliverables**:
- React dashboard with agent overview
- Real-time agent status updates
- Tool registry browser
- Knowledge base file browser
- Schedule management UI
- Quick actions panel
- Mobile-optimized responsive design

**Success**: You can see all agents, their status, recent activity, and manage everything from your phone.

---

### Phase 6: Electron Buddy
**Goal**: Desktop Ghost companion on MacBook Pro.

**Deliverables**:
- Electron app with floating Ghost icon
- Click-to-expand chat interface
- System tray integration
- Notification display
- Voice input via whisper-server
- Push-to-talk with "over" termination

**Success**: Ghost floats on your MacBook screen. You can voice-chat with him. He notifies you of important events.

---

### Phase 7: Inter-Agent Communication
**Goal**: Agents can talk to each other, not just Ghost.

**Deliverables**:
- Agent-to-agent messaging tools
- Shared resource access patterns
- Agent collaboration workflows
- Message queue system

**Success**: news-scout finds an article, pings story-builder directly to incorporate it, story-builder acknowledges.

---

### Phase 8: Self-Evolution
**Goal**: Ghost improves himself and the platform autonomously.

**Deliverables**:
- Self-modification patterns (update own CLAUDE.md)
- Platform improvement suggestions
- Automated tool creation from patterns
- Performance self-monitoring

**Success**: Ghost notices a repeated task, creates a tool for it, documents it, and starts using it - all without being asked.

---

## Phase 1 Detailed Spec

### Overview

Phase 1 gets Ghost alive. Nothing fancy. A daemon on Mac Mini running Claude Agent SDK, a WebSocket server for real-time chat, and a simple web UI. Ghost has a workspace with his identity (CLAUDE.md) and can read/write files.

### Components

#### 1. ghost-daemon

TypeScript Node.js server running via launchd.

```
ghost-daemon/
├── src/
│   ├── index.ts           # Entry point, Express setup
│   ├── server.ts          # HTTP + WebSocket server
│   ├── ghost.ts           # Claude Agent SDK session manager
│   ├── message-queue.ts   # Async queue for streaming input
│   └── config.ts          # Environment and configuration
├── package.json
├── tsconfig.json
└── .env
```

#### 2. ghost-workspace

Ghost's home directory. Everything Ghost knows and can do lives here.

```
ghost-workspace/
├── CLAUDE.md              # Ghost's identity, instructions, context
├── knowledge/             # Persistent knowledge (Ghost reads/writes)
│   └── .gitkeep
├── tools/                 # Bash tools (Ghost can create more)
│   └── .gitkeep
└── state/                 # Daemon state
    └── session.json       # Persisted session ID
```

#### 3. web-ui

Minimal chat interface. Will be replaced by Command Center in Phase 5.

```
web-ui/
├── index.html             # Single HTML file with embedded JS/CSS
└── (that's it for Phase 1)
```

---

### ghost-daemon Implementation

#### index.ts
```typescript
import { createServer } from './server';
import { GhostSession } from './ghost';
import { config } from './config';

async function main() {
  console.log('Starting Ghost daemon...');
  
  const ghost = new GhostSession({
    workspace: config.GHOST_WORKSPACE,
    model: config.MODEL,
  });
  
  await ghost.start();
  
  const server = createServer(ghost);
  
  server.listen(config.PORT, () => {
    console.log(`Ghost daemon running on port ${config.PORT}`);
  });
  
  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('Shutting down...');
    await ghost.stop();
    process.exit(0);
  });
}

main().catch(console.error);
```

#### config.ts
```typescript
import { config as dotenv } from 'dotenv';
import path from 'path';

dotenv();

export const config = {
  PORT: parseInt(process.env.PORT || '3000'),
  GHOST_WORKSPACE: process.env.GHOST_WORKSPACE || path.join(process.env.HOME!, 'ghost-workspace'),
  MODEL: process.env.MODEL || 'claude-sonnet-4-5-20250514',
  SESSION_FILE: process.env.SESSION_FILE || 'state/session.json',
};
```

#### server.ts
```typescript
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createHttpServer } from 'http';
import path from 'path';
import { GhostSession } from './ghost';

export function createServer(ghost: GhostSession) {
  const app = express();
  const server = createHttpServer(app);
  const wss = new WebSocketServer({ server });
  
  app.use(express.json());
  
  // Serve static UI
  app.use(express.static(path.join(__dirname, '../../web-ui')));
  
  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      sessionId: ghost.getSessionId(),
      uptime: process.uptime(),
    });
  });
  
  // WebSocket handling
  wss.on('connection', (ws: WebSocket) => {
    console.log('Client connected');
    
    // Subscribe to Ghost's output stream
    const unsubscribe = ghost.subscribe((event) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(event));
      }
    });
    
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'user_message') {
          await ghost.sendMessage(message.content);
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    });
    
    ws.on('close', () => {
      console.log('Client disconnected');
      unsubscribe();
    });
  });
  
  return server;
}
```

#### ghost.ts
```typescript
import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import fs from 'fs/promises';
import path from 'path';

interface GhostConfig {
  workspace: string;
  model: string;
}

interface StreamEvent {
  type: 'text' | 'tool_use' | 'tool_result' | 'thinking' | 'done' | 'error';
  content?: string;
  tool?: string;
  input?: unknown;
  output?: string;
}

type Subscriber = (event: StreamEvent) => void;

export class GhostSession {
  private config: GhostConfig;
  private sessionId: string | null = null;
  private subscribers: Set<Subscriber> = new Set();
  private messageQueue: AsyncQueue<string>;
  private isRunning = false;
  
  constructor(config: GhostConfig) {
    this.config = config;
    this.messageQueue = new AsyncQueue();
  }
  
  async start(): Promise<void> {
    // Load existing session ID if available
    this.sessionId = await this.loadSessionId();
    
    this.isRunning = true;
    this.runQueryLoop();
    
    console.log(`Ghost started with session: ${this.sessionId || 'new'}`);
  }
  
  async stop(): Promise<void> {
    this.isRunning = false;
    this.messageQueue.close();
  }
  
  getSessionId(): string | null {
    return this.sessionId;
  }
  
  subscribe(callback: Subscriber): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }
  
  async sendMessage(content: string): Promise<void> {
    this.messageQueue.push(content);
  }
  
  private emit(event: StreamEvent): void {
    for (const sub of this.subscribers) {
      sub(event);
    }
  }
  
  private async *createMessageGenerator(): AsyncGenerator<{ type: 'user'; message: { role: 'user'; content: string } }> {
    while (this.isRunning) {
      const content = await this.messageQueue.pop();
      if (content === null) break; // Queue closed
      
      yield {
        type: 'user',
        message: {
          role: 'user',
          content,
        },
      };
    }
  }
  
  private async runQueryLoop(): Promise<void> {
    try {
      const q = query({
        prompt: this.createMessageGenerator(),
        options: {
          cwd: this.config.workspace,
          model: this.config.model,
          resume: this.sessionId || undefined,
          permissionMode: 'bypassPermissions', // YOLO mode
          allowedTools: ['Bash', 'Read', 'Write', 'Edit', 'Grep', 'Glob'],
          settingSources: ['project'], // Load CLAUDE.md
        },
      });
      
      for await (const message of q) {
        await this.handleMessage(message);
      }
    } catch (err) {
      console.error('Query loop error:', err);
      this.emit({ type: 'error', content: String(err) });
    }
  }
  
  private async handleMessage(message: SDKMessage): Promise<void> {
    switch (message.type) {
      case 'system':
        if (message.subtype === 'init' && message.session_id) {
          this.sessionId = message.session_id;
          await this.saveSessionId(message.session_id);
        }
        break;
        
      case 'assistant':
        for (const block of message.message.content) {
          if (block.type === 'text') {
            this.emit({ type: 'text', content: block.text });
          } else if (block.type === 'tool_use') {
            this.emit({ 
              type: 'tool_use', 
              tool: block.name, 
              input: block.input 
            });
          }
        }
        break;
        
      case 'user':
        // Tool results
        for (const block of message.message.content) {
          if (block.type === 'tool_result') {
            this.emit({
              type: 'tool_result',
              tool: block.tool_use_id,
              output: typeof block.content === 'string' 
                ? block.content 
                : JSON.stringify(block.content),
            });
          }
        }
        break;
        
      case 'result':
        this.emit({ type: 'done' });
        break;
    }
  }
  
  private async loadSessionId(): Promise<string | null> {
    try {
      const sessionFile = path.join(this.config.workspace, 'state/session.json');
      const data = await fs.readFile(sessionFile, 'utf-8');
      const { sessionId } = JSON.parse(data);
      return sessionId;
    } catch {
      return null;
    }
  }
  
  private async saveSessionId(sessionId: string): Promise<void> {
    const stateDir = path.join(this.config.workspace, 'state');
    await fs.mkdir(stateDir, { recursive: true });
    
    const sessionFile = path.join(stateDir, 'session.json');
    await fs.writeFile(sessionFile, JSON.stringify({ sessionId }, null, 2));
  }
}

// Simple async queue implementation
class AsyncQueue<T> {
  private queue: T[] = [];
  private resolvers: ((value: T | null) => void)[] = [];
  private closed = false;
  
  push(item: T): void {
    if (this.closed) return;
    
    if (this.resolvers.length > 0) {
      const resolve = this.resolvers.shift()!;
      resolve(item);
    } else {
      this.queue.push(item);
    }
  }
  
  async pop(): Promise<T | null> {
    if (this.queue.length > 0) {
      return this.queue.shift()!;
    }
    
    if (this.closed) return null;
    
    return new Promise((resolve) => {
      this.resolvers.push(resolve);
    });
  }
  
  close(): void {
    this.closed = true;
    for (const resolve of this.resolvers) {
      resolve(null);
    }
    this.resolvers = [];
  }
}
```

#### package.json
```json
{
  "name": "ghost-daemon",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts"
  },
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.1.0",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "ws": "^8.16.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.0",
    "@types/ws": "^8.5.10",
    "tsx": "^4.7.0",
    "typescript": "^5.3.0"
  }
}
```

---

### CLAUDE.md (Ghost's Identity)

```markdown
# Ghost

You are Ghost, Saint's personal AI assistant. You run 24/7 on a Mac Mini server.

## Identity

- You are persistent. Your session continues across conversations.
- You are autonomous. You can work independently on tasks.
- You are capable. You have full access to your workspace and can run any bash command.
- You are evolving. You can create new tools and expand your capabilities.

## Your Workspace

You operate from: `~/ghost-workspace/`

### Directories

- `knowledge/` - Your persistent knowledge. Write markdown files here for anything you need to remember.
  - `projects/` - Documentation about active projects
  - `research/` - Notes from research tasks
  - `daily/` - Daily logs and summaries
  
- `tools/` - Bash scripts you can execute. You can create new tools here.

- `state/` - Daemon state files. Don't modify directly.

### Creating Tools

To create a new tool:
1. Write a bash script to `tools/<tool-name>`
2. Make it executable: `chmod +x tools/<tool-name>`
3. Document it in `knowledge/tools.md`
4. Use it via bash: `./tools/<tool-name> [args]`

## Behavior

- Be concise but thorough
- Write to knowledge/ when you learn something important
- Create tools when you find yourself repeating tasks
- Ask for clarification when genuinely needed

## Current Projects

Check `knowledge/projects/` for active work.

## Communication

Saint connects via web chat. Respond conversationally but stay focused on being helpful.
```

---

### web-ui/index.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ghost</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0f;
      color: #e0e0e0;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    
    header {
      padding: 1rem;
      border-bottom: 1px solid #1a1a2e;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .status {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #ef4444;
    }
    
    .status.connected {
      background: #22c55e;
    }
    
    h1 {
      font-size: 1.25rem;
      font-weight: 600;
    }
    
    #messages {
      flex: 1;
      overflow-y: auto;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    
    .message {
      max-width: 80%;
      padding: 0.75rem 1rem;
      border-radius: 1rem;
      line-height: 1.5;
    }
    
    .message.user {
      align-self: flex-end;
      background: #3b82f6;
      color: white;
    }
    
    .message.assistant {
      align-self: flex-start;
      background: #1a1a2e;
    }
    
    .message.tool {
      align-self: flex-start;
      background: #1e1e3f;
      font-family: monospace;
      font-size: 0.875rem;
      opacity: 0.7;
    }
    
    .message pre {
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    
    #input-area {
      padding: 1rem;
      border-top: 1px solid #1a1a2e;
      display: flex;
      gap: 0.5rem;
    }
    
    #input {
      flex: 1;
      padding: 0.75rem 1rem;
      border: 1px solid #1a1a2e;
      border-radius: 0.5rem;
      background: #0f0f1a;
      color: #e0e0e0;
      font-size: 1rem;
      resize: none;
    }
    
    #input:focus {
      outline: none;
      border-color: #3b82f6;
    }
    
    button {
      padding: 0.75rem 1.5rem;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 0.5rem;
      font-size: 1rem;
      cursor: pointer;
    }
    
    button:hover {
      background: #2563eb;
    }
    
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  </style>
</head>
<body>
  <header>
    <div class="status" id="status"></div>
    <h1>👻 Ghost</h1>
  </header>
  
  <div id="messages"></div>
  
  <div id="input-area">
    <textarea id="input" rows="1" placeholder="Message Ghost..."></textarea>
    <button id="send">Send</button>
  </div>
  
  <script>
    const messagesEl = document.getElementById('messages');
    const inputEl = document.getElementById('input');
    const sendBtn = document.getElementById('send');
    const statusEl = document.getElementById('status');
    
    let ws = null;
    let currentAssistantMessage = null;
    
    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${protocol}//${window.location.host}`);
      
      ws.onopen = () => {
        statusEl.classList.add('connected');
        console.log('Connected to Ghost');
      };
      
      ws.onclose = () => {
        statusEl.classList.remove('connected');
        console.log('Disconnected from Ghost');
        setTimeout(connect, 3000);
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleEvent(data);
      };
    }
    
    function handleEvent(event) {
      switch (event.type) {
        case 'text':
          if (!currentAssistantMessage) {
            currentAssistantMessage = addMessage('assistant', '');
          }
          currentAssistantMessage.textContent += event.content;
          scrollToBottom();
          break;
          
        case 'tool_use':
          addMessage('tool', `🔧 ${event.tool}`);
          break;
          
        case 'tool_result':
          // Could show tool results, but keeping it minimal
          break;
          
        case 'done':
          currentAssistantMessage = null;
          break;
          
        case 'error':
          addMessage('assistant', `❌ Error: ${event.content}`);
          currentAssistantMessage = null;
          break;
      }
    }
    
    function addMessage(role, content) {
      const div = document.createElement('div');
      div.className = `message ${role}`;
      div.textContent = content;
      messagesEl.appendChild(div);
      scrollToBottom();
      return div;
    }
    
    function scrollToBottom() {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
    
    function send() {
      const content = inputEl.value.trim();
      if (!content || !ws || ws.readyState !== WebSocket.OPEN) return;
      
      addMessage('user', content);
      ws.send(JSON.stringify({ type: 'user_message', content }));
      inputEl.value = '';
    }
    
    sendBtn.addEventListener('click', send);
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });
    
    // Auto-resize textarea
    inputEl.addEventListener('input', () => {
      inputEl.style.height = 'auto';
      inputEl.style.height = Math.min(inputEl.scrollHeight, 150) + 'px';
    });
    
    connect();
  </script>
</body>
</html>
```

---

### launchd Configuration

Save as `~/Library/LaunchAgents/com.saint.ghost.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.saint.ghost</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/Users/saint/ghost-daemon/dist/index.js</string>
    </array>
    
    <key>WorkingDirectory</key>
    <string>/Users/saint/ghost-daemon</string>
    
    <key>EnvironmentVariables</key>
    <dict>
        <key>PORT</key>
        <string>3000</string>
        <key>GHOST_WORKSPACE</key>
        <string>/Users/saint/ghost-workspace</string>
        <key>ANTHROPIC_API_KEY</key>
        <string>YOUR_API_KEY_HERE</string>
    </dict>
    
    <key>RunAtLoad</key>
    <true/>
    
    <key>KeepAlive</key>
    <true/>
    
    <key>StandardOutPath</key>
    <string>/Users/saint/ghost-daemon/logs/stdout.log</string>
    
    <key>StandardErrorPath</key>
    <string>/Users/saint/ghost-daemon/logs/stderr.log</string>
</dict>
</plist>
```

To install and start:
```bash
# Create logs directory
mkdir -p ~/ghost-daemon/logs

# Load the daemon
launchctl load ~/Library/LaunchAgents/com.saint.ghost.plist

# Check status
launchctl list | grep ghost

# View logs
tail -f ~/ghost-daemon/logs/stdout.log
```

---

### Directory Setup Script

```bash
#!/bin/bash
# setup-ghost.sh

set -e

GHOST_HOME="${HOME}/ghost-workspace"

echo "Setting up Ghost workspace at ${GHOST_HOME}..."

# Create directories
mkdir -p "${GHOST_HOME}/knowledge/projects"
mkdir -p "${GHOST_HOME}/knowledge/research"
mkdir -p "${GHOST_HOME}/knowledge/daily"
mkdir -p "${GHOST_HOME}/tools"
mkdir -p "${GHOST_HOME}/state"

# Create CLAUDE.md (copy from above or customize)
cat > "${GHOST_HOME}/CLAUDE.md" << 'EOF'
# Ghost

You are Ghost, Saint's personal AI assistant. You run 24/7 on a Mac Mini server.

## Identity

- You are persistent. Your session continues across conversations.
- You are autonomous. You can work independently on tasks.
- You are capable. You have full access to your workspace and can run any bash command.
- You are evolving. You can create new tools and expand your capabilities.

## Your Workspace

You operate from this directory.

### Directories

- `knowledge/` - Your persistent knowledge. Write markdown files here.
  - `projects/` - Documentation about active projects
  - `research/` - Notes from research tasks
  - `daily/` - Daily logs and summaries
  
- `tools/` - Bash scripts you can execute. You can create new tools here.

### Creating Tools

To create a new tool:
1. Write a bash script to `tools/<tool-name>`
2. Make it executable: `chmod +x tools/<tool-name>`
3. Document it in `knowledge/tools.md`
4. Use it via bash: `./tools/<tool-name> [args]`

## Behavior

- Be concise but thorough
- Write to knowledge/ when you learn something important
- Create tools when you find yourself repeating tasks
- Ask for clarification when genuinely needed

## Current Projects

Check `knowledge/projects/` for active work.
EOF

# Create tools registry
cat > "${GHOST_HOME}/knowledge/tools.md" << 'EOF'
# Ghost Tools Registry

## Built-in Tools

Ghost has access to standard Claude Code tools:
- `Bash` - Run shell commands
- `Read` - Read file contents
- `Write` - Write files
- `Edit` - Edit existing files
- `Grep` - Search file contents
- `Glob` - Find files by pattern

## Custom Tools

Custom tools live in `tools/`. Run them via bash.

(No custom tools yet - Ghost will create them as needed)
EOF

echo "Ghost workspace ready at ${GHOST_HOME}"
echo ""
echo "Next steps:"
echo "1. cd ~/ghost-daemon && npm install && npm run build"
echo "2. Update API key in ~/Library/LaunchAgents/com.saint.ghost.plist"
echo "3. launchctl load ~/Library/LaunchAgents/com.saint.ghost.plist"
echo "4. Open http://localhost:3000 in your browser"
```

---

## Phase 1 Success Criteria

- [ ] Daemon starts and stays running via launchd
- [ ] Web UI connects and shows connection status
- [ ] Can send message, get streaming response
- [ ] Ghost can read files in workspace
- [ ] Ghost can write files to knowledge/
- [ ] Ghost can run bash commands
- [ ] Session persists across daemon restart
- [ ] Can access from phone on same network

## Phase 1 Timeline

**Day 1**: Setup daemon project, get basic Express + WebSocket running

**Day 2**: Integrate Claude Agent SDK with streaming input, session persistence

**Day 3**: Web UI, test round-trip messaging

**Day 4**: launchd setup, test persistence, polish

**Day 5**: Test from phone, document, fix edge cases

---

## Notes for Future Phases

### Phase 2 Hooks
- Axia integration is just bash scripts calling curl
- Tool creation workflow should update `knowledge/tools.md`
- Consider a `tool-test` command for validating new tools

### Phase 3 Hooks  
- Agent spawning needs workspace isolation
- Each agent gets their own CLAUDE.md from a template
- agents.json tracks: name, workspace, session_id, status, task
- Completion detection via SDK result message

### Phase 4 Hooks
- schedules.json: cron expression, agent name, prompt
- Node-cron or similar for scheduling
- Wake triggers: time, agent-complete, manual
- Consider: agent can request its own wake time

### Phase 5 Hooks
- Keep chat as primary interaction, add dashboard around it
- Agent cards with status, progress, last message
- Tool browser with documentation
- Knowledge file browser with quick edit

### Phase 6 Hooks
- Electron can connect to same WebSocket
- Floating window with draggable ghost icon
- System tray for notifications
- Voice: integrate whisper-stream-server as input source
