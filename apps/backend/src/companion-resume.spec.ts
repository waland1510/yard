import type { GameState, Message, MessageType } from '@yard/shared-utils';
import type { FastifyInstance, FastifyServerOptions } from 'fastify';
import type {} from '@fastify/websocket';

let mockServer: FastifyInstance;
const mockHasActiveGame = jest.fn<Promise<GameState | null>, [string, boolean?]>();
const mockAddMove = jest.fn();

jest.mock('fastify', () => {
  const actual = jest.requireActual<typeof import('fastify')>('fastify');
  return {
    fastify: (options: FastifyServerOptions) => {
      mockServer = actual.fastify({ ...options, logger: false });
      mockServer.listen = jest.fn();
      return mockServer;
    },
  };
});

jest.mock('./app/app', () => ({ app: async () => undefined }));
jest.mock('./app/helpers/env', () => ({ ENV: { ALLOWED_ORIGINS: [] } }));
jest.mock('./app/helpers/ai-player', () => ({ AIPlayerService: jest.fn() }));
jest.mock('./app/helpers/db-operations', () => ({
  hasActiveGame: (...args: [string, boolean?]) => mockHasActiveGame(...args),
  addMove: (...args: unknown[]) => mockAddMove(...args),
  updateGame: jest.fn(),
}));

const CHANNEL = 'phone-resume-test';
const GAME: GameState = {
  id: 1,
  channel: CHANNEL,
  status: 'active',
  currentTurn: 'culprit',
  isDoubleMove: false,
  players: [],
  moves: [],
};

type Socket = Awaited<ReturnType<FastifyInstance['injectWS']>>;
const sockets: Socket[] = [];

async function connect() {
  const socket = await mockServer.injectWS('/ws');
  sockets.push(socket);
  const messages: Message[] = [];
  socket.on('message', (raw) => messages.push(JSON.parse(raw.toString()) as Message));
  return {
    socket,
    send(type: MessageType, data: Message['data'] = {}) {
      socket.send(JSON.stringify({ type, channel: CHANNEL, data }));
    },
    next(type: MessageType, matches: (message: Message) => boolean = () => true): Promise<Message> {
      const queued = messages.findIndex((message) => message.type === type && matches(message));
      if (queued !== -1) return Promise.resolve(messages.splice(queued, 1)[0]);
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          socket.off('message', read);
          reject(new Error(`Timed out waiting for ${type}. Queued: ${messages.map((message) => message.type).join(', ')}`));
        }, 1500);
        const read = () => {
          const index = messages.findIndex((message) => message.type === type && matches(message));
          if (index === -1) return;
          clearTimeout(timeout);
          socket.off('message', read);
          resolve(messages.splice(index, 1)[0]);
        };
        socket.on('message', read);
      });
    },
  };
}

beforeAll(async () => {
  const signals = ['SIGINT', 'SIGTERM'] as const;
  const listeners = signals.map((signal) => new Set(process.listeners(signal)));
  jest.requireActual('./main');
  signals.forEach((signal, index) => {
    for (const listener of process.listeners(signal)) {
      if (!listeners[index].has(listener)) process.removeListener(signal, listener);
    }
  });
  await mockServer.ready();
});

afterAll(async () => {
  for (const socket of sockets) socket.terminate();
  for (const socket of mockServer.websocketServer.clients) socket.terminate();
  await mockServer.close();
});

it('companionResume_afterSocketDrops_syncsBeforeHandoffAndRejectsAnUnpairedCredential', async () => {
  mockHasActiveGame.mockResolvedValue(GAME);
  const desktop = await connect();
  desktop.send('joinGame', { role: 'culprit', clientId: 'desktop', username: 'Player' });
  await desktop.next('presence');
  desktop.send('pairRequest', { clientId: 'desktop' });
  const { code } = (await desktop.next('pairCode')).data;

  const phone = await connect();
  phone.send('pairRedeem', { code, clientId: 'phone', deviceType: 'phone' });
  const { resume } = (await phone.next('paired')).data;
  expect(resume?.token).toBeTruthy();
  expect((await desktop.next('paired')).data.resume).toBeUndefined();

  phone.socket.terminate();
  expect((await desktop.next('paired')).data.peerClientId).toBeUndefined();

  const latest: GameState = { ...GAME, moves: [{ role: 'culprit', type: 'taxi', position: 9 }] };
  mockHasActiveGame.mockResolvedValue(latest);
  let finishSnapshot: (game: GameState) => void = () => undefined;
  const snapshotStarted = new Promise<void>((started) => {
    mockHasActiveGame.mockImplementationOnce(() => new Promise((resolve) => {
      finishSnapshot = resolve;
      started();
    }));
  });
  const stale = await connect();
  stale.send('pairResume', { resumeToken: resume?.token, clientId: 'phone', deviceType: 'phone' });
  await snapshotStarted;
  desktop.send('makeMove', { role: 'culprit', type: 'taxi', position: 9 });
  await desktop.next('makeMove');
  finishSnapshot(GAME);
  expect((await stale.next('pairError')).data.reason).toBe('resume-retry');

  const resumed = await connect();
  resumed.send('pairResume', { resumeToken: resume?.token, clientId: 'phone', deviceType: 'phone' });
  const snapshot = (await resumed.next('paired')).data;
  expect(snapshot.gameState?.moves).toEqual(latest.moves);
  expect(snapshot.gameState?.currentTurn).toBe('detective1');
  expect(snapshot.peerClientId).toBeUndefined();
  expect(mockHasActiveGame).toHaveBeenCalledWith(CHANNEL, true);

  const presence = await mockServer.inject({ url: '/api/presence/' + CHANNEL });
  expect(presence.json().members.find(({ clientId }: { clientId: string }) => clientId === 'desktop').surface)
    .toBeUndefined();

  resumed.send('makeMove', { role: 'culprit', type: 'taxi', position: 10 });
  resumed.send('pairReady');
  expect((await resumed.next('paired')).data.peerClientId).toBe('desktop');
  expect((await desktop.next('paired')).data.peerClientId).toBe('phone');
  expect(mockAddMove).toHaveBeenCalledTimes(1);
  expect(mockAddMove).toHaveBeenCalledWith(1, 'culprit', 'taxi', 9, undefined, undefined);

  desktop.send('pairUnlink');
  expect((await resumed.next('paired')).data.reason).toBe('unpaired');
  const rejected = await connect();
  rejected.send('pairResume', { resumeToken: resume?.token, clientId: 'phone', deviceType: 'phone' });
  expect((await rejected.next('pairError')).data.reason).toBe('resume-rejected');
});
