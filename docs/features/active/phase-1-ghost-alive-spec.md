# Phase 1: Ghost Alive

## Overview
Get Ghost running on Mac Mini, accessible via web chat. Can read/write files and run bash tools. Session persists across restarts. This is the foundation for everything else.

## Scope

### Included
- ghost-daemon with Express + WebSocket
- Claude Agent SDK session with streaming input/output
- Session persistence across daemon restarts
- Command Center web UI (moved from Phase 5)
- Ghost workspace with CLAUDE.md
- Basic tools: file access, bash execution
- launchd auto-start configuration
- Tests for core functionality

### Excluded (deferred to later phases)
- Axia integration (Phase 2)
- Tool creation workflow (Phase 2)
- Child agents (Phase 3)
- Heartbeat/scheduling (Phase 4)
- Electron desktop buddy (Phase 6)

## Acceptance Criteria
- [ ] Daemon starts using Agent SDK (no API key needed)
- [ ] Web UI connects via WebSocket
- [ ] Can send messages and receive streaming responses
- [ ] Claude can read/write files in workspace
- [ ] Claude can run bash commands
- [ ] Session persists across daemon restart
- [ ] Accessible from phone on same network
- [ ] launchd auto-starts on boot
- [ ] Build succeeds
- [ ] Admin verification complete

## Dependencies
- Claude CLI authenticated with OAuth (already done on system)
- `~/claude-workspace/` directory structure (created by setup.sh)

## Technical Notes
- Using `@anthropic-ai/claude-agent-sdk` which wraps Claude CLI
- NO API key - uses OAuth authentication from Claude CLI
- Session persistence via `resume: sessionId` option
- Streaming input via AsyncGenerator pattern
- Permission mode: `bypassPermissions` for autonomous operation
- `settingSources: ['project']` to load CLAUDE.md
