// Full-mesh WebRTC group call: one RTCPeerConnection per remote participant, with the
// server relaying `callSignal` envelopes untouched. Membership comes from presence
// (`inCall` flags), so a peer is opened or closed whenever the roster changes.
//
// The lower clientId of each pair always sends the offer and creates both transceivers.
// That rules out offer glare, and lets mic/camera toggles be `replaceTrack` calls that
// never renegotiate.

import type { CallSignal, PresenceMember } from '@yard/shared-utils';

const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 640 },
  height: { ideal: 480 },
  frameRate: { ideal: 24, max: 24 },
};

export interface CallState {
  inCall: boolean;
  mic: boolean;
  cam: boolean;
}

export interface CallTransport {
  sendState(state: CallState): void;
  sendSignal(to: string, signal: CallSignal): void;
}

export interface CallPeer {
  clientId: string;
  role: string;
  username: string;
  mic: boolean;
  cam: boolean;
  stream: MediaStream | null;
  connection: RTCPeerConnectionState;
}

export interface CallSnapshot {
  joined: boolean;
  joining: boolean;
  mic: boolean;
  cam: boolean;
  localStream: MediaStream | null;
  peers: CallPeer[];
  othersInCall: number;
  error: string | null;
}

export interface CallMeshOptions {
  selfId: string;
  transport: CallTransport;
  iceServers?: RTCIceServer[];
  createPeer?: (config: RTCConfiguration) => RTCPeerConnection;
  createStream?: (tracks: MediaStreamTrack[]) => MediaStream;
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
}

type Kind = 'audio' | 'video';
type RosterMember = PresenceMember & { clientId: string };

interface PeerEntry {
  member: RosterMember;
  pc: RTCPeerConnection;
  stream: MediaStream | null;
  pendingCandidates: RTCIceCandidateInit[];
  queue: Promise<void>;
}

export class CallMesh {
  private readonly selfId: string;
  private readonly transport: CallTransport;
  private readonly iceServers: RTCIceServer[];
  private readonly createPeer: (config: RTCConfiguration) => RTCPeerConnection;
  private readonly createStream: (tracks: MediaStreamTrack[]) => MediaStream;
  private readonly getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  private readonly peers = new Map<string, PeerEntry>();
  private readonly listeners = new Set<(snapshot: CallSnapshot) => void>();
  private roster: PresenceMember[] = [];
  private local: MediaStream | null = null;
  private joined = false;
  private joining = false;
  private mic = false;
  private cam = false;
  private error: string | null = null;

  constructor({
    selfId,
    transport,
    iceServers = [],
    createPeer = (config) => new RTCPeerConnection(config),
    createStream = (tracks) => new MediaStream(tracks),
    getUserMedia = defaultGetUserMedia,
  }: CallMeshOptions) {
    this.selfId = selfId;
    this.transport = transport;
    this.iceServers = iceServers;
    this.createPeer = createPeer;
    this.createStream = createStream;
    this.getUserMedia = getUserMedia;
  }

  snapshot(): CallSnapshot {
    return {
      joined: this.joined,
      joining: this.joining,
      mic: this.mic,
      cam: this.cam,
      localStream: this.local,
      peers: [...this.peers.values()].map(({ member, pc, stream }) => ({
        clientId: member.clientId,
        role: member.role,
        username: member.username,
        mic: !!member.mic,
        cam: !!member.cam,
        stream,
        connection: pc.connectionState,
      })),
      othersInCall: this.roster.filter((m) => m.inCall && m.clientId !== this.selfId).length,
      error: this.error,
    };
  }

  subscribe(listener: (snapshot: CallSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async join(): Promise<void> {
    if (this.joined || this.joining) return;
    this.joining = true;
    this.error = null;
    this.emit();
    const stream = await this.acquireMedia();
    if (!this.joining) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    this.local = stream;
    this.mic = stream.getAudioTracks().length > 0;
    this.cam = stream.getVideoTracks().length > 0;
    this.joining = false;
    this.joined = true;
    this.announce();
    this.reconcile();
    this.emit();
  }

  leave(): void {
    if (!this.joined && !this.joining) return;
    this.joined = false;
    this.joining = false;
    for (const id of [...this.peers.keys()]) this.closePeer(id);
    this.local?.getTracks().forEach((t) => t.stop());
    this.local = null;
    this.mic = false;
    this.cam = false;
    this.announce();
    this.emit();
  }

  async setMic(on: boolean): Promise<void> {
    if (!this.joined) return;
    const track = this.localTrack('audio') ?? (on ? await this.acquireTrack('audio') : null);
    if (track) track.enabled = on;
    this.mic = on && !!track;
    this.announce();
    this.emit();
  }

  async setCam(on: boolean): Promise<void> {
    if (!this.joined || !this.local) return;
    if (on) {
      this.cam = !!(this.localTrack('video') ?? (await this.acquireTrack('video')));
    } else {
      for (const t of this.local.getVideoTracks()) {
        t.stop();
        this.local.removeTrack(t);
      }
      this.setSenderTrack('video', null);
      this.cam = false;
    }
    this.announce();
    this.emit();
  }

  syncRoster(members: PresenceMember[]): void {
    this.roster = members;
    const self = members.find((m) => m.clientId === this.selfId);
    // After a socket reconnect the server re-creates our presence entry without call flags.
    if (self && !this.joining && !!self.inCall !== this.joined) this.announce();
    this.reconcile();
    this.emit();
  }

  handleSignal(from: string, signal: CallSignal): void {
    if (!this.joined) return;
    let entry = this.peers.get(from);
    if (!entry) {
      if (signal.description?.type !== 'offer') return;
      const known = this.roster.find((m): m is RosterMember => m.clientId === from);
      entry = this.openPeer(known ?? { clientId: from, role: '', username: '' });
    }
    const target = entry;
    this.enqueue(target, async () => {
      try {
        await this.applySignal(target, signal);
      } catch (e) {
        // A fresh offer against a connection the remote already discarded fails to apply;
        // rebuild ours and take the offer again.
        if (signal.description?.type !== 'offer' || this.peers.get(from) !== target) throw e;
        this.closePeer(from);
        await this.applySignal(this.openPeer(target.member), signal);
      }
    });
  }

  dispose(): void {
    this.leave();
    this.listeners.clear();
  }

  private isOfferer(remoteId: string): boolean {
    return this.selfId < remoteId;
  }

  private announce(): void {
    this.transport.sendState({ inCall: this.joined, mic: this.mic, cam: this.cam });
  }

  private emit(): void {
    const snapshot = this.snapshot();
    for (const listener of this.listeners) listener(snapshot);
  }

  private async acquireMedia(): Promise<MediaStream> {
    const full = await this.getUserMedia({ audio: true, video: VIDEO_CONSTRAINTS }).catch(() => null);
    if (full) return full;
    const audio = await this.getUserMedia({ audio: true }).catch(() => null);
    if (audio) {
      this.error = 'Camera unavailable, joined with audio only';
      return audio;
    }
    this.error =
      typeof window !== 'undefined' && window.isSecureContext === false
        ? 'Camera and mic need HTTPS or localhost'
        : 'Camera and mic unavailable, you can still watch and listen';
    return this.createStream([]);
  }

  private async acquireTrack(kind: Kind): Promise<MediaStreamTrack | null> {
    const constraints = kind === 'video' ? { video: VIDEO_CONSTRAINTS } : { audio: true };
    const stream = await this.getUserMedia(constraints).catch(() => null);
    const track = stream?.getTracks()[0] ?? null;
    if (!track) {
      this.error = kind === 'video' ? 'Camera unavailable' : 'Microphone unavailable';
      return null;
    }
    if (!this.joined || !this.local) {
      track.stop();
      return null;
    }
    this.error = null;
    this.local.addTrack(track);
    this.setSenderTrack(kind, track);
    return track;
  }

  private localTrack(kind: Kind): MediaStreamTrack | null {
    if (!this.local) return null;
    const tracks = kind === 'audio' ? this.local.getAudioTracks() : this.local.getVideoTracks();
    return tracks[0] ?? null;
  }

  private setSenderTrack(kind: Kind, track: MediaStreamTrack | null): void {
    for (const { pc } of this.peers.values()) {
      const transceiver = pc.getTransceivers().find((t) => t.receiver.track.kind === kind);
      transceiver?.sender.replaceTrack(track).catch(() => undefined);
    }
  }

  private reconcile(): void {
    if (!this.joined) return;
    const wanted = new Map<string, RosterMember>();
    for (const m of this.roster) {
      if (m.inCall && m.clientId && m.clientId !== this.selfId) {
        wanted.set(m.clientId, m as RosterMember);
      }
    }
    for (const id of [...this.peers.keys()]) {
      if (!wanted.has(id)) this.closePeer(id);
    }
    for (const member of wanted.values()) {
      const entry = this.peers.get(member.clientId);
      if (entry) entry.member = member;
      else this.openPeer(member);
    }
  }

  private openPeer(member: RosterMember): PeerEntry {
    const id = member.clientId;
    const pc = this.createPeer({ iceServers: this.iceServers });
    const entry: PeerEntry = {
      member,
      pc,
      stream: null,
      pendingCandidates: [],
      queue: Promise.resolve(),
    };
    this.peers.set(id, entry);

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) this.transport.sendSignal(id, { candidate: candidate.toJSON() });
    };
    pc.ontrack = ({ track }) => {
      entry.stream = this.createStream([...(entry.stream?.getTracks() ?? []), track]);
      this.emit();
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' && this.isOfferer(id)) pc.restartIce();
      this.emit();
    };

    if (this.isOfferer(id)) {
      pc.onnegotiationneeded = () => this.enqueue(entry, () => this.sendOffer(entry));
      pc.addTransceiver(this.localTrack('audio') ?? 'audio', { direction: 'sendrecv' });
      pc.addTransceiver(this.localTrack('video') ?? 'video', { direction: 'sendrecv' });
    }
    return entry;
  }

  private closePeer(id: string): void {
    const entry = this.peers.get(id);
    if (!entry) return;
    this.peers.delete(id);
    const { pc } = entry;
    pc.onicecandidate = null;
    pc.ontrack = null;
    pc.onconnectionstatechange = null;
    pc.onnegotiationneeded = null;
    pc.close();
  }

  private enqueue(entry: PeerEntry, task: () => Promise<void>): void {
    entry.queue = entry.queue.then(task).catch(() => undefined);
  }

  private async sendOffer(entry: PeerEntry): Promise<void> {
    if (this.peers.get(entry.member.clientId) !== entry) return;
    await entry.pc.setLocalDescription();
    this.sendDescription(entry);
  }

  private sendDescription({ pc, member }: PeerEntry): void {
    const description = pc.localDescription;
    if (!description) return;
    this.transport.sendSignal(member.clientId, {
      description: { type: description.type, sdp: description.sdp },
    });
  }

  private async applySignal(entry: PeerEntry, { description, candidate }: CallSignal): Promise<void> {
    const { pc } = entry;
    if (candidate) {
      if (pc.remoteDescription) await pc.addIceCandidate(candidate).catch(() => undefined);
      else entry.pendingCandidates.push(candidate);
      return;
    }
    if (!description) return;
    if (description.type === 'offer' && this.isOfferer(entry.member.clientId)) return;

    await pc.setRemoteDescription(description);
    for (const c of entry.pendingCandidates.splice(0)) {
      await pc.addIceCandidate(c).catch(() => undefined);
    }
    if (description.type !== 'offer') return;

    for (const transceiver of pc.getTransceivers()) {
      transceiver.direction = 'sendrecv';
      await transceiver.sender.replaceTrack(this.localTrack(transceiver.receiver.track.kind as Kind));
    }
    await pc.setLocalDescription();
    this.sendDescription(entry);
  }
}

function defaultGetUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return Promise.reject(new Error('getUserMedia unavailable'));
  }
  return navigator.mediaDevices.getUserMedia(constraints);
}
