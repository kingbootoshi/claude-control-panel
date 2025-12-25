# Bug: Token Count Doubling on Each Turn

## Status
**Open** - Not yet investigated

## Summary
Token count approximately doubles after each message instead of incrementing by the actual token usage.

## Observed Behavior
- Started at: ~23.1k tokens (after page load from history)
- After sending ONE short message: ~47k tokens
- Expected: ~24-25k tokens (original + ~500-1000 for new message/response)

## Expected Behavior
Token count should increment by the actual tokens used:
- User message tokens
- Assistant response tokens
- NOT double the entire context

## Reproduction
1. Load CCP with existing session (~23k tokens shown)
2. Send a short message
3. Observe token count jumps to ~47k instead of ~24k

## Potential Causes (To Investigate)

### 1. Double-counting in SDK token calculation
Location: `src/claude-session.ts:246-248`
```typescript
const totalInputTokens = (usage?.input_tokens || 0) +
  (usage?.cache_creation_input_tokens || 0) +
  (usage?.cache_read_input_tokens || 0);
```
- Are we summing fields that overlap?
- Is `input_tokens` already inclusive of cache tokens?

### 2. History token count vs live token count mismatch
- `lastTokenCount` from history may be calculated differently than live `inputTokens`
- History parsing: `src/history.ts` extracts from session file
- Live: SDK's `message.usage` object

### 3. SDK reports cumulative vs incremental
- Need to verify what SDK's `usage.input_tokens` actually represents
- Is it per-turn or cumulative for session?

### 4. Caching behavior
- `cache_read_input_tokens` might be duplicating what's in `input_tokens`
- Check Anthropic docs for exact semantics of these fields

## Files to Investigate
- `src/claude-session.ts` - Token calculation from SDK
- `src/history.ts` - Historical token extraction
- `src/server.ts:102` - Debug log added for token count
- SDK documentation for `usage` object structure

## Notes
- Debug logging was added at `src/server.ts:102` to help investigate
- May need to log the raw `usage` object to see all fields and their values
