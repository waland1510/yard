import * as THREE from 'three';

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

export function createTaxi(targetNodeId: number): VehicleHandle {
  const group = new THREE.Group();
  group.name = `taxi-${targetNodeId}`;

  const bodyMat = new THREE.MeshStandardMaterial({ color: TAXI_BODY, roughness: 0.45, metalness: 0.3 });
  const darkMat = new THREE.MeshStandardMaterial({ color: TAXI_DARK, roughness: 0.6 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x10131a, roughness: 0.3, metalness: 0.4 });

  // Chassis lower (longer, flatter)
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.5, 4.4), bodyMat);
  chassis.position.y = 0.55;
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  group.add(chassis);

  // Cabin upper (shorter, taller)
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.85, 2.4), bodyMat);
  cabin.position.set(0, 1.2, -0.2);
  cabin.castShadow = true;
  group.add(cabin);

  // Windows (front, rear, sides) as dark slabs
  const winFront = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.6), glassMat);
  winFront.position.set(0, 1.25, 1.01);
  winFront.rotation.x = -0.12;
  cabin.add(winFront);
  const winRear = winFront.clone();
  winRear.position.set(0, 1.25, -1.01);
  winRear.rotation.x = 0.12;
  winRear.rotation.y = Math.PI;
  cabin.add(winRear);

  for (const side of [-1, 1]) {
    const sideWin = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.55), glassMat);
    sideWin.position.set(side * 0.93, 1.25, -0.2);
    sideWin.rotation.y = side * Math.PI / 2;
    group.add(sideWin);
  }

  // Wheels
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1d, roughness: 0.9 });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xb9b9b9, roughness: 0.4, metalness: 0.7 });
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 18);
  for (const [x, z] of [[-0.95, -1.5], [0.95, -1.5], [-0.95, 1.5], [0.95, 1.5]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.42, z);
    w.castShadow = true;
    group.add(w);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.32, 12), hubMat);
    hub.rotation.z = Math.PI / 2;
    hub.position.set(x, 0.42, z);
    group.add(hub);
  }

  // Roof sign "TAXI"
  const roofSignBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.25, 0.4),
    new THREE.MeshStandardMaterial({ color: darkMat.color, roughness: 0.6 })
  );
  roofSignBase.position.set(0, 1.78, -0.2);
  group.add(roofSignBase);
  const roofSignGlow = new THREE.Mesh(
    new THREE.BoxGeometry(0.88, 0.18, 0.36),
    new THREE.MeshStandardMaterial({
      color: 0xfff4cc,
      emissive: 0xffcc66,
      emissiveIntensity: 1.4,
    })
  );
  roofSignGlow.position.set(0, 1.83, -0.2);
  group.add(roofSignGlow);

  // Headlights
  for (const x of [-0.7, 0.7]) {
    const hl = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 12, 8),
      new THREE.MeshStandardMaterial({ color: 0xfff8d8, emissive: 0xfff0c4, emissiveIntensity: 1.2 })
    );
    hl.position.set(x, 0.7, 2.18);
    group.add(hl);
  }

  // Wide invisible hit volume on top — easy to click
  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 1.9, 4.8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.position.y = 1.0;
  hit.userData.vehicleRoot = group;
  group.add(hit);

  return makeHandle(group, hit, 'taxi', targetNodeId, [bodyMat, roofSignGlow.material as THREE.MeshStandardMaterial], {
    rideOffsetY: 1.15,
    rideForwardLocal: new THREE.Vector3(0, 0, 1),
  });
}

export function createBus(targetNodeId: number): VehicleHandle {
  const group = new THREE.Group();
  group.name = `bus-${targetNodeId}`;

  const bodyMat = new THREE.MeshStandardMaterial({ color: BUS_BODY, roughness: 0.55, metalness: 0.2 });
  const trimMat = new THREE.MeshStandardMaterial({ color: BUS_TRIM, roughness: 0.7 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x111723, roughness: 0.3, metalness: 0.4 });

  // Lower deck
  const lower = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 7.5), bodyMat);
  lower.position.y = 1.0;
  lower.castShadow = true;
  lower.receiveShadow = true;
  group.add(lower);

  // Upper deck (slightly narrower, sits on top)
  const upper = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.5, 7.3), bodyMat);
  upper.position.y = 2.45;
  upper.castShadow = true;
  group.add(upper);

  // Roof
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(2.35, 0.12, 7.35),
    new THREE.MeshStandardMaterial({ color: 0x8a1f1f, roughness: 0.8 })
  );
  roof.position.y = 3.27;
  group.add(roof);

  // Window bands: 2 stripes
  for (const y of [1.4, 2.85]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(2.42, 0.6, 7.42), glassMat);
    band.position.y = y;
    group.add(band);
  }

  // Trim line between decks
  const trim = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.18, 7.45), trimMat);
  trim.position.y = 1.83;
  group.add(trim);

  // Destination sign
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.4, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x10131a, emissive: 0xfff4b8, emissiveIntensity: 0.8 })
  );
  sign.position.set(0, 3.05, 3.77);
  group.add(sign);

  // Wheels
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 0.9 });
  const wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.4, 18);
  for (const z of [-2.4, 2.4]) {
    for (const x of [-1.1, 1.1]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(x, 0.55, z);
      w.castShadow = true;
      group.add(w);
    }
  }

  // Headlights
  for (const x of [-0.8, 0.8]) {
    const hl = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 12, 8),
      new THREE.MeshStandardMaterial({ color: 0xfff8d8, emissive: 0xfff0c4, emissiveIntensity: 1.2 })
    );
    hl.position.set(x, 1.0, 3.77);
    group.add(hl);
  }

  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 3.6, 7.9),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.position.y = 1.8;
  hit.userData.vehicleRoot = group;
  group.add(hit);

  return makeHandle(group, hit, 'bus', targetNodeId, [bodyMat, sign.material as THREE.MeshStandardMaterial], {
    rideOffsetY: 1.7,
    rideForwardLocal: new THREE.Vector3(0, 0, 1),
  });
}

export function createUnderground(targetNodeId: number): VehicleHandle {
  const group = new THREE.Group();
  group.name = `underground-${targetNodeId}`;

  // Wide stair landing
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x8c857a, roughness: 0.95 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 3.6), baseMat);
  base.position.y = 0.15;
  base.receiveShadow = true;
  group.add(base);

  // Stairs going down (depressed below ground)
  for (let i = 0; i < 6; i++) {
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.18, 0.45),
      new THREE.MeshStandardMaterial({ color: 0x4d4a45, roughness: 1 })
    );
    step.position.set(0, -i * 0.18, -0.5 - i * 0.45);
    step.receiveShadow = true;
    group.add(step);
  }

  // Black void at the bottom of the stairs
  const void_ = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 2),
    new THREE.MeshBasicMaterial({ color: 0x000000 })
  );
  void_.rotation.x = -Math.PI / 2;
  void_.position.set(0, -1.0, -3.3);
  group.add(void_);

  // Side walls of stairwell
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xb8a98a, roughness: 0.95 });
  for (const sx of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.4, 3.6), wallMat);
    wall.position.set(sx * 1.3, 0.5, -1.8);
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);
  }

  // Soft warm glow at the top of the stair entrance — a single emissive lozenge stands in
  // for "the underground sign is somewhere here." The standalone Underground STOP nearby
  // carries the full TfL roundel + station-name lintel so we avoid double-roundels.
  const entryGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.0, 0.18),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfff7d4,
      emissiveIntensity: 0.9,
      side: THREE.DoubleSide,
    })
  );
  entryGlow.position.set(0, 2.4, 0.6);
  group.add(entryGlow);

  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 4.8, 4),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.position.set(0, 2.4, -0.4);
  hit.userData.vehicleRoot = group;
  group.add(hit);

  return makeHandle(
    group,
    hit,
    'underground',
    targetNodeId,
    [entryGlow.material as THREE.MeshStandardMaterial],
    {
      rideOffsetY: 0.4,
      // Stairs descend toward local -Z, so the ride forward direction in local space is -Z.
      rideForwardLocal: new THREE.Vector3(0, 0, -1),
    }
  );
}

export function createFerry(targetNodeId: number): VehicleHandle {
  const group = new THREE.Group();
  group.name = `ferry-${targetNodeId}`;

  // Hull
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x8b6b3f, roughness: 0.6 });
  const hullDark = new THREE.MeshStandardMaterial({ color: 0x4a3a25, roughness: 0.7 });
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0xf2eadb, roughness: 0.5 });
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x10131a,
    emissive: 0xfff3b8,
    emissiveIntensity: 0.55,
    roughness: 0.3,
  });

  // Lower hull (a wide flat box, slightly tapered via a separate trim)
  const hull = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.9, 7), hullMat);
  hull.position.y = 0.45;
  hull.castShadow = true;
  group.add(hull);

  // Hull bow chamfer — small wedge at the front to suggest a pointed prow
  const bow = new THREE.Mesh(new THREE.ConeGeometry(1.6, 1.6, 4), hullMat);
  bow.rotation.set(Math.PI / 2, Math.PI / 4, 0);
  bow.position.set(0, 0.45, 3.8);
  bow.scale.set(1, 1.8, 1);
  group.add(bow);

  // Waterline trim — darker band
  const trim = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.18, 7.1), hullDark);
  trim.position.y = 0.18;
  group.add(trim);

  // Cabin
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 3.5), cabinMat);
  cabin.position.set(0, 1.5, -0.5);
  cabin.castShadow = true;
  group.add(cabin);

  // Cabin roof
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 0.18, 3.6),
    new THREE.MeshStandardMaterial({ color: 0xc02f2f, roughness: 0.7 })
  );
  roof.position.set(0, 2.2, -0.5);
  group.add(roof);

  // Cabin window strip (each side)
  for (const side of [-1, 1]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.55), windowMat);
    win.position.set(side * (1.21), 1.6, -0.5);
    win.rotation.y = side === 1 ? -Math.PI / 2 : Math.PI / 2;
    group.add(win);
  }
  // Front windshield
  const winF = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.55), windowMat);
  winF.position.set(0, 1.6, 1.26);
  group.add(winF);

  // Mast with a small flag pole
  const mastMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: 0.6, metalness: 0.6 });
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 8), mastMat);
  mast.position.set(0, 3.1, -0.5);
  group.add(mast);
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.3),
    new THREE.MeshStandardMaterial({ color: 0xc02f2f, side: THREE.DoubleSide })
  );
  flag.position.set(0.35, 3.6, -0.5);
  group.add(flag);

  // Headlamp at the bow
  const headlamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0xfff8d8, emissive: 0xfff0c4, emissiveIntensity: 1.4 })
  );
  headlamp.position.set(0, 1.0, 4.0);
  group.add(headlamp);

  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 3.6, 7.4),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.position.y = 1.4;
  hit.userData.vehicleRoot = group;
  group.add(hit);

  return makeHandle(
    group,
    hit,
    'river',
    targetNodeId,
    [windowMat, headlamp.material as THREE.MeshStandardMaterial],
    {
      rideOffsetY: 1.8,
      rideForwardLocal: new THREE.Vector3(0, 0, 1),
    }
  );
}

function makeHandle(
  group: THREE.Group,
  hit: THREE.Mesh,
  kind: VehicleKind,
  targetNodeId: number,
  glowMats: THREE.MeshStandardMaterial[],
  opts: { rideOffsetY: number; rideForwardLocal: THREE.Vector3 }
): VehicleHandle {
  const baseEmissive = glowMats.map((m) => ({ color: m.emissive.clone(), intensity: m.emissiveIntensity }));
  return {
    group,
    kind,
    targetNodeId,
    hitMesh: hit,
    rideOffsetY: opts.rideOffsetY,
    rideForwardLocal: opts.rideForwardLocal.clone(),
    setHover: (hover) => {
      glowMats.forEach((m, i) => {
        if (hover) {
          m.emissive.setHex(0xffffff);
          m.emissiveIntensity = Math.max(baseEmissive[i].intensity, 1.0) * 1.6;
        } else {
          m.emissive.copy(baseEmissive[i].color);
          m.emissiveIntensity = baseEmissive[i].intensity;
        }
      });
      group.scale.setScalar(hover ? 1.04 : 1.0);
    },
  };
}
