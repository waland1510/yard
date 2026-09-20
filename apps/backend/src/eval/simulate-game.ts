import {
  GameState,
  Move,
  MoveType,
  Player,
  RoleType,
  VALID_STARTING_NODES,
  getNextRole,
  initialPlayers,
} from '@yard/shared-utils';

/** Mr. X escapes after this many of his own moves (mirrors the client's TOTAL_ROUNDS). */
export const TOTAL_ROUNDS = 24;

export type DetectiveDecider = (gameState: GameState, detective: Player) => Promise<Move | null>;
export type CulpritDecider = (gameState: GameState, culprit: Player) => Promise<Move>;

export interface SimulationOptions {
  seed: number;
  decideDetective: DetectiveDecider;
  decideCulprit: CulpritDecider;
  /** Called after each committed move; use it to collect per-turn metrics. */
  onMove?: (gameState: GameState, move: Move) => void;
}

export interface SimulationResult {
  seed: number;
  winner: 'detectives' | 'culprit';
  /** Culprit moves played when the game ended. */
  rounds: number;
  totalMoves: number;
  startingPositions: Record<string, number>;
  captor: RoleType | null;
}

export function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededStartingPositions(seed: number): Record<RoleType, number> {
  const rng = makeRng(seed);
  const pool = [...VALID_STARTING_NODES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return {
    culprit: pool[0],
    detective1: pool[1],
    detective2: pool[2],
    detective3: pool[3],
    detective4: pool[4],
    detective5: pool[5],
  };
}

export function initialGameState(seed: number): GameState {
  const starts = seededStartingPositions(seed);
  return {
    channel: `eval-${seed}`,
    players: initialPlayers.map(p => ({
      ...p,
      position: starts[p.role],
      previousPosition: starts[p.role],
      isAI: true,
    })),
    currentTurn: 'culprit',
    moves: [],
    isDoubleMove: false,
    status: 'active',
  };
}

function spendTicket(player: Player, type: MoveType, secret: boolean, double: boolean): Player {
  const next = { ...player };
  if (type === 'taxi') next.taxiTickets = Math.max(0, player.taxiTickets - 1);
  if (type === 'bus') next.busTickets = Math.max(0, player.busTickets - 1);
  if (type === 'underground') next.undergroundTickets = Math.max(0, player.undergroundTickets - 1);
  if (secret) next.secretTickets = Math.max(0, (player.secretTickets ?? 0) - 1);
  if (double) next.doubleTickets = Math.max(0, (player.doubleTickets ?? 0) - 1);
  return next;
}

export function applyMove(gameState: GameState, move: Move): GameState {
  const secret = Boolean(move.secret);
  const double = Boolean(move.double);
  const committed: Move = { ...move, secret, double };

  return {
    ...gameState,
    players: gameState.players.map(p =>
      p.role === move.role
        ? { ...spendTicket(p, move.type, secret, double), previousPosition: p.position, position: move.position }
        : p
    ),
    moves: [...gameState.moves, committed],
    isDoubleMove: double,
    currentTurn: getNextRole(move.role as RoleType, double),
  };
}

export function findCaptor(gameState: GameState): Player | null {
  const culprit = gameState.players.find(p => p.role === 'culprit');
  if (!culprit) return null;
  return gameState.players.find(p => p.role !== 'culprit' && p.position === culprit.position) ?? null;
}

export function culpritMoveCount(gameState: GameState): number {
  return gameState.moves.filter(m => m.role === 'culprit').length;
}

export async function simulateGame({
  seed,
  decideDetective,
  decideCulprit,
  onMove,
}: SimulationOptions): Promise<SimulationResult> {
  let state = initialGameState(seed);
  const startingPositions = Object.fromEntries(state.players.map(p => [p.role, p.position]));
  const roleCount = state.players.length;
  // A full cycle of passes with no committed move means nobody can act; stop rather than spin.
  let consecutivePasses = 0;

  while (true) {
    const captor = findCaptor(state);
    if (captor) {
      return {
        seed,
        winner: 'detectives',
        rounds: culpritMoveCount(state),
        totalMoves: state.moves.length,
        startingPositions,
        captor: captor.role,
      };
    }
    if (culpritMoveCount(state) >= TOTAL_ROUNDS || consecutivePasses >= roleCount) {
      return {
        seed,
        winner: 'culprit',
        rounds: culpritMoveCount(state),
        totalMoves: state.moves.length,
        startingPositions,
        captor: null,
      };
    }

    const mover = state.players.find(p => p.role === state.currentTurn);
    if (!mover) throw new Error(`no player for turn ${state.currentTurn}`);

    let move: Move | null = null;
    if (mover.role === 'culprit') {
      try {
        move = await decideCulprit(state, mover);
        // The second leg of a double is never itself a double.
        if (state.isDoubleMove && move) move = { ...move, double: false };
      } catch {
        move = null;
      }
    } else {
      move = await decideDetective(state, mover);
    }

    if (!move) {
      consecutivePasses++;
      state = { ...state, isDoubleMove: false, currentTurn: getNextRole(mover.role, false) };
      continue;
    }

    consecutivePasses = 0;
    state = applyMove(state, { ...move, role: mover.role });
    onMove?.(state, state.moves[state.moves.length - 1]);
  }
}
