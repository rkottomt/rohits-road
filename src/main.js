import * as THREE from 'three';
import { COLORS } from './constants.js';
import { Game } from './game.js';
import { makeSkyTexture } from './models.js';

const canvas = document.getElementById('scene');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = makeSkyTexture();
scene.fog = new THREE.Fog(COLORS.fog, 112, 158);

scene.add(new THREE.AmbientLight(0xffffff, 0.72));

const hemi = new THREE.HemisphereLight(0xdff2ff, 0x6ea54a, 0.5);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff6e0, 1.15);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -15;
sun.shadow.camera.right = 15;
sun.shadow.camera.top = 15;
sun.shadow.camera.bottom = -15;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 70;
sun.shadow.bias = -0.0012;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);

const SUN_OFFSET = new THREE.Vector3(-11, 19, -9);

const game = new Game(scene, canvas);

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);
  game.rig.resize(width, height);
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
resize();

let last = performance.now();

function frame(now) {
  requestAnimationFrame(frame);
  // Clamp so a background tab or a stall can never teleport the world.
  const dt = Math.min((now - last) / 1000, 1 / 20);
  last = now;

  game.update(dt);

  const focus = game.rig.focus;
  sun.position.copy(focus).add(SUN_OFFSET);
  sun.target.position.copy(focus);
  sun.target.updateMatrixWorld();

  renderer.render(scene, game.rig.camera);
}

requestAnimationFrame(frame);

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) last = performance.now();
});
