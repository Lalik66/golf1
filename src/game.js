// Game: renderer, camera, input, state machine and scoring.
import * as THREE from 'three';
import { PostFX } from './postfx.js';
import { U, toonMat, PATTERN, LAYER_FX } from './materials.js';
import { makeSkyMaterial, makeAimMaterial } from './shaders.js';
import { Ball, BALL_R, FIXED_DT } from './physics.js';
import { Effects } from './particles.js';
import { AudioEngine } from './audio.js';
import { Storage } from './storage.js';
import { UI, scoreLabel } from './ui.js';
import { HOLES } from './holes/index.js';
import { STROKE_CAP, powerToSpeed } from './rules.js';
import { part, merge, sph, cyl, box } from './geo.js';
import { clamp, lerp, damp, easeInOut, easeOut, angleLerp, TAU, smoothstep } from './utils.js';

const EYE_HEIGHT = 1.45;
const EYE_BACK = 2.35;


const HAZARD_TEXT = {
  water: ['Splash!', 'water'],
  lava: ['Sizzle!', 'lava'],
  ob: ['Out of bounds!', 'ob'],
  void: ['Lost in space!', 'void'],
  goo: ['Gloop!', 'goo'],
};

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _m1 = new THREE.Matrix4();
const _e1 = new THREE.Euler();
const UP = new THREE.Vector3(0, 1, 0);

export class Game {
  constructor(canvas, uiRoot) {
    this.canvas = canvas;
    this.storage = new Storage();
    this.audio = new AudioEngine();
    this.audio.muted = !!this.storage.get('muted');
    this.quality = this.storage.get('quality') || 'auto';
    this.autoLevel = 0;

    this.ui = new UI(uiRoot, {
      click: () => { this.audio.unlock(); this.audio.click(); },
      play: () => this.startRound(),
      practice: (i) => this.jumpTo(i),
      toggleMute: () => this.toggleMute(),
      cycleQuality: () => this.cycleQuality(),
      restart: () => this.restartHole(),
      pause: () => this.pause(),
      resume: () => this.resume(),
      quit: () => this.toMenu(),
      save: () => this.storage.data,
    });
    this.ui.setHoles(HOLES);
    this.ui.setMuted(this.audio.muted);
    this.ui.setQuality(this.quality);

    this.state = 'menu';
    this.paused = false;
    this.mode = 'round';
    this.holeIndex = 0;
    this.scores = [];
    this.strokes = 0;
    this.time = 0;
    this.acc = 0;
    this.stateT = 0;
    this.aimYaw = 0;
    this.aimPitch = -0.3;
    this.power = 0;
    this.dragging = false;
    this.lastTick = 0;
    this.pointerLocked = false;
    this.lastX = 0; this.lastY = 0;
    this.ball = new Ball();
    this.safe = [0, 0, 0];
    this.followDir = new THREE.Vector3(0, 0, -1);
    this.camFrom = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
    this.camBlend = 1;
    this.camLook = new THREE.Vector3();
    this.ballPos = new THREE.Vector3();
    this.ballPrev = new THREE.Vector3();
    this.trailAcc = 0;
    this.frameTimes = [];
    this.hintShown = 0;
    this.shotsThisSession = 0;

    this.initRenderer();
    this.initScene();
    this.initInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  // ------------------------------------------------------------------ setup
  initRenderer() {
    const r = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.shadowMap.autoUpdate = false;
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1.0;
    r.setClearColor(0x87c8ff, 1);
    r.info.autoReset = false;
    this.renderer = r;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 700);
    this.camera.layers.enable(LAYER_FX);
    this.camera.position.set(0, 6, 10);
    this.post = new PostFX(r, this.scene, this.camera);
  }

  initScene() {
    const s = this.scene;
    this.hemi = new THREE.HemisphereLight(0xcfe8ff, 0x6f9a5a, 1.2);
    s.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff4dd, 2.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.035;
    s.add(this.sun, this.sun.target);

    this.sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 20), makeSkyMaterial({ skyTop: 0x2f8cff, skyHorizon: 0xbfe6ff, skyBottom: 0x8ed0a0 }));
    this.sky.layers.set(LAYER_FX);
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    s.add(this.sky);

    // ball
    const bm = toonMat({ pattern: PATTERN.ball, glowColor: 0xff5a36, rim: 0.2, key: 'ball' });
    this.ballMesh = new THREE.Mesh(part(sph(BALL_R, 24, 18), 0xffffff, {}), bm);
    this.ballMesh.castShadow = true;
    this.ballMesh.receiveShadow = true;
    s.add(this.ballMesh);

    // putter
    this.putter = new THREE.Group();
    const shaftParts = merge([
      part(cyl(0.013, 0.016, 1.2, 8), 0xc9d2e3, { p: [0, 0.6, 0] }),
      part(cyl(0.025, 0.022, 0.38, 8), 0x23232e, { p: [0, 1.05, 0] }),
    ]);
    // lean the shaft back and to the right so it never hides the ball
    shaftParts.applyMatrix4(new THREE.Matrix4().makeRotationZ(-0.42));
    shaftParts.applyMatrix4(new THREE.Matrix4().makeRotationX(0.3));
    shaftParts.translate(0.1, 0.06, 0);
    const pm = new THREE.Mesh(merge([
      part(box(0.3, 0.085, 0.075), 0xdfe3ee, { p: [0, 0.045, 0] }),
      part(box(0.3, 0.02, 0.078), 0xff5a36, { p: [0, 0.095, 0] }),
      shaftParts,
    ]), toonMat({ rim: 0.25 }));
    pm.castShadow = true;
    this.putter.add(pm);
    this.putter.visible = false;
    s.add(this.putter);

    // aim guide
    const dotGeo = new THREE.PlaneGeometry(1, 1);
    dotGeo.rotateX(-Math.PI / 2);
    this.aimCount = 16;
    const idx = new Float32Array(this.aimCount);
    for (let i = 0; i < this.aimCount; i++) idx[i] = i / (this.aimCount - 1);
    dotGeo.setAttribute('aIndex', new THREE.InstancedBufferAttribute(idx, 1));
    this.aimMat = makeAimMaterial();
    this.aim = new THREE.InstancedMesh(dotGeo, this.aimMat, this.aimCount);
    this.aim.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.aim.frustumCulled = false;
    this.aim.layers.set(LAYER_FX);
    this.aim.renderOrder = 4;
    this.aim.visible = false;
    s.add(this.aim);

    this.effects = new Effects(s);
  }

  start() {
    this.loadHole(0);
    this.toMenu(true);
    this.last = performance.now();
    const loop = (now) => {
      requestAnimationFrame(loop);
      const dt = Math.min(0.05, Math.max(0.0001, (now - this.last) / 1000));
      this.last = now;
      this.frame(dt);
    };
    requestAnimationFrame(loop);
  }

  pixelRatio() {
    const dpr = window.devicePixelRatio || 1;
    let q = this.quality;
    if (q === 'auto') q = ['high', 'medium', 'low'][this.autoLevel];
    if (q === 'high') return Math.min(dpr, 1.5);
    if (q === 'medium') return Math.min(dpr, 1.0);
    return Math.min(dpr, 0.8);
  }

  effectiveQuality() {
    return this.quality === 'auto' ? ['high', 'medium', 'low'][this.autoLevel] : this.quality;
  }

  resize() {
    const w = Math.max(2, this.canvas.clientWidth || window.innerWidth), h = Math.max(2, this.canvas.clientHeight || window.innerHeight);
    const pr = this.pixelRatio();
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // keep the horizontal view wide enough on tall screens
    this.camera.fov = w / h < 1 ? 74 : 58;
    this.camera.updateProjectionMatrix();
    this.post.setSize(w, h, pr);
    const q = this.effectiveQuality();
    this.post.setQuality({ bloom: q !== 'low', outline: true });
    const size = q === 'low' ? 1024 : 2048;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    }
    this.effects.setViewport(h * pr, this.camera.fov);
  }

  cycleQuality() {
    const order = ['auto', 'high', 'medium', 'low'];
    this.quality = order[(order.indexOf(this.quality) + 1) % order.length];
    this.autoLevel = 0;
    this.frameTimes.length = 0;
    this.storage.set('quality', this.quality);
    this.ui.setQuality(this.quality);
    this.resize();
  }

  toggleMute() {
    this.audio.unlock();
    const m = !this.audio.muted;
    this.audio.setMuted(m);
    this.storage.set('muted', m);
    this.ui.setMuted(m);
  }

  // ------------------------------------------------------------------ input
  initInput() {
    const c = this.canvas;
    const playing = () => !this.paused && (this.state === 'aim' || this.state === 'roll' || this.state === 'swing' || this.state === 'hazard' || this.state === 'flyover' || this.state === 'holed');

    window.addEventListener('pointerdown', (e) => {
      if (e.target !== c) return;
      this.audio.unlock();
      this.lastX = e.clientX; this.lastY = e.clientY;
      this.hasPointer = true;
      this.touch = e.pointerType === 'touch';
      if (this.paused) return;
      if (this.state === 'flyover') { this.skipFlyover(); return; }
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (playing() && e.pointerType === 'mouse' && !this.pointerLocked && c.requestPointerLock) {
        try {
          const p = c.requestPointerLock();
          if (p && p.catch) p.catch(() => {});
        } catch (err) { /* pointer lock is optional */ }
      }
      if (this.state === 'aim' && this.camBlend > 0.6) {
        this.dragging = true;
        this.power = 0;
        this.dragPx = 0;
        this.activePointer = e.pointerId;
      }
    });

    window.addEventListener('pointermove', (e) => {
      let dx, dy;
      if (this.pointerLocked) { dx = e.movementX || 0; dy = e.movementY || 0; } else if (!this.hasPointer) {
        this.hasPointer = true;
        this.lastX = e.clientX; this.lastY = e.clientY;
        return;
      } else {
        dx = e.clientX - this.lastX; dy = e.clientY - this.lastY;
        this.lastX = e.clientX; this.lastY = e.clientY;
        if (e.pointerType === 'mouse' && e.target !== c && !this.dragging) return;
      }
      if (Math.abs(dx) > 250 || Math.abs(dy) > 250) return; // ignore warp glitches
      if (this.paused || this.state !== 'aim') return;
      if (this.dragging) {
        this.dragPx = clamp(this.dragPx + dy, 0, this.dragRange());
        const p = this.dragPx / this.dragRange();
        if (Math.floor(p * 12) !== Math.floor(this.power * 12)) this.audio.tick(p);
        this.power = p;
        this.aimYaw += dx * (e.pointerType === 'touch' ? 0.0042 : 0.0011);
      } else if (e.pointerType !== 'touch') {
        this.aimYaw += dx * 0.0028;
        this.aimPitch = clamp(this.aimPitch - dy * 0.0018, -0.62, 0.3);
      }
    });

    const release = (e) => {
      if (!this.dragging) return;
      this.dragging = false;
      if (this.paused || this.state !== 'aim') { this.power = 0; return; }
      if (this.power >= 0.03) this.beginSwing(this.power);
      this.power = 0;
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', () => { this.dragging = false; this.power = 0; });

    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === c;
      if (this.pointerLocked && !locked && playing() && !this.suppressPause) this.pause();
      this.pointerLocked = locked;
      this.suppressPause = false;
    });

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.audio.unlock();
      const k = e.key.toLowerCase();
      if (k === 'm') { this.toggleMute(); return; }
      if (k === 'escape' || k === 'p') {
        if (this.paused) this.resume(); else if (playing()) this.pause();
        return;
      }
      if (this.paused) return;
      if (k === ' ' || k === 'enter') {
        if (this.state === 'flyover') { this.skipFlyover(); e.preventDefault(); } else if (this.state === 'card' && this.cardPrimary) { this.audio.click(); this.cardPrimary(); e.preventDefault(); }
        return;
      }
      if (k === 'r' && playing()) { this.restartHole(); return; }
      // keyboard aiming as an alternative to the mouse
      if (this.state === 'aim') {
        if (k === 'arrowleft' || k === 'a') this.keyTurn = -1;
        if (k === 'arrowright' || k === 'd') this.keyTurn = 1;
      }
    });
    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a' || k === 'arrowright' || k === 'd') this.keyTurn = 0;
    });
    window.addEventListener('blur', () => { this.dragging = false; this.power = 0; this.keyTurn = 0; this.hasPointer = false; });
    document.addEventListener('pointerleave', () => { this.hasPointer = false; });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && playing()) this.pause();
    });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  dragRange() { return Math.max(180, Math.min(320, window.innerHeight * 0.34)); }

  releasePointer() {
    if (document.pointerLockElement === this.canvas) {
      this.suppressPause = true;
      document.exitPointerLock();
    }
  }

  pause() {
    if (this.paused || this.state === 'menu' || this.state === 'card') return;
    this.paused = true;
    this.dragging = false;
    this.power = 0;
    this.releasePointer();
    this.ui.showPause();
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.ui.hidePause();
    this.ui.hide(this.ui.select);
  }

  // ------------------------------------------------------------------ flow
  toMenu(first = false) {
    this.paused = false;
    this.state = 'menu';
    this.releasePointer();
    this.ui.showMenu(this.storage.data);
    this.putter.visible = false;
    this.aim.visible = false;
    if (!first && this.holeIndex !== 0) this.loadHole(0);
    this.resetBall();
    this.menuAngle = 0.6;
  }

  startRound() {
    this.audio.unlock();
    this.mode = 'round';
    this.scores = [];
    this.beginHole(0);
  }

  /** Jump straight to any hole (free play from there on). */
  jumpTo(index) {
    this.audio.unlock();
    if (this.state === 'menu' || this.mode !== 'round') this.scores = [];
    this.mode = 'free';
    this.paused = false;
    this.beginHole(index);
  }

  beginHole(index) {
    this.paused = false;
    this.ui.hideAll();
    if (index !== this.holeIndex || !this.hole) this.loadHole(index);
    this.resetBall();
    this.strokes = 0;
    this.scores[index] = undefined;
    const info = this.hole.info;
    this.ui.showHud(info, index, HOLES.length, this.mode === 'free');
    this.updateHudScore();
    this.ui.setHint('');
    this.ui.showIntro(info, index, this.mode === 'free');
    this.state = 'flyover';
    this.stateT = 0;
    this.buildFlyover();
    this.autoAim();
    this.putter.visible = false;
    this.aim.visible = false;
    this.audio.whoosh(0.12);
  }

  restartHole() {
    if (this.state === 'menu' || this.state === 'card') return;
    this.paused = false;
    this.ui.hidePause();
    this.ui.hideBanner();
    this.resetBall();
    this.strokes = 0;
    this.updateHudScore();
    this.effects.fx.clear();
    this.effects.glow.clear();
    this.ui.toast('Hole restarted', '', 1200);
    this.autoAim();
    this.enterAim(true);
  }

  resetBall() {
    const tee = this.hole.info.tee;
    this.ball.place(tee[0], tee[1] + BALL_R + 0.001, tee[2]);
    this.safe = [tee[0], tee[1] + BALL_R + 0.001, tee[2]];
    this.world.events.length = 0;
    this.ballPos.set(this.ball.px, this.ball.py, this.ball.pz);
    this.ballPrev.copy(this.ballPos);
    this.ballMesh.visible = true;
    this.ballMesh.scale.setScalar(1);
    this.dragging = false;
    this.power = 0;
  }

  totalDiff() {
    let d = 0, any = false;
    for (let i = 0; i < HOLES.length; i++) {
      if (this.scores[i] !== undefined && this.scores[i] !== null) { d += this.scores[i] - HOLES[i].par; any = true; }
    }
    return any ? d : 0;
  }

  updateHudScore() { this.ui.setStrokes(this.strokes, this.totalDiff()); }

  loadHole(index) {
    if (this.hole) {
      this.scene.remove(this.hole.root);
      this.hole.dispose();
    }
    this.effects.clear();
    const hole = HOLES[index].build({ visual: true });
    this.hole = hole;
    this.holeIndex = index;
    this.world = hole.world;
    this.scene.add(hole.root);
    this.applyTheme(hole.info.theme);
    this.effects.setAmbient(hole.emitters);
    U.cup.value.set(hole.info.cup[0], hole.info.cup[1], hole.info.cup[2], U.cup.value.w);
    this.pathPts = hole.info.path.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    this.fitShadow();
    this.acc = 0;
  }

  applyTheme(t) {
    this.sky.material.dispose();
    this.sky.material = makeSkyMaterial(t);
    U.sunDir.value.set(t.sunDir[0], t.sunDir[1], t.sunDir[2]).normalize();
    this.sun.color.set(t.sunColor);
    this.sun.intensity = t.sunIntensity;
    this.hemi.color.set(t.hemiSky);
    this.hemi.groundColor.set(t.hemiGround);
    this.hemi.intensity = t.hemiIntensity;
    this.scene.fog = new THREE.FogExp2(t.fog, t.fogDensity);
    U.fogColor.value.set(t.fog);
    U.fogDensity.value = t.fogDensity;
    U.wind.value = t.wind;
    this.post.setOutlineColor(t.outline);
    this.post.setBloom(t.bloom, t.bloomThreshold);
    this.renderer.setClearColor(t.fog, 1);
    this.audio.setAmbient(t.ambient);
  }

  fitShadow() {
    const b = this.world.bounds;
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, cy = (b.y0 + b.y1) / 2;
    const ext = Math.hypot(b.x1 - b.x0, b.z1 - b.z0, b.y1 - b.y0) / 2 + 9;
    this.center = new THREE.Vector3(cx, cy, cz);
    this.extent = ext;
    const d = U.sunDir.value;
    this.sun.position.set(cx + d.x * 80, cy + d.y * 80, cz + d.z * 80);
    this.sun.target.position.set(cx, cy, cz);
    this.sun.target.updateMatrixWorld();
    const cam = this.sun.shadow.camera;
    cam.left = -ext; cam.right = ext; cam.top = ext; cam.bottom = -ext;
    cam.near = 1; cam.far = 80 + ext * 2.2;
    cam.updateProjectionMatrix();
  }

  // ------------------------------------------------------------------ flyover
  buildFlyover() {
    const info = this.hole.info;
    const pts = this.pathPts.map((p) => p.clone());
    if (pts.length < 2) pts.push(new THREE.Vector3(info.cup[0], info.cup[1], info.cup[2]));
    const fo = info.flyover || {};
    if (fo.keys) {
      this.fly = {
        keys: true,
        pos: new THREE.CatmullRomCurve3(fo.keys.map((k) => new THREE.Vector3(...k.pos)), false, 'centripetal'),
        look: new THREE.CatmullRomCurve3(fo.keys.map((k) => new THREE.Vector3(...k.look)), false, 'centripetal'),
        dur: fo.duration || 7,
      };
      return;
    }
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const len = curve.getLength();
    this.fly = {
      keys: false, curve, len,
      dur: fo.duration || clamp(3.2 + len * 0.16, 5, 9),
      height: fo.height === undefined ? 5.2 : fo.height,
      back: fo.back === undefined ? 6.5 : fo.back,
      side: fo.side || 0,
      ahead: fo.ahead === undefined ? 5 : fo.ahead,
    };
  }

  flyPose(k, pos, look) {
    const f = this.fly;
    const e = easeInOut(clamp(k, 0, 1));
    if (f.keys) {
      f.pos.getPoint(e, pos);
      f.look.getPoint(e, look);
      return;
    }
    const u = 1 - e;
    const p = f.curve.getPointAt(u, _v1);
    const t = f.curve.getTangentAt(u, _v2);
    t.y = 0;
    if (t.lengthSq() < 1e-6) t.set(0, 0, -1);
    t.normalize();
    const right = _v3.set(-t.z, 0, t.x);
    const arc = Math.sin(Math.PI * clamp(k, 0, 1));
    pos.copy(p).addScaledVector(t, -f.back).addScaledVector(right, f.side * (0.4 + 0.6 * arc));
    pos.y = p.y + f.height + arc * 2.2;
    const la = Math.min(1, u + f.ahead / Math.max(1, f.len));
    f.curve.getPointAt(la, look);
    look.y += 0.4;
  }

  skipFlyover() {
    if (this.state !== 'flyover') return;
    this.stateT = Math.max(this.stateT, this.fly.dur * 0.86);
  }

  // ------------------------------------------------------------------ aiming
  clearLine(ax, ay, az, bx, by, bz) {
    const d = Math.hypot(bx - ax, bz - az);
    const n = Math.ceil(d / 0.35);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (this.world.overlaps(lerp(ax, bx, t), lerp(ay, by, t) + 0.16, lerp(az, bz, t), 0.07)) return false;
    }
    return true;
  }

  autoAim() {
    const b = this.ball, info = this.hole.info;
    const cup = info.cup;
    let tx = cup[0], tz = cup[2];
    const dist = Math.hypot(cup[0] - b.px, cup[2] - b.pz);
    const direct = dist < 18 && Math.abs(cup[1] + BALL_R - b.py) < 0.6 && this.clearLine(b.px, b.py, b.pz, cup[0], cup[1] + BALL_R, cup[2]);
    if (!direct && this.pathPts.length > 1) {
      let best = 0, bd = 1e9;
      for (let i = 0; i < this.pathPts.length - 1; i++) {
        const a = this.pathPts[i], c = this.pathPts[i + 1];
        const dx = c.x - a.x, dz = c.z - a.z, dy = c.y - a.y;
        const l2 = dx * dx + dz * dz + dy * dy;
        let t = l2 > 0 ? ((b.px - a.x) * dx + (b.py - a.y) * dy + (b.pz - a.z) * dz) / l2 : 0;
        t = clamp(t, 0, 1);
        const d = Math.hypot(b.px - (a.x + dx * t), (b.py - (a.y + dy * t)) * 2, b.pz - (a.z + dz * t));
        if (d < bd) { bd = d; best = i; }
      }
      let j = best + 1;
      while (j < this.pathPts.length - 1 && Math.hypot(this.pathPts[j].x - b.px, this.pathPts[j].z - b.pz) < 1.6) j++;
      tx = this.pathPts[j].x; tz = this.pathPts[j].z;
    }
    if (this.strokes === 0 && info.startYaw !== null && info.startYaw !== undefined && Math.hypot(b.px - info.tee[0], b.pz - info.tee[2]) < 0.2) {
      this.aimYaw = info.startYaw;
    } else if (Math.hypot(tx - b.px, tz - b.pz) > 0.05) {
      this.aimYaw = Math.atan2(tx - b.px, -(tz - b.pz));
    }
    this.aimPitch = -0.3;
  }

  enterAim(snap = false) {
    this.state = 'aim';
    this.stateT = 0;
    this.dragging = false;
    this.power = 0;
    this.camFrom.pos.copy(this.camera.position);
    this.camFrom.quat.copy(this.camera.quaternion);
    this.camBlend = snap ? 0.35 : 0;
    this.putter.visible = true;
    this.aim.visible = true;
    if (this.hintShown < 3 && this.shotsThisSession < 3) {
      this.ui.setHint(this.touch ? '<b>Drag sideways</b> to aim · <b>drag down</b> for power · <b>release</b> to putt' : '<b>Move</b> to aim · <b>hold and drag back</b> for power · <b>release</b> to putt');
      this.hintShown++;
    } else {
      this.ui.setHint('');
    }
  }

  camObstructed(from, to, out) {
    // walk from the ball towards the wanted camera position and stop before geometry
    const steps = 10;
    out.copy(to);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = lerp(from.x, to.x, t), y = lerp(from.y, to.y, t), z = lerp(from.z, to.z, t);
      if (this.world.overlaps(x, y, z, 0.24)) {
        const tb = Math.max(0.12, (i - 1) / steps);
        out.set(lerp(from.x, to.x, tb), lerp(from.y, to.y, tb), lerp(from.z, to.z, tb));
        return true;
      }
    }
    return false;
  }

  aimPose(pos, quat) {
    const bp = this.ballPos;
    const dx = Math.sin(this.aimYaw), dz = -Math.cos(this.aimYaw);
    const head = _v1.set(bp.x, bp.y + 0.35, bp.z);
    const want = _v2.set(bp.x - dx * EYE_BACK, bp.y - BALL_R + EYE_HEIGHT, bp.z - dz * EYE_BACK);
    this.camObstructed(head, want, pos);
    _e1.set(this.aimPitch, -this.aimYaw, 0, 'YXZ');
    quat.setFromEuler(_e1);
  }

  beginSwing(power) {
    this.state = 'swing';
    this.stateT = 0;
    this.shotPower = power;
    this.ui.setHint('');
    this.ui.setPower(0, false);
    this.audio.whoosh(0.08 + power * 0.14);
  }

  fire() {
    const p = this.shotPower;
    const dx = Math.sin(this.aimYaw), dz = -Math.cos(this.aimYaw);
    if (!this.ball.rider) this.safe = [this.ball.px, this.ball.py, this.ball.pz];
    this.world.shoot(this.ball, dx, dz, powerToSpeed(p));
    this.strokes++;
    this.shotsThisSession++;
    this.updateHudScore();
    this.audio.putt(p);
    this.effects.poof(this.ball.px, this.ball.py - 0.05, this.ball.pz, 0xffffff, 6 + Math.floor(p * 10), 0.8 + p);
    this.followDir.set(dx, 0, dz);
    this.camZone = null;
    this.state = 'roll';
    this.stateT = 0;
    this.aim.visible = false;
  }

  // ------------------------------------------------------------------ events
  handleEvents() {
    const ev = this.world.events;
    for (let i = 0; i < ev.length; i++) {
      const e = ev[i];
      switch (e.type) {
        case 'hit':
          this.audio.hit(e.snd, e.v);
          if (e.v > 2.2 && !e.ground) this.effects.sparks(e.x, e.y, e.z, 0xfff1c0, Math.min(10, 3 + Math.floor(e.v)), 1.5 + e.v * 0.2);
          else if (e.v > 3 && e.ground) this.effects.poof(e.x, e.y + 0.03, e.z, 0xffffff, 6, 1);
          if (e.snd === 'thump' && e.v > 2) this.audio.roar();
          break;
        case 'bumper': {
          this.audio.bumper(e.v);
          this.effects.sparks(e.x, e.y, e.z, 0xffe066, 14, 3.5);
          const g = this.hole.bumpers.get(e.id);
          if (g) g.userData.pulse = 1;
          break;
        }
        case 'hazard': this.onHazard(e); break;
        case 'holed': this.onHoled(); break;
        case 'portal':
          this.audio.portal();
          this.effects.swirl(e.from[0], e.from[1], e.from[2]);
          this.effects.swirl(e.to[0], e.to[1], e.to[2]);
          break;
        case 'boost':
          this.audio.boost();
          this.effects.sparks(e.x, e.y, e.z, 0x38f0ff, 12, 3);
          break;
        case 'wake':
          if (this.state === 'aim') {
            this.state = 'roll';
            this.stateT = 0;
            this.dragging = false;
            this.power = 0;
            this.aim.visible = false;
            this.putter.visible = false;
            this.ui.setPower(0, false);
          }
          break;
        default:
      }
    }
    ev.length = 0;
  }

  onHazard(e) {
    if (this.state === 'holed' || this.state === 'card' || this.state === 'menu' || this.state === 'flyover') {
      this.resetBallSoft();
      return;
    }
    const [text, kind] = HAZARD_TEXT[e.kind] || HAZARD_TEXT.ob;
    if (e.kind === 'water') { this.audio.splash(); this.effects.splash(e.x, e.y + 0.08, e.z); } else if (e.kind === 'goo') { this.audio.splash(); this.effects.splash(e.x, e.y + 0.08, e.z, 0xb6ff5c, 0x4fd63a); } else if (e.kind === 'lava') { this.audio.sizzle(); this.effects.lavaBurst(e.x, e.y + 0.08, e.z); } else if (e.kind === 'void') { this.audio.fall(); } else { this.audio.thudOut(); this.effects.poof(e.x, e.y, e.z, 0xd9c58a, 14, 1.6); }
    this.strokes = Math.min(STROKE_CAP, this.strokes + 1);
    this.updateHudScore();
    this.ui.toast(`${text} <b>+1</b> penalty stroke`, kind, 1900);
    this.state = 'hazard';
    this.stateT = 0;
    this.ballMesh.visible = e.kind === 'ob';
    this.putter.visible = false;
    this.aim.visible = false;
  }

  resetBallSoft() {
    this.ball.place(this.safe[0], this.safe[1], this.safe[2]);
    this.ballMesh.visible = true;
  }

  onHoled() {
    if (this.state === 'holed') return;
    this.state = 'holed';
    this.stateT = 0;
    this.putter.visible = false;
    this.aim.visible = false;
    this.releasePointer();
    const par = this.hole.info.par;
    const s = Math.max(1, this.strokes);
    const d = s - par;
    const cup = this.hole.info.cup;
    this.audio.cupDrop();
    let level = 0, kind = 'meh';
    if (s === 1) { level = 4; kind = 'ace'; } else if (d <= -2) { level = 3; kind = 'good'; } else if (d === -1) { level = 2; kind = 'good'; } else if (d === 0) { level = 1; kind = ''; } else { kind = d >= 2 ? 'bad' : 'meh'; }
    this.audio.fanfare(level);
    this.celebration = { level, kind };
    const sub = s === 1 ? 'One shot. Perfect!' : `${s} strokes on a par ${par}`;
    this.ui.showBanner(scoreLabel(s, par), sub, kind);
    if (level >= 1) this.effects.confetti(cup[0], cup[1] + 0.1, cup[2], level >= 2 ? 170 : 70, level >= 2 ? 1.15 : 0.8);
    else this.effects.sparks(cup[0], cup[1] + 0.1, cup[2], 0xffffff, 12, 2);
    if (level >= 3) {
      for (let i = 0; i < (level === 4 ? 9 : 4); i++) {
        this.effects.firework(cup[0] + (Math.random() - 0.5) * 12, cup[1] + 5 + Math.random() * 4, cup[2] + (Math.random() - 0.5) * 12, 0.4 + i * 0.33);
      }
    }
    if (level >= 2) this.effects.confetti(cup[0], cup[1] + 0.1, cup[2], 60, 1.5);
  }

  finishHole(score, capped = false) {
    const idx = this.holeIndex;
    this.scores[idx] = score;
    const newBestHole = !capped && this.storage.recordHole(idx, score);
    this.state = 'card';
    this.stateT = 0;
    this.releasePointer();
    this.ui.hide(this.ui.hud);
    this.ui.setPower(0, false);
    const par = this.hole.info.par;
    const last = idx === HOLES.length - 1;
    const allPlayed = HOLES.every((h, i) => this.scores[i] !== undefined && this.scores[i] !== null);
    const final = last && allPlayed;
    const buttons = [];
    let title = capped ? 'STROKE LIMIT' : scoreLabel(score, par);
    let kind = capped ? 'bad' : (this.celebration ? this.celebration.kind : '');
    let sub = capped ? `Hole ${idx + 1} is capped at ${STROKE_CAP} strokes. On to the next one!` : `Hole ${idx + 1} · ${this.hole.info.name}`;
    let best = this.storage.get('bestTotal');
    let newBest = false;
    if (final) {
      const total = this.scores.reduce((a, b) => a + b, 0);
      const parTotal = HOLES.reduce((a, h) => a + h.par, 0);
      if (this.mode === 'round') {
        newBest = this.storage.recordRound(this.scores.slice());
        best = this.storage.get('bestTotal');
      }
      title = total < parTotal ? 'UNDER PAR!' : total === parTotal ? 'LEVEL PAR' : 'ROUND COMPLETE';
      kind = total <= parTotal ? 'good' : '';
      sub = `Final scorecard · ${total} strokes on a par ${parTotal}${this.mode === 'free' ? ' · free play' : ''}`;
      buttons.push({ label: 'Play again', primary: true, fn: () => this.startRound() });
      buttons.push({ label: 'Main menu', fn: () => this.toMenu() });
      this.audio.fanfare(total <= parTotal ? 3 : 1);
      const c = this.hole.info.cup;
      for (let i = 0; i < 6; i++) this.effects.firework(c[0] + (Math.random() - 0.5) * 14, c[1] + 6 + Math.random() * 4, c[2] + (Math.random() - 0.5) * 14, 0.3 + i * 0.4);
      this.cardPrimary = () => this.startRound();
    } else {
      if (!last) {
        buttons.push({ label: 'Next hole', primary: true, fn: () => this.beginHole(idx + 1) });
        this.cardPrimary = () => this.beginHole(idx + 1);
      } else {
        buttons.push({ label: 'Play 9 holes', primary: true, fn: () => this.startRound() });
        this.cardPrimary = () => this.startRound();
      }
      buttons.push({ label: 'Replay hole', fn: () => this.beginHole(idx) });
      buttons.push({ label: 'Main menu', fn: () => this.toMenu() });
    }
    this.ui.showCard({
      scores: this.scores, current: idx, title, sub, kind, final,
      practice: this.mode === 'free' && !final,
      best, newBest: final ? newBest : newBestHole,
      bestHole: this.storage.get('bestHoles')[idx],
      buttons,
    });
  }

  // ------------------------------------------------------------------ frame
  frame(dt) {
    // adaptive quality
    if (this.quality === 'auto' && this.autoLevel < 2 && !document.hidden) {
      this.frameTimes.push(dt);
      if (this.frameTimes.length >= 120) {
        const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
        this.frameTimes.length = 0;
        if (avg > 1 / 47) { this.autoLevel++; this.resize(); }
      }
    }
    if (!this.paused) this.update(dt);
    this.render(dt);
  }

  update(dt) {
    this.time += dt;
    this.stateT += dt;
    U.time.value = this.time;

    // physics (fixed steps)
    this.acc += dt;
    let steps = 0;
    while (this.acc >= FIXED_DT && steps < 10) {
      this.world.step(this.ball, FIXED_DT);
      this.acc -= FIXED_DT;
      steps++;
      if (this.world.events.length) this.handleEvents();
    }
    if (steps === 10) this.acc = 0;
    const alpha = this.acc / FIXED_DT;
    const b = this.ball;
    this.ballPrev.copy(this.ballPos);
    if (b.teleported) {
      this.ballPos.set(b.px, b.py, b.pz);
      this.ballPrev.copy(this.ballPos);
      if (this.state === 'roll') this.snapFollow = true;
      b.teleported = false;
    } else {
      this.ballPos.set(lerp(b.ox, b.px, alpha), lerp(b.oy, b.py, alpha), lerp(b.oz, b.pz, alpha));
    }
    this.ballMesh.position.copy(this.ballPos);
    // rolling rotation
    _v1.subVectors(this.ballPos, this.ballPrev);
    const moved = _v1.length();
    if (moved > 1e-5 && moved < 2) {
      _v2.crossVectors(UP, _v1).normalize();
      if (_v2.lengthSq() > 0.5) {
        _q1.setFromAxisAngle(_v2, moved / BALL_R);
        this.ballMesh.quaternion.premultiply(_q1);
      }
    }

    if (this.hole.info.watch) this.hole.info.watch(this.ballPos);
    this.hole.update(this.world.time + this.acc, dt);
    if (this.hole.sounds.length) {
      const near = this.state !== 'menu' && this.state !== 'card';
      for (const s of this.hole.sounds) if (near && this.audio[s]) this.audio[s]();
      this.hole.sounds.length = 0;
    }

    switch (this.state) {
      case 'menu': this.updateMenu(dt); break;
      case 'flyover': this.updateFlyover(dt); break;
      case 'aim': this.updateAim(dt); break;
      case 'swing': this.updateSwing(dt); break;
      case 'roll': this.updateRoll(dt); break;
      case 'hazard': this.updateHazard(dt); break;
      case 'holed': this.updateHoled(dt); break;
      case 'card': this.updateCard(dt); break;
      case 'debugcam':
        if (this.debugHook) this.debugHook(dt);
        break;
      default:
    }

    // flag gets out of the way when the ball is close
    const flag = this.hole.flag;
    if (flag) {
      const cup = this.hole.info.cup;
      const d = Math.hypot(this.ballPos.x - cup[0], this.ballPos.z - cup[2]);
      const near = this.state !== 'flyover' && this.state !== 'menu' && d < 3.2;
      const target = near ? 0 : 1;
      flag.userData.k = damp(flag.userData.k === undefined ? 1 : flag.userData.k, target, 6, dt);
      const k = flag.userData.k;
      flag.position.y = (1 - k) * 2.6;
      flag.userData.cloth.uniforms.uAlpha.value = k;
      flag.userData.pole.opacity = k;
      flag.visible = k > 0.02;
    }

    this.sky.position.copy(this.camera.position);
    this.effects.update(dt, this.camera.position, this.time);
  }

  updateMenu(dt) {
    this.menuAngle += dt * 0.07;
    const c = this.center, r = this.extent * 0.75 + 5;
    const pos = _v1.set(c.x + Math.sin(this.menuAngle) * r, c.y + 6.5 + Math.sin(this.menuAngle * 0.7) * 1.2, c.z + Math.cos(this.menuAngle) * r);
    this.camera.position.lerp(pos, 1 - Math.exp(-2 * dt));
    this.camLook.lerp(_v2.set(c.x, c.y + 0.5, c.z), 1 - Math.exp(-2 * dt));
    this.camera.lookAt(this.camLook);
  }

  updateFlyover(dt) {
    const f = this.fly;
    const k = this.stateT / f.dur;
    const pos = _v1, look = _v2;
    this.flyPose(Math.min(1, k / 0.86), pos, look);
    _m1.lookAt(pos, look, UP);
    _q1.setFromRotationMatrix(_m1);
    // blend into the first-person pose at the end
    const blend = smoothstep(0.78, 1.0, k);
    if (blend > 0) {
      const ap = _v3, aq = new THREE.Quaternion();
      this.aimPose(ap, aq);
      pos.lerp(ap, blend);
      _q1.slerp(aq, blend);
    }
    if (this.stateT < 0.05) {
      this.camera.position.copy(pos);
      this.camera.quaternion.copy(_q1);
    } else {
      this.camera.position.lerp(pos, 1 - Math.exp(-9 * dt));
      this.camera.quaternion.slerp(_q1, 1 - Math.exp(-9 * dt));
    }
    if (k >= 1) {
      this.ui.hideIntro();
      this.enterAim();
      this.camBlend = 1;
    }
  }

  placePutter(pull, lift = 0) {
    const dx = Math.sin(this.aimYaw), dz = -Math.cos(this.aimYaw);
    const bp = this.ballPos;
    const d = BALL_R + 0.05 + pull;
    this.putter.position.set(bp.x - dx * d, bp.y - BALL_R + lift, bp.z - dz * d);
    this.putter.rotation.set(0, -this.aimYaw, 0);
  }

  updateAim(dt) {
    if (this.keyTurn) this.aimYaw += this.keyTurn * dt * (this.dragging ? 0.5 : 1.3);
    const pos = _v1, quat = _q1;
    this.aimPose(pos, quat);
    if (this.camBlend < 1) {
      this.camBlend = Math.min(1, this.camBlend + dt / 0.75);
      const e = easeInOut(this.camBlend);
      this.camera.position.lerpVectors(this.camFrom.pos, pos, e);
      this.camera.quaternion.slerpQuaternions(this.camFrom.quat, quat, e);
    } else {
      this.camera.position.lerp(pos, 1 - Math.exp(-22 * dt));
      this.camera.quaternion.copy(quat);
    }
    this.placePutter(this.dragging ? this.power * 0.75 : 0.04 + Math.sin(this.time * 2.2) * 0.012, this.dragging ? this.power * 0.06 : 0);
    this.ui.setPower(this.power, this.dragging);
    this.updateAimGuide();
    // a resting ball that starts moving on its own (moving platforms are handled by the rider)
    if (!this.ball.stopped) {
      this.state = 'roll'; this.stateT = 0; this.dragging = false; this.aim.visible = false; this.putter.visible = false;
      this.ui.setPower(0, false);
    }
  }

  updateAimGuide() {
    const n = this.aimCount;
    const dx = Math.sin(this.aimYaw), dz = -Math.cos(this.aimYaw);
    const bp = this.ballPos;
    const p = this.dragging ? this.power : 0;
    const len = this.dragging ? 1.0 + p * 5.5 : 2.4;
    this.aimMat.uniforms.uPower.value = p;
    this.aimMat.uniforms.uAlpha.value = (this.dragging ? 0.95 : 0.6) * smoothstep(0.5, 1, this.camBlend);
    const m = _m1;
    let lastY = bp.y - BALL_R;
    for (let i = 0; i < n; i++) {
      const d = 0.32 + (i / (n - 1)) * len;
      const x = bp.x + dx * d, z = bp.z + dz * d;
      const g = this.world.groundAt(x, z, lastY + 0.7, lastY - 1.2);
      let s = 0.2 - i * 0.006;
      let y = lastY;
      if (g && !g.mat.hazard) { y = g.y; lastY = y; } else s = 0;
      const flow = this.dragging ? 1 + 0.25 * Math.sin(this.time * 9 - i * 0.7) : 1;
      m.makeScale(s * flow, 1, s * flow);
      m.setPosition(x, y + 0.025, z);
      this.aim.setMatrixAt(i, m);
    }
    this.aim.instanceMatrix.needsUpdate = true;
  }

  updateSwing(dt) {
    const T = 0.13;
    const k = clamp(this.stateT / T, 0, 1);
    const pull = lerp(this.shotPower * 0.75, -0.02, k * k);
    this.placePutter(Math.max(pull, -0.02), this.shotPower * 0.06 * (1 - k));
    const pos = _v1, quat = _q1;
    this.aimPose(pos, quat);
    this.camera.position.lerp(pos, 1 - Math.exp(-22 * dt));
    this.camera.quaternion.copy(quat);
    if (k >= 1) this.fire();
  }

  followCam(dt, snap = false) {
    const b = this.ball, bp = this.ballPos;
    const hs = Math.hypot(b.vx, b.vz);
    if (hs > 0.9 && !this.camZone) {
      _v1.set(b.vx / hs, 0, b.vz / hs);
      const rate = 1 - Math.exp(-(hs > 3 ? 2.6 : 1.2) * dt);
      this.followDir.lerp(_v1, rate);
      this.followDir.y = 0;
      if (this.followDir.lengthSq() < 1e-4) this.followDir.copy(_v1);
      this.followDir.normalize();
    }
    let want = _v2;
    let zone = null;
    for (const z of this.hole.info.camZones) {
      if (bp.x >= z.x0 && bp.x <= z.x1 && bp.z >= z.z0 && bp.z <= z.z1 && bp.y >= (z.y0 === undefined ? -1e9 : z.y0) && bp.y <= (z.y1 === undefined ? 1e9 : z.y1)) { zone = z; break; }
    }
    if (zone !== this.camZone) {
      // cut between fixed and chase cameras instead of flying through scenery
      this.camZone = zone;
      if (this.stateT > 0.1) snap = true;
      if (!zone && hs > 0.5) this.followDir.set(b.vx / hs, 0, b.vz / hs);
    }
    if (zone) {
      want.set(zone.pos[0], zone.pos[1], zone.pos[2]);
    } else {
      const dist = 3.7 + Math.min(1.6, hs * 0.1);
      const head = _v1.set(bp.x, bp.y + 0.4, bp.z);
      _v3.set(bp.x - this.followDir.x * dist, bp.y + 1.95, bp.z - this.followDir.z * dist);
      this.camObstructed(head, _v3, want);
    }
    const kp = snap ? 1 : 1 - Math.exp(-(zone ? 3 : 4.2) * dt);
    this.camera.position.lerp(want, kp);
    if (!snap && this.world.overlaps(this.camera.position.x, this.camera.position.y, this.camera.position.z, 0.2)) {
      this.camera.position.copy(want);
      snap = true;
    }
    _v3.set(bp.x, bp.y + 0.25, bp.z);
    if (snap) this.camLook.copy(_v3); else this.camLook.lerp(_v3, 1 - Math.exp(-12 * dt));
    _m1.lookAt(this.camera.position, this.camLook, UP);
    _q1.setFromRotationMatrix(_m1);
    if (snap) this.camera.quaternion.copy(_q1); else this.camera.quaternion.slerp(_q1, 1 - Math.exp(-10 * dt));
  }

  updateRoll(dt) {
    const b = this.ball;
    if (this.stateT < 0.25) {
      // putter follow-through
      const k = this.stateT / 0.25;
      this.placePutter(-0.02 - k * 0.25, k * 0.12);
      this.putter.visible = k < 1;
    } else {
      this.putter.visible = false;
    }
    if (this.stateT < 0.05) this.camLook.copy(this.ballPos);
    this.followCam(dt, this.snapFollow);
    this.snapFollow = false;

    const sp = b.speed();
    if (sp > 4.5 && b.grounded) {
      this.trailAcc += dt * Math.min(60, sp * 5);
      while (this.trailAcc > 1) { this.trailAcc -= 1; this.effects.trail(this.ballPos.x, this.ballPos.y - 0.04, this.ballPos.z, sp); }
    }
    // safety net: nothing should roll forever
    if (b.moveTime > 40 || (b.moveTime > 22 && sp < 1.2 && b.grounded && !b.gMat.conveyor)) {
      b.vx = b.vy = b.vz = 0;
      b.stopped = true;
    }
    if (b.stopped && !b.holed && !b.hazard) {
      if (!b.rider) this.safe = [b.px, b.py, b.pz];
      if (this.strokes >= STROKE_CAP) {
        this.ui.toast(`Stroke limit reached (${STROKE_CAP})`, 'ob', 1800);
        this.celebration = null;
        this.finishHole(STROKE_CAP, true);
        return;
      }
      this.autoAim();
      this.enterAim();
    }
  }

  updateHazard(dt) {
    this.followCamIdle(dt);
    if (this.stateT > 1.35) {
      if (this.strokes >= STROKE_CAP) {
        this.resetBallSoft();
        this.celebration = null;
        this.finishHole(STROKE_CAP, true);
        return;
      }
      this.resetBallSoft();
      this.ballPos.set(this.ball.px, this.ball.py, this.ball.pz);
      this.ballPrev.copy(this.ballPos);
      this.effects.poof(this.ball.px, this.ball.py, this.ball.pz, 0xffffff, 12, 1.2);
      this.autoAim();
      this.enterAim();
    }
  }

  followCamIdle(dt) {
    _v3.set(this.ballPos.x, Math.max(this.ballPos.y, this.world.killY) + 0.25, this.ballPos.z);
    this.camLook.lerp(_v3, 1 - Math.exp(-5 * dt));
    _m1.lookAt(this.camera.position, this.camLook, UP);
    _q1.setFromRotationMatrix(_m1);
    this.camera.quaternion.slerp(_q1, 1 - Math.exp(-6 * dt));
  }

  updateHoled(dt) {
    const cup = this.hole.info.cup;
    const a = this.time * 0.5;
    const want = _v1.set(cup[0] + Math.sin(a) * 3.6, cup[1] + 2.2, cup[2] + Math.cos(a) * 3.6);
    const head = _v2.set(cup[0], cup[1] + 0.5, cup[2]);
    this.camObstructed(head, want, _v3);
    this.camera.position.lerp(_v3, 1 - Math.exp(-2.2 * dt));
    this.camLook.lerp(_v2.set(cup[0], cup[1] + 0.2, cup[2]), 1 - Math.exp(-6 * dt));
    _m1.lookAt(this.camera.position, this.camLook, UP);
    _q1.setFromRotationMatrix(_m1);
    this.camera.quaternion.slerp(_q1, 1 - Math.exp(-6 * dt));
    const wait = this.celebration && this.celebration.level >= 3 ? 4.2 : 2.7;
    if (this.stateT > wait) this.finishHole(Math.max(1, this.strokes));
  }

  updateCard(dt) {
    const c = this.center, r = this.extent * 0.7 + 4;
    const a = this.time * 0.08;
    const pos = _v1.set(c.x + Math.sin(a) * r, c.y + 7, c.z + Math.cos(a) * r);
    this.camera.position.lerp(pos, 1 - Math.exp(-1.2 * dt));
    this.camLook.lerp(_v2.set(c.x, c.y, c.z), 1 - Math.exp(-2 * dt));
    this.camera.lookAt(this.camLook);
  }

  render(dt) {
    this.renderer.info.reset();
    this.post.render(dt);
  }
}
