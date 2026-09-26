import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeRoundelTexture, makeTextTexture } from './canvas-textures';
import { TFL_BLUE, TFL_RED } from './palette';

export type VehicleKind = 'taxi' | 'bus' | 'underground' | 'river';

export interface VehicleHandle {
  group: THREE.Group;
  kind: VehicleKind;
  targetNodeId: number;
  hitMesh: THREE.Mesh;
  setHover: (hover: boolean) => void;
  /** Camera Y offset relative to the vehicle origin when "riding". */
  rideOffsetY: number;
  /** Forward direction in the vehicle's LOCAL frame (apply quaternion to get world dir). */
  rideForwardLocal: THREE.Vector3;
}

const TAXI_BODY = 0xf6c945;
const TAXI_DARK = 0x7a5e0e;
const BUS_BODY = 0xc02f2f;
const BUS_TRIM = 0xefe7d8;
const GLASS = 0x2a3446;
const RUBBER = 0x171719;
const CHROME = 0xb9bcc2;
const GUNMETAL = 0x2b2d31;
const LAMP_WARM = 0xfff0c4;
const LAMP_RED = 0xff2a1a;

// Hover reads as "lit from inside": a soft tint on the body (kept under the bloom
// threshold) while lamps and signs get brighter and are the only parts that bloom.
const HOVER_TINT_INTENSITY = 0.28;
const HOVER_GLOW_BOOST = 1.5;

type Mat = THREE.MeshStandardMaterial;

function mat(color: number, roughness = 0.6, metalness = 0): Mat {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

// The street's scene.environmentIntensity is kept low so sunlit diffuse doesn't wash out;
// vehicles bind the environment directly so paint, glass and chrome get full reflections.
let vehicleEnv: THREE.Texture | null = null;
const ENV_INTENSITY_KEY = 'vehicleEnvIntensity';

function reflective<T extends Mat>(m: T, intensity: number): T {
  m.userData[ENV_INTENSITY_KEY] = intensity;
  if (vehicleEnv) {
    m.envMap = vehicleEnv;
    m.envMapIntensity = intensity;
  }
  return m;
}

/** Binds the reflection map to every vehicle material, current and future. */
export function setVehicleEnvironment(env: THREE.Texture, scene: THREE.Object3D) {
  vehicleEnv = env;
  scene.traverse((obj) => {
    const mats = (obj as THREE.Mesh).material;
    for (const m of Array.isArray(mats) ? mats : mats ? [mats] : []) {
      const intensity = m.userData[ENV_INTENSITY_KEY];
      if (typeof intensity !== 'number' || !(m instanceof THREE.MeshStandardMaterial)) continue;
      m.envMap = env;
      m.envMapIntensity = intensity;
      m.needsUpdate = true;
    }
  });
}

function paintMat(color: number, metalness: number): THREE.MeshPhysicalMaterial {
  return reflective(
    new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.38,
      metalness,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
    }),
    0.75
  );
}

function glassMat(): Mat {
  return reflective(
    new THREE.MeshPhysicalMaterial({
      color: GLASS,
      roughness: 0.04,
      metalness: 0.1,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
    }),
    1.6
  );
}

function chromeMat(color = CHROME): Mat {
  return reflective(mat(color, 0.14, 1), 1.3);
}

function lampMat(color: number, intensity: number, base = 0xfff8e6): Mat {
  return new THREE.MeshStandardMaterial({ color: base, emissive: color, emissiveIntensity: intensity });
}

function rbox(w: number, h: number, d: number, radius: number): RoundedBoxGeometry {
  return new RoundedBoxGeometry(w, h, d, 3, radius);
}

/** Extrudes a side profile (shape x = vehicle +Z forward, shape y = height) across the
 *  vehicle's width, centred on X, with every edge rounded by `bevel`. */
function profileBody(shape: THREE.Shape, width: number, bevel: number): THREE.BufferGeometry {
  const depth = width - bevel * 2;
  const extruded = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    // Keeps the side walls on the profile outline so the drawn coordinates are exact.
    bevelOffset: -bevel,
    bevelSegments: 5,
    curveSegments: 14,
  });
  extruded.rotateY(-Math.PI / 2);
  extruded.translate(depth / 2, 0, 0);
  // Welding caps to walls gives smooth normals across the bevels instead of facets.
  extruded.deleteAttribute('uv');
  extruded.deleteAttribute('normal');
  const smooth = mergeVertices(extruded, 1e-4);
  extruded.dispose();
  smooth.computeVertexNormals();
  return smooth;
}

/** Cuts a semicircular wheel arch into a profile's bottom edge while tracing it front-ward. */
function archNotch(shape: THREE.Shape, z: number, centerY: number, radius: number, bottomY: number) {
  shape.lineTo(z - radius, bottomY);
  if (bottomY !== centerY) shape.lineTo(z - radius, centerY);
  shape.absarc(z, centerY, radius, Math.PI, 0, true);
  if (bottomY !== centerY) shape.lineTo(z + radius, bottomY);
}

function shadowed<T extends THREE.Mesh>(m: T, receive = false): T {
  m.castShadow = true;
  m.receiveShadow = receive;
  return m;
}

// Textures are shared across every rebuild; vehicles are rebuilt each turn and their
// material.dispose() does not release maps.
const textureCache = new Map<string, THREE.Texture>();
function cachedTexture(key: string, make: () => THREE.Texture): THREE.Texture {
  const hit = textureCache.get(key);
  if (hit) return hit;
  const tex = make();
  textureCache.set(key, tex);
  return tex;
}

function hex(c: number): string {
  return `#${c.toString(16).padStart(6, '0')}`;
}

function addWheel(
  parent: THREE.Object3D,
  x: number,
  z: number,
  radius: number,
  width: number,
  tyre: Mat,
  hub: Mat
) {
  const w = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 20), tyre);
  w.rotation.z = Math.PI / 2;
  w.position.set(x, radius, z);
  w.castShadow = true;
  parent.add(w);
  const h = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.55, radius * 0.55, width + 0.02, 14), hub);
  h.rotation.z = Math.PI / 2;
  h.position.set(x, radius, z);
  parent.add(h);
}

function addPane(parent: THREE.Object3D, w: number, h: number, pos: THREE.Vector3, rotY: number, glass: Mat, tiltX = 0) {
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glass);
  p.position.copy(pos);
  p.rotation.set(tiltX, rotY, 0, 'YXZ');
  parent.add(p);
  return p;
}

// ---------------------------------------------------------------------------
// TAXI — a yellow cab with a London silhouette: long bonnet, upright cabin, lit roof sign.
// ---------------------------------------------------------------------------
export function createTaxi(targetNodeId: number): VehicleHandle {
  const group = new THREE.Group();
  group.name = `taxi-${targetNodeId}`;

  const bodyMat = paintMat(TAXI_BODY, 0.15);
  const darkMat = mat(TAXI_DARK, 0.6);
  const glass = glassMat();
  const trimMat = mat(GUNMETAL, 0.5, 0.4);
  const chrome = chromeMat();
  const tyreMat = mat(RUBBER, 0.95);

  const WHEEL_R = 0.4;
  const WHEEL_Z = [1.5, -1.45];

  const bodyShape = new THREE.Shape();
  bodyShape.moveTo(-2.05, WHEEL_R);
  archNotch(bodyShape, WHEEL_Z[1], WHEEL_R, 0.47, WHEEL_R);
  archNotch(bodyShape, WHEEL_Z[0], WHEEL_R, 0.47, WHEEL_R);
  bodyShape.lineTo(2.05, WHEEL_R);
  bodyShape.quadraticCurveTo(2.25, WHEEL_R, 2.25, 0.58);
  bodyShape.lineTo(2.25, 0.82);
  bodyShape.quadraticCurveTo(2.24, 1.04, 1.95, 1.06);
  bodyShape.lineTo(0.95, 1.12);
  bodyShape.lineTo(-1.85, 1.12);
  bodyShape.quadraticCurveTo(-2.22, 1.12, -2.22, 0.9);
  bodyShape.lineTo(-2.22, 0.6);
  bodyShape.quadraticCurveTo(-2.22, WHEEL_R, -2.05, WHEEL_R);
  group.add(shadowed(new THREE.Mesh(profileBody(bodyShape, 1.9, 0.1), bodyMat), true));

  const cabinShape = new THREE.Shape();
  cabinShape.moveTo(-1.9, 1.0);
  cabinShape.lineTo(1.0, 1.0);
  cabinShape.lineTo(0.92, 1.1);
  cabinShape.lineTo(0.52, 1.66);
  cabinShape.quadraticCurveTo(0.42, 1.76, 0.2, 1.76);
  cabinShape.lineTo(-1.3, 1.76);
  cabinShape.quadraticCurveTo(-1.52, 1.76, -1.6, 1.62);
  cabinShape.lineTo(-1.88, 1.14);
  cabinShape.lineTo(-1.9, 1.0);
  group.add(shadowed(new THREE.Mesh(profileBody(cabinShape, 1.74, 0.12), bodyMat)));

  addPane(group, 1.45, 0.58, new THREE.Vector3(0, 1.387, 0.73), 0, glass, -0.62);
  addPane(group, 1.35, 0.46, new THREE.Vector3(0, 1.385, -1.75), Math.PI, glass, -0.53);
  for (const side of [-1, 1] as const) {
    const rotY = (side * Math.PI) / 2;
    addPane(group, 0.8, 0.44, new THREE.Vector3(side * 0.875, 1.36, 0.1), rotY, glass);
    addPane(group, 1.0, 0.44, new THREE.Vector3(side * 0.875, 1.36, -0.975), rotY, glass);
    const mirror = new THREE.Mesh(rbox(0.08, 0.14, 0.2, 0.03), trimMat);
    mirror.position.set(side * 0.98, 1.18, 0.8);
    group.add(mirror);
    for (const z of [0.35, -0.7]) {
      const handle = new THREE.Mesh(rbox(0.03, 0.05, 0.22, 0.012), chrome);
      handle.position.set(side * 0.955, 0.95, z);
      group.add(handle);
    }
  }

  for (const z of WHEEL_Z) {
    for (const x of [-0.8, 0.8]) addWheel(group, x, z, WHEEL_R, 0.3, tyreMat, chrome);
  }

  for (const z of [2.26, -2.26]) {
    const bumper = new THREE.Mesh(rbox(1.92, 0.16, 0.18, 0.06), trimMat);
    bumper.position.set(0, 0.5, z);
    group.add(bumper);
  }
  const grille = new THREE.Mesh(rbox(0.9, 0.24, 0.05, 0.02), trimMat);
  grille.position.set(0, 0.7, 2.26);
  group.add(grille);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.02), mat(0xf4efe2, 0.7));
  plate.position.set(0, 0.5, 2.36);
  group.add(plate);

  const headMat = lampMat(LAMP_WARM, 2.8);
  for (const x of [-0.68, 0.68]) {
    const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 14), headMat);
    hl.rotation.x = Math.PI / 2;
    hl.position.set(x, 0.8, 2.25);
    group.add(hl);
  }
  const tailMat = lampMat(LAMP_RED, 2.6, 0x3a0705);
  for (const x of [-0.72, 0.72]) {
    const tl = new THREE.Mesh(rbox(0.22, 0.12, 0.04, 0.015), tailMat);
    tl.position.set(x, 0.8, -2.23);
    group.add(tl);
  }

  const roofSignBase = new THREE.Mesh(rbox(0.92, 0.26, 0.42, 0.06), darkMat);
  roofSignBase.position.set(0, 1.85, -0.35);
  group.add(roofSignBase);
  const signTex = cachedTexture('taxi-roof-sign', () =>
    makeTextTexture('TAXI', { width: 256, height: 96, bg: '#ffd35c', fg: '#1a1a1c', fontPx: 66 })
  );
  const roofSignGlow = new THREE.MeshStandardMaterial({
    map: signTex,
    emissive: 0xffd88a,
    emissiveMap: signTex,
    emissiveIntensity: 2.6,
  });
  for (const flip of [0, Math.PI]) {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.2), roofSignGlow);
    face.position.set(0, 1.86, -0.35 + (flip === 0 ? 0.215 : -0.215));
    face.rotation.y = flip;
    group.add(face);
  }

  const hit = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.0, 4.8), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 1.0;
  hit.userData.vehicleRoot = group;
  group.add(hit);

  return makeHandle(group, hit, 'taxi', targetNodeId, {
    tint: [bodyMat],
    tintColor: 0xffb020,
    glow: [roofSignGlow, headMat],
  }, {
    rideOffsetY: 1.15,
    rideForwardLocal: new THREE.Vector3(0, 0, 1),
  });
}

// ---------------------------------------------------------------------------
// BUS — a Routemaster: rounded red decks, cream trim, individual window panes,
// lit destination blind and a TfL roundel on each flank.
// ---------------------------------------------------------------------------
export function createBus(targetNodeId: number): VehicleHandle {
  const group = new THREE.Group();
  group.name = `bus-${targetNodeId}`;

  const bodyMat = paintMat(BUS_BODY, 0.2);
  const trimMat = mat(BUS_TRIM, 0.7);
  const pillarMat = mat(0x8e1f1f, 0.6);
  const glass = glassMat();
  const darkMat = mat(GUNMETAL, 0.55, 0.4);
  const tyreMat = mat(RUBBER, 0.95);
  const hubMat = chromeMat(0xc9c2b4);

  const WHEEL_R = 0.52;
  const WHEEL_Z = [2.45, -2.35];
  const SILL = 0.3;

  const bodyShape = new THREE.Shape();
  bodyShape.moveTo(-3.6, SILL);
  archNotch(bodyShape, WHEEL_Z[1], WHEEL_R, 0.62, SILL);
  archNotch(bodyShape, WHEEL_Z[0], WHEEL_R, 0.62, SILL);
  bodyShape.lineTo(3.62, SILL);
  bodyShape.quadraticCurveTo(3.82, SILL, 3.82, 0.5);
  bodyShape.lineTo(3.82, 1.85);
  bodyShape.lineTo(3.62, 1.97);
  bodyShape.lineTo(3.55, 3.2);
  bodyShape.quadraticCurveTo(3.55, 3.45, 3.25, 3.45);
  bodyShape.lineTo(-3.4, 3.45);
  bodyShape.quadraticCurveTo(-3.8, 3.45, -3.8, 3.1);
  bodyShape.lineTo(-3.8, 0.5);
  bodyShape.quadraticCurveTo(-3.8, SILL, -3.6, SILL);
  group.add(shadowed(new THREE.Mesh(profileBody(bodyShape, 2.4, 0.18), bodyMat), true));

  const trim = new THREE.Mesh(rbox(2.44, 0.12, 7.66, 0.05), trimMat);
  trim.position.y = 1.83;
  group.add(trim);

  const lowerZ = [2.55, 1.5, 0.45, -0.6, -1.65];
  const upperZ = [2.75, 1.7, 0.65, -0.4, -1.45, -2.5];
  for (const side of [-1, 1] as const) {
    const rotY = (side * Math.PI) / 2;
    for (const z of lowerZ) {
      addPane(group, 0.86, 0.6, new THREE.Vector3(side * 1.205, 1.47, z), rotY, glass);
    }
    for (const z of upperZ) {
      addPane(group, 0.86, 0.74, new THREE.Vector3(side * 1.205, 2.72, z - 0.12), rotY, glass);
    }
    const roundelTex = cachedTexture('bus-roundel', () =>
      makeRoundelTexture({ ringColor: hex(BUS_TRIM), barColor: hex(BUS_TRIM), barText: 'BUS', size: 256 })
    );
    const roundel = new THREE.Mesh(
      new THREE.CircleGeometry(0.28, 32),
      new THREE.MeshStandardMaterial({ map: roundelTex, transparent: true, roughness: 0.6 })
    );
    roundel.position.set(side * 1.21, 0.78, -3.3);
    roundel.rotation.y = rotY;
    group.add(roundel);
  }
  for (const z of [2.03, 0.98, -0.07, -1.12]) {
    for (const side of [-1, 1] as const) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.6, 0.14), pillarMat);
      pillar.position.set(side * 1.215, 1.47, z);
      group.add(pillar);
    }
  }

  const UPPER_FRONT_TILT = -0.057;
  addPane(group, 2.0, 0.78, new THREE.Vector3(0, 1.28, 3.83), 0, glass);
  addPane(group, 0.98, 0.72, new THREE.Vector3(-0.56, 2.62, 3.593), 0, glass, UPPER_FRONT_TILT);
  addPane(group, 0.98, 0.72, new THREE.Vector3(0.56, 2.62, 3.593), 0, glass, UPPER_FRONT_TILT);
  addPane(group, 1.9, 0.72, new THREE.Vector3(0, 2.72, -3.81), Math.PI, glass);

  const platform = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.35, 0.06), mat(0x1a1114, 0.9));
  platform.position.set(0.62, 1.0, -3.83);
  group.add(platform);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.3, 8), trimMat);
  pole.position.set(0.2, 1.0, -3.86);
  group.add(pole);

  const blindTex = cachedTexture(`bus-blind-${targetNodeId}`, () =>
    makeTextTexture(`${targetNodeId}`, { width: 384, height: 112, bg: '#111318', fg: '#fff3c0', fontPx: 84 })
  );
  const blindMat = new THREE.MeshStandardMaterial({
    map: blindTex,
    emissive: 0xfff4b8,
    emissiveMap: blindTex,
    emissiveIntensity: 2.6,
  });
  const blindFrame = new THREE.Mesh(rbox(1.6, 0.3, 0.06, 0.02), darkMat);
  blindFrame.position.set(0, 3.13, 3.575);
  blindFrame.rotation.x = UPPER_FRONT_TILT;
  group.add(blindFrame);
  const blind = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.26), blindMat);
  blind.position.set(0, 3.13, 3.607);
  blind.rotation.x = UPPER_FRONT_TILT;
  group.add(blind);

  const grille = new THREE.Mesh(rbox(0.7, 0.55, 0.08, 0.04), darkMat);
  grille.position.set(0, 0.72, 3.84);
  group.add(grille);
  for (const z of [3.86, -3.85]) {
    const bumper = new THREE.Mesh(rbox(2.3, 0.14, 0.16, 0.04), darkMat);
    bumper.position.set(0, 0.42, z);
    group.add(bumper);
  }

  const headMat = lampMat(LAMP_WARM, 2.8);
  for (const x of [-0.82, 0.82]) {
    const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 14), headMat);
    hl.rotation.x = Math.PI / 2;
    hl.position.set(x, 0.72, 3.84);
    group.add(hl);
  }
  const tailMat = lampMat(LAMP_RED, 2.6, 0x3a0705);
  for (const x of [-0.95, 0.95]) {
    const tl = new THREE.Mesh(rbox(0.16, 0.26, 0.04, 0.015), tailMat);
    tl.position.set(x, 0.6, -3.82);
    group.add(tl);
  }

  for (const z of WHEEL_Z) {
    for (const x of [-1.0, 1.0]) addWheel(group, x, z, WHEEL_R, 0.38, tyreMat, hubMat);
  }

  const hit = new THREE.Mesh(new THREE.BoxGeometry(2.8, 3.7, 8.0), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 1.85;
  hit.userData.vehicleRoot = group;
  group.add(hit);

  return makeHandle(group, hit, 'bus', targetNodeId, {
    tint: [bodyMat],
    tintColor: 0xff5a4a,
    glow: [blindMat, headMat],
  }, {
    rideOffsetY: 1.7,
    rideForwardLocal: new THREE.Vector3(0, 0, 1),
  });
}

// ---------------------------------------------------------------------------
// UNDERGROUND — a station house set into the building line. Local +Z faces the road;
// the portal opens onto a tiled stairwell descending toward -Z into warm light.
// ---------------------------------------------------------------------------
/** Station house footprint; the origin is the middle of the front facade. */
export const STATION_FOOTPRINT = { width: 6.4, depth: 4.6 } as const;

export function createUnderground(targetNodeId: number): VehicleHandle {
  const group = new THREE.Group();
  group.name = `underground-${targetNodeId}`;

  const W = STATION_FOOTPRINT.width;
  const D = STATION_FOOTPRINT.depth;
  const H = 5.6;
  const OPEN_W = 2.8;
  const OPEN_H = 3.0;

  const facadeMat = mat(0xd9cfbc, 0.85);
  const tileMat = mat(0xe9e2d2, 0.55);
  const stoneMat = mat(0x8c857a, 0.95);
  const stepMat = mat(0x55514a, 1);
  const railMat = mat(GUNMETAL, 0.45, 0.6);
  const blueMat = mat(TFL_BLUE, 0.6);
  const ceilingMat = mat(0x2a2622, 0.95);
  const roofMat = mat(0x46464b, 0.95);

  const pierW = (W - OPEN_W) / 2;
  for (const sx of [-1, 1] as const) {
    const pier = shadowed(new THREE.Mesh(new THREE.BoxGeometry(pierW, OPEN_H, 0.5), facadeMat), true);
    pier.position.set(sx * (OPEN_W / 2 + pierW / 2), OPEN_H / 2, -0.25);
    group.add(pier);
    const sideWall = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.3, H, D), facadeMat), true);
    sideWall.position.set(sx * (W / 2 - 0.15), H / 2, -D / 2);
    group.add(sideWall);
    const innerWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.2, D - 0.6), tileMat);
    innerWall.position.set(sx * (OPEN_W / 2 + 0.1), 1.0, -D / 2 - 0.2);
    group.add(innerWall);
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 3.2, 10), railMat);
    rail.rotation.x = Math.PI / 2 - 0.34;
    rail.position.set(sx * (OPEN_W / 2 - 0.2), 0.55, -2.3);
    group.add(rail);
  }
  const lintel = shadowed(new THREE.Mesh(new THREE.BoxGeometry(W, H - OPEN_H, 0.5), facadeMat), true);
  lintel.position.set(0, OPEN_H + (H - OPEN_H) / 2, -0.25);
  group.add(lintel);
  const back = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.3), facadeMat);
  back.position.set(0, H / 2, -D + 0.15);
  group.add(back);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(W, 0.3, D), roofMat);
  roof.position.set(0, H + 0.15, -D / 2);
  group.add(roof);
  const cornice = new THREE.Mesh(rbox(W + 0.3, 0.25, D + 0.3, 0.05), mat(0xf1eadb, 0.8));
  cornice.position.set(0, H + 0.05, -D / 2);
  group.add(cornice);
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(OPEN_W, 0.1, D - 0.5), ceilingMat);
  ceiling.position.set(0, OPEN_H - 0.05, -D / 2 - 0.25);
  group.add(ceiling);

  const threshold = new THREE.Mesh(new THREE.BoxGeometry(OPEN_W + 1.2, 0.16, 1.6), stoneMat);
  threshold.position.set(0, 0.08, 0.4);
  threshold.receiveShadow = true;
  group.add(threshold);
  const landing = new THREE.Mesh(new THREE.BoxGeometry(OPEN_W, 0.16, 0.8), stoneMat);
  landing.position.set(0, 0.08, -0.4);
  group.add(landing);
  for (let i = 0; i < 7; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(OPEN_W - 0.1, 0.18, 0.45), stepMat);
    step.position.set(0, 0.0 - i * 0.2, -1.0 - i * 0.45);
    group.add(step);
  }

  const innerGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(OPEN_W, 2.2),
    new THREE.MeshStandardMaterial({ color: 0x1a140e, emissive: 0xffc27a, emissiveIntensity: 2.4 })
  );
  innerGlow.position.set(0, -0.2, -D + 0.35);
  group.add(innerGlow);
  const glowLight = new THREE.PointLight(0xffb56a, 8, 7, 1.8);
  glowLight.position.set(0, 1.2, -2.4);
  group.add(glowLight);

  const signTex = cachedTexture('underground-entry-sign', () =>
    makeTextTexture('UNDERGROUND', { width: 512, height: 128, bg: hex(TFL_BLUE), fg: '#ffffff', fontPx: 74 })
  );
  const signMat = new THREE.MeshStandardMaterial({
    map: signTex,
    emissive: 0xffffff,
    emissiveMap: signTex,
    emissiveIntensity: 1.5,
  });
  const signBox = new THREE.Mesh(new THREE.BoxGeometry(OPEN_W + 1.0, 0.7, 0.2), blueMat);
  signBox.position.set(0, OPEN_H + 0.75, 0.1);
  group.add(signBox);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(OPEN_W + 0.8, 0.56), signMat);
  face.position.set(0, OPEN_H + 0.75, 0.205);
  group.add(face);
  const redBand = new THREE.Mesh(new THREE.BoxGeometry(OPEN_W + 1.04, 0.08, 0.22), mat(TFL_RED, 0.6));
  redBand.position.set(0, OPEN_H + 0.35, 0.1);
  group.add(redBand);
  const canopy = shadowed(new THREE.Mesh(rbox(OPEN_W + 1.6, 0.12, 1.1, 0.04), railMat));
  canopy.position.set(0, OPEN_H + 0.1, 0.5);
  group.add(canopy);

  // Kerbside roundel, turned to face along the street so it reads from the junction.
  const totem = new THREE.Group();
  totem.position.set(W / 2 - 0.3, 0, 2.0);
  totem.rotation.y = Math.PI / 2;
  const pole = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.5, 12), mat(GUNMETAL, 0.5, 0.6)));
  pole.position.y = 1.75;
  totem.add(pole);
  const roundelTex = cachedTexture('underground-roundel', () =>
    makeRoundelTexture({ ringColor: hex(TFL_RED), barColor: hex(TFL_BLUE), barText: 'UNDERGROUND' })
  );
  const roundelMat = new THREE.MeshStandardMaterial({
    map: roundelTex,
    emissive: 0xffffff,
    emissiveMap: roundelTex,
    emissiveIntensity: 0.35,
    transparent: true,
  });
  const roundelGeo = new THREE.CircleGeometry(0.7, 48);
  for (const flip of [0, Math.PI]) {
    const roundel = new THREE.Mesh(roundelGeo, roundelMat);
    roundel.position.set(0, 3.7, flip === 0 ? 0.01 : -0.01);
    roundel.rotation.y = flip;
    totem.add(roundel);
  }
  group.add(totem);

  const hit = new THREE.Mesh(new THREE.BoxGeometry(W + 0.4, H + 0.6, D + 1.6), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(0, H / 2, -D / 2 + 0.6);
  hit.userData.vehicleRoot = group;
  group.add(hit);

  return makeHandle(group, hit, 'underground', targetNodeId, {
    tint: [facadeMat, blueMat],
    tintColor: 0x6fa8ff,
    glow: [signMat, innerGlow.material as Mat],
  }, {
    rideOffsetY: 0.4,
    // Stairs descend toward local -Z, so the ride forward direction in local space is -Z.
    rideForwardLocal: new THREE.Vector3(0, 0, -1),
  });
}

// ---------------------------------------------------------------------------
// RIVER — a Thames clipper: rounded hull, cream cabin with panes, deck rails, life rings.
// ---------------------------------------------------------------------------
export function createFerry(targetNodeId: number): VehicleHandle {
  const group = new THREE.Group();
  group.name = `ferry-${targetNodeId}`;

  const hullMat = mat(0x1f3550, 0.55, 0.1);
  const hullDark = mat(0x121c2a, 0.7);
  const deckMat = mat(0x8b6b3f, 0.8);
  const cabinMat = mat(0xf2eadb, 0.5);
  const railMat = mat(CHROME, 0.35, 0.7);
  const windowMat = new THREE.MeshStandardMaterial({
    color: GLASS,
    emissive: 0xfff3b8,
    emissiveIntensity: 1.2,
    roughness: 0.25,
  });

  const hull = shadowed(new THREE.Mesh(rbox(3.2, 0.95, 7.2, 0.3), hullMat));
  hull.position.y = 0.42;
  group.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(1.6, 1.8, 4), hullMat);
  bow.rotation.set(Math.PI / 2, Math.PI / 4, 0);
  bow.position.set(0, 0.42, 4.2);
  bow.scale.set(1, 1, 0.6);
  group.add(bow);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.16, 7.3), hullDark);
  trim.position.y = 0.12;
  group.add(trim);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.06, 7.0), deckMat);
  deck.position.y = 0.92;
  group.add(deck);

  const cabin = shadowed(new THREE.Mesh(rbox(2.4, 1.2, 3.6, 0.14), cabinMat));
  cabin.position.set(0, 1.55, -0.6);
  group.add(cabin);
  const roof = new THREE.Mesh(rbox(2.6, 0.16, 3.9, 0.06), mat(BUS_BODY, 0.7));
  roof.position.set(0, 2.22, -0.6);
  group.add(roof);
  for (const side of [-1, 1] as const) {
    const rotY = side === 1 ? -Math.PI / 2 : Math.PI / 2;
    for (const z of [0.4, -0.6, -1.6]) {
      addPane(group, 0.7, 0.5, new THREE.Vector3(side * 1.21, 1.65, z), rotY, windowMat);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 8, 20), mat(0xff6a1a, 0.7));
    ring.position.set(side * 1.25, 1.35, 1.1);
    ring.rotation.y = Math.PI / 2;
    group.add(ring);
  }
  addPane(group, 1.9, 0.55, new THREE.Vector3(0, 1.65, 1.21), 0, windowMat, -0.15);

  for (const side of [-1, 1] as const) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 6.4, 8), railMat);
    rail.rotation.x = Math.PI / 2;
    rail.position.set(side * 1.42, 1.5, 0.1);
    group.add(rail);
    for (const z of [-2.9, -1.4, 0.1, 1.6, 3.1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6), railMat);
      post.position.set(side * 1.42, 1.22, z);
      group.add(post);
    }
  }

  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.8, 12), hullDark);
  funnel.position.set(0, 2.6, -1.6);
  group.add(funnel);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 8), railMat);
  mast.position.set(0, 3.0, 0.6);
  group.add(mast);
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.3),
    new THREE.MeshStandardMaterial({ color: BUS_BODY, side: THREE.DoubleSide })
  );
  flag.position.set(0.35, 3.5, 0.6);
  group.add(flag);

  const headlamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), lampMat(LAMP_WARM, 2.8));
  headlamp.position.set(0, 1.15, 4.4);
  group.add(headlamp);

  const hit = new THREE.Mesh(new THREE.BoxGeometry(3.6, 3.6, 8.4), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 1.4;
  hit.userData.vehicleRoot = group;
  group.add(hit);

  return makeHandle(group, hit, 'river', targetNodeId, {
    tint: [cabinMat, hullMat],
    tintColor: 0x7fd0ff,
    glow: [windowMat, headlamp.material as Mat],
  }, {
    rideOffsetY: 1.8,
    rideForwardLocal: new THREE.Vector3(0, 0, 1),
  });
}

interface HoverSet {
  /** Body materials that get a soft emissive tint while aimed at. */
  tint: Mat[];
  tintColor: number;
  /** Already-emissive parts (lamps, signs) that get brighter while aimed at. */
  glow: Mat[];
}

function makeHandle(
  group: THREE.Group,
  hit: THREE.Mesh,
  kind: VehicleKind,
  targetNodeId: number,
  hover: HoverSet,
  opts: { rideOffsetY: number; rideForwardLocal: THREE.Vector3 }
): VehicleHandle {
  const tintBase = hover.tint.map((m) => ({ color: m.emissive.clone(), intensity: m.emissiveIntensity }));
  const glowBase = hover.glow.map((m) => m.emissiveIntensity);
  const tintColor = new THREE.Color(hover.tintColor);
  return {
    group,
    kind,
    targetNodeId,
    hitMesh: hit,
    rideOffsetY: opts.rideOffsetY,
    rideForwardLocal: opts.rideForwardLocal.clone(),
    setHover: (on) => {
      hover.tint.forEach((m, i) => {
        if (on) {
          m.emissive.copy(tintColor);
          m.emissiveIntensity = HOVER_TINT_INTENSITY;
        } else {
          m.emissive.copy(tintBase[i].color);
          m.emissiveIntensity = tintBase[i].intensity;
        }
      });
      hover.glow.forEach((m, i) => {
        m.emissiveIntensity = on ? glowBase[i] * HOVER_GLOW_BOOST : glowBase[i];
      });
    },
  };
}
