// Shared building blocks for FPV vehicles: materials (incl. the reflection binding),
// rounded / profile-extruded geometry, wheels, window panes, and the hover-aware handle.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { TunnelStyle } from './tunnel';

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
  /** Look of the tunnel an underground ride passes through; the tube tunnel when absent. */
  tunnelStyle?: TunnelStyle;
}

export const GLASS = 0x2a3446;
export const RUBBER = 0x171719;
export const CHROME = 0xb9bcc2;
export const GUNMETAL = 0x2b2d31;
export const LAMP_WARM = 0xfff0c4;
export const LAMP_RED = 0xff2a1a;

// Hover reads as "lit from inside": a soft tint on the body (kept under the bloom
// threshold) while lamps and signs get brighter and are the only parts that bloom.
export const HOVER_TINT_INTENSITY = 0.28;
export const HOVER_GLOW_BOOST = 1.5;

export type Mat = THREE.MeshStandardMaterial;

export function mat(color: number, roughness = 0.6, metalness = 0): Mat {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

// The street's scene.environmentIntensity is kept low so sunlit diffuse doesn't wash out;
// vehicles bind the environment directly so paint, glass and chrome get full reflections.
let vehicleEnv: THREE.Texture | null = null;
export const ENV_INTENSITY_KEY = 'vehicleEnvIntensity';

export function reflective<T extends Mat>(m: T, intensity: number): T {
  m.userData[ENV_INTENSITY_KEY] = intensity;
  if (vehicleEnv) {
    m.envMap = vehicleEnv;
    m.envMapIntensity = intensity;
  }
  return m;
}

/** Binds the reflection map to every vehicle material, current and future. */
export function setVehicleEnvironment(env: THREE.Texture, scene: THREE.Object3D) {
  vehicleEnv = env;
  scene.traverse((obj) => {
    const mats = (obj as THREE.Mesh).material;
    for (const m of Array.isArray(mats) ? mats : mats ? [mats] : []) {
      const intensity = m.userData[ENV_INTENSITY_KEY];
      if (typeof intensity !== 'number' || !(m instanceof THREE.MeshStandardMaterial)) continue;
      m.envMap = env;
      m.envMapIntensity = intensity;
      m.needsUpdate = true;
    }
  });
}

export function paintMat(color: number, metalness: number): THREE.MeshPhysicalMaterial {
  return reflective(
    new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.38,
      metalness,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
    }),
    0.75
  );
}

export function glassMat(): Mat {
  return reflective(
    new THREE.MeshPhysicalMaterial({
      color: GLASS,
      roughness: 0.04,
      metalness: 0.1,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
    }),
    1.6
  );
}

export function chromeMat(color = CHROME): Mat {
  return reflective(mat(color, 0.14, 1), 1.3);
}

export function lampMat(color: number, intensity: number, base = 0xfff8e6): Mat {
  return new THREE.MeshStandardMaterial({ color: base, emissive: color, emissiveIntensity: intensity });
}

export function rbox(w: number, h: number, d: number, radius: number): RoundedBoxGeometry {
  return new RoundedBoxGeometry(w, h, d, 3, radius);
}

/** Extrudes a side profile (shape x = vehicle +Z forward, shape y = height) across the
 *  vehicle's width, centred on X, with every edge rounded by `bevel`. */
export function profileBody(shape: THREE.Shape, width: number, bevel: number): THREE.BufferGeometry {
  const depth = width - bevel * 2;
  const extruded = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    // Keeps the side walls on the profile outline so the drawn coordinates are exact.
    bevelOffset: -bevel,
    bevelSegments: 5,
    curveSegments: 14,
  });
  extruded.rotateY(-Math.PI / 2);
  extruded.translate(depth / 2, 0, 0);
  // Welding caps to walls gives smooth normals across the bevels instead of facets.
  extruded.deleteAttribute('uv');
  extruded.deleteAttribute('normal');
  const smooth = mergeVertices(extruded, 1e-4);
  extruded.dispose();
  smooth.computeVertexNormals();
  return smooth;
}

/** Cuts a semicircular wheel arch into a profile's bottom edge while tracing it front-ward. */
export function archNotch(shape: THREE.Shape, z: number, centerY: number, radius: number, bottomY: number) {
  shape.lineTo(z - radius, bottomY);
  if (bottomY !== centerY) shape.lineTo(z - radius, centerY);
  shape.absarc(z, centerY, radius, Math.PI, 0, true);
  if (bottomY !== centerY) shape.lineTo(z + radius, bottomY);
}

export function shadowed<T extends THREE.Mesh>(m: T, receive = false): T {
  m.castShadow = true;
  m.receiveShadow = receive;
  return m;
}

// Textures are shared across every rebuild; vehicles are rebuilt each turn and their
// material.dispose() does not release maps.
export const textureCache = new Map<string, THREE.Texture>();
export function cachedTexture(key: string, make: () => THREE.Texture): THREE.Texture {
  const hit = textureCache.get(key);
  if (hit) return hit;
  const tex = make();
  textureCache.set(key, tex);
  return tex;
}

export function hex(c: number): string {
  return `#${c.toString(16).padStart(6, '0')}`;
}

export function addWheel(
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

export function addPane(parent: THREE.Object3D, w: number, h: number, pos: THREE.Vector3, rotY: number, glass: Mat, tiltX = 0) {
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glass);
  p.position.copy(pos);
  p.rotation.set(tiltX, rotY, 0, 'YXZ');
  parent.add(p);
  return p;
}

export interface HoverSet {
  /** Body materials that get a soft emissive tint while aimed at. */
  tint: Mat[];
  tintColor: number;
  /** Already-emissive parts (lamps, signs) that get brighter while aimed at. */
  glow: Mat[];
}

export function makeHandle(
  group: THREE.Group,
  hit: THREE.Mesh,
  kind: VehicleKind,
  targetNodeId: number,
  hover: HoverSet,
  opts: { rideOffsetY: number; rideForwardLocal: THREE.Vector3; tunnelStyle?: TunnelStyle }
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
    tunnelStyle: opts.tunnelStyle,
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
