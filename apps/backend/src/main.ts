import cors from '@fastify/cors';
import ws from '@fastify/websocket';
import {
  getNextRole,
  Message,
  Player,
  RoleType,
  PairingRegistry,
  type CompanionDevice,
  type CompanionSurface,
} from '@yard/shared-utils';
import { fastify } from 'fastify';
import { setTimeout } from 'timers/promises';
import { app } from './app/app';
import { AIPlayerService } from './app/helpers/ai-player';
import { addMove, hasActiveGame, updateGame } from './app/helpers/db-operations';
import { ENV } from './app/helpers/env';

const host = ENV.HOST;
const port = ENV.PORT;

const server = fastify({
  logger: true,
  ignoreTrailingSlash: true,
});
const aiService = new AIPlayerService();

// CORS allowlist: the legacy SVG frontend (:4200) plus the new FPV frontend (:4201).
// FRONTEND_URL stays the canonical prod origin; the localhost dev origins are added so
// both local frontends can talk to one backend without surgery.
const allowedOrigins = [
  ENV.FRONTEND_URL,
  'http://localhost:4200',
  'http://localhost:4201',
].filter(Boolean);
// Dev-permissive origin check: the canonical FRONTEND_URL plus any localhost port and any
// private-LAN address (10.x / 192.168.x / 172.16–31.x) on any port. The latter is what
// lets a phone on the same Wi-Fi reach the backend for companion pairing (#1) when the
// Vite dev server lands on an unexpected port (e.g. 4202).
const LAN_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;
server.register(cors, {
  origin: (origin, cb) => {
    // No Origin header → non-browser client / same-origin; allow.
    if (!origin || allowedOrigins.includes(origin) || LAN_ORIGIN.test(origin)) {
      cb(null, true);
      return;
    }
    cb(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

const channels: Record<string, Set<WebSocket>> = {};
// Per-channel member presence — which role each connection is using. Lets new joiners
// know who's already claimed a seat. Maintained on joinGame and on socket close.
// `clientId`/`deviceType`/`surface` (companion pairing, #1) distinguish two devices that
// share one role: a `map-primary` desktop and an `fpv-companion` phone.
const channelMembers: Record<
  string,
  Map<
    WebSocket,
    {
      role: string;
      username: string;
      clientId?: string;
      deviceType?: CompanionDevice;
      surface?: CompanionSurface;
    }
  >
> = {};

// Authoritative companion-pairing code registry (#1). Single-use, time-bounded codes.
const pairing = new PairingRegistry();

function findByClientId(channel: string, clientId: string): WebSocket | null {
  const members = channelMembers[channel];
  if (!members) return null;
  for (const [ws, m] of members) {
    if (m.clientId === clientId) return ws;
  }
  return null;
}

// The paired peer of `clientId`: the OTHER connection on the same role that holds a
// companion surface. Used to forward relay / heartbeat (#6/#12) to the right socket.
function findPeerOf(channel: string, clientId: string): WebSocket | null {
  const members = channelMembers[channel];
  if (!members) return null;
  let mine: { role: string } | null = null;
  for (const m of members.values()) {
    if (m.clientId === clientId) {
      mine = m;
      break;
    }
  }
  if (!mine) return null;
  for (const [ws, m] of members) {
    if (m.clientId !== clientId && m.role === mine.role && m.surface) return ws;
  }
  return null;
}

function broadcastPresence(channel: string) {
  const members = channelMembers[channel];
  if (!members) return;
  broadcast(channel, {
    type: 'presence',
    data: {
      members: Array.from(members.values()),
    },
  });
}

// REST endpoint for clients that haven't WS-connected yet (e.g., the JoinOverlay)
server.get<{ Params: { channel: string } }>(
  '/api/presence/:channel',
  async (request) => {
    const { channel } = request.params;
    const members = channelMembers[channel];
    return {
      members: members ? Array.from(members.values()) : [],
    };
  }
);

server.register(app);
server.register(ws);

const aiMoveInProgress = new Set<string>();

async function handleAIMove(currentTurn: RoleType, currentChannel: string) {
  const lockKey = `${currentChannel}:${currentTurn}`;
  if (aiMoveInProgress.has(lockKey)) return;
  aiMoveInProgress.add(lockKey);

  let game = await hasActiveGame(currentChannel);
  if (!game) { aiMoveInProgress.delete(lockKey); return; }
  try {
    const nextPlayer = game.players.find(p => p.role === currentTurn);
    if (nextPlayer?.isAI) {
      console.log('AI player found:', nextPlayer);
      const moveCountBefore = game.moves.length;
      const aiMove = await aiService.calculateMove(
        game,
        nextPlayer as Player
      );

      await setTimeout(2000);

      // Re-check: if a move was already added during the delay, abort
      game = await hasActiveGame(currentChannel);
      if (!game?.id) { aiMoveInProgress.delete(lockKey); return; }
      if (game.moves.length !== moveCountBefore) { aiMoveInProgress.delete(lockKey); return; }

      if (!aiMove.role || aiMove.position === undefined) { aiMoveInProgress.delete(lockKey); return; }

      await addMove(game.id, aiMove.role, aiMove.type, aiMove.position, aiMove.secret, aiMove.double);
      aiMoveInProgress.delete(lockKey);

      game = await hasActiveGame(currentChannel);
      if (!game?.id) return;

      const culprit = game.players.find(p => p.role === 'culprit');
      const detectives = game.players.filter(p => p.role !== 'culprit');
      const caughtDetective = detectives.find(d => d.position === culprit?.position);

      if (caughtDetective && culprit) {
        broadcast(currentChannel, {
          type: 'endGame',
          data: {
            winner: 'detectives',
            reason: 'Culprit caught!',
          },
        });
        await updateGame(game.id, { status: 'finished' });
        return;
      }

      const nextTurn = getNextRole(aiMove.role as RoleType, aiMove.double || false);

      broadcast(currentChannel, {
        type: 'makeMove',
        data: {
          ...aiMove,
          currentTurn: nextTurn,
        },
      });

      await updateGame(game.id, {
        currentTurn: nextTurn,
      });

      const nextAIPlayer = game.players.find(p => p.role === nextTurn);
      if (nextAIPlayer?.isAI) {
        await handleAIMove(nextTurn, currentChannel);
      }
    }
  } catch (error) {
    aiMoveInProgress.delete(`${currentChannel}:${currentTurn}`);
    console.error('AI move calculation failed:', error);
  }
}

server.register(async function (fastify) {
  fastify.get(
    '/*',
    { websocket: true },
    (connection /* WebSocket */) => {
      let currentChannel: string | null = null;
      let currentClientId: string | null = null;

      connection.on('message', async (message) => {
        const parsedMessage: Message = JSON.parse(message.toString());
        switch (parsedMessage.type) {
          case 'startGame': {
            const ch = parsedMessage.data.ch;
            if (!ch) break;
            currentChannel = ch;
            channels[currentChannel] = new Set();
            channels[currentChannel].add(connection as unknown as WebSocket);
            console.log(`Client joined channel: ${currentChannel}`);
            break;
          }

          case 'joinGame': {
            currentChannel = parsedMessage.channel ?? null;
            if (!currentChannel) break;

            const game = await hasActiveGame(currentChannel);
            if (!channels[currentChannel]) {
              if (game?.status === 'active') {
                channels[currentChannel] = new Set();
              } else {
                connection.send(
                  JSON.stringify({
                    type: 'error',
                    data: 'Game not found',
                  })
                );
                return;
              }
            }
            channels[currentChannel].add(connection as unknown as WebSocket);

            // Track presence: which role this connection has claimed
            if (!channelMembers[currentChannel]) {
              channelMembers[currentChannel] = new Map();
            }
            if (parsedMessage.data.role) {
              currentClientId = parsedMessage.data.clientId ?? currentClientId;
              channelMembers[currentChannel].set(
                connection as unknown as WebSocket,
                {
                  role: parsedMessage.data.role,
                  username: parsedMessage.data.username ?? '',
                  clientId: parsedMessage.data.clientId,
                  deviceType: parsedMessage.data.deviceType,
                }
              );
            }

            broadcast(currentChannel, {
              type: 'joinGame',
              data: {
                username: parsedMessage.data.username,
                role: parsedMessage.data.role,
              },
            });
            broadcastPresence(currentChannel);

            if (game && !game.moves.length) {
              try {
                const nextPlayer = game.players.find(p => p.role === 'culprit');
                if (nextPlayer?.isAI) {
                  await handleAIMove('culprit', currentChannel);
                }
              } catch (error) {
                console.error('AI move calculation failed:', error);
                connection.send(
                  JSON.stringify({
                    type: 'error',
                    data: 'AI move calculation failed',
                  })
                );
              }
            }
            break;
          }

          case 'updateGameState':
            break;

          case 'impersonate':
            if (currentChannel) {
              broadcast(currentChannel, {
                type: 'impersonate',
                data: parsedMessage.data,
              });
            }
            break;

          // Companion pairing (#1): the host (map-primary) requests a code for its role.
          case 'pairRequest': {
            if (!currentChannel) break;
            const me = channelMembers[currentChannel]?.get(
              connection as unknown as WebSocket
            );
            const hostClientId = parsedMessage.data.clientId;
            if (!me?.role || !hostClientId) break;
            me.clientId = hostClientId;
            currentClientId = hostClientId;
            const { code, expiresAt } = pairing.issue({
              channel: currentChannel,
              role: me.role,
              hostClientId,
              now: Date.now(),
            });
            connection.send(
              JSON.stringify({ type: 'pairCode', data: { code, expiresAt } })
            );
            break;
          }

          // The companion (phone) redeems the code and joins the host's role as fpv-companion.
          case 'pairRedeem': {
            const code = parsedMessage.data.code;
            const companionClientId = parsedMessage.data.clientId;
            if (!code || !companionClientId) break;
            const res = pairing.redeem({ code, now: Date.now() });
            if (!res.ok) {
              const reason = 'reason' in res ? res.reason : 'unknown-code';
              connection.send(
                JSON.stringify({ type: 'pairError', data: { reason } })
              );
              break;
            }
            const ch = res.channel;
            currentChannel = ch;
            currentClientId = companionClientId;
            if (!channels[ch]) channels[ch] = new Set();
            channels[ch].add(connection as unknown as WebSocket);
            if (!channelMembers[ch]) channelMembers[ch] = new Map();
            channelMembers[ch].set(connection as unknown as WebSocket, {
              role: res.role,
              username: '',
              clientId: companionClientId,
              deviceType: parsedMessage.data.deviceType,
              surface: 'fpv-companion',
            });
            // Mark the host as map-primary and notify both sides.
            const hostWs = findByClientId(ch, res.hostClientId);
            if (hostWs) {
              const hostMember = channelMembers[ch].get(hostWs);
              if (hostMember) hostMember.surface = 'map-primary';
              hostWs.send(
                JSON.stringify({
                  type: 'paired',
                  data: {
                    surface: 'map-primary',
                    peerClientId: companionClientId,
                    peerSurface: 'fpv-companion',
                  },
                })
              );
            }
            connection.send(
              JSON.stringify({
                type: 'paired',
                data: {
                  surface: 'fpv-companion',
                  peerClientId: res.hostClientId,
                  peerSurface: 'map-primary',
                  // The companion inherits the host's role.
                  role: res.role as RoleType,
                },
              })
            );
            broadcastPresence(ch);
            break;
          }

          // Companion live coordination (#6/#12): forward transient relay + heartbeat to
          // the paired peer socket. These never touch GameState.
          case 'companionRelay':
          case 'companionPing':
          case 'companionPong': {
            if (!currentChannel || !currentClientId) break;
            const peer = findPeerOf(currentChannel, currentClientId);
            if (peer && peer.readyState === peer.OPEN) {
              peer.send(
                JSON.stringify({ type: parsedMessage.type, data: parsedMessage.data })
              );
            }
            break;
          }

          // Explicit unpair (#12): clear both surfaces and tell the peer it's solo again.
          case 'pairUnlink': {
            if (!currentChannel || !currentClientId) break;
            const members = channelMembers[currentChannel];
            const me = members?.get(connection as unknown as WebSocket);
            if (me) me.surface = undefined;
            const peer = findPeerOf(currentChannel, currentClientId);
            if (peer) {
              const pm = members?.get(peer);
              if (pm) pm.surface = undefined;
              if (peer.readyState === peer.OPEN) {
                peer.send(JSON.stringify({ type: 'paired', data: {} }));
              }
            }
            broadcastPresence(currentChannel);
            break;
          }

          case 'makeMove':
            if (currentChannel) {
              const { role, double, position } = parsedMessage.data;
              const moveType = parsedMessage.data.type;
              if (!role || !moveType || position === undefined) break;

              const game = await hasActiveGame(currentChannel);
              if (!game?.id) break;
              await addMove(game.id, role, moveType, position, parsedMessage.data.secret, double);

              const updatedGame = await hasActiveGame(currentChannel);
              if (!updatedGame?.id) break;

              const culprit = updatedGame.players.find(p => p.role === 'culprit');
              const detectives = updatedGame.players.filter(p => p.role !== 'culprit');
              const caughtDetective = detectives.find(d => d.position === culprit?.position);

              if (caughtDetective && culprit) {
                broadcast(currentChannel, {
                  type: 'endGame',
                  data: {
                    winner: 'detectives',
                    reason: 'Culprit caught!',
                  },
                });
                await updateGame(updatedGame.id, { status: 'finished' });
                break;
              }

              const currentTurn = getNextRole(role as RoleType, double || false);

              broadcast(currentChannel, {
                type: 'makeMove',
                data: {
                  ...parsedMessage.data,
                  currentTurn,
                },
              });

              await handleAIMove(currentTurn, currentChannel);
            }
            break;

          case 'endGame':
            if (currentChannel) {
              broadcast(currentChannel, {
                type: 'endGame',
                data: parsedMessage.data,
              });
              delete channels[currentChannel];
            }
            break;

          default:
            console.warn('Unknown message type:', parsedMessage.type);
        }
      });

      connection.on('close', () => {
        if (currentChannel && channels[currentChannel]) {
          const closing = channelMembers[currentChannel]?.get(
            connection as unknown as WebSocket
          );
          channels[currentChannel].delete(connection as unknown as WebSocket);
          channelMembers[currentChannel]?.delete(connection as unknown as WebSocket);
          // If a paired device dropped, tell its surviving peer (same role) so it can
          // fall back to solo control (full re-pair UX is #12).
          if (closing?.surface && closing.role) {
            const members = channelMembers[currentChannel];
            if (members) {
              for (const [ws, m] of members) {
                if (
                  m.role === closing.role &&
                  m.surface &&
                  m.clientId !== closing.clientId
                ) {
                  m.surface = undefined;
                  ws.send(JSON.stringify({ type: 'paired', data: {} }));
                }
              }
            }
          }
          if (channels[currentChannel].size === 0) {
            delete channels[currentChannel];
            delete channelMembers[currentChannel];
          } else {
            broadcastPresence(currentChannel);
          }
        }
      });
    }
  );
});

const broadcast = (channel: string, message: Message) => {
  const clients = channels[channel];
  if (clients) {
    for (const client of clients) {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify(message));
      }
    }
  }
};

server.listen({ port, host }, (err, address) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  }
  console.log(`Server listening at ${address}`);
});
