import { Move, Player, GameState, MoveType } from '@yard/shared-utils';

export interface MoveCandidate {
  key: string;
  move: Move;
  destinationName: string;
  hopsToTopSuspect: number;
  suspectMassWithin1: number;
  suspectMassWithin2: number;
  landsOnSuspect: boolean;
  exits: number;
  ticketAfter: number;
}

export interface TacticalPicture {
  round: number;
  nextRevealInRounds: number | null;
  possibleCount: number;
  topSuspects: Array<{ node: number; probability: number }>;
  lastRevealed: { node: number; roundsAgo: number } | null;
  otherDetectives: Array<{ role: string; position: number }>;
  candidates: MoveCandidate[];
}

export interface PolicyResult {
  move: Move;
  /** Candidate keys best-first. Used to locate the other policy's pick in this ranking. */
  ranked: string[];
}

export interface DetectivePolicy {
  readonly name: 'heuristic' | 'jev';
  decide(
    gameState: GameState,
    detective: Player,
    picture: TacticalPicture
  ): Promise<PolicyResult | null>;
}

export function candidateKey(type: MoveType, position: number): string {
  return `${type}_${position}`;
}
