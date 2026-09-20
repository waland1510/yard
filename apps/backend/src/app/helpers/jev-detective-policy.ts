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

export interface DescribeContext {
  /** Highest tickets-remaining among all candidates; the yardstick for "cheap" vs "scarce". */
  maxTicketAfter: number;
}

/** Jev cannot compare numbers reliably, so ticket cost is stated relative to the other
 *  options in words rather than left as a count. */
function ticketCostPhrase(candidate: MoveCandidate, { maxTicketAfter }: DescribeContext): string {
  const { ticketAfter } = candidate;
  const type = candidate.move.type;
  const noun = `${type} ticket${ticketAfter === 1 ? '' : 's'}`;
  if (ticketAfter === 0) return `Spends the last ${type} ticket.`;
  if (ticketAfter >= maxTicketAfter) return `Cheapest option: leaves ${ticketAfter} ${noun}, the most of any choice.`;
  if (ticketAfter <= 2) return `Costly: leaves only ${ticketAfter} ${noun}, which are running out.`;
  if (ticketAfter * 2 <= maxTicketAfter) return `Uses a scarcer ticket: leaves ${ticketAfter} ${noun}.`;
  return `Leaves ${ticketAfter} ${noun}.`;
}

export function describeCandidate(candidate: MoveCandidate, context: DescribeContext): string {
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
  parts.push(`From there the detective can afford ${candidate.exits} onward connection${candidate.exits === 1 ? '' : 's'}.`);
  parts.push(ticketCostPhrase(candidate, context));

  return parts.join(' ');
}

/** Deterministic per-decision shuffle. Jev shows a position preference between otherwise
 *  equal options; a fixed transport order would turn that into a systematic transport bias. */
export function shuffleForDecision<T extends { key: string }>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const rng = () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function describeContext(candidates: MoveCandidate[]): DescribeContext {
  return { maxTicketAfter: Math.max(0, ...candidates.map(c => c.ticketAfter)) };
}

export const DECISION_FOCUS =
  'Close the net on the most likely Mr. X nodes. Capturing him outright is best. ' +
  'Otherwise prefer moves that cover the most suspect probability and avoid crowding the ' +
  'other detectives onto the same area. When two moves are otherwise equal, take the one ' +
  'described as the cheapest option and avoid ones described as costly or scarce.';

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
    const context = describeContext(picture.candidates);
    const seed = `${detective.role}:${detective.position}:${picture.round}:${picture.candidates.map(c => c.key).join(',')}`;
    const criteria: ChoiceCriteria = {};
    for (const candidate of shuffleForDecision(picture.candidates, seed)) {
      criteria[candidate.key] = describeCandidate(candidate, context);
    }

    const startedAt = Date.now();
    const result = await client.systemOne(
      {
        state: buildState(detective, picture),
        questions: {
          [QUESTION]: choice(
            { question: 'Which move should this detective make now?', focus: DECISION_FOCUS },
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
