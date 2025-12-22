import { useState, useRef, useCallback } from 'react';
import type { TerminalBlock } from '../types/ui';
import type { ServerMessage } from '../types/messages';

interface UseTerminalReturn {
  blocks: TerminalBlock[];
  addUserCommand: (agentId: string, content: string) => void;
  handleServerMessage: (message: ServerMessage) => void;
  clearBlocks: (agentId: string) => void;
}

export function useTerminal(): UseTerminalReturn {
  const [blocks, setBlocks] = useState<TerminalBlock[]>([]);

  // Track streaming text blocks by messageId
  const streamingBlocksRef = useRef<Map<string, string>>(new Map());

  // Track tool blocks by toolUseId
  const toolBlocksRef = useRef<Map<string, string>>(new Map());

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

  const addUserCommand = useCallback((agentId: string, content: string) => {
    addBlock({
      type: 'user_command',
      agentId,
      content,
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
        addBlock({
          type: 'system',
          agentId,
          content: `Session initialized: ${message.sessionId.slice(0, 8)}...`,
        });
        break;
      }

      case 'turn_complete': {
        // Could add a subtle divider or stats display
        break;
      }
    }
  }, [addBlock, updateBlock]);

  const clearBlocks = useCallback((agentId: string) => {
    setBlocks(prev => prev.filter(b => b.agentId !== agentId));
  }, []);

  return { blocks, addUserCommand, handleServerMessage, clearBlocks };
}
