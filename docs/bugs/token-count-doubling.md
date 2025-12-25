# Bug: Token Count Doubling on Each Turn

## Status
**Fixed** - Split cumulative vs current-context usage

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
Location: `src/claude-session.ts`
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
The SDK `result` usage is cumulative for the whole run. The current context
should be taken from the most recent assistant message usage.

### 4. Caching behavior
- `cache_read_input_tokens` might be duplicating what's in `input_tokens`
- Check Anthropic docs for exact semantics of these fields

## Fix
- Track `lastStepUsage` from assistant messages
- Emit `currentContextTokens` from the last step
- Emit `totalInputTokensSpent` from cumulative `result.usage`

## Notes
- Debug logging was added at `src/server.ts:102` to help investigate
- May need to log the raw `usage` object to see all fields and their values
