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
│  │   Vibeship UI       │  │   └── state/session.json    │  │
│  └─────────────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
           │
           │ HTTP/WebSocket :3847
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
│   ├── config.ts            # Environment configuration
│   └── utils/
│       └── logger.ts        # Pino logger factory
│
├── web/                     # Command Center UI (React + Vite)
│   ├── src/
│   │   ├── App.tsx          # Main layout shell
│   │   ├── main.tsx         # React entry
│   │   ├── index.css        # Tailwind + custom styles
│   │   │
│   │   ├── types/           # TypeScript type definitions
│   │   │   ├── messages.ts  # WebSocket protocol types
│   │   │   ├── agents.ts    # Agent state types
│   │   │   ├── ui.ts        # UI-specific types
│   │   │   └── index.ts     # Re-exports
│   │   │
│   │   ├── hooks/           # React hooks
│   │   │   ├── useWebSocket.ts  # WebSocket connection + auto-reconnect
│   │   │   └── useTerminal.ts   # Terminal block state management
│   │   │
│   │   └── components/      # UI components
│   │       ├── Icons.tsx        # SVG icon components
│   │       ├── TabBar.tsx       # Agent tab bar
│   │       ├── Sidebar/
│   │       │   └── Sidebar.tsx  # Left sidebar (agents, workspace)
│   │       └── Terminal/
│   │           ├── Terminal.tsx       # Container with header
│   │           ├── TerminalOutput.tsx # Scrolling block list
│   │           ├── TerminalInput.tsx  # Chat input
│   │           ├── MessageBlock.tsx   # Renders different block types
│   │           └── ToolBlock.tsx      # Collapsible tool display
│   │
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

### Backend

#### `src/history.ts` - SDK Session History Parser

Loads conversation history from Claude SDK's JSONL session files.

**Key concepts:**
- Session files live at `~/.claude/projects/{hash}/{sessionId}.jsonl`
- Recursive search via `findSessionFile()` to locate files
- Two-pass parsing: builds blocks, matches tool_results to tool_use by ID
- Filters image metadata strings (`[Image: original...]`)
- Returns last N blocks (default 25, rolling window)

**Exports:**
- `loadSessionHistory(sessionId, limit)` → `HistoryBlock[]`

#### `src/claude-session.ts` - Agent SDK Integration

The heart of the daemon. Manages the Claude session via `@anthropic-ai/claude-agent-sdk`.

**Key concepts:**
- Uses `query()` function, not direct API
- Streaming input via async generator (`createMessageGenerator`)
- Streaming output via `for await` loop
- Session persistence: saves `session_id` to `state/session.json`, uses `resume` option
- Permission mode: `bypassPermissions` for autonomous operation
- Loads CLAUDE.md via `settingSources: ['project']`
- Tracks `currentMessageId` to correlate streaming chunks
- Tracks `hasStreamedContent` to avoid duplicate text emissions

**Events emitted:**
- `init` - Session initialized (contains sessionId, tools[])
- `text_delta` - Streaming text chunk (with messageId)
- `text_complete` - Text block finished (with messageId)
- `tool_start` - Tool invocation started (toolUseId, toolName, input)
- `tool_result` - Tool completed (toolUseId, result, isError)
- `thinking` - Extended thinking content
- `turn_complete` - Response complete (durationMs, costUsd)
- `error` - Error occurred

#### `src/server.ts` - Express + WebSocket Server

HTTP server for static files + WebSocket for real-time chat.

**Endpoints:**
- `GET /health` - Health check with session info
- `GET /api/session` - Current session info
- `GET /*` - Serves web UI from `web/dist/`

**WebSocket protocol:**
```typescript
// Client → Server
{ type: 'user_message', agentId: string, content: string }
{ type: 'ping' }

// Server → Client
{ type: 'status', agentId, timestamp, connected, agents[] }
{ type: 'text_delta', agentId, timestamp, content, messageId }
{ type: 'text_complete', agentId, timestamp, messageId }
{ type: 'tool_start', agentId, timestamp, toolUseId, toolName, input }
{ type: 'tool_result', agentId, timestamp, toolUseId, result, isError }
{ type: 'turn_complete', agentId, timestamp, durationMs, costUsd }
{ type: 'error', agentId, timestamp, content }
{ type: 'pong', agentId, timestamp }
```

#### `src/message-queue.ts` - Async Message Queue

Bridges WebSocket messages to Claude's streaming input.

**Key concepts:**
- `push(item)` - Add message (delivers to waiting consumer or queues)
- `pop()` - Get message (waits async if empty, returns null if closed)
- `close()` - Graceful shutdown, all waiters get null

### Frontend

#### `web/src/types/` - Type Definitions

**messages.ts** - WebSocket protocol types
- `ClientMessage` = `UserMessagePayload | PingPayload`
- `ServerMessage` = union of all server message types

**agents.ts** - Agent state
- `Agent` - id, name, status, sessionId, isTyping, currentTool
- `AgentConfig` - name, workspacePath, model, systemPrompt

**ui.ts** - Terminal rendering
- `TerminalBlockType` - user_command, text, text_streaming, tool_use, etc.
- `TerminalBlock` - id, type, agentId, timestamp, content, tool info, etc.

#### `web/src/hooks/useWebSocket.ts` - WebSocket Hook

Manages WebSocket connection with auto-reconnect.

**Returns:**
- `connected` - Connection status
- `send(message)` - Send typed message to server
- `connectionError` - Error string if connection failed

#### `web/src/hooks/useTerminal.ts` - Terminal State

Manages terminal block state with streaming correlation.

**Key concepts:**
- `blocks` - Array of TerminalBlock
- `streamingBlocksRef` - Map<messageId, blockId> for streaming text
- `toolBlocksRef` - Map<toolUseId, blockId> for tool results
- Handles all ServerMessage types → creates/updates blocks

**Returns:**
- `blocks` - Current terminal blocks
- `addUserCommand(agentId, content)` - Add user command block
- `handleServerMessage(message)` - Process server message
- `clearBlocks(agentId)` - Clear agent's blocks

#### `web/src/components/Terminal/` - Terminal Components

**MessageBlock.tsx** - Renders blocks based on type:
- `user_command` → amber prompt with content
- `text` / `text_streaming` → ReactMarkdown with streaming cursor
- `tool_use` → ToolBlock component
- `thinking` → Collapsible thinking block
- `error` → Red error message
- `system` → Dim system message

**ToolBlock.tsx** - Collapsible tool display:
- Shows tool name with status icon (loading/check/error)
- Expands to show JSON input and output
- Scrollable output area

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

### Claude Response Flow (Streaming)

```
Agent SDK              ClaudeSession              Server                Browser
   │                       │                          │                    │
   │ stream_event          │                          │                    │
   │ (content_block_delta) │                          │                    │
   ├──────────────────────>│                          │                    │
   │                       │ emit('text_delta')       │                    │
   │                       ├─────────────────────────>│                    │
   │                       │                          │ ws.send(JSON)      │
   │                       │                          ├───────────────────>│
   │                       │                          │                    │ append to block
   │                       │                          │                    │
   │ stream_event          │                          │                    │
   │ (content_block_stop)  │                          │                    │
   ├──────────────────────>│                          │                    │
   │                       │ emit('text_complete')    │                    │
   │                       ├─────────────────────────>│                    │
   │                       │                          │ ws.send(JSON)      │
   │                       │                          ├───────────────────>│
   │                       │                          │                    │ mark complete
```

## Configuration

Environment variables (from `.env` or launchd plist):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3847 | HTTP/WebSocket port |
| `CLAUDE_WORKSPACE` | ~/claude-workspace | Ghost's home directory |
| `ASSISTANT_NAME` | Claude | Display name for the assistant |
| `MODEL` | claude-opus-4-5-20251101 | Claude model to use |

**No API key needed** - uses OAuth from Claude CLI (`~/.claude/`).

## UI Architecture

React SPA with Tailwind CSS, Vibeship-inspired dark terminal aesthetic.

**Layout:**
- Left sidebar (280px) - Agent list, workspace tree
- Main area - Tab bar + Terminal panel
- Terminal - Header, scrolling output, input area

**Color scheme:**
- `--void-deep` - #0a0b0d (background)
- `--void-surface` - #0f1012 (panels)
- `--accent` - #f59e0b (amber accent)
- `--text` - #e5e5e5 (primary text)
- `--text-dim` - #71717a (secondary text)

**Features:**
- Markdown rendering (react-markdown)
- Collapsible tool blocks
- Streaming cursor animation
- Auto-reconnect WebSocket
- Keyboard shortcuts (Ctrl+N, Ctrl+1-9, Ctrl+Tab)

## Session Persistence

1. On startup: Load `session_id` from `state/session.json`
2. Pass to `query({ options: { resume: sessionId } })`
3. On `SDKSystemMessage` (subtype: 'init'): Save new `session_id`
4. Session survives daemon restarts

## Phase Roadmap

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Ghost Alive + Streaming UI | DONE |
| 1.5 | History, Images, Visual Polish | DONE |
| 2 | Tools & Axia | Planned |
| 3 | Child Agents | Planned |
| 4 | Heartbeat & Scheduling | Planned |
| 5 | Mobile PWA | Planned |
| 6 | Electron Buddy | Planned |
| 7 | Inter-Agent Communication | Planned |
| 8 | Self-Evolution | Planned |

### Recent Additions (Phase 1.5)
- SDK history loading from JSONL session files
- Image attachments (drag & drop, paste, file picker)
- Inline image rendering in chat
- Markdown table support (remark-gfm)
- Visual message separation (orange border for user, indented Claude responses)
- Mobile-responsive layout

See `documentation/features/` for detailed phase specs.

## Common Tasks

### Add a new message type

1. Add to `StreamEvent` type in `src/claude-session.ts`
2. Emit in `handleMessage()` switch statement
3. Add to `mapEventToMessage()` in `src/server.ts`
4. Add to `ServerMessage` type in `web/src/types/messages.ts`
5. Handle in `handleServerMessage()` in `web/src/hooks/useTerminal.ts`
6. Render in `MessageBlock.tsx` if needed

### Add a new terminal block type

1. Add to `TerminalBlockType` in `web/src/types/ui.ts`
2. Add fields to `TerminalBlock` interface if needed
3. Handle creation in `useTerminal.ts`
4. Add rendering case in `MessageBlock.tsx`
5. Add CSS styles in `index.css`

### Modify Claude's behavior

Edit `~/claude-workspace/CLAUDE.md` - loaded via `settingSources: ['project']`.

### Add a new API endpoint

Add route in `src/server.ts` before the wildcard `GET /*` catch-all.
