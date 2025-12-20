# Phase 2: Tools & Axia

## Overview
Ghost can query/store memories in Axia, create new bash tools, and has a growing toolkit. This gives Ghost long-term memory beyond the conversation and the ability to expand his own capabilities.

## Scope

### Included
- axia-query tool (search memories via Axia API)
- axia-store tool (save memories to Axia)
- axia-notes tool (read/write notes)
- Tool creation workflow (Ghost writes scripts to tools/)
- Tool registry in knowledge/tools.md
- notify-saint tool (Discord webhook notifications)
- Tests for all tools

### Excluded (deferred to later phases)
- Child agents (Phase 3)
- Agent scheduling (Phase 4)
- Inter-agent communication (Phase 7)

## Acceptance Criteria
- [ ] Ghost can query Axia for past memories
- [ ] Ghost can store new memories to Axia
- [ ] Ghost can create new bash tools in tools/
- [ ] Tool registry is maintained in knowledge/tools.md
- [ ] notify-saint sends Discord notifications
- [ ] Ghost has created at least one new tool himself
- [ ] All tests pass
- [ ] Build succeeds
- [ ] Admin verification complete

## Dependencies
- Phase 1 complete (Ghost running and responsive)
- Axia Records API endpoint and authentication
- Discord webhook URL for notifications

## Technical Notes
- Tools are bash scripts in `~/claude-workspace/tools/`
- Ghost creates tools via Write tool, then chmod +x
- Axia integration via curl in bash scripts
- Tool registry is markdown file Ghost can read/update
