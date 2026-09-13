export class Hud {
  constructor() {
    this.scoreEl = document.getElementById('score');
    this.bestEl = document.getElementById('best');
    this.coinEl = document.getElementById('coin-count');
    this.titleEl = document.getElementById('title-screen');
    this.overEl = document.getElementById('over-screen');
    this.reasonEl = document.getElementById('over-reason');
    this.finalScoreEl = document.getElementById('final-score');
    this.finalBestEl = document.getElementById('final-best');
    this.soundBtn = document.getElementById('sound');

    this.score = -1;
    this.bumpTimer = null;
  }

  setScore(value) {
    if (value === this.score) return;
    this.score = value;
    this.scoreEl.textContent = value;
    this.scoreEl.classList.add('bump');
    clearTimeout(this.bumpTimer);
    this.bumpTimer = setTimeout(() => this.scoreEl.classList.remove('bump'), 100);
  }

  setBest(value) {
    this.bestEl.textContent = `BEST ${value}`;
  }

  setCoins(value) {
    this.coinEl.textContent = value;
  }

  showTitle(show) {
    this.titleEl.classList.toggle('hidden', !show);
  }

  showGameOver(show, { score = 0, best = 0, reason = '' } = {}) {
    if (show) {
      this.finalScoreEl.textContent = score;
      this.finalBestEl.textContent = best;
      this.reasonEl.textContent = reason;
    }
    this.overEl.classList.toggle('hidden', !show);
  }

  setMuted(muted) {
    this.soundBtn.classList.toggle('muted', muted);
  }
}
