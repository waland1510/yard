import type { Move } from '@yard/shared-utils';
import { describeJoin, describeMove } from './move-feed';
import { getTheme } from './theme-registry';
import { nodeDisplayName } from './map-data';

const classic = getTheme('classic');

function culpritMoves(count: number): Move[] {
  return Array.from({ length: count }, (_, i) => ({ role: 'culprit', type: 'taxi', position: 10 + i }));
}

describe('moveFeed', () => {
  it('moveFeed_culpritOnHiddenRound_omitsPosition', () => {
    const move = { role: 'culprit' as const, type: 'bus' as const, position: 123 };
    const line = describeMove(move, culpritMoves(2), classic);
    expect(line.kind).toBe('info');
    expect(line.message).not.toContain(nodeDisplayName(123));
    expect(line.message).toContain(classic.transportation.bus);
  });

  it('moveFeed_culpritOnRevealRound_showsPosition', () => {
    const move = { role: 'culprit' as const, type: 'taxi' as const, position: 123 };
    const line = describeMove(move, culpritMoves(3), classic);
    expect(line.kind).toBe('reveal');
    expect(line.message).toContain(nodeDisplayName(123));
  });

  it('moveFeed_culpritSecretTicket_hidesTransport', () => {
    const move = { role: 'culprit' as const, type: 'underground' as const, position: 50, secret: true };
    const line = describeMove(move, culpritMoves(1), classic);
    expect(line.message).toContain(classic.transportation.secret);
    expect(line.message).not.toContain(classic.transportation.underground);
  });

  it('moveFeed_detectiveMove_namesTransportAndDestination', () => {
    const move = { role: 'detective2' as const, type: 'bus' as const, position: 77 };
    const line = describeMove(move, [], classic);
    expect(line.message).toContain(classic.characters.detectives[1].name);
    expect(line.message).toContain(classic.transportation.bus);
    expect(line.message).toContain(nodeDisplayName(77));
  });

  it('moveFeed_joinWithUsername_includesNameAndCharacter', () => {
    const line = describeJoin('culprit', 'dew', classic);
    expect(line.message).toBe(`dew joined as ${classic.characters.culprit.name}`);
  });
});
