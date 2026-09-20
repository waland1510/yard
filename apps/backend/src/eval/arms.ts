import { DeductionOptions, GameState, Move, Player } from '@yard/shared-utils';
import { AIPlayerService, calculateDetectiveMove } from '../app/helpers/ai-player';
import { deductionFor } from '../app/helpers/ai-decision-arbiter';
import { HeuristicDetectivePolicy } from '../app/helpers/heuristic-detective-policy';
import { JevDetectivePolicy } from '../app/helpers/jev-detective-policy';
import { jevEnabled } from '../app/helpers/jev-client';
import { buildTacticalPicture } from '../app/helpers/move-candidates';
import { CulpritDecider, DetectiveDecider } from './simulate-game';

export type ArmName = 'legacy' | 'heuristic' | 'jev';
export const ALL_ARMS: ArmName[] = ['legacy', 'heuristic', 'jev'];

export interface JevStats {
  calls: number;
  fallbacks: number;
  errors: number;
  totalLatencyMs: number;
  inputTokens: number;
  outputTokens: number;
  agreedWithHeuristic: number;
}

export interface Arm {
  name: ArmName;
  decideDetective: DetectiveDecider;
  jevStats?: JevStats;
}

const culpritService = new AIPlayerService();

/** Mr. X is always the existing culprit heuristic, so arms differ only in detective play. */
export const decideCulprit: CulpritDecider = (gameState, culprit) =>
  culpritService.calculateMove(gameState, culprit);

function pictureFor(gameState: GameState, detective: Player, options: DeductionOptions) {
  const { possible, weights } = deductionFor(gameState, options);
  return buildTacticalPicture({ gameState, detective, possible, weights });
}

export function legacyArm(): Arm {
  return {
    name: 'legacy',
    decideDetective: async (gameState, detective) => {
      try {
        return calculateDetectiveMove(gameState, detective);
      } catch {
        return null;
      }
    },
  };
}

export function heuristicArm(options: DeductionOptions = {}): Arm {
  const policy = new HeuristicDetectivePolicy();
  return {
    name: 'heuristic',
    decideDetective: async (gameState, detective) => {
      const result = await policy.decide(gameState, detective, pictureFor(gameState, detective, options));
      return result?.move ?? null;
    },
  };
}

export function jevArm(options: DeductionOptions = {}): Arm {
  const jev = new JevDetectivePolicy();
  const heuristic = new HeuristicDetectivePolicy();
  const jevStats: JevStats = {
    calls: 0,
    fallbacks: 0,
    errors: 0,
    totalLatencyMs: 0,
    inputTokens: 0,
    outputTokens: 0,
    agreedWithHeuristic: 0,
  };

  const decideDetective: DetectiveDecider = async (gameState, detective) => {
    const picture = pictureFor(gameState, detective, options);
    if (picture.candidates.length === 0) return null;

    const heuristicResult = await heuristic.decide(gameState, detective, picture);
    jevStats.calls++;

    let jevMove: Move | null = null;
    try {
      const result = await jev.decide(gameState, detective, picture);
      if (result) {
        jevMove = result.move;
        jevStats.totalLatencyMs += result.details.latencyMs;
        jevStats.inputTokens += result.details.usage.inputTokens;
        jevStats.outputTokens += result.details.usage.outputTokens;
      }
    } catch {
      jevStats.errors++;
    }

    if (!jevMove) {
      jevStats.fallbacks++;
      return heuristicResult?.move ?? null;
    }
    if (
      heuristicResult &&
      heuristicResult.move.position === jevMove.position &&
      heuristicResult.move.type === jevMove.type
    ) {
      jevStats.agreedWithHeuristic++;
    }
    return jevMove;
  };

  return { name: 'jev', decideDetective, jevStats };
}

export function buildArm(name: ArmName, options: DeductionOptions = {}): Arm {
  if (name === 'legacy') return legacyArm();
  if (name === 'heuristic') return heuristicArm(options);
  return jevArm(options);
}

export function armAvailable(name: ArmName): boolean {
  return name !== 'jev' || jevEnabled();
}
