export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export const lerp = (a, b, t) => a + (b - a) * t;

// Frame-rate independent exponential smoothing.
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));

export const randRange = (lo, hi) => lo + Math.random() * (hi - lo);

export const randInt = (lo, hi) => Math.floor(lo + Math.random() * (hi - lo + 1));

export const pick = (arr) => arr[(Math.random() * arr.length) | 0];

export const chance = (p) => Math.random() < p;

// Wraps a position into the traffic span so convoys loop forever.
export const wrapSpan = (x, span) => {
  const half = span / 2;
  let v = (x + half) % span;
  if (v < 0) v += span;
  return v - half;
};

export const easeOutBack = (t) => {
  const c = 1.9;
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
};

// Simple free-list. Objects are expensive to build but cheap to hide and reuse.
export class Pool {
  constructor(create) {
    this.create = create;
    this.free = [];
  }

  acquire() {
    const item = this.free.pop() || this.create();
    item.visible = true;
    return item;
  }

  release(item) {
    item.visible = false;
    if (item.parent) item.parent.remove(item);
    this.free.push(item);
  }
}
