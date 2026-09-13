import * as THREE from 'three';
import {
  DECOR_COL,
  HALF_SPAN,
  MAX_COL,
  MIN_COL,
  ROW_TYPES,
  SPAN,
  SURFACE,
  WORLD,
  LOG_TOP,
} from './constants.js';
import {
  CAR_LENGTH,
  SLAB_HEIGHT,
  SLAB_MATERIALS,
  TRAIN_LENGTH,
  TRUCK_LENGTH,
  carPool,
  coinPool,
  convoyOffsets,
  dashPool,
  dressTree,
  hedgePool,
  lilyPool,
  logPool,
  paintCar,
  railSlabPool,
  railsPool,
  rockPool,
  setLogLength,
  setSignalPhase,
  signalPool,
  slabPool,
  trainPool,
  treePool,
  truckPool,
} from './models.js';
import { chance, clamp, pick, randInt, randRange, wrapSpan } from './utils.js';

const { GRASS, ROAD, WATER, RAIL } = ROW_TYPES;

const TRAIN_SPEED = 27;
const TRAIN_EXIT = HALF_SPAN + TRAIN_LENGTH / 2 + 3;

// A single row of the world: its slab, its scenery and anything moving on it.
class Row {
  constructor() {
    this.group = new THREE.Group();
    this.index = 0;
    this.type = GRASS;
    this.surfaceY = 0;

    this.blocked = new Set();
    this.props = [];
    this.movers = [];
    this.lilies = [];
    this.coin = null;
    this.coinCol = 0;

    this.dir = 1;
    this.speed = 0;
    this.phase = 0;

    this.signals = null;
    this.train = null;
    this.trainState = 'idle';
    this.trainTimer = 0;
    this.trainX = 0;
    this.hornPlayed = false;
    this.lampOn = false;
    this.alerting = false;
    this.blinkTimer = 0;

    this.slab = null;
    this.dash = null;
    this.rails = null;
  }

  get active() {
    return this.type === ROAD || this.type === WATER || this.type === RAIL;
  }
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.container = new THREE.Group();
    scene.add(this.container);

    this.rows = new Map();
    this.rowPool = [];
    this.queue = [];
    this.lastType = GRASS;
    this.nextIndex = 0;
  }

  reset() {
    for (const row of this.rows.values()) this.recycleRow(row);
    this.rows.clear();
    this.queue.length = 0;
    this.lastType = GRASS;
    this.nextIndex = 0;
    this.ensure(0);
  }

  getRow(index) {
    return this.rows.get(index);
  }

  isBlocked(index, col) {
    if (col < MIN_COL || col > MAX_COL) return true;
    const row = this.rows.get(index);
    return row ? row.blocked.has(col) : false;
  }

  surfaceAt(index) {
    const row = this.rows.get(index);
    return row ? row.surfaceY : SURFACE.grass;
  }

  // -------------------------------------------------------------------------
  // Streaming
  // -------------------------------------------------------------------------

  ensure(focusIndex) {
    const ahead = focusIndex + WORLD.aheadRows;
    while (this.nextIndex <= ahead) {
      this.buildRow(this.nextIndex);
      this.nextIndex++;
    }
    const cutoff = focusIndex - WORLD.behindRows;
    for (const [index, row] of this.rows) {
      if (index < cutoff) {
        this.recycleRow(row);
        this.rows.delete(index);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Generation
  // -------------------------------------------------------------------------

  difficulty(index) {
    return clamp((index - WORLD.safeStartRows) / 170, 0, 1);
  }

  nextType(index) {
    if (index < WORLD.safeStartRows) return GRASS;
    if (this.queue.length === 0) this.fillQueue(index);
    const type = this.queue.shift();
    this.lastType = type;
    return type;
  }

  fillQueue(index) {
    const d = this.difficulty(index);

    // Obstacle bands are separated by breathing room, same as the original.
    if (this.lastType !== GRASS && chance(0.62 - 0.18 * d)) {
      const count = chance(0.72) ? 1 : 2;
      for (let i = 0; i < count; i++) this.queue.push(GRASS);
      return;
    }

    // Roads may butt up against each other; rivers and tracks always get a break.
    const options = [
      [ROAD, 30 + 12 * d],
      [WATER, 15 + 7 * d],
      [RAIL, 3 + 9 * d],
    ].filter(([type]) => type === ROAD || type !== this.lastType);

    let total = 0;
    for (const [, w] of options) total += w;
    let roll = Math.random() * total;
    let chosen = ROAD;
    for (const [type, w] of options) {
      roll -= w;
      if (roll <= 0) {
        chosen = type;
        break;
      }
    }

    let count = 1;
    if (chosen === ROAD) count = randInt(1, 2 + Math.round(2 * d));
    else if (chosen === WATER) count = randInt(1, 2 + Math.round(d));
    else if (chosen === RAIL) count = randInt(1, chance(0.3 + 0.3 * d) ? 2 : 1);
    for (let i = 0; i < count; i++) this.queue.push(chosen);
  }

  buildRow(index) {
    const row = this.rowPool.pop() || new Row();
    row.index = index;
    row.group.position.set(0, 0, -index);

    const prev = this.rows.get(index - 1);
    const type = this.nextType(index);
    row.type = type;
    row.surfaceY = SURFACE[type];

    switch (type) {
      case GRASS:
        this.buildGrass(row, index);
        break;
      case ROAD:
        this.buildRoad(row, index, prev && prev.type === ROAD);
        break;
      case WATER:
        this.buildWater(row, index, prev);
        break;
      case RAIL:
        this.buildRail(row, index);
        break;
    }

    this.container.add(row.group);
    this.rows.set(index, row);
    return row;
  }

  setSlab(row, materialKey) {
    const slab = slabPool.acquire();
    slab.material = SLAB_MATERIALS[materialKey]();
    slab.position.y = row.surfaceY - SLAB_HEIGHT / 2;
    row.slab = slab;
    row.group.add(slab);
    row.props.push({ pool: slabPool, object: slab });
  }

  buildGrass(row, index) {
    this.setSlab(row, index % 2 === 0 ? 'grassLight' : 'grassDark');

    const d = this.difficulty(index);
    const treeChance = index < WORLD.safeStartRows ? 0 : 0.1 + 0.13 * d;
    let placed = 0;
    const maxTrees = 6;

    for (let col = MIN_COL; col <= MAX_COL; col++) {
      if (placed >= maxTrees) break;
      // Never wall off the lane the player is most likely arriving on.
      if (index < WORLD.safeStartRows + 1 && col === 0) continue;
      if (!chance(treeChance)) continue;
      this.addTree(row, col, randInt(1, 3));
      placed++;
    }

    if (index >= WORLD.safeStartRows && placed < maxTrees && chance(0.06)) {
      const col = randInt(MIN_COL, MAX_COL);
      if (!row.blocked.has(col)) this.addRock(row, col);
    }

    // Treeline walls: two real trees then a hedge block out to the horizon.
    for (const side of [-1, 1]) {
      this.addTree(row, side * (MAX_COL + 1), randInt(2, 3), false);
      this.addTree(row, side * (MAX_COL + 2), randInt(1, 3), false);
      const inner = MAX_COL + 2.6;
      const width = DECOR_COL - inner;
      const hedge = hedgePool.acquire();
      const height = randRange(1.15, 1.85);
      hedge.scale.set(width, height, 1);
      hedge.position.set(side * (inner + width / 2), row.surfaceY + height / 2, 0);
      row.group.add(hedge);
      row.props.push({ pool: hedgePool, object: hedge });
    }

    if (index >= WORLD.safeStartRows + 2 && chance(0.1)) {
      const options = [];
      for (let col = MIN_COL + 1; col <= MAX_COL - 1; col++) {
        if (!row.blocked.has(col)) options.push(col);
      }
      if (options.length) {
        const col = pick(options);
        const coin = coinPool.acquire();
        coin.position.set(col, row.surfaceY + 0.42, 0);
        row.group.add(coin);
        row.coin = coin;
        row.coinCol = col;
        row.props.push({ pool: coinPool, object: coin });
      }
    }
  }

  addTree(row, col, height, blocks = true) {
    const tree = treePool.acquire();
    dressTree(tree, height, randInt(0, 3));
    tree.position.set(col, row.surfaceY, 0);
    row.group.add(tree);
    row.props.push({ pool: treePool, object: tree });
    if (blocks) row.blocked.add(col);
  }

  addRock(row, col) {
    const rock = rockPool.acquire();
    rock.position.set(col, row.surfaceY, 0);
    rock.children[0].rotation.y = Math.random() * Math.PI;
    row.group.add(rock);
    row.props.push({ pool: rockPool, object: rock });
    row.blocked.add(col);
  }

  buildRoad(row, index, prevIsRoad) {
    this.setSlab(row, index % 2 === 0 ? 'road' : 'roadDark');

    if (prevIsRoad) {
      const dash = dashPool.acquire();
      dash.position.set(0, row.surfaceY + 0.012, 0.5);
      row.group.add(dash);
      row.dash = dash;
      row.props.push({ pool: dashPool, object: dash });
    }

    const d = this.difficulty(index);
    const useTrucks = chance(0.26);
    const length = useTrucks ? TRUCK_LENGTH : CAR_LENGTH;
    const pool = useTrucks ? truckPool : carPool;

    row.dir = chance(0.5) ? 1 : -1;
    row.speed = useTrucks
      ? randRange(1.7, 2.9) * (1 + 0.4 * d)
      : randRange(2.1, 3.9) * (1 + 0.4 * d);
    row.phase = Math.random() * SPAN;

    const gap = randRange(2.8, 6.0) - 1.2 * d;
    const count = Math.max(2, Math.floor(SPAN / (length + Math.max(2.2, gap))));
    const offsets = convoyOffsets(count, 0.16);

    for (const offset of offsets) {
      const mesh = pool.acquire();
      if (!useTrucks) paintCar(mesh);
      mesh.rotation.y = row.dir > 0 ? 0 : Math.PI;
      mesh.position.y = row.surfaceY;
      row.group.add(mesh);
      row.movers.push({ pool, object: mesh, offset, length });
    }
    this.positionMovers(row);
  }

  buildWater(row, index, prev) {
    this.setSlab(row, index % 2 === 0 ? 'water' : 'waterDark');

    const d = this.difficulty(index);
    if (chance(0.16)) {
      // Static lily pads instead of drifting logs.
      row.speed = 0;
      const cols = [];
      for (let col = MIN_COL; col <= MAX_COL; col++) cols.push(col);
      const padCount = randInt(6, 9);
      for (let i = 0; i < padCount && cols.length; i++) {
        const col = cols.splice((Math.random() * cols.length) | 0, 1)[0];
        const pad = lilyPool.acquire();
        pad.position.set(col, LOG_TOP - 0.06, 0);
        row.group.add(pad);
        row.lilies.push(col);
        row.props.push({ pool: lilyPool, object: pad });
      }
      return;
    }

    // Alternate direction against the previous river row so crossings stay fair.
    row.dir = prev && prev.type === WATER && prev.speed > 0 ? -prev.dir : chance(0.5) ? 1 : -1;
    row.speed = randRange(1.1, 2.3) * (1 + 0.35 * d);
    row.phase = Math.random() * SPAN;

    const length = pick([2.4, 3.4, 3.4, 4.4]);
    const gap = randRange(1.5, 2.9);
    const count = Math.max(2, Math.floor(SPAN / (length + gap)));
    const offsets = convoyOffsets(count, 0.12);

    for (const offset of offsets) {
      const log = logPool.acquire();
      setLogLength(log, length);
      log.position.y = LOG_TOP - 0.14;
      row.group.add(log);
      row.movers.push({ pool: logPool, object: log, offset, length });
    }
    this.positionMovers(row);
  }

  buildRail(row, index) {
    const slab = railSlabPool.acquire();
    slab.position.y = row.surfaceY - SLAB_HEIGHT / 2;
    row.group.add(slab);
    row.slab = slab;
    row.props.push({ pool: railSlabPool, object: slab });

    const rails = railsPool.acquire();
    rails.position.y = row.surfaceY;
    row.group.add(rails);
    row.rails = rails;
    row.props.push({ pool: railsPool, object: rails });

    row.signals = [];
    for (const side of [-1, 1]) {
      const signal = signalPool.acquire();
      signal.position.set(side * (MAX_COL + 1.4), row.surfaceY, 0);
      signal.rotation.y = side > 0 ? Math.PI : 0;
      setSignalPhase(signal, false, false);
      row.group.add(signal);
      row.signals.push(signal);
      row.props.push({ pool: signalPool, object: signal });
    }

    row.trainState = 'idle';
    row.trainTimer = randRange(1.2, 5.0);
    row.dir = chance(0.5) ? 1 : -1;
  }

  positionMovers(row) {
    for (const mover of row.movers) {
      mover.x = wrapSpan(mover.offset + row.phase * row.dir, SPAN);
      mover.object.position.x = mover.x;
    }
  }

  // -------------------------------------------------------------------------
  // Per-frame update
  // -------------------------------------------------------------------------

  update(dt, elapsed) {
    for (const row of this.rows.values()) {
      if (row.speed > 0 && row.movers.length) {
        row.phase += dt * row.speed;
        if (row.phase > SPAN) row.phase -= SPAN;
        this.positionMovers(row);
      }

      if (row.type === RAIL) this.updateRail(row, dt);

      if (row.coin) {
        row.coin.rotation.y += dt * 3.2;
        row.coin.position.y =
          row.surfaceY + 0.42 + Math.sin(elapsed * 3 + row.index) * 0.07;
      }
    }
  }

  updateRail(row, dt) {
    row.trainTimer -= dt;

    if (row.trainState === 'idle') {
      if (row.trainTimer <= 0) {
        row.trainState = 'warn';
        row.trainTimer = 1.6;
        row.dir = chance(0.5) ? 1 : -1;
        row.blinkTimer = 0;
      }
    } else if (row.trainState === 'warn') {
      if (row.trainTimer <= 0) {
        row.trainState = 'run';
        const train = trainPool.acquire();
        train.position.y = row.surfaceY;
        train.rotation.y = row.dir > 0 ? 0 : Math.PI;
        row.group.add(train);
        row.train = train;
        row.trainX = -row.dir * TRAIN_EXIT;
        train.position.x = row.trainX;
      }
    } else if (row.trainState === 'run') {
      row.trainX += dt * TRAIN_SPEED * row.dir;
      row.train.position.x = row.trainX;
      if (Math.abs(row.trainX) > TRAIN_EXIT) {
        trainPool.release(row.train);
        row.train = null;
        row.trainState = 'idle';
        row.trainTimer = randRange(2.6, 6.5);
      }
    }

    const alerting = row.trainState !== 'idle';
    row.blinkTimer += dt;
    const on = row.blinkTimer % 0.44 < 0.22;
    if (alerting !== row.alerting || (alerting && on !== row.lampOn)) {
      row.alerting = alerting;
      row.lampOn = on;
      for (const signal of row.signals) setSignalPhase(signal, alerting, on);
    }
  }

  // -------------------------------------------------------------------------
  // Queries used by the player
  // -------------------------------------------------------------------------

  // Returns the mover the player is standing on, or null.
  logAt(row, x, halfWidth = 0.18) {
    for (const mover of row.movers) {
      if (Math.abs(x - mover.x) <= mover.length / 2 + halfWidth) return mover;
    }
    return null;
  }

  lilyAt(row, x) {
    for (const col of row.lilies) {
      if (Math.abs(x - col) < 0.46) return col;
    }
    return null;
  }

  vehicleHit(row, x, halfWidth) {
    for (const mover of row.movers) {
      if (Math.abs(x - mover.x) < mover.length / 2 + halfWidth) return mover;
    }
    return null;
  }

  trainHit(row, x, halfWidth) {
    if (row.trainState !== 'run' || !row.train) return false;
    return Math.abs(x - row.trainX) < TRAIN_LENGTH / 2 + halfWidth;
  }

  collectCoin(row) {
    if (!row.coin) return false;
    const coin = row.coin;
    row.coin = null;
    const entry = row.props.find((p) => p.object === coin);
    if (entry) row.props.splice(row.props.indexOf(entry), 1);
    coinPool.release(coin);
    return true;
  }

  recycleRow(row) {
    for (const { pool, object } of row.props) pool.release(object);
    for (const { pool, object } of row.movers) pool.release(object);
    row.props.length = 0;
    row.movers.length = 0;
    row.lilies.length = 0;
    row.blocked.clear();
    row.coin = null;

    if (row.train) {
      trainPool.release(row.train);
      row.train = null;
    }
    row.trainState = 'idle';
    row.signals = null;
    row.alerting = false;
    row.lampOn = false;
    row.blinkTimer = 0;
    row.speed = 0;
    row.phase = 0;

    row.group.clear();
    row.slab = null;
    row.dash = null;
    row.rails = null;
    this.container.remove(row.group);
    this.rowPool.push(row);
  }
}
