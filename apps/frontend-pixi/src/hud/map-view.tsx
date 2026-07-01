// Google Maps 2D top-down view, styled black-and-white, with the entire Scotland
// Yard graph projected onto real London:
//   - All 200+ numbered node circles, always visible
//   - All transport edges (yellow taxi / green bus / red-dashed underground / cyan
//     river) drawn at startup
//   - Current player position highlighted with a thick orange ring
//   - Reachable destinations highlighted with their transport color, click to ride,
//     right-click for Street View
//   - Every detective and Mr. X (when revealed) shown at their current node with a
//     role-coloured avatar dot
//   - Full Street View overlay reachable via the top-right "Look around" button or
//     right-clicking any node
//
// Uses classic google.maps.Marker (not AdvancedMarkerElement) because inline
// `styles` array doesn't work with a mapId, and we need the desaturated base map.

import { useEffect, useRef, useState, useMemo } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import type { Player, RoleType } from '@yard/shared-utils';
import type { Connection, TransportKind } from '../game/connections';
import {
  coordsForNode,
  ALL_NODE_IDS,
  ALL_EDGES,
  type LondonCoord,
} from '../game/london-coords';
import { nodeDisplayName } from '../core/map-data';
import { useGameStateStore } from '../stores/game-state-store';
import { getTheme, characterFor } from '../core/theme-registry';
import { spawnSpotlight, spawnTrailDot, spawnPulse, type EffectHandle } from './map-effects';

export interface MapViewProps {
  currentNodeId: number;
  connections: readonly Connection[];
  interactive: boolean;
  isMyTurn: boolean;
  currentTurnRole: string;
  /** Self perspective — used to decide whether to show Mr. X's true position. */
  viewerRole: RoleType | null;
  /** All players in the game, used to render position dots. */
  players: readonly Player[];
  /** Move count for the culprit so we can reveal Mr. X on rounds 3/8/13/18/24. */
  culpritMoveCount: number;
  ticketsByKind: Partial<Record<TransportKind, number>>;
  /** Post-game replay (#11): show the REPLAY badge and disable interaction. */
  isReplay?: boolean;
  onConnectionClick: (conn: Connection) => void;
}

const KIND_COLOR: Record<TransportKind, string> = {
  taxi: '#f6c945',
  bus: '#2e9b4f',
  underground: '#d63a3a',
  river: '#3a86c7',
};

const KIND_ICON: Record<TransportKind, string> = {
  taxi: '🚖',
  bus: '🚌',
  underground: 'Ⓤ',
  river: '⛴️',
};

const KIND_LABEL: Record<TransportKind, string> = {
  taxi: 'Taxi',
  bus: 'Bus',
  underground: 'Tube',
  river: 'Ferry',
};

const ROLE_LABEL: Record<string, string> = {
  culprit: 'Mr. X',
  detective1: 'Detective 1',
  detective2: 'Detective 2',
  detective3: 'Detective 3',
  detective4: 'Detective 4',
  detective5: 'Detective 5',
};

const ROLE_COLOR: Record<string, string> = {
  culprit: '#1a1a1a',
  detective1: '#5a8dde',
  detective2: '#f6c945',
  detective3: '#e25555',
  detective4: '#6cb8d6',
  detective5: '#a06bd8',
};

const ROLE_SHORT: Record<string, string> = {
  culprit: 'X',
  detective1: 'D1',
  detective2: 'D2',
  detective3: 'D3',
  detective4: 'D4',
  detective5: 'D5',
};

const REVEAL_ROUNDS = [3, 8, 13, 18, 24];

// Desaturated Google Maps style — gives the muted board-game feel while keeping
// streets, water, parks legible. POI clutter (restaurants, shops) is hidden so
// the eye focuses on the game graph overlay.
const BW_STYLES: google.maps.MapTypeStyle[] = [
  { stylers: [{ saturation: -100 }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.neighborhood', stylers: [{ visibility: 'off' }] },
];

let mapsApiPromise: Promise<{
  maps: google.maps.MapsLibrary;
  streetView: google.maps.StreetViewLibrary;
}> | null = null;
function loadMapsApi(apiKey: string) {
  if (!mapsApiPromise) {
    setOptions({ key: apiKey, v: 'weekly' });
    mapsApiPromise = Promise.all([
      importLibrary('maps'),
      importLibrary('streetView'),
    ]).then(([maps, streetView]) => ({ maps, streetView }));
  }
  return mapsApiPromise;
}

/** Builds an SVG-as-data-URI icon for a classic Marker. White circle, colored
 *  ring, centered node number. */
function makeNodeIcon(
  label: string,
  ringColor: string,
  size: number,
  fontSize: number,
  fillColor = '#fff'
): google.maps.Icon {
  const half = size / 2;
  const r = half - 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <circle cx="${half}" cy="${half}" r="${r}" fill="${fillColor}" stroke="${ringColor}" stroke-width="3"/>
    <text x="${half}" y="${half + fontSize * 0.36}" text-anchor="middle" font-family="-apple-system, Helvetica, Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="#111">${label}</text>
  </svg>`;
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(half, half),
  };
}

/** Fallback avatar icon — colored disc with role abbreviation. Used while the
 *  themed character portrait loads in the background. */
function makePlayerIcon(role: string): google.maps.Icon {
  const color = ROLE_COLOR[role] ?? '#555';
  const label = ROLE_SHORT[role] ?? '?';
  const size = 36;
  const half = size / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <circle cx="${half}" cy="${half}" r="${half - 2}" fill="${color}" stroke="#fff" stroke-width="3"/>
    <text x="${half}" y="${half + 4}" text-anchor="middle" font-family="-apple-system, Helvetica, Arial, sans-serif" font-size="13" font-weight="700" fill="#fff">${label}</text>
  </svg>`;
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(half, half),
  };
}

// Per-(theme, role) cached portrait avatar data-URIs. Built on first use by
// loading the character PNG and compositing it onto a canvas with a colored
// ring matching ROLE_COLOR. Cached forever — the same theme will only generate
// each avatar once across the whole session.
const avatarCache = new Map<string, Promise<google.maps.Icon>>();

function loadPlayerAvatar(themeId: string, role: string): Promise<google.maps.Icon> {
  const key = `${themeId}:${role}`;
  const cached = avatarCache.get(key);
  if (cached) return cached;
  const theme = getTheme(themeId);
  const character = characterFor(theme, role as RoleType);
  const promise = new Promise<google.maps.Icon>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const size = 40;
      const half = size / 2;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('no canvas ctx'));
        return;
      }
      // Outer ring in the role color
      ctx.fillStyle = ROLE_COLOR[role] ?? '#555';
      ctx.beginPath();
      ctx.arc(half, half, half - 1, 0, Math.PI * 2);
      ctx.fill();
      // Clip to the inner circle and draw the portrait. Use cover-style center
      // cropping (equivalent to CSS object-fit: cover) so non-square source
      // images don't get squashed — the smaller dimension fills the avatar,
      // the larger dimension is center-cropped.
      ctx.save();
      ctx.beginPath();
      ctx.arc(half, half, half - 4, 0, Math.PI * 2);
      ctx.clip();
      const inset = 4;
      const dest = size - inset * 2;
      const sw = img.naturalWidth;
      const sh = img.naturalHeight;
      const srcSize = Math.min(sw, sh);
      const sx = (sw - srcSize) / 2;
      const sy = (sh - srcSize) / 2;
      ctx.drawImage(img, sx, sy, srcSize, srcSize, inset, inset, dest, dest);
      ctx.restore();
      // White stroke between portrait and ring
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(half, half, half - 3, 0, Math.PI * 2);
      ctx.stroke();
      resolve({
        url: canvas.toDataURL('image/png'),
        scaledSize: new google.maps.Size(size, size),
        anchor: new google.maps.Point(half, half),
      });
    };
    img.onerror = () => reject(new Error(`failed to load avatar ${character.image}`));
    img.src = character.image;
  });
  avatarCache.set(key, promise);
  return promise;
}

function makePolylineOpts(kind: TransportKind, weight: number, opacity: number) {
  const opts: google.maps.PolylineOptions = {
    strokeColor: KIND_COLOR[kind],
    clickable: false,
  };
  if (kind === 'underground') {
    opts.strokeOpacity = 0;
    opts.icons = [
      {
        icon: { path: 'M 0,-1 0,1', strokeOpacity: opacity, strokeWeight: weight, scale: 3 },
        offset: '0',
        repeat: '14px',
      },
    ];
  } else {
    opts.strokeOpacity = opacity;
    opts.strokeWeight = weight;
  }
  return opts;
}

export function MapView({
  currentNodeId,
  connections,
  interactive,
  isMyTurn,
  currentTurnRole,
  viewerRole,
  players,
  culpritMoveCount,
  ticketsByKind,
  isReplay = false,
  onConnectionClick,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const streetViewContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const streetViewRef = useRef<google.maps.StreetViewPanorama | null>(null);

  const baseNodeMarkersRef = useRef<google.maps.Marker[]>([]);
  const baseEdgePolylinesRef = useRef<google.maps.Polyline[]>([]);
  const highlightMarkersRef = useRef<google.maps.Marker[]>([]);
  const highlightEdgesRef = useRef<google.maps.Polyline[]>([]);
  const currentMarkerRef = useRef<google.maps.Marker | null>(null);
  /** Per-role marker state — kept alive across renders so we can animate the
   *  marker smoothly when a player moves rather than tearing it down + recreating. */
  const playerMarkersRef = useRef<
    Map<
      string,
      {
        marker: google.maps.Marker;
        fromLat: number;
        fromLng: number;
        toLat: number;
        toLng: number;
        animStart: number;
        animDuration: number;
      }
    >
  >(new Map());
  const connectionClickListeners = useRef<google.maps.MapsEventListener[]>([]);
  // Legacy-parity effects (#4): looping valid-move pulses (cancelled on rebuild), and refs
  // to avoid re-firing one-shot effects every render.
  const pulseHandlesRef = useRef<EffectHandle[]>([]);
  const zoneCirclesRef = useRef<google.maps.Circle[]>([]);
  const lastSpotlightPosRef = useRef<number | null>(null);
  const lastTurnZoomRef = useRef<string | null>(null);
  const themeId = useGameStateStore((s) => s.theme);
  const status = useGameStateStore((s) => s.status);

  const [mapReady, setMapReady] = useState(false);
  const [streetViewLocation, setStreetViewLocation] = useState<
    { lat: number; lng: number; label: string } | null
  >(null);
  const [tourIndex, setTourIndex] = useState<number | null>(null);
  const [pubs, setPubs] = useState<{ name: string; address: string; lat: number; lng: number }[]>([]);
  const [pubIndex, setPubIndex] = useState<number | null>(null);

  const goToTourNode = (idx: number) => {
    const id = ALL_NODE_IDS[idx];
    const coords = coordsForNode(id);
    setTourIndex(idx);
    setPubIndex(null);
    setStreetViewLocation({ lat: coords.lat, lng: coords.lng, label: `Node ${id} (${idx + 1}/${ALL_NODE_IDS.length})` });
  };

  const goToPub = (idx: number) => {
    const pub = pubs[idx];
    if (!pub) return;
    setPubIndex(idx);
    setTourIndex(null);
    setStreetViewLocation({ lat: pub.lat, lng: pub.lng, label: `🍺 ${pub.name} (${idx + 1}/${pubs.length})` });
  };

  const startPubTour = () => {
    if (pubs.length > 0) { goToPub(0); return; }
    fetch('/data/london-pubs.json')
      .then(r => r.json())
      .then((data: { name: string; address: string; lat: number; lng: number }[]) => {
        setPubs(data);
        if (data.length > 0) {
          setPubIndex(0);
          setTourIndex(null);
          setStreetViewLocation({ lat: data[0].lat, lng: data[0].lng, label: `🍺 ${data[0].name} (1/${data.length})` });
        }
      })
      .catch(() => console.error('Could not load london-pubs.json'));
  };

  const isCulpritOnRevealRound = REVEAL_ROUNDS.includes(culpritMoveCount);

  // One-time: load API + create map
  useEffect(() => {
    const apiKey = (import.meta as { env?: { VITE_GOOGLE_MAPS_API_KEY?: string } }).env
      ?.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey || !containerRef.current) return;
    let cancelled = false;
    loadMapsApi(apiKey)
      .then(({ maps }) => {
        if (cancelled || !containerRef.current) return;
        const here = coordsForNode(currentNodeId);
        mapRef.current = new maps.Map(containerRef.current, {
          center: { lat: here.lat, lng: here.lng },
          zoom: 14,
          styles: BW_STYLES,
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: 'greedy',
          backgroundColor: '#eee',
        });
        google.maps.event.trigger(mapRef.current, 'resize');
        setMapReady(true);
      })
      .catch((err) => {
        console.error('Maps: failed to load Maps JS API:', err);
      });
    (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => {
      console.error('Maps: gm_authFailure — check API enablement / billing / referrer');
    };
    return () => {
      cancelled = true;
    };
  }, []);

  // Build the static graph once: every node + every edge, drawn subtly.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // Edges (deduped, all transports)
    for (const edge of ALL_EDGES) {
      const a = coordsForNode(edge.a);
      const b = coordsForNode(edge.b);
      const opts = makePolylineOpts(
        edge.kind,
        edge.kind === 'underground' ? 2.5 : edge.kind === 'bus' ? 3 : 2,
        0.35
      );
      opts.path = [a, b];
      opts.zIndex = 0;
      const line = new google.maps.Polyline(opts);
      line.setMap(map);
      baseEdgePolylinesRef.current.push(line);
    }

    // Nodes (small numbered circles)
    for (const id of ALL_NODE_IDS) {
      const pos = coordsForNode(id);
      const marker = new google.maps.Marker({
        position: pos,
        map,
        icon: makeNodeIcon(String(id), '#888', 18, 9),
        zIndex: 1,
        title: nodeDisplayName(id),
      });
      marker.addListener('rightclick', () => {
        setStreetViewLocation({ lat: pos.lat, lng: pos.lng, label: nodeDisplayName(id) });
      });
      baseNodeMarkersRef.current.push(marker);
    }

    return () => {
      for (const m of baseNodeMarkersRef.current) m?.setMap(null);
      for (const e of baseEdgePolylinesRef.current) e?.setMap(null);
      baseNodeMarkersRef.current = [];
      baseEdgePolylinesRef.current = [];
    };
  }, [mapReady]);

  // Highlight layer: current node ring, valid destinations, bold edges to them.
  // Rebuilt every time the player state shifts (current node, tickets, turn).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // Null-guard: a hot reload can leave stale/holey entries in these arrays.
    for (const l of connectionClickListeners.current) l?.remove();
    connectionClickListeners.current = [];
    for (const m of highlightMarkersRef.current) m?.setMap(null);
    for (const e of highlightEdgesRef.current) e?.setMap(null);
    highlightMarkersRef.current = [];
    highlightEdgesRef.current = [];
    for (const h of pulseHandlesRef.current) h?.cancel();
    pulseHandlesRef.current = [];
    if (currentMarkerRef.current) currentMarkerRef.current.setMap(null);

    const here = coordsForNode(currentNodeId);
    map.panTo(here);

    // Current player position
    currentMarkerRef.current = new google.maps.Marker({
      position: here,
      map,
      icon: makeNodeIcon(String(currentNodeId), '#ff6b35', 38, 13),
      zIndex: 200,
      title: `YOU — ${nodeDisplayName(currentNodeId)}`,
    });
    currentMarkerRef.current.addListener('rightclick', () => {
      setStreetViewLocation({
        lat: here.lat,
        lng: here.lng,
        label: nodeDisplayName(currentNodeId),
      });
    });

    // Bold edges from current to each reachable destination + large destination markers
    for (const conn of connections) {
      const target = coordsForNode(conn.targetNodeId);
      const tickets = ticketsByKind[conn.kind] ?? 0;
      const empty = conn.kind !== 'river' && tickets <= 0;
      const ringColor = empty ? '#999' : KIND_COLOR[conn.kind];

      const opts = makePolylineOpts(conn.kind, conn.kind === 'bus' ? 6 : 5, 0.9);
      opts.path = [here, target];
      opts.zIndex = 10;
      const line = new google.maps.Polyline(opts);
      line.setMap(map);
      highlightEdgesRef.current.push(line);

      const dest = new google.maps.Marker({
        position: target,
        map,
        icon: makeNodeIcon(String(conn.targetNodeId), ringColor, 30, 12),
        zIndex: 100,
        title: `${nodeDisplayName(conn.targetNodeId)} — ${
          empty
            ? 'no ticket'
            : conn.kind === 'river'
            ? `free ${KIND_LABEL[conn.kind].toLowerCase()}`
            : `${KIND_LABEL[conn.kind]} · ${tickets - 1} left after`
        }`,
        cursor: empty || !interactive ? 'not-allowed' : 'pointer',
      });
      if (!empty && interactive) {
        const listener = dest.addListener('click', () => onConnectionClick(conn));
        connectionClickListeners.current.push(listener);
      }
      const rcListener = dest.addListener('rightclick', () => {
        setStreetViewLocation({
          lat: target.lat,
          lng: target.lng,
          label: nodeDisplayName(conn.targetNodeId),
        });
      });
      connectionClickListeners.current.push(rcListener);
      highlightMarkersRef.current.push(dest);

      // Valid-move pulse (#4): looping aura under each affordable destination. A low
      // ticket count (1–2) warms the colour as a soft scarcity warning.
      if (!empty && interactive) {
        const lowTicket = conn.kind !== 'river' && tickets > 0 && tickets <= 2;
        pulseHandlesRef.current.push(
          spawnPulse(map, target, lowTicket ? '#ff9f43' : KIND_COLOR[conn.kind])
        );
      }
    }
  }, [
    mapReady,
    currentNodeId,
    connections,
    interactive,
    ticketsByKind,
    onConnectionClick,
  ]);

  // Player avatars (detectives always; Mr. X only on reveal rounds OR to himself).
  // Markers persist across re-renders so we can animate them smoothly when a
  // player's position changes (rather than recreating which would teleport).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const seen = new Set<string>();

    for (const p of players) {
      const isCulprit = p.role === 'culprit';
      const showCulprit = isCulprit && (viewerRole === 'culprit' || isCulpritOnRevealRound);
      if (isCulprit && !showCulprit) continue;
      seen.add(p.role);
      const pos = coordsForNode(p.position);
      // Tiny lat/lng offset so the avatar sits beside the node circle rather
      // than directly on top of it
      const toLat = pos.lat + 0.0003;
      const toLng = pos.lng + 0.0003;

      const existing = playerMarkersRef.current.get(p.role);
      if (!existing) {
        const marker = new google.maps.Marker({
          position: { lat: toLat, lng: toLng },
          map,
          icon: makePlayerIcon(p.role),
          zIndex: 260,
          title: `${ROLE_LABEL[p.role] ?? p.role} — ${nodeDisplayName(p.position)}`,
        });
        playerMarkersRef.current.set(p.role, {
          marker,
          fromLat: toLat,
          fromLng: toLng,
          toLat,
          toLng,
          animStart: performance.now(),
          animDuration: 0,
        });
        // Upgrade to a themed character portrait once it finishes loading.
        loadPlayerAvatar(themeId, p.role)
          .then((icon) => {
            const slot = playerMarkersRef.current.get(p.role);
            if (slot?.marker === marker) marker.setIcon(icon);
          })
          .catch(() => {
            /* keep the SVG fallback */
          });
      } else if (existing.toLat !== toLat || existing.toLng !== toLng) {
        // Movement trail (#4): drop a fading breadcrumb at the node just left, and a
        // small landing flourish at the destination, both in the player's role colour.
        const roleColor = ROLE_COLOR[p.role] ?? '#888';
        spawnTrailDot(map, { lat: existing.toLat, lng: existing.toLng }, roleColor);
        spawnSpotlight(map, { lat: toLat, lng: toLng }, roleColor, 140);
        // Position changed → start a smooth slide from CURRENT visual position
        // (read live from the marker, not the previous target — handles
        // mid-animation interruptions gracefully) to the new target.
        const curr = existing.marker.getPosition();
        existing.fromLat = curr?.lat() ?? existing.toLat;
        existing.fromLng = curr?.lng() ?? existing.toLng;
        existing.toLat = toLat;
        existing.toLng = toLng;
        existing.animStart = performance.now();
        existing.animDuration = 1400;
        // Bump zIndex while moving so the avatar slides above other props
        existing.marker.setZIndex(280);
        existing.marker.setTitle(
          `${ROLE_LABEL[p.role] ?? p.role} — ${nodeDisplayName(p.position)}`
        );
      }
    }

    // Tear down markers for players no longer visible (e.g. Mr. X gone non-reveal)
    for (const [role, slot] of playerMarkersRef.current) {
      if (!seen.has(role)) {
        slot.marker.setMap(null);
        playerMarkersRef.current.delete(role);
      }
    }
  }, [mapReady, players, viewerRole, isCulpritOnRevealRound, themeId]);

  // Animation tick — runs every frame while the map is mounted. Lerps each
  // marker from its `from` to its `to` lat/lng over `animDuration` ms with a
  // cubic ease-out so a move feels like a smooth glide rather than a snap.
  useEffect(() => {
    if (!mapReady) return;
    let rafId = 0;
    const tick = () => {
      const now = performance.now();
      for (const slot of playerMarkersRef.current.values()) {
        if (slot.animDuration <= 0) continue;
        const t = Math.min(1, (now - slot.animStart) / slot.animDuration);
        // ease-out cubic
        const e = 1 - Math.pow(1 - t, 3);
        const lat = slot.fromLat + (slot.toLat - slot.fromLat) * e;
        const lng = slot.fromLng + (slot.toLng - slot.fromLng) * e;
        slot.marker.setPosition({ lat, lng });
        if (t >= 1) {
          slot.animDuration = 0;
          slot.marker.setZIndex(260);
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [mapReady]);

  // Final cleanup on unmount
  useEffect(() => {
    const ref = playerMarkersRef.current;
    return () => {
      for (const slot of ref.values()) slot.marker?.setMap(null);
      ref.clear();
      for (const h of pulseHandlesRef.current) h?.cancel();
      pulseHandlesRef.current = [];
    };
  }, []);

  // Reveal spotlight (#4): an expanding ring at Mr. X's node on a reveal round.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (!isCulpritOnRevealRound) {
      lastSpotlightPosRef.current = null;
      return;
    }
    const culprit = players.find((p) => p.role === 'culprit');
    if (!culprit) return;
    if (lastSpotlightPosRef.current === culprit.position) return;
    lastSpotlightPosRef.current = culprit.position;
    spawnSpotlight(map, coordsForNode(culprit.position), '#ff3b30', 380);
  }, [mapReady, isCulpritOnRevealRound, players]);

  // Turn camera (#4): zoom in on your turn; pull back to an overview on the culprit's
  // turn so detectives can read the whole chase.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (lastTurnZoomRef.current === currentTurnRole) return;
    lastTurnZoomRef.current = currentTurnRole;
    if (isMyTurn) map.setZoom(15);
    else if (currentTurnRole === 'culprit') map.setZoom(13);
  }, [mapReady, currentTurnRole, isMyTurn]);

  // Capture-zone (#11): a faint reach radius around each detective so coverage — and
  // Mr. X being surrounded — reads at a glance. Rebuilt as detectives move.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    for (const c of zoneCirclesRef.current) c?.setMap(null);
    zoneCirclesRef.current = [];
    for (const p of players) {
      if (p.role === 'culprit') continue;
      const color = ROLE_COLOR[p.role] ?? '#888';
      zoneCirclesRef.current.push(
        new google.maps.Circle({
          map,
          center: coordsForNode(p.position),
          radius: 220,
          strokeColor: color,
          strokeOpacity: 0.35,
          strokeWeight: 1,
          fillColor: color,
          fillOpacity: 0.06,
          clickable: false,
          zIndex: 2,
        })
      );
    }
    return () => {
      for (const c of zoneCirclesRef.current) c?.setMap(null);
      zoneCirclesRef.current = [];
    };
  }, [mapReady, players]);

  // Capture shake (#4): a brief jolt of the board when the game ends.
  useEffect(() => {
    if (status !== 'finished') return;
    const el = containerRef.current;
    if (!el || typeof el.animate !== 'function') return;
    el.animate(
      [
        { transform: 'translate(0,0)' },
        { transform: 'translate(-6px, 4px)' },
        { transform: 'translate(5px, -3px)' },
        { transform: 'translate(-4px, 2px)' },
        { transform: 'translate(0,0)' },
      ],
      { duration: 500, easing: 'ease-out' }
    );
  }, [status]);

  // Street View overlay lifecycle
  useEffect(() => {
    const container = streetViewContainerRef.current;
    if (!streetViewLocation || !container) {
      if (streetViewRef.current) {
        streetViewRef.current.setVisible(false);
        streetViewRef.current = null;
      }
      return;
    }
    // Re-await the API loader to get a direct reference to the `streetView`
    // library — the v=weekly dynamic loader doesn't reliably mirror imported
    // libraries to the `google.maps.*` global namespace, so accessing
    // `google.maps.StreetViewService` was throwing "not a constructor".
    const apiKey = (import.meta as { env?: { VITE_GOOGLE_MAPS_API_KEY?: string } }).env
      ?.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return;
    loadMapsApi(apiKey)
      .then(({ streetView }) => {
        const target = streetViewContainerRef.current;
        if (!target) return;
        const service = new streetView.StreetViewService();
        return service
          .getPanorama({
            location: { lat: streetViewLocation.lat, lng: streetViewLocation.lng },
            radius: 120,
            source: streetView.StreetViewSource.GOOGLE,
          })
          .then((result) => {
            const panoPos = result.data.location?.latLng;
            if (!panoPos) {
              console.warn('Street View: no coverage near', streetViewLocation);
              return;
            }
            if (!streetViewRef.current) {
              streetViewRef.current = new streetView.StreetViewPanorama(target, {
                position: panoPos,
                pov: { heading: 0, pitch: 0 },
                zoom: 1,
                addressControl: false,
                showRoadLabels: true,
                motionTracking: false,
                motionTrackingControl: false,
                fullscreenControl: false,
                enableCloseButton: false,
                visible: true,
              });
            } else {
              streetViewRef.current.setPosition(panoPos);
              streetViewRef.current.setVisible(true);
            }
            requestAnimationFrame(() => {
              if (streetViewRef.current) {
                // event is on the shared maps namespace, which IS reliably global
                google.maps.event.trigger(streetViewRef.current, 'resize');
              }
            });
          });
      })
      .catch((err) => console.error('Street View: getPanorama failed', err));
  }, [streetViewLocation]);

  const turnText = useMemo(
    () =>
      isMyTurn
        ? 'Your turn — click a destination'
        : `Waiting for ${ROLE_LABEL[currentTurnRole] ?? currentTurnRole}…`,
    [isMyTurn, currentTurnRole]
  );

  // Reveal countdown / indicator (#4).
  const revealText = useMemo(() => {
    if (isCulpritOnRevealRound) return `👁 Mr. X revealed · round ${culpritMoveCount}`;
    const next = REVEAL_ROUNDS.find((r) => r > culpritMoveCount);
    if (next == null) return null;
    const inN = next - culpritMoveCount;
    return `Mr. X reveal in ${inN} ${inN === 1 ? 'round' : 'rounds'}`;
  }, [isCulpritOnRevealRound, culpritMoveCount]);

  const here = coordsForNode(currentNodeId);

  return (
    <>
      <div
        ref={containerRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 1,
          background: '#1a1a1a',
        }}
      />
      {!isReplay && <div style={turnBanner(isMyTurn)}>{turnText}</div>}
      {!isReplay && revealText && (
        <div style={revealBanner(isCulpritOnRevealRound)}>{revealText}</div>
      )}
      {isReplay && <div style={replayBadge}>● REPLAY</div>}
      <div style={topRightButtons}>
        <button
          type="button"
          onClick={() =>
            setStreetViewLocation({
              lat: here.lat,
              lng: here.lng,
              label: nodeDisplayName(currentNodeId),
            })
          }
          style={lookHereBtn}
          title="Right-click any node to look there"
        >
          👁️ Look around
        </button>
        <div style={tourButtonGroup}>
          <button
            type="button"
            onClick={() => goToTourNode(0)}
            style={tourBtn}
            title="Cycle through all 217 game nodes"
          >
            🗺️ Nodes
          </button>
          <button
            type="button"
            onClick={startPubTour}
            style={{ ...tourBtn, borderLeft: '1px solid rgba(255,255,255,0.15)' }}
            title="Street view tour of 815 London pubs"
          >
            🍺 Pubs
          </button>
        </div>
      </div>
      <div style={legendBox}>
        <div style={legendTitle}>Transport</div>
        {(Object.keys(KIND_LABEL) as TransportKind[]).map((k) => (
          <div key={k} style={legendRow}>
            <span
              style={{
                ...legendSwatch,
                background: k === 'underground' ? 'transparent' : KIND_COLOR[k],
                borderTop:
                  k === 'underground' ? `3px dashed ${KIND_COLOR[k]}` : 'none',
              }}
            />
            <span style={{ fontSize: 12 }}>{KIND_ICON[k]}</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>
              {KIND_LABEL[k]}
            </span>
          </div>
        ))}
        <div style={legendHint}>Right-click any node for Street View</div>
      </div>
      {streetViewLocation && (
        <div style={streetViewOverlay}>
          <div ref={streetViewContainerRef} style={streetViewPanel} />
          <div style={streetViewHeader}>
            <div>
              <div style={streetViewKicker}>Street view</div>
              <div style={streetViewTitle}>{streetViewLocation.label}</div>
            </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {tourIndex !== null && (
                <>
                  <button type="button" style={streetViewClose}
                    onClick={() => goToTourNode((tourIndex - 1 + ALL_NODE_IDS.length) % ALL_NODE_IDS.length)}>
                    ← Prev
                  </button>
                  <button type="button" style={streetViewClose}
                    onClick={() => goToTourNode((tourIndex + 1) % ALL_NODE_IDS.length)}>
                    Next →
                  </button>
                </>
              )}
              {pubIndex !== null && pubs.length > 0 && (
                <>
                  <button type="button" style={streetViewClose}
                    onClick={() => goToPub((pubIndex - 1 + pubs.length) % pubs.length)}>
                    ← Prev
                  </button>
                  <button type="button" style={streetViewClose}
                    onClick={() => goToPub((pubIndex + 1) % pubs.length)}>
                    Next →
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => { setStreetViewLocation(null); setTourIndex(null); setPubIndex(null); }}
                style={streetViewClose}
              >
                ✕ Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function turnBanner(isMyTurn: boolean): React.CSSProperties {
  return {
    position: 'fixed',
    top: 12,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 5,
    padding: '8px 18px',
    background: isMyTurn ? 'rgba(255, 107, 53, 0.95)' : 'rgba(10, 12, 16, 0.85)',
    color: '#fff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: '0.3px',
    borderRadius: 22,
    border: `1px solid ${isMyTurn ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.18)'}`,
    boxShadow: '0 6px 22px rgba(0,0,0,0.45)',
    pointerEvents: 'none',
  };
}

const replayBadge: React.CSSProperties = {
  position: 'fixed',
  top: 12,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 5,
  padding: '6px 16px',
  background: 'rgba(124, 58, 237, 0.92)',
  color: '#fff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 1.5,
  textTransform: 'uppercase',
  borderRadius: 18,
  border: '1px solid rgba(255,255,255,0.4)',
  boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
  pointerEvents: 'none',
};

function revealBanner(active: boolean): React.CSSProperties {
  return {
    position: 'fixed',
    top: 52,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 5,
    padding: '5px 14px',
    background: active ? 'rgba(214, 31, 31, 0.92)' : 'rgba(10, 12, 16, 0.8)',
    color: '#fff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 0.3,
    borderRadius: 18,
    border: `1px solid ${active ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.15)'}`,
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    pointerEvents: 'none',
  };
}

const topRightButtons: React.CSSProperties = {
  position: 'fixed',
  top: 12,
  right: 12,
  zIndex: 5,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: 8,
};

const lookHereBtn: React.CSSProperties = {
  padding: '8px 14px',
  background: 'rgba(10, 12, 16, 0.92)',
  border: '1px solid rgba(255,255,255,0.25)',
  borderRadius: 22,
  color: '#fff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.3px',
  cursor: 'pointer',
  boxShadow: '0 6px 22px rgba(0,0,0,0.45)',
};

const tourButtonGroup: React.CSSProperties = {
  display: 'flex',
  background: 'rgba(10, 12, 16, 0.92)',
  border: '1px solid rgba(255,255,255,0.25)',
  borderRadius: 22,
  overflow: 'hidden',
  boxShadow: '0 6px 22px rgba(0,0,0,0.45)',
};

const tourBtn: React.CSSProperties = {
  padding: '8px 14px',
  background: 'transparent',
  border: 'none',
  color: '#fff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.3px',
  cursor: 'pointer',
};

const legendBox: React.CSSProperties = {
  position: 'fixed',
  left: 12,
  bottom: 36,
  zIndex: 5,
  padding: '10px 12px',
  background: 'rgba(10, 12, 16, 0.88)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 10,
  color: '#fff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  boxShadow: '0 6px 22px rgba(0,0,0,0.45)',
  pointerEvents: 'none',
};

const legendTitle: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: 1.5,
  color: 'rgba(255,255,255,0.5)',
  textTransform: 'uppercase',
  fontWeight: 700,
};

const legendRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

const legendSwatch: React.CSSProperties = {
  width: 18,
  height: 4,
  borderRadius: 2,
};

const legendHint: React.CSSProperties = {
  marginTop: 6,
  paddingTop: 6,
  borderTop: '1px solid rgba(255,255,255,0.12)',
  fontSize: 9,
  letterSpacing: 0.4,
  color: 'rgba(255,255,255,0.5)',
  fontStyle: 'italic',
};

const streetViewOverlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 20,
  background: 'rgba(0,0,0,0.65)',
  backdropFilter: 'blur(4px)',
  padding: '60px 5vw',
};

const streetViewPanel: React.CSSProperties = {
  width: '100%',
  height: '100%',
  borderRadius: 12,
  overflow: 'hidden',
  border: '1px solid rgba(255,255,255,0.15)',
  boxShadow: '0 20px 80px rgba(0,0,0,0.7)',
};

const streetViewHeader: React.CSSProperties = {
  position: 'absolute',
  top: 12,
  left: '5vw',
  right: '5vw',
  padding: '8px 16px',
  background: 'rgba(10, 12, 16, 0.85)',
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: 8,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  color: '#fff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  pointerEvents: 'auto',
};

const streetViewKicker: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: 2,
  color: 'rgba(255,255,255,0.55)',
  textTransform: 'uppercase',
};

const streetViewTitle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  marginTop: 2,
};

const streetViewClose: React.CSSProperties = {
  padding: '6px 14px',
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.35)',
  borderRadius: 6,
  color: '#fff',
  fontFamily: 'inherit',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  letterSpacing: 0.4,
};
