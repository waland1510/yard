// Barbie World stand-ins for the street transports, each matching its themed name: a pink
// open-top convertible (taxi), the Dream Camper (bus), a Dream Slide tower whose slide
// dives underground (underground) and a Pink Yacht (river). Same handle contract and
// footprints as the London set, so placement, hover and rides work unchanged.

import * as THREE from 'three';
import { makeTextTexture } from './canvas-textures';
import type { TunnelStyle } from './tunnel';
import { STATION_FOOTPRINT } from './vehicles';
import {
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

const HOT_PINK = 0xff4fa3;
const SOFT_PINK = 0xffb3d9;
const PEARL = 0xfdf6f9;
const SLIDE_AQUA = 0x4fd1c5;

export const DREAM_SLIDE_TUNNEL: TunnelStyle = {
  wall: 0x6b1e4a,
  floor: 0x8a2a5e,
  stripe: 0xff6ec7,
  light: 0xffc2e6,
  train: false,
};

function heartShape(size: number): THREE.Shape {
  const s = size;
  const heart = new THREE.Shape();
  heart.moveTo(0, -s * 0.9);
  heart.bezierCurveTo(-s * 1.2, -s * 0.1, -s * 0.9, s * 0.9, 0, s * 0.35);
  heart.bezierCurveTo(s * 0.9, s * 0.9, s * 1.2, -s * 0.1, 0, -s * 0.9);
  return heart;
}

function textPlate(key: string, text: string, bg: string, fg: string): THREE.MeshStandardMaterial {
  const tex = cachedTexture(key, () => makeTextTexture(text, { width: 512, height: 112, bg, fg, fontPx: 70 }));
  return new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.6 });
}

// ---------------------------------------------------------------------------
// PINK CONVERTIBLE — open-top sports car, white leather seats, chrome trim.
// ---------------------------------------------------------------------------
export function createConvertible(targetNodeId: number): VehicleHandle {
  const WHEEL_R = 0.36;
  const WHEEL_Z = [1.45, -1.35];

  const group = new THREE.Group();
  group.name = `convertible-${targetNodeId}`;

  const bodyMat = paintMat(HOT_PINK, 0.35);
  const leatherMat = mat(PEARL, 0.55);
  const chrome = chromeMat();
  const glass = glassMat();
  const tyreMat = mat(RUBBER, 0.95);
  const hubMat = chromeMat(0xffffff);

  const bodyShape = new THREE.Shape();
  bodyShape.moveTo(-2.05, WHEEL_R);
  archNotch(bodyShape, WHEEL_Z[1], WHEEL_R, 0.44, WHEEL_R);
  archNotch(bodyShape, WHEEL_Z[0], WHEEL_R, 0.44, WHEEL_R);
  bodyShape.lineTo(2.05, WHEEL_R);
  bodyShape.quadraticCurveTo(2.3, WHEEL_R, 2.3, 0.55);
  bodyShape.lineTo(2.25, 0.72);
  bodyShape.quadraticCurveTo(2.1, 0.86, 1.7, 0.9);
  bodyShape.lineTo(0.55, 0.98);
  bodyShape.lineTo(-1.2, 0.98);
  bodyShape.quadraticCurveTo(-1.9, 1.0, -2.2, 0.85);
  bodyShape.lineTo(-2.25, 0.6);
  bodyShape.quadraticCurveTo(-2.25, WHEEL_R, -2.05, WHEEL_R);
  group.add(shadowed(new THREE.Mesh(profileBody(bodyShape, 1.85, 0.12), bodyMat), true));

  const cockpit = new THREE.Mesh(rbox(1.5, 0.04, 1.9, 0.02), leatherMat);
  cockpit.position.set(0, 0.99, -0.35);
  group.add(cockpit);
  for (const z of [0.0, -0.85]) {
    for (const x of [-0.42, 0.42]) {
      const seat = new THREE.Mesh(rbox(0.6, 0.18, 0.55, 0.07), leatherMat);
      seat.position.set(x, 1.08, z);
      group.add(seat);
      const back = new THREE.Mesh(rbox(0.6, 0.55, 0.14, 0.07), leatherMat);
      back.position.set(x, 1.4, z - 0.28);
      back.rotation.x = -0.18;
      group.add(back);
    }
  }
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 8, 24), chrome);
  wheel.position.set(-0.42, 1.28, 0.3);
  wheel.rotation.x = -1.1;
  group.add(wheel);

  addPane(group, 1.5, 0.42, new THREE.Vector3(0, 1.18, 0.62), 0, glass, -0.5);
  const screenTop = new THREE.Mesh(rbox(1.56, 0.05, 0.05, 0.02), chrome);
  screenTop.position.set(0, 1.37, 0.52);
  group.add(screenTop);

  for (const z of WHEEL_Z) {
    for (const x of [-0.78, 0.78]) addWheel(group, x, z, WHEEL_R, 0.28, tyreMat, hubMat);
  }
  for (const z of [2.33, -2.28]) {
    const bumper = new THREE.Mesh(rbox(1.8, 0.12, 0.12, 0.05), chrome);
    bumper.position.set(0, 0.46, z);
    group.add(bumper);
  }
  const headMat = lampMat(LAMP_WARM, 2.8);
  for (const x of [-0.62, 0.62]) {
    const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 16), headMat);
    hl.rotation.x = Math.PI / 2;
    hl.position.set(x, 0.66, 2.28);
    group.add(hl);
  }
  const tailMat = lampMat(LAMP_RED, 2.6, 0x3a0705);
  for (const x of [-0.66, 0.66]) {
    const tl = new THREE.Mesh(rbox(0.24, 0.1, 0.04, 0.015), tailMat);
    tl.position.set(x, 0.74, -2.26);
    group.add(tl);
  }

  const heart = new THREE.Mesh(
    new THREE.ExtrudeGeometry(heartShape(0.12), { depth: 0.03, bevelEnabled: false }),
    new THREE.MeshStandardMaterial({ color: PEARL, emissive: 0xffffff, emissiveIntensity: 0.4 })
  );
  heart.position.set(0, 0.62, 2.3);
  group.add(heart);

  const hit = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.8, 4.8), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 0.9;
  hit.userData.vehicleRoot = group;
  group.add(hit);

  return makeHandle(group, hit, 'taxi', targetNodeId, {
    tint: [bodyMat],
    tintColor: 0xff8cc8,
    glow: [headMat],
  }, {
    rideOffsetY: 1.3,
    rideForwardLocal: new THREE.Vector3(0, 0, 1),
  });
}

// ---------------------------------------------------------------------------
// DREAM CAMPER — pearl-white motorhome with a cab-over sleeper, pink stripes and roof.
// ---------------------------------------------------------------------------
export function createDreamCamper(targetNodeId: number): VehicleHandle {
  const WHEEL_R = 0.5;
  const WHEEL_Z = [2.3, -2.2];
  const SILL = 0.3;

  const group = new THREE.Group();
  group.name = `dream-camper-${targetNodeId}`;

  const bodyMat = paintMat(PEARL, 0.1);
  const pinkMat = paintMat(HOT_PINK, 0.3);
  const softMat = paintMat(SOFT_PINK, 0.2);
  const glass = glassMat();
  const tyreMat = mat(RUBBER, 0.95);
  const hubMat = chromeMat(0xffffff);

  const bodyShape = new THREE.Shape();
  bodyShape.moveTo(-3.5, SILL);
  archNotch(bodyShape, WHEEL_Z[1], WHEEL_R, 0.6, SILL);
  archNotch(bodyShape, WHEEL_Z[0], WHEEL_R, 0.6, SILL);
  bodyShape.lineTo(3.45, SILL);
  bodyShape.quadraticCurveTo(3.65, SILL, 3.65, 0.5);
  bodyShape.lineTo(3.65, 1.3);
  bodyShape.lineTo(3.1, 2.15);
  bodyShape.lineTo(3.55, 2.35);
  bodyShape.quadraticCurveTo(3.6, 3.2, 3.2, 3.25);
  bodyShape.lineTo(-3.2, 3.25);
  bodyShape.quadraticCurveTo(-3.55, 3.25, -3.55, 2.9);
  bodyShape.lineTo(-3.55, 0.5);
  bodyShape.quadraticCurveTo(-3.55, SILL, -3.5, SILL);
  group.add(shadowed(new THREE.Mesh(profileBody(bodyShape, 2.4, 0.16), bodyMat), true));

  const lowerStripe = new THREE.Mesh(rbox(2.44, 0.32, 6.9, 0.06), pinkMat);
  lowerStripe.position.set(0, 1.0, -0.05);
  group.add(lowerStripe);
  const upperStripe = new THREE.Mesh(rbox(2.44, 0.12, 6.9, 0.04), softMat);
  upperStripe.position.set(0, 2.3, -0.2);
  group.add(upperStripe);
  const roof = new THREE.Mesh(rbox(2.2, 0.14, 6.2, 0.06), pinkMat);
  roof.position.set(0, 3.3, -0.2);
  group.add(roof);

  for (const side of [-1, 1] as const) {
    const rotY = (side * Math.PI) / 2;
    for (const z of [1.2, 0.05, -1.1, -2.25]) {
      addPane(group, 0.95, 0.7, new THREE.Vector3(side * 1.205, 1.75, z), rotY, glass);
    }
    addPane(group, 0.7, 0.5, new THREE.Vector3(side * 1.205, 1.8, 2.65), rotY, glass);
  }
  addPane(group, 2.0, 0.85, new THREE.Vector3(0, 1.73, 3.4), 0, glass, -0.575);
  addPane(group, 1.4, 0.4, new THREE.Vector3(0, 2.72, 3.58), 0, glass);
  addPane(group, 1.6, 0.6, new THREE.Vector3(0, 1.9, -3.56), Math.PI, glass);

  const door = new THREE.Mesh(rbox(0.05, 1.7, 0.8, 0.02), softMat);
  door.position.set(1.215, 1.2, -0.52);
  group.add(door);

  const signMat = textPlate('dream-camper-sign', 'DREAM CAMPER', '#fdf6f9', '#ff3fa4');
  for (const side of [-1, 1] as const) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.5), signMat);
    sign.position.set(side * 1.215, 2.75, -0.4);
    sign.rotation.y = (side * Math.PI) / 2;
    group.add(sign);
  }

  const headMat = lampMat(LAMP_WARM, 3);
  for (const x of [-0.82, 0.82]) {
    const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 16), headMat);
    hl.rotation.x = Math.PI / 2;
    hl.position.set(x, 0.72, 3.67);
    group.add(hl);
  }
  const tailMat = lampMat(LAMP_RED, 2.6, 0x3a0705);
  for (const x of [-0.95, 0.95]) {
    const tl = new THREE.Mesh(rbox(0.16, 0.3, 0.04, 0.015), tailMat);
    tl.position.set(x, 0.8, -3.57);
    group.add(tl);
  }
  for (const z of [3.69, -3.6]) {
    const bumper = new THREE.Mesh(rbox(2.3, 0.14, 0.16, 0.04), chromeMat());
    bumper.position.set(0, 0.42, z);
    group.add(bumper);
  }
  for (const z of WHEEL_Z) {
    for (const x of [-1.0, 1.0]) addWheel(group, x, z, WHEEL_R, 0.36, tyreMat, hubMat);
  }

  const hit = new THREE.Mesh(new THREE.BoxGeometry(2.8, 3.6, 7.8), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 1.8;
  hit.userData.vehicleRoot = group;
  group.add(hit);

  return makeHandle(group, hit, 'bus', targetNodeId, {
    tint: [bodyMat, pinkMat],
    tintColor: 0xff8cc8,
    glow: [headMat, signMat],
  }, {
    rideOffsetY: 1.9,
    rideForwardLocal: new THREE.Vector3(0, 0, 1),
  });
}

// ---------------------------------------------------------------------------
// DREAM SLIDE — a pastel tower set into the frontage with a spiral slide wrapping its
// turret and a glowing arched entrance where the slide plunges underground.
// ---------------------------------------------------------------------------
export function createDreamSlide(targetNodeId: number): VehicleHandle {
  const W = STATION_FOOTPRINT.width;
  const D = STATION_FOOTPRINT.depth;
  const H = 4.8;
  const ARCH_HALF = 1.35;
  const ARCH_SPRING = 1.9;

  const group = new THREE.Group();
  group.name = `dream-slide-${targetNodeId}`;

  const wallMat = mat(SOFT_PINK, 0.6);
  const trimMat = mat(PEARL, 0.5);
  const slideMat = paintMat(SLIDE_AQUA, 0.1);
  const innerMat = mat(0x5a1a3e, 1);

  const facade = new THREE.Shape();
  facade.moveTo(-W / 2, 0);
  facade.lineTo(W / 2, 0);
  facade.lineTo(W / 2, H);
  facade.lineTo(-W / 2, H);
  facade.lineTo(-W / 2, 0);
  const opening = new THREE.Path();
  opening.moveTo(-ARCH_HALF, 0.15);
  opening.lineTo(ARCH_HALF, 0.15);
  opening.lineTo(ARCH_HALF, ARCH_SPRING);
  opening.absarc(0, ARCH_SPRING, ARCH_HALF, 0, Math.PI, false);
  opening.lineTo(-ARCH_HALF, 0.15);
  facade.holes.push(opening);
  const front = shadowed(
    new THREE.Mesh(new THREE.ExtrudeGeometry(facade, { depth: 0.4, bevelEnabled: false, curveSegments: 20 }), wallMat),
    true
  );
  front.position.z = -0.4;
  group.add(front);

  for (const sx of [-1, 1]) {
    const side = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.35, H, D), wallMat), true);
    side.position.set(sx * (W / 2 - 0.175), H / 2, -D / 2);
    group.add(side);
  }
  const back = shadowed(new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.35), wallMat), true);
  back.position.set(0, H / 2, -D + 0.175);
  group.add(back);
  const cornice = shadowed(new THREE.Mesh(rbox(W + 0.3, 0.3, D + 0.3, 0.08), trimMat));
  cornice.position.set(0, H + 0.1, -D / 2);
  group.add(cornice);
  const archTrim = new THREE.Mesh(new THREE.TorusGeometry(ARCH_HALF + 0.08, 0.1, 10, 32, Math.PI), trimMat);
  archTrim.position.set(0, ARCH_SPRING, 0.02);
  group.add(archTrim);

  const innerDepth = 2.4;
  const innerBack = new THREE.Mesh(new THREE.BoxGeometry(ARCH_HALF * 2, 3.4, 0.1), innerMat);
  innerBack.position.set(0, 1.7, -0.4 - innerDepth);
  group.add(innerBack);
  for (const sx of [-1, 1]) {
    const innerSide = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3.4, innerDepth), innerMat);
    innerSide.position.set(sx * ARCH_HALF, 1.7, -0.4 - innerDepth / 2);
    group.add(innerSide);
  }
  const chute = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 2.6, -2.6),
        new THREE.Vector3(0, 1.8, -1.9),
        new THREE.Vector3(0, 0.9, -1.3),
        new THREE.Vector3(0, 0.25, -0.9),
      ]),
      24,
      0.42,
      12,
      false
    ),
    slideMat
  );
  group.add(chute);
  const glowMat = new THREE.MeshStandardMaterial({ color: 0x3a0f28, emissive: 0xff6ec7, emissiveIntensity: 1.8 });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(ARCH_HALF * 2 - 0.1, 3.2), glowMat);
  glow.position.set(0, 1.7, -0.4 - innerDepth + 0.07);
  group.add(glow);
  const glowLight = new THREE.PointLight(0xff8ad0, 8, 7, 1.8);
  glowLight.position.set(0, 1.4, -1.2);
  group.add(glowLight);

  const turretX = -W / 2 + 1.1;
  const turretZ = -D / 2;
  const turret = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 3.2, 24), trimMat));
  turret.position.set(turretX, H + 1.6, turretZ);
  group.add(turret);
  const turretCap = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.1, 24), mat(HOT_PINK, 0.5)));
  turretCap.position.set(turretX, H + 3.75, turretZ);
  group.add(turretCap);
  const helixPoints: THREE.Vector3[] = [];
  for (let i = 0; i <= 64; i++) {
    const u = i / 64;
    const a = u * Math.PI * 4;
    helixPoints.push(new THREE.Vector3(turretX + Math.cos(a) * 1.05, H + 3.0 - u * 2.8, turretZ + Math.sin(a) * 1.05));
  }
  const spiral = shadowed(
    new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(helixPoints), 128, 0.22, 10, false), slideMat)
  );
  group.add(spiral);

  const heartMat = new THREE.MeshStandardMaterial({ color: 0xff2d8f, emissive: 0xff2d8f, emissiveIntensity: 1.2 });
  const heart = new THREE.Mesh(
    new THREE.ExtrudeGeometry(heartShape(0.42), { depth: 0.12, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04 }),
    heartMat
  );
  heart.position.set(0, ARCH_SPRING + ARCH_HALF + 0.55, 0.05);
  group.add(heart);

  const signMat = textPlate('dream-slide-sign', 'DREAM SLIDE', '#fdf6f9', '#ff3fa4');
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.38), signMat);
  sign.position.set(0, ARCH_SPRING + ARCH_HALF + 1.2, 0.02);
  group.add(sign);

  const hit = new THREE.Mesh(new THREE.BoxGeometry(W + 0.4, H + 0.6, D + 1.6), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(0, H / 2, -D / 2 + 0.6);
  hit.userData.vehicleRoot = group;
  group.add(hit);

  return makeHandle(group, hit, 'underground', targetNodeId, {
    tint: [wallMat],
    tintColor: 0xff8cc8,
    glow: [glowMat, heartMat, signMat],
  }, {
    rideOffsetY: 0.4,
    rideForwardLocal: new THREE.Vector3(0, 0, -1),
    tunnelStyle: DREAM_SLIDE_TUNNEL,
  });
}

// ---------------------------------------------------------------------------
// PINK YACHT — white hull with a pink band, pink cabin and a sun-deck on top.
// ---------------------------------------------------------------------------
export function createPinkYacht(targetNodeId: number): VehicleHandle {
  const group = new THREE.Group();
  group.name = `pink-yacht-${targetNodeId}`;

  const hullMat = paintMat(PEARL, 0.1);
  const pinkMat = paintMat(HOT_PINK, 0.3);
  const deckMat = mat(0xe8c9a0, 0.8);
  const glass = glassMat();
  const chrome = chromeMat();

  const hullShape = new THREE.Shape();
  hullShape.moveTo(-3.1, -0.3);
  hullShape.lineTo(1.6, -0.3);
  hullShape.quadraticCurveTo(3.1, -0.2, 3.6, 0.95);
  hullShape.lineTo(-3.2, 0.95);
  hullShape.lineTo(-3.1, -0.3);
  group.add(shadowed(new THREE.Mesh(profileBody(hullShape, 2.8, 0.25), hullMat), true));

  const band = new THREE.Mesh(rbox(2.86, 0.18, 6.2, 0.06), pinkMat);
  band.position.set(0, 0.6, 0.15);
  group.add(band);
  const deck = new THREE.Mesh(rbox(2.5, 0.06, 6.3, 0.03), deckMat);
  deck.position.set(0, 0.98, 0.1);
  group.add(deck);

  const cabin = shadowed(new THREE.Mesh(rbox(2.0, 1.05, 3.0, 0.2), pinkMat));
  cabin.position.set(0, 1.52, -0.7);
  group.add(cabin);
  for (const side of [-1, 1] as const) {
    addPane(group, 2.4, 0.42, new THREE.Vector3(side * 1.005, 1.6, -0.7), (side * Math.PI) / 2, glass);
  }
  addPane(group, 1.6, 0.45, new THREE.Vector3(0, 1.62, 0.81), 0, glass, -0.2);
  const sunDeck = shadowed(new THREE.Mesh(rbox(2.2, 0.12, 3.4, 0.05), hullMat));
  sunDeck.position.set(0, 2.1, -0.8);
  group.add(sunDeck);
  for (const side of [-1, 1] as const) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 5.2, 8), chrome);
    rail.rotation.x = Math.PI / 2;
    rail.position.set(side * 1.2, 1.3, 0.3);
    group.add(rail);
    for (let z = -2.2; z <= 2.8; z += 1.0) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.32, 6), chrome);
      post.position.set(side * 1.2, 1.15, z);
      group.add(post);
    }
  }

  const flagMat = new THREE.MeshStandardMaterial({ color: 0xff2d8f, side: THREE.DoubleSide });
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 8), chrome);
  mast.position.set(0, 2.75, -2.3);
  group.add(mast);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.36), flagMat);
  flag.position.set(0, 3.15, -2.6);
  flag.rotation.y = Math.PI / 2;
  group.add(flag);

  const lampMatl = lampMat(LAMP_WARM, 2.6);
  const bowLamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), lampMatl);
  bowLamp.position.set(0, 1.1, 3.1);
  group.add(bowLamp);

  const hit = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.6, 8.0), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 1.4;
  hit.userData.vehicleRoot = group;
  group.add(hit);

  return makeHandle(group, hit, 'river', targetNodeId, {
    tint: [pinkMat, hullMat],
    tintColor: 0xff8cc8,
    glow: [lampMatl],
  }, {
    rideOffsetY: 1.8,
    rideForwardLocal: new THREE.Vector3(0, 0, 1),
  });
}
