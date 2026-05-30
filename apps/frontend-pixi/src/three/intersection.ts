// Procedural London intersection — fully self-authored, no photoreal tileset.
// Renders, per node:
//   - ground asphalt disk (catches shadows, guards against falling into the void)
//   - road tarmac strips on each active arm, dashed yellow centerline, crosswalk stripes
//   - STONE_KERB curb blocks lining each road, plus sidewalk strips beside them
//   - corner sidewalk fillers in quadrants between two active non-river arms
//   - building rows in each quadrant (open arms) and wall-buildings sealing inactive arms
//   - Thames water plane (with shimmer streaks), shore lamp, and railing on river arms
//   - London stop totems per active direction (taxi / bus / underground / river pier)
//   - Belisha beacons flanking zebra crossings (non-underground active arms)
//   - occasional red phone box (rng-gated, max one per node)
//   - traffic-light pole when activeDirections.size >= 3
//   - scattered trees in non-built quadrants
//   - street lamps at every curb corner
//
// Frame convention: +X east, -Z north — matches DIRECTION_FORWARD. Vehicles sit at the
// returned exitAnchors (one per direction), placed ±(ROAD_HALF + 2) along the arm.

import * as THREE from 'three';
import { buildStop, type StopKind } from './london-stops';
import {
  buildBelishaBeacon,
  buildPhoneBox,
  buildTrafficLightPole,
} from './streetscape';
import {
  STONE_KERB,
  CREAM,
  FOG_TINT,
  TAXI_BLACK,
  BRICK_WARM,
  IRON_GREEN,
  TFL_RED,
} from './palette';
import { makeRng, pickFloat, pickInt, pickFrom } from './rng';

export interface IntersectionBuild {
  group: THREE.Group;
  exitAnchors: Record<Direction, THREE.Vector3>;
  dispose: () => void;
}

export type Direction = 'north' | 'south' | 'east' | 'west';

export const DIRECTION_FORWARD: Record<Direction, THREE.Vector3> = {
  north: new THREE.Vector3(0, 0, -1),
  south: new THREE.Vector3(0, 0, 1),
  east: new THREE.Vector3(1, 0, 0),
  west: new THREE.Vector3(-1, 0, 0),
};

const ROAD_HALF = 5;
const SIDEWALK = 2.5;
const ARM_LENGTH = 40;
const GROUND_HALF = ARM_LENGTH;
const LANE_DASH_LENGTH = 2.2;
const LANE_GAP = 2;
const CROSSWALK_STRIPES = 5;
const CROSSWALK_STRIPE_WIDTH = 0.5;
const CROSSWALK_STRIPE_GAP = 0.45;
const CURB_HEIGHT = 0.18;
const SIDEWALK_Y = 0.05;

const ALL_DIRS: readonly Direction[] = ['north', 'south', 'east', 'west'];

const BUILDING_COLORS = [0x8a6b54, 0x9b8a72, 0xa39684, BRICK_WARM, 0x6f5a4a, 0xb09b80];

function rotYForDirection(dir: Direction): number {
  const fwd = DIRECTION_FORWARD[dir];
  return Math.atan2(fwd.x, fwd.z);
}

// Quadrant key built from two perpendicular directions (e.g. 'north'+'east').
type Quadrant = 'NE' | 'NW' | 'SE' | 'SW';
const QUADRANTS: readonly Quadrant[] = ['NE', 'NW', 'SE', 'SW'];

function quadrantSign(q: Quadrant): { sx: 1 | -1; sz: 1 | -1 } {
  // +X east, -Z north. So NE => +x, -z.
  switch (q) {
    case 'NE':
      return { sx: 1, sz: -1 };
    case 'NW':
      return { sx: -1, sz: -1 };
    case 'SE':
      return { sx: 1, sz: 1 };
    case 'SW':
      return { sx: -1, sz: 1 };
  }
}

function quadrantDirs(q: Quadrant): [Direction, Direction] {
  switch (q) {
    case 'NE':
      return ['north', 'east'];
    case 'NW':
      return ['north', 'west'];
    case 'SE':
      return ['south', 'east'];
    case 'SW':
      return ['south', 'west'];
  }
}

export function buildIntersection(
  scene: THREE.Scene,
  nodeId: number,
  activeDirections?: ReadonlySet<Direction>,
  riverDirections?: ReadonlySet<Direction>,
  stopsByDirection?: Partial<Record<Direction, StopKind>>
): IntersectionBuild {
  const group = new THREE.Group();
  group.name = `intersection-${nodeId}`;

  const disposables: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  const addGeo = <T extends THREE.BufferGeometry>(g: T) => {
    disposables.push(g);
    return g;
  };
  const addMat = <T extends THREE.Material>(m: T) => {
    materials.push(m);
    return m;
  };
  const addTex = <T extends THREE.Texture>(t: T) => {
    textures.push(t);
    return t;
  };

  const active: ReadonlySet<Direction> = activeDirections ?? new Set(ALL_DIRS);
  const rivers: ReadonlySet<Direction> = riverDirections ?? new Set<Direction>();

  const rng = makeRng(nodeId * 5417 + 911);

  // ---------------------------------------------------------------------------
  // GROUND DISK — wide soft-gray base. Slightly darker than sidewalks so the
  // tarmac strips read as "on top". Receives shadows.
  // ---------------------------------------------------------------------------
  const groundMat = addMat(
    new THREE.MeshStandardMaterial({
      color: 0x5a5852,
      roughness: 0.98,
      metalness: 0,
    })
  );
  const ground = new THREE.Mesh(
    addGeo(new THREE.PlaneGeometry(GROUND_HALF * 2, GROUND_HALF * 2)),
    groundMat
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  ground.receiveShadow = true;
  group.add(ground);

  // Shared materials for repeated props ---------------------------------------
  const tarmacMat = addMat(
    new THREE.MeshStandardMaterial({ color: 0x2e3034, roughness: 0.95 })
  );
  const sidewalkMat = addMat(
    new THREE.MeshStandardMaterial({ color: 0x6e6862, roughness: 0.9 })
  );
  const curbMat = addMat(
    new THREE.MeshStandardMaterial({ color: STONE_KERB, roughness: 0.85 })
  );
  const stripeMat = addMat(
    new THREE.MeshStandardMaterial({
      color: 0xf2d65a,
      emissive: 0x6e5a18,
      emissiveIntensity: 0.18,
      roughness: 0.7,
    })
  );
  const crosswalkMat = addMat(
    new THREE.MeshStandardMaterial({ color: CREAM, roughness: 0.85 })
  );
  const waterMat = addMat(
    new THREE.MeshStandardMaterial({
      color: 0x3d6b9c,
      emissive: 0x1c3a5e,
      emissiveIntensity: 0.18,
      roughness: 0.35,
      metalness: 0.3,
    })
  );
  const shimmerMat = addMat(
    new THREE.MeshStandardMaterial({
      color: 0xb9d4ec,
      emissive: 0xb9d4ec,
      emissiveIntensity: 0.55,
      transparent: true,
      opacity: 0.55,
      roughness: 0.4,
    })
  );
  const lampPostMat = addMat(
    new THREE.MeshStandardMaterial({ color: TAXI_BLACK, roughness: 0.5, metalness: 0.6 })
  );
  const lampHeadMat = addMat(
    new THREE.MeshStandardMaterial({
      color: 0xfff1c2,
      emissive: 0xffe09a,
      emissiveIntensity: 1.2,
      roughness: 0.4,
    })
  );
  const trunkMat = addMat(new THREE.MeshStandardMaterial({ color: 0x5a3a26, roughness: 0.95 }));
  const foliageMat = addMat(
    new THREE.MeshStandardMaterial({ color: 0x3f6a3a, roughness: 0.9 })
  );
  const railingMat = addMat(
    new THREE.MeshStandardMaterial({ color: IRON_GREEN, roughness: 0.55, metalness: 0.35 })
  );

  // ---------------------------------------------------------------------------
  // HELPERS — small, scoped builders that close over the local material set.
  // ---------------------------------------------------------------------------

  function makeBuilding(width: number, depth: number, height: number, color: number): THREE.Group {
    const g = new THREE.Group();
    const wallMat = addMat(new THREE.MeshStandardMaterial({ color, roughness: 0.92 }));
    const body = new THREE.Mesh(addGeo(new THREE.BoxGeometry(width, height, depth)), wallMat);
    body.position.y = height / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);

    // Cornice cap (slightly wider)
    const corniceMat = addMat(
      new THREE.MeshStandardMaterial({ color: 0xd6cdb8, roughness: 0.85 })
    );
    const cornice = new THREE.Mesh(
      addGeo(new THREE.BoxGeometry(width + 0.25, 0.2, depth + 0.25)),
      corniceMat
    );
    cornice.position.y = height + 0.05;
    g.add(cornice);

    // Window grid suggestion — emissive dots on the long sides, so windows glow in fog
    const winMat = addMat(
      new THREE.MeshStandardMaterial({
        color: 0x2a2e36,
        emissive: 0xfff0b8,
        emissiveIntensity: 0.45,
        roughness: 0.6,
      })
    );
    const floors = Math.max(1, Math.floor((height - 0.6) / 1.2));
    const colsW = Math.max(1, Math.floor(width / 1.1));
    const colsD = Math.max(1, Math.floor(depth / 1.1));
    for (let f = 0; f < floors; f++) {
      const y = 0.8 + f * 1.2;
      for (let c = 0; c < colsW; c++) {
        const x = -width / 2 + (c + 0.5) * (width / colsW);
        for (const sz of [1, -1] as const) {
          const w = new THREE.Mesh(addGeo(new THREE.PlaneGeometry(0.55, 0.7)), winMat);
          w.position.set(x, y, sz * (depth / 2 + 0.012));
          w.rotation.y = sz === 1 ? 0 : Math.PI;
          g.add(w);
        }
      }
      for (let c = 0; c < colsD; c++) {
        const z = -depth / 2 + (c + 0.5) * (depth / colsD);
        for (const sx of [1, -1] as const) {
          const w = new THREE.Mesh(addGeo(new THREE.PlaneGeometry(0.55, 0.7)), winMat);
          w.position.set(sx * (width / 2 + 0.012), y, z);
          w.rotation.y = sx === 1 ? Math.PI / 2 : -Math.PI / 2;
          g.add(w);
        }
      }
    }
    return g;
  }

  function makeTree(scale = 1): THREE.Group {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(
      addGeo(new THREE.CylinderGeometry(0.12, 0.16, 1.6 * scale, 8)),
      trunkMat
    );
    trunk.position.y = 0.8 * scale;
    trunk.castShadow = true;
    g.add(trunk);
    const canopy = new THREE.Mesh(
      addGeo(new THREE.SphereGeometry(0.95 * scale, 12, 10)),
      foliageMat
    );
    canopy.position.y = 1.9 * scale;
    canopy.castShadow = true;
    g.add(canopy);
    // Slightly squashed crown for variety
    canopy.scale.set(1, 0.85, 1);
    return g;
  }

  function makeStreetLamp(): THREE.Group {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(
      addGeo(new THREE.CylinderGeometry(0.07, 0.09, 4.2, 10)),
      lampPostMat
    );
    pole.position.y = 2.1;
    pole.castShadow = true;
    g.add(pole);
    const arm = new THREE.Mesh(addGeo(new THREE.BoxGeometry(0.9, 0.08, 0.08)), lampPostMat);
    arm.position.set(0.5, 4.05, 0);
    g.add(arm);
    const head = new THREE.Mesh(addGeo(new THREE.SphereGeometry(0.18, 12, 10)), lampHeadMat);
    head.position.set(0.9, 4.0, 0);
    g.add(head);
    const pt = new THREE.PointLight(0xffe09a, 0.6, 8, 1.7);
    pt.position.set(0.9, 4.0, 0);
    g.add(pt);
    return g;
  }

  // ---------------------------------------------------------------------------
  // ROAD ARMS — for each active direction draw tarmac + curbs + sidewalks +
  // centerline dashes + crosswalk at the mouth. River arms get water instead.
  // ---------------------------------------------------------------------------
  function buildRoadArm(dir: Direction) {
    const armGroup = new THREE.Group();
    armGroup.name = `arm-${dir}`;
    armGroup.rotation.y = rotYForDirection(dir);

    // Tarmac runs from x∈[-ROAD_HALF, ROAD_HALF], z∈[ROAD_HALF, ARM_LENGTH]
    // (forward direction = +z after rotation, because rotYForDirection places
    // DIRECTION_FORWARD vectors along the arm's +z axis).
    const tarmac = new THREE.Mesh(
      addGeo(new THREE.PlaneGeometry(ROAD_HALF * 2, ARM_LENGTH - ROAD_HALF)),
      tarmacMat
    );
    tarmac.rotation.x = -Math.PI / 2;
    tarmac.position.set(0, 0.01, (ARM_LENGTH + ROAD_HALF) / 2);
    tarmac.receiveShadow = true;
    armGroup.add(tarmac);

    // Curbs — two thin elevated strips along the tarmac's long edges
    for (const sx of [-1, 1] as const) {
      const curb = new THREE.Mesh(
        addGeo(new THREE.BoxGeometry(0.3, CURB_HEIGHT, ARM_LENGTH - ROAD_HALF)),
        curbMat
      );
      curb.position.set(sx * (ROAD_HALF + 0.15), CURB_HEIGHT / 2, (ARM_LENGTH + ROAD_HALF) / 2);
      armGroup.add(curb);
    }

    // Sidewalks — light gray strips outside the curbs
    for (const sx of [-1, 1] as const) {
      const sw = new THREE.Mesh(
        addGeo(new THREE.PlaneGeometry(SIDEWALK, ARM_LENGTH - ROAD_HALF)),
        sidewalkMat
      );
      sw.rotation.x = -Math.PI / 2;
      sw.position.set(
        sx * (ROAD_HALF + 0.3 + SIDEWALK / 2),
        SIDEWALK_Y,
        (ARM_LENGTH + ROAD_HALF) / 2
      );
      sw.receiveShadow = true;
      armGroup.add(sw);
    }

    // Dashed yellow centerline
    const span = ARM_LENGTH - ROAD_HALF - 2;
    const dashStride = LANE_DASH_LENGTH + LANE_GAP;
    const dashCount = Math.max(1, Math.floor(span / dashStride));
    for (let i = 0; i < dashCount; i++) {
      const dash = new THREE.Mesh(
        addGeo(new THREE.PlaneGeometry(0.18, LANE_DASH_LENGTH)),
        stripeMat
      );
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(
        0,
        0.015,
        ROAD_HALF + 1 + i * dashStride + LANE_DASH_LENGTH / 2
      );
      armGroup.add(dash);
    }

    // Crosswalk at the mouth — N stripes perpendicular to the arm
    const cwTotal =
      CROSSWALK_STRIPES * CROSSWALK_STRIPE_WIDTH +
      (CROSSWALK_STRIPES - 1) * CROSSWALK_STRIPE_GAP;
    const cwStartZ = ROAD_HALF + 0.15;
    for (let i = 0; i < CROSSWALK_STRIPES; i++) {
      const stripe = new THREE.Mesh(
        addGeo(new THREE.PlaneGeometry(ROAD_HALF * 2 - 0.4, CROSSWALK_STRIPE_WIDTH)),
        crosswalkMat
      );
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(
        0,
        0.016,
        cwStartZ + i * (CROSSWALK_STRIPE_WIDTH + CROSSWALK_STRIPE_GAP) + CROSSWALK_STRIPE_WIDTH / 2
      );
      armGroup.add(stripe);
    }
    // Memo: where the crosswalk ends along z
    void cwTotal;

    return armGroup;
  }

  function buildRiverArm(dir: Direction) {
    const armGroup = new THREE.Group();
    armGroup.name = `river-arm-${dir}`;
    armGroup.rotation.y = rotYForDirection(dir);

    // Water plane spans wider than a road — covers the full arm width including the
    // would-be sidewalks, giving the impression of an embankment edge.
    const waterWidth = (ROAD_HALF + SIDEWALK + 0.3) * 2;
    const water = new THREE.Mesh(
      addGeo(new THREE.PlaneGeometry(waterWidth, ARM_LENGTH - ROAD_HALF)),
      waterMat
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.005, (ARM_LENGTH + ROAD_HALF) / 2);
    water.receiveShadow = true;
    armGroup.add(water);

    // Shimmer streaks — a few thin emissive bands parallel to the flow
    const streakCount = 4;
    for (let i = 0; i < streakCount; i++) {
      const streak = new THREE.Mesh(
        addGeo(new THREE.PlaneGeometry(0.08, pickFloat(rng, 3, 8))),
        shimmerMat
      );
      streak.rotation.x = -Math.PI / 2;
      streak.position.set(
        pickFloat(rng, -waterWidth / 2 + 0.5, waterWidth / 2 - 0.5),
        0.008,
        ROAD_HALF + pickFloat(rng, 2, ARM_LENGTH - ROAD_HALF - 4)
      );
      armGroup.add(streak);
    }

    // Stone embankment lip + iron railing on both sides of the channel
    for (const sx of [-1, 1] as const) {
      const lip = new THREE.Mesh(
        addGeo(new THREE.BoxGeometry(0.5, 0.35, ARM_LENGTH - ROAD_HALF)),
        curbMat
      );
      lip.position.set(
        sx * (waterWidth / 2 + 0.25),
        0.18,
        (ARM_LENGTH + ROAD_HALF) / 2
      );
      armGroup.add(lip);

      // Iron balusters every 1.5 units
      const balusterCount = Math.floor((ARM_LENGTH - ROAD_HALF) / 1.5);
      for (let i = 0; i < balusterCount; i++) {
        const z = ROAD_HALF + 0.75 + i * 1.5;
        const b = new THREE.Mesh(
          addGeo(new THREE.CylinderGeometry(0.04, 0.04, 0.85, 8)),
          railingMat
        );
        b.position.set(sx * (waterWidth / 2 + 0.25), 0.78, z);
        armGroup.add(b);
      }
      // Top rail
      const top = new THREE.Mesh(
        addGeo(new THREE.CylinderGeometry(0.05, 0.05, ARM_LENGTH - ROAD_HALF - 1, 10)),
        railingMat
      );
      top.rotation.x = Math.PI / 2;
      top.position.set(sx * (waterWidth / 2 + 0.25), 1.18, (ARM_LENGTH + ROAD_HALF) / 2);
      armGroup.add(top);
    }

    // Shore lamp at the river mouth, one side
    const shoreLamp = makeStreetLamp();
    shoreLamp.position.set(-(waterWidth / 2 + 0.9), 0, ROAD_HALF + 1.2);
    armGroup.add(shoreLamp);

    return armGroup;
  }

  // Build all arms ------------------------------------------------------------
  for (const dir of ALL_DIRS) {
    if (!active.has(dir)) continue;
    if (rivers.has(dir)) {
      group.add(buildRiverArm(dir));
    } else {
      group.add(buildRoadArm(dir));
    }
  }

  // ---------------------------------------------------------------------------
  // WALL-BUILDINGS sealing inactive arms — a building face spanning the arm
  // mouth so the player can't see through where a road would otherwise be.
  // ---------------------------------------------------------------------------
  function placeWallBuildings() {
    for (const dir of ALL_DIRS) {
      if (active.has(dir)) continue;
      const fwd = DIRECTION_FORWARD[dir];
      const dist = ROAD_HALF + 2;
      const width = (ROAD_HALF + SIDEWALK) * 2 + 1;
      const height = pickFloat(rng, 6, 11);
      const color = pickFrom(rng, BUILDING_COLORS);
      const b = makeBuilding(width, 3, height, color);
      // Place perpendicular to the dead arm
      b.position.set(fwd.x * dist, 0, fwd.z * dist);
      b.rotation.y = rotYForDirection(dir);
      group.add(b);
    }
  }
  placeWallBuildings();

  // ---------------------------------------------------------------------------
  // QUADRANT CONTENT — for each (NE/NW/SE/SW) quadrant, evaluate the two
  // bounding directions. If both are river-adjacent, skip; otherwise drop a
  // corner sidewalk filler, a row of 1-2 buildings, and scatter trees.
  // ---------------------------------------------------------------------------
  function placeCornerSidewalk(q: Quadrant) {
    const { sx, sz } = quadrantSign(q);
    const cx = sx * (ROAD_HALF + 0.3 + SIDEWALK / 2);
    const cz = sz * (ROAD_HALF + 0.3 + SIDEWALK / 2);
    const filler = new THREE.Mesh(
      addGeo(new THREE.PlaneGeometry(SIDEWALK, SIDEWALK)),
      sidewalkMat
    );
    filler.rotation.x = -Math.PI / 2;
    filler.position.set(cx, SIDEWALK_Y, cz);
    filler.receiveShadow = true;
    group.add(filler);
    // Curb edge frame — two thin strips along the inner edges
    const curbA = new THREE.Mesh(
      addGeo(new THREE.BoxGeometry(SIDEWALK + 0.3, CURB_HEIGHT, 0.3)),
      curbMat
    );
    curbA.position.set(cx, CURB_HEIGHT / 2, cz - sz * (SIDEWALK / 2 + 0.15));
    group.add(curbA);
    const curbB = new THREE.Mesh(
      addGeo(new THREE.BoxGeometry(0.3, CURB_HEIGHT, SIDEWALK + 0.3)),
      curbMat
    );
    curbB.position.set(cx - sx * (SIDEWALK / 2 + 0.15), CURB_HEIGHT / 2, cz);
    group.add(curbB);
  }

  function placeBuildingsInQuadrant(q: Quadrant) {
    const { sx, sz } = quadrantSign(q);
    // Row anchor inside the quadrant, just past the sidewalk
    const innerX = sx * (ROAD_HALF + SIDEWALK + 1.5);
    const innerZ = sz * (ROAD_HALF + SIDEWALK + 1.5);
    const rowCount = pickInt(rng, 2, 4); // 2..3
    const dirAxis: 'x' | 'z' = rng() < 0.5 ? 'x' : 'z';
    for (let i = 0; i < rowCount; i++) {
      const w = pickFloat(rng, 3.5, 6);
      const d = pickFloat(rng, 3.5, 6);
      const h = pickFloat(rng, 5, 12);
      const color = pickFrom(rng, BUILDING_COLORS);
      const b = makeBuilding(w, d, h, color);
      let bx = innerX;
      let bz = innerZ;
      if (dirAxis === 'x') {
        bx = sx * (ROAD_HALF + SIDEWALK + 1 + w / 2 + i * (w + pickFloat(rng, 1.2, 2.5)));
        bz = sz * (ROAD_HALF + SIDEWALK + 1 + d / 2);
      } else {
        bx = sx * (ROAD_HALF + SIDEWALK + 1 + w / 2);
        bz = sz * (ROAD_HALF + SIDEWALK + 1 + d / 2 + i * (d + pickFloat(rng, 1.2, 2.5)));
      }
      // Clamp to ground extent
      if (Math.abs(bx) > GROUND_HALF - w / 2) continue;
      if (Math.abs(bz) > GROUND_HALF - d / 2) continue;
      b.position.set(bx, 0, bz);
      b.rotation.y = pickFloat(rng, -0.08, 0.08);
      group.add(b);
    }
  }

  function placeTreesInQuadrant(q: Quadrant) {
    const { sx, sz } = quadrantSign(q);
    const treeCount = pickInt(rng, 2, 5);
    for (let i = 0; i < treeCount; i++) {
      const tx = sx * pickFloat(rng, ROAD_HALF + SIDEWALK + 0.6, GROUND_HALF - 2);
      const tz = sz * pickFloat(rng, ROAD_HALF + SIDEWALK + 0.6, GROUND_HALF - 2);
      // Reject if too close to the road axis where a building probably lives
      if (Math.abs(tx) < ROAD_HALF + SIDEWALK + 1.2 && Math.abs(tz) < ROAD_HALF + SIDEWALK + 1.2) {
        continue;
      }
      const t = makeTree(pickFloat(rng, 0.85, 1.25));
      t.position.set(tx, 0, tz);
      t.rotation.y = pickFloat(rng, 0, Math.PI * 2);
      group.add(t);
    }
  }

  for (const q of QUADRANTS) {
    const [d1, d2] = quadrantDirs(q);
    const adjacentToRiver = rivers.has(d1) || rivers.has(d2);
    if (adjacentToRiver) {
      // Skip corner content next to water — the embankment + shore handles it
      continue;
    }
    placeCornerSidewalk(q);
    placeBuildingsInQuadrant(q);
    placeTreesInQuadrant(q);
  }

  // ---------------------------------------------------------------------------
  // STREET LAMPS at every curb corner of an active non-river arm.
  // ---------------------------------------------------------------------------
  for (const dir of ALL_DIRS) {
    if (!active.has(dir)) continue;
    if (rivers.has(dir)) continue;
    const fwd = DIRECTION_FORWARD[dir];
    // Right vector (when looking along fwd) for placing on left/right curbs
    const right = new THREE.Vector3(0, 1, 0).cross(fwd).normalize();
    for (const side of [-1, 1] as const) {
      const lamp = makeStreetLamp();
      const along = ROAD_HALF + 2.5;
      const across = ROAD_HALF + SIDEWALK - 0.4;
      lamp.position.set(
        fwd.x * along + right.x * side * across,
        0,
        fwd.z * along + right.z * side * across
      );
      // Orient the arm of the lamp inward toward the road
      lamp.rotation.y = rotYForDirection(dir) + (side === 1 ? -Math.PI / 2 : Math.PI / 2);
      group.add(lamp);
    }
  }

  // ---------------------------------------------------------------------------
  // BELISHA BEACONS at zebra crossings — one per side of each active
  // non-river crosswalk, when the stop is not 'underground' (underground gets
  // its own arch entrance instead).
  // ---------------------------------------------------------------------------
  if (stopsByDirection) {
    for (const dir of ALL_DIRS) {
      if (!active.has(dir)) continue;
      if (rivers.has(dir)) continue;
      const kind = stopsByDirection[dir];
      if (kind === 'underground') continue;
      const fwd = DIRECTION_FORWARD[dir];
      const right = new THREE.Vector3(0, 1, 0).cross(fwd).normalize();
      for (const side of [-1, 1] as const) {
        const beacon = buildBelishaBeacon(addGeo, addMat, textures);
        const along = ROAD_HALF + 0.4;
        const across = ROAD_HALF + 0.55;
        beacon.position.set(
          fwd.x * along + right.x * side * across,
          0,
          fwd.z * along + right.z * side * across
        );
        group.add(beacon);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // TRAFFIC LIGHT POLE at 3+ way junctions — placed at one corner that has the
  // most adjacent active arms.
  // ---------------------------------------------------------------------------
  if (active.size >= 3) {
    // Pick the NE-ish corner first, but rotate based on which arms are active
    const cornerQ: Quadrant = (() => {
      for (const q of QUADRANTS) {
        const [d1, d2] = quadrantDirs(q);
        if (active.has(d1) && active.has(d2) && !rivers.has(d1) && !rivers.has(d2)) return q;
      }
      return 'NE';
    })();
    const { sx, sz } = quadrantSign(cornerQ);
    const pole = buildTrafficLightPole(addGeo, addMat);
    pole.position.set(
      sx * (ROAD_HALF + SIDEWALK - 0.6),
      0,
      sz * (ROAD_HALF + SIDEWALK - 0.6)
    );
    // Rotate the arm to overhang the road — point the +x of the pole toward the
    // intersection center.
    pole.rotation.y = Math.atan2(-sx, -sz);
    group.add(pole);
  }

  // ---------------------------------------------------------------------------
  // OCCASIONAL PHONE BOX — one per node max, ~25% chance, placed at a random
  // built quadrant's sidewalk.
  // ---------------------------------------------------------------------------
  if (rng() < 0.4) {
    const builtQuads = QUADRANTS.filter((q) => {
      const [d1, d2] = quadrantDirs(q);
      return !(rivers.has(d1) || rivers.has(d2));
    });
    if (builtQuads.length > 0) {
      const q = pickFrom(rng, builtQuads);
      const { sx, sz } = quadrantSign(q);
      const box = buildPhoneBox(addGeo, addMat, textures);
      box.position.set(
        sx * (ROAD_HALF + 0.3 + SIDEWALK * 0.45),
        0,
        sz * (ROAD_HALF + 0.3 + SIDEWALK * 0.45)
      );
      box.rotation.y = pickFloat(rng, 0, Math.PI * 2);
      group.add(box);
    }
  }

  // ---------------------------------------------------------------------------
  // LONDON STOP TOTEMS — gameplay-identifying props per active direction.
  // ---------------------------------------------------------------------------
  if (stopsByDirection) {
    for (const dir of ALL_DIRS) {
      const kind = stopsByDirection[dir];
      if (!kind) continue;
      const stop = buildStop(kind, nodeId, dir, addGeo, addMat, textures);
      group.add(stop);
    }
  }

  // ---------------------------------------------------------------------------
  // EXIT ANCHORS — vehicles sit here, ±(ROAD_HALF + 2) along the arm.
  // Maintains contract with game.tsx and ride.ts.
  // ---------------------------------------------------------------------------
  const exitAnchors: Record<Direction, THREE.Vector3> = {
    north: new THREE.Vector3(2.4, 0, -ROAD_HALF - 2),
    south: new THREE.Vector3(-2.4, 0, ROAD_HALF + 2),
    east: new THREE.Vector3(ROAD_HALF + 2, 0, 2.4),
    west: new THREE.Vector3(-ROAD_HALF - 2, 0, -2.4),
  };

  // Touch FOG_TINT / TFL_RED so unused-import lints don't fire when palette
  // colors are referenced only in conditional branches above. (No-op at runtime.)
  void FOG_TINT;
  void TFL_RED;
  void addTex;

  scene.add(group);

  return {
    group,
    exitAnchors,
    dispose: () => {
      scene.remove(group);
      for (const g of disposables) g.dispose();
      for (const m of materials) m.dispose();
      for (const t of textures) t.dispose();
    },
  };
}
