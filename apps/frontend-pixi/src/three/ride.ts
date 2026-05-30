import * as THREE from 'three';
import { World } from './world';
import { VehicleHandle, VehicleKind } from './vehicles';
import { createTunnelRig } from './tunnel';

interface RideConfig {
  approachMs: number;
  rideMs: number;
  fadeOutMs: number;
  fadeInMs: number;
  /** Forward speed in world units per second. */
  speed: number;
  /** Camera Y at the start of the ride (eye height inside the vehicle). */
  cameraY: number;
  /** Vertical micro-bob amplitude (m). */
  bobAmp: number;
  /** Vertical bob frequency (Hz). */
  bobHz: number;
  /** Lateral sway amplitude (m). */
  swayAmp: number;
  /** Lateral sway frequency (Hz). */
  swayHz: number;
}

const CONFIGS: Record<VehicleKind, RideConfig> = {
  taxi: {
    approachMs: 550,
    rideMs: 1500,
    fadeOutMs: 450,
    fadeInMs: 450,
    speed: 28,
    cameraY: 1.25,
    bobAmp: 0.015,
    bobHz: 1.2,
    swayAmp: 0.025,
    swayHz: 0.6,
  },
  bus: {
    approachMs: 650,
    rideMs: 1800,
    fadeOutMs: 500,
    fadeInMs: 450,
    speed: 18,
    cameraY: 2.7,
    bobAmp: 0.02,
    bobHz: 0.9,
    swayAmp: 0.04,
    swayHz: 0.4,
  },
  underground: {
    // Underground has its own special phases — see below.
    approachMs: 500,
    rideMs: 2000,
    fadeOutMs: 600,
    fadeInMs: 500,
    speed: 40,
    cameraY: 1.6, // start at street level; descent happens during ride
    bobAmp: 0,
    bobHz: 0,
    swayAmp: 0.03,
    swayHz: 1.5,
  },
  river: {
    // Boat ride — slow, gentle rocking
    approachMs: 600,
    rideMs: 2000,
    fadeOutMs: 500,
    fadeInMs: 500,
    speed: 14,
    cameraY: 2.3,
    bobAmp: 0.06,
    bobHz: 0.4,
    swayAmp: 0.05,
    swayHz: 0.3,
  },
};

export interface RideOverlay {
  setFade: (alpha: number) => void;
  setBlur: (px: number) => void;
  setLabel: (text: string | null) => void;
}

export async function playRide(
  world: World,
  vehicle: VehicleHandle,
  overlay: RideOverlay,
  swapScene: () => void
): Promise<void> {
  const cfg = CONFIGS[vehicle.kind];
  const camera = world.camera;
  const startPos = camera.position.clone();
  const startQuat = camera.quaternion.clone();

  const vehicleWorld = new THREE.Vector3();
  vehicle.group.getWorldPosition(vehicleWorld);

  // World-space ride forward direction.
  const rideForward = vehicle.rideForwardLocal
    .clone()
    .applyQuaternion(vehicle.group.quaternion)
    .normalize();
  // Lateral direction (right side of forward, used for sway)
  const rideRight = new THREE.Vector3(0, 1, 0).cross(rideForward).normalize();

  // Where the camera should sit at the start of the ride.
  const seatPos = vehicleWorld.clone();
  seatPos.y = cfg.cameraY;
  if (vehicle.kind === 'underground') {
    // Stop just at the top of the stairs, looking down into the entrance.
    seatPos.add(rideForward.clone().multiplyScalar(0.6));
  } else {
    seatPos.add(rideForward.clone().multiplyScalar(0.6));
  }

  // Look direction during ride
  const lookTarget = seatPos.clone().add(rideForward.clone().multiplyScalar(40));
  if (vehicle.kind === 'underground') {
    // Look slightly down into the stairwell during the approach.
    lookTarget.y -= 8;
  }
  const finalQuat = new THREE.Quaternion();
  const lookM = new THREE.Matrix4();
  lookM.lookAt(seatPos, lookTarget, new THREE.Vector3(0, 1, 0));
  finalQuat.setFromRotationMatrix(lookM);

  // ---- Phase 1: approach ----
  await tween(cfg.approachMs, (t) => {
    const e = ease(t);
    camera.position.lerpVectors(startPos, seatPos, e);
    camera.quaternion.copy(startQuat).slerp(finalQuat, e);
  });

  // Hide the vehicle now that we're "inside" it
  vehicle.group.visible = false;

  // ---- Phase 2: ride forward ----
  if (vehicle.kind === 'underground') {
    // Mount a concrete tunnel + stairs + train around the camera so the descent reads as
    // entering an underground station rather than flying below the city.
    const rig = createTunnelRig(seatPos, rideForward);
    world.scene.add(rig.group);
    const originalFog = world.scene.fog;
    const originalBg = world.scene.background;
    world.scene.fog = new THREE.Fog(0x0a0a0c, 6, 38);
    world.scene.background = new THREE.Color(0x05050a);
    try {
      await playUndergroundRide(camera, seatPos, rideForward, rideRight, cfg, overlay);
    } finally {
      world.scene.remove(rig.group);
      rig.dispose();
      world.scene.fog = originalFog;
      world.scene.background = originalBg;
    }
  } else {
    await playRoadRide(camera, seatPos, rideForward, rideRight, finalQuat, cfg, overlay);
  }

  // ---- Phase 3: blackout, swap scene, fade back ----
  overlay.setFade(1);
  overlay.setBlur(8);
  swapScene();

  await wait(120);

  await tween(cfg.fadeInMs, (t) => {
    overlay.setFade(1 - t);
    overlay.setBlur(8 * (1 - t));
  });
  overlay.setFade(0);
  overlay.setBlur(0);
}

async function playRoadRide(
  camera: THREE.PerspectiveCamera,
  rideStart: THREE.Vector3,
  rideForward: THREE.Vector3,
  rideRight: THREE.Vector3,
  finalQuat: THREE.Quaternion,
  cfg: RideConfig,
  overlay: RideOverlay
) {
  const totalDistance = cfg.speed * (cfg.rideMs / 1000);
  await tween(cfg.rideMs, (t) => {
    const distance = totalDistance * easeForward(t);
    // Convert progress to absolute elapsed seconds for time-based oscillations
    const elapsed = t * (cfg.rideMs / 1000);

    // Smooth, slow vertical micro-bob — vehicle bouncing on suspension
    const bobY = Math.sin(elapsed * cfg.bobHz * Math.PI * 2) * cfg.bobAmp;
    // Slow lateral sway (different frequency so it doesn't sync with bob)
    const swayX = Math.sin(elapsed * cfg.swayHz * Math.PI * 2 + 0.7) * cfg.swayAmp;

    const pos = rideStart.clone()
      .add(rideForward.clone().multiplyScalar(distance))
      .add(rideRight.clone().multiplyScalar(swayX));
    pos.y += bobY;
    camera.position.copy(pos);

    // Slight forward pitch when accelerating, then settle.
    const pitchKick = -0.04 * Math.max(0, 1 - t * 3); // strongest at t=0, gone by t=0.33
    // Mild roll from sway
    const rollFromSway = -swayX * 0.4;
    const sway = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(pitchKick, 0, rollFromSway, 'YXZ')
    );
    camera.quaternion.copy(finalQuat).multiply(sway);

    // Fade out in the last fadeOutMs of the ride
    const fadeStart = 1 - cfg.fadeOutMs / cfg.rideMs;
    if (t > fadeStart) {
      const ft = (t - fadeStart) / (1 - fadeStart);
      overlay.setFade(ft);
      overlay.setBlur(ft * 8);
    }
  });
}

async function playUndergroundRide(
  camera: THREE.PerspectiveCamera,
  rideStart: THREE.Vector3,
  rideForward: THREE.Vector3,
  rideRight: THREE.Vector3,
  cfg: RideConfig,
  overlay: RideOverlay
) {
  // Phase A: descend stairs (35% of ride). Camera drops ~5 units; slight forward motion.
  // Phase B: tunnel ride (rest of ride). Stay at depth, accelerate forward.
  const descentEnd = 0.35;
  const descentDepth = 5.5;
  const tunnelSpeed = cfg.speed;

  let descentForward = 0;
  await tween(cfg.rideMs, (t) => {
    const elapsed = t * (cfg.rideMs / 1000);

    let y: number;
    let forwardDistance: number;
    let pitch = 0;

    if (t < descentEnd) {
      // Descent phase — ease into the depth
      const u = t / descentEnd;
      const e = easeOutCubic(u);
      y = -descentDepth * e;
      // Small forward step while descending (slow walk down stairs)
      forwardDistance = 1.5 * e;
      descentForward = forwardDistance;
      // Tilt camera down during descent
      pitch = -0.45 * e;
    } else {
      // Tunnel phase — accelerate forward at depth
      const u = (t - descentEnd) / (1 - descentEnd);
      y = -descentDepth;
      const tunnelDist = tunnelSpeed * ((cfg.rideMs / 1000) * (1 - descentEnd)) * easeOutCubic(u);
      forwardDistance = descentForward + tunnelDist;
      // Bring pitch back up as we level out into the tunnel
      pitch = -0.45 * Math.max(0, 1 - u * 2);
    }

    // Lateral sway — feels like a tube car rocking
    const swayX = Math.sin(elapsed * cfg.swayHz * Math.PI * 2) * cfg.swayAmp;

    const pos = rideStart.clone()
      .add(rideForward.clone().multiplyScalar(forwardDistance))
      .add(rideRight.clone().multiplyScalar(swayX));
    pos.y += y;
    camera.position.copy(pos);

    // Reconstruct camera orientation: face forward with pitch + slight roll from sway
    const baseM = new THREE.Matrix4();
    const lookTarget = pos.clone().add(rideForward.clone().multiplyScalar(20));
    baseM.lookAt(pos, lookTarget, new THREE.Vector3(0, 1, 0));
    const base = new THREE.Quaternion().setFromRotationMatrix(baseM);
    const local = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(pitch, 0, -swayX * 0.5, 'YXZ')
    );
    camera.quaternion.copy(base).multiply(local);

    // Fade earlier than road rides — tunnel is darker
    const fadeStart = 1 - cfg.fadeOutMs / cfg.rideMs;
    if (t > fadeStart) {
      const ft = (t - fadeStart) / (1 - fadeStart);
      overlay.setFade(ft);
      overlay.setBlur(ft * 10);
    } else if (t > descentEnd) {
      // Slight darkening through the tunnel section
      const tunnelProgress = (t - descentEnd) / (1 - descentEnd);
      overlay.setFade(0.25 * Math.min(1, tunnelProgress * 2));
    } else {
      // During descent, fade in some darkness as we go below ground
      overlay.setFade(0.25 * (t / descentEnd));
    }
  });
}

function tween(ms: number, onFrame: (t: number) => void): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now();
    function step(now: number) {
      const t = Math.min(1, (now - start) / ms);
      onFrame(t);
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    }
    requestAnimationFrame(step);
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeForward(t: number): number {
  // Accelerate then cruise — feels like a vehicle pulling away.
  // Distance fraction goes 0 → 1 smoothly with weighty acceleration.
  if (t < 0.25) {
    const u = t / 0.25;
    return 0.18 * u * u; // slow start
  }
  const u = (t - 0.25) / 0.75;
  return 0.18 + 0.82 * (1 - Math.pow(1 - u, 2));
}
