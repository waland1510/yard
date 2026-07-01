// Typed WebSocket protocol wrapper for the Scotland Yard backend.
// Handles connect, reconnect, JSON framing, and dispatch via typed callbacks.
// Does NOT know about Zustand or game state — callers wire the events.

import type { Message, MessageType, Move, RoleType, GameState, CompanionDevice } from '@yard/shared-utils';

const RECONNECT_MS = 4000;

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected';

export interface WSHandlers {
  onConnectionStatus?: (s: ConnectionStatus) => void;
  onUpdateGameState?: (state: GameState) => void;
  onMakeMove?: (payload: {
    role: RoleType;
    type: Move['type'];
    position: number;
    secret?: boolean;
    double?: boolean;
    currentTurn?: RoleType;
  }) => void;
  onEndGame?: (payload: { winner?: string; reason?: string }) => void;
  onJoinGame?: (payload: { role?: RoleType; username?: string }) => void;
  onImpersonate?: (payload: { role?: RoleType }) => void;
  onPresence?: (payload: { members: Array<{ role: string; username: string }> }) => void;
  /** Companion-pairing messages (#1) — routed to the CompanionSession. */
  onPairing?: (type: 'pairCode' | 'paired' | 'pairError', data: Message['data']) => void;
  /** Companion relay (#6) — transient view/intent from the paired peer. */
  onCompanionRelay?: (data: { kind: string; payload: unknown }) => void;
  /** Heartbeat (#12): peer pinged us (respond with a pong) / peer ponged us. */
  onCompanionPing?: () => void;
  onCompanionPong?: () => void;
  onError?: (e: unknown) => void;
}

export interface JoinParams {
  channel: string;
  /** Omitted for a companion device, which inherits the host's role via `pairCode`. */
  role?: RoleType;
  name: string;
  /** Stable per-device id, surfaced in presence so two devices on one role are distinct. */
  clientId?: string;
  deviceType?: CompanionDevice;
  /** When set, join as a companion by redeeming this code instead of claiming a role. */
  pairCode?: string;
}

export interface WebSocketClient {
  connect(params: JoinParams): void;
  disconnect(): void;
  send(type: MessageType, data: Record<string, unknown>): boolean;
  status(): ConnectionStatus;
  setHandlers(handlers: WSHandlers): void;
}

/** Singleton client — same instance across React StrictMode double-mounts so we don't
 *  open and immediately tear down sockets. */
let singletonClient: WebSocketClient | null = null;
export function getWebSocketClient(): WebSocketClient {
  if (!singletonClient) singletonClient = createWebSocketClient();
  return singletonClient;
}

export function createWebSocketClient(url?: string): WebSocketClient {
  const wsUrl = url ?? readWsUrl();

  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let join: JoinParams | null = null;
  let status: ConnectionStatus = 'idle';
  let handlers: WSHandlers = {};
  let manuallyClosed = false;

  function setStatus(s: ConnectionStatus) {
    if (status === s) return;
    status = s;
    handlers.onConnectionStatus?.(s);
  }

  function dispatch(msg: Message) {
    const { type, data } = msg;
    if (!data) return;
    switch (type) {
      case 'updateGameState':
        if ((data as { gameState?: GameState }).gameState) {
          handlers.onUpdateGameState?.((data as { gameState: GameState }).gameState);
        } else {
          // Some backend variants put GameState directly on `data`
          handlers.onUpdateGameState?.(data as unknown as GameState);
        }
        break;
      case 'makeMove':
        handlers.onMakeMove?.({
          role: data.role as RoleType,
          type: data.type as Move['type'],
          position: data.position as number,
          secret: data.secret,
          double: data.double,
          currentTurn: data.currentTurn,
        });
        break;
      case 'endGame':
        handlers.onEndGame?.({ winner: data.winner, reason: data.reason });
        break;
      case 'joinGame':
        handlers.onJoinGame?.({ role: data.role, username: data.username });
        break;
      case 'impersonate':
        handlers.onImpersonate?.({ role: data.role ?? data.currentRole });
        break;
      case 'presence':
        handlers.onPresence?.({ members: data.members ?? [] });
        break;
      case 'pairCode':
      case 'paired':
      case 'pairError':
        handlers.onPairing?.(type, data);
        break;
      case 'companionRelay':
        handlers.onCompanionRelay?.(data as unknown as { kind: string; payload: unknown });
        break;
      case 'companionPing':
        handlers.onCompanionPing?.();
        break;
      case 'companionPong':
        handlers.onCompanionPong?.();
        break;
      default:
        break;
    }
  }

  function open() {
    if (manuallyClosed) return;
    setStatus('connecting');
    try {
      socket = new WebSocket(wsUrl);
    } catch (e) {
      handlers.onError?.(e);
      scheduleReconnect();
      return;
    }

    socket.onopen = () => {
      setStatus('connected');
      if (join) sendJoinOrPair(join);
    };
    socket.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as Message;
        dispatch(msg);
      } catch (e) {
        handlers.onError?.(e);
      }
    };
    socket.onclose = () => {
      setStatus('disconnected');
      socket = null;
      scheduleReconnect();
    };
    socket.onerror = (e) => {
      handlers.onError?.(e);
    };
  }

  function scheduleReconnect() {
    if (manuallyClosed) return;
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      open();
    }, RECONNECT_MS);
  }

  function sendInternal(type: MessageType, data: Record<string, unknown>): boolean {
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    const channel = join?.channel;
    socket.send(JSON.stringify({ type, channel, data }));
    return true;
  }

  // Companion devices redeem a pairing code instead of claiming a role; everyone else
  // joins their seat. Both carry clientId/deviceType so presence can tell devices apart.
  function sendJoinOrPair(j: JoinParams): boolean {
    if (j.pairCode) {
      return sendInternal('pairRedeem', {
        code: j.pairCode,
        clientId: j.clientId,
        deviceType: j.deviceType,
      });
    }
    if (j.role) {
      return sendInternal('joinGame', {
        channel: j.channel,
        username: j.name,
        role: j.role,
        clientId: j.clientId,
        deviceType: j.deviceType,
      });
    }
    return false;
  }

  let deferredDisconnect: ReturnType<typeof setTimeout> | null = null;

  return {
    connect(params) {
      // Cancel any pending deferred disconnect (we're re-mounting under StrictMode)
      if (deferredDisconnect) {
        clearTimeout(deferredDisconnect);
        deferredDisconnect = null;
      }
      manuallyClosed = false;
      const sameChannel = join?.channel === params.channel;
      join = params;
      if (socket && socket.readyState === WebSocket.OPEN && sameChannel) {
        // Already connected to the same channel — just re-send join/pair
        sendJoinOrPair(params);
      } else if (socket && socket.readyState === WebSocket.CONNECTING && sameChannel) {
        // Connection is still being established — joinGame will fire from onopen
      } else if (!socket) {
        open();
      }
    },
    disconnect() {
      // Defer the real disconnect by 200ms — under React StrictMode the cleanup fires
      // immediately on mount, and a new mount follows. We want to keep the connection
      // alive across that quick cycle.
      if (deferredDisconnect) clearTimeout(deferredDisconnect);
      deferredDisconnect = setTimeout(() => {
        deferredDisconnect = null;
        manuallyClosed = true;
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
        if (socket) {
          socket.onclose = null;
          socket.close();
          socket = null;
        }
        setStatus('idle');
      }, 200);
    },
    send(type, data) {
      return sendInternal(type, data);
    },
    status: () => status,
    setHandlers(h) {
      handlers = h;
    },
  };
}

function readWsUrl(): string {
  const env = (import.meta as { env?: { VITE_WS_URL?: string } }).env;
  return env?.VITE_WS_URL ?? 'ws://localhost:3000/ws';
}
