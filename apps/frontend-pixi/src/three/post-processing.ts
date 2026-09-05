// FPV post-processing stack (#3). Wraps the renderer in an EffectComposer so the street
// scene gets a polished, video-game look on top of the existing ACES tone mapping:
//   - MSAA scene render (the composer's own target, so edges stay antialiased off-screen)
//   - GTAO contact shadows (high tier only — the heaviest pass)
//   - bloom on bright emissives (signage, tube glow, lamps)
//   - OutputPass applies tone mapping + sRGB at the end of the chain
//
// Two quality tiers keep it smooth on a phone: `low` (render + bloom + output) and `high`
// (render + GTAO + bloom + output). The composer is rebuilt when the tier changes so we
// never pay for AO on a device that can't afford it.

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import type { Pass } from 'three/examples/jsm/postprocessing/Pass.js';

export type QualityTier = 'low' | 'high';

export interface PostProcessing {
  render: () => void;
  setSize: (w: number, h: number) => void;
  setQuality: (tier: QualityTier) => void;
  tier: () => QualityTier;
  dispose: () => void;
}

const MSAA_SAMPLES = 4;

// Bloom runs on linear HDR values before tone mapping. Sunlit cream/yellow diffuse lands
// around 1.0, so the threshold must sit above that or the whole road glows white; only
// emissives driven past 1.0 (lamp heads, signage) are meant to bloom.
const BLOOM_STRENGTH = 0.3;
const BLOOM_RADIUS = 0.4;
const BLOOM_THRESHOLD = 2.4;

// Gentle edge darkening after tone mapping — pulls the eye to the crosshair.
const VIGNETTE_SHADER = {
  uniforms: { tDiffuse: { value: null as THREE.Texture | null }, strength: { value: 0.24 } },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float strength;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float d = length(vUv - 0.5) * 1.35;
      float v = 1.0 - smoothstep(0.35, 1.0, d) * strength;
      gl_FragColor = vec4(c.rgb * v, c.a);
    }`,
};

// The street is built at human scale (metres, eye height 1.7). GTAO's radius/thickness
// are view-space metres, so keep them sub-metre or every kerb smears a dark halo.
const GTAO_PARAMS = {
  radius: 0.5,
  distanceExponent: 1,
  thickness: 0.6,
  distanceFallOff: 1,
  scale: 1,
  samples: 16,
  screenSpaceRadius: false,
};
const GTAO_DENOISE_PARAMS = {
  lumaPhi: 10,
  depthPhi: 2,
  normalPhi: 3,
  radius: 4,
  radiusExponent: 1,
  rings: 2,
  samples: 16,
};
const GTAO_BLEND_INTENSITY = 0.85;

export function createPostProcessing(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  initialTier: QualityTier = 'high'
): PostProcessing {
  const size = new THREE.Vector2();
  renderer.getSize(size);
  let w = size.x;
  let h = size.y;
  const pixelRatio = renderer.getPixelRatio();

  const target = new THREE.WebGLRenderTarget(w * pixelRatio, h * pixelRatio, {
    type: THREE.HalfFloatType,
    samples: MSAA_SAMPLES,
  });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(pixelRatio);
  let currentTier: QualityTier = initialTier;
  let owned: Pass[] = [];

  function disposeOwned() {
    for (const p of owned) {
      (p as { dispose?: () => void }).dispose?.();
    }
    owned = [];
    composer.passes = [];
  }

  function build(tier: QualityTier) {
    disposeOwned();

    const render = new RenderPass(scene, camera);
    composer.addPass(render);
    owned.push(render);

    if (tier === 'high') {
      const gtao = new GTAOPass(scene, camera, w, h);
      gtao.updateGtaoMaterial(GTAO_PARAMS);
      gtao.updatePdMaterial(GTAO_DENOISE_PARAMS);
      gtao.blendIntensity = GTAO_BLEND_INTENSITY;
      composer.addPass(gtao);
      owned.push(gtao);
    }

    const bloom = new UnrealBloomPass(
      new THREE.Vector2(w, h),
      BLOOM_STRENGTH,
      BLOOM_RADIUS,
      BLOOM_THRESHOLD
    );
    composer.addPass(bloom);
    owned.push(bloom);

    const output = new OutputPass();
    composer.addPass(output);
    owned.push(output);

    const vignette = new ShaderPass(VIGNETTE_SHADER);
    composer.addPass(vignette);
    owned.push(vignette);

    composer.setSize(w, h);
    currentTier = tier;
  }

  build(initialTier);

  return {
    render: () => composer.render(),
    setSize: (width, height) => {
      w = width;
      h = height;
      composer.setSize(width, height);
    },
    setQuality: (tier) => {
      if (tier === currentTier) return;
      build(tier);
    },
    tier: () => currentTier,
    dispose: () => {
      disposeOwned();
      composer.dispose();
    },
  };
}
