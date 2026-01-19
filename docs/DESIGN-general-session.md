# General Session (Ghost) - Design

## Status
Draft

## Goal
Provide a single persistent, non-project Claude session for computer interaction.
Session uses projectId null and cwd set to user home.

## Current Behavior

### Backend
- `src/terminal-manager.ts` spawns a new terminal for every request. projectId null uses cwd = config.workspaceRoot.
- Session state is stored per terminal in `config.workspaceRoot/state/terminals/<id>.json` and metadata in `.ccp-terminals.json` via `src/terminal-store.ts`.
- On startup, running or starting terminals are marked closed. There is no auto-resume.
- Shutdown in `src/index.ts` calls kill on all terminals, deleting session files.

### Claude Session
- `src/claude-session.ts` calls SDK query with:
  - settingSources ["user","project"]
  - allowedTools includes "Skill"
  - cwd from TerminalManager
- Per SDK docs, settingSources "user" loads skills from `~/.claude/skills`.

### UI
- `web/src/components/Home/QuickMenu.tsx` shows "General Chat" for projectId=null with icon ">".
- `web/src/components/Header/TabBar.tsx` shows "Chat" for projectId=null.
- `web/src/components/ChatSidebarContent.tsx` shows recent sessions including non-project ones.

## Proposed Design

### Ghost Session Behavior
1. A single "general" session with a stable well-known ID (e.g., "ghost" or "general").
2. projectId = null, cwd = os.homedir() (not workspaceRoot).
3. Session file stored in workspaceRoot/state/terminals/ghost.json for persistence.
4. On control panel startup, auto-resume the ghost session if it exists.
5. On shutdown, close (not kill) the ghost session to preserve state.

### Spawning
- When user clicks "New Chat" or "General Chat":
  - If ghost session exists and is running/idle, focus it.
  - If ghost session exists but closed, resume it.
  - If no ghost session, create one with projectId=null, cwd=homedir.

### Persistence
- Store ghost terminal metadata separately or mark it as persistent in terminal-store.
- On startup in `src/index.ts`, check for ghost session and call resume instead of marking closed.
- On shutdown, call close instead of kill for the ghost session.

### Skills Integration
- settingSources ["user","project"] already loads ~/.claude/skills.
- cwd=homedir means project-level CLAUDE.md is at ~/CLAUDE.md if present.
- No code changes needed for skill loading.

### UI Differentiation
- Label: "Ghost" or "General" (configurable).
- Icon: distinct from project sessions (e.g., ghost icon or home icon).
- Always show in sidebar/tabs even when no active conversation.
- Optional: pin to top of session list.

## Required Changes

### Backend
- `src/terminal-manager.ts`:
  - Add spawning logic for ghost session with cwd=homedir.
  - Add resume-on-startup logic.
  - Add close-instead-of-kill logic for ghost session.
- `src/terminal-store.ts`:
  - Mark ghost session as persistent.
- `src/index.ts`:
  - Check for ghost session on startup and resume.
  - Close ghost session on shutdown instead of kill.

### Frontend
- `web/src/components/Home/QuickMenu.tsx`:
  - Show "Ghost" option that opens/resumes the ghost session.
- `web/src/components/Header/TabBar.tsx`:
  - Show "Ghost" label for the ghost terminal.
- `web/src/components/ChatSidebarContent.tsx`:
  - Pin ghost session to top of list.
- `web/src/components/Home/QuickActions.tsx`:
  - Add quick action for ghost session.

### Optional
- `src/trpc/router.ts` and `web/src/components/FilesView/FilesView.tsx`:
  - If file browser should use home directory for ghost session.

## New Files
None required. All changes are to existing files.

## Complexity
Medium. Touches backend session lifecycle and multiple UI components but uses existing persistence mechanisms.

## Open Questions
1. Should ghost session auto-start on control panel launch?
2. What label/icon to use? "Ghost", "General", "Home"?
3. Should file browser show home directory for ghost session?

## Next Steps
1. Confirm preferred label and auto-resume behavior.
2. Implement backend changes (terminal-manager, index.ts).
3. Implement frontend changes (QuickMenu, TabBar, sidebar).
4. Test persistence across control panel restarts.
