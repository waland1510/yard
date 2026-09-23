import type { CallSignal, PresenceMember } from '@yard/shared-utils';
import { CallMesh, type CallState } from './call-mesh';

type Kind = 'audio' | 'video';

class FakeTrack {
  enabled = true;
  stop = jest.fn();
  constructor(readonly kind: Kind) {}
}

class FakeStream {
  private tracks: FakeTrack[];
  constructor(tracks: FakeTrack[] = []) {
    this.tracks = [...tracks];
  }
  getTracks() {
    return [...this.tracks];
  }
  getAudioTracks() {
    return this.tracks.filter((t) => t.kind === 'audio');
  }
  getVideoTracks() {
    return this.tracks.filter((t) => t.kind === 'video');
  }
  addTrack(t: FakeTrack) {
    this.tracks.push(t);
  }
  removeTrack(t: FakeTrack) {
    this.tracks = this.tracks.filter((x) => x !== t);
  }
}

class FakeTransceiver {
  direction: RTCRtpTransceiverDirection = 'recvonly';
  readonly receiver: { track: FakeTrack };
  readonly sender: { track: FakeTrack | null; replaceTrack: jest.Mock };
  constructor(kind: Kind, track: FakeTrack | null) {
    this.receiver = { track: new FakeTrack(kind) };
    this.sender = {
      track,
      replaceTrack: jest.fn(async (t: FakeTrack | null) => {
        this.sender.track = t;
      }),
    };
  }
}

class FakePeer {
  connectionState: RTCPeerConnectionState = 'new';
  localDescription: RTCSessionDescriptionInit | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;
  transceivers: FakeTransceiver[] = [];
  addIceCandidate = jest.fn(async () => undefined);
  restartIce = jest.fn();
  close = jest.fn();
  onicecandidate: ((ev: { candidate: { toJSON(): RTCIceCandidateInit } | null }) => void) | null = null;
  ontrack: ((ev: { track: FakeTrack }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  onnegotiationneeded: (() => void) | null = null;
  private negotiationScheduled = false;

  getTransceivers() {
    return this.transceivers;
  }
  addTransceiver(trackOrKind: FakeTrack | Kind) {
    const t =
      typeof trackOrKind === 'string'
        ? new FakeTransceiver(trackOrKind, null)
        : new FakeTransceiver(trackOrKind.kind, trackOrKind);
    t.direction = 'sendrecv';
    this.transceivers.push(t);
    if (!this.negotiationScheduled) {
      this.negotiationScheduled = true;
      queueMicrotask(() => {
        this.negotiationScheduled = false;
        this.onnegotiationneeded?.();
      });
    }
    return t;
  }
  async setLocalDescription() {
    const type = this.remoteDescription?.type === 'offer' ? 'answer' : 'offer';
    this.localDescription = { type, sdp: `sdp-${type}` };
  }
  async setRemoteDescription(d: RTCSessionDescriptionInit) {
    this.remoteDescription = d;
    if (d.type === 'offer' && this.transceivers.length === 0) {
      this.transceivers.push(new FakeTransceiver('audio', null), new FakeTransceiver('video', null));
    }
  }
}

interface Harness {
  mesh: CallMesh;
  peers: FakePeer[];
  states: CallState[];
  signals: Array<{ to: string; signal: CallSignal }>;
  media: FakeStream[];
  getUserMedia: jest.Mock;
}

function harness(selfId: string, gum?: (c: MediaStreamConstraints) => Promise<FakeStream>): Harness {
  const peers: FakePeer[] = [];
  const states: CallState[] = [];
  const signals: Array<{ to: string; signal: CallSignal }> = [];
  const media: FakeStream[] = [];
  const getUserMedia = jest.fn(
    gum ??
      (async (c: MediaStreamConstraints) => {
        const tracks: FakeTrack[] = [];
        if (c.audio) tracks.push(new FakeTrack('audio'));
        if (c.video) tracks.push(new FakeTrack('video'));
        const s = new FakeStream(tracks);
        media.push(s);
        return s;
      })
  );
  const mesh = new CallMesh({
    selfId,
    transport: {
      sendState: (s) => states.push(s),
      sendSignal: (to, signal) => signals.push({ to, signal }),
    },
    createPeer: () => {
      const p = new FakePeer();
      peers.push(p);
      return p as unknown as RTCPeerConnection;
    },
    createStream: (tracks) => new FakeStream(tracks as unknown as FakeTrack[]) as unknown as MediaStream,
    getUserMedia: getUserMedia as unknown as (c: MediaStreamConstraints) => Promise<MediaStream>,
  });
  return { mesh, peers, states, signals, media, getUserMedia };
}

function member(clientId: string, extra: Partial<PresenceMember> = {}): PresenceMember {
  return { clientId, role: 'detective1', username: clientId, ...extra };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('CallMesh', () => {
  it('callMesh_join_acquiresMediaAndAnnouncesInCall', async () => {
    const h = harness('a');

    await h.mesh.join();

    expect(h.states).toEqual([{ inCall: true, mic: true, cam: true }]);
    expect(h.mesh.snapshot()).toMatchObject({ joined: true, mic: true, cam: true, error: null });
  });

  it('callMesh_joinWithCameraDenied_fallsBackToAudioOnly', async () => {
    const h = harness('a', async (c) => {
      if (c.video) throw new Error('denied');
      return new FakeStream([new FakeTrack('audio')]);
    });

    await h.mesh.join();

    expect(h.states).toEqual([{ inCall: true, mic: true, cam: false }]);
    expect(h.mesh.snapshot().error).toMatch(/audio only/);
  });

  it('callMesh_joinWithAllMediaDenied_joinsWithoutTracks', async () => {
    const h = harness('a', async () => {
      throw new Error('denied');
    });

    await h.mesh.join();

    expect(h.states).toEqual([{ inCall: true, mic: false, cam: false }]);
    expect(h.mesh.snapshot().joined).toBe(true);
  });

  it('callMesh_rosterWithHigherIdPeer_sendsOfferWithLocalTracks', async () => {
    const h = harness('a');
    await h.mesh.join();

    h.mesh.syncRoster([member('a', { inCall: true }), member('b', { inCall: true })]);
    await flush();

    expect(h.peers).toHaveLength(1);
    expect(h.peers[0].transceivers.map((t) => t.sender.track?.kind)).toEqual(['audio', 'video']);
    expect(h.signals).toEqual([{ to: 'b', signal: { description: { type: 'offer', sdp: 'sdp-offer' } } }]);
  });

  it('callMesh_rosterWithLowerIdPeer_waitsForTheirOffer', async () => {
    const h = harness('b');
    await h.mesh.join();

    h.mesh.syncRoster([member('a', { inCall: true }), member('b', { inCall: true })]);
    await flush();

    expect(h.peers).toHaveLength(1);
    expect(h.peers[0].transceivers).toHaveLength(0);
    expect(h.signals).toEqual([]);
  });

  it('callMesh_rosterBeforeJoin_opensNoPeers', () => {
    const h = harness('a');

    h.mesh.syncRoster([member('b', { inCall: true })]);

    expect(h.peers).toHaveLength(0);
    expect(h.mesh.snapshot().othersInCall).toBe(1);
  });

  it('callMesh_receivesOffer_answersWithLocalTracksAttached', async () => {
    const h = harness('b');
    await h.mesh.join();
    h.mesh.syncRoster([member('a', { inCall: true }), member('b', { inCall: true })]);

    h.mesh.handleSignal('a', { description: { type: 'offer', sdp: 'remote-offer' } });
    await flush();

    const [pc] = h.peers;
    expect(pc.remoteDescription).toEqual({ type: 'offer', sdp: 'remote-offer' });
    expect(pc.transceivers.map((t) => [t.direction, t.sender.track?.kind])).toEqual([
      ['sendrecv', 'audio'],
      ['sendrecv', 'video'],
    ]);
    expect(h.signals).toEqual([{ to: 'a', signal: { description: { type: 'answer', sdp: 'sdp-answer' } } }]);
  });

  it('callMesh_candidateBeforeOffer_isAppliedAfterRemoteDescription', async () => {
    const h = harness('b');
    await h.mesh.join();
    h.mesh.syncRoster([member('a', { inCall: true }), member('b', { inCall: true })]);

    h.mesh.handleSignal('a', { candidate: { candidate: 'c1' } });
    await flush();
    expect(h.peers[0].addIceCandidate).not.toHaveBeenCalled();

    h.mesh.handleSignal('a', { description: { type: 'offer', sdp: 'o' } });
    await flush();
    expect(h.peers[0].addIceCandidate).toHaveBeenCalledWith({ candidate: 'c1' });
  });

  it('callMesh_offerFromUnknownPeer_opensPeerAndAnswers', async () => {
    const h = harness('b');
    await h.mesh.join();

    h.mesh.handleSignal('a', { description: { type: 'offer', sdp: 'o' } });
    await flush();

    expect(h.peers).toHaveLength(1);
    expect(h.signals.map((s) => s.signal.description?.type)).toEqual(['answer']);
  });

  it('callMesh_peerLeavesCall_closesTheirConnection', async () => {
    const h = harness('a');
    await h.mesh.join();
    h.mesh.syncRoster([member('a', { inCall: true }), member('b', { inCall: true })]);

    h.mesh.syncRoster([member('a', { inCall: true }), member('b', { inCall: false })]);

    expect(h.peers[0].close).toHaveBeenCalled();
    expect(h.mesh.snapshot().peers).toEqual([]);
  });

  it('callMesh_selfListedWithoutCallFlag_reannouncesState', async () => {
    const h = harness('a');
    await h.mesh.join();

    h.mesh.syncRoster([member('a')]);

    expect(h.states).toEqual([
      { inCall: true, mic: true, cam: true },
      { inCall: true, mic: true, cam: true },
    ]);
  });

  it('callMesh_camOff_stopsTrackAndClearsSenders', async () => {
    const h = harness('a');
    await h.mesh.join();
    h.mesh.syncRoster([member('a', { inCall: true }), member('b', { inCall: true })]);
    const video = h.media[0].getVideoTracks()[0];

    await h.mesh.setCam(false);

    expect(video.stop).toHaveBeenCalled();
    expect(h.peers[0].transceivers[1].sender.replaceTrack).toHaveBeenCalledWith(null);
    expect(h.states.at(-1)).toEqual({ inCall: true, mic: true, cam: false });
  });

  it('callMesh_camBackOn_sendsNewTrackToPeers', async () => {
    const h = harness('a');
    await h.mesh.join();
    h.mesh.syncRoster([member('a', { inCall: true }), member('b', { inCall: true })]);
    await h.mesh.setCam(false);

    await h.mesh.setCam(true);

    const replaced = h.peers[0].transceivers[1].sender.track;
    expect(replaced?.kind).toBe('video');
    expect(h.mesh.snapshot().cam).toBe(true);
  });

  it('callMesh_micOff_disablesTrackWithoutRenegotiating', async () => {
    const h = harness('a');
    await h.mesh.join();

    await h.mesh.setMic(false);

    expect(h.media[0].getAudioTracks()[0].enabled).toBe(false);
    expect(h.states.at(-1)).toEqual({ inCall: true, mic: false, cam: true });
  });

  it('callMesh_remoteTrack_exposesStreamOnPeer', async () => {
    const h = harness('a');
    await h.mesh.join();
    h.mesh.syncRoster([member('a', { inCall: true }), member('b', { inCall: true, cam: true })]);

    h.peers[0].ontrack?.({ track: new FakeTrack('video') });

    const [peer] = h.mesh.snapshot().peers;
    expect(peer.cam).toBe(true);
    expect(peer.stream?.getTracks()).toHaveLength(1);
  });

  it('callMesh_connectionFailedAsOfferer_restartsIce', async () => {
    const h = harness('a');
    await h.mesh.join();
    h.mesh.syncRoster([member('a', { inCall: true }), member('b', { inCall: true })]);

    h.peers[0].connectionState = 'failed';
    h.peers[0].onconnectionstatechange?.();

    expect(h.peers[0].restartIce).toHaveBeenCalled();
  });

  it('callMesh_leave_closesPeersStopsTracksAndAnnounces', async () => {
    const h = harness('a');
    await h.mesh.join();
    h.mesh.syncRoster([member('a', { inCall: true }), member('b', { inCall: true })]);

    h.mesh.leave();

    expect(h.peers[0].close).toHaveBeenCalled();
    expect(h.media[0].getTracks().every((t) => t.stop.mock.calls.length === 1)).toBe(true);
    expect(h.states.at(-1)).toEqual({ inCall: false, mic: false, cam: false });
  });

  it('callMesh_leaveWhileAcquiringMedia_releasesTheMedia', async () => {
    let resolve: (s: FakeStream) => void = () => undefined;
    const pending = new FakeStream([new FakeTrack('audio')]);
    const h = harness('a', () => new Promise((r) => (resolve = r)));

    const joining = h.mesh.join();
    h.mesh.leave();
    resolve(pending);
    await joining;

    expect(pending.getTracks()[0].stop).toHaveBeenCalled();
    expect(h.mesh.snapshot().joined).toBe(false);
  });
});
