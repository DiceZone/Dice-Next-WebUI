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
export declare function useWebSocket(url: string): {
    connected: boolean;
    subscribe: (eventType: string, handler: WsEventHandler) => (() => void);
};
