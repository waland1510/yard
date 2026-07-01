// Procedural weather (#9). A self-contained rain layer added to the scene — additive, so
// it doesn't touch the procedural intersection geometry. Tier-gated: enabled on the high
// graphics tier, off on low/mobile to protect framerate. Rain falls in a column around the
// camera (anchored at the world origin) and recycles to the top as drops hit the ground.

import * as THREE from 'three';

export interface Weather {
  tick: (dt: number, t: number) => void;
  setEnabled: (enabled: boolean) => void;
  dispose: () => void;
}

const DROP_COUNT = 1400;
const SPREAD = 55; // horizontal half-extent around the origin
const TOP = 42; // spawn height

export function createWeather(scene: THREE.Scene): Weather {
  const positions = new Float32Array(DROP_COUNT * 3);
  const speeds = new Float32Array(DROP_COUNT);
  for (let i = 0; i < DROP_COUNT; i++) {
    positions[i * 3] = (Math.random() * 2 - 1) * SPREAD;
    positions[i * 3 + 1] = Math.random() * TOP;
    positions[i * 3 + 2] = (Math.random() * 2 - 1) * SPREAD;
    speeds[i] = 22 + Math.random() * 16;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xaab6c4,
    size: 0.07,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const rain = new THREE.Points(geometry, material);
  rain.frustumCulled = false;
  rain.visible = false;
  scene.add(rain);

  let enabled = false;

  return {
    tick: (dt) => {
      if (!enabled) return;
      const attr = geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      for (let i = 0; i < DROP_COUNT; i++) {
        const yi = i * 3 + 1;
        arr[yi] -= speeds[i] * dt;
        if (arr[yi] < 0) {
          arr[yi] = TOP;
          arr[i * 3] = (Math.random() * 2 - 1) * SPREAD;
          arr[i * 3 + 2] = (Math.random() * 2 - 1) * SPREAD;
        }
      }
      attr.needsUpdate = true;
    },
    setEnabled: (v) => {
      enabled = v;
      rain.visible = v;
    },
    dispose: () => {
      scene.remove(rain);
      geometry.dispose();
      material.dispose();
    },
  };
}
