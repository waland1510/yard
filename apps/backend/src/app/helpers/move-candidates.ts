import {
  GAME_GRAPH,
  GameState,
  Move,
  MoveType,
  Node,
  Player,
  showCulpritAtMoves,
} from '@yard/shared-utils';
import { MoveCandidate, TacticalPicture, candidateKey } from './detective-policy';

const TRANSPORTS: MoveType[] = ['taxi', 'bus', 'underground'];

function ticketsFor(player: Player, type: MoveType): number {
  if (type === 'taxi') return player.taxiTickets;
  if (type === 'bus') return player.busTickets;
  if (type === 'underground') return player.undergroundTickets;
  return 0;
}

function neighbors(node: Node | undefined, type: MoveType): number[] {
  if (!node) return [];
  if (type === 'taxi') return node.taxi ?? [];
  if (type === 'bus') return node.bus ?? [];
  if (type === 'underground') return node.underground ?? [];
  return [];
}

function allNeighbors(nodeId: number): number[] {
  const node = GAME_GRAPH.get(nodeId);
  if (!node) return [];
  return [...(node.taxi ?? []), ...(node.bus ?? []), ...(node.underground ?? [])];
}

function degree(nodeId: number): number {
  return allNeighbors(nodeId).length;
}

/** Hop distance ignoring tickets. Returns HOPS_UNREACHABLE when no path exists. */
export const HOPS_UNREACHABLE = 999;

export function hopDistance(from: number, to: number, cap = 12): number {
  if (from === to) return 0;
  const visited = new Set<number>([from]);
  let frontier = [from];
  for (let hops = 1; hops <= cap; hops++) {
    const next: number[] = [];
    for (const current of frontier) {
      for (const n of allNeighbors(current)) {
        if (n === to) return hops;
        if (!visited.has(n)) {
          visited.add(n);
          next.push(n);
        }
      }
    }
    if (next.length === 0) break;
    frontier = next;
  }
  return HOPS_UNREACHABLE;
}

function massWithin(
  origin: number,
  radius: number,
  weights: Map<number, number>
): number {
  const visited = new Set<number>([origin]);
  let frontier = [origin];
  let mass = weights.get(origin) ?? 0;

  for (let hop = 1; hop <= radius; hop++) {
    const next: number[] = [];
    for (const current of frontier) {
      for (const n of allNeighbors(current)) {
        if (visited.has(n)) continue;
        visited.add(n);
        next.push(n);
        mass += weights.get(n) ?? 0;
      }
    }
    if (next.length === 0) break;
    frontier = next;
  }

  return mass;
}

export interface CandidateInput {
  gameState: GameState;
  detective: Player;
  possible: Set<number>;
  weights: Map<number, number>;
}

export function buildCandidates({
  gameState,
  detective,
  possible,
  weights,
}: CandidateInput): MoveCandidate[] {
  const origin = GAME_GRAPH.get(detective.position);
  if (!origin) return [];

  const occupied = new Set(
    gameState.players
      .filter(p => p.role !== 'culprit' && p.role !== detective.role)
      .map(p => p.position)
  );

  const sortedSuspects = [...weights.entries()].sort((a, b) => b[1] - a[1]);
  const topSuspect = sortedSuspects[0]?.[0];

  const seen = new Set<string>();
  const candidates: MoveCandidate[] = [];

  for (const type of TRANSPORTS) {
    const available = ticketsFor(detective, type);
    if (available <= 0) continue;

    for (const destination of neighbors(origin, type)) {
      if (occupied.has(destination)) continue;

      const key = candidateKey(type, destination);
      if (seen.has(key)) continue;
      seen.add(key);

      const move: Move = {
        type,
        position: destination,
        secret: false,
        double: false,
        role: detective.role,
      };

      candidates.push({
        key,
        move,
        destinationName: `#${destination}`,
        hopsToTopSuspect:
          topSuspect === undefined ? HOPS_UNREACHABLE : hopDistance(destination, topSuspect),
        suspectMassWithin1: massWithin(destination, 1, weights),
        suspectMassWithin2: massWithin(destination, 2, weights),
        landsOnSuspect: possible.has(destination),
        exits: degree(destination),
        ticketAfter: available - 1,
      });
    }
  }

  return candidates;
}

export function buildTacticalPicture({
  gameState,
  detective,
  possible,
  weights,
}: CandidateInput): TacticalPicture {
  const culpritMoves = gameState.moves.filter(m => m.role === 'culprit');
  const round = culpritMoves.length;

  const upcomingReveal = showCulpritAtMoves.find(r => r > round);
  const lastRevealIndex = [...culpritMoves.keys()]
    .reverse()
    .find(i => showCulpritAtMoves.includes(i + 1));

  return {
    round,
    nextRevealInRounds: upcomingReveal === undefined ? null : upcomingReveal - round,
    possibleCount: possible.size,
    topSuspects: [...weights.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([node, probability]) => ({ node, probability })),
    lastRevealed:
      lastRevealIndex === undefined
        ? null
        : {
            node: culpritMoves[lastRevealIndex].position,
            roundsAgo: round - (lastRevealIndex + 1),
          },
    otherDetectives: gameState.players
      .filter(p => p.role !== 'culprit' && p.role !== detective.role)
      .map(p => ({ role: p.role, position: p.position })),
    candidates: buildCandidates({ gameState, detective, possible, weights }),
  };
}
