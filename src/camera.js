import * as THREE from 'three';
import { CAMERA } from './constants.js';
import { clamp, damp } from './utils.js';

// Fixed-angle orthographic rig. No perspective divergence means the world keeps
// that flat, toy-diorama look no matter where the player is.
export class CameraRig {
  constructor() {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
    this.direction = new THREE.Vector3(...CAMERA.offset).normalize();
    this.focus = new THREE.Vector3(0, 0, 0);
    this.frustumHeight = CAMERA.frustumHeight;
    this.apply();
  }

  resize(width, height) {
    const aspect = width / height;
    this.frustumHeight = Math.max(
      CAMERA.frustumHeight,
      CAMERA.minVisibleWidth / aspect
    );
    const halfH = this.frustumHeight / 2;
    const halfW = halfH * aspect;
    const cam = this.camera;
    cam.left = -halfW;
    cam.right = halfW;
    cam.top = halfH;
    cam.bottom = -halfH;
    cam.updateProjectionMatrix();
  }

  snap(x, rowIndex) {
    this.focus.set(clamp(x, -CAMERA.maxPan, CAMERA.maxPan), 0, -(rowIndex + CAMERA.lookAhead));
    this.apply();
  }

  update(dt, x, rowIndex) {
    const targetX = clamp(x, -CAMERA.maxPan, CAMERA.maxPan);
    const targetZ = -(rowIndex + CAMERA.lookAhead);
    this.focus.x = damp(this.focus.x, targetX, CAMERA.followLerp, dt);
    this.focus.z = damp(this.focus.z, targetZ, CAMERA.followLerp, dt);
    this.apply();
  }

  apply() {
    const cam = this.camera;
    cam.position
      .copy(this.direction)
      .multiplyScalar(CAMERA.distance)
      .add(this.focus);
    cam.lookAt(this.focus);
  }
}
