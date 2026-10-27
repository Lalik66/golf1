// CourseBuilder: every hole is described with these primitives. Each primitive
// creates the physics colliders and (when visual === true) the matching meshes.
import * as THREE from 'three';
import { World, MAT, BALL_R, CUP_R, CUP_DEPTH, region } from './physics.js';
import { MeshBuf, part, merge, box, cyl, sph, ring, torus, circle, rockGeo, matrix } from './geo.js';
import { toonMat, glowMat, PATTERN, LAYER_FX, U } from './materials.js';
import {
  makeWaterMaterial, makeLavaMaterial, makeBeltMaterial, makePortalMaterial, makeFlagMaterial, makeGrassMaterial,
} from './shaders.js';
import { mulberry32, signedArea, pointInPoly, distToPoly, rectPoly, fbm2, smoothstep, TAU } from './utils.js';

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _ex = new THREE.Vector3(), _ey = new THREE.Vector3(), _ez = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export const DEFAULT_THEME = {
  skyTop: 0x2f8cff, skyHorizon: 0xbfe6ff, skyBottom: 0x8ed0a0,
  sunDir: [0.45, 0.8, 0.35], sunColor: 0xfff4dd, sunIntensity: 2.4,
  hemiSky: 0xcfe8ff, hemiGround: 0x6f9a5a, hemiIntensity: 1.25,
  fog: 0xcfeaff, fogDensity: 0.006,
  outline: 0x1d1838, bloom: 0.4, bloomThreshold: 0.92,
  clouds: 0.9, cloudCut: 0.52, stars: 0, aurora: 0, nebula: 0, wind: 1,
  ambient: 'meadow',
};

export class CourseBuilder {
  constructor({ visual = true, seed = 7 } = {}) {
    this.visual = visual;
    this.world = new World();
    this.root = visual ? new THREE.Group() : null;
    this.batches = new Map();
    this.anims = [];
    this.kin = [];
    this.footprints = [];
    this.rng = mulberry32(seed);
    this.floorThick = 0.5;
    this.wallColor = 0xb5793f;
    this.wallCap = 0xe0a868;
    this.wallMat = MAT.wood;
    this.wallH = 0.45;
    this.wallT = 0.3;
    this.terrainFn = null;
    this.emitters = [];
    this.lights = [];
    this.info = {
      name: 'Hole', par: 3, tee: [0, 0, 0], cup: [0, 0, -10], path: [], camZones: [],
      theme: { ...DEFAULT_THEME }, hint: '', flyover: null, startYaw: null,
    };
    this.flag = null;
    this.sounds = [];
  }

  // ------------------------------------------------------------ basics
  theme(t) { Object.assign(this.info.theme, t); return this; }

  meta(o) { Object.assign(this.info, o); return this; }

  /** Runs only when visuals are being built. */
  decor(fn) { if (this.visual) fn(this); return this; }

  anim(fn) { if (this.visual) this.anims.push(fn); return this; }

  add(obj) { if (this.visual) this.root.add(obj); return obj; }

  /** Adds painted geometry to a merged static batch. */
  put(geo, kind = 'toon') {
    if (!this.visual || !geo) return;
    let b = this.batches.get(kind);
    if (!b) { b = []; this.batches.set(kind, b); }
    b.push(geo);
  }

  /** Places a prop geometry (built around its own origin) into a batch. */
  prop(geo, x, y, z, rotY = 0, s = 1, kind = 'toon') {
    if (!this.visual || !geo) return;
    const g = geo.clone();
    g.applyMatrix4(matrix([x, y, z], [0, rotY, 0], s));
    this.put(g, kind);
  }

  _floorKind(o) {
    const pattern = o.pattern === undefined ? PATTERN.checker : o.pattern;
    return `floor:${pattern}:${o.glowColor === undefined ? 0xffffff : o.glowColor}`;
  }

  // ------------------------------------------------------------ floors
  /**
   * Flat polygon floor. pts = [[x, z], ...]
   * o: mat, color, pattern, thick, holes [[...]], side (skirt colour), phys (false = visual only)
   */
  floor(pts, y = 0, o = {}) {
    const mat = o.mat || MAT.green;
    const holes = o.holes || [];
    let contour = pts.map((p) => new THREE.Vector2(p[0], p[1]));
    if (!THREE.ShapeUtils.isClockWise(contour)) contour = contour.slice().reverse();
    const hv = holes.map((h) => {
      let v = h.map((p) => new THREE.Vector2(p[0], p[1]));
      if (THREE.ShapeUtils.isClockWise(v)) v = v.slice().reverse();
      return v;
    });
    const faces = THREE.ShapeUtils.triangulateShape(contour, hv);
    const all = contour.concat(...hv);
    if (o.phys !== false) {
      for (const f of faces) {
        const a = all[f[0]], b = all[f[1]], c = all[f[2]];
        this.world.addTriUp([a.x, y, a.y], [b.x, y, b.y], [c.x, y, c.y], mat);
      }
    }
    if (o.footprint !== false) this.footprints.push({ pts, holes, y });
    if (this.visual && o.visual !== false) {
      const thick = o.thick === undefined ? this.floorThick : o.thick;
      const top = new MeshBuf();
      for (const f of faces) {
        const a = all[f[0]], b = all[f[1]], c = all[f[2]];
        top.tri([a.x, y, a.y], [b.x, y, b.y], [c.x, y, c.y], [0, 1, 0]);
      }
      this.put(part(top.toGeometry(), o.color === undefined ? 0x54c05a : o.color), this._floorKind(o));
      if (thick > 0) {
        const side = new MeshBuf();
        const skirt = (poly, outward) => {
          const sg = signedArea(poly) > 0 ? 1 : -1;
          for (let i = 0; i < poly.length; i++) {
            const p = poly[i], q = poly[(i + 1) % poly.length];
            const dx = q[0] - p[0], dz = q[1] - p[1];
            const l = Math.hypot(dx, dz) || 1;
            const nx = (dz / l) * sg * outward, nz = (-dx / l) * sg * outward;
            side.quad([p[0], y, p[1]], [q[0], y, q[1]], [q[0], y - thick, q[1]], [p[0], y - thick, p[1]], [nx, 0, nz]);
          }
        };
        skirt(pts, 1);
        for (const h of holes) skirt(h, -1);
        this.put(part(side.toGeometry(), o.side === undefined ? 0x8a6a4a : o.side), 'toon');
      }
    }
    return this;
  }

  rect(x0, z0, x1, z1, y = 0, o = {}) { return this.floor(rectPoly(x0, z0, x1, z1), y, o); }

  /**
   * Sloped quad given by 4 corners [x,y,z] in order around the quad.
   */
  ramp(p0, p1, p2, p3, o = {}) {
    const mat = o.mat || MAT.green;
    if (o.phys !== false) this.world.addQuadUp(p0, p1, p2, p3, mat, [0, 1, 0]);
    if (o.footprint !== false) this.footprints.push({ pts: [[p0[0], p0[2]], [p1[0], p1[2]], [p2[0], p2[2]], [p3[0], p3[2]]], holes: [], y: Math.min(p0[1], p1[1], p2[1], p3[1]) });
    if (this.visual) {
      const top = new MeshBuf();
      top.quad(p0, p1, p2, p3, [0, 1, 0]);
      this.put(part(top.toGeometry(), o.color === undefined ? 0x54c05a : o.color), this._floorKind(o));
      const base = o.base === undefined ? Math.min(p0[1], p1[1], p2[1], p3[1]) - this.floorThick : o.base;
      const side = new MeshBuf();
      const c = [(p0[0] + p1[0] + p2[0] + p3[0]) / 4, 0, (p0[2] + p1[2] + p2[2] + p3[2]) / 4];
      const ps = [p0, p1, p2, p3];
      for (let i = 0; i < 4; i++) {
        const a = ps[i], b = ps[(i + 1) % 4];
        const mx = (a[0] + b[0]) / 2 - c[0], mz = (a[2] + b[2]) / 2 - c[2];
        side.quad(a, b, [b[0], base, b[2]], [a[0], base, a[2]], [mx, 0, mz]);
      }
      this.put(part(side.toGeometry(), o.side === undefined ? 0x8a6a4a : o.side), 'toon');
    }
    return this;
  }

  /**
   * Height-field floor on a regular grid. fn(x, z) -> y. mask(x, z) -> bool (optional, per cell centre)
   */
  height(x0, z0, x1, z1, nx, nz, fn, o = {}) {
    const mat = o.mat || MAT.green;
    const ax = Math.min(x0, x1), bx = Math.max(x0, x1), az = Math.min(z0, z1), bz = Math.max(z0, z1);
    const dx = (bx - ax) / nx, dz = (bz - az) / nz;
    const P = (i, j) => { const x = ax + i * dx, z = az + j * dz; return [x, fn(x, z), z]; };
    const N = (i, j) => {
      const x = ax + i * dx, z = az + j * dz, e = 0.05;
      const gx = (fn(x + e, z) - fn(x - e, z)) / (2 * e), gz = (fn(x, z + e) - fn(x, z - e)) / (2 * e);
      const l = Math.hypot(gx, 1, gz);
      return [-gx / l, 1 / l, -gz / l];
    };
    const top = this.visual ? new MeshBuf() : null;
    const side = this.visual ? new MeshBuf() : null;
    const thick = o.thick === undefined ? this.floorThick : o.thick;
    const baseY = o.base;
    const has = (i, j) => i >= 0 && j >= 0 && i < nx && j < nz && (!o.mask || o.mask(ax + (i + 0.5) * dx, az + (j + 0.5) * dz));
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        if (!has(i, j)) continue;
        const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1);
        // choose the diagonal that gives the flatter pair of triangles
        const alt = Math.abs(a[1] - c[1]) > Math.abs(b[1] - d[1]);
        if (o.phys !== false) {
          if (alt) { this.world.addTriUp(a, b, d, mat); this.world.addTriUp(b, c, d, mat); } else { this.world.addTriUp(a, b, c, mat); this.world.addTriUp(a, c, d, mat); }
        }
        if (top) {
          const na = N(i, j), nb = N(i + 1, j), nc = N(i + 1, j + 1), nd = N(i, j + 1);
          if (alt) { top.triN(a, b, d, na, nb, nd); top.triN(b, c, d, nb, nc, nd); } else { top.triN(a, b, c, na, nb, nc); top.triN(a, c, d, na, nc, nd); }
          if (thick > 0 || baseY !== undefined) {
            const lo = (p) => [p[0], baseY === undefined ? p[1] - thick : baseY, p[2]];
            if (!has(i - 1, j)) side.quad(a, d, lo(d), lo(a), [-1, 0, 0]);
            if (!has(i + 1, j)) side.quad(b, c, lo(c), lo(b), [1, 0, 0]);
            if (!has(i, j - 1)) side.quad(a, b, lo(b), lo(a), [0, 0, -1]);
            if (!has(i, j + 1)) side.quad(d, c, lo(c), lo(d), [0, 0, 1]);
          }
        }
      }
    }
    if (o.footprint !== false) this.footprints.push({ pts: rectPoly(ax, az, bx, bz), holes: [], y: 0 });
    if (this.visual) {
      this.put(part(top.toGeometry(), o.color === undefined ? 0x54c05a : o.color), this._floorKind(o));
      if (side.count) this.put(part(side.toGeometry(), o.side === undefined ? 0x8a6a4a : o.side), 'toon');
    }
    return this;
  }

  /**
   * Height field on a polar grid (clean circular edge).
   * radii: increasing list of ring radii (first > 0); fn(r, a, x, z) -> y
   * o.cell(rMid, aMid) may return { mat, skip } to override single cells (lava streams...)
   */
  radial(cx, cz, radii, segs, fn, o = {}) {
    const mat = o.mat || MAT.green;
    const top = this.visual ? new MeshBuf() : null;
    const side = this.visual ? new MeshBuf() : null;
    const special = this.visual ? new MeshBuf() : null;
    const thick = o.thick === undefined ? this.floorThick : o.thick;
    const P = (r, j) => {
      const a = (j / segs) * TAU;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      return [x, fn(r, a, x, z), z];
    };
    const N = (r, j) => {
      const a = (j / segs) * TAU;
      const e = 0.04;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      const h = (xx, zz) => { const rr = Math.hypot(xx - cx, zz - cz); return fn(rr, Math.atan2(zz - cz, xx - cx), xx, zz); };
      const gx = (h(x + e, z) - h(x - e, z)) / (2 * e), gz = (h(x, z + e) - h(x, z - e)) / (2 * e);
      const l = Math.hypot(gx, 1, gz);
      return [-gx / l, 1 / l, -gz / l];
    };
    const centre = [cx, fn(0, 0, cx, cz), cz];
    for (let j = 0; j < segs; j++) {
      const a = P(radii[0], j), b = P(radii[0], j + 1);
      this.world.addTriUp(centre, a, b, mat);
      if (top) top.triN(centre, a, b, [0, 1, 0], N(radii[0], j), N(radii[0], j + 1));
    }
    for (let i = 0; i < radii.length - 1; i++) {
      const r0 = radii[i], r1 = radii[i + 1];
      for (let j = 0; j < segs; j++) {
        const a = P(r0, j), b = P(r1, j), c = P(r1, j + 1), d = P(r0, j + 1);
        const ov = o.cell ? o.cell((r0 + r1) / 2, ((j + 0.5) / segs) * TAU) : null;
        const m = ov && ov.mat ? ov.mat : mat;
        this.world.addTriUp(a, b, c, m);
        this.world.addTriUp(a, c, d, m);
        if (top) {
          if (ov && ov.mat) {
            const up = (p) => [p[0], p[1] + 0.012, p[2]];
            special.quadN(up(a), up(b), up(c), up(d), N(r0, j), N(r1, j), N(r1, j + 1), N(r0, j + 1));
          }
          top.quadN(a, b, c, d, N(r0, j), N(r1, j), N(r1, j + 1), N(r0, j + 1));
        }
      }
    }
    const R = radii[radii.length - 1];
    const ring = [];
    for (let j = 0; j < segs; j++) { const a = (j / segs) * TAU; ring.push([cx + Math.cos(a) * R, cz + Math.sin(a) * R]); }
    if (o.footprint !== false) this.footprints.push({ pts: ring, holes: [], y: 0 });
    if (this.visual) {
      for (let j = 0; j < segs; j++) {
        const a = P(R, j), b = P(R, j + 1);
        const am = ((j + 0.5) / segs) * TAU;
        side.quad(a, b, [b[0], b[1] - thick, b[2]], [a[0], a[1] - thick, a[2]], [Math.cos(am), 0, Math.sin(am)]);
      }
      const g = top.toGeometry();
      if (o.colorFn) {
        const pos = g.attributes.position;
        const col = new Float32Array(pos.count * 3);
        const c = new THREE.Color();
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i), z = pos.getZ(i);
          c.set(o.colorFn(Math.hypot(x - cx, z - cz), pos.getY(i), x, z));
          col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
        }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        this.put(g, this._floorKind(o));
      } else {
        this.put(part(g, o.color === undefined ? 0x54c05a : o.color), this._floorKind(o));
      }
      this.put(part(side.toGeometry(), o.side === undefined ? 0x8a6a4a : o.side), 'toon');
      if (special.count && o.specialMaterial) {
        const mesh = new THREE.Mesh(special.toGeometry(), o.specialMaterial);
        mesh.layers.set(LAYER_FX);
        this.root.add(mesh);
      }
    }
    return ring;
  }

  /**
   * Ribbon track swept along samples [{p:[x,y,z], up?:[x,y,z], w?:number}].
   * o: width, segs, profile(u) -> height offset (u in -1..1), wallL, wallR, wallT, mat, wallMat,
   *    color, wallColor, thick
   */
  track(samples, o = {}) {
    const mat = o.mat || MAT.green;
    const wallMat = o.wallMat || this.wallMat;
    const n = samples.length;
    const m = o.segs || 6;
    const width = o.width || 2;
    const profile = o.profile || (() => 0);
    const thick = o.thick === undefined ? 0.25 : o.thick;
    const wallL = o.wallL === undefined ? 0.45 : o.wallL;
    const wallR = o.wallR === undefined ? 0.45 : o.wallR;
    const wallT = o.wallT === undefined ? 0.18 : o.wallT;
    const frames = [];
    const T = new THREE.Vector3(), Uv = new THREE.Vector3(), S = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const a = samples[Math.max(0, i - 1)].p, b = samples[Math.min(n - 1, i + 1)].p;
      T.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
      const up = samples[i].up;
      if (up) Uv.set(up[0], up[1], up[2]); else Uv.set(0, 1, 0);
      S.crossVectors(T, Uv).normalize();
      Uv.crossVectors(S, T).normalize();
      const w = (samples[i].w || width) / 2;
      const p = samples[i].p;
      const row = [];
      for (let j = 0; j <= m; j++) {
        const u = -1 + (2 * j) / m;
        const h = profile(u, i / (n - 1));
        const e = 0.01;
        const dh = (profile(Math.min(1, u + e), i / (n - 1)) - profile(Math.max(-1, u - e), i / (n - 1))) / (2 * e * w);
        const nl = Math.hypot(1, dh);
        row.push({
          p: [p[0] + S.x * u * w + Uv.x * h, p[1] + S.y * u * w + Uv.y * h, p[2] + S.z * u * w + Uv.z * h],
          n: [(Uv.x - S.x * dh) / nl, (Uv.y - S.y * dh) / nl, (Uv.z - S.z * dh) / nl],
        });
      }
      frames.push({ row, S: [S.x, S.y, S.z], U: [Uv.x, Uv.y, Uv.z], T: [T.x, T.y, T.z] });
    }
    const top = this.visual ? new MeshBuf() : null;
    const solid = this.visual ? new MeshBuf() : null;
    const wallV = this.visual ? new MeshBuf() : null;
    const off = (p, v, k) => [p[0] + v[0] * k, p[1] + v[1] * k, p[2] + v[2] * k];
    const neg = (v) => [-v[0], -v[1], -v[2]];
    for (let i = 0; i < n - 1; i++) {
      const f0 = frames[i], f1 = frames[i + 1];
      for (let j = 0; j < m; j++) {
        const A = f0.row[j], B = f0.row[j + 1], C = f1.row[j + 1], D = f1.row[j];
        this.world.addQuadUp(A.p, B.p, C.p, D.p, mat, f0.U);
        if (top) {
          top.quadN(A.p, B.p, C.p, D.p, A.n, B.n, C.n, D.n);
          solid.quad(off(A.p, f0.U, -thick), off(B.p, f0.U, -thick), off(C.p, f1.U, -thick), off(D.p, f1.U, -thick), neg(f0.U));
        }
      }
      // edges: j = 0 is the left side (-S), j = m the right side (+S)
      for (const sideIdx of [0, 1]) {
        const h = sideIdx === 0 ? wallL : wallR;
        const sg = sideIdx === 0 ? -1 : 1;
        const j = sideIdx === 0 ? 0 : m;
        const E0 = f0.row[j].p, E1 = f1.row[j].p;
        const S0 = [f0.S[0] * sg, f0.S[1] * sg, f0.S[2] * sg], S1 = [f1.S[0] * sg, f1.S[1] * sg, f1.S[2] * sg];
        if (h > 0) {
          const I0 = off(E0, f0.U, h), I1 = off(E1, f1.U, h);
          const O0 = off(I0, S0, wallT), O1 = off(I1, S1, wallT);
          this.world.addQuadUp(E0, E1, I1, I0, wallMat, neg(S0));
          this.world.addQuadUp(I0, I1, O1, O0, wallMat, f0.U);
          if (wallV) {
            wallV.quad(E0, E1, I1, I0, neg(S0));
            wallV.quad(I0, I1, O1, O0, f0.U);
            wallV.quad(O0, O1, off(off(E1, S1, wallT), f1.U, -thick), off(off(E0, S0, wallT), f0.U, -thick), S0);
          }
        } else if (solid) {
          solid.quad(E0, E1, off(E1, f1.U, -thick), off(E0, f0.U, -thick), S0);
        }
      }
    }
    if (this.visual) {
      // end caps
      for (const [fi, sgn] of [[0, -1], [n - 1, 1]]) {
        const f = frames[fi];
        const tn = [f.T[0] * sgn, f.T[1] * sgn, f.T[2] * sgn];
        for (let j = 0; j < m; j++) {
          const A = f.row[j].p, B = f.row[j + 1].p;
          solid.quad(A, B, off(B, f.U, -thick), off(A, f.U, -thick), tn);
        }
      }
      this.put(part(top.toGeometry(), o.color === undefined ? 0x54c05a : o.color), this._floorKind(o));
      if (solid.count) this.put(part(solid.toGeometry(), o.side === undefined ? 0x8a6a4a : o.side), 'toon');
      if (wallV.count) this.put(part(wallV.toGeometry(), o.wallColor === undefined ? this.wallColor : o.wallColor), 'toon');
    }
    if (o.footprint !== false) {
      const left = [], right = [];
      for (const f of frames) {
        const a = f.row[0].p, b = f.row[m].p;
        left.push([a[0] - f.S[0] * wallT, a[2] - f.S[2] * wallT]);
        right.push([b[0] + f.S[0] * wallT, b[2] + f.S[2] * wallT]);
      }
      this.footprints.push({ pts: left.concat(right.reverse()), holes: [], y: 0 });
    }
    return frames;
  }

  // ------------------------------------------------------------ walls
  /**
   * Wall between two base points. a/b are [x, z] (uses o.y) or [x, y, z].
   * o: h, t, y, mat, color, cap, below, ext0, ext1
   */
  wall(a, b, o = {}) {
    const h = o.h === undefined ? this.wallH : o.h;
    const t = o.t === undefined ? this.wallT : o.t;
    const below = o.below === undefined ? 0.45 : o.below;
    const mat = o.mat || this.wallMat;
    const y = o.y || 0;
    const A = a.length === 3 ? a : [a[0], y, a[1]];
    const B = b.length === 3 ? b : [b[0], y, b[1]];
    _ex.set(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
    const len = _ex.length();
    if (len < 1e-6) return this;
    _ex.divideScalar(len);
    _ez.crossVectors(_ex, UP).normalize();
    _ey.crossVectors(_ez, _ex).normalize();
    const e0 = o.ext0 || 0, e1 = o.ext1 || 0;
    const L = len + e0 + e1;
    const mid = (e1 - e0) / 2;
    const cy = (h - below) / 2;
    const cx = (A[0] + B[0]) / 2 + _ex.x * mid + _ey.x * cy;
    const cyy = (A[1] + B[1]) / 2 + _ex.y * mid + _ey.y * cy;
    const cz = (A[2] + B[2]) / 2 + _ex.z * mid + _ey.z * cy;
    _m.makeBasis(_ex, _ey, _ez);
    const quat = new THREE.Quaternion().setFromRotationMatrix(_m);
    this.world.addBox([cx, cyy, cz], [L / 2, (h + below) / 2, t / 2], { quat, mat });
    if (this.visual && o.visual !== false) {
      const mm = new THREE.Matrix4().compose(new THREE.Vector3(cx, cyy, cz), quat, new THREE.Vector3(1, 1, 1));
      this.put(part(box(L, h + below, t), o.color === undefined ? this.wallColor : o.color, { m: mm }), 'toon');
      if (o.cap !== false) {
        const capH = 0.07;
        const cm = new THREE.Matrix4().compose(
          new THREE.Vector3(cx + _ey.x * ((h + below) / 2 + capH / 2 - 0.001), cyy + _ey.y * ((h + below) / 2 + capH / 2 - 0.001), cz + _ey.z * ((h + below) / 2 + capH / 2 - 0.001)),
          quat, new THREE.Vector3(1, 1, 1),
        );
        this.put(part(box(L + 0.06, capH, t + 0.08), o.cap === undefined ? this.wallCap : o.cap, { m: cm }), o.capKind || this.capKind || 'toon');
      }
    }
    return this;
  }

  /** Open polyline of walls; points are the inner edge, `side` = +1/-1 picks the offset side. */
  wallLine(pts, o = {}) {
    const t = o.t === undefined ? this.wallT : o.t;
    const side = o.side || 1;
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i], q = pts[i + 1];
      const dx = q[0] - p[0], dz = q[1] - p[1];
      const l = Math.hypot(dx, dz) || 1;
      const nx = (dz / l) * side, nz = (-dx / l) * side;
      const off = t / 2;
      this.wall([p[0] + nx * off, p[1] + nz * off], [q[0] + nx * off, q[1] + nz * off], { ...o, ext0: t * 0.5, ext1: t * 0.5 });
    }
    return this;
  }

  /**
   * Walls around a polygon, inner faces flush with the polygon edges.
   * o.skip = [edge indices to leave open]
   */
  border(pts, y = 0, o = {}) {
    const t = o.t === undefined ? this.wallT : o.t;
    const n = pts.length;
    const sg = signedArea(pts) > 0 ? 1 : -1;
    const skip = new Set(o.skip || []);
    for (let i = 0; i < n; i++) {
      if (skip.has(i)) continue;
      const p0 = pts[i], p1 = pts[(i + 1) % n];
      const pv = pts[(i - 1 + n) % n], nx2 = pts[(i + 2) % n];
      const dx = p1[0] - p0[0], dz = p1[1] - p0[1];
      const l = Math.hypot(dx, dz);
      if (l < 1e-6) continue;
      const ux = dx / l, uz = dz / l;
      const nx = uz * sg, nz = -ux * sg;
      const c0 = ((p0[0] - pv[0]) * dz - (p0[1] - pv[1]) * dx) * sg;
      const c1 = (dx * (nx2[1] - p1[1]) - dz * (nx2[0] - p1[0])) * sg;
      const ext0 = c0 > 1e-6 ? t : 0;
      const ext1 = c1 > 1e-6 ? t : 0;
      const off = t / 2;
      this.wall([p0[0] + nx * off, p0[1] + nz * off], [p1[0] + nx * off, p1[1] + nz * off], { ...o, y, ext0, ext1 });
    }
    return this;
  }

  // ------------------------------------------------------------ solids
  /** Static box with collider. c = centre, size = full extents. */
  box(c, size, o = {}) {
    const mat = o.mat || MAT.stone;
    const quat = o.quat || new THREE.Quaternion().setFromAxisAngle(UP, o.rotY || 0);
    if (o.phys !== false) this.world.addBox(c, [size[0] / 2, size[1] / 2, size[2] / 2], { quat, mat });
    if (this.visual && o.visual !== false) {
      const mm = new THREE.Matrix4().compose(new THREE.Vector3(c[0], c[1], c[2]), quat, new THREE.Vector3(1, 1, 1));
      this.put(part(box(size[0], size[1], size[2]), o.color === undefined ? 0x9a9aa8 : o.color, { m: mm, top: o.top }), o.kind || 'toon');
    }
    return this;
  }

  /** Static vertical cylinder with collider. */
  cyl(x, z, r, y0, y1, o = {}) {
    const mat = o.mat || MAT.stone;
    if (o.phys !== false) this.world.addCyl(x, z, r, y0, y1, { mat, spin: o.spin || 0 });
    if (this.visual && o.visual !== false) {
      const g = cyl(o.rTop === undefined ? r : o.rTop, r, y1 - y0, o.seg || 16);
      this.put(part(g, o.color === undefined ? 0x9a9aa8 : o.color, { p: [x, (y0 + y1) / 2, z], top: o.top }), o.kind || 'toon');
    }
    return this;
  }

  /** Rock obstacle (sphere collider). */
  rock(x, y, z, r, o = {}) {
    if (o.phys !== false) this.world.addSphere([x, y + r * 0.35, z], r * 0.95, { mat: o.mat || MAT.rock });
    if (this.visual) {
      const g = rockGeo(r, this.rng, 0.8, 1);
      this.put(part(g, o.color === undefined ? 0x8c8f9c : o.color, { p: [x, y + r * 0.3, z], r: [0, this.rng() * TAU, 0], top: o.top }), 'toon');
    }
    return this;
  }

  /** Round bumper that kicks the ball away. */
  bumper(x, z, y, o = {}) {
    const r = o.r || 0.45;
    const h = o.h || 0.5;
    const id = `bumper${this.world.statics.length}`;
    const mat = { ...(o.soft ? MAT.softBumper : MAT.bumper), id };
    if (o.kick) mat.kick = o.kick;
    this.world.addCyl(x, z, r, y - 0.3, y + h, { mat });
    if (this.visual) {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      const body = new THREE.Mesh(
        merge([
          part(cyl(r * 0.92, r, h * 0.55, 20), o.color === undefined ? 0xff4d6d : o.color, { p: [0, h * 0.275, 0] }),
          part(cyl(r * 1.08, r * 1.08, h * 0.16, 20), o.band === undefined ? 0xffffff : o.band, { p: [0, h * 0.6, 0] }),
          part(sph(r * 0.95, 18, 10), o.capColor === undefined ? 0xffd23f : o.capColor, { p: [0, h * 0.66, 0], s: [1, 0.45, 1] }),
        ]),
        toonMat({ rim: 0.25 }),
      );
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);
      g.userData.bumperId = id;
      g.userData.pulse = 0;
      this.root.add(g);
      this.anims.push((t, dt) => {
        g.userData.pulse = Math.max(0, g.userData.pulse - dt * 5);
        const s = 1 + g.userData.pulse * 0.28;
        g.scale.set(s, 1 - g.userData.pulse * 0.15, s);
      });
      this.bumpers = this.bumpers || new Map();
      this.bumpers.set(id, g);
    }
    return this;
  }

  // ------------------------------------------------------------ tee / cup
  tee(x, y, z) {
    this.info.tee = [x, y, z];
    if (this.visual) {
      const g = merge([
        part(box(1.5, 0.02, 0.9), 0x2c6b3a, { p: [x, y + 0.012, z] }),
        part(sph(0.07, 10, 8), 0xffffff, { p: [x - 0.62, y + 0.06, z + 0.32] }),
        part(sph(0.07, 10, 8), 0xffffff, { p: [x + 0.62, y + 0.06, z + 0.32] }),
      ]);
      this.put(g, 'toon');
    }
    return this;
  }

  cup(x, y, z, o = {}) {
    this.info.cup = [x, y, z];
    this.world.setCup(x, y, z);
    if (this.visual) {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      const inner = new THREE.Mesh(
        merge([
          part(cyl(CUP_R, CUP_R, CUP_DEPTH, 28, true), 0x1b1b24, { p: [0, -CUP_DEPTH / 2, 0] }),
          part(circle(CUP_R, 28), 0x0e0e14, { r: [-Math.PI / 2, 0, 0], p: [0, -CUP_DEPTH + 0.002, 0] }),
        ]),
        toonMat({ side: THREE.DoubleSide, key: 'cup' }),
      );
      inner.receiveShadow = true;
      g.add(inner);
      const rim = new THREE.Mesh(
        part(ring(CUP_R, CUP_R + 0.04, 32), 0xffffff, { r: [-Math.PI / 2, 0, 0], p: [0, 0.004, 0] }),
        toonMat({ key: 'cuprim' }),
      );
      g.add(rim);
      // flag
      const flag = new THREE.Group();
      const pole = new THREE.Mesh(
        merge([
          part(cyl(0.022, 0.022, 2.3, 8), 0xf4f4f4, { p: [0, 1.15 - CUP_DEPTH, 0] }),
          part(sph(0.05, 10, 8), 0xffd23f, { p: [0, 2.32 - CUP_DEPTH, 0] }),
        ]),
        toonMat({ key: 'pole', transparent: true }),
      );
      pole.castShadow = true;
      flag.add(pole);
      const fm = makeFlagMaterial(o.flagColor === undefined ? 0xff3b3b : o.flagColor, 0xffffff);
      const fg = new THREE.PlaneGeometry(0.85, 0.5, 14, 6);
      fg.translate(0.425, 0, 0);
      const cloth = new THREE.Mesh(fg, fm);
      cloth.position.set(0.02, 2.0 - CUP_DEPTH, 0);
      cloth.layers.set(LAYER_FX);
      flag.add(cloth);
      flag.userData.cloth = fm;
      flag.userData.pole = pole.material;
      g.add(flag);
      this.root.add(g);
      this.flag = flag;
    }
    return this;
  }

  // ------------------------------------------------------------ hazards and terrain
  _surfaceMesh(pts, y, material, holes = []) {
    let contour = pts.map((p) => new THREE.Vector2(p[0], p[1]));
    if (!THREE.ShapeUtils.isClockWise(contour)) contour = contour.slice().reverse();
    const hv = holes.map((h) => {
      let v = h.map((p) => new THREE.Vector2(p[0], p[1]));
      if (THREE.ShapeUtils.isClockWise(v)) v = v.slice().reverse();
      return v;
    });
    const faces = THREE.ShapeUtils.triangulateShape(contour, hv);
    const all = contour.concat(...hv);
    const mb = new MeshBuf();
    for (const f of faces) {
      const a = all[f[0]], b = all[f[1]], c = all[f[2]];
      mb.tri([a.x, y, a.y], [b.x, y, b.y], [c.x, y, c.y], [0, 1, 0]);
    }
    const mesh = new THREE.Mesh(mb.toGeometry(), material);
    mesh.layers.set(LAYER_FX);
    return mesh;
  }

  /**
   * Hazard pool filling a polygon. The floor around it should have a matching hole.
   * o: type 'water' | 'lava', level (surface y), depth, bottom colour
   */
  pool(pts, o = {}) {
    const type = o.type || 'water';
    const level = o.level === undefined ? -0.14 : o.level;
    const depth = o.depth === undefined ? 0.45 : o.depth;
    const mat = type === 'lava' ? MAT.lava : MAT.water;
    // hazard surface slightly under the visible surface
    let contour = pts.map((p) => new THREE.Vector2(p[0], p[1]));
    if (!THREE.ShapeUtils.isClockWise(contour)) contour = contour.slice().reverse();
    const faces = THREE.ShapeUtils.triangulateShape(contour, []);
    for (const f of faces) {
      const a = contour[f[0]], b = contour[f[1]], c = contour[f[2]];
      this.world.addTriUp([a.x, level - 0.06, a.y], [b.x, level - 0.06, b.y], [c.x, level - 0.06, c.y], mat);
    }
    if (this.visual) {
      const material = o.material || (type === 'lava' ? makeLavaMaterial({ scale: o.scale || 1.6 }) : makeWaterMaterial({ wave: 0.35, scale: 1.6, ...(o.water || {}) }));
      const mesh = this._surfaceMesh(pts, level, material);
      mesh.renderOrder = 2;
      this.root.add(mesh);
      const bottom = new MeshBuf();
      for (const f of faces) {
        const a = contour[f[0]], b = contour[f[1]], c = contour[f[2]];
        bottom.tri([a.x, level - depth, a.y], [b.x, level - depth, b.y], [c.x, level - depth, c.y], [0, 1, 0]);
      }
      this.put(part(bottom.toGeometry(), o.bottom === undefined ? (type === 'lava' ? 0x3a1208 : 0xd9c58a) : o.bottom), 'toon');
    }
    return this;
  }

  /** Endless hazard plane (sea, lava lake). Anything that sinks below it is lost. */
  sea(level, o = {}) {
    const type = o.type || 'water';
    this.world.killY = level + 0.02;
    this.world.killType = type;
    if (this.visual) {
      const material = o.material || (type === 'lava' ? makeLavaMaterial({ scale: o.scale || 1 }) : makeWaterMaterial({ wave: 1, ...(o.water || {}) }));
      const g = new THREE.PlaneGeometry(o.size || 420, o.size || 420, 90, 90);
      g.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(g, material);
      mesh.position.set(o.x || 0, level, o.z || 0);
      mesh.layers.set(LAYER_FX);
      mesh.renderOrder = 2;
      this.root.add(mesh);
      if (o.bed !== false) {
        const fn = o.bedFn || (() => level - 2.2);
        this.terrain({ y: level - 2.2, color: o.bedColor === undefined ? 0xe2cf95 : o.bedColor, color2: o.bedColor2 === undefined ? 0xc9b37a : o.bedColor2, fn, radius: o.bedRadius || 150, kill: false, cx: o.x || 0, cz: o.z || 0 });
      }
    }
    return this;
  }

  /**
   * Out-of-bounds ground around the course (visual terrain + kill plane).
   * o: y, color, color2, radius, hills, flat (radius kept flat around the course), cx, cz, fn
   */
  terrain(o = {}) {
    const y = o.y === undefined ? -0.35 : o.y;
    if (o.kill !== false) {
      this.world.killY = y + BALL_R + 0.04;
      this.world.killType = o.killType || 'ob';
    }
    const cx = o.cx || 0, cz = o.cz === undefined ? -10 : o.cz;
    const flat = o.flat === undefined ? 26 : o.flat;
    const hills = o.hills === undefined ? 5 : o.hills;
    const dips = o.dips || [];
    const fn = o.fn || ((x, z) => {
      const d = Math.hypot(x - cx, z - cz);
      const k = smoothstep(flat, flat + 30, d);
      let h = y + k * (fbm2(x * 0.035 + 3.1, z * 0.035 + 7.7) * 2 - 0.55) * hills + k * k * 2.2;
      for (const p of dips) {
        const dd = Math.hypot(x - p.x, z - p.z);
        if (dd < p.r) h -= p.d * (1 - smoothstep(p.r * 0.45, p.r, dd));
      }
      return h;
    });
    if (o.kill !== false) this.terrainFn = fn;
    if (this.visual) {
      const R = o.radius || 130;
      const rings = 40, segs = 64;
      const mb = new MeshBuf();
      const P = (i, j) => {
        const r = Math.pow(i / rings, 1.6) * R;
        const a = (j / segs) * TAU;
        const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
        return [x, fn(x, z), z];
      };
      const Nn = (p) => {
        const e = 0.4;
        const gx = (fn(p[0] + e, p[2]) - fn(p[0] - e, p[2])) / (2 * e), gz = (fn(p[0], p[2] + e) - fn(p[0], p[2] - e)) / (2 * e);
        const l = Math.hypot(gx, 1, gz);
        return [-gx / l, 1 / l, -gz / l];
      };
      for (let i = 0; i < rings; i++) {
        for (let j = 0; j < segs; j++) {
          const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1);
          if (i === 0) mb.triN(a, b, c, Nn(a), Nn(b), Nn(c));
          else mb.quadN(a, b, c, d, Nn(a), Nn(b), Nn(c), Nn(d));
        }
      }
      const g = mb.toGeometry();
      // two-tone colouring from noise
      const pos = g.attributes.position;
      const col = new Float32Array(pos.count * 3);
      const c1 = new THREE.Color(o.color === undefined ? 0x6fc45a : o.color);
      const c2 = new THREE.Color(o.color2 === undefined ? 0x58ad4c : o.color2);
      const c3 = new THREE.Color(o.color3 === undefined ? (o.color2 === undefined ? 0x58ad4c : o.color2) : o.color3);
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i), yy = pos.getY(i);
        const k = smoothstep(0.42, 0.58, fbm2(x * 0.09 + 1.3, z * 0.09 + 4.2, 3));
        const hk = smoothstep(y + 2.5, y + 7, yy);
        const r = c1.r + (c2.r - c1.r) * k, gg = c1.g + (c2.g - c1.g) * k, b = c1.b + (c2.b - c1.b) * k;
        col[i * 3] = r + (c3.r - r) * hk; col[i * 3 + 1] = gg + (c3.g - gg) * hk; col[i * 3 + 2] = b + (c3.b - b) * hk;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      this.put(g, 'ground');
    }
    return this;
  }

  /** Is (x, z) on or near a playable floor? */
  onCourse(x, z, margin = 0.6) {
    for (const f of this.footprints) {
      if (pointInPoly(x, z, f.pts)) {
        let inHole = false;
        for (const h of f.holes) if (pointInPoly(x, z, h)) inHole = true;
        if (!inHole) return true;
      }
      if (distToPoly(x, z, f.pts) < margin) return true;
    }
    return false;
  }

  /** Instanced swaying grass on the terrain around the course. */
  grass(o = {}) {
    if (!this.visual) return this;
    const count = o.count || 5000;
    const area = o.area || [-30, -45, 30, 15];
    const fn = o.fn || this.terrainFn || (() => -0.35);
    const blade = new THREE.BufferGeometry();
    const hs = [0, 0.4, 0.75, 1];
    const ws = [1, 0.82, 0.5, 0];
    const v = [];
    for (let i = 0; i < 3; i++) {
      const y0 = hs[i], y1 = hs[i + 1], w0 = ws[i], w1 = ws[i + 1];
      v.push(-w0, y0, 0, w0, y0, 0, w1, y1, 0);
      if (w1 > 0) v.push(-w0, y0, 0, w1, y1, 0, -w1, y1, 0);
    }
    blade.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', blade.attributes.position);
    const offs = [], pars = [];
    let placed = 0, tries = 0;
    const rng = this.rng;
    while (placed < count && tries < count * 6) {
      tries++;
      let x, z;
      if (o.around) {
        // denser near the course
        const f = this.footprints[Math.floor(rng() * this.footprints.length)];
        const p = f.pts[Math.floor(rng() * f.pts.length)];
        const a = rng() * TAU, d = 0.5 + Math.pow(rng(), 1.5) * (o.spread || 9);
        x = p[0] + Math.cos(a) * d; z = p[1] + Math.sin(a) * d;
      } else {
        x = area[0] + rng() * (area[2] - area[0]); z = area[1] + rng() * (area[3] - area[1]);
      }
      if (this.onCourse(x, z, 0.45)) continue;
      if (o.reject && o.reject(x, z)) continue;
      const clump = fbm2(x * 0.3 + 9, z * 0.3 + 2, 2);
      if (clump < (o.cut === undefined ? 0.38 : o.cut)) continue;
      offs.push(x, fn(x, z) - 0.02, z);
      pars.push((o.height || 0.5) * (0.6 + rng() * 0.9), rng() * TAU, rng() * TAU, rng());
      placed++;
    }
    geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(new Float32Array(offs), 3));
    geo.setAttribute('aParams', new THREE.InstancedBufferAttribute(new Float32Array(pars), 4));
    geo.instanceCount = placed;
    const mesh = new THREE.Mesh(geo, makeGrassMaterial({ base: o.base, tip: o.tip }));
    mesh.frustumCulled = false;
    mesh.layers.set(LAYER_FX);
    this.root.add(mesh);
    return this;
  }

  // ------------------------------------------------------------ gadgets
  /** Conveyor belt rectangle. dir = [dx, dz] unit vector, speed in m/s. */
  belt(x0, z0, x1, z1, y, dir, speed, o = {}) {
    const mat = { ...MAT.deck, mu: 3.2, vel: [dir[0] * speed, 0, dir[1] * speed], conveyor: true, snd: 'metal' };
    const ax = Math.min(x0, x1), bx = Math.max(x0, x1), az = Math.min(z0, z1), bz = Math.max(z0, z1);
    this.world.addQuadUp([ax, y, az], [bx, y, az], [bx, y, bz], [ax, y, bz], mat);
    this.footprints.push({ pts: rectPoly(ax, az, bx, bz), holes: [], y });
    if (this.visual) {
      const g = new THREE.BufferGeometry();
      const P = [[ax, az], [bx, az], [bx, bz], [ax, bz]];
      const pos = [], uv = [];
      const idx = [0, 2, 1, 0, 3, 2];
      const acr = P.map((p) => p[0] * dir[1] - p[1] * dir[0]);
      const lo = Math.min(...acr), hi = Math.max(...acr);
      for (const k of idx) {
        const p = P[k];
        pos.push(p[0], y + 0.002, p[1]);
        const along = p[0] * dir[0] + p[1] * dir[1];
        uv.push((acr[k] - lo) / Math.max(1e-6, hi - lo), along);
      }
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.computeVertexNormals();
      const mesh = new THREE.Mesh(g, makeBeltMaterial({ speed, dark: o.dark, light: o.light, glow: o.glow || 0 }));
      mesh.layers.set(LAYER_FX);
      this.root.add(mesh);
      // slab under the belt
      const side = new MeshBuf();
      const th = this.floorThick;
      for (let i = 0; i < 4; i++) {
        const a = P[i], b = P[(i + 1) % 4];
        const mx = (a[0] + b[0]) / 2 - (ax + bx) / 2, mz = (a[1] + b[1]) / 2 - (az + bz) / 2;
        side.quad([a[0], y, a[1]], [b[0], y, b[1]], [b[0], y - th, b[1]], [a[0], y - th, a[1]], [mx, 0, mz]);
      }
      this.put(part(side.toGeometry(), 0x3a3f4d), 'toon');
    }
    return this;
  }

  /** Speed pad: sets the ball velocity along dir. */
  booster(cx, cz, y, dir, len, width, speed, o = {}) {
    const l = Math.hypot(dir[0], dir[1]) || 1;
    const dx = dir[0] / l, dz = dir[1] / l;
    const d3 = o.dir3 || [dx, 0, dz];
    this.world.addTrigger({ type: 'boost', ...region(cx, cz, len / 2, width / 2, dx, dz, y - 0.3, y + 0.6), dir: d3, speed });
    if (this.visual) {
      const g = new THREE.BufferGeometry();
      const rx = dz, rz = -dx; // right vector
      const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]]; // (right, forward)
      const pos = [], uv = [];
      for (const k of [0, 1, 2, 0, 2, 3]) {
        const r = c[k][0] * width / 2, f = c[k][1] * len / 2;
        pos.push(cx + rx * r + dx * f, y + 0.012 + (o.slope || 0) * f, cz + rz * r + dz * f);
        uv.push(c[k][0] * 0.5 + 0.5, f);
      }
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      const mesh = new THREE.Mesh(g, makeBeltMaterial({ speed: 3.2, dark: o.dark === undefined ? 0x14203a : o.dark, light: o.light === undefined ? 0x38f0ff : o.light, glow: 1 }));
      mesh.material.side = THREE.DoubleSide;
      mesh.layers.set(LAYER_FX);
      this.root.add(mesh);
    }
    return this;
  }

  /**
   * Portal pair. from/to are [x,y,z] (ball centre height is added automatically).
   * facing = direction [dx, dz] the entrance faces; exitDir = direction the ball leaves.
   */
  portal(o) {
    const r = o.r || 0.55;
    const from = o.from, to = o.to;
    const el = Math.hypot(o.exitDir[0], o.exitDir[1]) || 1;
    const exitDir = [o.exitDir[0] / el, o.exitDir[1] / el];
    this.world.addTrigger({
      type: 'portal', id: o.id || 'portal', c: [from[0], from[1] + 0.25, from[2]], r,
      to: [to[0] + exitDir[0] * 0.5, to[1] + BALL_R + 0.02, to[2] + exitDir[1] * 0.5],
      dir: exitDir, minSpeed: o.minSpeed || 2.2, maxSpeed: o.maxSpeed || 7,
    });
    if (this.visual) {
      const make = (p, dir, ca, cb, frameColor) => {
        const g = new THREE.Group();
        g.position.set(p[0], p[1], p[2]);
        g.rotation.y = Math.atan2(dir[0], dir[1]);
        const frame = new THREE.Mesh(
          merge([
            part(torus(0.78, 0.12, 8, 24, Math.PI), frameColor, { p: [0, 0.75, 0] }),
            part(cyl(0.12, 0.14, 0.75, 10), frameColor, { p: [-0.78, 0.375, 0] }),
            part(cyl(0.12, 0.14, 0.75, 10), frameColor, { p: [0.78, 0.375, 0] }),
            part(sph(0.16, 10, 8), cb, { p: [0, 1.62, 0] }),
          ]),
          toonMat({ rim: 0.3 }),
        );
        frame.castShadow = true;
        g.add(frame);
        const geo = new THREE.PlaneGeometry(1.7, 1.7);
        const disc = new THREE.Mesh(geo, makePortalMaterial(ca, cb));
        disc.position.set(0, 0.72, 0);
        disc.layers.set(LAYER_FX);
        g.add(disc);
        this.root.add(g);
        return g;
      };
      const fl = Math.hypot(o.facing[0], o.facing[1]) || 1;
      make(from, [o.facing[0] / fl, o.facing[1] / fl], o.colorA === undefined ? 0x7c3cff : o.colorA, o.colorB === undefined ? 0x2ff3ff : o.colorB, o.frame === undefined ? 0x5a5470 : o.frame);
      make(to, exitDir, o.colorA === undefined ? 0x7c3cff : o.colorA, o.colorB === undefined ? 0x2ff3ff : o.colorB, o.frame === undefined ? 0x5a5470 : o.frame);
    }
    // frame pillars are solid
    const fl = Math.hypot(o.facing[0], o.facing[1]) || 1;
    const rx = o.facing[1] / fl, rz = -o.facing[0] / fl;
    this.world.addCyl(from[0] + rx * 0.78, from[2] + rz * 0.78, 0.15, from[1] - 0.2, from[1] + 0.9, { mat: MAT.stone });
    this.world.addCyl(from[0] - rx * 0.78, from[2] - rz * 0.78, 0.15, from[1] - 0.2, from[1] + 0.9, { mat: MAT.stone });
    // a backstop behind the entrance so a ball can never sneak past the trigger
    this.world.addBox([from[0] - (o.facing[0] / fl) * 0.45, from[1] + 0.4, from[2] - (o.facing[1] / fl) * 0.45], [0.8, 0.6, 0.1], { rotY: Math.atan2(o.facing[0], o.facing[1]), mat: MAT.stone });
    return this;
  }

  /**
   * Kinematic (animated) obstacle.
   * o: pose(t, out{pos, quat}), shapes [...], mat, mesh (Object3D in body space)
   */
  kinematic(o) {
    const body = this.world.addBody(o.pose, o.shapes, o.mat || MAT.wood);
    if (this.visual && o.mesh) {
      this.root.add(o.mesh);
      this.kin.push({ pose: o.pose, obj: o.mesh });
    }
    return body;
  }

  /** Adds an animated critter ({obj, update}). */
  critter(c) {
    if (!this.visual || !c) return null;
    this.root.add(c.obj);
    this.anims.push((t, dt) => c.update(t, dt));
    c.update(0, 0);
    return c;
  }

  /**
   * Calls fn(x, y, z, rng) for `count` random spots that are not on the course.
   * area = [x0, z0, x1, z1]; o.margin keeps props away from the playing surface.
   */
  scatter(count, area, fn, o = {}) {
    if (!this.visual) return this;
    const rng = this.rng;
    const margin = o.margin === undefined ? 1.2 : o.margin;
    const placed = [];
    let tries = 0, n = 0;
    while (n < count && tries < count * 25) {
      tries++;
      const x = area[0] + rng() * (area[2] - area[0]);
      const z = area[1] + rng() * (area[3] - area[1]);
      if (this.onCourse(x, z, margin)) continue;
      if (o.reject && o.reject(x, z)) continue;
      if (o.minDist) {
        let ok = true;
        for (const p of placed) if (Math.hypot(p[0] - x, p[1] - z) < o.minDist) { ok = false; break; }
        if (!ok) continue;
      }
      placed.push([x, z]);
      const y = o.y !== undefined ? o.y : (this.terrainFn ? this.terrainFn(x, z) : -0.35);
      fn(x, y, z, rng);
      n++;
    }
    return this;
  }

  /** Queue a named sound effect for the game to play (roar, stomp, ...). */
  sound(name) { if (this.sounds.length < 8) this.sounds.push(name); }

  camZone(z) { this.info.camZones.push(z); return this; }

  light(x, y, z, color, intensity = 6, distance = 9, flicker = 0) {
    if (!this.visual) return null;
    const l = new THREE.PointLight(color, intensity, distance, 1.6);
    l.position.set(x, y, z);
    this.root.add(l);
    if (flicker > 0) {
      const seed = this.rng() * 100;
      this.anims.push((t) => {
        l.intensity = intensity * (1 - flicker * 0.5 + flicker * 0.5 * (Math.sin(t * 13 + seed) * 0.5 + Math.sin(t * 7.3 + seed * 2) * 0.3 + Math.sin(t * 23.1 + seed) * 0.2));
      });
    }
    return l;
  }

  /** Register an ambient particle emitter description (created by the game). */
  emitter(e) { if (this.visual) this.emitters.push(e); return this; }

  // ------------------------------------------------------------ finish
  _materialFor(kind) {
    if (kind === 'toon') return toonMat({});
    if (kind === 'ground') return toonMat({ key: 'ground' });
    if (kind === 'rim') return toonMat({ rim: 0.22 });
    if (kind === 'sway') return toonMat({ sway: true, side: THREE.DoubleSide });
    if (kind === 'double') return toonMat({ side: THREE.DoubleSide });
    if (kind === 'glow') return glowMat(2.2);
    if (kind === 'glowSoft') return glowMat(1.35);
    if (kind.startsWith('floor:')) {
      const [, pattern, glowColor] = kind.split(':');
      return toonMat({ pattern: Number(pattern), cupHole: true, glowColor: Number(glowColor) });
    }
    return toonMat({});
  }

  finish() {
    this.world.finalize();
    const hole = {
      info: this.info,
      world: this.world,
      root: this.root,
      flag: this.flag,
      bumpers: this.bumpers || new Map(),
      emitters: this.emitters,
      sounds: this.sounds,
      anims: this.anims,
      kin: this.kin,
      terrainFn: this.terrainFn,
      update: null,
      dispose: null,
    };
    if (this.visual) {
      for (const [kind, list] of this.batches) {
        const sway = kind === 'sway';
        const g = merge(list, { sway });
        if (!g) continue;
        const mesh = new THREE.Mesh(g, this._materialFor(kind));
        mesh.castShadow = !kind.startsWith('glow') && kind !== 'ground';
        mesh.receiveShadow = !kind.startsWith('glow');
        mesh.name = `batch:${kind}`;
        this.root.add(mesh);
      }
      this.batches.clear();
      const tmp = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
      const kin = this.kin, anims = this.anims;
      hole.update = (t, dt) => {
        for (let i = 0; i < kin.length; i++) {
          kin[i].pose(t, tmp);
          kin[i].obj.position.copy(tmp.pos);
          kin[i].obj.quaternion.copy(tmp.quat);
        }
        for (let i = 0; i < anims.length; i++) anims[i](t, dt);
      };
      hole.dispose = () => {
        this.root.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
          if (o.material && o.material.isShaderMaterial) o.material.dispose();
        });
      };
      U.cup.value.set(this.info.cup[0], this.info.cup[1], this.info.cup[2], CUP_R);
    }
    return hole;
  }
}

export { MAT, PATTERN };
