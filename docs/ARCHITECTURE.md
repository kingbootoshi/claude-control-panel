# Claude Control Panel - Architecture

> Read this file after every compaction to understand where things live.

## Overview

A persistent Claude daemon ("Ghost") running 24/7 on Mac Mini with a web-based Command Center UI. Uses the Claude Agent SDK which wraps the Claude CLI (OAuth authentication, no API key needed).

```
┌─────────────────────────────────────────────────────────────┐
│                     Mac Mini (24/7)                         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   ghost-daemon                       │   │
│  │  ┌──────────┐  ┌────────────────┐  ┌─────────────┐  │   │
│  │  │ Express  │  │ ClaudeSession  │  │   Message   │  │   │
│  │  │ Server   │──│ (Agent SDK)    │──│   Queue     │  │   │
│  │  │  + WS    │  │                │  │             │  │   │
│  │  └────┬─────┘  └───────┬────────┘  └─────────────┘  │   │
│  │       │                │                             │   │
│  │       │                └── Uses ~/.claude OAuth      │   │
│  │       │                                              │   │
│  └───────┼──────────────────────────────────────────────┘   │
│          │                                                  │
│  ┌───────┴─────────────┐  ┌─────────────────────────────┐  │
│  │   web/dist/         │  │   ~/claude-workspace/       │  │
│  │   (Command Center)  │  │   ├── CLAUDE.md             │  │
│  │                     │  │   ├── knowledge/            │  │
│  │   React + Tailwind  │  │   ├── tools/                │  │
│  │   Cyberpunk UI      │  │   └── state/session.json    │  │
│  └─────────────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
           │
           │ HTTP/WebSocket :3000
           ▼
    ┌─────────────┐
    │   Browser   │
    │   (Phone)   │
    └─────────────┘
```

## Directory Structure

```
claude_control_panel/
├── src/                     # Daemon core (TypeScript/Bun)
│   ├── index.ts             # Entry point, graceful shutdown
│   ├── server.ts            # Express + WebSocket server
│   ├── claude-session.ts    # Agent SDK integration
│   ├── message-queue.ts     # Async queue for streaming input
│   └── config.ts            # Environment configuration
│
├── web/                     # Command Center UI (React + Vite)
│   ├── src/
│   │   ├── App.tsx          # Main dashboard component
│   │   ├── hooks/
│   │   │   └── useWebSocket.ts  # WebSocket connection hook
│   │   ├── main.tsx         # React entry
│   │   └── index.css        # Tailwind + custom styles
│   ├── dist/                # Built UI (served by daemon)
│   └── package.json         # UI dependencies
│
├── scripts/
│   └── setup.sh             # Creates ~/claude-workspace
│
├── docs/
│   ├── ARCHITECTURE.md      # This file
│   └── PROGRESS.md          # Implementation status
│
├── documentation/features/  # Feature tracker
│   ├── active/              # Current phase
│   ├── planned/             # Future phases
│   └── completed/           # Done phases
│
├── com.user.claude-control-panel.plist  # launchd config
└── package.json             # Daemon dependencies
```

## Key Modules

### `src/claude-session.ts` - Agent SDK Integration

The heart of the daemon. Manages the Claude session via `@anthropic-ai/claude-agent-sdk`.

**Key concepts:**
- Uses `query()` function, not direct API
- Streaming input via async generator (`createMessageGenerator`)
- Streaming output via `for await` loop
- Session persistence: saves `session_id` to `state/session.json`, uses `resume` option
- Permission mode: `bypassPermissions` for autonomous operation
- Loads CLAUDE.md via `settingSources: ['project']`

**Events emitted:**
- `init` - Session initialized (contains sessionId)
- `text` - Text content from Claude
- `tool_use` - Tool being used
- `tool_result` - Tool result received
- `done` - Response complete
- `error` - Error occurred

### `src/message-queue.ts` - Async Message Queue

Bridges WebSocket messages to Claude's streaming input.

**Key concepts:**
- `push(item)` - Add message (delivers to waiting consumer or queues)
- `pop()` - Get message (waits async if empty, returns null if closed)
- `close()` - Graceful shutdown, all waiters get null

### `src/server.ts` - Express + WebSocket Server

HTTP server for static files + WebSocket for real-time chat.

**Endpoints:**
- `GET /health` - Health check with session info
- `GET /api/session` - Current session info
- `GET /*` - Serves web UI from `web/dist/`

**WebSocket protocol:**
- Client → Server: `{ type: 'user_message', content: string }`
- Server → Client: `{ type: 'text'|'tool_use'|'done'|..., content?: string }`

### `web/src/hooks/useWebSocket.ts` - UI WebSocket Hook

React hook managing WebSocket connection and message state.

**State:**
- `connected` - Connection status
- `messages` - Chat history (local only, not persisted)
- `isTyping` - Claude is responding
- `currentTool` - Tool currently in use

## Data Flows

### User Message Flow

```
Browser                 Server                  ClaudeSession
   │                       │                          │
   │ {type:user_message}   │                          │
   ├──────────────────────>│                          │
   │                       │ queue.push(content)      │
   │                       ├─────────────────────────>│
   │                       │                          │
   │                       │    pop() returns content │
   │                       │                          │
   │                       │ yield SDKUserMessage     │
   │                       │         to Agent SDK     │
   │                       │                          │
```

### Claude Response Flow

```
Agent SDK              ClaudeSession              Server                Browser
   │                       │                          │                    │
   │ SDKMessage            │                          │                    │
   ├──────────────────────>│                          │                    │
   │                       │ emit('event', ...)       │                    │
   │                       ├─────────────────────────>│                    │
   │                       │                          │ ws.send(JSON)      │
   │                       │                          ├───────────────────>│
   │                       │                          │                    │ update UI
```

## Configuration

Environment variables (from `.env` or launchd plist):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | HTTP/WebSocket port |
| `CLAUDE_WORKSPACE` | ~/claude-workspace | Ghost's home directory |
| `ASSISTANT_NAME` | Claude | Display name for the assistant |
| `MODEL` | claude-sonnet-4-5-20250514 | Claude model to use |

**No API key needed** - uses OAuth from Claude CLI (`~/.claude/`).

## Workspace Structure

```
~/claude-workspace/
├── CLAUDE.md              # Ghost's identity and instructions
├── knowledge/             # Persistent knowledge files
│   ├── projects/          # Project documentation
│   ├── research/          # Research notes
│   └── daily/             # Daily logs
├── tools/                 # Custom bash tools
└── state/
    └── session.json       # { sessionId: "..." }
```

## UI Architecture

React SPA with Tailwind CSS, cyberpunk/CRT aesthetic.

**Main panels:**
- Ghost Status - Connection, message count, quick actions
- Active Agents - Placeholder for Phase 3
- Terminal (Chat) - Real-time streaming conversation
- Tools - Available tools with activity indicator
- Knowledge - Workspace file browser

**Styling:**
- Ghost cyan accent color (`#00d9ff`)
- Grid background with noise overlay
- CRT scan line animation
- Glow effects on borders

## Session Persistence

1. On startup: Load `session_id` from `state/session.json`
2. Pass to `query({ options: { resume: sessionId } })`
3. On `SDKSystemMessage` (subtype: 'init'): Save new `session_id`
4. Session survives daemon restarts

## launchd Integration

`com.user.claude-control-panel.plist` configures:
- Auto-start on login (`RunAtLoad`)
- Keep alive (`KeepAlive.SuccessfulExit: false`)
- Logs to `logs/stdout.log`, `logs/stderr.log`
- Throttle restart to 10 seconds

## Phase Roadmap

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Ghost Alive | IN PROGRESS |
| 2 | Tools & Axia | Planned |
| 3 | Child Agents | Planned |
| 4 | Heartbeat & Scheduling | Planned |
| 5 | Command Center UI | DONE (moved to P1) |
| 6 | Electron Buddy | Planned |
| 7 | Inter-Agent Communication | Planned |
| 8 | Self-Evolution | Planned |

See `documentation/features/` for detailed phase specs.

## Common Tasks

### Add a new event type

1. Add to `StreamEvent.type` in `src/claude-session.ts`
2. Emit in `handleMessage()` switch statement
3. Add to `ServerMessage.type` in `src/server.ts`
4. Add to `ServerMessage.type` in `web/src/hooks/useWebSocket.ts`
5. Handle in `handleServerMessage()` switch statement

### Modify Claude's behavior

Edit `~/claude-workspace/CLAUDE.md` - loaded via `settingSources: ['project']`.

### Add a new API endpoint

Add route in `src/server.ts` before the wildcard `GET /*` catch-all.

### Add a new UI panel

Add component in `web/src/App.tsx`, use Tailwind grid classes.
