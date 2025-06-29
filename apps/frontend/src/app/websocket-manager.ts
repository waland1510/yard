import { WS_URL, ENABLE_DEBUG } from '../config/environment';

interface WebSocketConfig {
  url: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
  connectionTimeout: number;
}

interface WebSocketState {
  socket: WebSocket | null;
  isConnected: boolean;
  isReconnecting: boolean;
  reconnectAttempts: number;
  lastError: Error | null;
  listeners: Set<(event: MessageEvent) => void>;
  connectionPromise: Promise<WebSocket> | null;
}

class WebSocketManager {
  private config: WebSocketConfig;
  private state: WebSocketState;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<WebSocketConfig> = {}) {
    this.config = {
      url: WS_URL,
      reconnectInterval: 3000,
      maxReconnectAttempts: 5,
      heartbeatInterval: 30000,
      connectionTimeout: 10000,
      ...config
    };

    if (ENABLE_DEBUG) {
      console.log('🔌 WebSocket Manager initialized:', {
        url: this.config.url,
        reconnectInterval: this.config.reconnectInterval,
        maxReconnectAttempts: this.config.maxReconnectAttempts,
      });
    }

    this.state = {
      socket: null,
      isConnected: false,
      isReconnecting: false,
      reconnectAttempts: 0,
      lastError: null,
      listeners: new Set(),
      connectionPromise: null
    };
  }

  async connect(): Promise<WebSocket> {
    if (this.state.connectionPromise) {
      return this.state.connectionPromise;
    }

    this.state.connectionPromise = this.createConnection();
    return this.state.connectionPromise;
  }

  private createConnection(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      try {
        const socket = new WebSocket(this.config.url);
        const timeoutId = setTimeout(() => {
          socket.close();
          reject(new Error('WebSocket connection timeout'));
        }, this.config.connectionTimeout);

        socket.onopen = () => {
          clearTimeout(timeoutId);
          this.handleOpen(socket);
          resolve(socket);
        };

        socket.onclose = (event) => {
          clearTimeout(timeoutId);
          this.handleClose(event);
        };

        socket.onerror = (error) => {
          clearTimeout(timeoutId);
          this.handleError(error);
          reject(new Error('WebSocket connection failed'));
        };

        socket.onmessage = (event) => {
          this.handleMessage(event);
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  private handleOpen(socket: WebSocket): void {
    console.log('WebSocket connected successfully');

    this.state.socket = socket;
    this.state.isConnected = true;
    this.state.isReconnecting = false;
    this.state.reconnectAttempts = 0;
    this.state.lastError = null;
    this.state.connectionPromise = null;

    this.startHeartbeat();
    this.dispatchEvent('connected', { socket });
  }

  private handleClose(event: CloseEvent): void {
    console.log('WebSocket disconnected:', event.code, event.reason);

    this.cleanup();
    this.dispatchEvent('disconnected', { code: event.code, reason: event.reason });

    // Attempt reconnection if not a normal closure
    if (event.code !== 1000 && this.state.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.scheduleReconnect();
    }
  }

  private handleError(error: Event): void {
    const errorObj = new Error(`WebSocket error: ${error.type}`);
    console.error('WebSocket error:', errorObj);

    this.state.lastError = errorObj;
    this.dispatchEvent('error', { error: errorObj });
  }

  private handleMessage(event: MessageEvent): void {
    try {
      // Validate message format
      const data = JSON.parse(event.data);

      // Handle heartbeat responses
      if (data.type === 'pong') {
        return;
      }

      // Dispatch to all listeners
      this.state.listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error('Error in WebSocket message listener:', error);
        }
      });

    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  private scheduleReconnect(): void {
    if (this.state.isReconnecting) return;

    this.state.isReconnecting = true;
    this.state.reconnectAttempts++;

    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.state.reconnectAttempts - 1),
      30000 // Max 30 seconds
    );

    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.state.reconnectAttempts}/${this.config.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        console.error('Reconnection failed:', error);
        if (this.state.reconnectAttempts < this.config.maxReconnectAttempts) {
          this.scheduleReconnect();
        } else {
          console.error('Max reconnection attempts reached');
          this.dispatchEvent('maxReconnectAttemptsReached', {});
        }
      });
    }, delay);
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.state.socket?.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping', timestamp: Date.now() });
      }
    }, this.config.heartbeatInterval);
  }

  private cleanup(): void {
    this.state.socket = null;
    this.state.isConnected = false;
    this.state.connectionPromise = null;

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private dispatchEvent(type: string, data: any): void {
    const event = new CustomEvent(`websocket:${type}`, { detail: data });
    window.dispatchEvent(event);
  }

  // Public methods
  async send(data: any): Promise<void> {
    if (!this.state.isConnected || !this.state.socket) {
      await this.connect();
    }

    if (this.state.socket?.readyState === WebSocket.OPEN) {
      this.state.socket.send(JSON.stringify(data));
    } else {
      throw new Error('WebSocket is not connected');
    }
  }

  addMessageListener(listener: (event: MessageEvent) => void): () => void {
    this.state.listeners.add(listener);
    return () => this.state.listeners.delete(listener);
  }

  getState(): Readonly<WebSocketState> {
    return { ...this.state };
  }

  disconnect(): void {
    this.state.reconnectAttempts = this.config.maxReconnectAttempts; // Prevent reconnection

    if (this.state.socket) {
      this.state.socket.close(1000, 'Manual disconnect');
    }

    this.cleanup();
  }

  // Force reconnect
  async reconnect(): Promise<WebSocket> {
    this.disconnect();
    this.state.reconnectAttempts = 0;
    return this.connect();
  }
}

// Singleton instance
const wsManager = new WebSocketManager();

// Legacy compatibility
export const getWebSocket = async (): Promise<WebSocket> => {
  return wsManager.connect();
};

// New API
export const websocketManager = wsManager;
