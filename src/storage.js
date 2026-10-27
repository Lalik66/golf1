// Best scores and settings live in localStorage only.
const KEY = 'puttopia.save.v1';

const DEFAULTS = {
  bestTotal: null, // best 9-hole total
  bestRound: null, // per-hole strokes of the best round
  bestHoles: [], // best strokes per hole, across all play
  rounds: 0,
  muted: false,
  quality: 'auto',
  seenHelp: false,
};

export class Storage {
  constructor() {
    this.data = { ...DEFAULTS };
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) Object.assign(this.data, JSON.parse(raw));
    } catch (e) {
      // storage unavailable (private mode): keep defaults in memory
    }
    if (!Array.isArray(this.data.bestHoles)) this.data.bestHoles = [];
    // Coerce corrupted/hand-edited values so numeric comparisons stay sound.
    const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    this.data.bestTotal = num(this.data.bestTotal);
    if (!Array.isArray(this.data.bestRound)) this.data.bestRound = null;
    this.data.bestHoles = this.data.bestHoles.map((v) => {
      const n = num(v);
      return n === null ? undefined : n;
    });
  }

  save() {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch (e) {
      // ignore
    }
  }

  set(k, v) { this.data[k] = v; this.save(); }

  get(k) { return this.data[k]; }

  /** Returns true when this is a new personal best for the hole. */
  recordHole(index, strokes) {
    const prev = this.data.bestHoles[index];
    if (prev === undefined || prev === null || strokes < prev) {
      this.data.bestHoles[index] = strokes;
      this.save();
      return prev !== undefined && prev !== null;
    }
    return false;
  }

  /** Returns true when the total is a new best round. */
  recordRound(scores) {
    const total = scores.reduce((a, b) => a + b, 0);
    this.data.rounds = (this.data.rounds || 0) + 1;
    let best = false;
    if (this.data.bestTotal === null || total < this.data.bestTotal) {
      this.data.bestTotal = total;
      this.data.bestRound = scores.slice();
      best = true;
    }
    this.save();
    return best;
  }

  clearScores() {
    this.data.bestTotal = null;
    this.data.bestRound = null;
    this.data.bestHoles = [];
    this.data.rounds = 0;
    this.save();
  }
}
