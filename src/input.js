const KEY_MAP = {
  ArrowUp: 'forward',
  KeyW: 'forward',
  Space: 'forward',
  ArrowDown: 'back',
  KeyS: 'back',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
};

const SWIPE_THRESHOLD = 24;

// Keyboard plus swipe/tap, funnelled into a tiny buffer so a fast second input
// during a hop still registers instead of being dropped.
export class Input {
  constructor(target, handlers) {
    this.handlers = handlers;
    this.buffer = [];
    this.startX = 0;
    this.startY = 0;
    this.startTime = 0;
    this.tracking = false;

    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    target.addEventListener('pointerdown', this.onPointerDown, { passive: false });
    target.addEventListener('pointerup', this.onPointerUp, { passive: false });
    target.addEventListener('pointercancel', this.onPointerCancel);
    target.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  onKeyDown = (event) => {
    if (event.repeat && event.code === 'Space') return;
    const direction = KEY_MAP[event.code];
    if (!direction) return;
    event.preventDefault();
    this.push(direction);
  };

  onPointerDown = (event) => {
    if (event.target.closest('button')) return;
    event.preventDefault();
    this.tracking = true;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.startTime = performance.now();
  };

  onPointerUp = (event) => {
    if (!this.tracking) return;
    this.tracking = false;
    const dx = event.clientX - this.startX;
    const dy = event.clientY - this.startY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (absX < SWIPE_THRESHOLD && absY < SWIPE_THRESHOLD) {
      this.push('forward');
      return;
    }
    if (absX > absY) this.push(dx > 0 ? 'right' : 'left');
    else this.push(dy > 0 ? 'back' : 'forward');
  };

  onPointerCancel = () => {
    this.tracking = false;
  };

  push(direction) {
    this.handlers.onIntent?.();
    if (this.buffer.length < 2) this.buffer.push(direction);
  }

  take() {
    return this.buffer.shift() || null;
  }

  clear() {
    this.buffer.length = 0;
  }
}
