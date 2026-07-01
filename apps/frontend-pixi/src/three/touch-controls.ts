// First-person TOUCH controls — the phone counterpart to the pointer-lock controls
// (controls.ts). Pointer lock is unavailable on iOS/Android, so instead:
//   - one-finger drag rotates the camera (yaw around world Y, pitch clamped)
//   - a tap (negligible movement, short duration) picks the vehicle under the finger
//     via a raycast from the tap's NDC position and fires onVehicleClick
//
// It implements the SAME PovControls interface as the mouse controls so the rest of the
// FPV pipeline (game.tsx, ride.ts) is agnostic to which one is mounted. There is no
// pointer-lock concept here, so `isPointerLocked()` always returns false; game.tsx gates
// the touch HUD on its own "engaged" state instead.

import * as THREE from 'three';
import type { VehicleHandle } from './vehicles';
import type { PovControls, PovControlsOpts } from './controls';

// Radians of rotation per pixel dragged. Coarser than the mouse value (a touch swipe is
// a deliberate, larger gesture) — ~200px sweeps roughly a right angle.
const TOUCH_SENSITIVITY = 0.005;
const PITCH_LIMIT = Math.PI / 2 - 0.05;
const EYE_HEIGHT = 1.7;
// A touch that moves less than this (px) and ends quickly is treated as a tap, not a drag.
const TAP_MOVE_THRESHOLD = 12;
const TAP_TIME_LIMIT = 450;

export function createTouchControls({
  canvas,
  camera,
  getVehicles,
  onVehicleClick,
  onHoverChange,
}: PovControlsOpts): PovControls {
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
  const raycaster = new THREE.Raycaster();

  // Active single-touch gesture tracking.
  let activeId: number | null = null;
  let lastX = 0;
  let lastY = 0;
  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let movedDistance = 0;

  function pickAt(clientX: number, clientY: number): VehicleHandle | null {
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(ndc, camera);
    const vehicles = getVehicles();
    const hits = raycaster.intersectObjects(
      vehicles.map((v) => v.hitMesh),
      false
    );
    if (hits.length === 0) return null;
    const root = hits[0].object.userData.vehicleRoot as THREE.Group | undefined;
    if (!root) return null;
    return vehicles.find((v) => v.group === root) ?? null;
  }

  function onTouchStart(e: TouchEvent) {
    if (!enabled) return;
    if (activeId !== null) return; // already tracking a finger; ignore extra touches
    const t = e.changedTouches[0];
    activeId = t.identifier;
    lastX = startX = t.clientX;
    lastY = startY = t.clientY;
    startTime = e.timeStamp;
    movedDistance = 0;
  }

  function findActive(list: TouchList): Touch | null {
    for (let i = 0; i < list.length; i++) {
      if (list[i].identifier === activeId) return list[i];
    }
    return null;
  }

  function onTouchMove(e: TouchEvent) {
    if (!enabled || activeId === null) return;
    const t = findActive(e.changedTouches);
    if (!t) return;
    // Prevent the page from scrolling/refreshing under the drag.
    if (e.cancelable) e.preventDefault();
    const dx = t.clientX - lastX;
    const dy = t.clientY - lastY;
    lastX = t.clientX;
    lastY = t.clientY;
    movedDistance += Math.hypot(dx, dy);
    yaw -= dx * TOUCH_SENSITIVITY;
    pitch -= dy * TOUCH_SENSITIVITY;
    if (pitch > PITCH_LIMIT) pitch = PITCH_LIMIT;
    if (pitch < -PITCH_LIMIT) pitch = -PITCH_LIMIT;
    applyOrientation();
  }

  function onTouchEnd(e: TouchEvent) {
    if (activeId === null) return;
    const t = findActive(e.changedTouches);
    if (!t) return;
    const duration = e.timeStamp - startTime;
    const totalMove = Math.hypot(t.clientX - startX, t.clientY - startY);
    const wasTap =
      enabled &&
      movedDistance < TAP_MOVE_THRESHOLD &&
      totalMove < TAP_MOVE_THRESHOLD &&
      duration < TAP_TIME_LIMIT;
    activeId = null;
    if (wasTap) {
      const v = pickAt(t.clientX, t.clientY);
      if (v) onVehicleClick(v);
    }
  }

  function onTouchCancel() {
    activeId = null;
  }

  // `passive: false` on touchmove so preventDefault() can suppress page scroll.
  canvas.addEventListener('touchstart', onTouchStart, { passive: true });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd, { passive: true });
  canvas.addEventListener('touchcancel', onTouchCancel, { passive: true });

  return {
    enable: () => {
      enabled = true;
    },
    disable: () => {
      enabled = false;
      activeId = null;
      onHoverChange(null);
    },
    setEnabled: (b) => {
      enabled = b;
      if (!b) {
        activeId = null;
        onHoverChange(null);
      }
    },
    resetView,
    // No pointer lock on touch.
    isPointerLocked: () => false,
    detach: () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchCancel);
    },
  };
}
