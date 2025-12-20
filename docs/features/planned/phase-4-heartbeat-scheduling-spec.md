# Phase 4: Heartbeat & Scheduling

## Overview
Agents can sleep and wake on schedule or triggers. This enables long-running tasks where agents wake periodically, do work, then sleep again. Ghost manages the schedule.

## Scope

### Included
- schedule-wake tool (cron-style scheduling)
- Scheduler daemon component
- Wake queue processing
- Trigger system (time-based, agent-completed)
- schedules.json state management
- Tests for scheduling logic

### Excluded (deferred to later phases)
- Inter-agent triggers (Phase 7)
- Self-scheduling improvements (Phase 8)

## Acceptance Criteria
- [ ] Ghost can schedule an agent to wake at a specific time
- [ ] Ghost can schedule recurring wakes (cron-style)
- [ ] Agents wake and receive their prompt automatically
- [ ] Agent completion can trigger another agent's wake
- [ ] schedules.json persists across daemon restart
- [ ] news-scout example: wakes every 4 hours
- [ ] All tests pass
- [ ] Build succeeds
- [ ] Admin verification complete

## Dependencies
- Phase 3 complete (child agents)

## Technical Notes
- schedules.json: { agent, cron_expression, prompt, triggers }
- Use node-cron or similar for scheduling
- Wake triggers: time, agent-complete, manual
- Agents can request their own next wake time
- Scheduler runs as part of daemon, not separate process
