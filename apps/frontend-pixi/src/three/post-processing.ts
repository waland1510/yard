// FPV post-processing stack (#3). Wraps the renderer in an EffectComposer so the street
// scene gets a polished, video-game look on top of the existing ACES tone mapping:
//   - bloom on bright emissives (signage, tube glow, lamps)
//   - SSAO contact shadows (high tier only — the heaviest pass)
//   - OutputPass applies tone mapping + sRGB at the end of the chain
//
// Two quality tiers keep it smooth on a phone: `low` (bloom + output) and `high`
// (SSAO + bloom + output). The composer is rebuilt when the tier changes so we never
// pay for SSAO on a device that can't afford it.

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { Pass } from 'three/examples/jsm/postprocessing/Pass.js';

export type QualityTier = 'low' | 'high';

export interface PostProcessing {
  render: () => void;
  setSize: (w: number, h: number) => void;
  setQuality: (tier: QualityTier) => void;
  tier: () => QualityTier;
  dispose: () => void;
}

// Subtle bloom — only genuinely bright emissives cross the threshold and glow.
const BLOOM_STRENGTH = 0.55;
const BLOOM_RADIUS = 0.5;
const BLOOM_THRESHOLD = 0.82;

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

  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(renderer.getPixelRatio());
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

    // Scene-rendering pass: SSAOPass renders the scene WITH ambient occlusion on the
    // high tier; a plain RenderPass otherwise.
    if (tier === 'high') {
      const ssao = new SSAOPass(scene, camera, w, h);
      ssao.kernelRadius = 8;
      ssao.minDistance = 0.004;
      ssao.maxDistance = 0.09;
      composer.addPass(ssao);
      owned.push(ssao);
    } else {
      const render = new RenderPass(scene, camera);
      composer.addPass(render);
      owned.push(render);
    }

    const bloom = new UnrealBloomPass(
      new THREE.Vector2(w, h),
      BLOOM_STRENGTH,
      BLOOM_RADIUS,
      BLOOM_THRESHOLD
    );
    composer.addPass(bloom);
    owned.push(bloom);

    // OutputPass applies the renderer's tone mapping (ACES) + sRGB conversion at the end.
    const output = new OutputPass();
    composer.addPass(output);
    owned.push(output);

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
