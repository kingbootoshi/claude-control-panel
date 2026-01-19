# Tmux Integration Design - Observability and Steering

## Status
Draft

## Context
The control panel already manages Claude sessions via the Agent SDK and has a tmux orchestration surface in `src/tmux-manager.ts` and the `/tmux` UI. This design documents how to integrate tmux as the execution substrate for observability and steering while keeping the current UX and data flows consistent.

## Goals
- Provide tmux-backed session management for observability and steering.
- Allow operators to attach to sessions and send keystrokes.
- Capture output for UI streaming and post-hoc inspection.
- Keep integration macOS-friendly with explicit tmux detection.
- Use Bun for all subprocess interactions.

## Non-goals
- Full terminal emulation in the web UI.
- Replacing the Claude Agent SDK event model in the short term without a migration plan.

## Constraints
- Use Bun for subprocess management (Bun.spawn/spawnSync).
- Do not assume numeric defaults without measurement.
- macOS first, with sensible cross-platform behavior.

## Research Findings

### codex-agent tmux helper
From `/Users/saint/Dev/Tools/codex-agent/src/tmux.ts`:
- Uses `tmux new-session -d` to create a detached session per job.
- Uses `tmux send-keys` to steer interactive sessions.
- Uses `tmux load-buffer` and `tmux paste-buffer` to handle long prompts safely.
- Uses `tmux capture-pane` for snapshot output.
- Uses `script -q` to log output when running interactive CLI sessions.
- Uses `tmux list-sessions -F` to list sessions with format strings.

### tmux output capture and piping
From tmux references and docs:
- `capture-pane` supports:
  - `-p` to print to stdout.
  - `-S` and `-E` for start and end lines.
  - `-J` to join wrapped lines.
  - `-e` to include escape sequences.
  - `-S -` to capture from start of history.
- `pipe-pane -o "cmd"` streams new pane output to a command.
- `pipe-pane` with no args stops piping.
- `tee` can log output while keeping it visible in the pane.
- `#{pane_pipe}` can be used to check if piping is active.

## Proposed Design

### Overview
Introduce a tmux-backed session path that runs agent CLIs in tmux panes for observability and steering. Keep the current SDK-backed path for structured events. The backend is selected per terminal or via config.

### Session Wrapping Options

#### Option A - tmux-backed sessions
- Spawn the `claude` CLI inside a tmux pane.
- Use `tmux send-keys` for steering input.
- Use `pipe-pane` for streaming output to logs, and `capture-pane` for snapshots.
- This is the simplest path for observability and steering.

**Tradeoff**: UI loses structured tool events unless a parallel SDK session is maintained.

#### Option B - tmux mirror for SDK sessions
- Keep the Agent SDK as the source of truth.
- Spawn a tmux pane running a small bridge process that prints streamed output and forwards input to the daemon.
- Preserve structured events and still allow attach.

**Tradeoff**: Additional component and IPC complexity.

**Recommendation**: Start with Option A for tmux-backed sessions, retain SDK-backed terminals for the main chat UI. Option B can be added if we need tmux attach without losing structured events.

### TmuxManager API

Use a Bun-based tmux wrapper:

```typescript
class TmuxManager {
  async ensureSession(name: string): Promise<void>;
  async listSessions(): Promise<TmuxSession[]>;
  async listPanes(sessionName: string): Promise<TmuxPane[]>;
  async createPane(sessionName: string, opts?: { cwd?: string; split?: "h" | "v" }): Promise<TmuxPane>;
  async killPane(paneId: string): Promise<void>;
  async sendKeys(paneId: string, keys: string, opts?: { enter?: boolean }): Promise<void>;
  async sendControl(paneId: string, key: string): Promise<void>;
  async capturePane(paneId: string, opts?: { lines?: number; start?: string; end?: string; join?: boolean; escape?: boolean }): Promise<string>;
  async startPipePane(paneId: string, logPath: string): Promise<void>;
  async stopPipePane(paneId: string): Promise<void>;
  async attachInfo(paneId: string): Promise<{ sessionName: string; windowIndex: number; paneIndex: number }>;
}
```

### Output Capture Strategy

1. **pipe-pane for streaming**: On session start, run `pipe-pane -o "tee -a /path/to/log"` to stream output to a file.
2. **File watcher for UI**: Use Bun's file watching to stream new log lines to the UI via WebSocket.
3. **capture-pane for snapshots**: For on-demand full history, use `capture-pane -p -S - -J`.
4. **Line offset tracking**: Track last-read line offset per session for incremental reads.

### Steering

- `sendKeys(paneId, text)` - Send text input.
- `sendKeys(paneId, text, { enter: true })` - Send text and press Enter.
- `sendControl(paneId, "c")` - Send Ctrl+C to interrupt.
- For long prompts, use `load-buffer` + `paste-buffer` pattern from codex-agent.

### Data Model Updates

Extend terminal metadata in `src/types.ts`:

```typescript
interface Terminal {
  // ... existing fields
  backend: "sdk" | "tmux";
  tmuxSession?: string;
  tmuxPaneId?: string;
  tmuxLogPath?: string;
}
```

### TerminalManager Changes

- Add a `backend` option to spawn, send, close, resume.
- For tmux backend:
  - Ensure tmux session exists.
  - Create a pane and spawn claude CLI.
  - Start pipe-pane logging.
  - Store tmux identifiers in terminal metadata.
- For close and kill:
  - Stop piping.
  - Kill pane or leave session for later resume.

### API Endpoints

Extend `src/trpc/router.ts`:

```typescript
tmux: {
  sessions: () => TmuxSession[];
  panes: (sessionName: string) => TmuxPane[];
  capture: (paneId: string, opts?: CaptureOpts) => string;
  sendKeys: (paneId: string, keys: string, opts?: SendKeysOpts) => void;
  sendControl: (paneId: string, key: string) => void;
  attachCommand: (paneId: string) => string; // Returns "tmux attach -t session:window.pane"
}
```

### Storage

- Tmux logs stored at: `config.workspaceRoot/state/tmux/<terminalId>.log`
- Track read offsets in terminal metadata for incremental streaming.

## Required Changes

### New Files
- `src/tmux-manager.ts` - TmuxManager class (or update existing).

### Modified Files
- `src/types.ts` - Add tmux fields to Terminal interface.
- `src/terminal-manager.ts` - Add tmux backend support.
- `src/trpc/router.ts` - Add tmux endpoints.
- `web/src/types.ts` - Mirror Terminal type changes.

### Optional
- Update `web/src/components/TmuxOrchestration/` if needed.

## Cross-Platform Considerations

- Check tmux availability with `which tmux` before using.
- Gracefully degrade to SDK-only mode if tmux unavailable.
- macOS: tmux usually at `/opt/homebrew/bin/tmux` or `/usr/local/bin/tmux`.
- Linux: tmux usually at `/usr/bin/tmux`.

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| tmux not installed | Detect and fall back to SDK-only mode |
| Output capture lag | Use pipe-pane streaming instead of polling |
| Scrollback overflow | Configure tmux history-limit appropriately |
| Session name conflicts | Use unique prefixes (e.g., "ccp-<terminalId>") |

## Open Questions

1. Should Option A or Option B be implemented first?
2. What is the default scrollback limit to configure?
3. Should tmux sessions persist across control panel restarts?
4. How to handle tmux session cleanup on crash?

## Next Steps

1. Decide on Option A vs Option B.
2. Create or update `src/tmux-manager.ts` with Bun.spawn.
3. Add Terminal backend field and tmux metadata.
4. Implement tRPC endpoints for tmux operations.
5. Update UI to show tmux attach option.
