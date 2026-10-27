// Procedural scenery. Every factory returns painted geometry built around its
// own origin (base at y = 0), ready to be placed into a merged batch.
import * as THREE from 'three';
import { part, merge, box, cyl, cone, sph, ico, torus, rockGeo, tube, lathe, capsule, dode } from './geo.js';
import { TAU } from './utils.js';

const SW = { sway: true };

export function tree(rng, o = {}) {
  const h = o.h || 2.0 + rng() * 1.3;
  const leaf = o.leaf === undefined ? 0x2f9e44 : o.leaf;
  const leaf2 = o.leaf2 === undefined ? 0x8ce05a : o.leaf2;
  const k = 0.22;
  const parts = [part(cyl(0.13, 0.22, h, 7), o.trunk === undefined ? 0x8a5a33 : o.trunk, { p: [0, h / 2, 0], sway: k })];
  const n = 3 + Math.floor(rng() * 2);
  const R = o.r || 0.95 + rng() * 0.35;
  parts.push(part(sph(R, 12, 9), leaf, { p: [0, h + R * 0.45, 0], top: leaf2, sway: k, s: [1, 0.9, 1] }));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rng();
    const r = R * (0.55 + rng() * 0.25);
    parts.push(part(sph(r, 10, 8), leaf, {
      p: [Math.cos(a) * R * 0.7, h + R * 0.15 + rng() * R * 0.5, Math.sin(a) * R * 0.7], top: leaf2, sway: k,
    }));
  }
  return merge(parts, SW);
}

export function pine(rng, o = {}) {
  const h = o.h || 3 + rng() * 1.6;
  const c1 = o.leaf === undefined ? 0x1f7a4d : o.leaf, c2 = o.leaf2 === undefined ? 0x4fb86a : o.leaf2;
  const k = 0.12;
  const parts = [part(cyl(0.12, 0.2, h * 0.35, 7), 0x7a4a2b, { p: [0, h * 0.175, 0], sway: k })];
  const tiers = 3;
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers;
    const r = (1.25 - t * 0.75) * (o.r || 1);
    const ch = h * 0.42;
    const y = h * 0.28 + t * h * 0.58;
    parts.push(part(cone(r, ch, 9), c1, { p: [0, y + ch / 2, 0], top: c2, sway: k }));
    if (o.snow) parts.push(part(cone(r * 0.62, ch * 0.5, 9), 0xffffff, { p: [0, y + ch * 0.76, 0], sway: k }));
  }
  return merge(parts, SW);
}

export function palm(rng, o = {}) {
  const h = o.h || 3.4 + rng() * 1.2;
  const lean = (rng() - 0.5) * 1.6;
  const pts = [], rad = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    pts.push([lean * t * t, h * t, 0]);
    rad.push(0.2 - t * 0.09);
  }
  const k = 0.2;
  const parts = [part(tube(pts, rad, 7), 0xb98a52, { top: 0x8f6a3c, sway: k })];
  const top = pts[6];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rng() * 0.4;
    const len = 1.5 + rng() * 0.5;
    const g = sph(1, 8, 6);
    g.scale(len * 0.5, 0.06, 0.32);
    g.translate(len * 0.5, 0, 0);
    // droop
    const pos = g.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      const x = pos.getX(v);
      pos.setY(v, pos.getY(v) - (x * x) * 0.22 + x * 0.25);
    }
    g.computeVertexNormals();
    parts.push(part(g, 0x2fa84f, { r: [0, a, 0], p: [top[0], top[1], top[2]], top: 0x7fe06a, sway: k }));
  }
  for (let i = 0; i < 3; i++) {
    const a = rng() * TAU;
    parts.push(part(sph(0.13, 8, 6), 0x6b4424, { p: [top[0] + Math.cos(a) * 0.18, top[1] - 0.12, top[2] + Math.sin(a) * 0.18], sway: k }));
  }
  return merge(parts, SW);
}

export function bush(rng, o = {}) {
  const c = o.color === undefined ? 0x3aa655 : o.color, c2 = o.color2 === undefined ? 0x8fe06a : o.color2;
  const parts = [];
  const n = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const a = rng() * TAU, d = rng() * 0.45, r = 0.35 + rng() * 0.3;
    parts.push(part(sph(r, 9, 7), c, { p: [Math.cos(a) * d, r * 0.7, Math.sin(a) * d], top: c2, sway: 0.35 }));
  }
  if (o.berries) {
    for (let i = 0; i < 6; i++) {
      const a = rng() * TAU, d = 0.2 + rng() * 0.5;
      parts.push(part(sph(0.06, 6, 5), o.berries, { p: [Math.cos(a) * d, 0.5 + rng() * 0.3, Math.sin(a) * d], sway: 0.35 }));
    }
  }
  return merge(parts, SW);
}

export function flower(rng, color = 0xff5fa2, o = {}) {
  const h = o.h || 0.35 + rng() * 0.25;
  const k = 1.6;
  const parts = [
    part(cyl(0.018, 0.022, h, 5), 0x3c9a3c, { p: [0, h / 2, 0], sway: k }),
    part(sph(0.06, 7, 5), o.center === undefined ? 0xffd23f : o.center, { p: [0, h + 0.01, 0], s: [1, 0.6, 1], sway: k }),
  ];
  const n = 5;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    parts.push(part(sph(0.065, 6, 5), color, { p: [Math.cos(a) * 0.09, h, Math.sin(a) * 0.09], s: [1, 0.45, 1], sway: k }));
  }
  const la = rng() * TAU;
  const lg = sph(0.08, 6, 4);
  lg.scale(1.3, 0.2, 0.5);
  parts.push(part(lg, 0x4fb84f, { p: [Math.cos(la) * 0.08, h * 0.4, Math.sin(la) * 0.08], r: [0, -la, 0.5], sway: k }));
  return merge(parts, SW);
}

export function tulip(rng, color = 0xff3b3b) {
  const h = 0.45 + rng() * 0.15;
  const k = 1.3;
  const head = lathe([[0.0, 0], [0.07, 0.03], [0.085, 0.1], [0.06, 0.17], [0.075, 0.2]], 7);
  const lg = sph(0.1, 6, 4);
  lg.scale(0.35, 1.5, 0.12);
  return merge([
    part(cyl(0.017, 0.02, h, 5), 0x3c9a3c, { p: [0, h / 2, 0], sway: k }),
    part(head, color, { p: [0, h - 0.02, 0], sway: k }),
    part(lg, 0x4fb84f, { p: [0.05, 0.16, 0], r: [0, rng() * TAU, -0.25], sway: k }),
  ], SW);
}

export function mushroom(rng, o = {}) {
  const s = o.s || 1;
  const capC = o.color === undefined ? 0xff4d4d : o.color;
  const g = new THREE.SphereGeometry(0.4 * s, 14, 8, 0, TAU, 0, Math.PI / 2);
  const parts = [
    part(cyl(0.11 * s, 0.15 * s, 0.4 * s, 9), 0xfff2dc, { p: [0, 0.2 * s, 0] }),
    part(g, capC, { p: [0, 0.36 * s, 0], s: [1, 0.75, 1] }),
    part(cyl(0.4 * s, 0.4 * s, 0.03 * s, 14), 0xffe2c4, { p: [0, 0.36 * s, 0] }),
  ];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + rng() * 0.5, e = 0.35 + rng() * 0.8;
    const r = 0.4 * s;
    const x = Math.cos(a) * Math.sin(e) * r, z = Math.sin(a) * Math.sin(e) * r, y = Math.cos(e) * r * 0.75;
    parts.push(part(sph(0.055 * s, 6, 5), 0xffffff, { p: [x, 0.36 * s + y, z], s: [1, 0.5, 1] }));
  }
  return merge(parts);
}

export function rock(rng, r = 0.6, color = 0x8c8f9c, top) {
  return part(rockGeo(r, rng, 0.7 + rng() * 0.25, 1), color, { p: [0, r * 0.3, 0], r: [0, rng() * TAU, 0], top });
}

export function boulderPile(rng, color = 0x8c8f9c, top = 0xb4b7c4) {
  const parts = [];
  const n = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const a = rng() * TAU, d = rng() * 0.9, r = 0.35 + rng() * 0.55;
    parts.push(part(rockGeo(r, rng, 0.75, 1), color, { p: [Math.cos(a) * d, r * 0.3, Math.sin(a) * d], top }));
  }
  return merge(parts);
}

export function fence(len = 3, o = {}) {
  const c = o.color === undefined ? 0xf3ead8 : o.color;
  const parts = [];
  const n = Math.max(2, Math.round(len / 0.9) + 1);
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + (i / (n - 1)) * len;
    parts.push(part(box(0.1, 0.7, 0.1), c, { p: [x, 0.35, 0] }));
    parts.push(part(cone(0.08, 0.12, 4), c, { p: [x, 0.76, 0], r: [0, Math.PI / 4, 0] }));
  }
  parts.push(part(box(len, 0.08, 0.05), c, { p: [0, 0.5, 0] }));
  parts.push(part(box(len, 0.08, 0.05), c, { p: [0, 0.25, 0] }));
  return merge(parts);
}

export function torchPost(o = {}) {
  const h = o.h || 1.4;
  return merge([
    part(cyl(0.06, 0.08, h, 7), o.color === undefined ? 0x6b4424 : o.color, { p: [0, h / 2, 0] }),
    part(cyl(0.16, 0.09, 0.2, 8), 0x3a3a44, { p: [0, h + 0.08, 0] }),
    part(torus(0.1, 0.025, 5, 10), 0xd9a441, { p: [0, h - 0.08, 0], r: [Math.PI / 2, 0, 0] }),
  ]);
}

export function lampPost(o = {}) {
  const h = o.h || 2.4;
  return merge([
    part(cyl(0.05, 0.08, h, 7), o.color === undefined ? 0x2c2c38 : o.color, { p: [0, h / 2, 0] }),
    part(cyl(0.16, 0.12, 0.08, 8), o.color === undefined ? 0x2c2c38 : o.color, { p: [0, h + 0.04, 0] }),
    part(cone(0.2, 0.16, 8), o.color === undefined ? 0x2c2c38 : o.color, { p: [0, h + 0.46, 0] }),
  ]);
}

export function barrel(o = {}) {
  const c = o.color === undefined ? 0xa8683a : o.color;
  return merge([
    part(lathe([[0.26, 0], [0.33, 0.25], [0.34, 0.4], [0.33, 0.55], [0.26, 0.8], [0.0, 0.8]], 12), c),
    part(torus(0.325, 0.025, 5, 14), 0x44444f, { p: [0, 0.22, 0], r: [Math.PI / 2, 0, 0] }),
    part(torus(0.325, 0.025, 5, 14), 0x44444f, { p: [0, 0.58, 0], r: [Math.PI / 2, 0, 0] }),
  ]);
}

export function crate(s = 0.7, color = 0xc48a4a) {
  const e = 0.06;
  const parts = [part(box(s, s, s), color, { p: [0, s / 2, 0] })];
  for (const x of [-1, 1]) for (const z of [-1, 1]) {
    parts.push(part(box(e, s + 0.02, e), 0x8a5a2b, { p: [x * (s / 2), s / 2, z * (s / 2)] }));
  }
  for (const y of [0, 1]) for (const d of [-1, 1]) {
    parts.push(part(box(s + 0.02, e, e), 0x8a5a2b, { p: [0, y * s, d * (s / 2)] }));
    parts.push(part(box(e, e, s + 0.02), 0x8a5a2b, { p: [d * (s / 2), y * s, 0] }));
  }
  return merge(parts);
}

export function chest() {
  const lid = cyl(0.3, 0.3, 0.9, 12, false);
  lid.rotateZ(Math.PI / 2);
  lid.scale(1, 0.7, 1);
  return merge([
    part(box(0.9, 0.45, 0.6), 0x9a5a2b, { p: [0, 0.225, 0] }),
    part(lid, 0xb06a32, { p: [0, 0.45, 0] }),
    part(box(0.94, 0.08, 0.64), 0xffc93c, { p: [0, 0.43, 0] }),
    part(box(0.1, 0.5, 0.64), 0xffc93c, { p: [-0.3, 0.26, 0] }),
    part(box(0.1, 0.5, 0.64), 0xffc93c, { p: [0.3, 0.26, 0] }),
    part(box(0.14, 0.16, 0.06), 0xffe07a, { p: [0, 0.4, 0.32] }),
  ]);
}

export function signArrow(o = {}) {
  const c = o.color === undefined ? 0xffd23f : o.color;
  const head = cone(0.26, 0.4, 3);
  head.rotateZ(-Math.PI / 2);
  head.scale(1, 1, 0.25);
  return merge([
    part(cyl(0.05, 0.06, 1.2, 6), 0x7a4a2b, { p: [0, 0.6, 0] }),
    part(box(0.75, 0.3, 0.07), c, { p: [-0.05, 1.12, 0] }),
    part(head, c, { p: [0.5, 1.12, 0] }),
  ]);
}

export function gravestone(rng, o = {}) {
  const c = o.color === undefined ? 0x8c8fa3 : o.color;
  const type = Math.floor(rng() * 3);
  const parts = [part(box(0.75, 0.14, 0.4), 0x6f7286, { p: [0, 0.07, 0] })];
  if (type === 0) {
    const top = cyl(0.3, 0.3, 0.16, 12);
    top.rotateX(Math.PI / 2);
    parts.push(part(box(0.6, 0.7, 0.16), c, { p: [0, 0.49, 0] }), part(top, c, { p: [0, 0.84, 0] }));
  } else if (type === 1) {
    parts.push(part(box(0.18, 1.1, 0.16), c, { p: [0, 0.69, 0] }), part(box(0.62, 0.18, 0.16), c, { p: [0, 0.88, 0] }));
  } else {
    parts.push(part(box(0.62, 0.85, 0.18), c, { p: [0, 0.56, 0], r: [0, 0, (rng() - 0.5) * 0.2] }));
  }
  return merge(parts);
}

export function pumpkin(rng, o = {}) {
  const s = o.s || 1;
  const parts = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    parts.push(part(sph(0.2 * s, 8, 7), 0xff8a1f, { p: [Math.cos(a) * 0.13 * s, 0.2 * s, Math.sin(a) * 0.13 * s], s: [1, 1.05, 1], top: 0xffb347 }));
  }
  parts.push(part(cyl(0.03 * s, 0.045 * s, 0.14 * s, 6), 0x3f7a2f, { p: [0, 0.44 * s, 0], r: [0.2, 0, 0.2] }));
  return merge(parts);
}

/** Glowing face for a pumpkin (goes to a glow batch). */
export function pumpkinFace(s = 1) {
  const eye = cone(0.045 * s, 0.07 * s, 3);
  eye.rotateX(Math.PI / 2);
  eye.scale(1, 1, 0.3);
  return merge([
    part(eye.clone(), 0xffd866, { p: [-0.09 * s, 0.26 * s, 0.305 * s], r: [0, -0.2, 0] }),
    part(eye.clone(), 0xffd866, { p: [0.09 * s, 0.26 * s, 0.305 * s], r: [0, 0.2, 0] }),
    part(box(0.2 * s, 0.035 * s, 0.02 * s), 0xffd866, { p: [0, 0.14 * s, 0.325 * s] }),
  ]);
}

export function deadTree(rng, o = {}) {
  const c = o.color === undefined ? 0x3b2f3f : o.color;
  const h = o.h || 3 + rng() * 1.5;
  const k = 0.1;
  const parts = [];
  const trunk = [];
  const tr = [];
  let x = 0, z = 0;
  for (let i = 0; i <= 5; i++) {
    const t = i / 5;
    trunk.push([x, h * t, z]);
    tr.push(0.24 - t * 0.17);
    x += (rng() - 0.5) * 0.35; z += (rng() - 0.5) * 0.35;
  }
  parts.push(part(tube(trunk, tr, 6), c, { sway: k }));
  const nb = 4 + Math.floor(rng() * 3);
  for (let i = 0; i < nb; i++) {
    const bi = 2 + Math.floor(rng() * 3);
    const b0 = trunk[bi];
    const a = rng() * TAU;
    const len = 0.9 + rng() * 1.1;
    const pts = [], rr = [];
    for (let j = 0; j <= 4; j++) {
      const t = j / 4;
      pts.push([b0[0] + Math.cos(a) * len * t, b0[1] + len * 0.75 * t * (1.2 - t * 0.5) + Math.sin(t * 5 + i) * 0.06, b0[2] + Math.sin(a) * len * t]);
      rr.push(0.085 * (1 - t * 0.85));
    }
    parts.push(part(tube(pts, rr, 5), c, { sway: k }));
  }
  return merge(parts, SW);
}

export function crystal(rng, color = 0x7de3ff, top = 0xffffff, s = 1) {
  const parts = [];
  const n = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const h = (0.6 + rng() * 1.2) * s;
    const r = (0.14 + rng() * 0.16) * s;
    const g = cyl(0.001, r, h * 0.3, 6);
    g.translate(0, h * 0.85, 0);
    const a = rng() * TAU, d = rng() * 0.3 * s;
    const tilt = [(rng() - 0.5) * 0.7, 0, (rng() - 0.5) * 0.7];
    parts.push(part(cyl(r, r * 0.8, h * 0.7, 6), color, { p: [0, h * 0.35, 0], top, flat: true, r: tilt, m: null }));
    parts[parts.length - 1].translate(Math.cos(a) * d, 0, Math.sin(a) * d);
    const tip = part(g, top, { flat: true, r: tilt });
    tip.translate(Math.cos(a) * d, 0, Math.sin(a) * d);
    parts.push(tip);
  }
  return merge(parts);
}

export function snowman(rng) {
  const parts = [
    part(sph(0.45, 12, 9), 0xffffff, { p: [0, 0.38, 0], top: 0xffffff }),
    part(sph(0.33, 12, 9), 0xffffff, { p: [0, 1.0, 0] }),
    part(sph(0.24, 12, 9), 0xffffff, { p: [0, 1.47, 0] }),
    part(cone(0.05, 0.26, 6), 0xff8a1f, { p: [0, 1.47, 0.32], r: [Math.PI / 2, 0, 0] }),
    part(sph(0.03, 6, 5), 0x1b1b24, { p: [-0.09, 1.55, 0.21] }),
    part(sph(0.03, 6, 5), 0x1b1b24, { p: [0.09, 1.55, 0.21] }),
    part(cyl(0.2, 0.2, 0.04, 12), 0x23232e, { p: [0, 1.68, 0] }),
    part(cyl(0.14, 0.14, 0.22, 12), 0x23232e, { p: [0, 1.8, 0] }),
    part(torus(0.25, 0.06, 6, 14), 0xe63946, { p: [0, 1.27, 0], r: [Math.PI / 2, 0, 0] }),
    part(box(0.1, 0.35, 0.05), 0xe63946, { p: [0.16, 1.1, 0.24], r: [0, 0, -0.2] }),
  ];
  for (let i = 0; i < 3; i++) parts.push(part(sph(0.035, 6, 5), 0x1b1b24, { p: [0, 0.85 + i * 0.15, 0.31 - Math.abs(i - 1) * 0.02] }));
  for (const sx of [-1, 1]) {
    parts.push(part(cyl(0.02, 0.025, 0.6, 5), 0x6b4424, { p: [sx * 0.5, 1.1, 0], r: [0, 0, sx * -1.1] }));
  }
  return merge(parts);
}

export function igloo() {
  const dome = new THREE.SphereGeometry(1.3, 16, 8, 0, TAU, 0, Math.PI / 2);
  const tunnel = cyl(0.55, 0.55, 0.9, 12, false);
  tunnel.rotateX(Math.PI / 2);
  return merge([
    part(dome, 0xeaf6ff, { top: 0xffffff }),
    part(tunnel, 0xdcecf8, { p: [0, 0.2, 1.4], s: [1, 1, 1] }),
    part(cyl(0.4, 0.4, 0.05, 12), 0x23304a, { p: [0, 0.28, 1.86], r: [Math.PI / 2, 0, 0] }),
  ]);
}

export function cactus(rng) {
  const c = 0x3f9a4f;
  const parts = [part(capsule(0.2, 1.2, 4, 9), c, { p: [0, 0.8, 0], top: 0x6fc86a })];
  for (const sx of [-1, 1]) {
    if (rng() < 0.8) {
      const y = 0.6 + rng() * 0.4;
      parts.push(part(capsule(0.12, 0.3, 4, 8), c, { p: [sx * 0.32, y, 0], r: [0, 0, Math.PI / 2] }));
      parts.push(part(capsule(0.12, 0.45, 4, 8), c, { p: [sx * 0.5, y + 0.3, 0], top: 0x6fc86a }));
    }
  }
  return merge(parts);
}

export function fern(rng, o = {}) {
  const c = o.color === undefined ? 0x2f9e44 : o.color, c2 = o.color2 === undefined ? 0x9be05a : o.color2;
  const parts = [];
  const n = 6 + Math.floor(rng() * 3);
  const s = o.s || 1;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rng() * 0.3;
    const len = (0.9 + rng() * 0.5) * s;
    const g = sph(1, 7, 5);
    g.scale(len * 0.5, 0.04, 0.2 * s);
    g.translate(len * 0.5, 0, 0);
    const pos = g.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      const x = pos.getX(v);
      pos.setY(v, pos.getY(v) + x * 0.8 - x * x * 0.45 / s);
    }
    g.computeVertexNormals();
    parts.push(part(g, c, { r: [0, a, 0], top: c2, sway: 0.7 }));
  }
  return merge(parts, SW);
}

export function bone(len = 1.2) {
  const parts = [part(cyl(0.07, 0.07, len, 7), 0xf3ead8, { r: [0, 0, Math.PI / 2], p: [0, 0.1, 0] })];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    parts.push(part(sph(0.11, 7, 6), 0xf3ead8, { p: [sx * len / 2, 0.1, sz * 0.07] }));
  }
  return merge(parts);
}

export function ribcage() {
  const parts = [part(cyl(0.08, 0.08, 3, 7), 0xf3ead8, { r: [Math.PI / 2, 0, 0], p: [0, 0.2, 0] })];
  for (let i = 0; i < 6; i++) {
    const r = 0.9 - Math.abs(i - 2.5) * 0.12;
    const g = torus(r, 0.06, 5, 12, Math.PI);
    parts.push(part(g, 0xf3ead8, { p: [0, 0.15, -1.2 + i * 0.48] }));
  }
  return merge(parts);
}

export function egg(color = 0xf7f1dc, spot = 0x8fc46a, s = 1) {
  const g = sph(0.4 * s, 12, 10);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const k = 1 - (y / (0.4 * s)) * 0.18;
    pos.setX(i, pos.getX(i) * k);
    pos.setZ(i, pos.getZ(i) * k);
    pos.setY(i, y * 1.25);
  }
  g.computeVertexNormals();
  const parts = [part(g, color, { p: [0, 0.48 * s, 0] })];
  for (let i = 0; i < 5; i++) {
    const a = i * 1.9, e = 0.6 + (i % 3) * 0.5;
    const r = 0.39 * s;
    parts.push(part(sph(0.08 * s, 6, 5), spot, { p: [Math.cos(a) * Math.sin(e) * r * 0.92, 0.48 * s + Math.cos(e) * r * 1.2, Math.sin(a) * Math.sin(e) * r * 0.92], s: [1, 1, 1] }));
  }
  return merge(parts);
}

export function gear(r = 1, teeth = 10, thick = 0.25, color = 0xd9a441, hub = 0x8a6a2f) {
  const parts = [
    part(cyl(r * 0.82, r * 0.82, thick, 24), color),
    part(cyl(r * 0.3, r * 0.3, thick * 1.5, 12), hub),
  ];
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * TAU;
    parts.push(part(box(r * 0.34, thick, r * 0.32), color, { p: [Math.cos(a) * r * 0.9, 0, Math.sin(a) * r * 0.9], r: [0, -a, 0] }));
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    parts.push(part(cyl(r * 0.11, r * 0.11, thick * 1.04, 8), hub, { p: [Math.cos(a) * r * 0.55, 0, Math.sin(a) * r * 0.55] }));
  }
  return merge(parts);
}

export function pipe(len = 3, r = 0.25, color = 0x7a8aa0) {
  const parts = [part(cyl(r, r, len, 12), color, { r: [0, 0, Math.PI / 2] })];
  for (const s of [-1, 0, 1]) parts.push(part(cyl(r * 1.25, r * 1.25, 0.12, 12), 0x5a677a, { r: [0, 0, Math.PI / 2], p: [s * len * 0.48, 0, 0] }));
  return merge(parts);
}

export function tank(color = 0xb8651f) {
  return merge([
    part(cyl(1.0, 1.0, 2.2, 16), color, { p: [0, 1.3, 0], top: 0xe08a3a }),
    part(sph(1.0, 16, 8), color, { p: [0, 2.4, 0], s: [1, 0.45, 1] }),
    part(torus(1.02, 0.06, 6, 20), 0x5a3a1a, { p: [0, 0.8, 0], r: [Math.PI / 2, 0, 0] }),
    part(torus(1.02, 0.06, 6, 20), 0x5a3a1a, { p: [0, 1.9, 0], r: [Math.PI / 2, 0, 0] }),
    part(cyl(0.12, 0.12, 0.6, 8), 0x5a677a, { p: [0, 3.0, 0] }),
    part(box(0.2, 0.3, 0.2), 0x44444f, { p: [0.7, 0.15, 0.7] }),
    part(box(0.2, 0.3, 0.2), 0x44444f, { p: [-0.7, 0.15, 0.7] }),
    part(box(0.2, 0.3, 0.2), 0x44444f, { p: [0.7, 0.15, -0.7] }),
    part(box(0.2, 0.3, 0.2), 0x44444f, { p: [-0.7, 0.15, -0.7] }),
  ]);
}

export function chimney(h = 5, color = 0x8a4a3a) {
  return merge([
    part(cyl(0.5, 0.75, h, 12), color, { p: [0, h / 2, 0], top: 0xb8654a }),
    part(cyl(0.62, 0.62, 0.3, 12), 0x5a3a2f, { p: [0, h, 0] }),
    part(cyl(0.64, 0.64, 0.25, 12), 0xf3ead8, { p: [0, h * 0.75, 0] }),
  ]);
}

export function hut(rng, o = {}) {
  const wall = o.wall === undefined ? 0xf3e2c0 : o.wall, roof = o.roof === undefined ? 0xd9553f : o.roof;
  const roofG = cone(1.75, 1.3, 4);
  roofG.rotateY(Math.PI / 4);
  return merge([
    part(box(2.2, 1.5, 2.2), wall, { p: [0, 0.75, 0] }),
    part(roofG, roof, { p: [0, 2.15, 0], top: 0xf07a5a }),
    part(box(0.55, 0.95, 0.06), 0x7a4a2b, { p: [0, 0.48, 1.12] }),
    part(box(0.5, 0.45, 0.06), 0x8fd3ff, { p: [-0.68, 0.95, 1.12] }),
    part(box(0.5, 0.45, 0.06), 0x8fd3ff, { p: [0.68, 0.95, 1.12] }),
    part(box(0.3, 0.7, 0.3), 0xb8654a, { p: [0.6, 2.3, -0.3] }),
  ]);
}

export function mountain(rng, r = 14, h = 16, color = 0x7a86a8, snow = 0xffffff, snowLine = 0.62) {
  const g = new THREE.ConeGeometry(r, h, 7, 4).toNonIndexed();
  const pos = g.attributes.position;
  const map = new Map();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y > h / 2 - 0.01) continue;
    const k = `${pos.getX(i).toFixed(2)},${y.toFixed(2)},${pos.getZ(i).toFixed(2)}`;
    let f = map.get(k);
    if (!f) { f = [0.8 + rng() * 0.45, (rng() - 0.5) * h * 0.08]; map.set(k, f); }
    pos.setXYZ(i, pos.getX(i) * f[0], y + f[1], pos.getZ(i) * f[0]);
  }
  g.translate(0, h / 2, 0);
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  const col = new Float32Array(pos.count * 3);
  const c1 = new THREE.Color(color), c2 = new THREE.Color(snow), c0 = new THREE.Color(color).multiplyScalar(0.8);
  for (let i = 0; i < pos.count; i += 3) {
    const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3 / h;
    const c = y > snowLine ? c2 : (y < 0.25 ? c0 : c1);
    for (let k = 0; k < 3; k++) { col[(i + k) * 3] = c.r; col[(i + k) * 3 + 1] = c.g; col[(i + k) * 3 + 2] = c.b; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

export function puffCloud(rng, s = 1) {
  const parts = [];
  const n = 4 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const r = (0.8 + rng() * 0.9) * s;
    parts.push(part(sph(r, 10, 8), 0xe6f0ff, { p: [(i - n / 2) * 1.0 * s + rng() * 0.4, rng() * 0.4 * s, (rng() - 0.5) * 1.2 * s], s: [1, 0.7, 1], top: 0xffffff }));
  }
  return merge(parts);
}

export function lilyPad(rng) {
  const g = new THREE.CircleGeometry(0.35, 12, 0.3, TAU - 0.6);
  g.rotateX(-Math.PI / 2);
  const parts = [part(g, 0x3fae4a, { p: [0, 0.01, 0], r: [0, rng() * TAU, 0] })];
  if (rng() < 0.5) {
    parts.push(part(sph(0.09, 7, 5), 0xff9ecb, { p: [0.05, 0.07, 0.02], s: [1, 0.7, 1] }));
    parts.push(part(sph(0.04, 6, 4), 0xffe07a, { p: [0.05, 0.12, 0.02] }));
  }
  return merge(parts);
}

export function reed(rng) {
  const parts = [];
  const n = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const h = 0.8 + rng() * 0.6;
    const x = (rng() - 0.5) * 0.4, z = (rng() - 0.5) * 0.4;
    parts.push(part(cyl(0.015, 0.02, h, 4), 0x5a9a3a, { p: [x, h / 2, z], sway: 0.9 }));
    parts.push(part(capsule(0.04, 0.16, 3, 6), 0x7a4a2b, { p: [x, h, z], sway: 0.9 }));
  }
  return merge(parts, SW);
}

export function planet(r, color, color2, ringColor) {
  const parts = [part(sph(r, 20, 14), color, { top: color2 })];
  if (ringColor !== undefined) {
    const g = new THREE.RingGeometry(r * 1.35, r * 2.0, 40);
    g.rotateX(-Math.PI / 2);
    parts.push(part(g, ringColor));
    const g2 = new THREE.RingGeometry(r * 1.35, r * 2.0, 40);
    g2.rotateX(Math.PI / 2);
    parts.push(part(g2, ringColor));
  }
  return merge(parts);
}

export function rocket() {
  const fin = box(0.08, 0.7, 0.6);
  const parts = [
    part(cyl(0.45, 0.5, 2.0, 14), 0xf4f4f8, { p: [0, 1.6, 0] }),
    part(cone(0.45, 0.9, 14), 0xff4d4d, { p: [0, 3.05, 0] }),
    part(cyl(0.3, 0.42, 0.35, 12), 0x44444f, { p: [0, 0.45, 0] }),
    part(torus(0.2, 0.05, 6, 14), 0x38b6ff, { p: [0, 2.0, 0.44] }),
    part(cyl(0.18, 0.18, 0.04, 12), 0x9be7ff, { p: [0, 2.0, 0.44], r: [Math.PI / 2, 0, 0] }),
    part(cyl(0.46, 0.46, 0.12, 14), 0xff4d4d, { p: [0, 1.0, 0] }),
  ];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    parts.push(part(fin.clone(), 0xff4d4d, { p: [Math.cos(a) * 0.6, 0.7, Math.sin(a) * 0.6], r: [0, -a + Math.PI / 2, 0.0] }));
  }
  return merge(parts);
}

export function asteroid(rng, r = 1.5, color = 0x6a5f8a, top = 0x9a8fc0) {
  return part(rockGeo(r, rng, 0.85, 1), color, { top, r: [rng() * 3, rng() * 3, rng() * 3] });
}

export function antenna() {
  const dish = new THREE.SphereGeometry(0.7, 14, 6, 0, TAU, 0, Math.PI / 3);
  dish.rotateX(Math.PI);
  return merge([
    part(cyl(0.06, 0.1, 1.6, 7), 0x9aa4b8, { p: [0, 0.8, 0] }),
    part(dish, 0xe6ecf7, { p: [0, 2.2, 0], r: [0.6, 0, 0] }),
    part(sph(0.08, 8, 6), 0xff4d4d, { p: [0, 1.95, 0.3] }),
  ], { sway: false });
}

export function shipHull() {
  // pirate ship body (static parts); sails are separate so they can billow
  const hull = lathe([[0.0, 0], [0.9, 0.05], [1.25, 0.6], [1.35, 1.2], [1.3, 1.5]], 14);
  hull.scale(1, 1, 2.6);
  const parts = [
    part(hull, 0x8a4f2a, { top: 0xb8703a }),
    part(box(2.4, 0.12, 6.0), 0xd9a86a, { p: [0, 1.38, 0] }),
    part(box(2.2, 0.9, 1.6), 0x9a5a2b, { p: [0, 1.85, -2.3] }),
    part(box(2.3, 0.12, 1.7), 0xd9a86a, { p: [0, 2.32, -2.3] }),
    part(cyl(0.1, 0.13, 5.2, 8), 0x6b4424, { p: [0, 3.9, 0.3] }),
    part(cyl(0.08, 0.1, 3.6, 8), 0x6b4424, { p: [0, 3.1, 2.2] }),
    part(cyl(0.05, 0.05, 2.8, 6), 0x6b4424, { p: [0, 5.3, 0.3], r: [0, 0, Math.PI / 2] }),
    part(cyl(0.05, 0.05, 2.8, 6), 0x6b4424, { p: [0, 3.6, 0.3], r: [0, 0, Math.PI / 2] }),
    part(cyl(0.04, 0.04, 2.0, 6), 0x6b4424, { p: [0, 4.2, 2.2], r: [0, 0, Math.PI / 2] }),
    part(cyl(0.06, 0.06, 2.4, 6), 0x6b4424, { p: [0, 1.9, 3.6], r: [1.1, 0, 0] }),
    part(cyl(0.3, 0.3, 0.1, 10), 0x6b4424, { p: [0, 6.3, 0.3] }),
  ];
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      parts.push(part(cyl(0.16, 0.16, 0.06, 10), 0x2c2c38, { p: [sx * 1.3, 0.95, -1 + i * 1.2], r: [0, 0, Math.PI / 2] }));
    }
    parts.push(part(box(0.08, 0.35, 5.8), 0x6b4424, { p: [sx * 1.18, 1.6, 0] }));
  }
  return merge(parts);
}
