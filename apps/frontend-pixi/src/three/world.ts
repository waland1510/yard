import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { FOG_TINT } from './palette';
import { createPostProcessing, type QualityTier } from './post-processing';
import { createWeather } from './weather';
import { setVehicleEnvironment } from './vehicles';

export interface World {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  addTick: (fn: (dt: number, t: number) => void) => () => void;
  /** Switch the post-processing fidelity tier (#3). */
  setQuality: (tier: QualityTier) => void;
  /** Apply a theme's sky, fog and lighting. */
  setAtmosphere: (themeId: string) => void;
  destroy: () => void;
}

// Sky, fog and light per theme. The horizon doubles as the fog colour so distant
// procedural buildings melt cleanly into the sky.
interface Atmosphere {
  zenith: number;
  horizon: number;
  ground: number;
  sunColor: number;
  sunIntensity: number;
  sunPosition: [number, number, number];
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
}

const LONDON_DAY: Atmosphere = {
  zenith: 0x7ea3cf,
  horizon: FOG_TINT,
  ground: 0xead9c3,
  sunColor: 0xffe4bd,
  sunIntensity: 2.6,
  sunPosition: [22, 58, 30],
  hemiSky: 0x9fbde0,
  hemiGround: 0x6a5a48,
  hemiIntensity: 0.65,
};

// Violet dusk over wizarding London: low amber sun, lavender haze.
const WIZARDING_DUSK: Atmosphere = {
  zenith: 0x241d4a,
  horizon: 0x9b86b6,
  ground: 0x4c4060,
  sunColor: 0xffb98a,
  sunIntensity: 1.7,
  sunPosition: [34, 30, -22],
  hemiSky: 0x7d6fb8,
  hemiGround: 0x2e2438,
  hemiIntensity: 0.7,
};

// Sunny Barbie World: clear blue overhead melting into pink haze.
const DREAM_DAY: Atmosphere = {
  zenith: 0x3fb2ff,
  horizon: 0xffb8dc,
  ground: 0xffe0f0,
  sunColor: 0xfff0e6,
  sunIntensity: 2.8,
  sunPosition: [26, 60, 24],
  hemiSky: 0xffc4e1,
  hemiGround: 0xd9a0c0,
  hemiIntensity: 0.85,
};

const ATMOSPHERES: Record<string, Atmosphere> = {
  classic: LONDON_DAY,
  'harry-potter': WIZARDING_DUSK,
  barbie: DREAM_DAY,
};

/**
 * Procedural equirectangular sky gradient. Painted into a tall, narrow canvas
 * as vertical bands (zenith -> mid -> horizon -> ground) and wrapped as an
 * equirectangular texture so THREE can sample it via scene.background.
 */
function makeSkyGradient(atmosphere: Atmosphere): THREE.CanvasTexture {
  const zenith = new THREE.Color(atmosphere.zenith);
  const horizon = new THREE.Color(atmosphere.horizon);
  const ground = new THREE.Color(atmosphere.ground);
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
  grad.addColorStop(0.0, `#${zenith.getHexString()}`);
  grad.addColorStop(0.45, `#${horizon.clone().lerp(zenith, 0.35).getHexString()}`);
  // 0.62 horizon band — exactly the fog colour so fog dissolves seamlessly
  grad.addColorStop(0.62, `#${horizon.getHexString()}`);
  grad.addColorStop(0.78, `#${ground.clone().lerp(horizon, 0.4).getHexString()}`);
  grad.addColorStop(1.0, `#${ground.getHexString()}`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const tex = new THREE.CanvasTexture(canvas);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

interface TierSettings {
  maxPixelRatio: number;
  shadowMapSize: number;
  rain: boolean;
}

const TIER_SETTINGS: Record<QualityTier, TierSettings> = {
  low: { maxPixelRatio: 1, shadowMapSize: 1024, rain: false },
  high: { maxPixelRatio: 2, shadowMapSize: 4096, rain: true },
};

export function createWorld(canvas: HTMLCanvasElement): World {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, TIER_SETTINGS.high.maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();

  // Procedural sky gradient as the scene background. This is the *visible*
  // sky — vertical bands from a soft overcast-blue zenith through the
  // FOG_TINT horizon down to a pale cream ground reflection. The HDRI below
  // is reserved exclusively for PBR reflections via scene.environment.
  let skyTexture = makeSkyGradient(LONDON_DAY);
  scene.background = skyTexture;

  // Fog so distant procedural geometry (buildings, road arms) melts into the
  // horizon band rather than popping at the far clip plane.
  const fogColor = new THREE.Color(FOG_TINT);
  const fog = new THREE.Fog(fogColor, 45, 170);
  scene.fog = fog;
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
    // The HDRI is a bright open-sky capture; at full intensity its irradiance alone pushes
    // sunlit diffuse past 1.0 and washes the street out. Keep it for reflections only.
    scene.environmentIntensity = 0.3;
    setVehicleEnvironment(envRT.texture, scene);
    hdr.dispose();
  });

  const camera = new THREE.PerspectiveCamera(
    66,
    window.innerWidth / window.innerHeight,
    0.05,
    400
  );
  camera.position.set(0, 1.7, 0);

  // Late-morning sun: high enough that the street between the terraces stays lit and
  // buildings throw short shadows across the pavement rather than blacking out the road.
  const sun = new THREE.DirectionalLight(0xffe4bd, 2.6);
  sun.position.set(22, 58, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(TIER_SETTINGS.high.shadowMapSize);
  sun.shadow.camera.left = -55;
  sun.shadow.camera.right = 55;
  sun.shadow.camera.top = 55;
  sun.shadow.camera.bottom = -55;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 180;
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);

  // Cool sky fill kept low so sun shadows keep their contrast.
  const hemi = new THREE.HemisphereLight(0x9fbde0, 0x6a5a48, 0.65);
  scene.add(hemi);
  scene.add(new THREE.AmbientLight(0xffffff, 0.06));

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
    setAtmosphere(themeId) {
      const a = ATMOSPHERES[themeId] ?? LONDON_DAY;
      skyTexture.dispose();
      skyTexture = makeSkyGradient(a);
      scene.background = skyTexture;
      fog.color.setHex(a.horizon);
      renderer.setClearColor(fog.color, 1);
      sun.color.setHex(a.sunColor);
      sun.intensity = a.sunIntensity;
      sun.position.set(...a.sunPosition);
      hemi.color.setHex(a.hemiSky);
      hemi.groundColor.setHex(a.hemiGround);
      hemi.intensity = a.hemiIntensity;
    },
    setQuality(tier) {
      const settings = TIER_SETTINGS[tier];
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, settings.maxPixelRatio));
      renderer.setSize(window.innerWidth, window.innerHeight);
      if (sun.shadow.mapSize.x !== settings.shadowMapSize) {
        sun.shadow.mapSize.setScalar(settings.shadowMapSize);
        sun.shadow.map?.dispose();
        sun.shadow.map = null;
      }
      post.setQuality(tier);
      weather.setEnabled(settings.rain);
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
