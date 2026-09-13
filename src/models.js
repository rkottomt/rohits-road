import * as THREE from 'three';
import { COLORS, ROW_WIDTH, SPAN } from './constants.js';
import { Pool, pick, randRange } from './utils.js';

// ---------------------------------------------------------------------------
// Shared geometry / material caches. Every voxel in the game reuses these, so
// the whole scene is a few dozen GPU buffers no matter how much is on screen.
// ---------------------------------------------------------------------------

const boxCache = new Map();
export function box(w, h, d) {
  const key = `${w}|${h}|${d}`;
  let geo = boxCache.get(key);
  if (!geo) {
    geo = new THREE.BoxGeometry(w, h, d);
    boxCache.set(key, geo);
  }
  return geo;
}

const matCache = new Map();
export function mat(color, options) {
  const key = `${color}|${options ? JSON.stringify(options) : ''}`;
  let material = matCache.get(key);
  if (!material) {
    material = new THREE.MeshLambertMaterial({ color, ...options });
    matCache.set(key, material);
  }
  return material;
}

function part(parent, w, h, d, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(box(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

// ---------------------------------------------------------------------------
// Procedural textures. Lane dashes and rail sleepers repeat across very wide
// slabs, so a texture beats hundreds of little meshes.
// ---------------------------------------------------------------------------

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return [canvas, canvas.getContext('2d')];
}

let dashTexture = null;
function getDashTexture() {
  if (dashTexture) return dashTexture;
  const [canvas, ctx] = makeCanvas(64, 16);
  ctx.clearRect(0, 0, 64, 16);
  ctx.fillStyle = '#f2f0e4';
  ctx.fillRect(8, 0, 40, 16);
  dashTexture = new THREE.CanvasTexture(canvas);
  dashTexture.wrapS = THREE.RepeatWrapping;
  dashTexture.wrapT = THREE.ClampToEdgeWrapping;
  dashTexture.repeat.set(ROW_WIDTH / 1.6, 1);
  dashTexture.magFilter = THREE.LinearFilter;
  dashTexture.colorSpace = THREE.SRGBColorSpace;
  return dashTexture;
}

let sleeperTexture = null;
function getSleeperTexture() {
  if (sleeperTexture) return sleeperTexture;
  const [canvas, ctx] = makeCanvas(32, 32);
  ctx.fillStyle = '#6a6a70';
  ctx.fillRect(0, 0, 32, 32);
  // Speckled gravel.
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? '#75757c' : '#5e5e64';
    ctx.fillRect((Math.random() * 32) | 0, (Math.random() * 32) | 0, 2, 2);
  }
  ctx.fillStyle = '#584130';
  ctx.fillRect(4, 4, 12, 24);
  sleeperTexture = new THREE.CanvasTexture(canvas);
  sleeperTexture.wrapS = THREE.RepeatWrapping;
  sleeperTexture.wrapT = THREE.RepeatWrapping;
  sleeperTexture.repeat.set(ROW_WIDTH / 0.85, 1);
  sleeperTexture.magFilter = THREE.NearestFilter;
  sleeperTexture.colorSpace = THREE.SRGBColorSpace;
  return sleeperTexture;
}

export function makeSkyTexture() {
  const [canvas, ctx] = makeCanvas(4, 256);
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#' + COLORS.sky[0].toString(16).padStart(6, '0'));
  grad.addColorStop(0.62, '#bfe6f8');
  grad.addColorStop(1, '#' + COLORS.sky[1].toString(16).padStart(6, '0'));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------------------
// Row slabs
// ---------------------------------------------------------------------------

export const SLAB_HEIGHT = 0.5;

export const SLAB_MATERIALS = {
  grassLight: () => mat(COLORS.grassLight),
  grassDark: () => mat(COLORS.grassDark),
  road: () => mat(COLORS.road),
  roadDark: () => mat(COLORS.roadDark),
  water: () => mat(COLORS.water),
  waterDark: () => mat(COLORS.waterDark),
};

export const slabPool = new Pool(() => {
  const mesh = new THREE.Mesh(box(ROW_WIDTH, SLAB_HEIGHT, 1), mat(COLORS.grassLight));
  mesh.receiveShadow = true;
  return mesh;
});

export const railSlabPool = new Pool(() => {
  const gravel = mat(COLORS.gravel);
  const top = new THREE.MeshLambertMaterial({ map: getSleeperTexture() });
  const mesh = new THREE.Mesh(box(ROW_WIDTH, SLAB_HEIGHT, 1), [
    gravel,
    gravel,
    top,
    gravel,
    gravel,
    gravel,
  ]);
  mesh.receiveShadow = true;
  return mesh;
});

export const dashPool = new Pool(() => {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(ROW_WIDTH, 0.1),
    new THREE.MeshBasicMaterial({
      map: getDashTexture(),
      transparent: true,
      alphaTest: 0.5,
      depthWrite: false,
      color: COLORS.dash,
    })
  );
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
});

export const railsPool = new Pool(() => {
  const group = new THREE.Group();
  const metal = mat(COLORS.railMetal);
  for (const z of [-0.26, 0.26]) {
    const rail = new THREE.Mesh(box(ROW_WIDTH, 0.09, 0.1), metal);
    rail.position.set(0, 0.05, z);
    group.add(rail);
  }
  return group;
});

const lampOn = () =>
  mat(COLORS.postRed, { emissive: COLORS.postRed, emissiveIntensity: 0.9 });
const lampOff = () => mat(0x8a3129);

export const signalPool = new Pool(() => {
  const group = new THREE.Group();
  part(group, 0.12, 0.92, 0.12, mat(COLORS.postDark), 0, 0.46, 0);
  part(group, 0.38, 0.16, 0.11, mat(COLORS.postDark), 0, 1.0, 0);
  const a = part(group, 0.14, 0.14, 0.07, lampOff(), -0.11, 1.0, -0.08);
  const b = part(group, 0.14, 0.14, 0.07, lampOff(), 0.11, 1.0, -0.08);
  part(group, 0.5, 0.09, 0.09, mat(COLORS.dash), 0, 0.66, -0.05);
  group.userData = { a, b };
  return group;
});

// Level-crossing lamps alternate while a train is inbound.
export function setSignalPhase(signal, alerting, on) {
  const { a, b } = signal.userData;
  a.material = alerting && on ? lampOn() : lampOff();
  b.material = alerting && !on ? lampOn() : lampOff();
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

function createTree() {
  const group = new THREE.Group();
  part(group, 0.3, 0.62, 0.3, mat(COLORS.trunk), 0, 0.31, 0);
  const tiers = [
    part(group, 0.94, 0.72, 0.94, mat(COLORS.foliage[0]), 0, 0.92, 0),
    part(group, 0.78, 0.6, 0.78, mat(COLORS.foliage[1]), 0, 1.52, 0),
    part(group, 0.58, 0.48, 0.58, mat(COLORS.foliage[2]), 0, 2.0, 0),
  ];
  group.userData = { tiers };
  return group;
}

export const treePool = new Pool(createTree);

export function dressTree(tree, height, shade) {
  const { tiers } = tree.userData;
  tiers.forEach((tier, i) => {
    tier.visible = i < height;
  });
  const base = COLORS.foliage[shade % COLORS.foliage.length];
  tiers[0].material = mat(base);
  tiers[1].material = mat(COLORS.foliage[(shade + 1) % COLORS.foliage.length]);
  tiers[2].material = mat(base);
  tree.rotation.y = (shade % 4) * (Math.PI / 2);
}

let rockGeo = null;
function createRock() {
  if (!rockGeo) {
    rockGeo = new THREE.IcosahedronGeometry(0.42, 0);
    rockGeo.scale(1, 0.75, 1);
  }
  const mesh = new THREE.Mesh(rockGeo, mat(COLORS.rock, { flatShading: true }));
  mesh.position.y = 0.28;
  mesh.castShadow = true;
  const group = new THREE.Group();
  group.add(mesh);
  return group;
}

export const rockPool = new Pool(createRock);

// ---------------------------------------------------------------------------
// Vehicles. Built facing +x; direction is applied with rotation.y.
// ---------------------------------------------------------------------------

export const CAR_LENGTH = 1.78;
export const TRUCK_LENGTH = 3.5;

function wheels(group, positions, width = 0.9) {
  for (const x of positions) {
    part(group, 0.36, 0.28, width, mat(COLORS.tire), x, 0.14, 0);
  }
}

function createCar() {
  const group = new THREE.Group();
  const bodyMat = mat(COLORS.carBodies[0]);
  wheels(group, [-0.5, 0.5]);
  const body = part(group, 1.62, 0.36, 0.84, bodyMat, 0, 0.37, 0);
  const cabin = part(group, 0.88, 0.32, 0.76, bodyMat, -0.06, 0.7, 0);
  const glass = mat(COLORS.glass);
  part(group, 0.05, 0.22, 0.66, glass, 0.4, 0.7, 0);
  part(group, 0.05, 0.22, 0.66, glass, -0.52, 0.7, 0);
  part(group, 0.62, 0.2, 0.05, glass, -0.06, 0.7, 0.39);
  part(group, 0.62, 0.2, 0.05, glass, -0.06, 0.7, -0.39);
  part(group, 0.06, 0.11, 0.17, mat(COLORS.headlight), 0.83, 0.38, 0.25);
  part(group, 0.06, 0.11, 0.17, mat(COLORS.headlight), 0.83, 0.38, -0.25);
  part(group, 0.06, 0.1, 0.16, mat(COLORS.taillight), -0.83, 0.38, 0.25);
  part(group, 0.06, 0.1, 0.16, mat(COLORS.taillight), -0.83, 0.38, -0.25);
  group.userData = { body, cabin, length: CAR_LENGTH };
  return group;
}

export const carPool = new Pool(createCar);

export function paintCar(car) {
  const color = pick(COLORS.carBodies);
  const material = mat(color);
  car.userData.body.material = material;
  car.userData.cabin.material = material;
}

function createTruck() {
  const group = new THREE.Group();
  wheels(group, [1.24, -0.34, -1.14], 0.86);
  part(group, 3.3, 0.16, 0.74, mat(COLORS.truckChassis), 0.05, 0.26, 0);
  part(group, 0.92, 0.64, 0.88, mat(COLORS.truckCab), 1.28, 0.62, 0);
  part(group, 0.06, 0.28, 0.72, mat(COLORS.glass), 1.75, 0.74, 0);
  part(group, 2.2, 0.94, 0.9, mat(COLORS.truckTrailer), -0.35, 0.8, 0);
  part(group, 0.08, 0.86, 0.82, mat(COLORS.truckChassis), 0.77, 0.8, 0);
  part(group, 0.06, 0.11, 0.16, mat(COLORS.headlight), 1.76, 0.4, 0.28);
  part(group, 0.06, 0.11, 0.16, mat(COLORS.headlight), 1.76, 0.4, -0.28);
  part(group, 0.06, 0.1, 0.16, mat(COLORS.taillight), -1.48, 0.42, 0.3);
  part(group, 0.06, 0.1, 0.16, mat(COLORS.taillight), -1.48, 0.42, -0.3);
  group.userData = { length: TRUCK_LENGTH };
  return group;
}

export const truckPool = new Pool(createTruck);

// ---------------------------------------------------------------------------
// River props
// ---------------------------------------------------------------------------

let logGeo = null;
let ringGeo = null;

function createLog() {
  if (!logGeo) {
    logGeo = new THREE.CylinderGeometry(0.3, 0.3, 1, 9);
    logGeo.rotateZ(Math.PI / 2);
    ringGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.08, 9);
    ringGeo.rotateZ(Math.PI / 2);
  }
  const group = new THREE.Group();
  const body = new THREE.Mesh(logGeo, mat(COLORS.log, { flatShading: true }));
  body.castShadow = true;
  group.add(body);
  const ringMat = mat(COLORS.logRing, { flatShading: true });
  const capA = new THREE.Mesh(ringGeo, ringMat);
  const capB = new THREE.Mesh(ringGeo, ringMat);
  capA.castShadow = capB.castShadow = true;
  group.add(capA, capB);
  group.userData = { body, capA, capB, length: 3 };
  return group;
}

export const logPool = new Pool(createLog);

export function setLogLength(log, length) {
  const { body, capA, capB } = log.userData;
  body.scale.x = length - 0.08;
  capA.position.x = -(length / 2 - 0.04);
  capB.position.x = length / 2 - 0.04;
  log.userData.length = length;
}

let lilyGeo = null;
function createLily() {
  if (!lilyGeo) lilyGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.09, 9);
  const group = new THREE.Group();
  const pad = new THREE.Mesh(lilyGeo, mat(COLORS.lily, { flatShading: true }));
  pad.castShadow = true;
  group.add(pad);
  return group;
}

export const lilyPool = new Pool(createLily);

// A single scaled block standing in for the dense treeline that walls off the
// playfield. Far cheaper than hundreds of individual trees.
function createHedge() {
  const mesh = new THREE.Mesh(box(1, 1, 1), mat(COLORS.foliage[2]));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export const hedgePool = new Pool(createHedge);

// ---------------------------------------------------------------------------
// Train
// ---------------------------------------------------------------------------

export const TRAIN_LENGTH = 13.2;

function trainCar(group, x, length, color) {
  part(group, length, 0.95, 1.0, mat(color), x, 0.78, 0);
  part(group, length - 0.14, 0.16, 1.04, mat(COLORS.trainRoof), x, 1.33, 0);
  part(group, length - 0.9, 0.32, 1.06, mat(COLORS.trainWindow), x, 1.02, 0);
  part(group, length - 0.5, 0.2, 0.9, mat(COLORS.truckChassis), x, 0.2, 0);
}

function createTrain() {
  const group = new THREE.Group();
  trainCar(group, 4.6, 3.6, COLORS.trainBody);
  part(group, 0.5, 0.5, 0.7, mat(COLORS.trainRoof), 6.6, 0.7, 0);
  part(group, 0.14, 0.24, 0.3, mat(COLORS.headlight), 6.9, 0.72, 0);
  trainCar(group, 0.4, 4.0, 0xe9e9ee);
  trainCar(group, -4.2, 4.0, COLORS.trainBody);
  group.userData = { length: TRAIN_LENGTH };
  return group;
}

export const trainPool = new Pool(createTrain);

// ---------------------------------------------------------------------------
// Coin
// ---------------------------------------------------------------------------

let coinGeo = null;
function createCoin() {
  if (!coinGeo) {
    coinGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.07, 14);
    coinGeo.rotateX(Math.PI / 2);
  }
  const group = new THREE.Group();
  const disc = new THREE.Mesh(coinGeo, mat(COLORS.coin));
  disc.castShadow = true;
  group.add(disc);
  return group;
}

export const coinPool = new Pool(createCoin);

// ---------------------------------------------------------------------------
// Chicken. Faces -z, which is "forward" for the player.
// ---------------------------------------------------------------------------

export function makeChicken() {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const white = mat(COLORS.chickenBody);
  const shade = mat(COLORS.chickenShade);
  const orange = mat(COLORS.chickenBeak);
  const red = mat(COLORS.chickenComb);

  part(body, 0.1, 0.15, 0.1, orange, -0.12, 0.075, 0.02);
  part(body, 0.1, 0.15, 0.1, orange, 0.12, 0.075, 0.02);

  part(body, 0.48, 0.36, 0.46, white, 0, 0.32, 0);
  part(body, 0.07, 0.24, 0.32, shade, -0.26, 0.32, -0.01);
  part(body, 0.07, 0.24, 0.32, shade, 0.26, 0.32, -0.01);
  part(body, 0.34, 0.26, 0.12, white, 0, 0.42, 0.27);

  part(body, 0.33, 0.31, 0.29, white, 0, 0.62, -0.07);
  part(body, 0.13, 0.1, 0.15, orange, 0, 0.6, -0.27);
  part(body, 0.08, 0.11, 0.07, red, 0, 0.51, -0.22);
  part(body, 0.08, 0.14, 0.22, red, 0, 0.79, -0.05);
  part(body, 0.06, 0.07, 0.06, mat(COLORS.eye), -0.16, 0.66, -0.14);
  part(body, 0.06, 0.07, 0.06, mat(COLORS.eye), 0.16, 0.66, -0.14);

  group.userData = { body };
  return group;
}

// ---------------------------------------------------------------------------
// Eagle
// ---------------------------------------------------------------------------

export function makeEagle() {
  const group = new THREE.Group();
  const dark = mat(COLORS.eagle);
  part(group, 0.9, 0.5, 0.6, dark, 0, 0, 0);
  part(group, 0.42, 0.4, 0.4, mat(COLORS.eagleHead), 0, 0.16, -0.44);
  part(group, 0.16, 0.13, 0.22, mat(COLORS.eagleBeak), 0, 0.1, -0.72);
  part(group, 0.5, 0.3, 0.24, dark, 0, -0.02, 0.44);
  // Wings hang off pivots at the shoulders so they can flap around the body.
  const left = new THREE.Group();
  left.position.set(-0.4, 0.16, 0);
  part(left, 1.5, 0.12, 0.62, dark, -0.75, 0, 0);
  const right = new THREE.Group();
  right.position.set(0.4, 0.16, 0);
  part(right, 1.5, 0.12, 0.62, dark, 0.75, 0, 0);
  group.add(left, right);
  part(group, 0.12, 0.26, 0.12, mat(COLORS.eagleBeak), -0.2, -0.34, -0.1);
  part(group, 0.12, 0.26, 0.12, mat(COLORS.eagleBeak), 0.2, -0.34, -0.1);
  group.userData = { left, right };
  return group;
}

// Randomised traffic convoy offsets that still wrap seamlessly: n vehicles
// evenly spaced around SPAN, each nudged a little so it never looks metronomic.
export function convoyOffsets(count, jitter) {
  const step = SPAN / count;
  const offsets = [];
  for (let i = 0; i < count; i++) {
    offsets.push(i * step + randRange(-jitter, jitter) * step);
  }
  return offsets;
}
