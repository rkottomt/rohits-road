// Tiny synthesised sound bank. No files to fetch, so nothing can stall startup.
export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('rr-muted') === '1';
    this.master = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.32;
    this.master.connect(this.ctx.destination);
  }

  setMuted(muted) {
    this.muted = muted;
    localStorage.setItem('rr-muted', muted ? '1' : '0');
    if (this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.32, this.ctx.currentTime, 0.02);
    }
  }

  tone(freq, duration, type = 'square', gain = 0.5, slide = 0) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), now + duration);
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(gain, now + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(env).connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  noise(duration, filterFreq, gain = 0.4) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const frames = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const env = this.ctx.createGain();
    env.gain.value = gain;
    src.connect(filter).connect(env).connect(this.master);
    src.start(now);
  }

  hop() {
    this.tone(520, 0.07, 'square', 0.22, 180);
  }

  blocked() {
    this.tone(150, 0.06, 'square', 0.12);
  }

  coin() {
    this.tone(988, 0.06, 'square', 0.24);
    setTimeout(() => this.tone(1318, 0.1, 'square', 0.24), 55);
  }

  splash() {
    this.noise(0.35, 900, 0.5);
    this.tone(260, 0.25, 'sine', 0.18, -140);
  }

  crash() {
    this.noise(0.3, 500, 0.7);
    this.tone(90, 0.28, 'sawtooth', 0.3, -40);
  }

  screech() {
    this.tone(1400, 0.16, 'sawtooth', 0.2, -900);
    setTimeout(() => this.tone(1150, 0.2, 'sawtooth', 0.18, -700), 130);
  }

  horn() {
    this.tone(320, 0.5, 'sawtooth', 0.16);
    this.tone(214, 0.5, 'sawtooth', 0.14);
  }
}
