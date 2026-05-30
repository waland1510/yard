// Owns the single shared TilesRenderer for Google Photorealistic 3D Tiles. Re-anchors
// to a new London lat/lng on every turn instead of re-instantiating the renderer — this
// keeps Google's session token warm and the LRU tile cache populated across moves.
//
// Conventions guaranteed to gameplay code after setAnchor(lat, lng):
//   world (0, 0, 0) == street-level at that lat/lng
//   +Y == up
//   +X == east, -Z == north  (matches existing DIRECTION_FORWARD contract)
//
// The plugin's natural orientation is +X west, +Z north — we pass azimuth=PI to flip
// both axes so the game's east/north stay consistent with the procedural code.
//
// Google's mesh isn't sea-level-registered, so the actual ground at world (0,0,0) can
// be off by tens of meters. After the tileset's first wave of tiles arrives we raycast
// straight down from (0, 500, 0) to find the real surface and snap the camera Y.

import * as THREE from 'three';
import { TilesRenderer } from '3d-tiles-renderer';
import {
  GoogleCloudAuthPlugin,
  TileCompressionPlugin,
  UpdateOnChangePlugin,
  UnloadTilesPlugin,
  GLTFExtensionsPlugin,
  ReorientationPlugin,
} from '3d-tiles-renderer/plugins';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import type { World } from './world';

const DRACO_DECODER_PATH = 'https://www.gstatic.com/draco/versioned/decoders/1.5.6/';
const DEG = Math.PI / 180;

export interface Tileset {
  /** Re-anchor the tileset so world origin sits at the given London lat/lng. Resolves
   *  when the first wave of tiles for the new anchor is loaded (or `timeoutMs` elapses,
   *  whichever first). After resolution, camera.position.y is snapped to the real
   *  photoreal ground height + 1.7m. */
  setAnchor: (lat: number, lng: number, timeoutMs?: number) => Promise<void>;
  /** Aggregated copyright string from the currently visible tiles — required for the
   *  Google Maps Platform attribution overlay. */
  getAttribution: () => string;
  /** Tiles-renderer's three.js group; already added to world.scene. */
  group: THREE.Group;
  /** Cleanup — call on world destroy. */
  dispose: () => void;
}

export function createTileset(world: World, apiKey: string): Tileset {
  const tiles = new TilesRenderer();

  tiles.registerPlugin(
    new GoogleCloudAuthPlugin({ apiToken: apiKey, autoRefreshToken: true })
  );
  const draco = new DRACOLoader().setDecoderPath(DRACO_DECODER_PATH);
  tiles.registerPlugin(new GLTFExtensionsPlugin({ dracoLoader: draco }));
  tiles.registerPlugin(new TileCompressionPlugin());
  tiles.registerPlugin(new UpdateOnChangePlugin());
  tiles.registerPlugin(new UnloadTilesPlugin());

  // Reorientation — kept across setAnchor calls. Initialize at Trafalgar; the call to
  // transformLatLonHeightToOrigin inside setAnchor moves us elsewhere as needed.
  const reorient = new ReorientationPlugin({
    lat: 51.508 * DEG,
    lon: -0.1281 * DEG,
    height: 0,
    azimuth: Math.PI, // flip +X west,+Z north → +X east,-Z north (game convention)
  });
  tiles.registerPlugin(reorient);

  // errorTarget is screen-space pixel error: lower = more refined tiles, sharper geometry
  // and textures at FPV close-up but more network/GPU cost. 8 is a sweet spot for FPV
  // street level — visibly sharper than the 20-default for orbit cameras, without the
  // texture-streaming starvation that errorTarget=4 caused (geometry loads, textures
  // fall behind, scene renders as untextured triangles).
  tiles.errorTarget = 8;
  tiles.lruCache.maxBytesSize = 512 * 1024 * 1024;

  tiles.setCamera(world.camera);
  tiles.setResolutionFromRenderer(world.camera, world.renderer);
  world.scene.add(tiles.group);
  // The orbit controls own the camera in aerial mode. We no longer need to park the
  // camera high during loading or snap to a ground height — the aerial framing means
  // the photoreal mesh under the camera doesn't have to be perfectly placed.

  // Receive shadows on streamed tiles; the photoreal mesh already has baked sun so we
  // intentionally don't cast shadows from it (would double-darken). Vehicles still cast
  // their own shadows.
  tiles.addEventListener('load-model', (event) => {
    const scene = (event as unknown as { scene?: THREE.Object3D }).scene;
    if (!scene) return;
    scene.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.isMesh) {
        m.receiveShadow = true;
        m.castShadow = false;
      }
    });
  });

  const tickOff = world.addTick(() => {
    tiles.setResolutionFromRenderer(world.camera, world.renderer);
    tiles.setCamera(world.camera);
    tiles.update();
  });

  let pendingLoad: { resolve: () => void; timer: ReturnType<typeof setTimeout> } | null = null;
  const settleLoad = () => {
    if (!pendingLoad) return;
    clearTimeout(pendingLoad.timer);
    const r = pendingLoad.resolve;
    pendingLoad = null;
    r();
  };
  tiles.addEventListener('tiles-load-end', () => {
    if (pendingLoad && tiles.loadProgress >= 1) {
      settleLoad();
    }
  });

  return {
    async setAnchor(lat, lng, timeoutMs = 2500) {
      // Reposition the existing reorientation (cheaper + correct vs unregister/re-register
      // which doesn't re-fire load-root-tileset).
      reorient.transformLatLonHeightToOrigin(
        lat * DEG,
        lng * DEG,
        0,
        Math.PI, // azimuth — keep the +X east / -Z north game convention
        0,
        0
      );

      const pluginAny = tiles.getPluginByName('UPDATE_ON_CHANGE_PLUGIN') as
        | { needsUpdate?: boolean }
        | null;
      if (pluginAny) pluginAny.needsUpdate = true;

      await new Promise<void>((resolve) => {
        if (pendingLoad) {
          clearTimeout(pendingLoad.timer);
          pendingLoad.resolve();
        }
        const timer = setTimeout(() => {
          pendingLoad = null;
          resolve();
        }, timeoutMs);
        pendingLoad = { resolve, timer };
      });
    },
    getAttribution() {
      const attrs = tiles.getAttributions();
      if (!attrs || !attrs.length) return '';
      return attrs.map((a) => a.value).filter(Boolean).join(' · ');
    },
    group: tiles.group,
    dispose() {
      tickOff();
      tiles.dispose();
      draco.dispose();
    },
  };
}
