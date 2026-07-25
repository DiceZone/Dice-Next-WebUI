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

const DEFAULT_CONFIG: WsClientConfig = {
  reconnectBaseDelay: 1000,
  reconnectMaxDelay: 30000,
  reconnectBackoff: 2,
  heartbeatInterval: 30000,
};

export class WsClient {
  private url: string;
  private ws: WebSocket | null = null;
  private config: WsClientConfig;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private eventHandlers: Map<string, Set<WsEventHandler>> = new Map();
  private connected = false;

  constructor(url: string, config?: Partial<WsClientConfig>) {
    this.url = url;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ─── Connection Lifecycle ──────────────────────────────────

  /** Open the WebSocket connection. */
  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.cleanup();

    try {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
    } catch (err) {
      console.error('[WsClient] Failed to create WebSocket:', err);
      this.scheduleReconnect();
    }
  }

  /** Close the connection and stop reconnection attempts. */
  disconnect(): void {
    this.cleanup();
    this.clearReconnect();
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.connected = false;
    this.reconnectAttempts = 0;
  }

  /** Whether the client is currently connected. */
  isConnected(): boolean {
    return this.connected && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  // ─── Event System ──────────────────────────────────────────

  /** Register a handler for a specific event type. */
  on(eventType: string, handler: WsEventHandler): () => void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.off(eventType, handler);
    };
  }

  /** Remove a specific handler for an event type. */
  off(eventType: string, handler: WsEventHandler): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.eventHandlers.delete(eventType);
      }
    }
  }

  /** Remove all handlers for an event type (or all handlers if no type given). */
  offAll(eventType?: string): void {
    if (eventType) {
      this.eventHandlers.delete(eventType);
    } else {
      this.eventHandlers.clear();
    }
  }

  // ─── Internal Handlers ─────────────────────────────────────

  private handleOpen(): void {
    this.connected = true;
    this.reconnectAttempts = 0;
    this.startHeartbeat();
    this.dispatch('ws:connected', null);
    console.log('[WsClient] Connected');
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data as string) as WsEvent;

      if (!data.type) {
        console.warn('[WsClient] Received event without type:', data);
        return;
      }

      // Handle internal events
      if (data.type === 'ws:pong') {
        return; // heartbeat response, nothing to do
      }

      // Dispatch to registered handlers
      this.dispatch(data.type, data.payload, data);
    } catch (err) {
      console.error('[WsClient] Failed to parse message:', err);
    }
  }

  private handleClose(event: CloseEvent): void {
    this.connected = false;
    this.stopHeartbeat();
    this.dispatch('ws:disconnected', { code: event.code, reason: event.reason });

    console.log('[WsClient] Disconnected — code:', event.code, 'reason:', event.reason);

    // Only reconnect on abnormal closure
    if (event.code !== 1000) {
      this.scheduleReconnect();
    }
  }

  private handleError(event: Event): void {
    console.error('[WsClient] Error:', event);
    // The close handler will fire after this, triggering reconnect
  }

  // ─── Reconnection ──────────────────────────────────────────

  private scheduleReconnect(): void {
    this.clearReconnect();

    const delay = Math.min(
      this.config.reconnectBaseDelay * Math.pow(this.config.reconnectBackoff, this.reconnectAttempts),
      this.config.reconnectMaxDelay
    );

    console.log(`[WsClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // ─── Heartbeat ─────────────────────────────────────────────

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ws:ping', timestamp: new Date().toISOString() }));
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ─── Internal Dispatch ─────────────────────────────────────

  private dispatch(eventType: string, payload: unknown, fullEvent?: WsEvent): void {
    const handlers = this.eventHandlers.get(eventType);
    if (!handlers || handlers.size === 0) return;

    const event: WsEvent = fullEvent ?? {
      type: eventType,
      timestamp: new Date().toISOString(),
      payload,
    };

    handlers.forEach((handler) => {
      try {
        handler(payload, event);
      } catch (err) {
        console.error(`[WsClient] Handler error for "${eventType}":`, err);
      }
    });
  }

  // ─── Cleanup ───────────────────────────────────────────────

  private cleanup(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
    }
  }
}

export default WsClient;
