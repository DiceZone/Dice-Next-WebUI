import { useEffect, useRef, useState, useCallback } from 'react';
import WsClient from '@/lib/ws-client';
import type { WsEventHandler } from '@/lib/ws-client';

/**
 * WebSocket connection hook.
 *
 * Manages a persistent WebSocket connection with automatic reconnection
 * and event subscription management.
 *
 * @param url - WebSocket endpoint (e.g., '/ws')
 * @returns `{ connected, subscribe }`
 *
 * @example
 * ```ts
 * const { connected, subscribe } = useWebSocket('/ws');
 *
 * useEffect(() => {
 *   const unsub = subscribe('log_entry', (payload) => {
 *     console.log('New log:', payload);
 *   });
 *   return unsub;
 * }, [subscribe]);
 * ```
 */
export function useWebSocket(url: string) {
  const [connected, setConnected] = useState(false);
  const clientRef = useRef<WsClient | null>(null);
  const unsubsRef = useRef<Map<WsEventHandler, () => void>>(new Map());

  useEffect(() => {
    const client = new WsClient(url);

    const unsubConnected = client.on('ws:connected', () => {
      setConnected(true);
    });
    const unsubDisconnected = client.on('ws:disconnected', () => {
      setConnected(false);
    });

    client.connect();
    clientRef.current = client;

    return () => {
      unsubConnected();
      unsubDisconnected();
      client.disconnect();
      clientRef.current = null;
    };
  }, [url]);

  /**
   * Subscribe to a WebSocket event type.
   * Returns an unsubscribe function. Subscriptions are automatically
   * cleaned up when the component unmounts.
   */
  const subscribe = useCallback(
    (eventType: string, handler: WsEventHandler): (() => void) => {
      const client = clientRef.current;
      if (!client) return () => {};

      const unsub = client.on(eventType, handler);
      unsubsRef.current.set(handler, unsub);

      // Return a cleanup function that removes from our map too
      return () => {
        unsub();
        unsubsRef.current.delete(handler);
      };
    },
    []
  );

  return { connected, subscribe };
}
