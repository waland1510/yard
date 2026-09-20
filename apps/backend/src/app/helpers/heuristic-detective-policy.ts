import { GameState, Player } from '@yard/shared-utils';
import {
  DetectivePolicy,
  MoveCandidate,
  PolicyResult,
  TacticalPicture,
} from './detective-policy';
import { HOPS_UNREACHABLE, hopDistance } from './move-candidates';
import { decideLocalMove } from './local-move-decision';

function scoreCandidate(candidate: MoveCandidate, picture: TacticalPicture): number {
  const spread = picture.otherDetectives.reduce((worst, other) => {
    const d = hopDistance(candidate.move.position, other.position, 4);
    return Math.min(worst, d === HOPS_UNREACHABLE ? 4 : d);
  }, 4);

  return (
    (candidate.landsOnSuspect ? 1000 : 0) +
    candidate.suspectMassWithin1 * 500 +
    candidate.suspectMassWithin2 * 120 -
    Math.min(candidate.hopsToTopSuspect, 12) * 25 +
    candidate.exits * 2 +
    spread * 4
  );
}

export function rankCandidates(
  candidates: MoveCandidate[],
  picture: TacticalPicture
): MoveCandidate[] {
  return [...candidates].sort(
    (a, b) => scoreCandidate(b, picture) - scoreCandidate(a, picture)
  );
}

export class HeuristicDetectivePolicy implements DetectivePolicy {
  readonly name = 'heuristic' as const;

  async decide(
    gameState: GameState,
    detective: Player,
    picture: TacticalPicture
  ): Promise<PolicyResult | null> {
    if (picture.candidates.length === 0) {
      try {
        const fallback = decideLocalMove(gameState, detective);
        return { move: { ...fallback, role: detective.role }, ranked: [] };
      } catch {
        // Stranded: no affordable transport, or every destination is occupied.
        return null;
      }
    }

    const ranked = rankCandidates(picture.candidates, picture);
    return { move: ranked[0].move, ranked: ranked.map(c => c.key) };
  }
}
