# Findings & Decisions

## Requirements
From SPEC-v2.md:
- Remove global orchestration/codex pages
- Add full-screen Projects view
- Project View with left sidebar: chat/terminal/git/history
- Right sidebar: Files + Session Context (always visible in project)
- Chat tabs with child agent badges
- Terminal view with tab + pane grid system
- Agent linkage: track codex jobs spawned by Claude sessions
- Git view with diffs, staging, commit history
- History view for all project sessions
- Auto-create "General" project on first launch

## Research Findings

### Current Frontend Structure
- **54 TypeScript files** in web/src/
- **18 component directories** organized by feature
- **4 main views**: home, chat, tmux, codex (need to change to: home, projects, project)
- **3 sidebar modes**: home, workspace, chat (need: home, project)
- View routing is state-based (no URL router)
- tRPC with React Query for data fetching
- Real-time WebSocket subscriptions for terminal streaming

### Current Backend Structure
- **16 files** in src/
- **9 tRPC routers** with 40+ endpoints
- TerminalManager orchestrates ClaudeSession instances
- TmuxManager handles tmux panes with output polling
- CodexManager spawns codex CLI jobs
- Smart compaction implemented (160k threshold)
- Persistence: JSON files for config/projects/terminals

### Key Components to Modify
| Component | Current | Target |
|-----------|---------|--------|
| HomeSidebarContent | home/projects/tmux/codex/settings | home/projects/settings |
| App.tsx | 4 views (home/chat/tmux/codex) | 3 views (home/projects/project) |
| Sidebar | 3 modes | 2 modes (home, project) |
| RightSidebar | Chat mode only | Project mode (Files + Context) |
| Home | Recent projects + quick actions | + Active Sessions section |

### Components to Create
- ProjectsView - full-screen project list
- ProjectView - container for project tabs
- ProjectSidebar - chat/terminal/git/history nav
- ChatView - existing Terminal, wrapped with tabs
- TerminalView - TmuxOrchestration with grid layout
- GitView - new component
- HistoryView - new component
- FileViewerModal - modal for viewing files

### Backend Changes Needed
- ChildAgent type and tracking
- Watch ~/.codex-agent/jobs/ for new jobs
- Link codex jobs to parent session
- New endpoints: sessions/:id/children, projects/:id/history
- Git operations endpoints (if not existing)

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| State-based routing | Keep existing pattern, no URL router needed |
| Reuse TmuxOrchestration | Already handles pane display, just needs grid layout |
| RightSidebar becomes Files + Context | Always visible in project view |
| ChatSidebarContent -> ProjectSidebar | Rename and add new nav items |
| Child agent badge on tabs | Shows "[3]" if 3 codex agents spawned |

## Issues Encountered
| Issue | Resolution |
|-------|------------|

## Resources
- SPEC-v2: /Users/saint/Dev/claude_control_panel/docs/SPEC-v2.md
- Frontend: /Users/saint/Dev/claude_control_panel/web/src/
- Backend: /Users/saint/Dev/claude_control_panel/src/
- Types: src/types.ts (both frontend and backend)

## Visual/Browser Findings
- Mobile breakpoint at 768px
- AppShell uses CSS Grid with named areas
- Sidebar width is fixed, main content flexes
- Dark theme with CSS variables (--void-*, --accent-*, --text-*)
