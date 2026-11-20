import { CompanionResumeRegistry } from './companion-resume-registry';

const link = {
  channel: 'game-a',
  role: 'detective1',
  hostClientId: 'desktop-a',
  phoneClientId: 'phone-a',
} as const;

describe('CompanionResumeRegistry', () => {
  it('companionResumeRegistry_withLiveCredential_reusesOnlyTheOriginalGameAndPhone', () => {
    const registry = new CompanionResumeRegistry();
    const { token } = registry.issue(link, 0);

    expect(registry.find(token, link.channel, link.phoneClientId, 1)).toMatchObject(link);
    expect(registry.find(token, 'game-b', link.phoneClientId, 1)).toBeUndefined();
    expect(registry.find(token, link.channel, 'phone-b', 1)).toBeUndefined();
    expect(registry.find(token, link.channel, link.phoneClientId, 2)).toMatchObject(link);
  });

  it('companionResumeRegistry_atExpiration_rejectsTheCredential', () => {
    const registry = new CompanionResumeRegistry();
    const { token, expiresAt } = registry.issue(link, 0);

    expect(registry.find(token, link.channel, link.phoneClientId, expiresAt - 1)).toMatchObject(link);
    expect(registry.find(token, link.channel, link.phoneClientId, expiresAt)).toBeUndefined();
  });

  it.each([link.hostClientId, link.phoneClientId])(
    'companionResumeRegistry_whenDeviceUnpairs_revokesTheCredential (%s)',
    (clientId) => {
      const registry = new CompanionResumeRegistry();
      const { token } = registry.issue(link, 0);

      registry.revoke('game-b', clientId);
      expect(registry.find(token, link.channel, link.phoneClientId, 1)).toMatchObject(link);
      registry.revoke(link.channel, clientId);
      expect(registry.find(token, link.channel, link.phoneClientId, 1)).toBeUndefined();
    }
  );

  it('companionResumeRegistry_whenHostPairsNewPhone_revokesThePreviousCredential', () => {
    const registry = new CompanionResumeRegistry();
    const { token } = registry.issue(link, 0);
    const replacement = { ...link, phoneClientId: 'phone-b' };
    const { token: newToken } = registry.issue(replacement, 1);

    expect(registry.find(token, link.channel, link.phoneClientId, 1)).toBeUndefined();
    expect(registry.find(newToken, link.channel, replacement.phoneClientId, 1)).toMatchObject(replacement);
  });
});
