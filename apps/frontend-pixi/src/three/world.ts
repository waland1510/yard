import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { FOG_TINT } from './palette';
import { createPostProcessing, type QualityTier } from './post-processing';
import { createWeather } from './weather';

export interface World {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  addTick: (fn: (dt: number, t: number) => void) => () => void;
  /** Switch the post-processing fidelity tier (#3). */
  setQuality: (tier: QualityTier) => void;
  destroy: () => void;
}

// Stylized London sky palette. Cream-grey horizon dissolving into a soft
// overcast blue zenith. The middle band matches FOG_TINT so distant
// procedural buildings melt cleanly into the sky.
const SKY_ZENITH = new THREE.Color(0x9fb4c8);
const SKY_HORIZON = new THREE.Color(FOG_TINT);
const SKY_GROUND = new THREE.Color(0xe6dfd0);

/**
 * Procedural equirectangular sky gradient. Painted into a tall, narrow canvas
 * as vertical bands (zenith -> mid -> horizon -> ground) and wrapped as an
 * equirectangular texture so THREE can sample it via scene.background.
 */
function makeSkyGradient(): THREE.CanvasTexture {
  const w = 16;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    // Fallback: solid horizon-tint canvas
    return new THREE.CanvasTexture(canvas);
  }
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  // 0.00 zenith — soft london overcast blue
  grad.addColorStop(0.0, `#${SKY_ZENITH.getHexString()}`);
  // 0.45 upper-mid — blend toward fog tint
  grad.addColorStop(0.45, `#${SKY_HORIZON.clone().lerp(SKY_ZENITH, 0.35).getHexString()}`);
  // 0.62 horizon band — exactly FOG_TINT so fog dissolves seamlessly
  grad.addColorStop(0.62, `#${SKY_HORIZON.getHexString()}`);
  // 0.78 pale cream just below horizon
  grad.addColorStop(0.78, `#${SKY_GROUND.clone().lerp(SKY_HORIZON, 0.4).getHexString()}`);
  // 1.00 warm ground tint (rarely visible — camera at eye level)
  grad.addColorStop(1.0, `#${SKY_GROUND.getHexString()}`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const tex = new THREE.CanvasTexture(canvas);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createWorld(canvas: HTMLCanvasElement): World {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();

  // Procedural sky gradient as the scene background. This is the *visible*
  // sky — vertical bands from a soft overcast-blue zenith through the
  // FOG_TINT horizon down to a pale cream ground reflection. The HDRI below
  // is reserved exclusively for PBR reflections via scene.environment.
  const skyTexture = makeSkyGradient();
  scene.background = skyTexture;

  // Fog so distant procedural geometry (buildings, road arms) melts into the
  // horizon band rather than popping at the far clip plane.
  const fogColor = new THREE.Color(FOG_TINT);
  scene.fog = new THREE.Fog(fogColor, 60, 280);
  renderer.setClearColor(fogColor, 1);

  // HDRI is loaded ONLY into scene.environment for plausible PBR reflections
  // on vehicles + streetscape. It is NOT assigned to scene.background — the
  // procedural sky above owns the visible sky.
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  new RGBELoader().load('/skybox/canary_wharf_2k.hdr', (hdr) => {
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    const envRT = pmrem.fromEquirectangular(hdr);
    scene.environment = envRT.texture;
    hdr.dispose();
  });

  const camera = new THREE.PerspectiveCamera(
    72,
    window.innerWidth / window.innerHeight,
    0.05,
    400
  );
  camera.position.set(0, 1.7, 0);

  // Sun (warm key light, low-ish angle for moody feel)
  const sun = new THREE.DirectionalLight(0xfff3d6, 1.4);
  sun.position.set(-30, 45, 22);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -60;
  sun.shadow.camera.right = 60;
  sun.shadow.camera.top = 60;
  sun.shadow.camera.bottom = -60;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 180;
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  // Sky/ground hemisphere fill — bumped up since the procedural sky doesn't
  // contribute diffuse lighting the way the HDRI background used to.
  const hemi = new THREE.HemisphereLight(0xcfdbe6, 0x3a3328, 0.45);
  scene.add(hemi);

  // Ambient nudge so shadows don't crush to black under the overcast key.
  scene.add(new THREE.AmbientLight(0xffffff, 0.18));

  // Post-processing pipeline (#3) — owns the final render. Defaults to the high tier;
  // game.tsx sets the device-appropriate tier on mount.
  const post = createPostProcessing(renderer, scene, camera, 'high');
  // Procedural weather (#9) — tier-gated rain, toggled by setQuality.
  const weather = createWeather(scene);

  const tickFns: ((dt: number, t: number) => void)[] = [];
  let raf = 0;
  let last = performance.now();
  const startTime = last;

  function loop(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = (now - startTime) / 1000;
    for (const fn of tickFns) fn(dt, t);
    weather.tick(dt, t);
    post.render();
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    post.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  return {
    scene,
    camera,
    renderer,
    addTick(fn) {
      tickFns.push(fn);
      return () => {
        const i = tickFns.indexOf(fn);
        if (i >= 0) tickFns.splice(i, 1);
      };
    },
    setQuality(tier) {
      post.setQuality(tier);
      weather.setEnabled(tier === 'high');
    },
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      weather.dispose();
      post.dispose();
      skyTexture.dispose();
      pmrem.dispose();
      renderer.dispose();
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose();
        const mat = (obj as THREE.Mesh).material;
        if (mat) {
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else (mat as THREE.Material).dispose();
        }
      });
    },
  };
}
