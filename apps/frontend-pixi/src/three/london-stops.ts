// Per-transport stop builders for the FPV intersection. Each returns a single Group
// already positioned/oriented for the given direction, so the caller just adds it.
//
// Conventions:
// - Geometry/material instances are pushed into the caller's addGeo/addMat collectors so
//   intersection's dispose() releases them in the existing path.
// - CanvasTextures are NOT added to the material collector (their map is a texture, not a
//   material); they're disposed when the parent material is disposed because
//   MeshStandardMaterial.dispose() does not auto-dispose its .map. We attach them to the
//   returned group via userData.__textures so the intersection can sweep them on dispose.
// - All builders use a per-stop seeded RNG so per-node geometry stays stable across
//   rebuilds within a turn.

import * as THREE from 'three';
import type { Direction } from './intersection';
import { DIRECTION_FORWARD } from './intersection';
import {
  TFL_RED,
  TFL_BLUE,
  TAXI_BLACK,
  TAXI_YELLOW,
  IRON_GREEN,
  CREAM,
  BRICK_WARM,
  STATION_NAMES,
  PIER_NAMES,
} from './palette';
import {
  makeTextTexture,
  makeRoundelTexture,
  makeChequerTexture,
  makePierSignTexture,
  makeRouteFlagTexture,
  makeStationLintelTexture,
} from './canvas-textures';
import { makeRng, pickFrom, pickInt } from './rng';

type AddGeo = <T extends THREE.BufferGeometry>(g: T) => T;
type AddMat = <T extends THREE.Material>(m: T) => T;

const ROAD_HALF = 5;
const SIDEWALK = 2.5;
const CURB_OFFSET = ROAD_HALF + SIDEWALK - 0.6;

interface StopBuildCtx {
  nodeId: number;
  dir: Direction;
  addGeo: AddGeo;
  addMat: AddMat;
  textures: THREE.Texture[];
}

function applyDirection(group: THREE.Group, dir: Direction) {
  const fwd = DIRECTION_FORWARD[dir];
  const yaw = Math.atan2(fwd.x, fwd.z);
  group.rotation.y = yaw;
}

function curbAnchor(dir: Direction, side: 1 | -1, alongOffset: number): THREE.Vector3 {
  // `side` flips which side of the road the stop sits on. Convention: side=1 means the
  // right-hand side when walking forward.
  const fwd = DIRECTION_FORWARD[dir];
  const right = new THREE.Vector3(0, 1, 0).cross(fwd).normalize();
  return fwd
    .clone()
    .multiplyScalar(alongOffset)
    .add(right.multiplyScalar(side * CURB_OFFSET));
}

function trackTexture(ctx: StopBuildCtx, tex: THREE.Texture) {
  ctx.textures.push(tex);
  return tex;
}

// ---------------------------------------------------------------------------
// TAXI
// ---------------------------------------------------------------------------
export function buildTaxiStop(ctx: StopBuildCtx): THREE.Group {
  const { addGeo, addMat } = ctx;
  const group = new THREE.Group();
  group.name = `taxi-stop-${ctx.nodeId}-${ctx.dir}`;

  const blackMat = addMat(new THREE.MeshStandardMaterial({ color: TAXI_BLACK, roughness: 0.5, metalness: 0.5 }));

  // Pole
  const pole = new THREE.Mesh(addGeo(new THREE.CylinderGeometry(0.05, 0.06, 2.6, 10)), blackMat);
  pole.position.y = 1.3;
  pole.castShadow = true;
  group.add(pole);

  // Sign plate — both faces emissive so the "TAXI" letters glow in fog
  const signTex = trackTexture(ctx, makeTextTexture('TAXI', {
    width: 512,
    height: 256,
    bg: '#1a1a1c',
    fg: '#ffffff',
    fontPx: 180,
  }));
  const signMat = addMat(
    new THREE.MeshStandardMaterial({
      map: signTex,
      emissive: 0xfff4cc,
      emissiveMap: signTex,
      emissiveIntensity: 0.5,
      side: THREE.DoubleSide,
    })
  );
  const sign = new THREE.Mesh(addGeo(new THREE.PlaneGeometry(0.9, 0.45)), signMat);
  sign.position.y = 2.5;
  sign.position.z = 0.03;
  group.add(sign);

  // Chequered band beneath the sign
  const chequerTex = trackTexture(ctx, makeChequerTexture(24, 2, '#1a1a1c', `#${TAXI_YELLOW.toString(16).padStart(6, '0')}`));
  const chequerMat = addMat(new THREE.MeshStandardMaterial({ map: chequerTex, side: THREE.DoubleSide }));
  const chequer = new THREE.Mesh(addGeo(new THREE.PlaneGeometry(0.9, 0.1)), chequerMat);
  chequer.position.set(0, 2.22, 0.03);
  group.add(chequer);

  // Kerb bollard
  const bollard = new THREE.Mesh(addGeo(new THREE.CylinderGeometry(0.12, 0.14, 0.7, 8)), blackMat);
  bollard.position.set(0.4, 0.35, 0);
  bollard.castShadow = true;
  group.add(bollard);

  // Place on the right-hand curb of the arm, ~5m down from the intersection mouth
  group.position.copy(curbAnchor(ctx.dir, 1, ROAD_HALF + 5));
  applyDirection(group, ctx.dir);
  return group;
}

// ---------------------------------------------------------------------------
// BUS
// ---------------------------------------------------------------------------
export function buildBusStop(ctx: StopBuildCtx): THREE.Group {
  const { addGeo, addMat } = ctx;
  const rng = makeRng(ctx.nodeId * 8311 + ctx.dir.length * 13);
  const group = new THREE.Group();
  group.name = `bus-stop-${ctx.nodeId}-${ctx.dir}`;

  // Pole
  const redMat = addMat(new THREE.MeshStandardMaterial({ color: TFL_RED, roughness: 0.7 }));
  const pole = new THREE.Mesh(addGeo(new THREE.CylinderGeometry(0.06, 0.07, 3.2, 12)), redMat);
  pole.position.y = 1.6;
  pole.castShadow = true;
  group.add(pole);

  // TfL roundel head (double-sided)
  const roundelTex = trackTexture(ctx, makeRoundelTexture({
    ringColor: `#${TFL_RED.toString(16).padStart(6, '0')}`,
    barColor: `#${TFL_RED.toString(16).padStart(6, '0')}`,
    barText: 'BUS',
  }));
  const roundelMat = addMat(
    new THREE.MeshStandardMaterial({ map: roundelTex, transparent: true, side: THREE.DoubleSide })
  );
  const roundel = new THREE.Mesh(addGeo(new THREE.CircleGeometry(0.45, 32)), roundelMat);
  roundel.position.set(0, 3.0, 0.04);
  group.add(roundel);

  // Route-number flag plate (perpendicular to roundel — sticks out sideways so the
  // FPV from the road catches it at an angle)
  const routes = [pickInt(rng, 10, 99), pickInt(rng, 100, 299), pickInt(rng, 10, 99)];
  const flagTex = trackTexture(ctx, makeRouteFlagTexture(routes));
  const flagMat = addMat(new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide }));
  const flag = new THREE.Mesh(addGeo(new THREE.PlaneGeometry(0.55, 0.7)), flagMat);
  flag.position.set(0.32, 2.3, 0);
  flag.rotation.y = Math.PI / 2;
  group.add(flag);

  // ~50% chance of a small shelter
  if (rng() < 0.5) {
    const shelterRoof = new THREE.Mesh(
      addGeo(new THREE.BoxGeometry(2.6, 0.06, 1.2)),
      addMat(new THREE.MeshStandardMaterial({ color: 0xbfd6e4, transparent: true, opacity: 0.45, roughness: 0.15 }))
    );
    shelterRoof.position.set(-1.4, 2.5, 0);
    group.add(shelterRoof);
    const back = new THREE.Mesh(
      addGeo(new THREE.BoxGeometry(2.6, 1.6, 0.04)),
      addMat(new THREE.MeshStandardMaterial({ color: 0xbfd6e4, transparent: true, opacity: 0.35 }))
    );
    back.position.set(-1.4, 1.7, -0.58);
    group.add(back);
    for (const z of [-0.55, 0.55]) {
      const post = new THREE.Mesh(
        addGeo(new THREE.CylinderGeometry(0.04, 0.04, 2.5, 8)),
        redMat
      );
      post.position.set(-2.7, 1.25, z);
      group.add(post);
    }
    // Bench
    const bench = new THREE.Mesh(
      addGeo(new THREE.BoxGeometry(1.6, 0.06, 0.4)),
      addMat(new THREE.MeshStandardMaterial({ color: TAXI_BLACK, roughness: 0.7 }))
    );
    bench.position.set(-1.4, 0.45, 0.2);
    group.add(bench);
  }

  // "BUS STOP" painted on the road below the pole
  const paintTex = trackTexture(ctx, makeTextTexture('BUS STOP', {
    width: 512,
    height: 128,
    bg: '#2a2a2e',
    fg: '#f4efe2',
    fontPx: 80,
  }));
  const paintMat = addMat(new THREE.MeshStandardMaterial({ map: paintTex, roughness: 0.9 }));
  const paint = new THREE.Mesh(addGeo(new THREE.PlaneGeometry(2.4, 0.7)), paintMat);
  paint.rotation.x = -Math.PI / 2;
  paint.position.set(0, 0.012, 1.5);
  group.add(paint);

  group.position.copy(curbAnchor(ctx.dir, 1, ROAD_HALF + 8));
  applyDirection(group, ctx.dir);
  return group;
}

// ---------------------------------------------------------------------------
// UNDERGROUND — roundel sign + brick arch + station-name lintel
// ---------------------------------------------------------------------------
export function buildUndergroundStop(ctx: StopBuildCtx): THREE.Group {
  const { addGeo, addMat } = ctx;
  const rng = makeRng(ctx.nodeId * 7919 + ctx.dir.length * 31);
  const group = new THREE.Group();
  group.name = `underground-stop-${ctx.nodeId}-${ctx.dir}`;

  const steelMat = addMat(new THREE.MeshStandardMaterial({ color: TAXI_BLACK, roughness: 0.5, metalness: 0.6 }));
  const brickMat = addMat(new THREE.MeshStandardMaterial({ color: BRICK_WARM, roughness: 0.95 }));

  // Sign pole
  const pole = new THREE.Mesh(addGeo(new THREE.CylinderGeometry(0.06, 0.08, 3.5, 12)), steelMat);
  pole.position.y = 1.75;
  pole.castShadow = true;
  group.add(pole);

  // The famous TfL Underground roundel — red ring + blue bar with "UNDERGROUND"
  const roundelTex = trackTexture(ctx, makeRoundelTexture({
    ringColor: `#${TFL_RED.toString(16).padStart(6, '0')}`,
    barColor: `#${TFL_BLUE.toString(16).padStart(6, '0')}`,
    barText: 'UNDERGROUND',
  }));
  const roundelMat = addMat(
    new THREE.MeshStandardMaterial({
      map: roundelTex,
      emissive: 0xffffff,
      emissiveMap: roundelTex,
      emissiveIntensity: 0.35,
      transparent: true,
      side: THREE.DoubleSide,
    })
  );
  const roundel = new THREE.Mesh(addGeo(new THREE.CircleGeometry(0.7, 48)), roundelMat);
  roundel.position.set(0, 3.7, 0.05);
  group.add(roundel);

  // Brick arch hint — 5 voussoir blocks spanning a semicircle, lintel band underneath
  const archR = 1.4;
  const wedgeCount = 5;
  for (let i = 0; i < wedgeCount; i++) {
    const a = (Math.PI * (i + 0.5)) / wedgeCount; // 0..PI mapped to wedges
    const wedge = new THREE.Mesh(
      addGeo(new THREE.BoxGeometry(0.6, 0.4, 0.5)),
      brickMat
    );
    wedge.position.set(
      Math.cos(Math.PI - a) * archR,
      0.8 + Math.sin(a) * archR,
      0
    );
    wedge.rotation.z = Math.PI / 2 - a;
    group.add(wedge);
  }
  // Lintel with station name
  const stationName = pickFrom(rng, STATION_NAMES);
  const lintelTex = trackTexture(ctx, makeStationLintelTexture(stationName));
  const lintelMat = addMat(new THREE.MeshStandardMaterial({ map: lintelTex, roughness: 0.7 }));
  const lintel = new THREE.Mesh(addGeo(new THREE.BoxGeometry(2.8, 0.3, 0.05)), lintelMat);
  lintel.position.set(0, 0.65, 0.21);
  group.add(lintel);
  // Backside of the lintel — keep it cream/brick so it doesn't look like the texture
  // poked through (the BoxGeometry's side/back faces show whatever material is set)
  // Note: a single material applies to all faces; the visible reverse will show the
  // texture mirrored, which is acceptable from FPV (player rarely sees back side).

  // Balustrade base
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(
      addGeo(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 8)),
      steelMat
    );
    post.position.set(sx * 1.0, 0.5, 0.25);
    group.add(post);
  }
  const rail = new THREE.Mesh(
    addGeo(new THREE.BoxGeometry(2.0, 0.04, 0.04)),
    steelMat
  );
  rail.position.set(0, 1.0, 0.25);
  group.add(rail);

  group.position.copy(curbAnchor(ctx.dir, 1, ROAD_HALF + 6));
  applyDirection(group, ctx.dir);
  return group;
}

// ---------------------------------------------------------------------------
// RIVER PIER — planked deck, green Victorian iron railings, pier sign, mooring cleat.
// REPLACES the existing jetty block that intersection.ts builds.
// ---------------------------------------------------------------------------
export function buildRiverPier(ctx: StopBuildCtx): THREE.Group {
  const { addGeo, addMat } = ctx;
  const rng = makeRng(ctx.nodeId * 6121 + ctx.dir.length * 41);
  const group = new THREE.Group();
  group.name = `pier-${ctx.nodeId}-${ctx.dir}`;

  const plankMatA = addMat(new THREE.MeshStandardMaterial({ color: 0x6e4a25, roughness: 0.95 }));
  const plankMatB = addMat(new THREE.MeshStandardMaterial({ color: 0x7a5530, roughness: 0.95 }));
  const skirtMat = addMat(new THREE.MeshStandardMaterial({ color: 0x4a3a25, roughness: 1 }));
  const ironMat = addMat(new THREE.MeshStandardMaterial({ color: IRON_GREEN, roughness: 0.55, metalness: 0.3 }));
  const cleatMat = addMat(new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: 0.6, metalness: 0.7 }));

  const PIER_LEN = 8;
  const PIER_WIDTH = 2.6;

  // Substructure skirt (visible at the edges)
  const skirt = new THREE.Mesh(
    addGeo(new THREE.BoxGeometry(PIER_WIDTH, 0.25, PIER_LEN + 0.1)),
    skirtMat
  );
  skirt.position.set(0, 0.07, PIER_LEN / 2 + 0.3);
  group.add(skirt);

  // 6 planks side by side
  const plankCount = 6;
  const plankW = (PIER_WIDTH - 0.1) / plankCount;
  for (let i = 0; i < plankCount; i++) {
    const plank = new THREE.Mesh(
      addGeo(new THREE.BoxGeometry(plankW * 0.95, 0.08, PIER_LEN)),
      i % 2 === 0 ? plankMatA : plankMatB
    );
    plank.position.set(
      -PIER_WIDTH / 2 + plankW / 2 + i * plankW,
      0.22 + (i % 3) * 0.003,
      PIER_LEN / 2 + 0.3
    );
    plank.receiveShadow = true;
    plank.castShadow = true;
    group.add(plank);
  }

  // Victorian iron railings — balusters + top rail, both long edges
  const balusterCount = 6;
  for (const side of [-1, 1]) {
    for (let i = 0; i < balusterCount; i++) {
      const t = (i + 0.5) / balusterCount;
      const z = 0.3 + t * (PIER_LEN - 0.2);
      const baluster = new THREE.Mesh(
        addGeo(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 8)),
        ironMat
      );
      baluster.position.set(side * (PIER_WIDTH / 2 - 0.08), 0.7, z);
      group.add(baluster);
      // Finial cap
      const finial = new THREE.Mesh(
        addGeo(new THREE.SphereGeometry(0.07, 12, 10)),
        ironMat
      );
      finial.position.set(side * (PIER_WIDTH / 2 - 0.08), 1.18, z);
      group.add(finial);
    }
    const topRail = new THREE.Mesh(
      addGeo(new THREE.CylinderGeometry(0.045, 0.045, PIER_LEN - 0.2, 10)),
      ironMat
    );
    topRail.rotation.x = Math.PI / 2;
    topRail.position.set(side * (PIER_WIDTH / 2 - 0.08), 1.15, PIER_LEN / 2 + 0.3);
    group.add(topRail);
  }

  // Pier sign at the shore end, mounted on two short posts
  const pierName = pickFrom(rng, PIER_NAMES);
  const signTex = trackTexture(ctx, makePierSignTexture(pierName));
  const signMat = addMat(new THREE.MeshStandardMaterial({ map: signTex, side: THREE.DoubleSide }));
  const sign = new THREE.Mesh(addGeo(new THREE.PlaneGeometry(1.6, 0.55)), signMat);
  sign.position.set(0, 1.7, 0.55);
  group.add(sign);
  for (const sx of [-0.7, 0.7]) {
    const post = new THREE.Mesh(
      addGeo(new THREE.CylinderGeometry(0.04, 0.04, 1.5, 8)),
      ironMat
    );
    post.position.set(sx, 0.95, 0.55);
    group.add(post);
  }

  // Mooring cleat at the deck edge
  const cleatBar = new THREE.Mesh(
    addGeo(new THREE.BoxGeometry(0.4, 0.18, 0.12)),
    cleatMat
  );
  cleatBar.position.set(PIER_WIDTH / 2 - 0.25, 0.35, PIER_LEN - 0.3);
  group.add(cleatBar);
  for (const dz of [-0.12, 0.12]) {
    const stub = new THREE.Mesh(
      addGeo(new THREE.CylinderGeometry(0.07, 0.07, 0.2, 10)),
      cleatMat
    );
    stub.position.set(PIER_WIDTH / 2 - 0.25, 0.32, PIER_LEN - 0.3 + dz);
    group.add(stub);
  }

  // Orient along the river arm: deck length runs FORWARD from the shore.
  applyDirection(group, ctx.dir);
  return group;
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------
export type StopKind = 'taxi' | 'bus' | 'underground' | 'river';

export function buildStop(
  kind: StopKind,
  nodeId: number,
  dir: Direction,
  addGeo: AddGeo,
  addMat: AddMat,
  textures: THREE.Texture[]
): THREE.Group {
  const ctx: StopBuildCtx = { nodeId, dir, addGeo, addMat, textures };
  switch (kind) {
    case 'taxi':
      return buildTaxiStop(ctx);
    case 'bus':
      return buildBusStop(ctx);
    case 'underground':
      return buildUndergroundStop(ctx);
    case 'river':
      return buildRiverPier(ctx);
  }
}
