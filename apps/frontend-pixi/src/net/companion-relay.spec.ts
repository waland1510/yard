import { CompanionRelay, type RelayTransport, type RelayKind } from './companion-relay';

function mockTransport(): RelayTransport & {
  sent: Array<{ kind: RelayKind; payload: unknown }>;
} {
  const sent: Array<{ kind: RelayKind; payload: unknown }> = [];
  return {
    sent,
    send(_type, data) {
      sent.push(data);
    },
  };
}

describe('CompanionRelay', () => {
  it('companionRelay_sendWhilePaired_forwardsEnvelope', () => {
    const transport = mockTransport();
    const relay = new CompanionRelay({ transport, isPaired: () => true });

    const ok = relay.send('pendingMove', {
      targetNodeId: 42,
      transport: 'taxi',
      secret: false,
      double: false,
    });

    expect(ok).toBe(true);
    expect(transport.sent).toEqual([
      { kind: 'pendingMove', payload: { targetNodeId: 42, transport: 'taxi', secret: false, double: false } },
    ]);
  });

  it('companionRelay_sendWhileUnpaired_isNoOp', () => {
    const transport = mockTransport();
    const relay = new CompanionRelay({ transport, isPaired: () => false });

    const ok = relay.send('viewingAs', 'detective2');

    expect(ok).toBe(false);
    expect(transport.sent).toHaveLength(0);
  });

  it('companionRelay_handleMessage_dispatchesToKindHandler', () => {
    const relay = new CompanionRelay({ transport: mockTransport(), isPaired: () => true });
    const seenViewingAs: Array<string | null> = [];
    const seenCamera: Array<{ nodeId: number }> = [];
    relay.on('viewingAs', (p) => seenViewingAs.push(p));
    relay.on('cameraHint', (p) => seenCamera.push(p));

    relay.handleMessage({ kind: 'viewingAs', payload: 'culprit' });
    relay.handleMessage({ kind: 'cameraHint', payload: { nodeId: 7 } });

    expect(seenViewingAs).toEqual(['culprit']);
    expect(seenCamera).toEqual([{ nodeId: 7 }]);
  });

  it('companionRelay_unsubscribe_stopsDelivery', () => {
    const relay = new CompanionRelay({ transport: mockTransport(), isPaired: () => true });
    let count = 0;
    const off = relay.on('pendingMove', () => count++);
    relay.handleMessage({ kind: 'pendingMove', payload: null });
    off();
    relay.handleMessage({ kind: 'pendingMove', payload: null });
    expect(count).toBe(1);
  });

  it('companionRelay_roundTrip_betweenTwoPairedDevices', () => {
    // Phone relays its pending move; the desktop receives it via the shared "channel".
    const phoneTx = mockTransport();
    const phone = new CompanionRelay({ transport: phoneTx, isPaired: () => true });
    const desktop = new CompanionRelay({ transport: mockTransport(), isPaired: () => true });

    const received: unknown[] = [];
    desktop.on('pendingMove', (p) => received.push(p));

    phone.send('pendingMove', { targetNodeId: 13, transport: 'bus', secret: false, double: false });
    // Simulate the server forwarding the phone's envelope to the desktop.
    desktop.handleMessage(phoneTx.sent[0]);

    expect(received).toEqual([
      { targetNodeId: 13, transport: 'bus', secret: false, double: false },
    ]);
  });
});
