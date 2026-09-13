import * as THREE from 'three';
import { MAX_COL, MIN_COL, PLAYER, ROW_TYPES, SURFACE, LOG_TOP } from './constants.js';
import { makeChicken } from './models.js';
import { clamp, damp, lerp } from './utils.js';

const TWO_PI = Math.PI * 2;

// Shortest angular distance, so the chicken never spins the long way round.
function angleTo(from, to) {
  let delta = (to - from) % TWO_PI;
  if (delta > Math.PI) delta -= TWO_PI;
  if (delta < -Math.PI) delta += TWO_PI;
  return from + delta;
}

const YAW = {
  forward: 0,
  back: Math.PI,
  right: -Math.PI / 2,
  left: Math.PI / 2,
};

export class Player {
  constructor(scene) {
    this.object = makeChicken();
    this.body = this.object.userData.body;
    this.object.traverse((child) => {
      if (child.isMesh) child.castShadow = true;
    });
    scene.add(this.object);

    this.reset();
  }

  reset() {
    this.index = 2;
    this.col = 0;
    this.x = 0;
    this.y = SURFACE.grass;
    this.state = 'idle';
    this.dead = false;

    this.hopT = 0;
    this.from = { x: 0, index: 2, y: this.y };
    this.to = { x: 0, index: 2, y: this.y };

    this.ride = null;
    this.rideOffset = 0;

    this.yaw = 0;
    this.targetYaw = 0;
    this.deathKind = null;
    this.deathT = 0;
    this.maxIndex = 2;

    this.object.visible = true;
    this.object.position.set(0, this.y, -this.index);
    this.object.rotation.set(0, 0, 0);
    this.object.scale.set(1, 1, 1);
    this.body.scale.set(1, 1, 1);
    this.body.rotation.set(0, 0, 0);
    this.body.position.set(0, 0, 0);
  }

  get z() {
    return -this.object.position.z;
  }

  // Attempts a grid hop. Returns 'moved', 'blocked' or null.
  move(world, dx, dz) {
    if (this.state !== 'idle' || this.dead) return null;

    const fromIndex = this.index;
    const fromX = this.x;
    const targetIndex = fromIndex + dz;
    if (targetIndex < 0) return null;

    // Riding a log means our column is fractional; snap to the nearest lane.
    const baseCol = this.ride ? Math.round(this.x) : this.col;
    const targetCol = dz !== 0 ? baseCol : baseCol + dx;

    this.targetYaw =
      dz > 0 ? YAW.forward : dz < 0 ? YAW.back : dx > 0 ? YAW.right : YAW.left;

    if (targetCol < MIN_COL || targetCol > MAX_COL) return 'blocked';
    if (world.isBlocked(targetIndex, targetCol)) return 'blocked';

    this.ride = null;
    this.state = 'hop';
    this.hopT = 0;
    this.from.x = fromX;
    this.from.index = fromIndex;
    this.from.y = this.y;
    this.to.x = targetCol;
    this.to.index = targetIndex;
    this.to.y = this.landingHeight(world, targetIndex, targetCol);
    return 'moved';
  }

  landingHeight(world, index, x) {
    const row = world.getRow(index);
    if (!row) return SURFACE.grass;
    if (row.type === ROW_TYPES.WATER) {
      if (world.logAt(row, x) || world.lilyAt(row, x) !== null) return LOG_TOP;
      return row.surfaceY;
    }
    return row.surfaceY;
  }

  update(dt, world) {
    if (this.dead) {
      this.updateDeath(dt);
      return null;
    }

    let landed = null;

    if (this.state === 'hop') {
      this.hopT += dt / PLAYER.hopDuration;
      if (this.hopT >= 1) {
        this.hopT = 1;
        this.state = 'idle';
        this.index = this.to.index;
        this.col = this.to.x;
        this.x = this.to.x;
        this.y = this.to.y;
        this.maxIndex = Math.max(this.maxIndex, this.index);
        landed = this.index;
      } else {
        const t = this.hopT;
        this.x = lerp(this.from.x, this.to.x, t);
        this.index = lerp(this.from.index, this.to.index, t);
        this.y = lerp(this.from.y, this.to.y, t) + Math.sin(Math.PI * t) * PLAYER.hopHeight;
      }

      const arc = Math.sin(Math.PI * this.hopT);
      this.body.scale.set(1 - 0.14 * arc, 1 + 0.26 * arc, 1 - 0.14 * arc);
    } else {
      // Settle the landing squash.
      this.body.scale.x = damp(this.body.scale.x, 1, 16, dt);
      this.body.scale.y = damp(this.body.scale.y, 1, 16, dt);
      this.body.scale.z = damp(this.body.scale.z, 1, 16, dt);

      if (this.ride) {
        this.x = this.ride.x + this.rideOffset;
        this.col = Math.round(this.x);
      }
    }

    this.yaw = damp(this.yaw, angleTo(this.yaw, this.targetYaw), 18, dt);
    this.object.position.set(this.x, this.y, -this.index);
    this.object.rotation.y = this.yaw;

    return landed;
  }

  squashOnLand() {
    this.body.scale.set(1.2, 0.72, 1.2);
  }

  attach(mover) {
    this.ride = mover;
    this.rideOffset = clamp(this.x - mover.x, -mover.length / 2, mover.length / 2);
  }

  kill(kind) {
    if (this.dead) return;
    this.dead = true;
    this.state = 'dead';
    this.deathKind = kind;
    this.deathT = 0;
    this.ride = null;
  }

  updateDeath(dt) {
    this.deathT += dt;
    const t = this.deathT;

    if (this.deathKind === 'flat') {
      const k = Math.min(1, t / 0.09);
      this.body.scale.set(1 + 0.42 * k, Math.max(0.1, 1 - 0.9 * k), 1 + 0.42 * k);
      this.object.position.y = lerp(this.y, this.y - 0.02, k);
    } else if (this.deathKind === 'sink') {
      const k = Math.min(1, t / 0.55);
      this.object.position.y = lerp(this.y, this.y - 0.85, k);
      this.body.rotation.z = k * 0.5;
      this.object.rotation.y += dt * 1.4;
    } else if (this.deathKind === 'carried') {
      // Position is driven by the eagle.
      this.body.rotation.z = Math.sin(t * 12) * 0.16;
    }
  }
}
