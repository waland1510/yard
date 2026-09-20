import { ChoiceCriteria, choice } from '@typesafe-ai/sdk';
import { GameState, Player } from '@yard/shared-utils';
import {
  DetectivePolicy,
  MoveCandidate,
  PolicyResult,
  TacticalPicture,
} from './detective-policy';
import { ENV } from './env';
import { getJevClient, jevEnabled } from './jev-client';
import { HOPS_UNREACHABLE } from './move-candidates';

const QUESTION = 'move';

export interface JevDetails {
  confidence: number;
  probabilities: Record<string, number>;
  model: string;
  latencyMs: number;
  usage: { inputTokens: number; outputTokens: number };
}

export interface JevPolicyResult extends PolicyResult {
  details: JevDetails;
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function describeCandidate(candidate: MoveCandidate): string {
  const parts: string[] = [
    `Take the ${candidate.move.type} to node ${candidate.destinationName}.`,
  ];

  if (candidate.landsOnSuspect) {
    parts.push('This node is itself a possible Mr. X location, so the move may capture him now.');
  }

  parts.push(
    candidate.hopsToTopSuspect === HOPS_UNREACHABLE
      ? 'No route to the most likely Mr. X node.'
      : `${candidate.hopsToTopSuspect} hops from the most likely Mr. X node.`
  );

  parts.push(
    `Probability Mr. X is on or next to this node: ${pct(candidate.suspectMassWithin1)}; within two hops: ${pct(candidate.suspectMassWithin2)}.`
  );
  parts.push(`The node has ${candidate.exits} connections.`);
  parts.push(
    `Leaves ${candidate.ticketAfter} ${candidate.move.type} ticket${candidate.ticketAfter === 1 ? '' : 's'}.`
  );

  return parts.join(' ');
}

export function buildState(detective: Player, picture: TacticalPicture) {
  return {
    game:
      'Scotland Yard. Detectives hunt a hidden fugitive, Mr. X, across a transport network. ' +
      'A detective catches Mr. X by moving onto his node. Mr. X is revealed only on certain rounds.',
    round: picture.round,
    nextRevealInRounds: picture.nextRevealInRounds,
    thisDetective: {
      role: detective.role,
      atNode: detective.position,
      tickets: {
        taxi: detective.taxiTickets,
        bus: detective.busTickets,
        underground: detective.undergroundTickets,
      },
    },
    otherDetectives: picture.otherDetectives.map(d => ({ role: d.role, atNode: d.position })),
    suspects: {
      possibleNodeCount: picture.possibleCount,
      mostLikely: picture.topSuspects.map(s => ({
        node: s.node,
        probability: pct(s.probability),
      })),
    },
    lastConfirmedSighting: picture.lastRevealed
      ? { node: picture.lastRevealed.node, roundsAgo: picture.lastRevealed.roundsAgo }
      : 'Mr. X has not been revealed yet',
  };
}

export class JevDetectivePolicy implements DetectivePolicy {
  readonly name = 'jev' as const;

  async decide(
    _gameState: GameState,
    detective: Player,
    picture: TacticalPicture
  ): Promise<JevPolicyResult | null> {
    const client = getJevClient();
    if (!client || picture.candidates.length === 0) return null;

    const byKey = new Map(picture.candidates.map(c => [c.key, c]));
    const criteria: ChoiceCriteria = {};
    for (const candidate of picture.candidates) {
      criteria[candidate.key] = describeCandidate(candidate);
    }

    const startedAt = Date.now();
    const result = await client.systemOne(
      {
        state: buildState(detective, picture),
        questions: {
          [QUESTION]: choice(
            {
              question: 'Which move should this detective make now?',
              focus:
                'Close the net on the most likely Mr. X nodes. Capturing him outright is best. ' +
                'Otherwise prefer moves that cover the most suspect probability, avoid crowding the ' +
                'other detectives onto the same area, and keep scarce underground tickets for later.',
            },
            criteria
          ),
        },
      },
      { timeout: ENV.JEV_TIMEOUT_MS }
    );

    const latencyMs = Date.now() - startedAt;
    const answer = result.answers[QUESTION];
    const picked = byKey.get(answer.choice);
    if (!picked) return null;

    const probabilities = answer.probabilities as Record<string, number>;
    const ranked = [...picture.candidates]
      .sort((a, b) => (probabilities[b.key] ?? 0) - (probabilities[a.key] ?? 0))
      .map(c => c.key);

    return {
      move: picked.move,
      ranked,
      details: {
        confidence: answer.confidence,
        probabilities,
        model: result.model,
        latencyMs,
        usage: {
          inputTokens: result.usage.input_tokens,
          outputTokens: result.usage.output_tokens,
        },
      },
    };
  }
}

export { jevEnabled };
