import * as THREE from 'three';

export interface TunnelRig {
  group: THREE.Group;
  dispose: () => void;
}

/**
 * Builds a dark concrete tunnel that surrounds the camera during the underground ride.
 * The tunnel is a long box rendered inside-out (BackSide) so the camera looks at its
 * interior walls, occluding the city above. Includes emissive ceiling lights every few
 * meters and point lights for ambient illumination.
 *
 * `start` is the world position of the entrance (top of the stairs).
 * `forward` is the unit direction the tunnel extends in.
 */
export function createTunnelRig(
  start: THREE.Vector3,
  forward: THREE.Vector3
): TunnelRig {
  const LENGTH = 120;
  const WIDTH = 5.2;
  const CEILING_Y = 2.5;   // a bit above street level (so the entrance arch is hidden)
  const FLOOR_Y = -7.5;    // deeper than the deepest camera dive
  const HEIGHT = CEILING_Y - FLOOR_Y;

  const group = new THREE.Group();
  group.name = 'tunnel-rig';

  const disposables: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const addGeo = <T extends THREE.BufferGeometry>(g: T) => { disposables.push(g); return g; };
  const addMat = <T extends THREE.Material>(m: T) => { materials.push(m); return m; };

  const yaw = Math.atan2(forward.x, forward.z);
  const center = start.clone().add(forward.clone().multiplyScalar(LENGTH / 2));
  center.y = (FLOOR_Y + CEILING_Y) / 2;

  // Inside-out concrete box — the walls and ceiling
  const wallMat = addMat(new THREE.MeshStandardMaterial({
    color: 0x1d1d20,
    roughness: 1,
    side: THREE.BackSide,
    metalness: 0,
  }));
  const box = new THREE.Mesh(addGeo(new THREE.BoxGeometry(WIDTH, HEIGHT, LENGTH)), wallMat);
  box.position.copy(center);
  box.rotation.y = yaw;
  group.add(box);

  // Brighter floor (tile pattern feel just via a separate plane in a slightly different colour)
  const floorMat = addMat(new THREE.MeshStandardMaterial({
    color: 0x2c2620,
    roughness: 0.9,
  }));
  const floor = new THREE.Mesh(addGeo(new THREE.PlaneGeometry(WIDTH - 0.05, LENGTH - 0.05)), floorMat);
  floor.position.copy(center);
  floor.position.y = FLOOR_Y + 0.02;
  floor.rotation.set(-Math.PI / 2, yaw, 0);
  group.add(floor);

  // Track rails — two thin yellow stripes running the length
  const stripeMat = addMat(new THREE.MeshStandardMaterial({
    color: 0x44382a,
    emissive: 0xaa6a1a,
    emissiveIntensity: 0.15,
  }));
  for (const offset of [-0.7, 0.7]) {
    const stripe = new THREE.Mesh(addGeo(new THREE.PlaneGeometry(0.08, LENGTH - 0.05)), stripeMat);
    stripe.position.copy(center);
    stripe.position.y = FLOOR_Y + 0.06;
    stripe.rotation.set(-Math.PI / 2, yaw, 0, 'YXZ');
    // Shift by `offset` along the lateral direction
    const right = new THREE.Vector3(0, 1, 0).cross(forward).normalize();
    stripe.position.add(right.multiplyScalar(offset));
    group.add(stripe);
  }

  // Ceiling lights — recessed strip lights every 7m
  const lightStripGeo = addGeo(new THREE.BoxGeometry(1.6, 0.06, 0.35));
  const lightStripMat = addMat(new THREE.MeshStandardMaterial({
    color: 0xfff5c8,
    emissive: 0xfff5c8,
    emissiveIntensity: 5,
  }));
  for (let dist = 3; dist < LENGTH; dist += 7) {
    const pos = start.clone().add(forward.clone().multiplyScalar(dist));
    pos.y = CEILING_Y - 0.05;

    const strip = new THREE.Mesh(lightStripGeo, lightStripMat);
    strip.position.copy(pos);
    strip.rotation.y = yaw;
    group.add(strip);

    // Cheap fill light to actually illuminate the walls nearby
    const pl = new THREE.PointLight(0xfff5c8, 1.2, 10, 1.6);
    pl.position.copy(pos);
    pl.position.y -= 0.6;
    group.add(pl);
  }

  // Frame the entrance: a slightly darker arch at the start so the transition reads as "going in"
  const archMat = addMat(new THREE.MeshStandardMaterial({ color: 0x101012, roughness: 1 }));
  const arch = new THREE.Mesh(addGeo(new THREE.BoxGeometry(WIDTH + 0.4, HEIGHT * 0.6, 0.4)), archMat);
  arch.position.copy(start).add(forward.clone().multiplyScalar(0.4));
  arch.position.y = CEILING_Y - HEIGHT * 0.3;
  arch.rotation.y = yaw;
  group.add(arch);

  // Staircase descending into the tunnel near the entrance.
  // Each step is a thin slab that occupies a sliver of the descent.
  const stepMat = addMat(new THREE.MeshStandardMaterial({ color: 0x55514a, roughness: 1 }));
  const railMat = addMat(new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: 0.6, metalness: 0.5 }));
  const STAIRS = 18;
  const STAIR_RUN = 0.55;
  const STAIR_RISE = 0.45;
  const STAIRS_START_Y = CEILING_Y - 0.2;
  const STAIRS_START_DIST = 0.6;
  const right = new THREE.Vector3(0, 1, 0).cross(forward).normalize();
  for (let i = 0; i < STAIRS; i++) {
    const stepGeo = addGeo(new THREE.BoxGeometry(WIDTH - 0.6, 0.12, STAIR_RUN));
    const step = new THREE.Mesh(stepGeo, stepMat);
    step.position.copy(start)
      .add(forward.clone().multiplyScalar(STAIRS_START_DIST + i * STAIR_RUN));
    step.position.y = STAIRS_START_Y - i * STAIR_RISE;
    step.rotation.y = yaw;
    group.add(step);

    // Step riser (vertical slab between this step and the next)
    if (i < STAIRS - 1) {
      const riserGeo = addGeo(new THREE.BoxGeometry(WIDTH - 0.6, STAIR_RISE, 0.06));
      const riser = new THREE.Mesh(riserGeo, stepMat);
      riser.position.copy(step.position);
      riser.position.y -= STAIR_RISE / 2;
      riser.position.add(forward.clone().multiplyScalar(STAIR_RUN / 2));
      riser.rotation.y = yaw;
      group.add(riser);
    }
  }
  // Handrails — two metal tubes following the stair descent
  for (const side of [-1, 1]) {
    const railLen = STAIRS * STAIR_RUN;
    const railGeo = addGeo(new THREE.CylinderGeometry(0.05, 0.05, railLen, 8));
    const rail = new THREE.Mesh(railGeo, railMat);
    // Position halfway along the stair run
    rail.position.copy(start)
      .add(forward.clone().multiplyScalar(STAIRS_START_DIST + railLen / 2))
      .add(right.clone().multiplyScalar(side * (WIDTH / 2 - 0.4)));
    rail.position.y = STAIRS_START_Y - (STAIRS * STAIR_RISE) / 2 + 0.9;
    // Rotate to lie along forward, tilted to match stair slope
    const slope = Math.atan2(STAIR_RISE, STAIR_RUN); // descent angle
    rail.rotation.set(Math.PI / 2 + slope, yaw, 0);
    group.add(rail);
  }

  // A tube train resting ahead in the tunnel — headlights on, windows lit.
  const trainStart = LENGTH * 0.55;
  const train = buildTubeTrain(addGeo, addMat);
  train.position.copy(start)
    .add(forward.clone().multiplyScalar(trainStart));
  train.position.y = FLOOR_Y + 0.05;
  train.rotation.y = yaw;
  group.add(train);

  return {
    group,
    dispose: () => {
      for (const g of disposables) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}

function buildTubeTrain(
  addGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  addMat: <T extends THREE.Material>(m: T) => T
): THREE.Group {
  const train = new THREE.Group();
  const LEN = 18;
  const W = 2.6;
  const H = 2.6;

  // Main body (oval-ish via a chamfered box)
  const bodyMat = addMat(new THREE.MeshStandardMaterial({
    color: 0xc83a3a,
    roughness: 0.45,
    metalness: 0.4,
  }));
  const body = new THREE.Mesh(addGeo(new THREE.BoxGeometry(W, H, LEN)), bodyMat);
  body.position.y = H / 2 + 0.25;
  train.add(body);

  // Roof curved cap (slightly narrower, on top)
  const roofMat = addMat(new THREE.MeshStandardMaterial({ color: 0xefe4d0, roughness: 0.6 }));
  const roof = new THREE.Mesh(addGeo(new THREE.BoxGeometry(W - 0.2, 0.3, LEN - 0.2)), roofMat);
  roof.position.y = H + 0.4;
  train.add(roof);

  // Window band — long emissive plane on each side
  const winMat = addMat(new THREE.MeshStandardMaterial({
    color: 0xfff3b8,
    emissive: 0xfff3b8,
    emissiveIntensity: 1.6,
  }));
  for (const side of [-1, 1]) {
    const win = new THREE.Mesh(addGeo(new THREE.PlaneGeometry(LEN - 1.2, 0.7)), winMat);
    win.position.set(side * (W / 2 + 0.005), H * 0.55, 0);
    win.rotation.y = side === 1 ? -Math.PI / 2 : Math.PI / 2;
    train.add(win);
  }

  // Window divider bars (so it doesn't look like one long blob)
  const divMat = addMat(new THREE.MeshStandardMaterial({ color: 0x6a1f1f, roughness: 0.6 }));
  for (const side of [-1, 1]) {
    for (let i = -3; i <= 3; i++) {
      const div = new THREE.Mesh(addGeo(new THREE.BoxGeometry(0.06, 0.85, 0.18)), divMat);
      div.position.set(side * (W / 2 + 0.01), H * 0.55, i * 2.5);
      train.add(div);
    }
  }

  // Front face: cab with windshield and two headlights
  const cabMat = addMat(new THREE.MeshStandardMaterial({ color: 0xa02828, roughness: 0.5 }));
  const cab = new THREE.Mesh(addGeo(new THREE.BoxGeometry(W - 0.05, H * 0.85, 0.3)), cabMat);
  cab.position.set(0, H / 2 + 0.25, -LEN / 2);
  train.add(cab);

  const windshieldMat = addMat(new THREE.MeshStandardMaterial({
    color: 0x0c1a26,
    roughness: 0.25,
    metalness: 0.6,
  }));
  const windshield = new THREE.Mesh(addGeo(new THREE.PlaneGeometry(W - 0.6, H * 0.45)), windshieldMat);
  windshield.position.set(0, H * 0.7, -LEN / 2 - 0.16);
  windshield.rotation.y = Math.PI;
  train.add(windshield);

  const headMat = addMat(new THREE.MeshStandardMaterial({
    color: 0xfffceb,
    emissive: 0xfff2c4,
    emissiveIntensity: 3.5,
  }));
  for (const x of [-0.7, 0.7]) {
    const head = new THREE.Mesh(addGeo(new THREE.SphereGeometry(0.18, 12, 8)), headMat);
    head.position.set(x, H * 0.32, -LEN / 2 - 0.18);
    train.add(head);
  }

  // Headlight cones — point lights pointing back toward the camera
  const headLight = new THREE.PointLight(0xfff2c4, 2.5, 25, 1.8);
  headLight.position.set(0, H * 0.4, -LEN / 2 - 0.5);
  train.add(headLight);

  // Wheels (suggestion — barely visible but they sell the silhouette)
  const wheelMat = addMat(new THREE.MeshStandardMaterial({ color: 0x101012, roughness: 0.95 }));
  const wheelGeo = addGeo(new THREE.CylinderGeometry(0.42, 0.42, 0.25, 16));
  for (const z of [-LEN / 2 + 2.5, -LEN / 2 + 6, LEN / 2 - 6, LEN / 2 - 2.5]) {
    for (const x of [-W / 2 + 0.15, W / 2 - 0.15]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(x, 0.42, z);
      train.add(w);
    }
  }

  // Subtle interior glow as a fill light
  const interiorLight = new THREE.PointLight(0xfff3b8, 0.6, 12, 2);
  interiorLight.position.set(0, H * 0.6, 0);
  train.add(interiorLight);

  return train;
}
