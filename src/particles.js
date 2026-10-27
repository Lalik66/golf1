// CPU particle system rendered as shader points. Two instances are used:
// one alpha-blended (confetti, splashes, snow) and one additive (sparks, embers).
import * as THREE from 'three';
import { LAYER_FX, U } from './materials.js';

const _c = new THREE.Color();

export class Particles {
  constructor(max = 1500, additive = false) {
    this.max = max;
    this.n = 0;
    this.head = 0; // recycle cursor used once the pool is full
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.base = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.size0 = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.floor = new Float32Array(max);
    this.shape = new Float32Array(max);
    this.spin = new Float32Array(max);

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aShape', new THREE.BufferAttribute(this.shape, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSpin', new THREE.BufferAttribute(this.spin, 1).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uScale: { value: 600 }, uTime: U.time },
      vertexShader: /* glsl */`
        attribute vec4 aColor;
        attribute float aSize;
        attribute float aShape;
        attribute float aSpin;
        uniform float uScale;
        uniform float uTime;
        varying vec4 vColor;
        varying float vShape;
        varying float vRot;
        void main() {
          vColor = aColor;
          vShape = aShape;
          vRot = aSpin * uTime + aSpin * 13.0;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(aSize * uScale / max(0.1, -mv.z), 0.0, 220.0);
        }`,
      fragmentShader: /* glsl */`
        precision highp float;
        varying vec4 vColor;
        varying float vShape;
        varying float vRot;
        void main() {
          vec2 p = gl_PointCoord - 0.5;
          float a = 1.0;
          if (vShape < 0.5) {
            float r = length(p) * 2.0;
            a = 1.0 - smoothstep(0.55, 1.0, r);
          } else if (vShape < 1.5) {
            // tumbling confetti rectangle
            float c = cos(vRot), s = sin(vRot);
            vec2 q = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
            float squash = 0.25 + 0.75 * abs(cos(vRot * 1.7));
            a = step(abs(q.x), 0.36) * step(abs(q.y), 0.22 * squash);
          } else if (vShape < 2.5) {
            float r = length(p) * 2.0;
            a = (1.0 - smoothstep(0.75, 1.0, r)) * smoothstep(0.35, 0.6, r) + (1.0 - smoothstep(0.0, 0.3, r)) * 0.0;
          } else {
            // star sparkle
            vec2 q = abs(p);
            float d = min(q.x * 6.0 + q.y, q.y * 6.0 + q.x);
            a = 1.0 - smoothstep(0.1, 0.5, d);
          }
          if (a * vColor.a < 0.01) discard;
          gl_FragColor = vec4(vColor.rgb, vColor.a * a);
        }`,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.layers.set(LAYER_FX);
    this.points.renderOrder = 5;
  }

  setViewport(heightPx, fovDeg) {
    this.mat.uniforms.uScale.value = heightPx * 0.5 / Math.tan((fovDeg * Math.PI) / 360);
  }

  clear() { this.n = 0; this.head = 0; this.geo.setDrawRange(0, 0); }

  /**
   * o: x,y,z, vx,vy,vz, life, size, color (hex), alpha, gravity, drag, grow, floor, shape, bright, spin
   */
  emit(o) {
    let i = this.n;
    if (i >= this.max) {
      // pool full: recycle in insertion order (oldest first) to avoid popping
      i = this.head;
      this.head = (this.head + 1) % this.max;
    } else {
      this.n++;
    }
    const i3 = i * 3, i4 = i * 4;
    this.pos[i3] = o.x; this.pos[i3 + 1] = o.y; this.pos[i3 + 2] = o.z;
    this.vel[i3] = o.vx || 0; this.vel[i3 + 1] = o.vy || 0; this.vel[i3 + 2] = o.vz || 0;
    _c.set(o.color === undefined ? 0xffffff : o.color);
    const b = o.bright || 1;
    this.base[i4] = _c.r * b; this.base[i4 + 1] = _c.g * b; this.base[i4 + 2] = _c.b * b;
    this.base[i4 + 3] = o.alpha === undefined ? 1 : o.alpha;
    this.size0[i] = o.size || 0.1;
    this.life[i] = 0;
    this.maxLife[i] = o.life || 1;
    this.grav[i] = o.gravity === undefined ? 0 : o.gravity;
    this.drag[i] = o.drag || 0;
    this.grow[i] = o.grow || 0;
    this.floor[i] = o.floor === undefined ? -1e9 : o.floor;
    this.shape[i] = o.shape || 0;
    this.spin[i] = o.spin || 0;
  }

  update(dt) {
    let n = this.n;
    const pos = this.pos, vel = this.vel, col = this.col, base = this.base;
    for (let i = 0; i < n; i++) {
      this.life[i] += dt;
      if (this.life[i] >= this.maxLife[i]) {
        // swap-remove
        n--;
        if (i !== n) {
          const a = i * 3, b = n * 3, a4 = i * 4, b4 = n * 4;
          pos[a] = pos[b]; pos[a + 1] = pos[b + 1]; pos[a + 2] = pos[b + 2];
          vel[a] = vel[b]; vel[a + 1] = vel[b + 1]; vel[a + 2] = vel[b + 2];
          base[a4] = base[b4]; base[a4 + 1] = base[b4 + 1]; base[a4 + 2] = base[b4 + 2]; base[a4 + 3] = base[b4 + 3];
          this.size0[i] = this.size0[n]; this.life[i] = this.life[n]; this.maxLife[i] = this.maxLife[n];
          this.grav[i] = this.grav[n]; this.drag[i] = this.drag[n]; this.grow[i] = this.grow[n];
          this.floor[i] = this.floor[n]; this.shape[i] = this.shape[n]; this.spin[i] = this.spin[n];
        }
        i--;
        continue;
      }
      const i3 = i * 3, i4 = i * 4;
      const d = Math.max(0, 1 - this.drag[i] * dt);
      vel[i3] *= d; vel[i3 + 1] = vel[i3 + 1] * d - this.grav[i] * dt; vel[i3 + 2] *= d;
      pos[i3] += vel[i3] * dt; pos[i3 + 1] += vel[i3 + 1] * dt; pos[i3 + 2] += vel[i3 + 2] * dt;
      if (pos[i3 + 1] < this.floor[i]) {
        pos[i3 + 1] = this.floor[i];
        vel[i3 + 1] *= -0.35; vel[i3] *= 0.6; vel[i3 + 2] *= 0.6;
      }
      const k = this.life[i] / this.maxLife[i];
      const fadeIn = Math.min(1, k * 8);
      const fade = fadeIn * (1 - k * k * k);
      col[i4] = base[i4]; col[i4 + 1] = base[i4 + 1]; col[i4 + 2] = base[i4 + 2];
      col[i4 + 3] = base[i4 + 3] * fade;
      this.size[i] = this.size0[i] * (1 + this.grow[i] * k);
    }
    this.n = n;
    const g = this.geo;
    g.setDrawRange(0, n);
    g.attributes.position.needsUpdate = true;
    g.attributes.aColor.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
    g.attributes.aShape.needsUpdate = true;
    g.attributes.aSpin.needsUpdate = true;
  }
}

const rnd = (a, b) => a + Math.random() * (b - a);

/** One-shot effects used by the game. `fx` = alpha blended, `glow` = additive. */
export class Effects {
  constructor(scene) {
    this.fx = new Particles(2600, false);
    this.glow = new Particles(1800, true);
    scene.add(this.fx.points, this.glow.points);
    this.emitters = [];
    this.fireworks = [];
  }

  setViewport(h, fov) { this.fx.setViewport(h, fov); this.glow.setViewport(h, fov); }

  clear() { this.fx.clear(); this.glow.clear(); this.emitters = []; this.fireworks = []; }

  setAmbient(list) { this.emitters = list.map((e) => ({ ...e, acc: 0 })); }

  update(dt, camPos, t) {
    for (const e of this.emitters) {
      e.acc += e.rate * dt;
      const sys = e.additive ? this.glow : this.fx;
      let guard = 0;
      while (e.acc >= 1 && guard++ < 40) {
        e.acc -= 1;
        const ox = e.follow ? camPos.x : 0, oz = e.follow ? camPos.z : 0;
        const colors = e.colors || [0xffffff];
        sys.emit({
          x: ox + rnd(e.min[0], e.max[0]), y: rnd(e.min[1], e.max[1]), z: oz + rnd(e.min[2], e.max[2]),
          vx: (e.vel ? e.vel[0] : 0) + rnd(-1, 1) * (e.spread ? e.spread[0] : 0),
          vy: (e.vel ? e.vel[1] : 0) + rnd(-1, 1) * (e.spread ? e.spread[1] : 0),
          vz: (e.vel ? e.vel[2] : 0) + rnd(-1, 1) * (e.spread ? e.spread[2] : 0),
          life: rnd(e.life[0], e.life[1]), size: rnd(e.size[0], e.size[1]),
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: e.alpha === undefined ? 1 : e.alpha, gravity: e.gravity || 0, drag: e.drag || 0,
          grow: e.grow || 0, shape: e.shape || 0, bright: e.bright || 1, spin: e.spin ? rnd(-e.spin, e.spin) : 0,
        });
      }
    }
    for (let i = this.fireworks.length - 1; i >= 0; i--) {
      const f = this.fireworks[i];
      f.t -= dt;
      if (f.t <= 0) {
        this.burst(f.x, f.y, f.z, f.color);
        this.fireworks.splice(i, 1);
      }
    }
    this.fx.update(dt);
    this.glow.update(dt);
  }

  splash(x, y, z, color = 0xffffff, color2 = 0x9be7ff) {
    for (let i = 0; i < 46; i++) {
      const a = Math.random() * Math.PI * 2, s = rnd(0.6, 2.6);
      this.fx.emit({ x, y: y + 0.05, z, vx: Math.cos(a) * s, vy: rnd(2.5, 6.5), vz: Math.sin(a) * s, life: rnd(0.5, 1.0), size: rnd(0.08, 0.2), color: Math.random() < 0.5 ? color : color2, gravity: 14, alpha: 0.95 });
    }
    for (let i = 0; i < 3; i++) {
      this.fx.emit({ x, y: y + 0.03, z, life: 0.7 + i * 0.25, size: 0.5, grow: 5 + i * 2, color, alpha: 0.7, shape: 2 });
    }
  }

  lavaBurst(x, y, z) {
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, s = rnd(0.4, 2.2);
      this.glow.emit({ x, y: y + 0.05, z, vx: Math.cos(a) * s, vy: rnd(2, 6), vz: Math.sin(a) * s, life: rnd(0.5, 1.2), size: rnd(0.1, 0.24), color: Math.random() < 0.5 ? 0xff7a12 : 0xffe066, gravity: 10, bright: 2.2 });
    }
    for (let i = 0; i < 14; i++) {
      this.fx.emit({ x: x + rnd(-0.2, 0.2), y: y + 0.1, z: z + rnd(-0.2, 0.2), vx: rnd(-0.3, 0.3), vy: rnd(0.8, 2), vz: rnd(-0.3, 0.3), life: rnd(1, 1.8), size: rnd(0.3, 0.6), grow: 2, color: 0x3a3038, alpha: 0.55, drag: 0.6 });
    }
  }

  poof(x, y, z, color = 0xffffff, n = 16, speed = 1.4) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = rnd(0.3, speed);
      this.fx.emit({ x, y, z, vx: Math.cos(a) * s, vy: rnd(0.2, 1.2), vz: Math.sin(a) * s, life: rnd(0.35, 0.7), size: rnd(0.12, 0.28), grow: 1.5, color, alpha: 0.6, drag: 2.5 });
    }
  }

  sparks(x, y, z, color = 0xffe08a, n = 12, speed = 3) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = rnd(0.5, speed);
      this.glow.emit({ x, y, z, vx: Math.cos(a) * s, vy: rnd(0.5, speed), vz: Math.sin(a) * s, life: rnd(0.25, 0.6), size: rnd(0.06, 0.14), color, gravity: 9, bright: 2.4, shape: 3 });
    }
  }

  swirl(x, y, z, color = 0x7c3cff, color2 = 0x2ff3ff) {
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, s = rnd(0.5, 2.5);
      this.glow.emit({ x, y: y + rnd(0, 0.6), z, vx: Math.cos(a) * s, vy: rnd(0.2, 2.5), vz: Math.sin(a) * s, life: rnd(0.4, 0.9), size: rnd(0.08, 0.2), color: Math.random() < 0.5 ? color : color2, drag: 2, bright: 2.2, shape: 3 });
    }
  }

  trail(x, y, z, speed, color = 0xffffff) {
    this.fx.emit({ x, y, z, vx: rnd(-0.1, 0.1), vy: rnd(0, 0.2), vz: rnd(-0.1, 0.1), life: 0.35 + Math.min(0.3, speed * 0.02), size: 0.13, grow: -0.8, color, alpha: 0.45 });
  }

  confetti(x, y, z, n = 120, power = 1) {
    const colors = [0xff4d6d, 0xffd23f, 0x38f0ff, 0x7dff8a, 0xb26bff, 0xff8a1f, 0xffffff];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = rnd(0.5, 3.4) * power;
      this.fx.emit({
        x, y: y + 0.1, z, vx: Math.cos(a) * s, vy: rnd(4, 9) * power, vz: Math.sin(a) * s,
        life: rnd(1.6, 3.2), size: rnd(0.16, 0.3), color: colors[Math.floor(Math.random() * colors.length)],
        gravity: 7, drag: 1.1, shape: 1, spin: rnd(-9, 9), floor: y + 0.02,
      });
    }
  }

  burst(x, y, z, color) {
    const colors = color ? [color, 0xffffff] : [0xff4d6d, 0xffd23f, 0x38f0ff, 0x7dff8a, 0xb26bff];
    const c = colors[Math.floor(Math.random() * colors.length)];
    for (let i = 0; i < 90; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u), s = rnd(4.5, 6.5);
      this.glow.emit({ x, y, z, vx: Math.cos(a) * r * s, vy: u * s, vz: Math.sin(a) * r * s, life: rnd(0.9, 1.6), size: rnd(0.16, 0.3), color: Math.random() < 0.8 ? c : 0xffffff, gravity: 2.5, drag: 1.6, bright: 2.6, shape: 3 });
    }
  }

  firework(x, y, z, delay = 0, color) { this.fireworks.push({ x, y, z, t: delay, color }); }
}
