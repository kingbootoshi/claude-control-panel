# Claude Control Panel v2 - Specification

## Overview

A local service for managing Claude Agent SDK sessions and observing spawned child agents (codex, terminals). Not a "master agent" - just a control panel for visibility and orchestration.

## Core Principles

1. **Claude = SDK only** - Never run `claude` CLI in terminals. All Claude interactions through Agent SDK wrapper (enables smart compaction, metrics, custom tools).

2. **Codex = Terminal/tmux** - Codex agents run in tmux, visible in Terminal view. User can watch but not interact with Claude through terminal.

3. **Local-first** - Accesses local CLI tools, local git, local tmux. No cloud dependencies for core functionality.

4. **Project-scoped** - Everything happens in context of a project. "General" is just a project with cwd=workspace root.

5. **No master agent** - CLAUDE.md files provide instructions, but no single orchestrating agent. User orchestrates through the UI.

---

## Information Architecture

```
Claude Control Panel
├── Home Dashboard
│   ├── Quick Actions: New Chat, New Project, Resume Last
│   ├── Recent Projects (cards, clickable)
│   └── Active Sessions (replaces "Agents" section)
│       └── All running Claude/Codex sessions across projects
│
├── Projects (full-screen list view)
│   └── All projects with status, last opened, git branch
│
├── Project View (or "General")
│   ├── [Left Sidebar]
│   │   ├── Chat (main nav)
│   │   ├── Terminal
│   │   ├── Git
│   │   └── History
│   │
│   ├── [Main Content - depends on nav]
│   │   ├── Chat View (default)
│   │   ├── Terminal View
│   │   ├── Git View
│   │   └── History View
│   │
│   └── [Right Sidebar]
│       ├── Files (always visible, IDE-style)
│       ├── Session Context (token count, etc.)
│       └── File changes (touched/added/deleted)
│
└── Settings
```

---

## Views

### Home Dashboard

**Purpose**: Quick access to projects and overview of what's running.

**Layout**:
- Header: "Welcome back, {name}"
- Quick Actions row: New Chat, New Project, Resume Last
- Recent Projects: Card grid (clickable to enter project)
- Active Sessions: List of all running sessions across all projects
  - Click to jump to that session in its project

**Removed**:
- "Agents" section (replaced by Active Sessions)
- Orchestration link in sidebar
- Codex link in sidebar

### Projects View

**Purpose**: Full list of all projects.

**Layout**:
- Full-screen grid/list of projects
- Each shows: name, path, last opened, git branch, active session count
- Click to enter project view
- "New Project" button

### Project View

**Purpose**: Main workspace for a project.

#### Chat Tab (Default)

**Layout**:
- Tabs at top (each tab = one Claude SDK session)
- "+" to create new session
- Chat messages in main area
- Input at bottom

**Behavior**:
- Each tab is independent Claude SDK session
- Sessions can run in parallel
- Badge on tab shows child agent count (e.g., "Chat 1 [3]" if 3 codex agents spawned)
- Smart compaction happens automatically per session

#### Terminal Tab

**Purpose**: View codex agents, run commands, observe tmux sessions.

**Layout**:
- Tabs at top (each tab can contain multiple panes)
- Each tab can be split into grid (2x2, split vertical, split horizontal, etc.)
- Panes show:
  - Codex tmux sessions (spawned by Claude sessions)
  - General terminal for running commands
  - Any other tmux sessions

**Behavior**:
- When Claude session spawns `codex-agent start`, new pane appears
- Panes can be resized, rearranged
- When codex agent completes and Claude kills it, pane closes
- If all panes in a tab close, tab closes
- User can manually add terminal panes
- User can NOT run `claude` CLI here - SDK only

**NOT for**:
- Running Claude CLI directly
- Interactive Claude sessions

#### Git Tab

**Purpose**: Review changes, see diffs, commit history.

**Layout**:
- Changed files list (staged, unstaged, untracked)
- Click file to see diff
- Commit history (recent commits)
- Branch info

**Behavior**:
- Auto-refreshes when files change
- Can stage/unstage files
- Can view any commit's diff
- Links to files in Files sidebar

#### History Tab

**Purpose**: All Claude chat sessions for this project.

**Layout**:
- Chronological list, most recent first
- Each entry shows: timestamp, first message preview, token count
- Click to open in Chat tab

**Behavior**:
- Shows completed and active sessions
- Can resume old sessions
- Can delete old sessions

#### Files Sidebar (Right)

**Purpose**: IDE-style file browser.

**Layout**:
- Tree view of project files
- Collapsible folders
- File icons by type

**Sections**:
1. **Project Files** - Full tree
2. **Session Changes** - Files touched in current chat session
   - Added (green)
   - Modified (yellow)
   - Deleted (red)

**Behavior**:
- Click file to view (read-only viewer or opens in editor?)
- Right-click for context menu
- Search/filter

#### Session Context (Right Sidebar, below Files)

**Purpose**: Show current session metrics.

**Content**:
- Token count (current / max)
- Progress bar for context usage
- Cost estimate
- Compaction count
- "Compact Now" button

---

## Data Model

### Project
```typescript
interface Project {
  id: string;
  name: string;
  path: string;           // Filesystem path, or null for "General"
  createdAt: string;
  lastOpenedAt: string;
}
```

### Session (Claude SDK)
```typescript
interface Session {
  id: string;
  projectId: string;
  status: 'starting' | 'running' | 'idle' | 'closed';
  createdAt: string;
  metrics: SessionMetrics;
  childAgents: ChildAgent[];  // Spawned codex agents
}
```

### ChildAgent (Codex)
```typescript
interface ChildAgent {
  id: string;              // codex job id
  parentSessionId: string; // Claude session that spawned it
  tmuxSession: string;     // tmux session name
  status: 'running' | 'complete' | 'failed';
  startedAt: string;
  completedAt?: string;
}
```

### TerminalPane
```typescript
interface TerminalPane {
  id: string;
  tabId: string;
  type: 'codex' | 'shell';
  tmuxPaneId?: string;
  childAgentId?: string;   // If type=codex, links to ChildAgent
}
```

---

## Agent Linkage

### How Claude spawns Codex

1. User sends message to Claude session
2. Claude decides to spawn codex agent, calls `codex-agent start "..."`
3. codex-agent creates tmux session, returns job ID
4. Control Panel detects new codex job (via watching jobs directory or tmux sessions)
5. Control Panel creates ChildAgent record linked to current Claude session
6. Terminal view shows new pane with codex output
7. Badge on Chat tab updates

### Detection Options

**Option A: Watch codex-agent jobs directory**
- Poll `~/.codex-agent/jobs/` for new job files
- Parse job metadata to get tmux session

**Option B: Watch tmux sessions**
- Poll `tmux list-sessions` for `codex-agent-*` sessions
- Match to codex jobs

**Option C: Wrap codex-agent**
- CCP provides MCP tool that wraps codex-agent
- Tool reports back to CCP when agent spawns

**Recommended**: Start with Option A (jobs directory watch), add Option C later for tighter integration.

---

## CLAUDE.md Hierarchy

```
~/.claude/CLAUDE.md              # Global - applies to ALL claude sessions everywhere
~/claude-workspace/CLAUDE.md     # Workspace - applies to General and all projects
~/claude-workspace/projects/foo/CLAUDE.md  # Project - applies to this project only
```

Each level inherits from above. Project can override workspace can override global.

---

## Sidebar Navigation

### Home (global)
- home
- projects
- settings

### Project View
- chat
- terminal
- git
- history

**Removed from global**:
- orchestration
- codex

---

## API Changes Needed

### Remove
- `/api/codex/*` from global routes (move to project-scoped)
- Orchestration page routes

### Add
- `GET /api/sessions/:id/children` - Get child agents for session
- `POST /api/terminals/panes` - Create terminal pane
- `DELETE /api/terminals/panes/:id` - Close terminal pane
- `GET /api/projects/:id/history` - Get all sessions for project
- `WS /api/terminals/stream` - Stream terminal output

### Modify
- Session creation should track child agents
- Terminal manager should support pane grid layouts

---

## Implementation Phases

### Phase 1: Restructure Navigation
- Remove orchestration/codex from global sidebar
- Add projects full-screen view
- Merge "Agents" into "Active Sessions" on home
- Fix project view nav (chat/terminal/git/history)

### Phase 2: Terminal View
- Tab + pane grid system
- Tmux session display
- Manual terminal creation
- Watch for codex tmux sessions

### Phase 3: Agent Linkage
- Track child agents per session
- Badge on chat tabs
- Auto-create terminal panes for codex agents
- Auto-close panes when agents complete

### Phase 4: Git View
- File change list
- Diff viewer
- Commit history
- Stage/unstage

### Phase 5: Files Sidebar
- Full file tree
- Session changes section
- File viewer
- Click to open

### Phase 6: History View
- Session list
- Resume sessions
- Delete sessions

---

## Open Questions

1. **File viewer** - Should clicking a file open a read-only viewer in CCP, or open in external editor (VS Code)?

2. **Terminal input** - Should terminal panes be interactive (user can type) or view-only for codex?

3. **Session persistence** - How long to keep closed sessions in history? Forever? 30 days?

4. **General project** - Auto-create on first launch, or user creates manually?
