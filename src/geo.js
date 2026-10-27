// Procedural geometry helpers. Everything is painted with vertex colours so
// that static scenery can be merged into a handful of draw calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _c = new THREE.Color();
const _c2 = new THREE.Color();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

/** Growable triangle soup with explicit normals. */
export class MeshBuf {
  constructor() { this.pos = []; this.nor = []; this.uv = null; }

  /** Flat triangle. If n is given the winding is flipped to agree with it. */
  tri(a, b, c, n) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz);
    if (l < 1e-12) return;
    nx /= l; ny /= l; nz /= l;
    if (n && nx * n[0] + ny * n[1] + nz * n[2] < 0) {
      const t = b; b = c; c = t;
      nx = -nx; ny = -ny; nz = -nz;
    }
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    this.nor.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
  }

  quad(a, b, c, d, n) { this.tri(a, b, c, n); this.tri(a, c, d, n); }

  /** Smooth triangle with per-vertex normals; winding follows the mean normal. */
  triN(a, b, c, na, nb, nc) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const mx = na[0] + nb[0] + nc[0], my = na[1] + nb[1] + nc[1], mz = na[2] + nb[2] + nc[2];
    if (nx * mx + ny * my + nz * mz < 0) {
      this.pos.push(a[0], a[1], a[2], c[0], c[1], c[2], b[0], b[1], b[2]);
      this.nor.push(na[0], na[1], na[2], nc[0], nc[1], nc[2], nb[0], nb[1], nb[2]);
    } else {
      this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      this.nor.push(na[0], na[1], na[2], nb[0], nb[1], nb[2], nc[0], nc[1], nc[2]);
    }
  }

  quadN(a, b, c, d, na, nb, nc, nd) { this.triN(a, b, c, na, nb, nc); this.triN(a, c, d, na, nc, nd); }

  get count() { return this.pos.length / 3; }

  toGeometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    return g;
  }
}

/** Non-indexed, uv-less copy (what the batcher expects). */
export function prep(geo, flat = false) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  if (g.attributes.uv) g.deleteAttribute('uv');
  if (g.attributes.uv1) g.deleteAttribute('uv1');
  if (flat) g.computeVertexNormals();
  return g;
}

export function matrix(p = [0, 0, 0], r = [0, 0, 0], s = 1) {
  _p.set(p[0], p[1], p[2]);
  _q.setFromEuler(_e.set(r[0], r[1], r[2], 'YXZ'));
  if (typeof s === 'number') _s.set(s, s, s); else _s.set(s[0], s[1], s[2]);
  return new THREE.Matrix4().compose(_p, _q, _s);
}

/**
 * Paint + transform a geometry.
 * opts: p, r, s (transform), top (second colour for a vertical gradient),
 * flat (faceted normals), sway (bend weight per metre of height), noise (colour jitter)
 */
export function part(geo, color, o = {}) {
  const g = prep(geo, o.flat);
  if (o.p || o.r || o.s !== undefined) g.applyMatrix4(matrix(o.p, o.r, o.s === undefined ? 1 : o.s));
  if (o.m) g.applyMatrix4(o.m);
  const pos = g.attributes.position;
  const n = pos.count;
  const col = new Float32Array(n * 3);
  _c.set(color);
  if (o.top !== undefined) {
    _c2.set(o.top);
    let y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < n; i++) { const y = pos.getY(i); if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const span = Math.max(1e-6, y1 - y0);
    for (let i = 0; i < n; i++) {
      const t = (pos.getY(i) - y0) / span;
      col[i * 3] = _c.r + (_c2.r - _c.r) * t;
      col[i * 3 + 1] = _c.g + (_c2.g - _c.g) * t;
      col[i * 3 + 2] = _c.b + (_c2.b - _c.b) * t;
    }
  } else {
    for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (o.sway !== undefined) {
    const sw = new Float32Array(n);
    for (let i = 0; i < n; i++) sw[i] = Math.max(0, pos.getY(i) - (o.swayBase || 0)) * o.sway;
    g.setAttribute('aSway', new THREE.BufferAttribute(sw, 1));
  }
  return g;
}

/** Merge painted parts into one geometry. */
export function merge(parts, { sway = false } = {}) {
  const list = [];
  for (const g of parts) {
    if (!g) continue;
    if (sway && !g.attributes.aSway) {
      g.setAttribute('aSway', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count), 1));
    } else if (!sway && g.attributes.aSway) {
      g.deleteAttribute('aSway');
    }
    for (const k of Object.keys(g.attributes)) {
      if (k !== 'position' && k !== 'normal' && k !== 'color' && k !== 'aSway') g.deleteAttribute(k);
    }
    list.push(g);
  }
  if (!list.length) return null;
  if (list.length === 1) return list[0];
  const out = mergeGeometries(list, false);
  for (const g of list) g.dispose();
  return out;
}

export function placed(geo, p, r, s) {
  const g = geo.clone();
  g.applyMatrix4(matrix(p, r, s));
  return g;
}

// ------------------------------------------------------------ primitives
export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const sph = (r, ws = 14, hs = 10) => new THREE.SphereGeometry(r, ws, hs);
export const cyl = (rt, rb, h, seg = 12, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
export const cone = (r, h, seg = 12) => new THREE.ConeGeometry(r, h, seg);
export const ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
export const dode = (r) => new THREE.DodecahedronGeometry(r, 0);
export const torus = (r, t, rs = 8, ts = 20, arc = Math.PI * 2) => new THREE.TorusGeometry(r, t, rs, ts, arc);
export const plane = (w, h, ws = 1, hs = 1) => new THREE.PlaneGeometry(w, h, ws, hs);
export const circle = (r, seg = 20) => new THREE.CircleGeometry(r, seg);
export const ring = (ri, ro, seg = 28) => new THREE.RingGeometry(ri, ro, seg);
export const capsule = (r, l, cs = 4, rs = 10) => new THREE.CapsuleGeometry(r, l, cs, rs);

/** Low-poly rock: a noisy icosahedron with faceted shading. */
export function rockGeo(r, rng, squash = 0.75, detail = 1) {
  const base = new THREE.IcosahedronGeometry(r, detail);
  const g = base.index ? base.toNonIndexed() : base;
  const pos = g.attributes.position;
  const map = new Map();
  for (let i = 0; i < pos.count; i++) {
    const k = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    let f = map.get(k);
    if (f === undefined) { f = 0.75 + rng() * 0.5; map.set(k, f); }
    pos.setXYZ(i, pos.getX(i) * f, pos.getY(i) * f * squash, pos.getZ(i) * f);
  }
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
}

/** Surface of revolution from a profile [[r, y], ...]. */
export function lathe(profile, seg = 16) {
  const pts = profile.map((p) => new THREE.Vector2(Math.max(0.0001, p[0]), p[1]));
  return new THREE.LatheGeometry(pts, seg);
}

/** Tapered tube following a list of points (for tails, necks, vines...). */
export function tube(points, radii, seg = 8) {
  const mb = new MeshBuf();
  const n = points.length;
  const rings = [];
  const up = new THREE.Vector3(0, 1, 0);
  const t = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
  let prevA = null;
  for (let i = 0; i < n; i++) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[Math.min(n - 1, i + 1)];
    t.set(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]).normalize();
    if (prevA) {
      a.copy(prevA).addScaledVector(t, -prevA.dot(t)).normalize();
    } else {
      a.crossVectors(t, Math.abs(t.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : up).normalize();
    }
    prevA = a.clone();
    b.crossVectors(t, a).normalize();
    const r = typeof radii === 'number' ? radii : radii[i];
    const ringPts = [];
    for (let k = 0; k < seg; k++) {
      const ang = (k / seg) * Math.PI * 2;
      const cx = Math.cos(ang), sx = Math.sin(ang);
      const nx = a.x * cx + b.x * sx, ny = a.y * cx + b.y * sx, nz = a.z * cx + b.z * sx;
      ringPts.push({ p: [points[i][0] + nx * r, points[i][1] + ny * r, points[i][2] + nz * r], n: [nx, ny, nz] });
    }
    rings.push(ringPts);
  }
  for (let i = 0; i < n - 1; i++) {
    for (let k = 0; k < seg; k++) {
      const k2 = (k + 1) % seg;
      const A = rings[i][k], B = rings[i][k2], C = rings[i + 1][k2], D = rings[i + 1][k];
      mb.quadN(A.p, B.p, C.p, D.p, A.n, B.n, C.n, D.n);
    }
  }
  // caps
  for (const [idx, sign] of [[0, -1], [n - 1, 1]]) {
    const c = points[idx];
    const p0 = points[Math.max(0, idx - 1)], p1 = points[Math.min(n - 1, idx + 1)];
    const nn = [(p1[0] - p0[0]) * sign, (p1[1] - p0[1]) * sign, (p1[2] - p0[2]) * sign];
    for (let k = 0; k < seg; k++) mb.tri(c, rings[idx][k].p, rings[idx][(k + 1) % seg].p, nn);
  }
  return mb.toGeometry();
}
