import { PairingRegistry } from '@yard/shared-utils';
import { CompanionSession, type CompanionTransport } from './companion-session';

describe('PairingRegistry', () => {
  const fixedCode = () => {
    let n = 0;
    return () => `CODE${(n++).toString().padStart(2, '0')}`; // CODE00, CODE01, ...
  };

  it('pairingRegistry_freshCode_redeemsExactlyOnce', () => {
    const reg = new PairingRegistry({ genCode: fixedCode() });
    const { code } = reg.issue({ channel: 'g1', role: 'detective1', hostClientId: 'host', now: 0 });

    const first = reg.redeem({ code, now: 100 });
    expect(first).toEqual({ ok: true, channel: 'g1', role: 'detective1', hostClientId: 'host' });

    const second = reg.redeem({ code, now: 200 });
    expect(second).toEqual({ ok: false, reason: 'already-redeemed' });
  });

  it('pairingRegistry_expiredCode_isRejected', () => {
    const reg = new PairingRegistry({ ttlMs: 1000, genCode: fixedCode() });
    const { code, expiresAt } = reg.issue({ channel: 'g1', role: 'culprit', hostClientId: 'h', now: 0 });
    expect(expiresAt).toBe(1000);

    expect(reg.redeem({ code, now: 1000 })).toEqual({ ok: false, reason: 'expired' });
    // Once expired it is gone — a later redeem reads as unknown, not expired.
    expect(reg.redeem({ code, now: 1500 })).toEqual({ ok: false, reason: 'unknown-code' });
  });

  it('pairingRegistry_unknownCode_isRejected', () => {
    const reg = new PairingRegistry({ genCode: fixedCode() });
    expect(reg.redeem({ code: 'NOPE99', now: 0 })).toEqual({ ok: false, reason: 'unknown-code' });
  });

  it('pairingRegistry_redeemIsCaseInsensitive', () => {
    const reg = new PairingRegistry({ genCode: () => 'ABC234' });
    reg.issue({ channel: 'g1', role: 'detective2', hostClientId: 'h', now: 0 });
    expect(reg.redeem({ code: 'abc234', now: 1 }).ok).toBe(true);
  });

  it('pairingRegistry_revoke_dropsCode', () => {
    const reg = new PairingRegistry({ genCode: () => 'ABC234' });
    reg.issue({ channel: 'g1', role: 'detective2', hostClientId: 'h', now: 0 });
    reg.revoke('abc234');
    expect(reg.redeem({ code: 'ABC234', now: 1 })).toEqual({ ok: false, reason: 'unknown-code' });
  });

  it('pairingRegistry_prune_removesExpiredOnIssue', () => {
    const reg = new PairingRegistry({ ttlMs: 100, genCode: fixedCode() });
    reg.issue({ channel: 'g1', role: 'detective1', hostClientId: 'h', now: 0 });
    expect(reg.size()).toBe(1);
    // Issuing later prunes the expired first code.
    reg.issue({ channel: 'g1', role: 'detective2', hostClientId: 'h', now: 1000 });
    expect(reg.size()).toBe(1);
  });
});

function mockTransport(): CompanionTransport & { sent: Array<{ type: string; data: Record<string, unknown> }> } {
  const sent: Array<{ type: string; data: Record<string, unknown> }> = [];
  return {
    sent,
    send(type, data) {
      sent.push({ type, data });
    },
  };
}

describe('CompanionSession', () => {
  it('companionSession_issuePairingCode_sendsRequestAndResolvesOnCode', async () => {
    const transport = mockTransport();
    const session = new CompanionSession({ transport, deviceType: 'desktop', clientId: 'host1' });

    const promise = session.issuePairingCode();
    expect(transport.sent).toEqual([
      { type: 'pairRequest', data: { clientId: 'host1', deviceType: 'desktop' } },
    ]);

    session.handleMessage('pairCode', { code: 'ABC234', expiresAt: 9999 });
    await expect(promise).resolves.toEqual({ code: 'ABC234', expiresAt: 9999 });
    expect(session.surface()).toBe('map-primary');
  });

  it('companionSession_attachAsCompanion_sendsUppercasedRedeem', () => {
    const transport = mockTransport();
    const session = new CompanionSession({ transport, deviceType: 'phone', clientId: 'phone1' });
    session.attachAsCompanion(' abc234 ');
    expect(transport.sent).toEqual([
      { type: 'pairRedeem', data: { code: 'ABC234', clientId: 'phone1', deviceType: 'phone' } },
    ]);
  });

  it('companionSession_pairedWithPeer_firesPeerAttached', () => {
    const transport = mockTransport();
    const session = new CompanionSession({ transport, deviceType: 'phone', clientId: 'phone1' });
    let attached = 0;
    session.on('peerAttached', () => attached++);

    session.handleMessage('paired', {
      surface: 'fpv-companion',
      peerClientId: 'host1',
      peerSurface: 'map-primary',
    });

    expect(attached).toBe(1);
    expect(session.surface()).toBe('fpv-companion');
    expect(session.peer()).toEqual({ clientId: 'host1', surface: 'map-primary' });
    expect(session.isPaired()).toBe(true);
  });

  it('companionSession_pairedWithoutPeer_firesPeerLost', () => {
    const transport = mockTransport();
    const session = new CompanionSession({ transport, deviceType: 'desktop', clientId: 'host1' });
    session.handleMessage('paired', {
      surface: 'map-primary',
      peerClientId: 'phone1',
      peerSurface: 'fpv-companion',
    });
    expect(session.isPaired()).toBe(true);

    let lost = 0;
    session.on('peerLost', () => lost++);
    session.handleMessage('paired', { surface: 'map-primary' }); // peer gone
    expect(lost).toBe(1);
    expect(session.peer()).toBeNull();
    expect(session.isPaired()).toBe(false);
  });

  it('companionSession_unpair_notifiesServerAndClears', () => {
    const transport = mockTransport();
    const session = new CompanionSession({ transport, deviceType: 'desktop', clientId: 'host1' });
    session.handleMessage('paired', {
      surface: 'map-primary',
      peerClientId: 'phone1',
      peerSurface: 'fpv-companion',
    });
    expect(session.isPaired()).toBe(true);

    session.unpair();
    expect(transport.sent).toContainEqual({ type: 'pairUnlink', data: { clientId: 'host1' } });
    expect(session.isPaired()).toBe(false);
    expect(session.surface()).toBeNull();
  });

  it('companionSession_reAttachAfterLoss_restoresPeer', () => {
    // Pairing survives a reconnect: after a loss, a fresh `paired` re-establishes it.
    const transport = mockTransport();
    const session = new CompanionSession({ transport, deviceType: 'desktop', clientId: 'host1' });
    session.handleMessage('paired', { surface: 'map-primary', peerClientId: 'phone1', peerSurface: 'fpv-companion' });
    session.handleMessage('paired', { surface: 'map-primary' }); // lost
    expect(session.isPaired()).toBe(false);

    let attached = 0;
    session.on('peerAttached', () => attached++);
    session.handleMessage('paired', { surface: 'map-primary', peerClientId: 'phone1', peerSurface: 'fpv-companion' });
    expect(attached).toBe(1);
    expect(session.peer()).toEqual({ clientId: 'phone1', surface: 'fpv-companion' });
  });
});
