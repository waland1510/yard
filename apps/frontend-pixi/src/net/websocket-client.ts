// Typed WebSocket protocol wrapper for the Scotland Yard backend.
// Handles connect, reconnect, JSON framing, and dispatch via typed callbacks.
// Does NOT know about Zustand or game state — callers wire the events.

import type {
  AiDecisionComparison,
  AiProposal,
  CallSignal,
  Message,
  MessageType,
  Move,
  RoleType,
  GameState,
  CompanionDevice,
  CompanionResumeCredential,
  PresenceMember,
} from '@yard/shared-utils';
import { clearCompanionResume, saveCompanionResume } from './companion-resume-storage';

const RECONNECT_MS = 4000;
const CONNECT_TIMEOUT_MS = 15_000;

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
    aiDecision?: AiDecisionComparison;
  }) => void;
  onEndGame?: (payload: { winner?: string; reason?: string }) => void;
  /** Both AI deciders disagreed; the server wants a human to pick. */
  onAiProposal?: (proposal: AiProposal) => void;
  onJoinGame?: (payload: { role?: RoleType; username?: string }) => void;
  onImpersonate?: (payload: { role?: RoleType }) => void;
  onPresence?: (payload: { members: PresenceMember[] }) => void;
  onCallSignal?: (payload: { from: string; signal: CallSignal }) => void;
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
  resume?: CompanionResumeCredential;
}

export interface WebSocketClient {
  connect(params: JoinParams): void;
  disconnect(): void;
  suspend(): void;
  resume(): void;
  isCompanionReady(): boolean;
  send(type: MessageType, data: Record<string, unknown>): boolean;
  status(): ConnectionStatus;
  setHandlers(handlers: WSHandlers): void;
}

export function createWebSocketClient(wsUrl: string): WebSocketClient {
  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let join: JoinParams | null = null;
  let status: ConnectionStatus = 'idle';
  let handlers: WSHandlers = {};
  let manuallyClosed = false;
  let suspended = false;
  let pairConfirmed = false;
  let pairRejected = false;
  let connectionTimer: ReturnType<typeof setTimeout> | null = null;

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
          aiDecision: data.aiDecision,
        });
        break;
      case 'endGame':
        handlers.onEndGame?.({ winner: data.winner, reason: data.reason });
        break;
      case 'aiProposal':
        if (data.proposal) handlers.onAiProposal?.(data.proposal);
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
        handlers.onPairing?.(type, data);
        break;
      case 'paired':
        if (join?.pairCode) {
          if (data.resume && join.clientId) {
            join.resume = data.resume;
            saveCompanionResume(join.channel, { ...data.resume, pairCode: join.pairCode, clientId: join.clientId });
          }
          if (data.gameState) {
            handlers.onPairing?.(type, data);
            sendInternal('pairReady', {});
            break;
          }
          pairConfirmed = data.surface === 'fpv-companion' && !!data.peerClientId;
          if (pairConfirmed) clearConnectionTimer();
          else if (data.reason === 'unpaired') rejectPairing(data.reason);
          else retry();
        }
        handlers.onPairing?.(type, data);
        break;
      case 'pairError':
        if (join?.resume && (data.reason === 'host-unavailable' || data.reason === 'resume-retry')) retry();
        else if (join?.pairCode) rejectPairing(data.reason);
        else handlers.onPairing?.(type, data);
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
      case 'callSignal':
        if (data.from && data.signal) handlers.onCallSignal?.({ from: data.from, signal: data.signal });
        break;
      default:
        break;
    }
  }

  function clearConnectionTimer() {
    if (connectionTimer) clearTimeout(connectionTimer);
    connectionTimer = null;
  }

  function clearReconnectTimer() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  function closeSocket() {
    clearConnectionTimer();
    const closing = socket;
    socket = null;
    pairConfirmed = false;
    closing?.close();
  }

  function retry() {
    closeSocket();
    setStatus('disconnected');
    scheduleReconnect();
  }

  function rejectPairing(reason?: string) {
    if (join?.pairCode) {
      clearCompanionResume(join.channel, join.pairCode);
      join.resume = undefined;
    }
    pairRejected = true;
    closeSocket();
    setStatus('disconnected');
    handlers.onPairing?.('pairError', { reason });
  }

  function armConnectionTimeout() {
    clearConnectionTimer();
    connectionTimer = setTimeout(retry, CONNECT_TIMEOUT_MS);
  }

  function open() {
    if (!join || socket || manuallyClosed || suspended || pairRejected) return;
    if (join.resume && join.resume.expiresAt <= Date.now()) {
      rejectPairing('resume-rejected');
      return;
    }

    setStatus('connecting');
    let active: WebSocket;
    try {
      active = new WebSocket(wsUrl);
    } catch (error) {
      handlers.onError?.(error);
      retry();
      return;
    }

    socket = active;
    armConnectionTimeout();
    active.onopen = () => {
      if (socket !== active || !join) return;
      clearConnectionTimer();
      setStatus('connected');
      sendJoinOrPair(join);
      if (join.pairCode) armConnectionTimeout();
    };
    active.onmessage = (ev) => {
      if (socket !== active) return;
      try {
        dispatch(JSON.parse(ev.data) as Message);
      } catch (error) {
        handlers.onError?.(error);
      }
    };
    active.onclose = () => {
      if (socket !== active) return;
      retry();
    };
    active.onerror = (error) => {
      if (socket === active) handlers.onError?.(error);
    };
  }

  function scheduleReconnect() {
    if (manuallyClosed || suspended || pairRejected || reconnectTimer) return;
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
    if (j.resume) {
      return sendInternal('pairResume', {
        resumeToken: j.resume.token,
        clientId: j.clientId,
        deviceType: j.deviceType,
      });
    }
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
      suspended = false;
      const sameSession = join?.channel === params.channel && join.clientId === params.clientId &&
        join.pairCode === params.pairCode && join.name === params.name && join.role === params.role;
      if (!sameSession) {
        closeSocket();
        clearReconnectTimer();
        pairRejected = false;
        join = params;
      }
      open();
    },
    suspend() {
      suspended = true;
      clearReconnectTimer();
      closeSocket();
      setStatus('disconnected');
    },
    resume() {
      suspended = false;
      clearReconnectTimer();
      open();
    },
    isCompanionReady: () => !join?.pairCode || pairConfirmed,
    disconnect() {
      // Defer the real disconnect by 200ms — under React StrictMode the cleanup fires
      // immediately on mount, and a new mount follows. We want to keep the connection
      // alive across that quick cycle.
      if (deferredDisconnect) clearTimeout(deferredDisconnect);
      deferredDisconnect = setTimeout(() => {
        deferredDisconnect = null;
        manuallyClosed = true;
        clearReconnectTimer();
        closeSocket();
        join = null;
        setStatus('idle');
      }, 200);
    },
    send(type, data) {
      if (join?.pairCode && !pairConfirmed && type === 'makeMove') return false;
      return sendInternal(type, data);
    },
    status: () => status,
    setHandlers(h) {
      handlers = h;
    },
  };
}
