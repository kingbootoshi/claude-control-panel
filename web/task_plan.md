# Task Plan: Claude Control Panel v2 Full Refactor

## Goal
Refactor Claude Control Panel from current mixed architecture to SPEC-v2: project-scoped views with Chat/Terminal/Git/History tabs, remove global orchestration/codex pages, add child agent linkage, and implement full IDE-style layout.

## Current Phase
Phase 1

## Phases

### Phase 1: Navigation Restructure (Frontend Focus)
- [ ] Remove orchestration/codex from global HomeSidebarContent
- [ ] Create ProjectsView component (full-screen project list)
- [ ] Merge "Agents" into "Active Sessions" on Home dashboard
- [ ] Create ProjectSidebar with chat/terminal/git/history nav
- [ ] Update App.tsx routing for new view structure
- [ ] Auto-create "General" project on first launch
- **Status:** in_progress
- **Owner:** Claude (Frontend)

### Phase 2: Project View Layout (Frontend Focus)
- [ ] Create ProjectView container component
- [ ] Implement left sidebar (ProjectSidebar)
- [ ] Implement right sidebar (Files + Session Context)
- [ ] Create ChatView with session tabs
- [ ] Add child agent badge to chat tabs
- [ ] Implement tab management (create, close, switch)
- **Status:** pending
- **Owner:** Claude (Frontend)

### Phase 3: Terminal View (Frontend + Backend)
- [ ] Create TerminalView with tab + grid system
- [ ] Implement pane grid layouts (2x2, split horizontal/vertical)
- [ ] Wire TmuxOrchestration into TerminalView
- [ ] Add pane resize/rearrange capability
- [ ] Create "Add Terminal" button for manual panes
- **Status:** pending
- **Owner:** Claude (Frontend) + Codex (Backend tmux enhancements)

### Phase 4: Agent Linkage (Backend Focus)
- [ ] Add childAgents array to Session type
- [ ] Watch ~/.codex-agent/jobs/ for new codex jobs
- [ ] Link codex jobs to parent Claude session
- [ ] Auto-create terminal panes when codex spawns
- [ ] Auto-close panes when codex completes
- [ ] Update tRPC endpoints for child agent queries
- **Status:** pending
- **Owner:** Codex (Backend)

### Phase 5: Git View (Frontend Focus)
- [ ] Create GitView component
- [ ] Implement file change list (staged/unstaged/untracked)
- [ ] Add diff viewer for file changes
- [ ] Show commit history
- [ ] Add stage/unstage functionality
- **Status:** pending
- **Owner:** Claude (Frontend) + Codex (Backend git operations)

### Phase 6: Files Sidebar (Frontend Focus)
- [ ] Enhance RightSidebar with full file tree
- [ ] Add "Session Changes" section (added/modified/deleted)
- [ ] Implement file viewer modal
- [ ] Add file search/filter
- [ ] Color-code changed files (green/yellow/red)
- **Status:** pending
- **Owner:** Claude (Frontend)

### Phase 7: History View (Frontend + Backend)
- [ ] Create HistoryView component
- [ ] List all sessions for project chronologically
- [ ] Show session metadata (timestamp, preview, tokens)
- [ ] Implement "Resume Session" functionality
- [ ] Add "Delete Session" with confirmation
- **Status:** pending
- **Owner:** Claude (Frontend) + Codex (Backend history endpoints)

### Phase 8: Polish & Integration
- [ ] Mobile responsive layouts for new views
- [ ] Keyboard shortcuts (Escape to home, etc.)
- [ ] Loading states and error handling
- [ ] TypeScript strict mode compliance
- [ ] Run full test suite
- **Status:** pending
- **Owner:** Both

## Key Questions
1. ~~File viewer: CCP modal or external editor?~~ -> CCP modal, ESC to close
2. ~~Terminal input: Interactive or view-only?~~ -> Interactive (user can type)
3. ~~Session persistence: How long?~~ -> Forever
4. ~~General project: Auto-create or manual?~~ -> Auto-create on first launch

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Claude = SDK only | Never run `claude` CLI in terminals, all through Agent SDK |
| Codex = Terminal/tmux | Codex agents visible in Terminal view, linked to parent session |
| Project-scoped everything | No global orchestration/codex pages |
| "General" is just a project | cwd = workspace root, no special treatment |
| File viewer as modal | Opens in CCP, ESC to close, no external editor |
| Session history forever | Valuable data, user can delete manually |
| Interactive terminal panes | User can type in terminal panes |
| Tab + grid for terminals | Each tab can split into panes (2x2, etc.) |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|

## Notes
- Frontend work: Claude (me) handles directly
- Backend work: Delegate to Codex agents via /codex-orchestrator
- Focus on Phase 1-2 frontend while Codex works on Phase 4 backend
- TypeScript strict, no `any`, Tailwind CSS defaults
- Test after each phase: `bunx tsc --noEmit` + visual verification
