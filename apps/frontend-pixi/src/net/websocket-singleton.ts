import { createWebSocketClient, type WebSocketClient } from './websocket-client';

let client: WebSocketClient | undefined;

export function getWebSocketClient(): WebSocketClient {
  const env = (import.meta as { env?: { VITE_WS_URL?: string } }).env;
  return client ??= createWebSocketClient(env?.VITE_WS_URL ?? 'ws://localhost:3000/ws');
}
