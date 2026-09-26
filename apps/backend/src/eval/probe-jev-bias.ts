// Controlled probe of the Jev decider: does it prefer a transport or an option position
// when candidates are otherwise equal, and does it take a capture when one is offered?
// Run: bun --env-file=apps/backend/.env.development run apps/backend/src/eval/probe-jev-bias.ts

import { choice } from '@typesafe-ai/sdk';
import { Player, Role } from '@yard/shared-utils';
import { MoveCandidate, TacticalPicture, candidateKey } from '../app/helpers/detective-policy';
import { DECISION_FOCUS, buildState, describeCandidate, describeContext } from '../app/helpers/jev-detective-policy';
import { getJevClient } from '../app/helpers/jev-client';

const REPEATS = Number(process.argv[2] ?? 6);

function candidate(type: 'taxi' | 'bus' | 'underground', position: number, overrides: Partial<MoveCandidate> = {}): MoveCandidate {
  return {
    key: candidateKey(type, position),
    move: { type, position, secret: false, double: false, role: Role.detective1 },
    destinationName: `#${position}`,
    hopsToTopSuspect: 4,
    suspectMassWithin1: 0,
    suspectMassWithin2: 0.05,
    landsOnSuspect: false,
    exits: 4,
    ticketAfter: 5,
    ...overrides,
  };
}

const detective: Player = {
  id: 1, role: Role.detective1, position: 67,
  taxiTickets: 9, busTickets: 4, undergroundTickets: 4,
};

function picture(candidates: MoveCandidate[]): TacticalPicture {
  return {
    round: 5,
    nextRevealInRounds: 3,
    possibleCount: 12,
    topSuspects: [{ node: 89, probability: 0.31 }, { node: 105, probability: 0.2 }],
    lastRevealed: { node: 89, roundsAgo: 2 },
    otherDetectives: [{ role: Role.detective2, position: 120 }],
    candidates,
  };
}

async function ask(candidates: MoveCandidate[]) {
  const client = getJevClient();
  if (!client) throw new Error('TYPESAFE_API_KEY not set');
  const criteria: Record<string, string> = {};
  const context = describeContext(candidates);
  for (const c of candidates) criteria[c.key] = describeCandidate(c, context);
  const result = await client.systemOne({
    state: buildState(detective, picture(candidates)),
    questions: {
      move: choice(
        { question: 'Which move should this detective make now?', focus: DECISION_FOCUS },
        criteria
      ),
    },
  });
  return result.answers.move;
}

async function trial(name: string, candidates: MoveCandidate[]) {
  const tally = new Map<string, number>();
  const probSum = new Map<string, number>();
  for (let i = 0; i < REPEATS; i++) {
    const a = await ask(candidates);
    tally.set(a.choice, (tally.get(a.choice) ?? 0) + 1);
    for (const [k, p] of Object.entries(a.probabilities as Record<string, number>)) {
      probSum.set(k, (probSum.get(k) ?? 0) + p);
    }
  }
  const summary = candidates
    .map(c => `${c.key}: picked ${tally.get(c.key) ?? 0}/${REPEATS}, mean p=${((probSum.get(c.key) ?? 0) / REPEATS).toFixed(2)}`)
    .join(' | ');
  process.stdout.write(`${name}\n  ${summary}\n`);
}

async function main() {
  // Equal features; only transport differs. Both orderings.
  const taxiEq = candidate('taxi', 84, { ticketAfter: 8 });
  const busEq = candidate('bus', 102, { ticketAfter: 3 });
  await trial('A1 equal features, 8 taxi vs 3 bus left, taxi listed first', [taxiEq, busEq]);
  await trial('A2 equal features, 8 taxi vs 3 bus left, bus listed first', [busEq, taxiEq]);

  // Same transport twice: pure position bias check.
  await trial('B  equal features, two taxis', [candidate('taxi', 84), candidate('taxi', 111)]);

  // Capture available by bus (1 stop), taxi is 2 hops away.
  const busCapture = candidate('bus', 89, { hopsToTopSuspect: 0, suspectMassWithin1: 0.31, suspectMassWithin2: 0.51, landsOnSuspect: true, ticketAfter: 3 });
  const taxiNear = candidate('taxi', 68, { hopsToTopSuspect: 2, suspectMassWithin1: 0.0, suspectMassWithin2: 0.31, ticketAfter: 8 });
  await trial('C1 bus captures, taxi 2 hops; taxi first', [taxiNear, busCapture]);
  await trial('C2 bus captures, taxi 2 hops; bus first', [busCapture, taxiNear]);

  // Same as C but the capture is by taxi and the 2-hop move is by bus.
  const taxiCapture = candidate('taxi', 89, { hopsToTopSuspect: 0, suspectMassWithin1: 0.31, suspectMassWithin2: 0.51, landsOnSuspect: true, ticketAfter: 8 });
  const busNear = candidate('bus', 68, { hopsToTopSuspect: 2, suspectMassWithin2: 0.31, ticketAfter: 3 });
  await trial('D  taxi captures, bus 2 hops; bus first', [busNear, taxiCapture]);

  // The screenshot case: same destination, taxi leaves 5, bus spends its last ticket.
  const taxiSame = candidate('taxi', 89, { hopsToTopSuspect: 1, suspectMassWithin1: 0.4, ticketAfter: 5 });
  const busSame = candidate('bus', 89, { hopsToTopSuspect: 1, suspectMassWithin1: 0.4, ticketAfter: 0 });
  await trial('E1 same destination, last bus ticket; taxi first', [taxiSame, busSame]);
  await trial('E2 same destination, last bus ticket; bus first', [busSame, taxiSame]);
}

main().catch(e => { process.stderr.write(`${(e as Error).stack}\n`); process.exit(1); });
