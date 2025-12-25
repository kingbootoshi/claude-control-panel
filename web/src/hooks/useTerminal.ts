import { useState, useRef, useCallback } from 'react';
import type { TerminalBlock } from '../types/ui';
import type { ServerMessage, Attachment } from '../types/messages';

interface UseTerminalReturn {
  blocks: TerminalBlock[];
  tokenCount: number;
  sessionSummary: string | null;
  addUserCommand: (agentId: string, content: string, attachments?: Attachment[]) => void;
  handleServerMessage: (message: ServerMessage) => void;
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

  const handleServerMessage = useCallback((message: ServerMessage) => {
    // Skip non-content messages
    if (message.type === 'pong') return;

    // Status messages don't have agentId
    if (message.type === 'status') {
      // Could update agent list here
      return;
    }

    const agentId = message.agentId;

    switch (message.type) {
      case 'text_delta': {
        const existingBlockId = streamingBlocksRef.current.get(message.messageId);
        if (existingBlockId) {
          // Append to existing block
          setBlocks(prev => prev.map(block => {
            if (block.id === existingBlockId) {
              return { ...block, content: (block.content || '') + message.content };
            }
            return block;
          }));
        } else {
          // Create new streaming block
          const blockId = addBlock({
            type: 'text_streaming',
            agentId,
            content: message.content,
            isStreaming: true,
            messageId: message.messageId,
          });
          streamingBlocksRef.current.set(message.messageId, blockId);
        }
        break;
      }

      case 'text_complete': {
        const blockId = streamingBlocksRef.current.get(message.messageId);
        if (blockId) {
          updateBlock(blockId, { type: 'text', isStreaming: false });
          streamingBlocksRef.current.delete(message.messageId);
        }
        break;
      }

      case 'tool_start': {
        const blockId = addBlock({
          type: 'tool_use',
          agentId,
          toolUseId: message.toolUseId,
          toolName: message.toolName,
          toolInput: message.input,
        });
        toolBlocksRef.current.set(message.toolUseId, blockId);
        break;
      }

      case 'tool_result': {
        const blockId = toolBlocksRef.current.get(message.toolUseId);
        if (blockId) {
          updateBlock(blockId, {
            toolResult: message.result,
            toolError: message.isError,
          });
          toolBlocksRef.current.delete(message.toolUseId);
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
        if (message.sessionId !== currentSessionIdRef.current) {
          currentSessionIdRef.current = message.sessionId;
          addBlock({
            type: 'system',
            agentId,
            content: `Session initialized: ${message.sessionId.slice(0, 8)}...`,
          });
        }
        break;
      }

      case 'turn_complete': {
        if (message.inputTokens) {
          setTokenCount(message.inputTokens);
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

      case 'history': {
        // Replace blocks with history from server (excluding summary blocks from main view)
        const nonSummaryBlocks = message.blocks.filter((b: { type: string }) => b.type !== 'summary');
        setBlocks(nonSummaryBlocks);
        // Extract summary for right sidebar
        const summaryBlock = message.blocks.find((b: { type: string }) => b.type === 'summary');
        if (summaryBlock?.content) {
          setSessionSummary(summaryBlock.content);
        }
        // Set token count from history
        if (message.lastTokenCount) {
          setTokenCount(message.lastTokenCount);
        }
        // Extract session ID from the last init block if present
        const initBlocks = message.blocks.filter((b: { type: string; content?: string }) =>
          b.type === 'system' && b.content?.includes('Session initialized')
        );
        const lastInit = initBlocks[initBlocks.length - 1];
        if (lastInit?.content) {
          const match = lastInit.content.match(/Session initialized: ([a-f0-9]+)/);
          if (match) {
            currentSessionIdRef.current = match[1];
          }
        }
        break;
      }
    }
  }, [addBlock, updateBlock]);

  const clearBlocks = useCallback((agentId: string) => {
    setBlocks(prev => prev.filter(b => b.agentId !== agentId));
  }, []);

  return { blocks, tokenCount, sessionSummary, addUserCommand, handleServerMessage, clearBlocks };
}
