# Phase 7: Inter-Agent Communication

## Overview
Agents can talk to each other directly, not just through Ghost. This enables collaborative workflows where specialists coordinate without Ghost mediating every interaction.

## Scope

### Included
- Agent-to-agent messaging tools
- Shared resource access patterns
- Agent collaboration workflows
- Message queue system between agents
- Tests for inter-agent messaging

### Excluded (deferred to later phases)
- Self-evolution of communication patterns (Phase 8)

## Acceptance Criteria
- [ ] Agent A can send message directly to Agent B
- [ ] Agent B receives and can respond
- [ ] Ghost is notified of inter-agent communication
- [ ] Shared resources can be safely accessed
- [ ] news-scout example: finds article, pings story-builder directly
- [ ] story-builder acknowledges and incorporates
- [ ] All tests pass
- [ ] Build succeeds
- [ ] Admin verification complete

## Dependencies
- Phase 3 complete (child agents exist)
- Phase 4 complete (agents can wake)

## Technical Notes
- Agents reference each other by name
- Messages go through daemon's message routing
- Ghost can observe but doesn't have to mediate
- Locking mechanism for shared resource access
- Event log for inter-agent communication audit
