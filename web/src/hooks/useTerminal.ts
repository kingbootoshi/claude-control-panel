import { useState, useRef, useCallback } from 'react';
import type { Attachment, HistoryResult, StreamEventMessage, TerminalBlock } from '../types';

interface UseTerminalReturn {
  blocks: TerminalBlock[];
  tokenCount: number;
  sessionSummary: string | null;
  addUserCommand: (agentId: string, content: string, attachments?: Attachment[]) => void;
  handleEvent: (message: StreamEventMessage) => void;
  applyHistory: (history: HistoryResult) => void;
  clearBlocks: (agentId: string) => void;
}

export function useTerminal(): UseTerminalReturn {
  const [blocks, setBlocks] = useState<TerminalBlock[]>([]);
  const [tokenCount, setTokenCount] = useState<number>(0);
  const [sessionSummary, setSessionSummary] = useState<string | null>(null);

  // Track streaming text blocks by messageId
  const streamingBlocksRef = useRef<Map<string, string>>(new Map());

  // Track tool blocks by toolUseId
  const toolBlocksRef = useRef<Map<string, string>>(new Map());

  // Track session ID to avoid init spam
  const currentSessionIdRef = useRef<string | null>(null);

  const addBlock = useCallback((block: Omit<TerminalBlock, 'id' | 'timestamp'>) => {
    const id = crypto.randomUUID();
    setBlocks(prev => [...prev, { ...block, id, timestamp: Date.now() }]);
    return id;
  }, []);

  const updateBlock = useCallback((id: string, updates: Partial<TerminalBlock>) => {
    setBlocks(prev => prev.map(block =>
      block.id === id ? { ...block, ...updates } : block
    ));
  }, []);

  const addUserCommand = useCallback((agentId: string, content: string, attachments?: Attachment[]) => {
    addBlock({
      type: 'user_command',
      agentId,
      content,
      attachments: attachments?.map(a => ({
        type: a.type,
        name: a.name,
        data: a.data,
        mimeType: a.mimeType,
      })),
    });
  }, [addBlock]);

  const handleEvent = useCallback((message: StreamEventMessage) => {
    const agentId = message.agentId;

    switch (message.type) {
      case 'text_delta': {
        const messageId = message.messageId ?? 'unknown';
        const existingBlockId = streamingBlocksRef.current.get(messageId);
        if (existingBlockId) {
          // Direct state update - React 18 batches automatically
          setBlocks(prev => prev.map(block =>
            block.id === existingBlockId
              ? { ...block, content: (block.content || '') + (message.content ?? '') }
              : block
          ));
        } else {
          // Create new streaming block
          const blockId = addBlock({
            type: 'text_streaming',
            agentId,
            content: message.content,
            isStreaming: true,
            messageId,
          });
          streamingBlocksRef.current.set(messageId, blockId);
        }
        break;
      }

      case 'text_complete': {
        const messageId = message.messageId ?? 'unknown';
        const blockId = streamingBlocksRef.current.get(messageId);
        if (blockId) {
          updateBlock(blockId, { type: 'text', isStreaming: false });
          streamingBlocksRef.current.delete(messageId);
        }
        break;
      }

      case 'tool_start': {
        const toolUseId = message.toolUseId ?? crypto.randomUUID();
        const blockId = addBlock({
          type: 'tool_use',
          agentId,
          toolUseId,
          toolName: message.toolName,
          toolInput: message.input,
        });
        toolBlocksRef.current.set(toolUseId, blockId);
        break;
      }

      case 'tool_result': {
        const toolUseId = message.toolUseId ?? '';
        const blockId = toolBlocksRef.current.get(toolUseId);
        if (blockId) {
          updateBlock(blockId, {
            toolResult: message.result,
            toolError: message.isError,
          });
          toolBlocksRef.current.delete(toolUseId);
        }
        break;
      }

      case 'thinking': {
        addBlock({
          type: 'thinking',
          agentId,
          content: message.content,
          collapsed: true,
        });
        break;
      }

      case 'error': {
        addBlock({
          type: 'error',
          agentId,
          content: message.content,
        });
        break;
      }

      case 'init': {
        // Only show init message when session ID actually changes
        const sessionId = message.sessionId ?? null;
        if (sessionId !== currentSessionIdRef.current) {
          currentSessionIdRef.current = sessionId;
          if (sessionId) {
            addBlock({
              type: 'system',
              agentId,
              content: `Session initialized: ${sessionId.slice(0, 8)}...`,
            });
          }
        }
        break;
      }

      case 'turn_complete': {
        if (typeof message.currentContextTokens === 'number') {
          setTokenCount(message.currentContextTokens);
        }
        break;
      }

      case 'compact_complete': {
        addBlock({
          type: 'system',
          agentId,
          content: `━━━ Compacted ━━━\nPrevious: ${message.preTokens?.toLocaleString() ?? 'unknown'} tokens`,
        });
        // Token count will update on next turn
        break;
      }

    }
  }, [addBlock, updateBlock]);

  const applyHistory = useCallback((history: HistoryResult) => {
    streamingBlocksRef.current.clear();
    toolBlocksRef.current.clear();
    const nonSummaryBlocks = history.blocks.filter((b) => b.type !== 'summary');
    setBlocks(nonSummaryBlocks);

    const summaryBlock = history.blocks.find((b) => b.type === 'summary');
    if (summaryBlock?.content) {
      setSessionSummary(summaryBlock.content);
    } else {
      setSessionSummary(null);
    }

    setTokenCount(history.lastContextTokens);

    const initBlocks = history.blocks.filter((b) =>
      b.type === 'system' && b.content?.includes('Session initialized')
    );
    const lastInit = initBlocks[initBlocks.length - 1];
    if (lastInit?.content) {
      const match = lastInit.content.match(/Session initialized: ([a-f0-9]+)/);
      if (match) {
        currentSessionIdRef.current = match[1];
      }
    }
  }, []);

  const clearBlocks = useCallback((agentId: string) => {
    setBlocks(prev => prev.filter(b => b.agentId !== agentId));
  }, []);

  return { blocks, tokenCount, sessionSummary, addUserCommand, handleEvent, applyHistory, clearBlocks };
}
