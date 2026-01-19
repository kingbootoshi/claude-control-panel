# SPEC-v2 Implementation Issues

Tracking document for bugs, quirks, and missing features discovered during SPEC-v2 refactor testing.

## Critical Issues

### 1. tRPC 404 Errors - sessions.children
- **Status**: Bug
- **Severity**: High
- **Description**: `GET /trpc/sessions.children` returning 404 Not Found
- **Screenshot**: Console shows repeated 404 errors for sessions.children queries
- **Cause**: The endpoint expects sessionId but frontend is passing terminalId
- **Fix needed**: Align session ID vs terminal ID - frontend passes terminal.id but backend expects session.sessionId

### 2. tRPC 404 Errors - git.status, git.branches
- **Status**: Bug
- **Severity**: High
- **Description**: Git endpoints returning 404 for new projects without git repo
- **Screenshot**: "Loading git status..." spinner forever
- **Cause**: New projects don't have git initialized, but frontend calls git.status anyway
- **Fix needed**:
  - Check if .git directory exists before calling git endpoints
  - Show "Not a git repository - Initialize?" message instead of spinner

### 3. tRPC 404 Errors - history.listByProject
- **Status**: Bug
- **Severity**: High
- **Description**: History tab stuck on "Loading session history..."
- **Screenshot**: History tab shows loading state forever
- **Cause**: Likely the history.ts backend can't find session files for new projects
- **Fix needed**: Handle case where no sessions exist for a project gracefully

### 4. Chat Streaming Very Slow / No Visual Feedback
- **Status**: Bug
- **Severity**: High
- **Description**: Terminal/chat works but extremely slow, no streaming visible
- **User report**: "the terminal works its just really slow. doesnt show streaming or anything"
- **Cause**: Unknown - could be subscription issue or rendering bottleneck
- **Fix needed**: Debug why text_delta events aren't showing incrementally

## Medium Issues

### 5. Ghost Tab Showing in Project View
- **Status**: UX Issue
- **Severity**: Medium
- **Description**: "Ghost" home tab appears in project tab bar along with project sessions
- **Screenshot**: Tab bar shows "Test", "Ghost", "test2"
- **Expected**: Ghost should only appear in home view or have different treatment
- **Fix needed**: Filter out Ghost from project-specific tab bar or design different UX

### 6. Session History Disappears After Navigation
- **Status**: Bug
- **Severity**: Medium
- **Description**: "history on a session completely disappeared and didnt load back"
- **Cause**: Likely blocks state getting cleared on navigation or terminal switch
- **Fix needed**: Investigate useTerminal hook and block persistence

### 7. Project Files Not Loading
- **Status**: Bug
- **Severity**: Medium
- **Description**: "Project Files" section shows "No files" even for projects with files
- **Screenshot**: RightSidebar shows empty project files
- **Cause**: Project path might not be pointing to actual directory, or file listing failing
- **Fix needed**: Debug files.listProject endpoint

## Feature Gaps

### 8. No "Open Existing Project" Option
- **Status**: Feature Request
- **Severity**: Medium
- **Description**: User wants IDE-style "open existing project" to add existing git repos
- **Current behavior**: Can only create new projects
- **Fix needed**: Add file picker or path input to add existing directories as projects

### 9. Terminal Tab Purpose Unclear
- **Status**: UX Issue
- **Severity**: Low
- **Description**: Terminal tab shows TmuxOrchestration but user unclear on purpose
- **User report**: "not sure what the terminal is maybe that requires diff integration later?"
- **Fix needed**: Better labeling or help text explaining Terminal vs Chat

### 10. Tmux Panes Not Doing Much
- **Status**: Feature Gap
- **Severity**: Low
- **Description**: Tmux integration visible but "didnt really work or do anything"
- **Screenshot**: Shows pane with zsh and codex but no clear workflow
- **Fix needed**: Design clearer tmux workflow or simplify to just show output

## Error Log from Console

```
GET http://localhost:3847/trpc/sessions.children?... 404 (Not Found)
GET http://localhost:3847/trpc/git.status?... 404 (Not Found)
GET http://localhost:3847/trpc/git.branches?... 404 (Not Found)
GET http://localhost:3847/trpc/history.listByProject?... 404 (Not Found)
```

## Summary

| Category | Count |
|----------|-------|
| Critical | 4 |
| Medium | 3 |
| Feature Gaps | 3 |
| **Total** | **10** |

## Next Steps

1. Fix tRPC endpoint mismatches (sessions.children, git.*, history.*)
2. Add git repo existence check before showing GitView
3. Investigate streaming slowness
4. Improve Ghost session handling in UI
5. Add "Open Existing Project" feature
