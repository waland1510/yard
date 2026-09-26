// Harry Potter theme stand-ins for the street transports, each matching its themed name:
// an Apparition point (taxi), the purple triple-decker Knight Bus (bus), a Floo Network
// fireplace (underground) and a Portkey (river). Same handle contract and footprints as
// the London set, so placement, hover and rides work unchanged.

import * as THREE from 'three';
import { makeTextTexture } from './canvas-textures';
import type { TunnelStyle } from './tunnel';
import { STATION_FOOTPRINT } from './vehicles';
import {
  GUNMETAL,
  LAMP_RED,
  LAMP_WARM,
  RUBBER,
  addPane,
  addWheel,
  archNotch,
  cachedTexture,
  chromeMat,
  glassMat,
  lampMat,
  makeHandle,
  mat,
  paintMat,
  profileBody,
  rbox,
  shadowed,
  type VehicleHandle,
} from './vehicle-kit';

const KNIGHT_PURPLE = 0x4b2a86;
const KNIGHT_GOLD = 0xd9a93a;
const BRICK = 0x7b3f2f;
const STONE = 0x8d8579;
const FLOO_GREEN = 0x3dff72;

export const FLOO_TUNNEL: TunnelStyle = {
  wall: 0x0e1a12,
  floor: 0x17231a,
  stripe: 0x2bff6a,
  light: 0x46ff7e,
  train: false,
};

/** Runs `fn(seconds)` every frame the mesh is drawn — cheap idle animation without a ticker. */
function animate(mesh: THREE.Mesh, fn: (t: number) => void) {
  mesh.onBeforeRender = () => fn(performance.now() / 1000);
}

function glowDiscTexture(): THREE.Texture {
  return cachedTexture('anglia-glow', () => {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      g.addColorStop(0, 'rgba(160, 240, 255, 0.9)');
      g.addColorStop(1, 'rgba(160, 240, 255, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });
}

function runeCircleTexture(): THREE.Texture {
  return cachedTexture('apparition-runes', () => {
    const size = 512;
    const c = size / 2;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = '#d8f2ff';
      ctx.fillStyle = '#d8f2ff';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(c, c, c - 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(c, c, c - 70, 0, Math.PI * 2);
      ctx.stroke();
      const runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒ';
      ctx.font = 'bold 40px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      [...runes].forEach((rune, i, all) => {
        const a = (i / all.length) * Math.PI * 2;
        ctx.save();
        ctx.translate(c + Math.cos(a) * (c - 41), c + Math.sin(a) * (c - 41));
        ctx.rotate(a + Math.PI / 2);
        ctx.fillText(rune, 0, 0);
        ctx.restore();
      });
      ctx.lineWidth = 5;
      ctx.beginPath();
      for (let i = 0; i <= 5; i++) {
        const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
        const r = c - 90;
        if (i === 0) ctx.moveTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
        else ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
      }
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });
}

// ---------------------------------------------------------------------------
// APPARITION POINT — a glowing rune circle on the road with rings of light spiralling up
// out of it and a wooden "Apparate" signpost. Step in and you're gone.
// ---------------------------------------------------------------------------
export function createApparitionPoint(targetNodeId: number): VehicleHandle {
  const RING_COUNT = 4;
  const COLUMN_HEIGHT = 2.8;
  const SPARKS = 70;

  const group = new THREE.Group();
  group.name = `apparition-${targetNodeId}`;

  const discMat = new THREE.MeshBasicMaterial({
    map: runeCircleTexture(),
    color: 0x9fd8ff,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.45, 48), discMat);
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.03;
  group.add(disc);

  const haloMat = new THREE.MeshBasicMaterial({
    map: glowDiscTexture(),
    transparent: true,
    depthWrite: false,
    opacity: 0.5,
  });
  const halo = new THREE.Mesh(new THREE.CircleGeometry(2.3, 40), haloMat);
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.02;
  group.add(halo);

  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x10202c,
    emissive: 0x9fdcff,
    emissiveIntensity: 2.2,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const rings: THREE.Mesh[] = [];
  for (let i = 0; i < RING_COUNT; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.025, 8, 48), ringMat);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    rings.push(ring);
  }

  const sparkPositions = new Float32Array(SPARKS * 3);
  const sparkSeeds = Array.from({ length: SPARKS }, (_, i) => ({
    angle: (i / SPARKS) * Math.PI * 2 * 3.7,
    offset: (i * 0.618) % 1,
    radius: 0.35 + ((i * 0.37) % 1) * 0.8,
  }));
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
  const sparks = new THREE.Points(
    sparkGeo,
    new THREE.PointsMaterial({
      color: 0xd6f4ff,
      size: 0.07,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  group.add(sparks);

  const light = new THREE.PointLight(0x8fd0ff, 5, 7, 1.8);
  light.position.y = 1.0;
  group.add(light);

  const woodMat = mat(0x5a3b22, 0.85);
  const post = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 2.2, 10), woodMat));
  post.position.set(1.9, 1.1, 0);
  group.add(post);
  const plaqueTex = cachedTexture('apparition-plaque', () =>
    makeTextTexture('APPARATE', { width: 384, height: 96, bg: '#3a2616', fg: '#f0d58a', fontPx: 60 })
  );
  const plaqueMat = new THREE.MeshStandardMaterial({
    map: plaqueTex,
    emissive: 0xffe0a0,
    emissiveMap: plaqueTex,
    emissiveIntensity: 0.9,
  });
  const plaqueBoard = new THREE.Mesh(rbox(1.1, 0.34, 0.06, 0.03), woodMat);
  plaqueBoard.position.set(1.9, 1.95, 0);
  group.add(plaqueBoard);
  for (const flip of [0, Math.PI]) {
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.26), plaqueMat);
    plaque.position.set(1.9, 1.95, flip === 0 ? 0.035 : -0.035);
    plaque.rotation.y = flip;
    group.add(plaque);
  }

  const phase = (targetNodeId % 5) * 0.37;
  animate(disc, (t) => {
    disc.rotation.z = t * 0.35;
    rings.forEach((ring, i) => {
      const u = (t * 0.45 + phase + i / RING_COUNT) % 1;
      ring.position.y = 0.05 + u * COLUMN_HEIGHT;
      const r = 1.25 * (1 - u * 0.65);
      ring.scale.set(r, r, r);
      ring.rotation.z = t * 1.5 + i;
    });
    ringMat.opacity = 0.85;
    sparkSeeds.forEach((seed, i) => {
      const u = (t * 0.3 + seed.offset) % 1;
      const a = seed.angle + t * 2.2;
      const r = seed.radius * (1 - u * 0.5);
      sparkPositions[i * 3] = Math.cos(a) * r;
      sparkPositions[i * 3 + 1] = u * COLUMN_HEIGHT;
      sparkPositions[i * 3 + 2] = Math.sin(a) * r;
    });
    sparkGeo.attributes.position.needsUpdate = true;
    light.intensity = 4.5 + Math.sin(t * 3.1 + phase) * 1.2;
  });

  const hit = new THREE.Mesh(new THREE.BoxGeometry(3.0, 3.0, 3.0), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 1.5;
  hit.userData.vehicleRoot = group;
  group.add(hit);

  return makeHandle(group, hit, 'taxi', targetNodeId, {
    tint: [woodMat],
    tintColor: 0x9fdcff,
    glow: [ringMat, plaqueMat],
  }, {
    rideOffsetY: 1.7,
    rideForwardLocal: new THREE.Vector3(0, 0, 1),
  });
}

// ---------------------------------------------------------------------------
// KNIGHT BUS — purple triple-decker with gold bands, warm-lit windows and a lit
// destination board.
// ---------------------------------------------------------------------------
export function createKnightBus(targetNodeId: number): VehicleHandle {
  const WHEEL_R = 0.52;
  const WHEEL_Z = [2.45, -2.35];
  const SILL = 0.3;

  const group = new THREE.Group();
  group.name = `knight-bus-${targetNodeId}`;

  const bodyMat = paintMat(KNIGHT_PURPLE, 0.3);
  const goldMat = chromeMat(KNIGHT_GOLD);
  const darkMat = mat(GUNMETAL, 0.55, 0.4);
  const tyreMat = mat(RUBBER, 0.95);
  const glass = glassMat();
  glass.emissive.setHex(0x8a5a1c);
  glass.emissiveIntensity = 0.12;

  const bodyShape = new THREE.Shape();
  bodyShape.moveTo(-3.6, SILL);
  archNotch(bodyShape, WHEEL_Z[1], WHEEL_R, 0.62, SILL);
  archNotch(bodyShape, WHEEL_Z[0], WHEEL_R, 0.62, SILL);
  bodyShape.lineTo(3.62, SILL);
  bodyShape.quadraticCurveTo(3.82, SILL, 3.82, 0.5);
  bodyShape.lineTo(3.82, 1.85);
  bodyShape.lineTo(3.66, 1.95);
  bodyShape.lineTo(3.6, 4.45);
  bodyShape.quadraticCurveTo(3.6, 4.72, 3.3, 4.72);
  bodyShape.lineTo(-3.45, 4.72);
  bodyShape.quadraticCurveTo(-3.8, 4.72, -3.8, 4.4);
  bodyShape.lineTo(-3.8, 0.5);
  bodyShape.quadraticCurveTo(-3.8, SILL, -3.6, SILL);
  group.add(shadowed(new THREE.Mesh(profileBody(bodyShape, 2.4, 0.18), bodyMat), true));

  for (const y of [1.83, 3.33]) {
    const band = new THREE.Mesh(rbox(2.44, 0.12, 7.66, 0.05), goldMat);
    band.position.y = y;
    group.add(band);
  }

  const lowerZ = [2.55, 1.5, 0.45, -0.6, -1.65];
  const deckZ = [2.63, 1.58, 0.53, -0.52, -1.57, -2.62];
  for (const side of [-1, 1] as const) {
    const rotY = (side * Math.PI) / 2;
    for (const z of lowerZ) addPane(group, 0.86, 0.6, new THREE.Vector3(side * 1.205, 1.47, z), rotY, glass);
    for (const y of [2.72, 3.97]) {
      for (const z of deckZ) addPane(group, 0.86, 0.74, new THREE.Vector3(side * 1.205, y, z), rotY, glass);
    }
  }

  addPane(group, 2.0, 0.78, new THREE.Vector3(0, 1.28, 3.83), 0, glass);
  for (const [y, z] of [[2.62, 3.655], [3.87, 3.645]]) {
    addPane(group, 0.98, 0.72, new THREE.Vector3(-0.56, y, z), 0, glass, -0.024);
    addPane(group, 0.98, 0.72, new THREE.Vector3(0.56, y, z), 0, glass, -0.024);
  }
  for (const y of [2.72, 3.97]) addPane(group, 1.9, 0.72, new THREE.Vector3(0, y, -3.81), Math.PI, glass);

  const boardTex = cachedTexture('knight-bus-board', () =>
    makeTextTexture('KNIGHT BUS', { width: 512, height: 112, bg: '#140a24', fg: '#f3c34c', fontPx: 80 })
  );
  const boardMat = new THREE.MeshStandardMaterial({
    map: boardTex,
    emissive: 0xffd27a,
    emissiveMap: boardTex,
    emissiveIntensity: 2.4,
  });
  const boardFrame = new THREE.Mesh(rbox(1.9, 0.34, 0.06, 0.02), goldMat);
  boardFrame.position.set(0, 4.36, 3.63);
  group.add(boardFrame);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.28), boardMat);
  board.position.set(0, 4.36, 3.665);
  group.add(board);

  const flankTex = cachedTexture('knight-bus-flank', () =>
    makeTextTexture('THE KNIGHT BUS', { width: 768, height: 96, bg: '#4b2a86', fg: '#f3c34c', fontPx: 64 })
  );
  const flankMat = new THREE.MeshStandardMaterial({ map: flankTex, roughness: 0.5 });
  for (const side of [-1, 1] as const) {
    const flank = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.3), flankMat);
    flank.position.set(side * 1.215, 0.98, 0.05);
    flank.rotation.y = (side * Math.PI) / 2;
    group.add(flank);
  }

  const grille = new THREE.Mesh(rbox(0.7, 0.55, 0.08, 0.04), goldMat);
  grille.position.set(0, 0.72, 3.84);
  group.add(grille);
  for (const z of [3.86, -3.85]) {
    const bumper = new THREE.Mesh(rbox(2.3, 0.14, 0.16, 0.04), darkMat);
    bumper.position.set(0, 0.42, z);
    group.add(bumper);
  }
  const headMat = lampMat(LAMP_WARM, 3);
  for (const x of [-0.82, 0.82]) {
    const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 16), headMat);
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
    for (const x of [-1.0, 1.0]) addWheel(group, x, z, WHEEL_R, 0.38, tyreMat, goldMat);
  }

  const hit = new THREE.Mesh(new THREE.BoxGeometry(2.8, 5.0, 8.0), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 2.5;
  hit.userData.vehicleRoot = group;
  group.add(hit);

  return makeHandle(group, hit, 'bus', targetNodeId, {
    tint: [bodyMat],
    tintColor: 0xb07cff,
    glow: [boardMat, headMat, glass],
  }, {
    rideOffsetY: 2.95,
    rideForwardLocal: new THREE.Vector3(0, 0, 1),
  });
}

// ---------------------------------------------------------------------------
// FLOO NETWORK — a brick fireplace house set into the frontage, green flames roaring in
// an arched hearth. Same footprint as the tube station; the ride dives into the flames.
// ---------------------------------------------------------------------------
export function createFlooFireplace(targetNodeId: number): VehicleHandle {
  const W = STATION_FOOTPRINT.width;
  const D = STATION_FOOTPRINT.depth;
  const H = 5.4;
  const ARCH_HALF = 1.4;
  const ARCH_SPRING = 2.0;
  const HEARTH_Y = 0.25;

  const group = new THREE.Group();
  group.name = `floo-${targetNodeId}`;

  const brickMat = mat(BRICK, 0.9);
  const stoneMat = mat(STONE, 0.85);
  const sootMat = mat(0x16110e, 1);
  const slateMat = mat(0x2b2d33, 0.8);

  const facade = new THREE.Shape();
  facade.moveTo(-W / 2, 0);
  facade.lineTo(W / 2, 0);
  facade.lineTo(W / 2, H);
  facade.lineTo(-W / 2, H);
  facade.lineTo(-W / 2, 0);
  const opening = new THREE.Path();
  opening.moveTo(-ARCH_HALF, HEARTH_Y);
  opening.lineTo(ARCH_HALF, HEARTH_Y);
  opening.lineTo(ARCH_HALF, ARCH_SPRING);
  opening.absarc(0, ARCH_SPRING, ARCH_HALF, 0, Math.PI, false);
  opening.lineTo(-ARCH_HALF, HEARTH_Y);
  facade.holes.push(opening);
  const front = shadowed(
    new THREE.Mesh(new THREE.ExtrudeGeometry(facade, { depth: 0.5, bevelEnabled: false, curveSegments: 20 }), brickMat),
    true
  );
  front.position.z = -0.5;
  group.add(front);

  for (const sx of [-1, 1]) {
    const side = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.4, H, D), brickMat), true);
    side.position.set(sx * (W / 2 - 0.2), H / 2, -D / 2);
    group.add(side);
  }
  const back = shadowed(new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.4), brickMat), true);
  back.position.set(0, H / 2, -D + 0.2);
  group.add(back);
  const roof = shadowed(new THREE.Mesh(rbox(W + 0.3, 0.25, D + 0.3, 0.05), slateMat));
  roof.position.set(0, H + 0.12, -D / 2);
  group.add(roof);

  const chimney = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.2, 1.1), brickMat));
  chimney.position.set(1.9, H + 1.1, -D / 2);
  group.add(chimney);
  const cap = new THREE.Mesh(rbox(1.3, 0.2, 1.3, 0.04), stoneMat);
  cap.position.set(1.9, H + 2.3, -D / 2);
  group.add(cap);

  const innerDepth = 2.6;
  const innerBack = new THREE.Mesh(new THREE.BoxGeometry(ARCH_HALF * 2, 3.6, 0.1), sootMat);
  innerBack.position.set(0, 1.8, -0.5 - innerDepth);
  group.add(innerBack);
  for (const sx of [-1, 1]) {
    const innerSide = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3.6, innerDepth), sootMat);
    innerSide.position.set(sx * ARCH_HALF, 1.8, -0.5 - innerDepth / 2);
    group.add(innerSide);
  }
  const innerTop = new THREE.Mesh(new THREE.BoxGeometry(ARCH_HALF * 2, 0.1, innerDepth), sootMat);
  innerTop.position.set(0, ARCH_SPRING + ARCH_HALF, -0.5 - innerDepth / 2);
  group.add(innerTop);
  const hearthFloor = new THREE.Mesh(new THREE.BoxGeometry(ARCH_HALF * 2, HEARTH_Y, innerDepth + 0.5), stoneMat);
  hearthFloor.position.set(0, HEARTH_Y / 2, -innerDepth / 2 - 0.25);
  group.add(hearthFloor);
  const step = shadowed(new THREE.Mesh(rbox(3.8, HEARTH_Y, 1.0, 0.04), stoneMat), true);
  step.position.set(0, HEARTH_Y / 2, 0.5);
  group.add(step);

  const flameMat = new THREE.MeshStandardMaterial({
    color: 0x0f3a1c,
    emissive: FLOO_GREEN,
    emissiveIntensity: 3,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const flames: THREE.Mesh[] = [];
  for (const [x, h] of [[-0.8, 1.1], [-0.4, 1.6], [0, 2.0], [0.4, 1.5], [0.8, 1.2]]) {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.34, h, 10, 1, true), flameMat);
    flame.position.set(x, HEARTH_Y + h / 2, -1.6);
    flame.userData.baseHeight = h;
    group.add(flame);
    flames.push(flame);
  }
  const fireLight = new THREE.PointLight(FLOO_GREEN, 14, 9, 1.6);
  fireLight.position.set(0, 1.2, -1.0);
  group.add(fireLight);
  animate(flames[0], (t) => {
    flames.forEach((flame, i) => {
      const flicker = 1 + Math.sin(t * 7.3 + i * 1.7) * 0.12 + Math.sin(t * 12.1 + i) * 0.06;
      flame.scale.set(1, flicker, 1);
      flame.position.y = HEARTH_Y + (flame.userData.baseHeight * flicker) / 2;
    });
    fireLight.intensity = 12 + Math.sin(t * 9.7) * 2.5 + Math.sin(t * 15.3) * 1.2;
  });

  const mantel = shadowed(new THREE.Mesh(rbox(4.0, 0.22, 0.55, 0.04), stoneMat));
  mantel.position.set(0, 3.75, 0.2);
  group.add(mantel);
  const potMat = new THREE.MeshStandardMaterial({ color: 0x1f3a26, emissive: FLOO_GREEN, emissiveIntensity: 1.2 });
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.3, 14), potMat);
  pot.position.set(1.5, 4.01, 0.2);
  group.add(pot);

  const signTex = cachedTexture('floo-sign', () =>
    makeTextTexture('FLOO NETWORK', { width: 512, height: 96, bg: '#16301f', fg: '#e8c565', fontPx: 64 })
  );
  const signMat = new THREE.MeshStandardMaterial({
    map: signTex,
    emissive: 0xffe6a0,
    emissiveMap: signTex,
    emissiveIntensity: 1.3,
  });
  const signBoard = new THREE.Mesh(rbox(3.6, 0.55, 0.08, 0.03), mat(0x16301f, 0.6));
  signBoard.position.set(0, 4.4, 0.06);
  group.add(signBoard);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.44), signMat);
  sign.position.set(0, 4.4, 0.105);
  group.add(sign);

  const lanternMat = new THREE.MeshStandardMaterial({ color: 0x173d22, emissive: FLOO_GREEN, emissiveIntensity: 2 });
  for (const sx of [-1, 1]) {
    const lantern = new THREE.Mesh(rbox(0.26, 0.42, 0.26, 0.04), lanternMat);
    lantern.position.set(sx * 2.25, 2.6, 0.18);
    group.add(lantern);
  }

  const hit = new THREE.Mesh(new THREE.BoxGeometry(W + 0.4, H + 0.6, D + 1.6), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(0, H / 2, -D / 2 + 0.6);
  hit.userData.vehicleRoot = group;
  group.add(hit);

  return makeHandle(group, hit, 'underground', targetNodeId, {
    tint: [brickMat],
    tintColor: 0x7dff9e,
    glow: [flameMat, signMat, lanternMat],
  }, {
    rideOffsetY: 0.4,
    rideForwardLocal: new THREE.Vector3(0, 0, -1),
    tunnelStyle: FLOO_TUNNEL,
  });
}

// ---------------------------------------------------------------------------
// PORTKEY — a battered old boot hovering and turning above a stone plinth in the river,
// ringed by blue light. Touch it and it whisks you away.
// ---------------------------------------------------------------------------
export function createPortkey(targetNodeId: number): VehicleHandle {
  const HOVER = 1.45;
  const BOOT_SCALE = 1.8;

  const group = new THREE.Group();
  group.name = `portkey-${targetNodeId}`;

  const stoneMat = mat(STONE, 0.9);
  const plinth = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.15, 0.9, 20), stoneMat), true);
  plinth.position.y = 0.2;
  group.add(plinth);
  const capStone = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.12, 20), stoneMat);
  capStone.position.y = 0.7;
  group.add(capStone);

  const boot = new THREE.Group();
  boot.position.y = HOVER;
  boot.scale.setScalar(BOOT_SCALE);
  group.add(boot);
  const leatherMat = mat(0x5b3a24, 0.75);
  const soleMat = mat(0x221710, 0.9);
  const shaft = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.62, 16), leatherMat));
  shaft.position.set(0, 0.2, -0.12);
  boot.add(shaft);
  const foot = shadowed(new THREE.Mesh(rbox(0.34, 0.24, 0.66, 0.1), leatherMat));
  foot.position.set(0, -0.12, 0.08);
  boot.add(foot);
  const sole = new THREE.Mesh(rbox(0.36, 0.06, 0.7, 0.03), soleMat);
  sole.position.set(0, -0.26, 0.08);
  boot.add(sole);
  const heel = new THREE.Mesh(rbox(0.3, 0.12, 0.18, 0.03), soleMat);
  heel.position.set(0, -0.31, -0.17);
  boot.add(heel);
  boot.rotation.set(0.25, 0, 0.35);

  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x0b1a2e,
    emissive: 0x6fb8ff,
    emissiveIntensity: 2.4,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.035, 8, 48), ringMat);
  ring.position.y = HOVER;
  group.add(ring);

  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(2.6, 40),
    new THREE.MeshBasicMaterial({ map: glowDiscTexture(), transparent: true, depthWrite: false, opacity: 0.45 })
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.04;
  group.add(halo);

  const light = new THREE.PointLight(0x6fb8ff, 6, 8, 1.8);
  light.position.y = HOVER;
  group.add(light);

  const phase = (targetNodeId % 3) * 1.1;
  animate(shaft, (t) => {
    boot.position.y = HOVER + Math.sin(t * 1.4 + phase) * 0.1;
    boot.rotation.y = t * 0.6;
    ring.position.y = boot.position.y;
    ring.rotation.set(Math.PI / 2 + Math.sin(t * 0.9) * 0.4, Math.cos(t * 0.7) * 0.4, t * 0.8);
    light.intensity = 5.5 + Math.sin(t * 2.7 + phase) * 1.5;
  });

  const hit = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.0, 2.6), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 1.4;
  hit.userData.vehicleRoot = group;
  group.add(hit);

  return makeHandle(group, hit, 'river', targetNodeId, {
    tint: [leatherMat, stoneMat],
    tintColor: 0x7fd0ff,
    glow: [ringMat],
  }, {
    rideOffsetY: 1.8,
    rideForwardLocal: new THREE.Vector3(0, 0, 1),
  });
}
