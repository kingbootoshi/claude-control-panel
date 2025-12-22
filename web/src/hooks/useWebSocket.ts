import { useState, useRef, useEffect, useCallback } from 'react';
import type { ClientMessage, ServerMessage } from '../types';

interface UseWebSocketReturn {
  connected: boolean;
  send: (message: ClientMessage) => void;
  connectionError: string | null;
}

export function useWebSocket(
  onMessage: (message: ServerMessage) => void
): UseWebSocketReturn {
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number>();
  const onMessageRef = useRef(onMessage);

  // Keep callback ref updated
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const connect = useCallback(() => {
    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setConnectionError(null);
      console.log('[WS] Connected');
    };

    ws.onclose = () => {
      setConnected(false);
      console.log('[WS] Disconnected, reconnecting in 2s...');
      // Reconnect after 2s
      reconnectTimeoutRef.current = window.setTimeout(connect, 2000);
    };

    ws.onerror = () => {
      setConnectionError('Connection failed');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as ServerMessage;
        onMessageRef.current(message);
      } catch (e) {
        console.error('[WS] Failed to parse message:', e);
      }
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((message: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('[WS] Cannot send, not connected');
    }
  }, []);

  return { connected, send, connectionError };
}
