// Group call, side-strip layout: a column of face tiles down the free part of the right
// edge, collapsible to avatars. Remote audio plays through CallAudio regardless of layout,
// so every <video> here stays muted.

import { useEffect, useRef } from 'react';
import {
  LOCAL_TILE_ID,
  selectCallAvailable,
  selectCallCam,
  selectCallCollapsed,
  selectCallError,
  selectCallJoined,
  selectCallJoining,
  selectCallMic,
  selectCallPeers,
  selectLocalStream,
  selectOthersInCall,
  selectSpeaking,
  useCallStore,
} from '../stores/call-store';
import { useRunnerStore } from '../stores/runner-store';
import {
  COLOR,
  FONT,
  PLAYER_COLOR,
  RADIUS,
  SCREEN_MARGIN,
  SHADOW,
  iconSquare,
  pillCompact,
} from './tokens';

interface Tile {
  id: string;
  name: string;
  role: string;
  stream: MediaStream | null;
  mic: boolean;
  cam: boolean;
  isLocal: boolean;
  connecting: boolean;
}

const selectPairingRole = (s: ReturnType<typeof useRunnerStore.getState>) => s.pairingRole;
const selectMyRole = (s: ReturnType<typeof useRunnerStore.getState>) => s.myRole;
const selectMyName = (s: ReturnType<typeof useRunnerStore.getState>) => s.myName;

export function CallStrip() {
  const available = useCallStore(selectCallAvailable);
  const joined = useCallStore(selectCallJoined);
  const collapsed = useCallStore(selectCallCollapsed);
  const pairingRole = useRunnerStore(selectPairingRole);

  if (!available || pairingRole === 'controller') return null;
  return (
    <>
      <CallAudio />
      {!joined ? <JoinButton /> : collapsed ? <CollapsedStrip /> : <ExpandedStrip />}
    </>
  );
}

function useTiles(): Tile[] {
  const peers = useCallStore(selectCallPeers);
  const localStream = useCallStore(selectLocalStream);
  const mic = useCallStore(selectCallMic);
  const cam = useCallStore(selectCallCam);
  const myRole = useRunnerStore(selectMyRole);
  const myName = useRunnerStore(selectMyName);
  return [
    {
      id: LOCAL_TILE_ID,
      name: myName || 'You',
      role: myRole ?? '',
      stream: localStream,
      mic,
      cam,
      isLocal: true,
      connecting: false,
    },
    ...peers.map((p) => ({
      id: p.clientId,
      name: p.username,
      role: p.role,
      stream: p.stream,
      mic: p.mic,
      cam: p.cam,
      isLocal: false,
      connecting: p.connection !== 'connected',
    })),
  ];
}

function JoinButton() {
  const joining = useCallStore(selectCallJoining);
  const othersInCall = useCallStore(selectOthersInCall);
  const error = useCallStore(selectCallError);
  const { join } = useCallStore.getState();
  return (
    <div style={joinWrap}>
      <button type="button" style={joinPill} onClick={join} disabled={joining}>
        <span aria-hidden>📹</span>
        {joining ? 'Joining…' : 'Join call'}
        {othersInCall > 0 && <span style={countBadge}>{othersInCall} in call</span>}
      </button>
      {error && <div style={errorText}>{error}</div>}
    </div>
  );
}

function ExpandedStrip() {
  const tiles = useTiles();
  const speaking = useCallStore(selectSpeaking);
  const error = useCallStore(selectCallError);
  return (
    <div style={strip} aria-label="Call participants">
      <div style={tileList}>
        {tiles.map((t) => (
          <VideoTile key={t.id} tile={t} speaking={!!speaking[t.id]} />
        ))}
      </div>
      {error && <div style={errorText}>{error}</div>}
      <CallControls />
    </div>
  );
}

function CollapsedStrip() {
  const tiles = useTiles();
  const speaking = useCallStore(selectSpeaking);
  const mic = useCallStore(selectCallMic);
  const { toggleMic, setCollapsed } = useCallStore.getState();
  return (
    <div style={{ ...strip, width: 'auto', alignItems: 'center' }} aria-label="Call participants">
      {tiles.map((t) => (
        <Avatar key={t.id} tile={t} speaking={!!speaking[t.id]} size={40} />
      ))}
      <button
        type="button"
        style={controlButton}
        onClick={toggleMic}
        aria-label={mic ? 'Mute microphone' : 'Unmute microphone'}
      >
        {mic ? '🎤' : '🔇'}
      </button>
      <button type="button" style={controlButton} onClick={() => setCollapsed(false)} aria-label="Show call">
        ◂
      </button>
    </div>
  );
}

function CallControls() {
  const mic = useCallStore(selectCallMic);
  const cam = useCallStore(selectCallCam);
  const { toggleMic, toggleCam, leave, setCollapsed } = useCallStore.getState();
  return (
    <div style={controls}>
      <button
        type="button"
        style={{ ...controlButton, background: mic ? COLOR.pill : COLOR.red }}
        onClick={toggleMic}
        aria-label={mic ? 'Mute microphone' : 'Unmute microphone'}
      >
        {mic ? '🎤' : '🔇'}
      </button>
      <button
        type="button"
        style={{ ...controlButton, background: cam ? COLOR.pill : COLOR.red }}
        onClick={toggleCam}
        aria-label={cam ? 'Turn camera off' : 'Turn camera on'}
      >
        {cam ? '📷' : '🚫'}
      </button>
      <button type="button" style={controlButton} onClick={() => setCollapsed(true)} aria-label="Collapse call">
        ▸
      </button>
      <button
        type="button"
        style={{ ...controlButton, background: COLOR.red }}
        onClick={leave}
        aria-label="Leave call"
      >
        ✕
      </button>
    </div>
  );
}

function VideoTile({ tile, speaking }: { tile: Tile; speaking: boolean }) {
  const { name, role, stream, mic, cam, isLocal, connecting } = tile;
  const showVideo = cam && !!stream;
  return (
    <div
      style={{
        ...tileBox,
        boxShadow: speaking ? `0 0 0 2px ${COLOR.greenTint}` : `0 0 0 1px ${COLOR.hairline}`,
      }}
    >
      {showVideo ? (
        <StreamVideo stream={stream} mirrored={isLocal} />
      ) : (
        <div style={tileAvatar}>
          <Avatar tile={tile} speaking={false} size={44} />
        </div>
      )}
      <div style={nameBar}>
        <span style={{ ...roleDot, background: PLAYER_COLOR[role] ?? COLOR.fg2 }} />
        <span style={nameText}>
          {isLocal ? 'You' : name || roleLabel(role)}
          {roleLabel(role) && <span style={roleText}> · {roleLabel(role)}</span>}
        </span>
        {!mic && <span aria-label="Muted">🔇</span>}
      </div>
      {connecting && <div style={connectingBadge}>connecting…</div>}
    </div>
  );
}

function Avatar({ tile, speaking, size }: { tile: Tile; speaking: boolean; size: number }) {
  return (
    <div
      title={tile.isLocal ? 'You' : tile.name}
      style={{
        width: size,
        height: size,
        borderRadius: RADIUS.pill,
        background: PLAYER_COLOR[tile.role] ?? COLOR.avatarBg,
        color: '#fff',
        font: `700 ${Math.round(size * 0.36)}px ${FONT.ui}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 'none',
        opacity: tile.connecting ? 0.5 : 1,
        boxShadow: speaking ? `0 0 0 3px ${COLOR.greenTint}` : 'none',
      }}
    >
      {initials(tile.isLocal ? tile.name : tile.name || roleLabel(tile.role))}
    </div>
  );
}

function StreamVideo({ stream, mirrored }: { stream: MediaStream; mirrored: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      style={{ ...videoFill, transform: mirrored ? 'scaleX(-1)' : undefined }}
    />
  );
}

function CallAudio() {
  const peers = useCallStore(selectCallPeers);
  return (
    <>
      {peers.map((p) => (p.stream ? <PeerAudio key={p.clientId} stream={p.stream} /> : null))}
    </>
  );
}

function PeerAudio({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [stream]);
  return <audio ref={ref} autoPlay />;
}

function roleLabel(role: string): string {
  if (role === 'culprit') return 'Mr. X';
  if (role.startsWith('detective')) return `Det ${role.slice('detective'.length)}`;
  return '';
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

const STRIP_WIDTH = 188;
// Clears the map's top-right button column above and its transport legend below.
const STRIP_TOP = 156;
const STRIP_BOTTOM_CLEARANCE = 228;

const anchor: React.CSSProperties = {
  position: 'fixed',
  right: SCREEN_MARGIN,
  top: STRIP_TOP,
  zIndex: 20,
  fontFamily: FONT.ui,
  color: COLOR.fg,
};

const joinWrap: React.CSSProperties = {
  ...anchor,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: 6,
};

const joinPill: React.CSSProperties = {
  ...pillCompact,
};

const countBadge: React.CSSProperties = {
  font: `600 11px ${FONT.mono}`,
  color: COLOR.greenTint,
};

const strip: React.CSSProperties = {
  ...anchor,
  width: STRIP_WIDTH,
  maxHeight: `calc(100vh - ${STRIP_TOP + STRIP_BOTTOM_CLEARANCE}px)`,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 8,
  boxSizing: 'border-box',
  background: 'rgba(23,25,30,.88)',
  border: `1px solid ${COLOR.hairline}`,
  borderRadius: RADIUS.card,
  boxShadow: SHADOW.dock,
};

const tileList: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  overflowY: 'auto',
  minHeight: 0,
};

const tileBox: React.CSSProperties = {
  position: 'relative',
  flex: 'none',
  aspectRatio: '4 / 3',
  borderRadius: RADIUS.cell,
  overflow: 'hidden',
  background: COLOR.avatarBg,
};

const videoFill: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
};

const tileAvatar: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const nameBar: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  padding: '4px 6px',
  background: 'linear-gradient(transparent, rgba(0,0,0,.65))',
  font: `600 11px ${FONT.ui}`,
};

const roleDot: React.CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: RADIUS.pill,
  flex: 'none',
};

const nameText: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const roleText: React.CSSProperties = {
  color: COLOR.fg2,
  fontWeight: 500,
};

const connectingBadge: React.CSSProperties = {
  position: 'absolute',
  top: 4,
  right: 4,
  padding: '2px 6px',
  borderRadius: RADIUS.tag,
  background: 'rgba(0,0,0,.6)',
  color: COLOR.fg2,
  font: `500 10px ${FONT.ui}`,
};

const controls: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 4,
};

const controlButton: React.CSSProperties = {
  ...iconSquare,
  width: 38,
  height: 34,
  background: COLOR.pill,
  border: 0,
  color: '#fff',
  fontSize: 14,
};

const errorText: React.CSSProperties = {
  maxWidth: STRIP_WIDTH,
  color: COLOR.redTint,
  font: `500 11px ${FONT.ui}`,
  textAlign: 'right',
};
