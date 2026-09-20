import { AiDecisionSource, AiProposal } from '@yard/shared-utils';

export interface ProposalOutcome {
  source: AiDecisionSource;
  chosenBy: 'human' | 'timeout';
}

interface Pending {
  proposal: AiProposal;
  resolve: (outcome: ProposalOutcome) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** One open proposal per channel. Resolves on the first valid human choice, or on timeout
 *  with the fallback source. Late or mismatched choices are ignored. */
export class AiProposalRegistry {
  private readonly pending = new Map<string, Pending>();
  private counter = 0;

  constructor(private readonly fallback: AiDecisionSource = 'heuristic') {}

  nextId(channel: string): string {
    this.counter++;
    return `${channel}:${Date.now()}:${this.counter}`;
  }

  open(channel: string, proposal: AiProposal, timeoutMs: number): Promise<ProposalOutcome> {
    this.cancel(channel);
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        this.pending.delete(channel);
        resolve({ source: this.fallback, chosenBy: 'timeout' });
      }, timeoutMs);
      this.pending.set(channel, { proposal, resolve, timer });
    });
  }

  choose(channel: string, proposalId: string, source: AiDecisionSource): boolean {
    const entry = this.pending.get(channel);
    if (!entry || entry.proposal.id !== proposalId) return false;
    if (!entry.proposal.options.some(o => o.source === source)) return false;
    clearTimeout(entry.timer);
    this.pending.delete(channel);
    entry.resolve({ source, chosenBy: 'human' });
    return true;
  }

  current(channel: string): AiProposal | null {
    return this.pending.get(channel)?.proposal ?? null;
  }

  cancel(channel: string): void {
    const entry = this.pending.get(channel);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.pending.delete(channel);
    entry.resolve({ source: this.fallback, chosenBy: 'timeout' });
  }
}
