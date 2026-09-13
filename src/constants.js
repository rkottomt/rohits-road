// Core tuning values for Rohit's Road.
// One "tile" is one world unit: rows are 1 deep, columns are 1 wide.

export const TILE = 1;

// Playable column range. Everything outside is scenery or open water/asphalt.
export const MIN_COL = -8;
export const MAX_COL = 8;

// Scenery fills out to here on grass rows so wide screens never show an edge.
export const DECOR_COL = 26;

// How wide the row slabs are drawn.
export const ROW_WIDTH = 96;

// Traffic and logs wrap around this span, which keeps convoy spacing even.
export const SPAN = 48;
export const HALF_SPAN = SPAN / 2;

// Surface heights, mirroring the way Crossy Road sits grass above the asphalt.
export const SURFACE = {
  grass: 0.12,
  road: 0,
  rail: 0.03,
  water: -0.08,
};

export const LOG_TOP = 0.16;

export const ROW_TYPES = {
  GRASS: 'grass',
  ROAD: 'road',
  WATER: 'water',
  RAIL: 'rail',
};

export const PLAYER = {
  halfWidth: 0.3,
  hopDuration: 0.145,
  hopHeight: 0.5,
};

export const CAMERA = {
  // Direction from the focus point toward the camera.
  offset: [1, 1.28, 1],
  distance: 120,
  lookAhead: 2.1,
  followLerp: 9.5,
  // Vertical world units in view. ~0.48 units per row at this angle.
  frustumHeight: 7.2,
  // Never show fewer than this many world units across, for tall phones.
  minVisibleWidth: 7.0,
  // How far sideways the camera drifts with the player.
  maxPan: 3.4,
  // Player dies once this many rows behind the scroll line.
  deathMargin: 5.5,
};

export const SCROLL = {
  base: 0.5,
  perScore: 0.0055,
  max: 2.0,
  // Scrolling never lags more than this many rows behind the player.
  leash: 3,
  startDelay: 0.35,
};

export const WORLD = {
  aheadRows: 26,
  behindRows: 11,
  safeStartRows: 5,
};

export const COLORS = {
  sky: [0x74c7ef, 0xdff4fd],
  fog: 0xc7e9f7,

  grassLight: 0x8fd94f,
  grassDark: 0x82cd45,
  grassSide: 0x6cb437,

  road: 0x4b4b53,
  roadDark: 0x45454d,
  dash: 0xf2f0e4,

  water: 0x4aa6e0,
  waterDark: 0x3f9bd6,

  gravel: 0x6a6a70,
  railMetal: 0xa8adb3,
  sleeper: 0x584130,
  postRed: 0xe4483a,
  postDark: 0x35383d,

  trunk: 0x6b4a2b,
  foliage: [0x2f8f3f, 0x37a04a, 0x268036, 0x43ab52],
  rock: 0x9aa2a8,

  log: 0x7b5230,
  logRing: 0x5f3d22,
  lily: 0x3f9c4a,

  chickenBody: 0xfdfdfd,
  chickenShade: 0xe9e9ee,
  chickenBeak: 0xf5a623,
  chickenComb: 0xe4483a,
  eye: 0x24242a,

  carBodies: [
    0xe94b3c, 0x3e8fd8, 0xf3c22b, 0x8e5bd0, 0x35b56a, 0xf07f2c, 0xf2f2f2,
    0x2f3b4c, 0xef6ea8,
  ],
  glass: 0x2d3b47,
  tire: 0x24252a,
  headlight: 0xfff2b8,
  taillight: 0xe4483a,

  truckCab: 0xf4f4f4,
  truckTrailer: 0xd9dde1,
  truckChassis: 0x3a3d42,

  trainBody: 0xd8443a,
  trainRoof: 0x3d4148,
  trainWindow: 0x2d3b47,

  coin: 0xffc21f,
  coinEdge: 0xe39a06,

  eagle: 0x4a4238,
  eagleHead: 0xf0efe8,
  eagleBeak: 0xf5a623,

  shadow: 0x000000,
};

export const DEATH_REASONS = {
  car: 'FLATTENED BY TRAFFIC',
  truck: 'FLATTENED BY TRAFFIC',
  train: 'HIT BY A TRAIN',
  water: 'GONE FOR A SWIM',
  drift: 'WASHED AWAY',
  eagle: 'TOO SLOW! THE EAGLE GOT YOU',
};
