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

/** Neighbours reachable using only the given transports. A detective's onward reach is
 *  bounded by the tickets it will still hold, so features must never count a tube line it
 *  cannot ride. */
function neighborsVia(nodeId: number, types: readonly MoveType[]): number[] {
  const node = GAME_GRAPH.get(nodeId);
  if (!node) return [];
  const out: number[] = [];
  for (const type of types) for (const n of neighbors(node, type)) out.push(n);
  return out;
}

function degree(nodeId: number, types: readonly MoveType[]): number {
  return new Set(neighborsVia(nodeId, types)).size;
}

/** Hop distance over the given transports. Returns HOPS_UNREACHABLE when no path exists. */
export const HOPS_UNREACHABLE = 999;

export function hopDistance(
  from: number,
  to: number,
  cap = 12,
  types: readonly MoveType[] = TRANSPORTS
): number {
  if (from === to) return 0;
  const visited = new Set<number>([from]);
  let frontier = [from];
  for (let hops = 1; hops <= cap; hops++) {
    const next: number[] = [];
    for (const current of frontier) {
      for (const n of neighborsVia(current, types)) {
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
  weights: Map<number, number>,
  types: readonly MoveType[]
): number {
  const visited = new Set<number>([origin]);
  let frontier = [origin];
  let mass = weights.get(origin) ?? 0;

  for (let hop = 1; hop <= radius; hop++) {
    const next: number[] = [];
    for (const current of frontier) {
      for (const n of neighborsVia(current, types)) {
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

/** Transports the detective can still use after spending one `spent` ticket. */
function usableAfter(detective: Player, spent: MoveType): MoveType[] {
  return TRANSPORTS.filter(t => ticketsFor(detective, t) - (t === spent ? 1 : 0) > 0);
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

  // Two transports to the same node differ only in which ticket is spent. That is a pure
  // economy call, so code makes it: keep the transport with the most tickets left after
  // the move (ties fall to the earlier, cheaper transport in TRANSPORTS order).
  const bestTransportTo = new Map<number, { type: MoveType; after: number }>();
  for (const type of TRANSPORTS) {
    const available = ticketsFor(detective, type);
    if (available <= 0) continue;
    for (const destination of neighbors(origin, type)) {
      const current = bestTransportTo.get(destination);
      if (!current || available - 1 > current.after) {
        bestTransportTo.set(destination, { type, after: available - 1 });
      }
    }
  }

  const seen = new Set<string>();
  const candidates: MoveCandidate[] = [];

  for (const type of TRANSPORTS) {
    const available = ticketsFor(detective, type);
    if (available <= 0) continue;

    for (const destination of neighbors(origin, type)) {
      if (occupied.has(destination)) continue;
      if (bestTransportTo.get(destination)?.type !== type) continue;

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

      const usable = usableAfter(detective, type);
      candidates.push({
        key,
        move,
        destinationName: `#${destination}`,
        hopsToTopSuspect:
          topSuspect === undefined
            ? HOPS_UNREACHABLE
            : hopDistance(destination, topSuspect, 12, usable),
        suspectMassWithin1: massWithin(destination, 1, weights, usable),
        suspectMassWithin2: massWithin(destination, 2, weights, usable),
        landsOnSuspect: possible.has(destination),
        exits: degree(destination, usable),
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
