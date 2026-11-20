/** @jest-environment jsdom */
import type { GameState, Message } from '@yard/shared-utils';
import { readCompanionResume } from './companion-resume-storage';
import { createWebSocketClient, type JoinParams } from './websocket-client';

class SocketStub {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static instances: SocketStub[] = [];

  readyState: number = SocketStub.CONNECTING;
  readonly sent: Message[] = [];
  onopen?: () => void;
  onclose?: () => void;
  onmessage?: (event: { data: string }) => void;

  constructor() {
    SocketStub.instances.push(this);
  }

  open() {
    this.readyState = SocketStub.OPEN;
    this.onopen?.();
  }

  send(message: string) {
    this.sent.push(JSON.parse(message) as Message);
  }

  receive(type: Message['type'], data: Message['data']) {
    this.onmessage?.({ data: JSON.stringify({ type, data }) });
  }

  close() {
    this.readyState = SocketStub.CLOSED;
  }
}

const phone = {
  channel: 'game-a',
  name: 'Phone',
  clientId: 'phone-a',
  deviceType: 'phone',
  pairCode: 'ABC234',
} satisfies JoinParams;
const paired: Message['data'] = {
  surface: 'fpv-companion',
  role: 'detective1',
  peerClientId: 'desktop-a',
  peerSurface: 'map-primary',
};
const gameState: GameState = {
  channel: phone.channel,
  status: 'active',
  currentTurn: 'detective1',
  isDoubleMove: false,
  players: [],
  moves: [{ role: 'culprit', type: 'taxi', position: 8 }],
};

describe('companion WebSocket resume', () => {
  const originalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    jest.useFakeTimers();
    SocketStub.instances = [];
    sessionStorage.clear();
    globalThis.WebSocket = SocketStub as unknown as typeof WebSocket;
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    globalThis.WebSocket = originalWebSocket;
  });

  it('webSocketClient_afterForegroundResume_usesCredentialAndWaitsForStateAndPairConfirmation', () => {
    const client = createWebSocketClient('ws://yard.test/ws');
    const resume = { token: 'resume-token', expiresAt: Date.now() + 60_000 };
    client.connect({ ...phone });
    const [initial] = SocketStub.instances;
    initial.open();
    expect(initial.sent).toEqual([{
      type: 'pairRedeem',
      channel: phone.channel,
      data: { code: phone.pairCode, clientId: phone.clientId, deviceType: 'phone' },
    }]);
    initial.receive('paired', { ...paired, resume });
    expect(client.isCompanionReady()).toBe(true);

    client.suspend();
    jest.advanceTimersByTime(20_000);
    expect(initial.readyState).toBe(SocketStub.CLOSED);
    expect(SocketStub.instances).toHaveLength(1);
    expect(client.isCompanionReady()).toBe(false);
    expect(readCompanionResume(phone.channel, phone.pairCode)).toEqual({
      ...resume, clientId: phone.clientId, pairCode: phone.pairCode,
    });

    client.resume();
    const [, replacement] = SocketStub.instances;
    replacement.open();
    initial.onclose?.();
    expect(client.status()).toBe('connected');
    const resumeMessage = {
      type: 'pairResume',
      channel: phone.channel,
      data: { resumeToken: resume.token, clientId: phone.clientId, deviceType: 'phone' },
    };
    const applySnapshot = jest.fn((snapshot: GameState) => {
      expect(snapshot).toEqual(gameState);
      expect(replacement.sent).toEqual([resumeMessage]);
      expect(client.send('makeMove', { position: 10 })).toBe(false);
    });
    client.setHandlers({ onPairing: (_type, data) => {
      if (data.gameState) applySnapshot(data.gameState);
    } });
    replacement.receive('paired', { role: 'detective1', gameState });
    expect(applySnapshot).toHaveBeenCalledTimes(1);
    expect(replacement.sent).toEqual([resumeMessage, { type: 'pairReady', channel: phone.channel, data: {} }]);
    expect(client.isCompanionReady()).toBe(false);

    replacement.receive('paired', paired);
    expect(client.isCompanionReady()).toBe(true);
    expect(client.send('makeMove', { position: 10 })).toBe(true);
  });

  it('webSocketClient_afterTabReload_retriesWithTheStoredCredentialWhenHostIsUnavailable', () => {
    const client = createWebSocketClient('ws://yard.test/ws');
    const resume = { token: 'resume-token', expiresAt: Date.now() + 60_000 };
    client.connect({ ...phone });
    const [initial] = SocketStub.instances;
    initial.open();
    initial.receive('paired', { ...paired, resume });
    client.disconnect();
    jest.runOnlyPendingTimers();

    const saved = readCompanionResume(phone.channel, phone.pairCode);
    expect(saved?.clientId).toBe(phone.clientId);
    const reloaded = createWebSocketClient('ws://yard.test/ws');
    reloaded.connect({ ...phone, clientId: saved?.clientId, resume: saved });
    const [, replacement] = SocketStub.instances;
    replacement.open();
    expect(replacement.sent).toEqual([{
      type: 'pairResume',
      channel: phone.channel,
      data: { resumeToken: resume.token, clientId: phone.clientId, deviceType: 'phone' },
    }]);

    replacement.receive('pairError', { reason: 'host-unavailable' });
    expect(reloaded.isCompanionReady()).toBe(false);
    expect(readCompanionResume(phone.channel, phone.pairCode)?.token).toBe(resume.token);
    jest.runOnlyPendingTimers();
    const [, , retry] = SocketStub.instances;
    retry.open();
    expect(retry.sent).toEqual(replacement.sent);
  });

  it('webSocketClient_whenUnpaired_clearsTheSavedCredentialAndStopsRetrying', () => {
    const client = createWebSocketClient('ws://yard.test/ws');
    const onPairing = jest.fn();
    client.setHandlers({ onPairing });
    client.connect({ ...phone });
    const [socket] = SocketStub.instances;
    socket.open();
    socket.receive('paired', { ...paired, resume: { token: 'resume-token', expiresAt: Date.now() + 60_000 } });

    socket.receive('paired', { reason: 'unpaired' });
    client.resume();
    jest.advanceTimersByTime(20_000);
    expect(client.isCompanionReady()).toBe(false);
    expect(readCompanionResume(phone.channel, phone.pairCode)).toBeUndefined();
    expect(SocketStub.instances).toHaveLength(1);
    expect(onPairing).toHaveBeenCalledWith('pairError', { reason: 'unpaired' });
  });
});
