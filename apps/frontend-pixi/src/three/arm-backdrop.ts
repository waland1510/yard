// Per-arm photo backdrop. Each active arm of the intersection gets a wide flat photo of
// a London scene matching its transport: taxi arm → black-cab street, bus arm → red bus,
// underground arm → Tube station entrance, river arm → Thames + Westminster.
//
// The photo plane is placed at the far end of the arm, perpendicular to the arm direction
// and facing back toward the player. The procedural road is shortened to end just before
// this plane so we don't get road-into-building clipping.
//
// Textures are cached at the module level so they upload to the GPU once per session,
// even though intersection rebuilds happen every turn.

import * as THREE from 'three';
import type { Direction } from './intersection';
import { DIRECTION_FORWARD } from './intersection';
import type { VehicleKind } from './vehicles';

export const PHOTO_DISTANCE = 26;
export const PHOTO_WIDTH = 40;
export const PHOTO_HEIGHT = 24;

const PHOTO_PATHS: Record<VehicleKind, string> = {
  taxi: '/london-photos/taxi.jpg',
  bus: '/london-photos/bus.jpg',
  underground: '/london-photos/underground.jpg',
  river: '/london-photos/river.jpg',
};

const textureCache = new Map<string, THREE.Texture>();
const loader = new THREE.TextureLoader();

function loadCachedTexture(path: string): THREE.Texture {
  const cached = textureCache.get(path);
  if (cached) return cached;
  const tex = loader.load(path);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  textureCache.set(path, tex);
  return tex;
}

type AddGeo = <T extends THREE.BufferGeometry>(g: T) => T;
type AddMat = <T extends THREE.Material>(m: T) => T;

export function buildArmBackdrop(
  transport: VehicleKind,
  dir: Direction,
  addGeo: AddGeo,
  addMat: AddMat
): THREE.Group {
  const group = new THREE.Group();
  group.name = `arm-backdrop-${dir}-${transport}`;

  const tex = loadCachedTexture(PHOTO_PATHS[transport]);
  // MeshBasicMaterial so the photo isn't relit by scene lights — keeps the photo looking
  // like a photo, not an oddly-lit 3D billboard.
  const mat = addMat(new THREE.MeshBasicMaterial({ map: tex, side: THREE.FrontSide }));

  const plane = new THREE.Mesh(
    addGeo(new THREE.PlaneGeometry(PHOTO_WIDTH, PHOTO_HEIGHT)),
    mat
  );

  const fwd = DIRECTION_FORWARD[dir];
  plane.position.copy(fwd.clone().multiplyScalar(PHOTO_DISTANCE));
  plane.position.y = PHOTO_HEIGHT / 2; // bottom edge at ground level
  // Face the intersection center
  plane.lookAt(0, PHOTO_HEIGHT / 2, 0);

  group.add(plane);
  return group;
}
