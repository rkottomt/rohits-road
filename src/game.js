import * as THREE from 'three';
import { Audio } from './audio.js';
import { CameraRig } from './camera.js';
import {
  CAMERA,
  DEATH_REASONS,
  LOG_TOP,
  MAX_COL,
  PLAYER,
  ROW_TYPES,
  SCROLL,
} from './constants.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { makeEagle } from './models.js';
import { Player } from './player.js';
import { clamp, damp } from './utils.js';
import { World } from './world.js';

const START_INDEX = 2;
const MOVES = {
  forward: [0, 1],
  back: [0, -1],
  left: [-1, 0],
  right: [1, 0],
};

export class Game {
  constructor(scene, canvas) {
    this.scene = scene;
    this.world = new World(scene);
    this.player = new Player(scene);
    this.rig = new CameraRig();
    this.hud = new Hud();
    this.audio = new Audio();

    this.eagle = makeEagle();
    this.eagle.visible = false;
    this.eagle.traverse((child) => {
      if (child.isMesh) child.castShadow = true;
    });
    scene.add(this.eagle);

    this.best = Number(localStorage.getItem('rr-best') || 0);
    this.coins = Number(localStorage.getItem('rr-coins') || 0);

    this.input = new Input(canvas, { onIntent: () => this.audio.ensure() });

    this.hud.soundBtn.addEventListener('click', () => {
      this.audio.ensure();
      this.audio.setMuted(!this.audio.muted);
      this.hud.setMuted(this.audio.muted);
    });
    this.hud.setMuted(this.audio.muted);

    this.state = 'title';
    this.setup();
    this.hud.setBest(this.best);
    this.hud.setCoins(this.coins);
    this.hud.showTitle(true);
  }

  setup() {
    this.world.reset();
    this.player.reset();
    this.player.index = START_INDEX;
    this.player.maxIndex = START_INDEX;
    this.player.object.position.z = -START_INDEX;

    this.scrollIndex = START_INDEX;
    this.started = false;
    this.startTimer = 0;
    this.score = 0;
    this.elapsed = 0;
    this.deathTimer = 0;
    this.deathReason = null;
    this.eaglePhase = 0;
    this.eagle.visible = false;

    this.rig.snap(0, START_INDEX);
    this.hud.setScore(0);
    this.input.clear();
  }

  start() {
    this.hud.showTitle(false);
    this.state = 'playing';
  }

  restart() {
    this.hud.showGameOver(false);
    this.setup();
    this.state = 'playing';
  }

  update(dt) {
    this.elapsed += dt;

    switch (this.state) {
      case 'title':
        this.world.update(dt, this.elapsed);
        if (this.input.buffer.length) this.start();
        break;
      case 'playing':
        this.updatePlaying(dt);
        break;
      case 'dying':
        this.updateDying(dt);
        break;
      case 'over':
        this.world.update(dt, this.elapsed);
        this.deathTimer += dt;
        // Swallow input briefly so the tap that killed you doesn't skip the panel.
        if (this.deathTimer < 0.6) this.input.clear();
        else if (this.input.buffer.length) this.restart();
        break;
    }
  }

  updatePlaying(dt) {
    const { player, world } = this;

    this.world.update(dt, this.elapsed);
    this.consumeInput();

    const landed = player.update(dt, world);
    if (landed !== null) this.onLanded(landed);

    this.rideAndCollide(dt);
    if (this.state !== 'playing') return;

    this.updateScroll(dt);
    this.rig.update(dt, player.x, this.cameraIndex());
    world.ensure(Math.round(Math.max(this.scrollIndex, player.maxIndex)));
  }

  consumeInput() {
    const direction = this.input.take();
    if (!direction) return;
    const [dx, dz] = MOVES[direction];
    const result = this.player.move(this.world, dx, dz);
    if (result === 'moved') {
      this.started = true;
      this.audio.hop();
    } else if (result === 'blocked') {
      this.audio.blocked();
    }
  }

  onLanded(index) {
    const { player, world } = this;
    player.squashOnLand();

    const row = world.getRow(index);
    if (!row) return;

    if (row.coin && row.coinCol === player.col) {
      world.collectCoin(row);
      this.coins++;
      localStorage.setItem('rr-coins', String(this.coins));
      this.hud.setCoins(this.coins);
      this.audio.coin();
    }

    if (row.type === ROW_TYPES.WATER) {
      const log = world.logAt(row, player.x);
      if (log) {
        player.attach(log);
        player.y = LOG_TOP;
      } else if (world.lilyAt(row, player.x) === null) {
        this.die('water');
        return;
      }
    }

    const gained = player.maxIndex - START_INDEX;
    if (gained > this.score) {
      this.score = gained;
      this.hud.setScore(this.score);
    }
  }

  rideAndCollide(dt) {
    const { player, world } = this;
    if (player.dead) return;

    if (player.ride && Math.abs(player.x) > MAX_COL + 0.55) {
      this.die('drift');
      return;
    }

    const index = Math.round(player.index);
    const row = world.getRow(index);
    if (!row) return;

    if (row.type === ROW_TYPES.ROAD) {
      const hit = world.vehicleHit(row, player.x, PLAYER.halfWidth);
      if (hit) {
        this.die(hit.length > 3 ? 'truck' : 'car');
        return;
      }
    } else if (row.type === ROW_TYPES.RAIL) {
      if (world.trainHit(row, player.x, PLAYER.halfWidth)) {
        this.die('train');
        return;
      }
      if (row.trainState === 'warn' && !row.hornPlayed) {
        row.hornPlayed = true;
        this.audio.horn();
      }
      if (row.trainState === 'idle') row.hornPlayed = false;
    }
  }

  updateScroll(dt) {
    if (!this.started) return;
    this.startTimer += dt;
    if (this.startTimer < SCROLL.startDelay) return;

    const speed = Math.min(SCROLL.max, SCROLL.base + this.score * SCROLL.perScore);
    this.scrollIndex += speed * dt;
    this.scrollIndex = Math.max(this.scrollIndex, this.player.maxIndex - SCROLL.leash);

    if (this.player.index < this.scrollIndex - CAMERA.deathMargin) {
      this.die('eagle');
    }
  }

  cameraIndex() {
    return Math.max(this.scrollIndex, this.player.index - 1.2);
  }

  die(reason) {
    if (this.state !== 'playing') return;
    this.state = 'dying';
    this.deathReason = reason;
    this.deathTimer = 0;
    this.input.clear();

    if (reason === 'eagle') {
      this.player.kill('carried');
      this.eaglePhase = 0;
      this.eagle.visible = true;
      this.eagle.position.set(this.player.x, this.player.y + 7, -this.player.index - 3);
      this.audio.screech();
    } else if (reason === 'water' || reason === 'drift') {
      this.player.kill('sink');
      this.audio.splash();
    } else {
      this.player.kill('flat');
      this.audio.crash();
    }
  }

  updateDying(dt) {
    this.deathTimer += dt;
    this.world.update(dt, this.elapsed);
    this.player.update(dt, this.world);

    if (this.deathReason === 'eagle') this.updateEagle(dt);

    this.rig.update(dt, this.player.x, this.cameraIndex());

    const duration = this.deathReason === 'eagle' ? 1.9 : 1.05;
    if (this.deathTimer >= duration) this.finish();
  }

  updateEagle(dt) {
    const t = this.deathTimer;
    const eagle = this.eagle;
    const player = this.player;
    const flap = Math.sin(t * 22);
    eagle.userData.left.rotation.z = flap * 0.6;
    eagle.userData.right.rotation.z = -flap * 0.6;

    if (t < 0.55) {
      // Dive.
      const k = clamp(t / 0.55, 0, 1);
      eagle.position.x = damp(eagle.position.x, player.x, 8, dt);
      eagle.position.y = 7 * (1 - k) + player.y + 0.55;
      eagle.position.z = damp(eagle.position.z, -player.index - 0.15, 8, dt);
      eagle.rotation.x = -0.5 * (1 - k);
    } else {
      // Carry the chicken skyward.
      const k = clamp((t - 0.55) / 1.1, 0, 1);
      const lift = k * k * 9;
      eagle.position.y = player.y + 0.55 + lift;
      eagle.position.z -= dt * 1.6;
      eagle.rotation.x = damp(eagle.rotation.x, 0, 6, dt);
      player.object.position.set(
        eagle.position.x,
        eagle.position.y - 0.6,
        eagle.position.z + 0.1
      );
      player.object.rotation.y += dt * 3;
    }
  }

  finish() {
    this.state = 'over';
    this.deathTimer = 0;
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem('rr-best', String(this.best));
      this.hud.setBest(this.best);
    }
    this.hud.showGameOver(true, {
      score: this.score,
      best: this.best,
      reason: DEATH_REASONS[this.deathReason] || '',
    });
  }
}
