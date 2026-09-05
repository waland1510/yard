import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
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
const BUS_ROOF = 0x9a2424;
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

function glassMat(): Mat {
  return new THREE.MeshStandardMaterial({ color: GLASS, roughness: 0.2, metalness: 0.25 });
}

function lampMat(color: number, intensity: number, base = 0xfff8e6): Mat {
  return new THREE.MeshStandardMaterial({ color: base, emissive: color, emissiveIntensity: intensity });
}

function rbox(w: number, h: number, d: number, radius: number): RoundedBoxGeometry {
  return new RoundedBoxGeometry(w, h, d, 3, radius);
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

function addWheelArch(parent: THREE.Object3D, x: number, z: number, radius: number, bodyHalfWidth: number, arch: Mat) {
  const a = new THREE.Mesh(new THREE.BoxGeometry(0.16, radius * 1.2, radius * 2.3), arch);
  a.position.set(Math.sign(x) * (bodyHalfWidth - 0.02), radius * 1.05, z);
  parent.add(a);
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

  const bodyMat = mat(TAXI_BODY, 0.4, 0.15);
  const darkMat = mat(TAXI_DARK, 0.6);
  const glass = glassMat();
  const trimMat = mat(GUNMETAL, 0.5, 0.4);
  const chromeMat = mat(CHROME, 0.3, 0.8);
  const tyreMat = mat(RUBBER, 0.95);

  const body = shadowed(new THREE.Mesh(rbox(1.9, 0.62, 4.4, 0.12), bodyMat), true);
  body.position.y = 0.66;
  group.add(body);

  const cabin = shadowed(new THREE.Mesh(rbox(1.8, 0.82, 2.5, 0.16), bodyMat));
  cabin.position.set(0, 1.32, -0.35);
  group.add(cabin);

  const bonnet = shadowed(new THREE.Mesh(rbox(1.7, 0.22, 1.35, 0.08), bodyMat));
  bonnet.position.set(0, 1.04, 1.35);
  group.add(bonnet);

  const boot = new THREE.Mesh(rbox(1.7, 0.16, 0.6, 0.06), bodyMat);
  boot.position.set(0, 1.02, -1.85);
  group.add(boot);

  addPane(group, 1.5, 0.6, new THREE.Vector3(0, 1.4, 0.92), 0, glass, -0.28);
  addPane(group, 1.4, 0.55, new THREE.Vector3(0, 1.42, -1.62), Math.PI, glass, -0.22);
  for (const side of [-1, 1] as const) {
    const rotY = (side * Math.PI) / 2;
    addPane(group, 0.95, 0.52, new THREE.Vector3(side * 0.905, 1.42, 0.25), rotY, glass);
    addPane(group, 0.95, 0.52, new THREE.Vector3(side * 0.905, 1.42, -0.9), rotY, glass);
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.2), trimMat);
    mirror.position.set(side * 1.02, 1.3, 0.85);
    group.add(mirror);
    for (const z of [0.25, -0.9]) {
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.22), chromeMat);
      handle.position.set(side * 0.965, 0.95, z + 0.3);
      group.add(handle);
    }
  }

  for (const [x, z] of [[-0.95, 1.5], [0.95, 1.5], [-0.95, -1.45], [0.95, -1.45]]) {
    addWheelArch(group, x, z, 0.4, 0.95, trimMat);
    addWheel(group, x, z, 0.4, 0.3, tyreMat, chromeMat);
  }

  for (const z of [2.24, -2.24]) {
    const bumper = new THREE.Mesh(rbox(1.92, 0.16, 0.18, 0.05), trimMat);
    bumper.position.set(0, 0.5, z);
    group.add(bumper);
  }
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.05), trimMat);
  grille.position.set(0, 0.78, 2.22);
  group.add(grille);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.02), mat(0xf4efe2, 0.7));
  plate.position.set(0, 0.6, 2.23);
  group.add(plate);

  const headMat = lampMat(LAMP_WARM, 2.8);
  for (const x of [-0.68, 0.68]) {
    const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 14), headMat);
    hl.rotation.x = Math.PI / 2;
    hl.position.set(x, 0.86, 2.21);
    group.add(hl);
  }
  const tailMat = lampMat(LAMP_RED, 2.6, 0x3a0705);
  for (const x of [-0.72, 0.72]) {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.04), tailMat);
    tl.position.set(x, 0.88, -2.21);
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

  const bodyMat = mat(BUS_BODY, 0.5, 0.15);
  const roofMat = mat(BUS_ROOF, 0.75);
  const trimMat = mat(BUS_TRIM, 0.7);
  const pillarMat = mat(0x8e1f1f, 0.6);
  const glass = glassMat();
  const darkMat = mat(GUNMETAL, 0.55, 0.4);
  const tyreMat = mat(RUBBER, 0.95);
  const hubMat = mat(0xc9c2b4, 0.5);

  const lower = shadowed(new THREE.Mesh(rbox(2.4, 1.55, 7.6, 0.14), bodyMat), true);
  lower.position.y = 1.02;
  group.add(lower);

  const upper = shadowed(new THREE.Mesh(rbox(2.36, 1.5, 7.3, 0.18), bodyMat));
  upper.position.set(0, 2.55, -0.12);
  group.add(upper);

  const roof = new THREE.Mesh(rbox(2.3, 0.22, 7.15, 0.1), roofMat);
  roof.position.set(0, 3.36, -0.12);
  group.add(roof);

  const trim = new THREE.Mesh(rbox(2.46, 0.14, 7.64, 0.04), trimMat);
  trim.position.y = 1.83;
  group.add(trim);
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(2.42, 0.08, 7.62), darkMat);
  skirt.position.y = 0.28;
  group.add(skirt);

  const lowerZ = [2.55, 1.5, 0.45, -0.6, -1.65];
  const upperZ = [2.75, 1.7, 0.65, -0.4, -1.45, -2.5];
  for (const side of [-1, 1] as const) {
    const rotY = (side * Math.PI) / 2;
    for (const z of lowerZ) {
      addPane(group, 0.86, 0.72, new THREE.Vector3(side * 1.205, 1.35, z), rotY, glass);
    }
    for (const z of upperZ) {
      addPane(group, 0.86, 0.74, new THREE.Vector3(side * 1.185, 2.72, z - 0.12), rotY, glass);
    }
    const roundelTex = cachedTexture('bus-roundel', () =>
      makeRoundelTexture({ ringColor: hex(BUS_TRIM), barColor: hex(BUS_TRIM), barText: 'BUS', size: 256 })
    );
    const roundel = new THREE.Mesh(
      new THREE.CircleGeometry(0.28, 32),
      new THREE.MeshStandardMaterial({ map: roundelTex, transparent: true, roughness: 0.6 })
    );
    roundel.position.set(side * 1.21, 0.78, -2.9);
    roundel.rotation.y = rotY;
    group.add(roundel);
  }
  for (const z of [2.03, 0.98, -0.07, -1.12]) {
    for (const side of [-1, 1] as const) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.8, 0.14), pillarMat);
      pillar.position.set(side * 1.215, 1.35, z);
      group.add(pillar);
    }
  }

  addPane(group, 2.0, 0.78, new THREE.Vector3(0, 1.28, 3.81), 0, glass);
  addPane(group, 0.98, 0.78, new THREE.Vector3(-0.56, 2.7, 3.54), 0, glass, -0.08);
  addPane(group, 0.98, 0.78, new THREE.Vector3(0.56, 2.7, 3.54), 0, glass, -0.08);
  addPane(group, 1.9, 0.72, new THREE.Vector3(0, 2.72, -3.78), Math.PI, glass);

  const platform = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.35, 0.06), mat(0x1a1114, 0.9));
  platform.position.set(0.62, 1.0, -3.78);
  group.add(platform);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.3, 8), trimMat);
  pole.position.set(0.2, 1.0, -3.7);
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
  const blindFrame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.06), darkMat);
  blindFrame.position.set(0, 3.12, 3.55);
  group.add(blindFrame);
  const blind = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.4), blindMat);
  blind.position.set(0, 3.12, 3.585);
  group.add(blind);

  const grille = new THREE.Mesh(rbox(0.7, 0.55, 0.08, 0.04), darkMat);
  grille.position.set(0, 0.72, 3.8);
  group.add(grille);
  for (const z of [3.84, -3.84]) {
    const bumper = new THREE.Mesh(rbox(2.3, 0.14, 0.16, 0.04), darkMat);
    bumper.position.set(0, 0.42, z);
    group.add(bumper);
  }

  const headMat = lampMat(LAMP_WARM, 2.8);
  for (const x of [-0.82, 0.82]) {
    const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 14), headMat);
    hl.rotation.x = Math.PI / 2;
    hl.position.set(x, 0.72, 3.81);
    group.add(hl);
  }
  const tailMat = lampMat(LAMP_RED, 2.6, 0x3a0705);
  for (const x of [-0.95, 0.95]) {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.26, 0.04), tailMat);
    tl.position.set(x, 0.6, -3.82);
    group.add(tl);
  }

  for (const z of [2.45, -2.35]) {
    for (const x of [-1.1, 1.1]) {
      addWheelArch(group, x, z, 0.52, 1.2, darkMat);
      addWheel(group, x, z, 0.52, 0.38, tyreMat, hubMat);
    }
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
export function createUnderground(targetNodeId: number): VehicleHandle {
  const group = new THREE.Group();
  group.name = `underground-${targetNodeId}`;

  const W = 6.4;
  const D = 4.6;
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
