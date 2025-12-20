# Phase 3: Child Agents

## Overview
Ghost can spawn, manage, and communicate with child agents. Child agents are specialists for specific missions - they have their own workspaces, context windows, and tasks. They report back to Ghost when done.

## Scope

### Included
- spawn-agent tool (creates workspace, starts Agent SDK session)
- ping-agent tool (sends message to child agent)
- list-agents tool (shows active agents with status)
- kill-agent tool (terminates agent and cleans up)
- Agent state tracking (agents.json)
- Child-to-Ghost reporting (completion callbacks)
- Agent workspace template
- Tests for agent lifecycle

### Excluded (deferred to later phases)
- Agent scheduling/heartbeat (Phase 4)
- Agent-to-agent communication (Phase 7)
- Self-evolution (Phase 8)

## Acceptance Criteria
- [ ] Ghost can spawn a new agent with a task
- [ ] Each agent gets isolated workspace
- [ ] Ghost can list all active agents
- [ ] Ghost can send messages to specific agents
- [ ] Ghost can terminate agents
- [ ] Agent completion triggers callback to Ghost
- [ ] agents.json tracks all agent state
- [ ] All tests pass
- [ ] Build succeeds
- [ ] Admin verification complete

## Dependencies
- Phase 1 complete (Ghost running)
- Phase 2 recommended (tools infrastructure)

## Technical Notes
- Each agent is a separate Agent SDK query() call
- Agent workspaces at `~/claude-workspace/agents/<name>/`
- Each agent has own CLAUDE.md from template
- agents.json: { name, workspace, session_id, status, task, started_at }
- Completion detected via SDKResultMessage
