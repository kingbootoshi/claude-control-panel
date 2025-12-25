import { EventEmitter } from 'events';
import { describe, expect, it, vi } from 'vitest';
import { appRouter } from '../src/trpc/router';
import { config } from '../src/config';
import type { MessageContent, SessionLike } from '../src/types';

class FakeSession extends EventEmitter implements SessionLike {
  sendMessage = vi.fn(async (_content: MessageContent) => undefined);
  getSessionId() {
    return null;
  }
}

describe('tRPC router', () => {
  it('sends a chat message through the session', async () => {
    const session = new FakeSession();
    const caller = appRouter.createCaller({
      session,
      agentId: config.primaryAgentId,
      assistantName: config.assistantName,
    });

    await caller.chat.send({
      agentId: config.primaryAgentId,
      content: 'hello',
    });

    expect(session.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('returns empty history when no session id exists', async () => {
    const session = new FakeSession();
    const caller = appRouter.createCaller({
      session,
      agentId: config.primaryAgentId,
      assistantName: config.assistantName,
    });

    const result = await caller.history.get({ agentId: config.primaryAgentId });
    expect(result.blocks).toEqual([]);
    expect(result.lastContextTokens).toBe(0);
  });
});
