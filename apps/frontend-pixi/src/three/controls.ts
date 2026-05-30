// First-person pointer-lock controls. The camera is anchored at eye height at the
// world origin and rotates via mouse delta (yaw around world Y, pitch clamped just
// short of vertical). Clicking the canvas requests pointer lock; once locked the
// cursor is hidden and movement events report raw deltas. A screen-center
// raycaster picks the vehicle the player is looking at; clicking while locked
// triggers onVehicleClick on that vehicle.
//
// Constraints:
//   - pitch is clamped to (-PI/2 + epsilon, PI/2 - epsilon) so the player can't
//     flip the camera through the poles
//   - mouse delta sensitivity is tuned for a 1080p display; can be parameterised
//     later if needed
//   - clicking is only treated as a vehicle pick while pointer lock is active;
//     the first click on the canvas is consumed to acquire pointer lock
//
// The dive-to-street cinematic ride (ride.ts) temporarily disables these controls
// while it owns the camera, then re-enables on arrival at the new node.
// Pressing ESC releases pointer lock via the browser; game.tsx listens for
// pointerlockchange to surface that state to the rest of the UI (intro overlay,
// crosshair, etc).

import * as THREE from 'three';
import { VehicleHandle } from './vehicles';

export interface PovControlsOpts {
  canvas: HTMLCanvasElement;
  camera: THREE.PerspectiveCamera;
  getVehicles: () => VehicleHandle[];
  onVehicleClick: (v: VehicleHandle) => void;
  onHoverChange: (v: VehicleHandle | null) => void;
  /** Per-frame hook registration — used to drive the screen-center hover ray. */
  addTick: (fn: () => void) => () => void;
}

export interface PovControls {
  enable: () => void;
  disable: () => void;
  detach: () => void;
  setEnabled: (b: boolean) => void;
  /** Re-park the camera at the default forward-facing orientation (called on node
   *  change / after a ride completes). Does not auto-request pointer lock — the
   *  caller owns lock acquisition via user-gesture handlers. */
  resetView: () => void;
  /** True while document.pointerLockElement === canvas. The game.tsx
   *  pointerlockchange listener mirrors this into React state. */
  isPointerLocked: () => boolean;
}

const MOUSE_SENSITIVITY = 0.0022;
const PITCH_LIMIT = Math.PI / 2 - 0.05;
const EYE_HEIGHT = 1.7;

export function createPovControls({
  canvas,
  camera,
  getVehicles,
  onVehicleClick,
  onHoverChange,
  addTick,
}: PovControlsOpts): PovControls {
  // Camera sits at eye height at world origin; vehicles are placed on the
  // surrounding road arms at ±(ROAD_HALF+2). Yaw rotates around world Y, pitch
  // around the local X axis — composed via a YXZ Euler so roll stays at zero.
  camera.position.set(0, EYE_HEIGHT, 0);
  camera.rotation.set(0, 0, 0);

  let yaw = 0;
  let pitch = 0;
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');

  function applyOrientation() {
    euler.set(pitch, yaw, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler);
  }

  function resetView() {
    yaw = 0;
    pitch = 0;
    camera.position.set(0, EYE_HEIGHT, 0);
    applyOrientation();
  }

  resetView();

  let enabled = true;
  let hovered: VehicleHandle | null = null;
  const raycaster = new THREE.Raycaster();
  // Screen-center ray — pointer lock hides the OS cursor, so the crosshair is
  // always at NDC (0, 0).
  const screenCenter = new THREE.Vector2(0, 0);

  function isLocked(): boolean {
    return document.pointerLockElement === canvas;
  }

  function pickVehicle(): VehicleHandle | null {
    raycaster.setFromCamera(screenCenter, camera);
    const vehicles = getVehicles();
    const meshes = vehicles.map((v) => v.hitMesh);
    const hits = raycaster.intersectObjects(meshes, false);
    if (hits.length === 0) return null;
    const root = hits[0].object.userData.vehicleRoot as THREE.Group | undefined;
    if (!root) return null;
    return vehicles.find((v) => v.group === root) ?? null;
  }

  function setHover(v: VehicleHandle | null) {
    if (hovered === v) return;
    if (hovered) hovered.setHover(false);
    hovered = v;
    if (hovered) hovered.setHover(true);
    onHoverChange(v);
  }

  function onPointerMove(e: PointerEvent) {
    if (!enabled) return;
    if (!isLocked()) return;
    yaw -= e.movementX * MOUSE_SENSITIVITY;
    pitch -= e.movementY * MOUSE_SENSITIVITY;
    if (pitch > PITCH_LIMIT) pitch = PITCH_LIMIT;
    if (pitch < -PITCH_LIMIT) pitch = -PITCH_LIMIT;
    applyOrientation();
  }

  function onClick(_e: MouseEvent) {
    if (!enabled) return;
    if (!isLocked()) {
      // First click engages pointer lock. requestPointerLock() must be invoked
      // synchronously from a user gesture handler — that's why we do it here
      // rather than via a React effect.
      canvas.requestPointerLock();
      return;
    }
    // Already locked: this click is a vehicle pick from the screen center.
    const v = pickVehicle();
    if (v) onVehicleClick(v);
  }

  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('click', onClick);

  // Per-frame: keep the hover state in sync with where the camera is pointing.
  // When pointer lock is released we clear hover so the HUD doesn't keep
  // highlighting a vehicle the player has stopped looking at.
  const tickOff = addTick(() => {
    if (!enabled) return;
    if (!isLocked()) {
      setHover(null);
      return;
    }
    setHover(pickVehicle());
  });

  function exitLockIfOwned() {
    if (isLocked()) document.exitPointerLock();
  }

  return {
    enable: () => {
      enabled = true;
    },
    disable: () => {
      enabled = false;
      setHover(null);
      exitLockIfOwned();
    },
    setEnabled: (b) => {
      enabled = b;
      if (!b) {
        setHover(null);
        exitLockIfOwned();
      }
    },
    resetView,
    isPointerLocked: () => isLocked(),
    detach: () => {
      tickOff();
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('click', onClick);
      exitLockIfOwned();
    },
  };
}
