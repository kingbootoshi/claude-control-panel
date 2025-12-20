# Phase 6: Electron Buddy

## Overview
Desktop Ghost companion on MacBook Pro. A floating ghost icon that expands into a chat interface, lives in system tray, and supports voice input via whisper-server.

## Scope

### Included
- Electron app with floating Ghost icon
- Click-to-expand chat interface
- System tray integration
- Notification display from Ghost
- Voice input via whisper-server integration
- Push-to-talk with "over" termination
- Tests for UI components

### Excluded (deferred to later phases)
- Mobile native app (future consideration)
- Watch integration (future consideration)

## Acceptance Criteria
- [ ] Ghost icon floats on MacBook screen
- [ ] Clicking icon expands chat window
- [ ] System tray shows Ghost status
- [ ] Notifications appear for important events
- [ ] Voice input works via whisper-server
- [ ] Push-to-talk activates recording
- [ ] "Over" or button release stops recording
- [ ] All tests pass
- [ ] Build succeeds
- [ ] Admin verification complete

## Dependencies
- Phase 1 complete (Ghost daemon running)
- whisper-server running for voice input
- macOS (Electron target)

## Technical Notes
- Electron connects to same WebSocket as web UI
- Floating window: always-on-top, draggable
- System tray for notifications and quick actions
- Voice: integrate whisper-stream-server as input source
- Push-to-talk bound to hotkey
