import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import * as THREE from 'three';
import type { Move, MoveType } from '@yard/shared-utils';
import { createWorld, type World } from '../three/world';
import {
  buildIntersection,
  Direction,
  IntersectionBuild,
} from '../three/intersection';
import {
  createTaxi,
  createBus,
  createUnderground,
  createFerry,
  VehicleHandle,
  VehicleKind,
} from '../three/vehicles';
import { createPovControls, PovControls } from '../three/controls';
import { playRide } from '../three/ride';
import { Hud } from '../hud/hud';
import { Crosshair } from '../hud/crosshair';
import { Intro } from '../hud/intro';
import { PaperMap } from '../hud/paper-map';
import { VehicleLabels } from '../hud/vehicle-labels';
import { HudShell } from '../hud/hud-shell';
import { JoinOverlay } from '../hud/join-overlay';
import { Attribution } from '../hud/attribution';
import { getConnections, getActiveDirections, getRiverDirections, type Connection } from '../game/connections';
import { nodeDisplayName } from '../core/map-data';
import { useGameStateStore } from '../stores/game-state-store';
import { useRunnerStore } from '../stores/runner-store';
import { getWebSocketClient } from '../net/websocket-client';
import { getGame } from '../net/rest-client';
import { validateMove, isCapture } from '../core/move-validator';
import { notifications } from '../core/notification-service';
import { replay } from '../core/replay-singleton';
import { play as playSfx, setMuted as setAudioMuted } from '../core/audio-bus';
import { deriveCurrentTurn } from '../core/turn-order';
import { parseUrlSession } from './url-params';
import { initializeMockSession } from './mock-session';

export interface HoveredInfo {
  kind: VehicleKind;
  destinationNodeId: number;
  destinationName: string;
  ticketsRemaining: number;
}

export function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  const [hoveredInfo, setHoveredInfo] = useState<HoveredInfo | null>(null);
  const [riding, setRiding] = useState(false);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const location = useLocation();
  const urlSession = useMemo(
    () => parseUrlSession(location.pathname, location.search),
    [location.pathname, location.search]
  );
  // Invite link: user landed on /game/X with no explicit role. Show role picker before
  // initializing the session.
  const needsJoin =
    urlSession != null && !urlSession.isMock && !urlSession.roleExplicit;
  // Sentinels for the VehicleLabels component — world becomes available + sceneVersion
  // bumps each rebuild so labels rebuild their DOM accordingly.
  const worldRef = useRef<World | null>(null);
  const vehiclesRef = useRef<VehicleHandle[]>([]);
  // Bridge: the click handler lives inside the three.js useEffect closure; the JSX
  // VehicleLabels pass-through reads through this ref so labels can fire it.
  const vehicleClickRef = useRef<((v: VehicleHandle) => void) | null>(null);
  const [sceneVersion, setSceneVersion] = useState(0);

  // Store subscriptions — all UI drives off these
  const players = useGameStateStore((s) => s.players);
  const currentTurn = useGameStateStore((s) => s.currentTurn);
  const moves = useGameStateStore((s) => s.moves);
  const channel = useGameStateStore((s) => s.channel);
  const myRole = useRunnerStore((s) => s.myRole);
  const viewingAs = useRunnerStore((s) => s.viewingAs);
  const mapOpen = useRunnerStore((s) => s.mapOpen);
  const setMapOpen = useRunnerStore((s) => s.setMapOpen);
  const isMockChannel = channel.startsWith('mock');

  // The role we're CURRENTLY VIEWING AS. Equals myRole unless the user clicked another
  // detective in the players drawer to switch perspective. Read-only impersonation —
  // we render the FPV from this player's intersection but the click handler still acts
  // (or refuses to act) on behalf of myRole.
  const viewerRole = viewingAs ?? myRole;
  const isImpersonating = viewerRole != null && myRole != null && viewerRole !== myRole;

  // Derived view from the IMPERSONATED player when impersonating, else from myRole
  const viewerPlayer = useMemo(
    () => (viewerRole ? players.find((p) => p.role === viewerRole) : undefined),
    [players, viewerRole]
  );
  const myPlayer = useMemo(
    () => (myRole ? players.find((p) => p.role === myRole) : undefined),
    [players, myRole]
  );
  const myPosition = viewerPlayer?.position ?? null;
  // "Is it my turn" follows the impersonated role — when you click another detective's
  // card to play as them, the turn check evaluates against THAT seat.
  const isMyTurn = !!viewerRole && currentTurn === viewerRole;
  const round = useMemo(
    () => moves.filter((m) => m.role === 'culprit').length + 1,
    [moves]
  );

  const tickets = useMemo(() => {
    // Show the IMPERSONATED player's tickets when impersonating
    return {
      taxi: viewerPlayer?.taxiTickets ?? 0,
      bus: viewerPlayer?.busTickets ?? 0,
      underground: viewerPlayer?.undergroundTickets ?? 0,
      secret: viewerPlayer?.secretTickets ?? 0,
      double: viewerPlayer?.doubleTickets ?? 0,
    };
  }, [viewerPlayer]);

  // Map-view connections: same source as the three.js scene rebuild uses, but
  // computed in render so MapView always sees fresh data without going through the
  // imperative useEffect.
  const mapConnections: readonly Connection[] = useMemo(() => {
    if (myPosition == null) return [];
    const includeRiver = viewerRole === 'culprit';
    return getConnections(myPosition, includeRiver);
  }, [myPosition, viewerRole]);
  const ticketsByKind = useMemo(
    () => ({
      taxi: tickets.taxi,
      bus: tickets.bus,
      underground: tickets.underground,
      // River is free for Mr. X — model as ∞ so the marker stays enabled.
      river: Infinity,
    }),
    [tickets.taxi, tickets.bus, tickets.underground]
  );

  // Keep refs to avoid stale closures in the long-lived useEffect
  const myRoleRef = useRef(myRole);
  myRoleRef.current = myRole;
  const isMyTurnRef = useRef(isMyTurn);
  isMyTurnRef.current = isMyTurn;
  const mapOpenRef = useRef(mapOpen);
  mapOpenRef.current = mapOpen;
  const ticketsRef = useRef(tickets);
  ticketsRef.current = tickets;
  const ridingRef = useRef(false);
  ridingRef.current = riding;

  // Sync audio mute state with the runner-store preference
  useEffect(() => {
    const sync = () => setAudioMuted(useRunnerStore.getState().muted);
    sync();
    return useRunnerStore.subscribe(sync);
  }, []);

  // Session init — re-runs when URL changes (e.g., JoinOverlay updates ?role=).
  useEffect(() => {
    // Wait for the joiner to pick a role before connecting to anything
    if (needsJoin) return;

    // Fill in identity defaults when the URL didn't carry them
    const fallbackName = useRunnerStore.getState().lastUsername || 'Player';
    const sessionName = urlSession?.name ? urlSession.name : fallbackName;

    if (urlSession?.isMock) {
      // Mock mode driven by URL (came from the lobby with theme+role chosen)
      useRunnerStore.getState().setIdentity(urlSession.role, sessionName);
      useGameStateStore.getState().setTheme(urlSession.theme);
      initializeMockSession(urlSession.role, sessionName, urlSession.channel);
      return () => {
        useGameStateStore.getState().reset();
      };
    }

    if (urlSession) {
      // Real mode: connect WebSocket
      useRunnerStore.getState().setIdentity(urlSession.role, sessionName);
      useGameStateStore.getState().setChannel(urlSession.channel);
      useGameStateStore.getState().setTheme(urlSession.theme);

      const client = getWebSocketClient();
      client.setHandlers({
        onConnectionStatus: (s) => {
          useGameStateStore.getState().setConnection(s);
          if (s === 'connected') {
            // Backend doesn't push game state on joinGame — fetch it via REST.
            // It also doesn't persist currentTurn between moves, so we derive it from
            // the moves array (same getNextRole rule the backend applies on broadcast).
            getGame(urlSession.channel).then((g) => {
              if (g) {
                const derived = deriveCurrentTurn(g.moves ?? []);
                useGameStateStore.getState().applyServerState({ ...g, currentTurn: derived });
              }
            });
          }
        },
        onUpdateGameState: (state) => {
          useGameStateStore.getState().applyServerState(state);
        },
        onMakeMove: (m) => {
          const store = useGameStateStore.getState();
          // Server echoes the sender's own moves. If the last move in our log already
          // matches this broadcast, we applied it optimistically — skip the duplicate
          // append and only sync the turn/double-move flags.
          const last = store.moves[store.moves.length - 1];
          const isEcho =
            last != null &&
            last.role === m.role &&
            last.position === m.position &&
            last.type === m.type &&
            !!last.secret === !!m.secret &&
            !!last.double === !!m.double;
          if (isEcho) {
            if (m.double) store.setIsDoubleMove(true);
            if (m.currentTurn) store.setCurrentTurn(m.currentTurn);
            return;
          }
          store.appendMove({
            role: m.role,
            type: m.type,
            position: m.position,
            secret: m.secret,
            double: m.double,
          });
          store.setPosition(m.role, m.position);
          store.decrementTickets(m.role, m.type, m.secret, m.double);
          if (m.double) store.setIsDoubleMove(true);
          if (m.currentTurn) store.setCurrentTurn(m.currentTurn);
        },
        onEndGame: (payload) => {
          useGameStateStore.getState().setFinished();
          notifications.push('capture', payload.winner ? `${payload.winner} wins` : 'Game over');
        },
        onPresence: ({ members }) => {
          useGameStateStore.getState().setOccupiedRoles(new Set(members.map((m) => m.role)));
        },
        onError: () => {
          // graceful: notify, keep mock state alive
          notifications.push('error', 'Connection error');
        },
      });
      (window as unknown as { __wsClient?: ReturnType<typeof getWebSocketClient> }).__wsClient = client;
      client.connect({ ...urlSession, name: sessionName });
      return () => client.disconnect();
    }

    // No URL session — fallback mock (e.g. direct hit on /game/demo)
    const { localRole, localName } = initializeMockSession();
    useRunnerStore.getState().setIdentity(localRole, localName);
    return () => {
      useGameStateStore.getState().reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsJoin, urlSession?.channel, urlSession?.role, urlSession?.name, urlSession?.theme]);

  // Three.js setup — runs once
  useEffect(() => {
    const canvas = canvasRef.current;
    const fade = fadeRef.current;
    if (!canvas || !fade) return;

    const world = createWorld(canvas);
    worldRef.current = world;
    let currentIntersection: IntersectionBuild | null = null;
    let vehicles: VehicleHandle[] = [];
    let lastBuiltForNode: number | null = null;

    function rebuildScene(nodeId: number) {
      if (currentIntersection) currentIntersection.dispose();
      for (const v of vehicles) {
        world.scene.remove(v.group);
        v.group.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
          if (mesh.material) {
            if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
            else (mesh.material as THREE.Material).dispose();
          }
        });
      }
      vehicles = [];

      // In replay mode we're viewing the culprit's path, so river always renders.
      // Otherwise show river only when the VIEWER (impersonation-aware) is the culprit.
      const runner = useRunnerStore.getState();
      const viewer = runner.viewingAs ?? runner.myRole;
      const includeRiver = replay.isActive() || viewer === 'culprit';
      const riverDirs = includeRiver ? getRiverDirections(nodeId) : new Set<Direction>();
      const connections = getConnections(nodeId, includeRiver);
      // One London stop per direction. Precedence underground > river > bus > taxi —
      // the strongest signifier wins per arm; the parked vehicles disambiguate the rest.
      const STOP_PRECEDENCE: Record<VehicleKind, number> = {
        underground: 4,
        river: 3,
        bus: 2,
        taxi: 1,
      };
      const stopsByDirection: Partial<Record<Direction, VehicleKind>> = {};
      for (const conn of connections) {
        const current = stopsByDirection[conn.direction];
        if (!current || STOP_PRECEDENCE[conn.kind] > STOP_PRECEDENCE[current]) {
          stopsByDirection[conn.direction] = conn.kind;
        }
      }
      const built = buildIntersection(
        world.scene,
        nodeId,
        getActiveDirections(nodeId, includeRiver),
        riverDirs,
        stopsByDirection
      );
      currentIntersection = built;

      for (const conn of connections) {
        let v: VehicleHandle;
        if (conn.kind === 'taxi') v = createTaxi(conn.targetNodeId);
        else if (conn.kind === 'bus') v = createBus(conn.targetNodeId);
        else if (conn.kind === 'underground') v = createUnderground(conn.targetNodeId);
        else if (conn.kind === 'river') v = createFerry(conn.targetNodeId);
        else continue;
        placeVehicle(v, built.exitAnchors[conn.direction], conn.direction, conn.slotIndex);
        world.scene.add(v.group);
        vehicles.push(v);
      }

      // Face forward at eye height for the new node. PointerLockControls own the
      // camera in FPV mode; this resets yaw/pitch so framing is consistent across nodes.
      if (controls) controls.resetView();

      lastBuiltForNode = nodeId;
      vehiclesRef.current = vehicles;
      setSceneVersion((v) => v + 1);
    }

    let controls: PovControls;

    async function onVehicleClick(v: VehicleHandle) {
      if (mapOpenRef.current) return;
      if (ridingRef.current) return; // already mid-ride; ignore extra clicks
      // Use the impersonated role for the actual move — impersonation IS seat-takeover.
      const runner = useRunnerStore.getState();
      const role = runner.viewingAs ?? myRoleRef.current;
      if (!role) {
        flashInvalid();
        return;
      }
      if (!isMyTurnRef.current) {
        flashInvalid();
        playSfx('invalid-move');
        notifications.push('warning', `Not your turn (${currentTurn})`);
        return;
      }

      const useSecret = runner.pendingSecret && role === 'culprit';
      const useDouble = runner.pendingDouble && role === 'culprit';
      const isCulpritMidDouble = useGameStateStore.getState().isDoubleMove && role === 'culprit';
      // Only the FIRST leg of a double move carries the `double` flag — the backend's
      // getNextRole(role, true) leaves the turn on the culprit. The SECOND leg has
      // double=false so the turn advances to detective1. (My earlier code tagged both
      // legs, which kept the turn stuck on culprit forever.)
      const tagDouble = useDouble;

      const verdict = validateMove(
        {
          role,
          targetNodeId: v.targetNodeId,
          transport: v.kind as MoveType,
          secret: useSecret,
          double: useDouble,
        },
        {
          currentTurn: useGameStateStore.getState().currentTurn,
          players: useGameStateStore.getState().players,
        }
      );
      if (!verdict.ok) {
        flashInvalid();
        playSfx('invalid-move');
        notifications.push('warning', reasonLabel(verdict.reason));
        return;
      }

      setRiding(true);
      controls.disable();
      playSfx('ride-start');
      const overlay = makeRideOverlay(fade!);
      const target = v.targetNodeId;
      const kind = v.kind as MoveType;

      try {
        await playRide(world, v, overlay, () => {
          rebuildScene(target);
        });

        const move: Move = {
          role,
          type: kind,
          position: target,
          secret: useSecret || undefined,
          double: tagDouble || undefined,
        };
        const wsClient = (window as unknown as { __wsClient?: { send: (t: string, d: Record<string, unknown>) => boolean } }).__wsClient;
        if (wsClient) {
          wsClient.send('makeMove', {
            role,
            type: kind,
            position: target,
            secret: useSecret,
            double: tagDouble,
          });
        }
        const store = useGameStateStore.getState();
        store.appendMove(move);
        store.setPosition(role, target);
        // River is free; everything else decrements normally. Secret deducts 1 secret
        // ticket AND the transport ticket (per board rules) — pass secret flag so the
        // store's reducer can handle it.
        if (kind !== 'river') {
          store.decrementTickets(role, kind, useSecret);
          playSfx('ticket-spent');
          // Low-ticket warning: peek the new count after the decrement
          const me = store.players.find((p) => p.role === role);
          if (me) {
            const newCount =
              kind === 'taxi'
                ? me.taxiTickets
                : kind === 'bus'
                ? me.busTickets
                : me.undergroundTickets;
            if (newCount > 0 && newCount <= 2) playSfx('low-ticket-warning');
          }
        } else if (useSecret) {
          // River + secret is technically possible (secret hides any transport); deduct
          // only the secret ticket, not a transport ticket.
          store.decrementTickets(role, kind, true);
          playSfx('ticket-spent');
        }

        // Reveal SFX: this culprit move just landed on a reveal round
        if (role === 'culprit') {
          const culpritCount = store.moves.filter((m) => m.role === 'culprit').length;
          if (culpritCount === 3 || culpritCount === 8 || culpritCount === 13 || culpritCount === 18 || culpritCount === 24) {
            playSfx('reveal');
          }
        }

        // Capture check (detective lands on culprit)
        if (
          isCapture(
            { role, targetNodeId: target, transport: kind },
            { currentTurn: store.currentTurn, players: store.players }
          )
        ) {
          store.setFinished();
          playSfx('capture');
          notifications.push('capture', 'Mr. X captured!');
        } else if (!wsClient) {
          // Mock mode turn advancement, with double-move bookkeeping
          if (useDouble) {
            // Just consumed leg 1 of a double — flag mid-double and DON'T advance turn.
            // Also deduct the double-ticket once (here, when the first leg commits).
            store.decrementTickets(role, kind, false, true);
            store.setIsDoubleMove(true);
          } else if (isCulpritMidDouble) {
            // Leg 2 just committed — clear the flag and advance normally.
            store.setIsDoubleMove(false);
            store.setCurrentTurn(pickNextTurn(role));
          } else {
            store.setCurrentTurn(pickNextTurn(role));
          }
        }

        // Auto-clear the toggles so the next click doesn't reuse them by accident.
        useRunnerStore.getState().setPendingSecret(false);
        useRunnerStore.getState().setPendingDouble(false);

        // Replay snapshot: record after each culprit move so the post-game scrubber has
        // an entry per round. Snapshots capture the public moves + player roster +
        // Mr. X's *actual* position (only fully known to the culprit & post-game).
        if (role === 'culprit') {
          const s = useGameStateStore.getState();
          replay.record({
            turnIndex: s.moves.filter((m) => m.role === 'culprit').length - 1,
            moves: s.moves.map((m) => ({ ...m })),
            players: s.players.map((p) => ({ ...p })),
            culpritActualPosition: target,
          });
        }
      } finally {
        setRiding(false);
        controls.enable();
      }
    }

    function flashInvalid() {
      fade!.style.transition = 'background 80ms ease';
      fade!.style.background = 'rgba(255, 50, 50, 0.25)';
      setTimeout(() => {
        fade!.style.transition = 'background 400ms ease';
        fade!.style.background = 'rgba(0,0,0,0)';
      }, 80);
    }

    vehicleClickRef.current = onVehicleClick;

    controls = createPovControls({
      canvas,
      camera: world.camera,
      getVehicles: () => vehicles,
      onVehicleClick,
      onHoverChange: (v) => {
        if (!v) {
          setHoveredInfo(null);
          return;
        }
        const remaining = (ticketsRef.current as Record<string, number>)[v.kind] ?? 0;
        setHoveredInfo({
          kind: v.kind,
          destinationNodeId: v.targetNodeId,
          destinationName: nodeDisplayName(v.targetNodeId),
          ticketsRemaining: remaining,
        });
      },
      addTick: world.addTick,
    });

    // Pointer-lock state — tracks whether the canvas owns the cursor. HUD overlays
    // (Crosshair, VehicleLabels, Hud) gate visibility on this so they only appear
    // during true FPV engagement (not during Intro / PaperMap / ride cinematic).
    const pointerLockHandler = () => {
      setPointerLocked(document.pointerLockElement === canvas);
    };
    document.addEventListener('pointerlockchange', pointerLockHandler);

    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const cur = useRunnerStore.getState().mapOpen;
        const next = !cur;
        useRunnerStore.getState().setMapOpen(next);
        playSfx(next ? 'map-open' : 'map-close');
        if (next && document.pointerLockElement === canvas) {
          document.exitPointerLock();
        }
      } else if (e.key === 'Escape' && mapOpenRef.current) {
        useRunnerStore.getState().setMapOpen(false);
        playSfx('map-close');
      }
    };
    window.addEventListener('keydown', keyHandler);

    // Build the scene whenever the VIEWER (myRole or impersonated detective) moves or
    // their identity becomes known. In REPLAY mode, route to the snapshot's culprit
    // position instead — the scrubber drives the FPV.
    const maybeRebuild = () => {
      if (ridingRef.current) return; // don't yank the scene out from under a ride animation
      if (replay.isActive()) {
        const snap = replay.current();
        const pos = snap?.culpritActualPosition;
        if (pos == null) return;
        if (pos === lastBuiltForNode) return;
        rebuildScene(pos);
        return;
      }
      const runner = useRunnerStore.getState();
      const role = runner.viewingAs ?? runner.myRole;
      if (!role) return;
      const me = useGameStateStore.getState().players.find((p) => p.role === role);
      if (!me) return;
      if (me.position === lastBuiltForNode) return;
      rebuildScene(me.position);
    };

    const unsubGame = useGameStateStore.subscribe(maybeRebuild);
    const unsubRunner = useRunnerStore.subscribe(maybeRebuild);
    const unsubReplay = replay.subscribe(maybeRebuild);

    // Synchronous initial check — both stores may already be populated by the session-init useEffect
    maybeRebuild();

    return () => {
      unsubGame();
      unsubRunner();
      unsubReplay();
      window.removeEventListener('keydown', keyHandler);
      document.removeEventListener('pointerlockchange', pointerLockHandler);
      controls.detach();
      if (currentIntersection) currentIntersection.dispose();
      world.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMapDismiss = () => {
    setMapOpen(false);
    canvasRef.current?.requestPointerLock();
  };

  // Bridge a map-click into the existing three.js vehicle-click pipeline by matching
  // the connection's (kind, targetNodeId) to the live VehicleHandle. All move logic
  // — validation, optimistic apply, WS send, ticket decrement — is reused untouched.
  const handleMapClick = (conn: Connection) => {
    const v = vehiclesRef.current.find(
      (h) => h.kind === conn.kind && h.targetNodeId === conn.targetNodeId
    );
    if (!v) return;
    vehicleClickRef.current?.(v);
  };

  return (
    <>
      {/* FPV canvas — full-screen, owns the cursor when pointer-locked. */}
      <canvas
        ref={canvasRef}
        style={{ position: 'fixed', inset: 0, zIndex: 0, cursor: 'crosshair' }}
      />
      {needsJoin && urlSession && (
        <JoinOverlay channel={urlSession.channel} onJoin={() => { /* navigate happens inside */ }} />
      )}
      <Hud
        nodeId={myPosition ?? 1}
        nodeName={nodeDisplayName(myPosition ?? 1)}
        round={round}
        tickets={tickets}
        hoveredInfo={hoveredInfo}
        mapHint={!mapOpen}
      />
      <Crosshair
        pointerLocked={pointerLocked}
        hoveredKind={hoveredInfo?.kind ?? null}
        hidden={riding || mapOpen || !pointerLocked}
      />
      {isMockChannel && (
        <div style={mockBadge}>
          <span style={mockDot} />
          <span>MOCK MODE</span>
          <span style={mockSub}>· AI disabled · backend offline</span>
        </div>
      )}
      <VehicleLabels
        world={worldRef.current}
        sceneVersion={sceneVersion}
        getVehicles={() => vehiclesRef.current}
        hidden={riding || mapOpen || !pointerLocked}
        onVehicleClick={(v) => vehicleClickRef.current?.(v)}
      />
      {/* Attribution was for the Google 3D Tiles photoreal world, which is no
       *  longer instantiated. PaperMap's embedded MapView carries Google's own
       *  attribution (its required Maps JS attribution renders inside the map
       *  container itself). */}
      {showIntro && !pointerLocked && !riding && !mapOpen && (
        <Intro
          onDismiss={() => {
            setShowIntro(false);
            canvasRef.current?.requestPointerLock();
          }}
        />
      )}
      {mapOpen && myPosition != null && (
        <PaperMap
          currentNodeId={myPosition}
          connections={mapConnections}
          isMyTurn={!riding && isMyTurn}
          currentTurnRole={currentTurn}
          viewerRole={viewerRole}
          players={players}
          culpritMoveCount={moves.filter((m) => m.role === 'culprit').length}
          ticketsByKind={ticketsByKind}
          onConnectionClick={(conn) => {
            handleMapClick(conn);
            canvasRef.current?.requestPointerLock();
          }}
          onClose={handleMapDismiss}
        />
      )}
      <HudShell />
      <div
        ref={fadeRef}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0)',
          pointerEvents: 'none',
          transition: 'background 400ms ease',
          zIndex: 10,
        }}
      />
    </>
  );
}

const mockBadge: React.CSSProperties = {
  position: 'fixed',
  top: 12,
  right: 12,
  zIndex: 6,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  background: 'rgba(226, 85, 85, 0.95)',
  color: '#fff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1.5,
  textTransform: 'uppercase',
  borderRadius: 18,
  border: '1px solid rgba(255,255,255,0.4)',
  boxShadow: '0 4px 14px rgba(0,0,0,0.45)',
  pointerEvents: 'none',
};

const mockDot: React.CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: '50%',
  background: '#fff',
  boxShadow: '0 0 6px #fff',
  animation: 'pulse 1.6s ease-in-out infinite',
};

const mockSub: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: 0.8,
  color: 'rgba(255,255,255,0.85)',
  fontWeight: 500,
  textTransform: 'none',
};

function placeVehicle(
  handle: VehicleHandle,
  anchor: THREE.Vector3,
  dir: Direction,
  slotIndex: number
) {
  // Ferry placement: ride on the water, centered along the river, ~13m forward from
  // intersection (just past the jetty). Y at 0 = water surface (the ferry's hull sits
  // half-submerged, which reads as floating).
  if (handle.kind === 'river') {
    const forward = directionVector(dir);
    const pos = forward.clone().multiplyScalar(5 + 13);
    pos.y = 0;
    handle.group.position.copy(pos);
    let yaw = 0;
    switch (dir) {
      case 'north':
        yaw = Math.PI;
        break;
      case 'south':
        yaw = 0;
        break;
      case 'east':
        yaw = Math.PI / 2;
        break;
      case 'west':
        yaw = -Math.PI / 2;
        break;
    }
    handle.group.rotation.y = yaw;
    return;
  }

  // Road vehicles: two-lane × multi-row packing keyed off the road centerline (so we
  // ignore the anchor's curbside lateral bias). Lanes at ±LANE_OFFSET keep all vehicles
  // within the ±ROAD_HALF=5 road bed. Rows spaced by ROW_DEPTH keep adjacent rows from
  // overlapping even with the longest bus body (length 7.5 → half=3.75; ROW_DEPTH 9
  // leaves a 1.5m air gap).
  const LANE_OFFSET = 2.4;
  const ROW_DEPTH = 9;
  const row = Math.floor(slotIndex / 2);
  const lane = slotIndex % 2 === 0 ? 1 : -1; // alternate curb sides

  const forward = directionVector(dir);
  const right = lateralVector(dir);
  // Centerline anchor — strip the curbside bias the intersection-builder applied
  const centerline = centerlineFromAnchor(anchor, dir);
  const pos = centerline.clone();
  pos.add(forward.clone().multiplyScalar(row * ROW_DEPTH));
  pos.add(right.clone().multiplyScalar(lane * LANE_OFFSET));
  handle.group.position.copy(pos);

  const isUnderground = handle.rideForwardLocal.z < 0;
  let yaw = 0;
  switch (dir) {
    case 'north':
      yaw = isUnderground ? 0 : Math.PI;
      break;
    case 'south':
      yaw = isUnderground ? Math.PI : 0;
      break;
    case 'east':
      yaw = isUnderground ? -Math.PI / 2 : Math.PI / 2;
      break;
    case 'west':
      yaw = isUnderground ? Math.PI / 2 : -Math.PI / 2;
      break;
  }
  handle.group.rotation.y = yaw;
}

function centerlineFromAnchor(anchor: THREE.Vector3, dir: Direction): THREE.Vector3 {
  // For N/S the anchor has lateral X bias; for E/W it has lateral Z bias. Zero the lateral
  // component to get the centerline of the road at the exit mouth.
  switch (dir) {
    case 'north':
    case 'south':
      return new THREE.Vector3(0, anchor.y, anchor.z);
    case 'east':
    case 'west':
      return new THREE.Vector3(anchor.x, anchor.y, 0);
  }
}

function directionVector(dir: Direction): THREE.Vector3 {
  // World "away from intersection" along each cardinal direction
  switch (dir) {
    case 'north':
      return new THREE.Vector3(0, 0, -1);
    case 'south':
      return new THREE.Vector3(0, 0, 1);
    case 'east':
      return new THREE.Vector3(1, 0, 0);
    case 'west':
      return new THREE.Vector3(-1, 0, 0);
  }
}

function lateralVector(dir: Direction): THREE.Vector3 {
  // Perpendicular to forward — "across the road"
  switch (dir) {
    case 'north':
    case 'south':
      return new THREE.Vector3(1, 0, 0);
    case 'east':
    case 'west':
      return new THREE.Vector3(0, 0, 1);
  }
}

function makeRideOverlay(el: HTMLDivElement) {
  return {
    setFade(alpha: number) {
      el.style.transition = 'none';
      el.style.background = `rgba(8, 6, 4, ${alpha})`;
    },
    setBlur(px: number) {
      el.style.backdropFilter = px > 0 ? `blur(${px}px)` : 'none';
    },
    setLabel(_text: string | null) {
      // not yet wired
    },
  };
}

function pickNextTurn(current: string): import('@yard/shared-utils').RoleType {
  const order: import('@yard/shared-utils').RoleType[] = [
    'culprit',
    'detective1',
    'detective2',
    'detective3',
    'detective4',
    'detective5',
  ];
  const i = order.indexOf(current as import('@yard/shared-utils').RoleType);
  return order[(i + 1) % order.length];
}

function reasonLabel(reason: string): string {
  switch (reason) {
    case 'no-ticket':
      return 'No ticket for that transport';
    case 'detective-collision':
      return 'A detective is already there';
    case 'invalid-connection':
      return 'No connection from here';
    case 'not-your-turn':
      return "It's not your turn";
    case 'no-secret-tickets':
      return 'No secret tickets';
    case 'no-double-tickets':
      return 'No double tickets';
    case 'river-not-allowed':
      return 'Detectives cannot use the river';
    case 'secret-not-allowed':
      return 'Detectives cannot use secret tickets';
    case 'double-not-allowed':
      return 'Detectives cannot make double moves';
    default:
      return 'Invalid move';
  }
}
