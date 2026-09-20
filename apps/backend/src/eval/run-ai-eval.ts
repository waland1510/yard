import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { GameState, Move } from '@yard/shared-utils';
import { deductionFor } from '../app/helpers/ai-decision-arbiter';
import { ALL_ARMS, Arm, ArmName, armAvailable, buildArm, decideCulprit } from './arms';
import { SimulationResult, simulateGame } from './simulate-game';

interface CliOptions {
  games: number;
  seedStart: number;
  arms: ArmName[];
  concurrency: number;
  out: string | null;
  verbose: boolean;
}

interface GameRecord extends SimulationResult {
  /** Size of Mr. X's possible set after each detective move; smaller is a tighter net. */
  meanPossibleSize: number;
}

interface ArmSummary {
  arm: ArmName;
  games: number;
  detectiveWins: number;
  winRate: number;
  meanCaptureRound: number | null;
  meanRounds: number;
  meanPossibleSize: number;
  jev?: {
    calls: number;
    fallbackRate: number;
    errorRate: number;
    meanLatencyMs: number;
    agreementRate: number;
    inputTokens: number;
    estimatedCostUsd: number;
  };
}

const USD_PER_INPUT_TOKEN = 0.042 / 1_000_000;

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    games: 20,
    seedStart: 1,
    arms: [...ALL_ARMS],
    concurrency: 4,
    out: null,
    verbose: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = argv[i + 1];
    if (arg === '--games') {
      options.games = parseInt(value, 10);
      i++;
    } else if (arg === '--seed-start') {
      options.seedStart = parseInt(value, 10);
      i++;
    } else if (arg === '--arms') {
      options.arms = value.split(',') as ArmName[];
      i++;
    } else if (arg === '--concurrency') {
      options.concurrency = parseInt(value, 10);
      i++;
    } else if (arg === '--out') {
      options.out = value;
      i++;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--help') {
      process.stdout.write(
        'bun run apps/backend/src/eval/run-ai-eval.ts [--games N] [--seed-start N] ' +
          '[--arms legacy,heuristic,jev] [--concurrency N] [--out file.json] [--verbose]\n'
      );
      process.exit(0);
    }
  }
  return options;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

async function playGame(arm: Arm, seed: number): Promise<GameRecord> {
  const possibleSizes: number[] = [];
  const onMove = (state: GameState, move: Move) => {
    if (move.role === 'culprit') return;
    possibleSizes.push(deductionFor(state).possible.size);
  };
  const result = await simulateGame({
    seed,
    decideDetective: arm.decideDetective,
    decideCulprit,
    onMove,
  });
  const meanPossibleSize =
    possibleSizes.length === 0 ? 0 : possibleSizes.reduce((a, b) => a + b, 0) / possibleSizes.length;
  return { ...result, meanPossibleSize };
}

function summarize(arm: Arm, records: GameRecord[]): ArmSummary {
  const wins = records.filter(r => r.winner === 'detectives');
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

  const summary: ArmSummary = {
    arm: arm.name,
    games: records.length,
    detectiveWins: wins.length,
    winRate: records.length ? wins.length / records.length : 0,
    meanCaptureRound: wins.length ? mean(wins.map(r => r.rounds)) : null,
    meanRounds: mean(records.map(r => r.rounds)),
    meanPossibleSize: mean(records.map(r => r.meanPossibleSize)),
  };

  if (arm.jevStats) {
    const s = arm.jevStats;
    const answered = s.calls - s.fallbacks;
    summary.jev = {
      calls: s.calls,
      fallbackRate: s.calls ? s.fallbacks / s.calls : 0,
      errorRate: s.calls ? s.errors / s.calls : 0,
      meanLatencyMs: answered ? s.totalLatencyMs / answered : 0,
      agreementRate: answered ? s.agreedWithHeuristic / answered : 0,
      inputTokens: s.inputTokens,
      estimatedCostUsd: s.inputTokens * USD_PER_INPUT_TOKEN,
    };
  }
  return summary;
}

function pct(x: number): string {
  return `${(x * 100).toFixed(0)}%`;
}

function printTable(summaries: ArmSummary[]) {
  const rows = summaries.map(s => [
    s.arm,
    String(s.games),
    `${s.detectiveWins} (${pct(s.winRate)})`,
    s.meanCaptureRound === null ? '—' : s.meanCaptureRound.toFixed(1),
    s.meanRounds.toFixed(1),
    s.meanPossibleSize.toFixed(1),
    s.jev ? `${pct(s.jev.fallbackRate)} fb · ${pct(s.jev.agreementRate)} agree · ${s.jev.meanLatencyMs.toFixed(0)}ms · $${s.jev.estimatedCostUsd.toFixed(4)}` : '',
  ]);
  const header = ['arm', 'games', 'detective wins', 'capture round', 'rounds', 'possible set', 'jev'];
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map(r => r[i].length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join('  ');
  process.stdout.write(`\n${line(header)}\n${line(widths.map(w => '-'.repeat(w)))}\n`);
  for (const row of rows) process.stdout.write(`${line(row)}\n`);
  process.stdout.write('\n');
}

function printHeadToHead(perArm: Map<ArmName, GameRecord[]>) {
  const arms = [...perArm.keys()];
  for (let i = 0; i < arms.length; i++) {
    for (let j = i + 1; j < arms.length; j++) {
      const a = perArm.get(arms[i]) ?? [];
      const b = perArm.get(arms[j]) ?? [];
      let aOnly = 0;
      let bOnly = 0;
      let both = 0;
      let neither = 0;
      for (let k = 0; k < Math.min(a.length, b.length); k++) {
        const aw = a[k].winner === 'detectives';
        const bw = b[k].winner === 'detectives';
        if (aw && bw) both++;
        else if (aw) aOnly++;
        else if (bw) bOnly++;
        else neither++;
      }
      process.stdout.write(
        `${arms[i]} vs ${arms[j]} (same seeds): both win ${both} · only ${arms[i]} ${aOnly} · only ${arms[j]} ${bOnly} · neither ${neither}\n`
      );
    }
  }
  process.stdout.write('\n');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const seeds = Array.from({ length: options.games }, (_, i) => options.seedStart + i);

  if (!options.verbose) {
    // The legacy heuristic narrates every decision; silence it for clean runs.
    console.log = () => undefined;
    console.warn = () => undefined;
  }

  const requested = options.arms;
  const arms = requested.filter(armAvailable).map(buildArm);
  const skipped = requested.filter(name => !armAvailable(name));
  if (skipped.length) {
    process.stderr.write(`skipping ${skipped.join(', ')}: TYPESAFE_API_KEY not set or AI_DETECTIVE_POLICY=heuristic\n`);
  }

  const perArm = new Map<ArmName, GameRecord[]>();
  const summaries: ArmSummary[] = [];
  for (const arm of arms) {
    const started = Date.now();
    const records = await mapWithConcurrency(seeds, options.concurrency, seed => playGame(arm, seed));
    perArm.set(arm.name, records);
    summaries.push(summarize(arm, records));
    process.stderr.write(`${arm.name}: ${records.length} games in ${((Date.now() - started) / 1000).toFixed(1)}s\n`);
  }

  printTable(summaries);
  if (arms.length > 1) printHeadToHead(perArm);

  if (options.out) {
    mkdirSync(dirname(options.out), { recursive: true });
    writeFileSync(
      options.out,
      JSON.stringify(
        {
          ranAt: new Date().toISOString(),
          options,
          summaries,
          games: Object.fromEntries([...perArm.entries()]),
        },
        null,
        2
      )
    );
    process.stderr.write(`wrote ${options.out}\n`);
  }
}

main().catch(error => {
  process.stderr.write(`${(error as Error).stack ?? error}\n`);
  process.exit(1);
});
