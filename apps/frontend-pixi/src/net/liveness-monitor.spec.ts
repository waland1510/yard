import { LivenessMonitor } from './liveness-monitor';

describe('LivenessMonitor', () => {
  it('livenessMonitor_neverSeen_isNotAlive', () => {
    const m = new LivenessMonitor({ timeoutMs: 1000 });
    expect(m.isAlive(0)).toBe(false);
    expect(m.sinceLastSeen(500)).toBe(Infinity);
  });

  it('livenessMonitor_withinTimeout_isAlive', () => {
    const m = new LivenessMonitor({ timeoutMs: 1000 });
    m.markSeen(0);
    expect(m.isAlive(999)).toBe(true);
    expect(m.sinceLastSeen(400)).toBe(400);
  });

  it('livenessMonitor_pastTimeout_isNotAlive', () => {
    const m = new LivenessMonitor({ timeoutMs: 1000 });
    m.markSeen(0);
    // Boundary is exclusive: exactly timeoutMs later counts as dropped.
    expect(m.isAlive(1000)).toBe(false);
    expect(m.isAlive(5000)).toBe(false);
  });

  it('livenessMonitor_reSeen_revivesPeer', () => {
    const m = new LivenessMonitor({ timeoutMs: 1000 });
    m.markSeen(0);
    expect(m.isAlive(1500)).toBe(false);
    m.markSeen(1500); // peer reconnected / pong arrived
    expect(m.isAlive(2000)).toBe(true);
  });

  it('livenessMonitor_reset_forgetsPeer', () => {
    const m = new LivenessMonitor({ timeoutMs: 1000 });
    m.markSeen(0);
    m.reset();
    expect(m.isAlive(10)).toBe(false);
    expect(m.sinceLastSeen(10)).toBe(Infinity);
  });
});
