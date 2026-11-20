import cors from '@fastify/cors';
import ws from '@fastify/websocket';
import {
  AiProposal,
  GameState,
  getNextRole,
  Message,
  Player,
  RoleType,
  PairingRegistry,
  type CompanionDevice,
  type CompanionResumeCredential,
  type CompanionSurface,
} from '@yard/shared-utils';
import { fastify } from 'fastify';
import { setTimeout } from 'timers/promises';
import { app } from './app/app';
import { AIPlayerService } from './app/helpers/ai-player';
import { AiProposalRegistry } from './app/helpers/ai-proposal-registry';
import { CompanionResumeRegistry } from './app/helpers/companion-resume-registry';
import { ENV } from './app/helpers/env';
import { addMove, hasActiveGame, updateGame } from './app/helpers/db-operations';
import { hasLegalMove } from './app/helpers/move-candidates';

const host = ENV.HOST;
const port = ENV.PORT;

const server = fastify({
  logger: true,
  ignoreTrailingSlash: true,
  // Behind a hosting proxy request.ip would otherwise be the proxy, not the player.
  trustProxy: true,
});
const aiService = new AIPlayerService();
const proposals = new AiProposalRegistry('heuristic');

// CORS allowlist: the legacy SVG frontend (:4200) plus the new FPV frontend (:4201).
// FRONTEND_URL stays the canonical prod origin; the localhost dev origins are added so
// both local frontends can talk to one backend without surgery.
const allowedOrigins = [
  ENV.FRONTEND_URL,
  ...ENV.ALLOWED_ORIGINS,
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
      peerClientId?: string;
      inCall?: boolean;
      mic?: boolean;
      cam?: boolean;
    }
  >
> = {};

// Authoritative companion-pairing code registry (#1). Single-use, time-bounded codes.
const pairing = new PairingRegistry();
const companionResumes = new CompanionResumeRegistry();
const gameRevisions = new Map<string, number>();

function findByClientId(channel: string, clientId: string): WebSocket | null {
  const members = channelMembers[channel];
  if (!members) return null;
  for (const [ws, m] of members) {
    if (m.clientId === clientId) return ws;
  }
  return null;
}

function findPeerOf(channel: string, socket: WebSocket): WebSocket | null {
  const members = channelMembers[channel];
  const member = members?.get(socket);
  const peerId = member?.peerClientId;
  const peer = peerId ? findByClientId(channel, peerId) : null;
  return member?.clientId && peer && members?.get(peer)?.peerClientId === member.clientId ? peer : null;
}

function notifyPairLoss(channel: string, socket: WebSocket, reason?: 'unpaired'): void {
  const members = channelMembers[channel];
  const member = members?.get(socket);
  if (!member?.clientId) return;
  const peer = findPeerOf(channel, socket);
  member.surface = undefined;
  member.peerClientId = undefined;
  const peerMember = peer && members.get(peer);
  if (!peer || !peerMember) return;
  peerMember.surface = undefined;
  peerMember.peerClientId = undefined;
  if (peer.readyState === peer.OPEN) {
    peer.send(JSON.stringify({ type: 'paired', data: { reason } }));
  }
}

function removeSocket(channel: string, socket: WebSocket): void {
  channels[channel]?.delete(socket);
  channelMembers[channel]?.delete(socket);
  socket.close();
}

function unlinkPhone(channel: string, socket: WebSocket): void {
  const member = channelMembers[channel]?.get(socket);
  const phone = member?.surface === 'fpv-companion' ? socket : findPeerOf(channel, socket);
  notifyPairLoss(channel, socket, 'unpaired');
  if (phone) removeSocket(channel, phone);
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

/** The role that actually plays next: stranded detectives lose their turn. Returns null
 *  when every detective is stranded, which ends the game in Mr. X's favour. */
function resolveTurn(players: readonly Player[], next: RoleType): RoleType | null {
  const detectives = players.filter(p => p.role !== 'culprit');
  if (detectives.length > 0 && detectives.every(d => !hasLegalMove(d, players))) return null;
  let turn = next;
  for (let i = 0; i < players.length; i++) {
    const player = players.find(p => p.role === turn);
    if (!player || player.role === 'culprit' || hasLegalMove(player, players)) return turn;
    server.log.info({ role: turn }, 'turn-skipped: detective stranded');
    turn = getNextRole(turn, false);
  }
  return turn;
}

/** Whose turn it is according to the move log. The stored currentTurn can lag behind it
 *  when the server stops between saving a move and advancing the turn. */
function turnFromMoves(game: Pick<GameState, 'players' | 'moves'>): RoleType | null {
  const last = game.moves[game.moves.length - 1];
  if (!last?.role) return 'culprit';
  return resolveTurn(game.players, getNextRole(last.role as RoleType, !!last.double));
}

async function endGameAllStranded(channel: string, gameId: number) {
  broadcast(channel, {
    type: 'endGame',
    data: { winner: 'culprit', reason: 'No detective can move' },
  });
  await updateGame(gameId, { status: 'finished' });
}

async function handleAIMove(currentTurn: RoleType, currentChannel: string) {
  const lockKey = `${currentChannel}:${currentTurn}`;
  if (aiMoveInProgress.has(lockKey)) return;
  aiMoveInProgress.add(lockKey);

  let game = await hasActiveGame(currentChannel);
  if (!game) { aiMoveInProgress.delete(lockKey); return; }
  try {
    const nextPlayer = game.players.find(p => p.role === currentTurn);
    if (nextPlayer?.isAI) {
      const moveCountBefore = game.moves.length;
      const isCulprit = nextPlayer.role === 'culprit';

      // The deliberate "AI thinking" beat runs concurrently with the decision so a
      // remote Jev call costs no extra wall-clock in the common case.
      const [decision] = await Promise.all([
        isCulprit
          ? aiService.calculateMove(game, nextPlayer as Player).then(move => ({
              move,
              comparison: null,
            }))
          : aiService.calculateDetectiveDecision(game, nextPlayer as Player),
        setTimeout(2000),
      ]);

      if (!decision) {
        server.log.warn(
          { role: currentTurn, channel: currentChannel },
          'ai-move-skipped: no legal move'
        );
        aiMoveInProgress.delete(lockKey);
        if (!game.id) return;
        const passedTo = resolveTurn(game.players as Player[], getNextRole(currentTurn, false));
        if (!passedTo) {
          await endGameAllStranded(currentChannel, game.id);
          return;
        }
        await updateGame(game.id, { currentTurn: passedTo });
        const passed = await hasActiveGame(currentChannel);
        if (passed) broadcast(currentChannel, { type: 'updateGameState', data: { gameState: passed } });
        if (game.players.find(p => p.role === passedTo)?.isAI) {
          await handleAIMove(passedTo, currentChannel);
        }
        return;
      }

      let aiMove = decision.move;
      const comparison = decision.comparison;

      // In `choose` mode a disagreement is offered to the humans instead of resolved by
      // the arbiter. Agreement, or Jev absent, needs no one's input.
      if (
        comparison &&
        ENV.AI_DETECTIVE_POLICY === 'choose' &&
        comparison.jev &&
        !comparison.agree
      ) {
        const proposalId = proposals.nextId(currentChannel);
        const proposal: AiProposal = {
          id: proposalId,
          role: comparison.role,
          moveIndex: comparison.moveIndex,
          options: [
            { source: 'heuristic', move: comparison.heuristic.move },
            { source: 'jev', move: comparison.jev.move, confidence: comparison.jev.confidence },
          ],
          expiresAt: Date.now() + ENV.AI_CHOICE_TIMEOUT_MS,
          comparison,
        };
        const outcome = await Promise.all([
          proposals.open(currentChannel, proposal, ENV.AI_CHOICE_TIMEOUT_MS),
          Promise.resolve(broadcast(currentChannel, { type: 'aiProposal', data: { proposal } })),
        ]).then(([o]) => o);

        aiMove = outcome.source === 'jev' ? comparison.jev.move : comparison.heuristic.move;
        comparison.chosen = outcome.source;
        server.log.info(
          { role: comparison.role, chosen: outcome.source, by: outcome.chosenBy },
          'ai-choice'
        );
      }

      if (comparison) {
        server.log.info({ aiDecision: comparison }, 'ai-decision');
      }

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

      const nextTurn = resolveTurn(
        game.players as Player[],
        getNextRole(aiMove.role as RoleType, aiMove.double || false)
      );

      broadcast(currentChannel, {
        type: 'makeMove',
        data: {
          ...aiMove,
          currentTurn: nextTurn ?? 'culprit',
          ...(decision.comparison ? { aiDecision: decision.comparison } : {}),
        },
      });

      if (!nextTurn) {
        await endGameAllStranded(currentChannel, game.id);
        return;
      }

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
      let resumeInProgress = false;
      let pendingResume: { token: string; phoneClientId: string } | undefined;
      const socket = connection as unknown as WebSocket;

      function hostFor(channel: string, role: string, clientId: string): WebSocket | null {
        const hostSocket = findByClientId(channel, clientId);
        if (!hostSocket || hostSocket === socket || hostSocket.readyState !== hostSocket.OPEN) return null;
        const member = channelMembers[channel]?.get(hostSocket);
        return member?.role === role && member.surface !== 'fpv-companion' ? hostSocket : null;
      }

      function joinPhone(channel: string, role: RoleType, clientId: string, deviceType?: CompanionDevice): void {
        currentChannel = channel;
        currentClientId = clientId;
        (channels[channel] ??= new Set()).add(socket);
        (channelMembers[channel] ??= new Map()).set(socket, { clientId, role, username: '', deviceType });
      }

      function pairPhone(channel: string, hostSocket: WebSocket, resume?: CompanionResumeCredential): void {
        const hostMember = channelMembers[channel]?.get(hostSocket);
        const phoneMember = channelMembers[channel]?.get(socket);
        if (!hostMember?.clientId || !phoneMember?.clientId) return;

        hostMember.surface = 'map-primary';
        hostMember.peerClientId = phoneMember.clientId;
        phoneMember.surface = 'fpv-companion';
        phoneMember.peerClientId = hostMember.clientId;
        connection.send(JSON.stringify({
          type: 'paired',
          data: {
            surface: phoneMember.surface,
            peerClientId: hostMember.clientId,
            peerSurface: hostMember.surface,
            role: phoneMember.role,
            resume,
          },
        }));
        hostSocket.send(JSON.stringify({
          type: 'paired',
          data: {
            surface: hostMember.surface,
            peerClientId: phoneMember.clientId,
            peerSurface: phoneMember.surface,
          },
        }));
        const proposal = proposals.current(channel);
        if (proposal) connection.send(JSON.stringify({ type: 'aiProposal', data: { proposal } }));
        broadcastPresence(channel);
      }

      function pairError(reason: string): void {
        connection.send(JSON.stringify({ type: 'pairError', data: { reason } }));
      }

      const handleMessage = async (message: Buffer) => {
        let parsedMessage: Message;
        try {
          parsedMessage = JSON.parse(message.toString());
        } catch {
          server.log.warn({ channel: currentChannel }, 'ws: ignoring malformed message');
          return;
        }
        if (resumeInProgress || (pendingResume && parsedMessage.type !== 'pairReady')) return;
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

            const openProposal = proposals.current(currentChannel);
            if (openProposal) {
              connection.send(JSON.stringify({ type: 'aiProposal', data: { proposal: openProposal } }));
            }

            broadcast(currentChannel, {
              type: 'joinGame',
              data: {
                username: parsedMessage.data.username,
                role: parsedMessage.data.role,
              },
            });
            broadcastPresence(currentChannel);

            if (game?.id) {
              try {
                // Also resumes a turn that stalled mid-game (e.g. a server restart).
                const turn = turnFromMoves(game as GameState);
                if (!turn) {
                  await endGameAllStranded(currentChannel, game.id);
                  break;
                }
                if (turn !== game.currentTurn) {
                  await updateGame(game.id, { currentTurn: turn });
                  const synced = await hasActiveGame(currentChannel);
                  if (synced) broadcast(currentChannel, { type: 'updateGameState', data: { gameState: synced } });
                }
                const nextPlayer = game.players.find(p => p.role === turn);
                if (nextPlayer?.isAI) {
                  await handleAIMove(turn, currentChannel);
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
            if (!me?.role || me.surface === 'fpv-companion' || !hostClientId) break;
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
            const { code, clientId: phoneClientId, deviceType } = parsedMessage.data;
            if (currentChannel || typeof code !== 'string' || typeof phoneClientId !== 'string' || !phoneClientId) break;
            const result = pairing.redeem({ code, now: Date.now() });
            if (!result.ok) {
              pairError(result.reason);
              break;
            }
            const { channel, hostClientId } = result;
            const role = result.role as RoleType;
            const hostSocket = hostFor(channel, role, hostClientId);
            if (!hostSocket || phoneClientId === hostClientId || findByClientId(channel, phoneClientId)) {
              pairError('host-unavailable');
              break;
            }
            unlinkPhone(channel, hostSocket);
            const resume = companionResumes.issue({ channel, role, hostClientId, phoneClientId }, Date.now());
            joinPhone(channel, role, phoneClientId, deviceType);
            pairPhone(channel, hostSocket, resume);
            break;
          }

          case 'pairResume': {
            const { channel } = parsedMessage;
            const { resumeToken: token, clientId: phoneClientId, deviceType } = parsedMessage.data;
            if (currentChannel || !channel || typeof token !== 'string' || typeof phoneClientId !== 'string') break;
            const link = companionResumes.find(token, channel, phoneClientId, Date.now());
            if (!link) {
              pairError('resume-rejected');
              break;
            }

            if (!hostFor(channel, link.role, link.hostClientId)) {
              pairError('host-unavailable');
              break;
            }

            const revision = gameRevisions.get(channel);
            resumeInProgress = true;
            const game = await hasActiveGame(channel, true);
            resumeInProgress = false;
            if (connection.readyState !== connection.OPEN) break;
            if (companionResumes.find(token, channel, phoneClientId, Date.now()) !== link) {
              pairError('resume-rejected');
              break;
            }
            if (!game || !hostFor(channel, link.role, link.hostClientId)) {
              pairError('host-unavailable');
              break;
            }
            if (revision !== gameRevisions.get(channel)) {
              pairError('resume-retry');
              break;
            }

            // A phone can wake before the previous socket's close reaches the server.
            const previous = findByClientId(channel, phoneClientId);
            if (previous) {
              notifyPairLoss(channel, previous);
              if (previous.readyState === previous.OPEN) {
                previous.send(JSON.stringify({ type: 'pairError', data: { reason: 'superseded' } }));
              }
              removeSocket(channel, previous);
            }

            joinPhone(channel, link.role, phoneClientId, deviceType);
            pendingResume = { token, phoneClientId };
            // The desktop remains the sole mover until the phone applies this snapshot.
            connection.send(JSON.stringify({
              type: 'paired',
              data: {
                role: link.role,
                gameState: {
                  ...game,
                  currentTurn: turnFromMoves(game) ?? game.currentTurn,
                  isDoubleMove: !!game.moves[game.moves.length - 1]?.double,
                },
              },
            }));
            break;
          }

          case 'pairReady': {
            if (!currentChannel || !pendingResume) break;
            const { token, phoneClientId } = pendingResume;
            const link = companionResumes.find(token, currentChannel, phoneClientId, Date.now());
            const hostSocket = link && hostFor(currentChannel, link.role, link.hostClientId);
            if (!hostSocket) {
              pairError(link ? 'host-unavailable' : 'resume-rejected');
              break;
            }
            pendingResume = undefined;
            pairPhone(currentChannel, hostSocket);
            break;
          }

          // Companion live coordination (#6/#12): forward transient relay + heartbeat to
          // the paired peer socket. These never touch GameState.
          case 'companionRelay':
          case 'companionPing':
          case 'companionPong': {
            if (!currentChannel || !currentClientId) break;
            const peer = findPeerOf(currentChannel, socket);
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
            companionResumes.revoke(currentChannel, currentClientId);
            unlinkPhone(currentChannel, socket);
            broadcastPresence(currentChannel);
            break;
          }

          case 'callState': {
            if (!currentChannel) break;
            const me = channelMembers[currentChannel]?.get(connection as unknown as WebSocket);
            if (!me) break;
            const { inCall, mic, cam } = parsedMessage.data;
            me.inCall = !!inCall;
            me.mic = !!inCall && !!mic;
            me.cam = !!inCall && !!cam;
            broadcastPresence(currentChannel);
            break;
          }

          case 'callSignal': {
            if (!currentChannel || !currentClientId) break;
            const { to, signal } = parsedMessage.data;
            if (!to || !signal) break;
            const target = findByClientId(currentChannel, to);
            if (target && target.readyState === target.OPEN) {
              target.send(
                JSON.stringify({ type: 'callSignal', data: { from: currentClientId, signal } })
              );
            }
            break;
          }

          case 'makeMove':
            if (currentChannel && channels[currentChannel]?.has(socket)) {
              const { role, double, position } = parsedMessage.data;
              const moveType = parsedMessage.data.type;
              if (!role || !moveType || position === undefined) break;

              const game = await hasActiveGame(currentChannel);
              if (!game?.id || !channels[currentChannel]?.has(socket)) break;
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

              const currentTurn = resolveTurn(
                updatedGame.players as Player[],
                getNextRole(role as RoleType, double || false)
              );

              broadcast(currentChannel, {
                type: 'makeMove',
                data: {
                  ...parsedMessage.data,
                  currentTurn: currentTurn ?? 'culprit',
                },
              });

              if (!currentTurn) {
                await endGameAllStranded(currentChannel, updatedGame.id);
                break;
              }
              await updateGame(updatedGame.id, { currentTurn });
              await handleAIMove(currentTurn, currentChannel);
            }
            break;

          case 'aiChoice':
            if (currentChannel) {
              const { proposalId, source } = parsedMessage.data;
              if (proposalId && source) proposals.choose(currentChannel, proposalId, source);
            }
            break;

          case 'endGame':
            if (currentChannel) {
              // Persist first: clients re-fetch state over REST and must not see it as active.
              const ended = await hasActiveGame(currentChannel);
              if (ended?.id) await updateGame(ended.id, { status: 'finished' });
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
      };

      // An async listener's rejection is unhandled, and Node exits on unhandled rejections.
      connection.on('message', (message: Buffer) => {
        handleMessage(message).catch((error) => {
          server.log.error({ err: error, channel: currentChannel }, 'ws: message handler failed');
        });
      });

      connection.on('close', () => {
        if (currentChannel && channels[currentChannel]) {
          notifyPairLoss(currentChannel, socket);
          channels[currentChannel].delete(socket);
          channelMembers[currentChannel]?.delete(socket);
          if (channels[currentChannel].size === 0) {
            delete channels[currentChannel];
            delete channelMembers[currentChannel];
            gameRevisions.delete(currentChannel);
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
    if (message.type === 'makeMove' || message.type === 'updateGameState' || message.type === 'endGame') {
      gameRevisions.set(channel, (gameRevisions.get(channel) ?? 0) + 1);
    }
    for (const client of clients) {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify(message));
      }
    }
  }
};

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    server.log.info({ signal }, 'shutting down');
    try {
      await server.close();
      process.exit(0);
    } catch (error) {
      server.log.error(error);
      process.exit(1);
    }
  });
}

server.listen({ port, host }, (err, address) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  }
  console.log(`Server listening at ${address}`);
});
