// All sound is synthesised with the Web Audio API. No audio files.

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.ambient = null;
    this.ambientKind = null;
    this.lastHit = 0;
    this.noiseBuf = null;
    this.timers = [];
  }

  /** Must be called from a user gesture. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.85;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 5;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      if (this.pendingAmbient) { this.setAmbient(this.pendingAmbient); this.pendingAmbient = null; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.03);
  }

  /** Halt the looping ambience and all scheduled sound while paused. */
  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  }

  /** Resume audio. Called from the resume button, i.e. a user gesture. */
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  get now() { return this.ctx.currentTime; }

  _osc(type, freq, t0, dur, gain, o = {}) {
    const c = this.ctx;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t0 + (o.sweep || dur));
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(o.dest || this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
    return osc;
  }

  _noise(t0, dur, gain, o = {}) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = o.type || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 1000, t0);
    if (o.to) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + dur);
    f.Q.value = o.q === undefined ? 1 : o.q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + (o.attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(o.dest || this.master);
    src.start(t0, Math.random());
    src.stop(t0 + dur + 0.05);
  }

  ok() { return !!this.ctx && this.ctx.state === 'running'; }

  // ------------------------------------------------------------ effects
  putt(power) {
    if (!this.ok()) return;
    const t = this.now, p = clamp(power, 0, 1);
    this._osc('triangle', 210 + p * 120, t, 0.12, 0.35 + p * 0.3, { to: 90 });
    this._osc('sine', 900 + p * 500, t, 0.05, 0.12 + p * 0.1, { to: 400 });
    this._noise(t, 0.05, 0.25 + p * 0.25, { freq: 2600, q: 0.8 });
  }

  hit(kind, v) {
    if (!this.ok()) return;
    const t = this.now;
    if (t - this.lastHit < 0.045) return;
    this.lastHit = t;
    const k = clamp(v / 9, 0.08, 1);
    const det = 1 + (Math.random() - 0.5) * 0.12;
    switch (kind) {
      case 'wood':
        this._osc('triangle', 330 * det, t, 0.09, 0.4 * k, { to: 150 });
        this._osc('sine', 760 * det, t, 0.05, 0.18 * k, { to: 380 });
        this._noise(t, 0.04, 0.3 * k, { freq: 1800, q: 1.2 });
        break;
      case 'stone':
        this._osc('square', 180 * det, t, 0.06, 0.14 * k, { to: 90 });
        this._noise(t, 0.07, 0.45 * k, { freq: 1200, q: 0.9 });
        break;
      case 'metal':
        this._osc('sine', 880 * det, t, 0.4, 0.2 * k, { to: 860 * det });
        this._osc('sine', 1320 * det, t, 0.3, 0.12 * k);
        this._osc('sine', 2210 * det, t, 0.18, 0.08 * k);
        this._noise(t, 0.03, 0.3 * k, { freq: 4000, q: 1 });
        break;
      case 'ice':
        this._osc('sine', 1500 * det, t, 0.14, 0.16 * k, { to: 1100 });
        this._noise(t, 0.05, 0.22 * k, { freq: 5200, q: 2 });
        break;
      case 'thump':
        this._osc('sine', 130 * det, t, 0.16, 0.5 * k, { to: 55 });
        this._noise(t, 0.08, 0.2 * k, { freq: 500, q: 0.7 });
        break;
      case 'sand':
        this._noise(t, 0.16, 0.3 * k, { freq: 900, q: 0.5 });
        break;
      case 'cup':
        this._osc('sine', 620 * det, t, 0.08, 0.2 * k, { to: 500 });
        this._noise(t, 0.04, 0.2 * k, { freq: 3000, q: 1 });
        break;
      default: // soft ground bounce
        this._osc('sine', 150 * det, t, 0.1, 0.32 * k, { to: 70 });
        this._noise(t, 0.05, 0.14 * k, { freq: 700, q: 0.7 });
    }
  }

  bumper(v = 1) {
    if (!this.ok()) return;
    const t = this.now;
    this._osc('square', 220, t, 0.16, 0.18, { to: 660, sweep: 0.08 });
    this._osc('sine', 440, t, 0.22, 0.3, { to: 1320, sweep: 0.1 });
    this._osc('sine', 1760, t + 0.05, 0.18, 0.12);
  }

  cupDrop() {
    if (!this.ok()) return;
    const t = this.now;
    // rattle
    for (let i = 0; i < 4; i++) {
      const tt = t + i * 0.055 + Math.random() * 0.01;
      this._osc('triangle', 520 - i * 50, tt, 0.06, 0.3 - i * 0.05, { to: 300 });
      this._noise(tt, 0.03, 0.2, { freq: 2500, q: 1.5 });
    }
    this._osc('sine', 140, t + 0.22, 0.25, 0.4, { to: 80 });
    // ding
    this._osc('sine', 1318.5, t + 0.3, 0.9, 0.25);
    this._osc('sine', 1975.5, t + 0.3, 0.7, 0.12);
  }

  splash() {
    if (!this.ok()) return;
    const t = this.now;
    this._noise(t, 0.5, 0.6, { type: 'lowpass', freq: 3800, to: 500, q: 0.7, attack: 0.01 });
    this._noise(t + 0.03, 0.7, 0.3, { type: 'bandpass', freq: 1200, to: 300, q: 0.6, attack: 0.03 });
    this._osc('sine', 300, t, 0.3, 0.3, { to: 70 });
    for (let i = 0; i < 5; i++) {
      const tt = t + 0.15 + Math.random() * 0.5;
      const f = 500 + Math.random() * 900;
      this._osc('sine', f, tt, 0.07, 0.07, { to: f * 1.7 });
    }
  }

  sizzle() {
    if (!this.ok()) return;
    const t = this.now;
    this._noise(t, 1.0, 0.45, { type: 'highpass', freq: 3000, to: 6000, q: 0.5, attack: 0.02 });
    this._noise(t, 0.4, 0.35, { type: 'lowpass', freq: 900, to: 200, q: 0.8 });
    this._osc('sawtooth', 110, t, 0.5, 0.18, { to: 45 });
  }

  fall() {
    if (!this.ok()) return;
    const t = this.now;
    this._osc('sine', 700, t, 0.7, 0.25, { to: 90, sweep: 0.7 });
    this._osc('triangle', 350, t, 0.7, 0.12, { to: 45, sweep: 0.7 });
  }

  thudOut() {
    if (!this.ok()) return;
    const t = this.now;
    this._osc('sine', 160, t, 0.2, 0.4, { to: 60 });
    this._osc('square', 196, t + 0.12, 0.2, 0.1, { to: 140 });
    this._osc('square', 147, t + 0.3, 0.3, 0.1, { to: 100 });
  }

  portal() {
    if (!this.ok()) return;
    const t = this.now;
    this._osc('sine', 200, t, 0.5, 0.25, { to: 1600, sweep: 0.4 });
    this._osc('triangle', 300, t + 0.02, 0.5, 0.15, { to: 2400, sweep: 0.4 });
    this._noise(t, 0.5, 0.2, { freq: 600, to: 5000, q: 3 });
    this._osc('sine', 1600, t + 0.4, 0.4, 0.14, { to: 800 });
  }

  boost() {
    if (!this.ok()) return;
    const t = this.now;
    this._osc('sawtooth', 160, t, 0.35, 0.16, { to: 1200, sweep: 0.3 });
    this._noise(t, 0.35, 0.22, { freq: 800, to: 6000, q: 2 });
  }

  roar() {
    if (!this.ok()) return;
    const t = this.now;
    const c = this.ctx;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.12);
    g.gain.setValueAtTime(0.5, t + 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(500, t);
    f.frequency.linearRampToValueAtTime(1100, t + 0.3);
    f.frequency.linearRampToValueAtTime(300, t + 1.3);
    f.connect(g); g.connect(this.master);
    for (const [fr, type] of [[72, 'sawtooth'], [109, 'sawtooth'], [54, 'square']]) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(fr * 1.25, t);
      o.frequency.linearRampToValueAtTime(fr * 1.5, t + 0.25);
      o.frequency.linearRampToValueAtTime(fr * 0.7, t + 1.3);
      const lfo = c.createOscillator();
      lfo.frequency.value = 27 + Math.random() * 8;
      const lg = c.createGain();
      lg.gain.value = fr * 0.22;
      lfo.connect(lg); lg.connect(o.frequency);
      o.connect(f);
      o.start(t); o.stop(t + 1.4); lfo.start(t); lfo.stop(t + 1.4);
    }
    this._noise(t, 1.2, 0.3, { type: 'bandpass', freq: 700, to: 250, q: 0.8, attack: 0.1 });
  }

  stomp() {
    if (!this.ok()) return;
    const t = this.now;
    this._osc('sine', 90, t, 0.35, 0.6, { to: 35 });
    this._noise(t, 0.2, 0.3, { type: 'lowpass', freq: 400, q: 0.7 });
  }

  whoosh(gain = 0.2) {
    if (!this.ok()) return;
    const t = this.now;
    this._noise(t, 0.35, gain, { freq: 500, to: 2400, q: 1.2, attack: 0.12 });
  }

  click() {
    if (!this.ok()) return;
    const t = this.now;
    this._osc('sine', 880, t, 0.07, 0.18, { to: 1320 });
  }

  tick(p = 0) {
    if (!this.ok()) return;
    this._osc('sine', 500 + p * 700, this.now, 0.03, 0.05);
  }

  _notes(notes, step, type = 'triangle', gain = 0.22, len = 0.28, t0 = this.now) {
    notes.forEach((n, i) => {
      if (n === null) return;
      const f = 440 * Math.pow(2, (n - 69) / 12);
      this._osc(type, f, t0 + i * step, len, gain);
      this._osc('sine', f * 2, t0 + i * step, len * 0.7, gain * 0.35);
    });
  }

  /** level: 0 = finished, 1 = par, 2 = birdie, 3 = eagle or better, 4 = hole in one */
  fanfare(level) {
    if (!this.ok()) return;
    const t = this.now + 0.35;
    if (level <= 0) {
      this._notes([67, 64, 60], 0.16, 'triangle', 0.16, 0.3, t);
    } else if (level === 1) {
      this._notes([60, 64, 67, 72], 0.11, 'triangle', 0.2, 0.3, t);
    } else if (level === 2) {
      this._notes([60, 64, 67, 72, 76, 79], 0.09, 'triangle', 0.22, 0.32, t);
      this._notes([48, null, 55, null, 60], 0.18, 'sine', 0.2, 0.4, t);
    } else if (level === 3) {
      this._notes([60, 64, 67, 72, 67, 72, 76, 79, 84], 0.085, 'square', 0.1, 0.3, t);
      this._notes([60, 64, 67, 72, 67, 72, 76, 79, 84], 0.085, 'triangle', 0.2, 0.3, t);
      this._notes([48, null, 55, null, 60, null, 64], 0.17, 'sine', 0.22, 0.4, t);
    } else {
      const mel = [72, 72, 72, 76, 79, null, 76, 79, 84, null, 88, 84, 91];
      this._notes(mel, 0.1, 'square', 0.1, 0.3, t);
      this._notes(mel, 0.1, 'triangle', 0.22, 0.34, t);
      this._notes([48, null, 52, null, 55, null, 60, null, 64, null, 67, null, 72], 0.1, 'sine', 0.24, 0.4, t);
      for (let i = 0; i < 6; i++) this.fireworkPop(t + 0.5 + i * 0.35 + Math.random() * 0.2);
    }
  }

  fireworkPop(t0 = this.now) {
    if (!this.ok()) return;
    this._noise(t0, 0.35, 0.3, { type: 'lowpass', freq: 2500, to: 300, q: 0.6 });
    this._osc('sine', 110, t0, 0.25, 0.3, { to: 45 });
    this._noise(t0 + 0.1, 0.6, 0.12, { type: 'highpass', freq: 5000, q: 0.7, attack: 0.05 });
  }

  // ------------------------------------------------------------ ambience
  setAmbient(kind) {
    if (!this.ctx) { this.pendingAmbient = kind; return; }
    if (kind === this.ambientKind) return;
    this.ambientKind = kind;
    const c = this.ctx;
    if (this.ambient) {
      const old = this.ambient;
      old.gain.gain.setTargetAtTime(0.0001, c.currentTime, 0.4);
      setTimeout(() => { old.nodes.forEach((n) => { try { n.stop(); } catch (e) { /* already stopped */ } }); old.gain.disconnect(); }, 1800);
      this.ambient = null;
    }
    for (const id of this.timers) clearInterval(id);
    this.timers = [];
    if (!kind) return;
    const gain = c.createGain();
    gain.gain.value = 0.0001;
    gain.connect(this.master);
    const nodes = [];
    const noise = (type, freq, q, vol, lfoRate = 0.1, lfoDepth = 0.5) => {
      const src = c.createBufferSource();
      src.buffer = this.noiseBuf; src.loop = true;
      const f = c.createBiquadFilter();
      f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = c.createGain();
      g.gain.value = vol;
      const lfo = c.createOscillator();
      lfo.frequency.value = lfoRate;
      const lg = c.createGain();
      lg.gain.value = vol * lfoDepth;
      lfo.connect(lg); lg.connect(g.gain);
      src.connect(f); f.connect(g); g.connect(gain);
      src.start(0, Math.random()); lfo.start();
      nodes.push(src, lfo);
    };
    const drone = (freq, vol, type = 'sine', lfoRate = 0.07) => {
      const o = c.createOscillator();
      o.type = type; o.frequency.value = freq;
      const g = c.createGain();
      g.gain.value = vol;
      const lfo = c.createOscillator();
      lfo.frequency.value = lfoRate;
      const lg = c.createGain();
      lg.gain.value = vol * 0.6;
      lfo.connect(lg); lg.connect(g.gain);
      o.connect(g); g.connect(gain);
      o.start(); lfo.start();
      nodes.push(o, lfo);
    };
    const every = (ms, fn) => { this.timers.push(setInterval(() => { if (this.ok() && !this.muted && !document.hidden) fn(); }, ms)); };
    const chirp = (base, n = 3, vol = 0.05) => {
      const t = this.now;
      for (let i = 0; i < n; i++) {
        const f = base * (1 + Math.random() * 0.3);
        this._osc('sine', f, t + i * 0.09, 0.07, vol, { to: f * (1.2 + Math.random() * 0.5), dest: gain });
      }
    };
    let level = 0.5;
    switch (kind) {
      case 'meadow':
        noise('lowpass', 500, 0.5, 0.05, 0.13, 0.6);
        every(2600, () => { if (Math.random() < 0.7) chirp(2200 + Math.random() * 1600, 2 + Math.floor(Math.random() * 3)); });
        break;
      case 'sea':
        noise('lowpass', 700, 0.4, 0.12, 0.11, 0.85);
        noise('bandpass', 1800, 0.6, 0.03, 0.17, 0.9);
        every(4200, () => { if (Math.random() < 0.5) { const t = this.now; this._osc('sine', 1300, t, 0.25, 0.04, { to: 900, dest: gain }); this._osc('sine', 1250, t + 0.3, 0.3, 0.04, { to: 800, dest: gain }); } });
        break;
      case 'snow':
        noise('bandpass', 420, 0.8, 0.1, 0.09, 0.7);
        noise('highpass', 3500, 0.5, 0.012, 0.21, 0.8);
        break;
      case 'jungle':
        noise('lowpass', 600, 0.5, 0.05, 0.1, 0.5);
        every(1900, () => { if (Math.random() < 0.6) chirp(1500 + Math.random() * 2500, 1 + Math.floor(Math.random() * 5), 0.04); });
        every(5200, () => { if (Math.random() < 0.5) { const t = this.now; for (let i = 0; i < 6; i++) this._osc('square', 3200, t + i * 0.06, 0.03, 0.012, { dest: gain }); } });
        break;
      case 'lava':
        noise('lowpass', 180, 0.7, 0.3, 0.2, 0.5);
        drone(48, 0.08, 'sawtooth', 0.11);
        every(1300, () => { if (Math.random() < 0.6) { const t = this.now; const f = 120 + Math.random() * 120; this._osc('sine', f, t, 0.12, 0.08, { to: f * 2.2, dest: gain }); } });
        break;
      case 'factory':
        drone(55, 0.07, 'sawtooth', 0.5);
        drone(110.5, 0.03, 'square', 0.33);
        noise('bandpass', 900, 2, 0.02, 2.0, 0.9);
        every(1000, () => { const t = this.now; this._osc('square', 90, t, 0.06, 0.035, { to: 60, dest: gain }); this._noise(t, 0.05, 0.03, { freq: 3000, q: 2, dest: gain }); });
        break;
      case 'spooky':
        drone(73.4, 0.06, 'sine', 0.05);
        drone(77.8, 0.05, 'sine', 0.07);
        noise('bandpass', 350, 1.5, 0.06, 0.08, 0.9);
        every(6000, () => { if (Math.random() < 0.6) { const t = this.now; const f = 500 + Math.random() * 300; this._osc('sine', f, t, 1.4, 0.03, { to: f * 0.7, sweep: 1.4, attack: 0.4, dest: gain }); } });
        break;
      case 'space':
        drone(65.4, 0.07, 'sine', 0.04);
        drone(98, 0.05, 'sine', 0.06);
        drone(196.5, 0.02, 'triangle', 0.09);
        every(3100, () => { if (Math.random() < 0.6) { const t = this.now; const f = [523, 659, 784, 988, 1175][Math.floor(Math.random() * 5)]; this._osc('sine', f, t, 1.2, 0.03, { attack: 0.2, dest: gain }); } });
        level = 0.6;
        break;
      default:
        noise('lowpass', 500, 0.5, 0.05, 0.13, 0.6);
    }
    gain.gain.setTargetAtTime(level, c.currentTime, 0.8);
    this.ambient = { gain, nodes };
  }
}
