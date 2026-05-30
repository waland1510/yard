// Shared London ambience: Belisha beacons at zebras, sparse phone-box silhouettes, a
// traffic-light pole at 3+-way junctions. Each builder returns a single Group; the caller
// places it.

import * as THREE from 'three';
import { BELISHA_AMBER, PHONEBOX_RED, TAXI_BLACK, CREAM } from './palette';
import { makeBeaconStripeTexture, makeTextTexture } from './canvas-textures';

type AddGeo = <T extends THREE.BufferGeometry>(g: T) => T;
type AddMat = <T extends THREE.Material>(m: T) => T;

export function buildBelishaBeacon(
  addGeo: AddGeo,
  addMat: AddMat,
  textures: THREE.Texture[]
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'belisha-beacon';

  const stripeTex = makeBeaconStripeTexture();
  textures.push(stripeTex);
  // Repeat the stripe vertically along the pole so we get more than 6 bands
  stripeTex.wrapT = THREE.RepeatWrapping;
  stripeTex.repeat.set(1, 1.5);
  const stripeMat = addMat(new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.7 }));
  const pole = new THREE.Mesh(addGeo(new THREE.CylinderGeometry(0.07, 0.08, 1.8, 10)), stripeMat);
  pole.position.y = 0.9;
  pole.castShadow = true;
  group.add(pole);

  const globe = new THREE.Mesh(
    addGeo(new THREE.SphereGeometry(0.22, 16, 12)),
    addMat(new THREE.MeshStandardMaterial({
      color: BELISHA_AMBER,
      emissive: BELISHA_AMBER,
      emissiveIntensity: 1.2,
      roughness: 0.4,
    }))
  );
  globe.position.y = 1.95;
  group.add(globe);

  const light = new THREE.PointLight(0xffb347, 0.45, 4.5, 1.8);
  light.position.y = 1.95;
  group.add(light);

  return group;
}

export function buildPhoneBox(
  addGeo: AddGeo,
  addMat: AddMat,
  textures: THREE.Texture[]
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'phone-box';

  const redMat = addMat(new THREE.MeshStandardMaterial({ color: PHONEBOX_RED, roughness: 0.75 }));
  const blackMat = addMat(new THREE.MeshStandardMaterial({ color: TAXI_BLACK, roughness: 0.5, metalness: 0.4 }));
  const glassMat = addMat(new THREE.MeshStandardMaterial({
    color: 0x1c2230,
    emissive: 0xfff3b8,
    emissiveIntensity: 0.18,
    roughness: 0.3,
  }));

  // Body
  const body = new THREE.Mesh(addGeo(new THREE.BoxGeometry(0.9, 2.4, 0.9)), redMat);
  body.position.y = 1.2;
  body.castShadow = true;
  group.add(body);
  // Glass-window suggestion — recessed darker plane on each visible side
  for (const [rotY, dx, dz] of [
    [0, 0, 0.451],
    [Math.PI, 0, -0.451],
    [Math.PI / 2, 0.451, 0],
    [-Math.PI / 2, -0.451, 0],
  ] as const) {
    const win = new THREE.Mesh(addGeo(new THREE.PlaneGeometry(0.68, 1.4)), glassMat);
    win.rotation.y = rotY;
    win.position.set(dx, 1.4, dz);
    group.add(win);
  }
  // Vertical mullions at the corners
  for (const [x, z] of [
    [0.42, 0.42],
    [-0.42, 0.42],
    [0.42, -0.42],
    [-0.42, -0.42],
  ]) {
    const m = new THREE.Mesh(addGeo(new THREE.BoxGeometry(0.05, 2.3, 0.05)), blackMat);
    m.position.set(x, 1.2, z);
    group.add(m);
  }
  // "TELEPHONE" sign at top
  const signTex = makeTextTexture('TELEPHONE', {
    width: 512,
    height: 96,
    bg: `#${PHONEBOX_RED.toString(16).padStart(6, '0')}`,
    fg: `#${CREAM.toString(16).padStart(6, '0')}`,
    fontPx: 64,
  });
  textures.push(signTex);
  const signMat = addMat(new THREE.MeshStandardMaterial({
    map: signTex,
    emissive: 0xfff3b8,
    emissiveMap: signTex,
    emissiveIntensity: 0.3,
  }));
  for (const [rotY, dx, dz] of [
    [0, 0, 0.46],
    [Math.PI, 0, -0.46],
    [Math.PI / 2, 0.46, 0],
    [-Math.PI / 2, -0.46, 0],
  ] as const) {
    const s = new THREE.Mesh(addGeo(new THREE.PlaneGeometry(0.78, 0.16)), signMat);
    s.rotation.y = rotY;
    s.position.set(dx, 2.3, dz);
    group.add(s);
  }
  // Crown cap
  const cap = new THREE.Mesh(addGeo(new THREE.BoxGeometry(0.95, 0.1, 0.95)), redMat);
  cap.position.y = 2.45;
  group.add(cap);
  const topper = new THREE.Mesh(addGeo(new THREE.BoxGeometry(0.55, 0.12, 0.55)), redMat);
  topper.position.y = 2.55;
  group.add(topper);

  return group;
}

export function buildTrafficLightPole(
  addGeo: AddGeo,
  addMat: AddMat
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'traffic-light';

  const black = addMat(new THREE.MeshStandardMaterial({ color: TAXI_BLACK, roughness: 0.55, metalness: 0.55 }));
  const pole = new THREE.Mesh(addGeo(new THREE.CylinderGeometry(0.08, 0.1, 5, 12)), black);
  pole.position.y = 2.5;
  pole.castShadow = true;
  group.add(pole);
  // Arm
  const arm = new THREE.Mesh(addGeo(new THREE.BoxGeometry(2.0, 0.12, 0.12)), black);
  arm.position.set(1.0, 4.8, 0);
  group.add(arm);
  // Housing (head)
  const head = new THREE.Mesh(addGeo(new THREE.BoxGeometry(0.4, 1.0, 0.32)), black);
  head.position.set(2.0, 4.4, 0);
  group.add(head);
  // Three lights — red lit, others dim
  const lights: Array<{ y: number; color: number; emissive: number; intensity: number }> = [
    { y: 4.75, color: 0xc73a3a, emissive: 0xc73a3a, intensity: 1.4 },
    { y: 4.4, color: 0xc7a13a, emissive: 0xc7a13a, intensity: 0.05 },
    { y: 4.05, color: 0x3ac76a, emissive: 0x3ac76a, intensity: 0.05 },
  ];
  for (const l of lights) {
    const disc = new THREE.Mesh(
      addGeo(new THREE.CircleGeometry(0.13, 24)),
      addMat(new THREE.MeshStandardMaterial({
        color: l.color,
        emissive: l.emissive,
        emissiveIntensity: l.intensity,
        roughness: 0.4,
      }))
    );
    disc.position.set(2.0, l.y, 0.17);
    group.add(disc);
  }
  return group;
}
