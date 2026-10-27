// Custom mini-golf physics.
// A sphere is moved in small substeps against static triangles, primitive
// solids and kinematic (animated) bodies. Contacts are resolved deepest-first
// and static geometry is resolved last. In normal play the per-substep travel
// is kept well under the ball radius, so the ball stays out of walls. The one
// residual escape case is a very fast kinematic body that deeply overlaps the
// ball within a single step and shoves it clear behind a thin one-sided face;
// movers are therefore kept slow relative to the step, and `verify.mjs` fuzzes
// every hole to confirm the ball never ends up inside solid geometry.
import { Vector3, Quaternion, Matrix4 } from 'three';

export const BALL_R = 0.1;
export const CUP_R = 0.215;
export const CUP_DEPTH = 0.42;
export const FIXED_DT = 1 / 120;

export const MAT = {
  green: { name: 'green', e: 0.38, mu: 1.0, snd: 'soft' },
  turf: { name: 'turf', e: 0.35, mu: 1.25, snd: 'soft' },
  sand: { name: 'sand', e: 0.12, mu: 3.6, snd: 'sand' },
  ice: { name: 'ice', e: 0.3, mu: 0.14, snd: 'ice' },
  snow: { name: 'snow', e: 0.25, mu: 1.35, snd: 'soft' },
  wood: { name: 'wood', e: 0.72, mu: 1.0, snd: 'wood' },
  plank: { name: 'plank', e: 0.4, mu: 1.0, snd: 'wood' },
  stone: { name: 'stone', e: 0.66, mu: 1.0, snd: 'stone' },
  rock: { name: 'rock', e: 0.4, mu: 1.1, snd: 'stone' },
  metal: { name: 'metal', e: 0.74, mu: 0.9, snd: 'metal' },
  deck: { name: 'deck', e: 0.4, mu: 0.95, snd: 'metal' },
  neon: { name: 'neon', e: 0.4, mu: 0.9, snd: 'metal' },
  flesh: { name: 'flesh', e: 0.45, mu: 1.0, snd: 'thump' },
  bumper: { name: 'bumper', e: 0.9, mu: 1.0, kick: 5.5, snd: 'bumper' },
  softBumper: { name: 'softBumper', e: 0.85, mu: 1.0, kick: 3.2, snd: 'bumper' },
  cup: { name: 'cup', e: 0.55, mu: 2.0, snd: 'cup' },
  water: { name: 'water', e: 0, mu: 1, hazard: 'water' },
  lava: { name: 'lava', e: 0, mu: 1, hazard: 'lava' },
  ob: { name: 'ob', e: 0.2, mu: 3, hazard: 'ob' },
  void: { name: 'void', e: 0, mu: 1, hazard: 'void' },
  goo: { name: 'goo', e: 0, mu: 1, hazard: 'goo' },
};

const ONE = new Vector3(1, 1, 1);
const _v = new Vector3();
const _q = new Quaternion();
const _m = new Matrix4();

// Scratch outputs of the narrow-phase tests (avoids allocations in the hot loop)
let oNx = 0, oNy = 0, oNz = 0, oQx = 0, oQy = 0, oQz = 0;
let oVx = 0, oVy = 0, oVz = 0;

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

/** Kinematic body: its pose is a pure function of time. */
export class Body {
  constructor(poseFn) {
    this.poseFn = poseFn;
    this.pos = new Vector3();
    this.quat = new Quaternion();
    this.mat = new Matrix4();
    this.prevMat = new Matrix4();
    this.inv = new Matrix4();
    this.shapes = [];
    this.inited = false;
    this.bc = [0, 0, 0]; // bounding sphere centre (local)
    this.br = 0; // bounding radius
    this.wx = 0; this.wy = 0; this.wz = 0; // bounding centre (world)
    this.enabled = true;
  }

  update(t) {
    if (this.inited) this.prevMat.copy(this.mat);
    this.poseFn(t, this);
    this.mat.compose(this.pos, this.quat, ONE);
    if (!this.inited) { this.prevMat.copy(this.mat); this.inited = true; }
    this.inv.copy(this.mat).invert();
    const e = this.mat.elements;
    const b = this.bc;
    this.wx = e[0] * b[0] + e[4] * b[1] + e[8] * b[2] + e[12];
    this.wy = e[1] * b[0] + e[5] * b[1] + e[9] * b[2] + e[13];
    this.wz = e[2] * b[0] + e[6] * b[1] + e[10] * b[2] + e[14];
    for (const s of this.shapes) updateShape(s, e);
  }

  /** Velocity of the body at a world point (finite difference of the pose). */
  velAt(px, py, pz, dt) {
    const i = this.inv.elements;
    const lx = i[0] * px + i[4] * py + i[8] * pz + i[12];
    const ly = i[1] * px + i[5] * py + i[9] * pz + i[13];
    const lz = i[2] * px + i[6] * py + i[10] * pz + i[14];
    const p = this.prevMat.elements;
    const qx = p[0] * lx + p[4] * ly + p[8] * lz + p[12];
    const qy = p[1] * lx + p[5] * ly + p[9] * lz + p[13];
    const qz = p[2] * lx + p[6] * ly + p[10] * lz + p[14];
    oVx = (px - qx) / dt; oVy = (py - qy) / dt; oVz = (pz - qz) / dt;
  }

  toLocal(px, py, pz, out) {
    const i = this.inv.elements;
    out[0] = i[0] * px + i[4] * py + i[8] * pz + i[12];
    out[1] = i[1] * px + i[5] * py + i[9] * pz + i[13];
    out[2] = i[2] * px + i[6] * py + i[10] * pz + i[14];
  }
}

function updateShape(s, e) {
  if (s.type === 'box') {
    const l = s.lm; // local matrix elements (rotation + centre)
    const c = s.c, m = s.m;
    c[0] = e[0] * l[12] + e[4] * l[13] + e[8] * l[14] + e[12];
    c[1] = e[1] * l[12] + e[5] * l[13] + e[9] * l[14] + e[13];
    c[2] = e[2] * l[12] + e[6] * l[13] + e[10] * l[14] + e[14];
    for (let a = 0; a < 3; a++) {
      const ax = l[a * 4], ay = l[a * 4 + 1], az = l[a * 4 + 2];
      m[a * 3] = e[0] * ax + e[4] * ay + e[8] * az;
      m[a * 3 + 1] = e[1] * ax + e[5] * ay + e[9] * az;
      m[a * 3 + 2] = e[2] * ax + e[6] * ay + e[10] * az;
    }
  } else if (s.type === 'sph') {
    const l = s.lc, c = s.c;
    c[0] = e[0] * l[0] + e[4] * l[1] + e[8] * l[2] + e[12];
    c[1] = e[1] * l[0] + e[5] * l[1] + e[9] * l[2] + e[13];
    c[2] = e[2] * l[0] + e[6] * l[1] + e[10] * l[2] + e[14];
  } else if (s.type === 'cap') {
    const la = s.la, lb = s.lb, a = s.a, b = s.b;
    a[0] = e[0] * la[0] + e[4] * la[1] + e[8] * la[2] + e[12];
    a[1] = e[1] * la[0] + e[5] * la[1] + e[9] * la[2] + e[13];
    a[2] = e[2] * la[0] + e[6] * la[1] + e[10] * la[2] + e[14];
    b[0] = e[0] * lb[0] + e[4] * lb[1] + e[8] * lb[2] + e[12];
    b[1] = e[1] * lb[0] + e[5] * lb[1] + e[9] * lb[2] + e[13];
    b[2] = e[2] * lb[0] + e[6] * lb[1] + e[10] * lb[2] + e[14];
  }
}

export class Ball {
  constructor() {
    this.px = 0; this.py = 0; this.pz = 0;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.ox = 0; this.oy = 0; this.oz = 0; // previous step position (render interpolation)
    this.grounded = false;
    this.gnx = 0; this.gny = 1; this.gnz = 0;
    this.gsx = 0; this.gsy = 0; this.gsz = 0;
    this.gMat = MAT.green;
    this.gBody = null;
    this.air = 0;
    this.rest = 0;
    this.stopped = true;
    this.rider = null; // { body, l:[x,y,z] }
    this.holed = false;
    this.hazard = null;
    this.portalCd = 0;
    this.boostCd = 0;
    this.moveTime = 0;
    this.teleported = false;
  }

  place(x, y, z) {
    this.px = this.ox = x; this.py = this.oy = y; this.pz = this.oz = z;
    this.vx = this.vy = this.vz = 0;
    this.grounded = false; this.air = 0; this.rest = 0;
    this.stopped = true; this.rider = null; this.holed = false; this.hazard = null;
    this.portalCd = 0; this.boostCd = 0; this.moveTime = 0;
    this.gMat = MAT.green; this.gBody = null;
    this.gnx = 0; this.gny = 1; this.gnz = 0;
    this.gsx = this.gsy = this.gsz = 0;
    this.teleported = true;
  }

  copy(b) {
    for (const k in b) this[k] = b[k];
    if (b.rider) this.rider = { body: b.rider.body, l: b.rider.l.slice() };
    return this;
  }

  speed() { return Math.hypot(this.vx, this.vy, this.vz); }
}

export class World {
  constructor() {
    this.gravity = 22;
    this.rollA = 1.25; // constant rolling deceleration
    this.rollK = 0.2; // speed-proportional rolling drag
    this.triP = [];
    this.triN = [];
    this.triMat = [];
    this.triStamp = null;
    this.statics = [];
    this.bodies = [];
    this.triggers = [];
    this.cup = null; // {x,y,z}
    this.killY = -6;
    this.killType = 'ob';
    this.cell = 2;
    this.grid = new Map();
    this.time = 0;
    this.events = [];
    this.stamp = 1;
    this.candT = [];
    this.candS = [];
    this.bounds = { x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9, y0: 1e9, y1: -1e9 };
    this.finalized = false;
  }

  // ---------------------------------------------------------------- building
  addTri(a, b, c, mat = MAT.green) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz);
    if (l < 1e-10) return;
    nx /= l; ny /= l; nz /= l;
    this.triP.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    this.triN.push(nx, ny, nz);
    this.triMat.push(mat);
  }

  /** Adds a triangle making sure its normal points towards `up` (default +Y). */
  addTriUp(a, b, c, mat, up = [0, 1, 0]) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * up[0] + ny * up[1] + nz * up[2] < 0) this.addTri(a, c, b, mat);
    else this.addTri(a, b, c, mat);
  }

  addQuadUp(a, b, c, d, mat, up) {
    this.addTriUp(a, b, c, mat, up);
    this.addTriUp(a, c, d, mat, up);
  }

  _boxShape(c, h, quat, mat) {
    _m.compose(_v.set(c[0], c[1], c[2]), quat, ONE);
    const e = _m.elements;
    return {
      type: 'box', mat,
      c: [c[0], c[1], c[2]], h: [h[0], h[1], h[2]],
      m: [e[0], e[1], e[2], e[4], e[5], e[6], e[8], e[9], e[10]],
      lm: Array.from(e), body: null,
    };
  }

  /** Static oriented box. c = centre, h = half extents. */
  addBox(c, h, { rotY = 0, quat = null, mat = MAT.wood } = {}) {
    const q = quat || _q.setFromAxisAngle(_v.set(0, 1, 0), rotY).clone();
    const s = this._boxShape(c, h, q, mat);
    this.statics.push(s);
    return s;
  }

  /** Static vertical cylinder (solid, capped). */
  addCyl(x, z, r, y0, y1, { mat = MAT.wood, spin = 0 } = {}) {
    const s = { type: 'cyl', x, z, r, y0, y1, mat, spin, body: null };
    this.statics.push(s);
    return s;
  }

  addSphere(c, r, { mat = MAT.stone } = {}) {
    const s = { type: 'sph', c: [c[0], c[1], c[2]], r, mat, body: null };
    this.statics.push(s);
    return s;
  }

  addCapsule(a, b, r, { mat = MAT.stone } = {}) {
    const s = { type: 'cap', a: a.slice(), b: b.slice(), r, mat, body: null };
    this.statics.push(s);
    return s;
  }

  /**
   * Kinematic body. shapes are expressed in the body frame:
   * {type:'box', c, h, quat?}, {type:'sph', c, r}, {type:'cap', a, b, r}
   */
  addBody(poseFn, shapes, mat = MAT.wood) {
    const body = new Body(poseFn);
    let minx = 1e9, miny = 1e9, minz = 1e9, maxx = -1e9, maxy = -1e9, maxz = -1e9;
    const grow = (x, y, z, r) => {
      minx = Math.min(minx, x - r); maxx = Math.max(maxx, x + r);
      miny = Math.min(miny, y - r); maxy = Math.max(maxy, y + r);
      minz = Math.min(minz, z - r); maxz = Math.max(maxz, z + r);
    };
    for (const d of shapes) {
      let s;
      const m = d.mat || mat;
      if (d.type === 'box') {
        s = this._boxShape(d.c, d.h, d.quat || new Quaternion(), m);
        grow(d.c[0], d.c[1], d.c[2], Math.hypot(d.h[0], d.h[1], d.h[2]));
      } else if (d.type === 'sph') {
        s = { type: 'sph', c: d.c.slice(), lc: d.c.slice(), r: d.r, mat: m };
        grow(d.c[0], d.c[1], d.c[2], d.r);
      } else {
        s = { type: 'cap', a: d.a.slice(), b: d.b.slice(), la: d.a.slice(), lb: d.b.slice(), r: d.r, mat: m };
        grow(d.a[0], d.a[1], d.a[2], d.r);
        grow(d.b[0], d.b[1], d.b[2], d.r);
      }
      s.body = body;
      body.shapes.push(s);
    }
    body.bc = [(minx + maxx) / 2, (miny + maxy) / 2, (minz + maxz) / 2];
    body.br = Math.hypot(maxx - minx, maxy - miny, maxz - minz) / 2;
    this.bodies.push(body);
    return body;
  }

  addTrigger(t) { this.triggers.push(t); return t; }

  setCup(x, y, z) { this.cup = { x, y, z }; }

  _cellKey(ix, iz) { return (ix + 2048) * 4096 + (iz + 2048); }

  _insert(x0, z0, x1, z1, kind, idx) {
    const c = this.cell;
    const ix0 = Math.floor(x0 / c), ix1 = Math.floor(x1 / c);
    const iz0 = Math.floor(z0 / c), iz1 = Math.floor(z1 / c);
    for (let ix = ix0; ix <= ix1; ix++) {
      for (let iz = iz0; iz <= iz1; iz++) {
        const k = this._cellKey(ix, iz);
        let cell = this.grid.get(k);
        if (!cell) { cell = { t: [], s: [] }; this.grid.set(k, cell); }
        cell[kind].push(idx);
      }
    }
  }

  finalize() {
    this.triP = Float64Array.from(this.triP);
    this.triN = Float64Array.from(this.triN);
    const nt = this.triMat.length;
    this.triStamp = new Int32Array(nt);
    this.grid.clear();
    const P = this.triP;
    const pad = BALL_R + 0.06;
    const bd = this.bounds;
    for (let i = 0; i < nt; i++) {
      const o = i * 9;
      const x0 = Math.min(P[o], P[o + 3], P[o + 6]), x1 = Math.max(P[o], P[o + 3], P[o + 6]);
      const z0 = Math.min(P[o + 2], P[o + 5], P[o + 8]), z1 = Math.max(P[o + 2], P[o + 5], P[o + 8]);
      const y0 = Math.min(P[o + 1], P[o + 4], P[o + 7]), y1 = Math.max(P[o + 1], P[o + 4], P[o + 7]);
      this._insert(x0 - pad, z0 - pad, x1 + pad, z1 + pad, 't', i);
      if (!this.triMat[i].hazard) {
        bd.x0 = Math.min(bd.x0, x0); bd.x1 = Math.max(bd.x1, x1);
        bd.z0 = Math.min(bd.z0, z0); bd.z1 = Math.max(bd.z1, z1);
        bd.y0 = Math.min(bd.y0, y0); bd.y1 = Math.max(bd.y1, y1);
      }
    }
    for (let i = 0; i < this.statics.length; i++) {
      const s = this.statics[i];
      s.stamp = 0;
      let x0, x1, z0, z1;
      if (s.type === 'box') {
        const m = s.m, h = s.h;
        const ex = Math.abs(m[0]) * h[0] + Math.abs(m[3]) * h[1] + Math.abs(m[6]) * h[2];
        const ez = Math.abs(m[2]) * h[0] + Math.abs(m[5]) * h[1] + Math.abs(m[8]) * h[2];
        x0 = s.c[0] - ex; x1 = s.c[0] + ex; z0 = s.c[2] - ez; z1 = s.c[2] + ez;
      } else if (s.type === 'cyl') {
        x0 = s.x - s.r; x1 = s.x + s.r; z0 = s.z - s.r; z1 = s.z + s.r;
      } else if (s.type === 'sph') {
        x0 = s.c[0] - s.r; x1 = s.c[0] + s.r; z0 = s.c[2] - s.r; z1 = s.c[2] + s.r;
      } else {
        x0 = Math.min(s.a[0], s.b[0]) - s.r; x1 = Math.max(s.a[0], s.b[0]) + s.r;
        z0 = Math.min(s.a[2], s.b[2]) - s.r; z1 = Math.max(s.a[2], s.b[2]) + s.r;
      }
      this._insert(x0 - pad, z0 - pad, x1 + pad, z1 + pad, 's', i);
    }
    this.finalized = true;
    this.setTime(0);
  }

  /** Jump the kinematic world to an absolute time (used on reset and by the solver). */
  setTime(t) {
    this.time = t;
    for (const b of this.bodies) {
      b.inited = false;
      b.update(t - FIXED_DT);
      b.update(t);
    }
  }

  // ---------------------------------------------------------------- queries
  _gather(px, pz, r) {
    const c = this.cell;
    const ix0 = Math.floor((px - r) / c), ix1 = Math.floor((px + r) / c);
    const iz0 = Math.floor((pz - r) / c), iz1 = Math.floor((pz + r) / c);
    const T = this.candT, S = this.candS;
    T.length = 0; S.length = 0;
    const stamp = ++this.stamp;
    for (let ix = ix0; ix <= ix1; ix++) {
      for (let iz = iz0; iz <= iz1; iz++) {
        const cell = this.grid.get(this._cellKey(ix, iz));
        if (!cell) continue;
        const ct = cell.t;
        for (let i = 0; i < ct.length; i++) {
          const k = ct[i];
          if (this.triStamp[k] !== stamp) { this.triStamp[k] = stamp; T.push(k); }
        }
        const cs = cell.s;
        for (let i = 0; i < cs.length; i++) {
          const s = this.statics[cs[i]];
          if (s.stamp !== stamp) { s.stamp = stamp; S.push(s); }
        }
      }
    }
  }

  _tri(i, px, py, pz, R) {
    const P = this.triP, N = this.triN;
    const o = i * 9, on = i * 3;
    const ax = P[o], ay = P[o + 1], az = P[o + 2];
    const nx = N[on], ny = N[on + 1], nz = N[on + 2];
    const sd = (px - ax) * nx + (py - ay) * ny + (pz - az) * nz;
    if (sd > R || sd < -R * 0.95) return 0;
    const bx = P[o + 3], by = P[o + 4], bz = P[o + 5];
    const cx = P[o + 6], cy = P[o + 7], cz = P[o + 8];
    const abx = bx - ax, aby = by - ay, abz = bz - az;
    const acx = cx - ax, acy = cy - ay, acz = cz - az;
    const apx = px - ax, apy = py - ay, apz = pz - az;
    const d1 = abx * apx + aby * apy + abz * apz;
    const d2 = acx * apx + acy * apy + acz * apz;
    let qx, qy, qz, face = false;
    if (d1 <= 0 && d2 <= 0) { qx = ax; qy = ay; qz = az; } else {
      const bpx = px - bx, bpy = py - by, bpz = pz - bz;
      const d3 = abx * bpx + aby * bpy + abz * bpz;
      const d4 = acx * bpx + acy * bpy + acz * bpz;
      if (d3 >= 0 && d4 <= d3) { qx = bx; qy = by; qz = bz; } else {
        const vc = d1 * d4 - d3 * d2;
        if (vc <= 0 && d1 >= 0 && d3 <= 0) {
          const v = d1 / (d1 - d3);
          qx = ax + abx * v; qy = ay + aby * v; qz = az + abz * v;
        } else {
          const cpx = px - cx, cpy = py - cy, cpz = pz - cz;
          const d5 = abx * cpx + aby * cpy + abz * cpz;
          const d6 = acx * cpx + acy * cpy + acz * cpz;
          if (d6 >= 0 && d5 <= d6) { qx = cx; qy = cy; qz = cz; } else {
            const vb = d5 * d2 - d1 * d6;
            if (vb <= 0 && d2 >= 0 && d6 <= 0) {
              const w = d2 / (d2 - d6);
              qx = ax + acx * w; qy = ay + acy * w; qz = az + acz * w;
            } else {
              const va = d3 * d6 - d5 * d4;
              if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) {
                const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
                qx = bx + (cx - bx) * w; qy = by + (cy - by) * w; qz = bz + (cz - bz) * w;
              } else {
                const s = va + vb + vc;
                if (s < 1e-12) {
                  // near-degenerate sliver: fall back to vertex a so den can't blow up
                  qx = ax; qy = ay; qz = az;
                } else {
                  const den = 1 / s;
                  const v = vb * den, w = vc * den;
                  qx = ax + abx * v + acx * w; qy = ay + aby * v + acy * w; qz = az + abz * v + acz * w;
                  face = true;
                }
              }
            }
          }
        }
      }
    }
    oQx = qx; oQy = qy; oQz = qz;
    if (face) {
      // One-sided: a centre slightly behind the face is pushed back to the front.
      oNx = nx; oNy = ny; oNz = nz;
      return R - sd;
    }
    if (sd < 0) return 0;
    const dx = px - qx, dy = py - qy, dz = pz - qz;
    const dd = dx * dx + dy * dy + dz * dz;
    if (dd >= R * R) return 0;
    const d = Math.sqrt(dd);
    if (d < 1e-9) { oNx = nx; oNy = ny; oNz = nz; return R; }
    oNx = dx / d; oNy = dy / d; oNz = dz / d;
    return R - d;
  }

  _box(b, px, py, pz, R) {
    const c = b.c, m = b.m, h = b.h;
    const dx = px - c[0], dy = py - c[1], dz = pz - c[2];
    const lx = dx * m[0] + dy * m[1] + dz * m[2];
    const hx = h[0];
    if (lx > hx + R || lx < -hx - R) return 0;
    const ly = dx * m[3] + dy * m[4] + dz * m[5];
    const hy = h[1];
    if (ly > hy + R || ly < -hy - R) return 0;
    const lz = dx * m[6] + dy * m[7] + dz * m[8];
    const hz = h[2];
    if (lz > hz + R || lz < -hz - R) return 0;
    let qx = clamp(lx, -hx, hx), qy = clamp(ly, -hy, hy), qz = clamp(lz, -hz, hz);
    let nlx = 0, nly = 0, nlz = 0, depth;
    if (qx === lx && qy === ly && qz === lz) {
      const ex = hx - Math.abs(lx), ey = hy - Math.abs(ly), ez = hz - Math.abs(lz);
      if (ex <= ey && ex <= ez) {
        nlx = lx < 0 ? -1 : 1; qx = nlx * hx; depth = ex + R;
      } else if (ey <= ez) {
        nly = ly < 0 ? -1 : 1; qy = nly * hy; depth = ey + R;
      } else {
        nlz = lz < 0 ? -1 : 1; qz = nlz * hz; depth = ez + R;
      }
    } else {
      const ex = lx - qx, ey = ly - qy, ez = lz - qz;
      const dd = ex * ex + ey * ey + ez * ez;
      if (dd >= R * R) return 0;
      const d = Math.sqrt(dd);
      nlx = ex / d; nly = ey / d; nlz = ez / d;
      depth = R - d;
    }
    oNx = nlx * m[0] + nly * m[3] + nlz * m[6];
    oNy = nlx * m[1] + nly * m[4] + nlz * m[7];
    oNz = nlx * m[2] + nly * m[5] + nlz * m[8];
    oQx = c[0] + qx * m[0] + qy * m[3] + qz * m[6];
    oQy = c[1] + qx * m[1] + qy * m[4] + qz * m[7];
    oQz = c[2] + qx * m[2] + qy * m[5] + qz * m[8];
    return depth;
  }

  _cyl(c, px, py, pz, R) {
    const dx = px - c.x, dz = pz - c.z;
    const dd = dx * dx + dz * dz;
    const rr = c.r + R;
    if (dd > rr * rr || py > c.y1 + R || py < c.y0 - R) return 0;
    const d = Math.sqrt(dd);
    const ux = d > 1e-9 ? dx / d : 1, uz = d > 1e-9 ? dz / d : 0;
    if (py >= c.y0 && py <= c.y1) {
      if (d >= c.r) {
        oNx = ux; oNy = 0; oNz = uz;
        oQx = c.x + ux * c.r; oQy = py; oQz = c.z + uz * c.r;
        return rr - d;
      }
      const ps = c.r - d, pt = c.y1 - py, pb = py - c.y0;
      if (pt < ps && pt <= pb) { oNx = 0; oNy = 1; oNz = 0; oQx = px; oQy = c.y1; oQz = pz; return pt + R; }
      if (pb < ps) { oNx = 0; oNy = -1; oNz = 0; oQx = px; oQy = c.y0; oQz = pz; return pb + R; }
      oNx = ux; oNy = 0; oNz = uz; oQx = c.x + ux * c.r; oQy = py; oQz = c.z + uz * c.r;
      return ps + R;
    }
    const top = py > c.y1;
    const qy = top ? c.y1 : c.y0;
    const qd = Math.min(d, c.r);
    const qx = c.x + ux * qd, qz = c.z + uz * qd;
    const ex = px - qx, ey = py - qy, ez = pz - qz;
    const e2 = ex * ex + ey * ey + ez * ez;
    if (e2 >= R * R) return 0;
    const e = Math.sqrt(e2);
    if (e < 1e-9) { oNx = 0; oNy = top ? 1 : -1; oNz = 0; } else { oNx = ex / e; oNy = ey / e; oNz = ez / e; }
    oQx = qx; oQy = qy; oQz = qz;
    return R - e;
  }

  _sph(s, px, py, pz, R) {
    const c = s.c;
    const dx = px - c[0], dy = py - c[1], dz = pz - c[2];
    const rr = s.r + R;
    const dd = dx * dx + dy * dy + dz * dz;
    if (dd >= rr * rr) return 0;
    const d = Math.sqrt(dd);
    if (d < 1e-9) { oNx = 0; oNy = 1; oNz = 0; } else { oNx = dx / d; oNy = dy / d; oNz = dz / d; }
    oQx = c[0] + oNx * s.r; oQy = c[1] + oNy * s.r; oQz = c[2] + oNz * s.r;
    return rr - d;
  }

  _cap(s, px, py, pz, R) {
    const a = s.a, b = s.b;
    const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2];
    const l2 = abx * abx + aby * aby + abz * abz;
    let t = l2 > 1e-12 ? ((px - a[0]) * abx + (py - a[1]) * aby + (pz - a[2]) * abz) / l2 : 0;
    t = clamp(t, 0, 1);
    const cx = a[0] + abx * t, cy = a[1] + aby * t, cz = a[2] + abz * t;
    const dx = px - cx, dy = py - cy, dz = pz - cz;
    const rr = s.r + R;
    const dd = dx * dx + dy * dy + dz * dz;
    if (dd >= rr * rr) return 0;
    const d = Math.sqrt(dd);
    if (d < 1e-9) { oNx = 0; oNy = 1; oNz = 0; } else { oNx = dx / d; oNy = dy / d; oNz = dz / d; }
    oQx = cx + oNx * s.r; oQy = cy + oNy * s.r; oQz = cz + oNz * s.r;
    return rr - d;
  }

  _prim(s, px, py, pz, R) {
    switch (s.type) {
      case 'box': return this._box(s, px, py, pz, R);
      case 'cyl': return this._cyl(s, px, py, pz, R);
      case 'sph': return this._sph(s, px, py, pz, R);
      default: return this._cap(s, px, py, pz, R);
    }
  }

  _cupRim(px, py, pz, R) {
    const c = this.cup;
    const dx = px - c.x, dz = pz - c.z;
    const dd = dx * dx + dz * dz;
    const h = py - c.y;
    if (dd > (CUP_R + R) * (CUP_R + R) || h > R || h < -CUP_DEPTH - R) return 0;
    const d = Math.sqrt(dd);
    if (d < 1e-7) return 0;
    const ux = dx / d, uz = dz / d;
    const qx = c.x + ux * CUP_R, qz = c.z + uz * CUP_R;
    const qy = c.y + clamp(h, -CUP_DEPTH, 0);
    oQx = qx; oQy = qy; oQz = qz;
    if (d > CUP_R) {
      if (h >= 0) return 0; // over the floor: the floor handles it
      // centre squeezed under the floor outside the cup: push back inside
      oNx = -ux; oNy = 0; oNz = -uz;
      return R + (d - CUP_R);
    }
    const ex = px - qx, ey = py - qy, ez = pz - qz;
    const e2 = ex * ex + ey * ey + ez * ez;
    if (e2 >= R * R) return 0;
    const e = Math.sqrt(e2);
    if (e < 1e-9) return 0;
    oNx = ex / e; oNy = ey / e; oNz = ez / e;
    return R - e;
  }

  _cupBottom(px, py, pz, R) {
    const c = this.cup;
    const dx = px - c.x, dz = pz - c.z;
    if (dx * dx + dz * dz > CUP_R * CUP_R) return 0;
    const floor = c.y - CUP_DEPTH;
    if (py - R >= floor || py < floor - 0.5) return 0;
    oNx = 0; oNy = 1; oNz = 0;
    oQx = px; oQy = floor; oQz = pz;
    return floor + R - py;
  }

  /** True if a sphere at the given point overlaps solid static geometry. */
  overlaps(px, py, pz, R) {
    this._gather(px, pz, R + 0.05);
    const T = this.candT, S = this.candS;
    for (let i = 0; i < T.length; i++) {
      if (this.triMat[T[i]].hazard) continue;
      if (this._tri(T[i], px, py, pz, R) > 0) return true;
    }
    for (let i = 0; i < S.length; i++) if (this._prim(S[i], px, py, pz, R) > 0) return true;
    return false;
  }

  /** Highest walkable surface below (x, yTop, z). Returns null if none. */
  groundAt(x, z, yTop = 50, yMin = -50) {
    this._gather(x, z, 0.05);
    const T = this.candT, P = this.triP, N = this.triN;
    let best = null;
    for (let k = 0; k < T.length; k++) {
      const i = T[k];
      const ny = N[i * 3 + 1];
      if (ny < 0.2) continue;
      const o = i * 9;
      const ax = P[o], az = P[o + 2], bx = P[o + 3], bz = P[o + 5], cx = P[o + 6], cz = P[o + 8];
      const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(d) < 1e-12) continue;
      const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d;
      const v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d;
      const w = 1 - u - v;
      if (u < -1e-6 || v < -1e-6 || w < -1e-6) continue;
      const y = u * P[o + 1] + v * P[o + 4] + w * P[o + 7];
      if (y > yTop || y < yMin) continue;
      if (!best || y > best.y) best = { y, mat: this.triMat[i], ny };
    }
    const S = this.candS;
    for (let k = 0; k < S.length; k++) {
      const s = S[k];
      if (s.type === 'cyl') {
        const dx = x - s.x, dz = z - s.z;
        if (dx * dx + dz * dz <= s.r * s.r && s.y1 <= yTop && (!best || s.y1 > best.y)) best = { y: s.y1, mat: s.mat, ny: 1 };
      } else if (s.type === 'box' && Math.abs(s.m[4]) > 0.99) {
        const dx = x - s.c[0], dz = z - s.c[2];
        const lx = dx * s.m[0] + dz * s.m[2], lz = dx * s.m[6] + dz * s.m[8];
        const y = s.c[1] + s.h[1];
        if (Math.abs(lx) <= s.h[0] && Math.abs(lz) <= s.h[2] && y <= yTop && (!best || y > best.y)) best = { y, mat: s.mat, ny: 1 };
      }
    }
    return best;
  }

  // ---------------------------------------------------------------- stepping
  step(ball, dt = FIXED_DT) {
    this.time += dt;
    const bodies = this.bodies;
    for (let i = 0; i < bodies.length; i++) bodies[i].update(this.time);

    ball.ox = ball.px; ball.oy = ball.py; ball.oz = ball.pz;
    if (ball.hazard) return;

    // Numerical safety: if anything ever blows up to NaN/Infinity, stop the ball
    // rather than silently soft-locking (n = ceil(NaN) would skip integration).
    if (!Number.isFinite(ball.px + ball.py + ball.pz + ball.vx + ball.vy + ball.vz)) {
      ball.vx = ball.vy = ball.vz = 0;
      ball.stopped = true;
      return;
    }

    if (ball.rider) {
      const b = ball.rider.body, l = ball.rider.l;
      const e = b.mat.elements;
      ball.px = e[0] * l[0] + e[4] * l[1] + e[8] * l[2] + e[12];
      ball.py = e[1] * l[0] + e[5] * l[1] + e[9] * l[2] + e[13];
      ball.pz = e[2] * l[0] + e[6] * l[1] + e[10] * l[2] + e[14];
      b.velAt(ball.px, ball.py, ball.pz, dt);
      ball.gsx = oVx; ball.gsy = oVy; ball.gsz = oVz;
      ball.vx = ball.vy = ball.vz = 0;
      // A rider skips the per-substep hazard/killY tests, so a support that
      // carries it below the kill plane would otherwise freeze it out of bounds.
      if (ball.py < this.killY && !ball.holed) {
        ball.rider = null;
        ball.hazard = this.killType;
        this.events.push({ type: 'hazard', kind: this.killType, x: ball.px, y: ball.py, z: ball.pz });
        return;
      }
      this._wakeCheck(ball, dt, b);
      return;
    }
    if (ball.stopped) {
      this._wakeCheck(ball, dt, null);
      if (ball.stopped) return;
    }

    ball.moveTime += dt;
    if (ball.portalCd > 0) ball.portalCd -= dt;
    if (ball.boostCd > 0) ball.boostCd -= dt;

    const sp = Math.hypot(ball.vx, ball.vy, ball.vz) + this.gravity * dt;
    const n = clamp(Math.ceil((sp * dt) / (BALL_R * 0.3)), 1, 24);
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      this._substep(ball, h, dt);
      if (ball.hazard) return;
    }

    // rest detection
    if (ball.grounded) {
      const rx = ball.vx - ball.gsx, ry = ball.vy - ball.gsy, rz = ball.vz - ball.gsz;
      const rel = Math.hypot(rx, ry, rz);
      if (rel < 0.075) ball.rest += dt; else ball.rest = 0;
      if (ball.rest > 0.38) {
        if (ball.gMat.conveyor && !ball.holed) {
          ball.rest = 0;
        } else if (ball.gBody && !ball.holed) {
          const l = [0, 0, 0];
          ball.gBody.toLocal(ball.px, ball.py, ball.pz, l);
          ball.rider = { body: ball.gBody, l };
          ball.vx = ball.vy = ball.vz = 0;
          ball.stopped = true;
        } else {
          ball.vx = ball.vy = ball.vz = 0;
          ball.stopped = true;
        }
      }
    } else {
      ball.rest = 0;
    }
  }

  /** A sleeping ball is woken up when a moving obstacle touches it. */
  _wakeCheck(ball, dt, ignoreBody) {
    const bodies = this.bodies;
    const R = BALL_R;
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (b === ignoreBody || !b.enabled) continue;
      const dx = ball.px - b.wx, dy = ball.py - b.wy, dz = ball.pz - b.wz;
      const rr = b.br + R + 0.02;
      if (dx * dx + dy * dy + dz * dz > rr * rr) continue;
      for (let k = 0; k < b.shapes.length; k++) {
        if (this._prim(b.shapes[k], ball.px, ball.py, ball.pz, R) > 0.002) {
          if (ball.rider) {
            ball.vx = ball.gsx; ball.vy = ball.gsy; ball.vz = ball.gsz;
            ball.rider = null;
          }
          ball.stopped = false; ball.rest = 0; ball.moveTime = 0;
          this.events.push({ type: 'wake' });
          return;
        }
      }
    }
  }

  _substep(ball, h, dt) {
    const R = BALL_R;
    ball.vy -= this.gravity * h;
    ball.px += ball.vx * h; ball.py += ball.vy * h; ball.pz += ball.vz * h;

    const trg = this.triggers;
    for (let i = 0; i < trg.length; i++) {
      const t = trg[i];
      if (t.type === 'force' && inRegion(t, ball)) {
        ball.vx += t.ax * h; ball.vy += t.ay * h; ball.vz += t.az * h;
      }
    }

    this._collide(ball, dt);
    if (ball.hazard) return;

    // rolling friction
    if (ball.grounded) {
      const mat = ball.gMat;
      const mu = mat.mu === undefined ? 1 : mat.mu;
      const nx = ball.gnx, ny = ball.gny, nz = ball.gnz;
      const rx = ball.vx - ball.gsx, ry = ball.vy - ball.gsy, rz = ball.vz - ball.gsz;
      const vn = rx * nx + ry * ny + rz * nz;
      let tx = rx - nx * vn, ty = ry - ny * vn, tz = rz - nz * vn;
      const st = Math.hypot(tx, ty, tz);
      const dec = (this.rollA * mu + this.rollK * st * Math.min(mu, 1.6)) * h;
      if (st <= dec) { tx = ty = tz = 0; } else { const k = 1 - dec / st; tx *= k; ty *= k; tz *= k; }
      ball.vx = ball.gsx + tx + nx * vn;
      ball.vy = ball.gsy + ty + ny * vn;
      ball.vz = ball.gsz + tz + nz * vn;
      ball.air = 0;
    } else {
      ball.air += h;
    }

    for (let i = 0; i < trg.length; i++) {
      const t = trg[i];
      if (t.type === 'portal') {
        if (ball.portalCd > 0 || t.disabled) continue;
        const dx = ball.px - t.c[0], dy = ball.py - t.c[1], dz = ball.pz - t.c[2];
        if (dx * dx + dy * dy + dz * dz < t.r * t.r) {
          const sp = clamp(Math.hypot(ball.vx, ball.vz), t.minSpeed || 1.5, t.maxSpeed || 8);
          const from = [ball.px, ball.py, ball.pz];
          ball.px = t.to[0]; ball.py = t.to[1]; ball.pz = t.to[2];
          ball.vx = t.dir[0] * sp; ball.vy = 0; ball.vz = t.dir[1] * sp;
          ball.portalCd = 0.6; ball.grounded = false; ball.rest = 0;
          ball.teleported = true;
          this.events.push({ type: 'portal', from, to: t.to.slice(), id: t.id });
        }
      } else if (t.type === 'boost') {
        if (!ball.grounded) continue;
        if (!inRegion(t, ball)) continue;
        const along = ball.vx * t.dir[0] + ball.vy * t.dir[1] + ball.vz * t.dir[2];
        const sp = Math.max(along, t.speed);
        ball.vx = t.dir[0] * sp; ball.vy = t.dir[1] * sp; ball.vz = t.dir[2] * sp;
        if (ball.boostCd <= 0) this.events.push({ type: 'boost', x: ball.px, y: ball.py, z: ball.pz });
        ball.boostCd = 0.25;
      }
    }

    const c = this.cup;
    if (c && !ball.holed) {
      const dx = ball.px - c.x, dz = ball.pz - c.z;
      if (dx * dx + dz * dz < CUP_R * CUP_R && ball.py < c.y - R * 0.55 && ball.py > c.y - CUP_DEPTH - R) {
        ball.holed = true;
        this.events.push({ type: 'holed', x: c.x, y: c.y, z: c.z });
      }
    }
    if (ball.py < this.killY && !ball.holed) {
      ball.hazard = this.killType;
      this.events.push({ type: 'hazard', kind: this.killType, x: ball.px, y: ball.py, z: ball.pz });
    }
  }

  _collide(ball, dt) {
    const R = BALL_R;
    this._gather(ball.px, ball.pz, R + 0.12);
    const T = this.candT, S = this.candS;
    const bodies = this.bodies;
    const cup = this.cup;
    ball.grounded = false;
    ball.gBody = null;
    ball.gsx = ball.gsy = ball.gsz = 0;

    for (let iter = 0; iter < 10; iter++) {
      const staticOnly = iter >= 7;
      const px = ball.px, py = ball.py, pz = ball.pz;
      let bd = 1e-5, bnx = 0, bny = 0, bnz = 0, bqx = 0, bqy = 0, bqz = 0;
      let bmat = null, bbody = null, bspin = null;
      for (let k = 0; k < T.length; k++) {
        const i = T[k];
        const d = this._tri(i, px, py, pz, R);
        if (d <= bd) continue;
        if (cup && Math.abs(oQy - cup.y) < 0.08) {
          const ex = oQx - cup.x, ez = oQz - cup.z;
          if (ex * ex + ez * ez < CUP_R * CUP_R) continue;
        }
        bd = d; bnx = oNx; bny = oNy; bnz = oNz; bqx = oQx; bqy = oQy; bqz = oQz;
        bmat = this.triMat[i]; bbody = null; bspin = null;
      }
      for (let k = 0; k < S.length; k++) {
        const s = S[k];
        const d = this._prim(s, px, py, pz, R);
        if (d <= bd) continue;
        bd = d; bnx = oNx; bny = oNy; bnz = oNz; bqx = oQx; bqy = oQy; bqz = oQz;
        bmat = s.mat; bbody = null; bspin = s.spin ? s : null;
      }
      if (cup) {
        let d = this._cupRim(px, py, pz, R);
        if (d > bd) {
          bd = d; bnx = oNx; bny = oNy; bnz = oNz; bqx = oQx; bqy = oQy; bqz = oQz;
          bmat = MAT.cup; bbody = null; bspin = null;
        }
        d = this._cupBottom(px, py, pz, R);
        if (d > bd) {
          bd = d; bnx = oNx; bny = oNy; bnz = oNz; bqx = oQx; bqy = oQy; bqz = oQz;
          bmat = MAT.cup; bbody = null; bspin = null;
        }
      }
      if (!staticOnly) {
        for (let b = 0; b < bodies.length; b++) {
          const body = bodies[b];
          if (!body.enabled) continue;
          const dx = px - body.wx, dy = py - body.wy, dz = pz - body.wz;
          const rr = body.br + R + 0.05;
          if (dx * dx + dy * dy + dz * dz > rr * rr) continue;
          const sh = body.shapes;
          for (let k = 0; k < sh.length; k++) {
            const d = this._prim(sh[k], px, py, pz, R);
            if (d <= bd) continue;
            bd = d; bnx = oNx; bny = oNy; bnz = oNz; bqx = oQx; bqy = oQy; bqz = oQz;
            bmat = sh[k].mat; bbody = body; bspin = null;
          }
        }
      }
      if (!bmat) break;
      this._resolve(ball, bd, bnx, bny, bnz, bqx, bqy, bqz, bmat, bbody, bspin, dt);
      if (ball.hazard) return;
    }
  }

  _resolve(ball, depth, nx, ny, nz, qx, qy, qz, mat, body, spin, dt) {
    if (mat.hazard) {
      ball.hazard = mat.hazard;
      this.events.push({ type: 'hazard', kind: mat.hazard, x: ball.px, y: qy, z: ball.pz });
      return;
    }
    ball.px += nx * depth; ball.py += ny * depth; ball.pz += nz * depth;
    let sx = 0, sy = 0, sz = 0;
    if (body) {
      body.velAt(qx, qy, qz, dt); sx = oVx; sy = oVy; sz = oVz;
    } else if (mat.vel) {
      sx = mat.vel[0]; sy = mat.vel[1]; sz = mat.vel[2];
    } else if (spin) {
      const dx = qx - spin.x, dz = qz - spin.z;
      sx = spin.spin * dz; sz = -spin.spin * dx;
    }
    const rx = ball.vx - sx, ry = ball.vy - sy, rz = ball.vz - sz;
    const vn = rx * nx + ry * ny + rz * nz;
    const ground = ny > 0.6;
    if (vn < 0) {
      const sn = -vn;
      let e = mat.e || 0;
      if (ground && !mat.kick) {
        if (ball.air < 0.06 ? sn < 4.5 : sn < 1.3) e = 0;
      } else if (sn < 0.35) e = 0;
      let j = (1 + e) * sn;
      if (mat.kick && sn > 0.25) {
        const out = e * sn;
        if (out < mat.kick) j += mat.kick - out;
        this.events.push({ type: 'bumper', x: qx, y: qy, z: qz, v: sn, id: mat.id });
      }
      ball.vx += nx * j; ball.vy += ny * j; ball.vz += nz * j;
      if (e > 0) {
        // a little tangential loss on hard impacts
        const tx = rx + nx * sn, ty = ry + ny * sn, tz = rz + nz * sn;
        const tl = Math.hypot(tx, ty, tz);
        if (tl > 1e-6) {
          const f = Math.min(0.05 * j, tl) / tl;
          ball.vx -= tx * f; ball.vy -= ty * f; ball.vz -= tz * f;
        }
      }
      if (sn > 0.7 && !mat.kick) {
        this.events.push({ type: 'hit', v: sn, snd: mat.snd, ground, x: qx, y: qy, z: qz, kin: !!body });
      }
    }
    if (ground) {
      ball.grounded = true;
      ball.gnx = nx; ball.gny = ny; ball.gnz = nz;
      ball.gMat = mat; ball.gBody = body;
      ball.gsx = sx; ball.gsy = sy; ball.gsz = sz;
    }
  }

  /** Launch the ball. dir is a unit vector on the XZ plane. */
  shoot(ball, dirX, dirZ, speed) {
    let bx = 0, by = 0, bz = 0;
    if (ball.rider) { bx = ball.gsx; by = ball.gsy; bz = ball.gsz; ball.rider = null; }
    // keep the shot tangent to the ground the ball rests on
    const nx = ball.gnx, ny = ball.gny, nz = ball.gnz;
    let dx = dirX, dy = 0, dz = dirZ;
    const dn = dx * nx + dy * ny + dz * nz;
    dx -= nx * dn; dy -= ny * dn; dz -= nz * dn;
    const l = Math.hypot(dx, dy, dz) || 1;
    ball.vx = bx + (dx / l) * speed; ball.vy = by + (dy / l) * speed; ball.vz = bz + (dz / l) * speed;
    ball.stopped = false; ball.rest = 0; ball.moveTime = 0; ball.air = 0;
  }
}

function inRegion(t, ball) {
  if (ball.py < t.y0 || ball.py > t.y1) return false;
  const dx = ball.px - t.cx, dz = ball.pz - t.cz;
  const lf = dx * t.fx + dz * t.fz;
  const lr = dx * t.fz - dz * t.fx;
  return Math.abs(lf) <= t.hf && Math.abs(lr) <= t.hr;
}

/** Region helper for triggers: oriented rectangle on the XZ plane. */
export function region(cx, cz, halfForward, halfRight, fx, fz, y0, y1) {
  const l = Math.hypot(fx, fz) || 1;
  return { cx, cz, hf: halfForward, hr: halfRight, fx: fx / l, fz: fz / l, y0, y1 };
}
