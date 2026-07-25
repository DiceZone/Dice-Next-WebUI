/**
 * WebSocket Client
 *
 * Provides automatic reconnection, event dispatch, and heartbeat
 * for communicating with the backend WebSocket push service.
 *
 * Event format (section 8.5):
 *   { "type": "event_name", "timestamp": "...", "payload": {...} }
 *
 * Usage:
 *   const ws = new WsClient('/ws');
 *   ws.on('adapter_connected', (payload) => { ... });
 *   ws.connect();
 */
export interface WsEvent {
    type: string;
    timestamp: string;
    payload: unknown;
}
export type WsEventHandler = (payload: unknown, event: WsEvent) => void;
/** Reconnection configuration. */
interface WsClientConfig {
    /** Base reconnection delay in milliseconds (default: 1000). */
    reconnectBaseDelay: number;
    /** Maximum reconnection delay in milliseconds (default: 30000). */
    reconnectMaxDelay: number;
    /** Exponential backoff factor (default: 2). */
    reconnectBackoff: number;
    /** Heartbeat interval in milliseconds (default: 30000). */
    heartbeatInterval: number;
}
export declare class WsClient {
    private url;
    private ws;
    private config;
    private reconnectAttempts;
    private reconnectTimer;
    private heartbeatTimer;
    private eventHandlers;
    private connected;
    constructor(url: string, config?: Partial<WsClientConfig>);
    /** Open the WebSocket connection. */
    connect(): void;
    /** Close the connection and stop reconnection attempts. */
    disconnect(): void;
    /** Whether the client is currently connected. */
    isConnected(): boolean;
    /** Register a handler for a specific event type. */
    on(eventType: string, handler: WsEventHandler): () => void;
    /** Remove a specific handler for an event type. */
    off(eventType: string, handler: WsEventHandler): void;
    /** Remove all handlers for an event type (or all handlers if no type given). */
    offAll(eventType?: string): void;
    private handleOpen;
    private handleMessage;
    private handleClose;
    private handleError;
    private scheduleReconnect;
    private clearReconnect;
    private startHeartbeat;
    private stopHeartbeat;
    private dispatch;
    private cleanup;
}
export default WsClient;
