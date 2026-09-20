import {
  AiDecisionComparison,
  DeductionOptions,
  GAME_GRAPH,
  GameState,
  Move,
  Player,
  RoleType,
  buildDetectivesByTurn,
  computePossiblePositions,
  VALID_STARTING_NODES,
} from '@yard/shared-utils';
import { PolicyResult, TacticalPicture } from './detective-policy';
import { HeuristicDetectivePolicy } from './heuristic-detective-policy';
import { JevDetectivePolicy, JevPolicyResult } from './jev-detective-policy';
import { jevEnabled } from './jev-client';
import { ENV } from './env';
import { buildTacticalPicture } from './move-candidates';

export interface DetectiveDecision {
  move: Move;
  source: 'jev' | 'heuristic';
  comparison: AiDecisionComparison;
}

function sameMove(a: Move, b: Move): boolean {
  return a.position === b.position && a.type === b.type;
}

function uniformOverStartingNodes() {
  const possible = new Set(VALID_STARTING_NODES);
  const uniform = 1 / (possible.size || 1);
  return { possible, weights: new Map([...possible].map(n => [n, uniform])) };
}

/** Possible Mr. X positions, or a uniform prior when the log cannot be replayed.
 *  The engine is a planning aid: a violated invariant degrades the AI's targeting,
 *  it must never abort the turn. */
export function deductionFor(gameState: GameState, options: DeductionOptions = {}) {
  const culpritMoves = gameState.moves.filter(m => m.role === 'culprit');
  if (culpritMoves.length === 0) return uniformOverStartingNodes();

  const detectiveStartPositions = new Set(
    gameState.players.filter(p => p.role !== 'culprit').map(p => p.position)
  );
  const detectivesByTurn = buildDetectivesByTurn(gameState.moves, gameState.players);

  try {
    return computePossiblePositions(
      culpritMoves,
      GAME_GRAPH,
      detectivesByTurn,
      detectiveStartPositions,
      options
    );
  } catch (error) {
    console.warn(`[Deduction] falling back to uniform prior: ${(error as Error).message}`);
    return uniformOverStartingNodes();
  }
}

export class DetectiveDecisionArbiter {
  constructor(
    private readonly heuristic = new HeuristicDetectivePolicy(),
    private readonly jev = new JevDetectivePolicy()
  ) {}

  async decide(gameState: GameState, detective: Player): Promise<DetectiveDecision | null> {
    const { possible, weights } = deductionFor(gameState);
    const picture: TacticalPicture = buildTacticalPicture({
      gameState,
      detective,
      possible,
      weights,
    });

    const enabled = jevEnabled();

    const [heuristicResult, jevOutcome] = await Promise.all([
      this.heuristic.decide(gameState, detective, picture),
      enabled
        ? this.jev
            .decide(gameState, detective, picture)
            .then(result => ({ result, error: undefined as string | undefined }))
            .catch(error => ({
              result: null as JevPolicyResult | null,
              error: (error as Error).message,
            }))
        : Promise.resolve({ result: null as JevPolicyResult | null, error: undefined }),
    ]);

    const jevResult = jevOutcome.result;
    const jevUsable =
      jevResult !== null && jevResult.details.confidence >= ENV.JEV_MIN_CONFIDENCE;

    const usableJev = jevUsable ? jevResult : null;
    if (!heuristicResult && !usableJev) return null;

    const source: 'jev' | 'heuristic' = usableJev ? 'jev' : 'heuristic';
    const move = usableJev ? usableJev.move : (heuristicResult as PolicyResult).move;

    const heuristicMove = heuristicResult?.move ?? move;
    const rankInJev = jevResult
      ? (() => {
          const index = jevResult.ranked.findIndex(key => {
            const candidate = picture.candidates.find(c => c.key === key);
            return candidate ? sameMove(candidate.move, heuristicMove) : false;
          });
          return index === -1 ? null : index;
        })()
      : null;

    const comparison: AiDecisionComparison = {
      role: detective.role as RoleType,
      moveIndex: gameState.moves.length,
      chosen: source,
      agree: jevResult ? sameMove(jevResult.move, heuristicMove) : false,
      jevEnabled: enabled,
      heuristic: { move: heuristicMove, rankInJev },
      jev: jevResult
        ? {
            move: jevResult.move,
            confidence: jevResult.details.confidence,
            model: jevResult.details.model,
            latencyMs: jevResult.details.latencyMs,
            top: jevResult.ranked
              .slice(0, 5)
              .flatMap(key => {
                const candidate = picture.candidates.find(c => c.key === key);
                if (!candidate) return [];
                return [
                  {
                    key,
                    move: candidate.move,
                    probability: jevResult.details.probabilities[key] ?? 0,
                  },
                ];
              }),
          }
        : null,
      ...(jevOutcome.error ? { jevError: jevOutcome.error } : {}),
    };

    return { move, source, comparison };
  }
}
