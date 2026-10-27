// Little animated inhabitants. Each factory returns { obj, update(t, dt) }.
import * as THREE from 'three';
import { part, merge, box, cyl, cone, sph, capsule, torus, lathe } from './geo.js';
import { toonMat, glowMat, LAYER_FX } from './materials.js';
import { makeHaloMaterial } from './shaders.js';
import { TAU } from './utils.js';

function M(parts, o = {}) {
  const m = new THREE.Mesh(merge(parts), o.mat || toonMat({ rim: o.rim === undefined ? 0.2 : o.rim, side: o.double ? THREE.DoubleSide : THREE.FrontSide }));
  m.castShadow = o.shadow !== false;
  m.receiveShadow = false;
  return m;
}

function wingGeo(len, wid) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, -wid * 0.5, len, 0, -wid * 0.15, 0, 0, wid * 0.5,
    len, 0, -wid * 0.15, len * 0.75, 0, wid * 0.45, 0, 0, wid * 0.5,
  ], 3));
  g.computeVertexNormals();
  return g;
}

/** Moves an object around a closed loop; returns heading. */
function loopPos(t, o, out) {
  const a = t * o.speed / Math.max(0.5, o.radius) * (o.dir || 1) + (o.phase || 0);
  const rx = o.radius * (o.rx || 1), rz = o.radius * (o.rz || 1);
  const wob = o.wobble ? Math.sin(a * 3 + (o.phase || 0)) * o.wobble : 0;
  out.x = o.cx + Math.cos(a) * (rx + wob);
  out.z = o.cz + Math.sin(a) * (rz + wob);
  out.h = Math.atan2(-Math.sin(a) * rx * (o.dir || 1), Math.cos(a) * rz * (o.dir || 1));
  return out;
}
const _lp = { x: 0, z: 0, h: 0 };

// ------------------------------------------------------------ flyers
export function butterfly(o) {
  const g = new THREE.Group();
  const c = o.color === undefined ? 0xff9f1c : o.color;
  g.add(M([part(capsule(0.025, 0.12, 3, 6), 0x2b2b33, { r: [Math.PI / 2, 0, 0] })], { shadow: false }));
  const wg = new THREE.CircleGeometry(0.13, 8);
  wg.scale(1, 1.25, 1);
  wg.rotateX(-Math.PI / 2);
  wg.translate(0.12, 0, 0);
  const wm = toonMat({ side: THREE.DoubleSide, glow: 0.25, key: 'bfly' });
  const wl = new THREE.Mesh(part(wg.clone(), c, {}), wm);
  const wr = new THREE.Mesh(part(wg.clone(), c, { s: [-1, 1, 1] }), wm);
  g.add(wl, wr);
  const ph = o.phase || 0;
  g.scale.setScalar(o.s || 1);
  return {
    obj: g,
    update(t) {
      const f = Math.sin(t * 15 + ph) * 0.9;
      wl.rotation.z = 0.35 + f;
      wr.rotation.z = -0.35 - f;
      const x = o.x + Math.sin(t * 0.45 + ph) * o.r, z = o.z + Math.cos(t * 0.33 + ph * 1.7) * o.r;
      const y = o.y + Math.sin(t * 1.4 + ph) * 0.35 + Math.sin(t * 15 + ph) * 0.03;
      g.rotation.y = Math.atan2(x - g.position.x, z - g.position.z);
      g.position.set(x, y, z);
    },
  };
}

export function bird(o) {
  const g = new THREE.Group();
  const c = o.color === undefined ? 0x3d5a80 : o.color, belly = o.belly === undefined ? 0xf4f4f8 : o.belly;
  const s = o.s || 1;
  g.add(M([
    part(sph(0.16, 10, 8), c, { s: [0.9, 0.85, 1.7] }),
    part(sph(0.13, 8, 6), belly, { p: [0, -0.05, 0.02], s: [0.8, 0.7, 1.4] }),
    part(sph(0.1, 8, 6), c, { p: [0, 0.07, 0.27] }),
    part(cone(0.04, 0.14, 5), o.beak === undefined ? 0xffb703 : o.beak, { p: [0, 0.05, 0.4], r: [Math.PI / 2, 0, 0] }),
    part(box(0.16, 0.02, 0.22), c, { p: [0, 0.0, -0.34] }),
    part(sph(0.02, 5, 4), 0x111118, { p: [0.06, 0.1, 0.33] }),
    part(sph(0.02, 5, 4), 0x111118, { p: [-0.06, 0.1, 0.33] }),
  ], { shadow: false }));
  const wm = toonMat({ side: THREE.DoubleSide });
  const wl = new THREE.Mesh(part(wingGeo(0.55, 0.3), c, {}), wm);
  const wr = new THREE.Mesh(part(wingGeo(0.55, 0.3), c, { s: [-1, 1, 1] }), wm);
  g.add(wl, wr);
  g.scale.setScalar(s);
  const ph = o.phase || 0;
  const rate = o.flap || 7;
  return {
    obj: g,
    update(t) {
      loopPos(t, o, _lp);
      const glide = Math.sin(t * 0.6 + ph) > 0.55 ? 0.15 : 1;
      const f = Math.sin(t * rate + ph) * 0.7 * glide;
      wl.rotation.z = f + 0.1;
      wr.rotation.z = -f - 0.1;
      g.position.set(_lp.x, o.y + Math.sin(t * 0.8 + ph) * (o.bob === undefined ? 0.6 : o.bob), _lp.z);
      g.rotation.set(0, _lp.h, 0);
      g.rotateZ(-0.35 * (o.dir || 1));
    },
  };
}

export function pterodactyl(o) {
  const g = new THREE.Group();
  const c = o.color === undefined ? 0x9a6a4a : o.color;
  g.add(M([
    part(sph(0.35, 10, 8), c, { s: [0.8, 0.7, 1.8] }),
    part(sph(0.2, 8, 6), c, { p: [0, 0.12, 0.7] }),
    part(cone(0.1, 0.9, 5), 0xe0b070, { p: [0, 0.08, 1.25], r: [Math.PI / 2, 0, 0] }),
    part(cone(0.09, 0.7, 5), 0xd9553f, { p: [0, 0.3, 0.35], r: [-Math.PI / 2 + 0.5, 0, 0] }),
    part(cone(0.1, 0.8, 5), c, { p: [0, 0, -0.9], r: [-Math.PI / 2, 0, 0] }),
  ], { shadow: false }));
  const wm = toonMat({ side: THREE.DoubleSide });
  const wl = new THREE.Mesh(part(wingGeo(2.2, 1.1), 0xc48a5a, {}), wm);
  const wr = new THREE.Mesh(part(wingGeo(2.2, 1.1), 0xc48a5a, { s: [-1, 1, 1] }), wm);
  g.add(wl, wr);
  g.scale.setScalar(o.s || 1);
  const ph = o.phase || 0;
  return {
    obj: g,
    update(t) {
      loopPos(t, o, _lp);
      const f = Math.sin(t * 2.6 + ph) * 0.45;
      wl.rotation.z = f + 0.12;
      wr.rotation.z = -f - 0.12;
      g.position.set(_lp.x, o.y + Math.sin(t * 0.5 + ph) * 1.2, _lp.z);
      g.rotation.set(0, _lp.h, 0);
      g.rotateZ(-0.3 * (o.dir || 1));
    },
  };
}

export function bat(o) {
  const g = new THREE.Group();
  g.add(M([
    part(sph(0.12, 8, 6), 0x2a2238, { s: [0.9, 1, 1.2] }),
    part(cone(0.04, 0.1, 4), 0x2a2238, { p: [0.06, 0.13, 0.05] }),
    part(cone(0.04, 0.1, 4), 0x2a2238, { p: [-0.06, 0.13, 0.05] }),
  ], { shadow: false }));
  g.add(new THREE.Mesh(merge([
    part(sph(0.022, 5, 4), 0xff4d4d, { p: [0.045, 0.03, 0.13] }),
    part(sph(0.022, 5, 4), 0xff4d4d, { p: [-0.045, 0.03, 0.13] }),
  ]), glowMat(2.4)));
  const wm = toonMat({ side: THREE.DoubleSide });
  const wl = new THREE.Mesh(part(wingGeo(0.5, 0.34), 0x3a2f4f, {}), wm);
  const wr = new THREE.Mesh(part(wingGeo(0.5, 0.34), 0x3a2f4f, { s: [-1, 1, 1] }), wm);
  g.add(wl, wr);
  g.scale.setScalar(o.s || 1);
  const ph = o.phase || 0;
  return {
    obj: g,
    update(t) {
      loopPos(t, o, _lp);
      const f = Math.sin(t * 17 + ph) * 0.9;
      wl.rotation.z = f;
      wr.rotation.z = -f;
      g.position.set(_lp.x, o.y + Math.sin(t * 2.3 + ph) * 0.7 + Math.sin(t * 5.1 + ph) * 0.2, _lp.z);
      g.rotation.set(0, _lp.h, 0);
    },
  };
}

// ------------------------------------------------------------ walkers
export function bunny(o) {
  const g = new THREE.Group();
  const c = o.color === undefined ? 0xf4f0ea : o.color;
  g.add(M([
    part(sph(0.2, 10, 8), c, { p: [0, 0.2, 0], s: [0.9, 0.9, 1.2] }),
    part(sph(0.14, 10, 8), c, { p: [0, 0.4, 0.17] }),
    part(capsule(0.04, 0.2, 3, 6), c, { p: [0.06, 0.62, 0.14], r: [-0.2, 0, -0.15] }),
    part(capsule(0.04, 0.2, 3, 6), c, { p: [-0.06, 0.62, 0.14], r: [-0.2, 0, 0.15] }),
    part(capsule(0.02, 0.14, 3, 5), 0xffb3c6, { p: [0.06, 0.62, 0.17], r: [-0.2, 0, -0.15] }),
    part(capsule(0.02, 0.14, 3, 5), 0xffb3c6, { p: [-0.06, 0.62, 0.17], r: [-0.2, 0, 0.15] }),
    part(sph(0.07, 7, 6), 0xffffff, { p: [0, 0.22, -0.24] }),
    part(sph(0.025, 5, 4), 0x111118, { p: [0.07, 0.44, 0.27] }),
    part(sph(0.025, 5, 4), 0x111118, { p: [-0.07, 0.44, 0.27] }),
    part(sph(0.025, 5, 4), 0xff8fab, { p: [0, 0.38, 0.31] }),
  ]));
  g.scale.setScalar(o.s || 1);
  const ph = o.phase || 0;
  return {
    obj: g,
    update(t) {
      // hop in bursts, rest in between
      const cyc = (t * 0.22 + ph) % 1;
      const moving = cyc < 0.6;
      const tt = Math.floor(t * 0.22 + ph) * 0.6 / 0.22 + (moving ? cyc / 0.22 : 0.6 / 0.22);
      loopPos(tt, o, _lp);
      const hop = moving ? Math.abs(Math.sin(tt * 5.5)) : 0;
      g.position.set(_lp.x, o.y + hop * 0.3, _lp.z);
      g.rotation.set(-hop * 0.25, _lp.h, 0);
      if (!moving) g.rotation.y += Math.sin(t * 2 + ph) * 0.4;
    },
  };
}

export function sheep(o) {
  const g = new THREE.Group();
  const wool = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    wool.push(part(sph(0.26, 8, 6), 0xffffff, { p: [Math.cos(a) * 0.2, 0.62 + Math.sin(i * 2.1) * 0.06, Math.sin(a) * 0.36], top: 0xffffff }));
  }
  g.add(M([
    part(sph(0.4, 10, 8), 0xf7f3ea, { p: [0, 0.6, 0], s: [0.9, 0.85, 1.25] }),
    ...wool,
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => part(cyl(0.05, 0.05, 0.4, 6), 0x2b2b33, { p: [sx * 0.18, 0.2, sz * 0.26] }))),
  ]));
  const head = M([
    part(sph(0.17, 9, 7), 0x2b2b33, { s: [0.85, 1, 1.15] }),
    part(sph(0.13, 8, 6), 0xffffff, { p: [0, 0.12, -0.06] }),
    part(sph(0.06, 6, 5), 0x2b2b33, { p: [0.17, 0.04, -0.03], s: [1.6, 0.6, 1] }),
    part(sph(0.06, 6, 5), 0x2b2b33, { p: [-0.17, 0.04, -0.03], s: [1.6, 0.6, 1] }),
    part(sph(0.025, 5, 4), 0xffffff, { p: [0.08, 0.04, 0.14] }),
    part(sph(0.025, 5, 4), 0xffffff, { p: [-0.08, 0.04, 0.14] }),
  ]);
  head.position.set(0, 0.72, 0.52);
  g.add(head);
  g.position.set(o.x, o.y, o.z);
  g.rotation.y = o.rot || 0;
  g.scale.setScalar(o.s || 1);
  const ph = o.phase || 0;
  return {
    obj: g,
    update(t) {
      const graze = Math.sin(t * 0.5 + ph) > 0.1 ? 1 : 0;
      const target = graze ? 0.85 + Math.sin(t * 6 + ph) * 0.06 : 0;
      head.rotation.x += (target - head.rotation.x) * 0.05;
      head.position.y = 0.72 - head.rotation.x * 0.3;
      g.rotation.y = (o.rot || 0) + Math.sin(t * 0.13 + ph) * 0.5;
    },
  };
}

export function crab(o) {
  const g = new THREE.Group();
  const c = o.color === undefined ? 0xff5a3c : o.color;
  const legs = [];
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
    legs.push(part(cyl(0.02, 0.02, 0.22, 5), c, { p: [sx * 0.24, 0.08, -0.08 + i * 0.08], r: [0, 0, sx * 0.9] }));
  }
  g.add(M([
    part(sph(0.2, 10, 7), c, { p: [0, 0.14, 0], s: [1.25, 0.55, 0.9], top: 0xff8a6a }),
    ...legs,
    part(cyl(0.015, 0.015, 0.12, 5), c, { p: [0.07, 0.26, 0.12] }),
    part(cyl(0.015, 0.015, 0.12, 5), c, { p: [-0.07, 0.26, 0.12] }),
    part(sph(0.035, 6, 5), 0xffffff, { p: [0.07, 0.33, 0.12] }),
    part(sph(0.035, 6, 5), 0xffffff, { p: [-0.07, 0.33, 0.12] }),
    part(sph(0.018, 5, 4), 0x111118, { p: [0.07, 0.335, 0.15] }),
    part(sph(0.018, 5, 4), 0x111118, { p: [-0.07, 0.335, 0.15] }),
  ]));
  const claws = [];
  for (const sx of [-1, 1]) {
    const cl = M([
      part(sph(0.08, 7, 6), c, { s: [1, 0.8, 1.3] }),
      part(cone(0.04, 0.12, 5), c, { p: [0.03, 0, 0.12], r: [Math.PI / 2, 0, 0] }),
      part(cone(0.04, 0.12, 5), c, { p: [-0.03, 0, 0.12], r: [Math.PI / 2, 0, 0] }),
    ], { shadow: false });
    cl.position.set(sx * 0.3, 0.2, 0.16);
    g.add(cl);
    claws.push(cl);
  }
  g.scale.setScalar(o.s || 1);
  const ph = o.phase || 0;
  return {
    obj: g,
    update(t) {
      // scuttle sideways along a segment
      const k = Math.sin(t * (o.speed || 0.6) + ph);
      const x = o.x + (o.dx || 1) * k * (o.range || 1.5), z = o.z + (o.dz || 0) * k * (o.range || 1.5);
      g.position.set(x, o.y + Math.abs(Math.sin(t * 12 + ph)) * 0.02, z);
      g.rotation.y = (o.rot || 0) + Math.sin(t * 0.7 + ph) * 0.2;
      claws[0].rotation.x = -0.4 + Math.sin(t * 3 + ph) * 0.4;
      claws[1].rotation.x = -0.4 + Math.sin(t * 3 + ph + 2) * 0.4;
    },
  };
}

export function penguin(o) {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  inner.add(M([
    part(capsule(0.2, 0.28, 4, 10), 0x23232e, { p: [0, 0.38, 0] }),
    part(capsule(0.16, 0.22, 4, 10), 0xffffff, { p: [0, 0.34, 0.07] }),
    part(sph(0.16, 10, 8), 0x23232e, { p: [0, 0.7, 0] }),
    part(sph(0.1, 8, 6), 0xffffff, { p: [0.05, 0.71, 0.09], s: [1, 1.1, 0.8] }),
    part(sph(0.1, 8, 6), 0xffffff, { p: [-0.05, 0.71, 0.09], s: [1, 1.1, 0.8] }),
    part(cone(0.05, 0.13, 6), 0xffa62b, { p: [0, 0.68, 0.2], r: [Math.PI / 2, 0, 0] }),
    part(sph(0.022, 5, 4), 0x111118, { p: [0.06, 0.74, 0.16] }),
    part(sph(0.022, 5, 4), 0x111118, { p: [-0.06, 0.74, 0.16] }),
    part(sph(0.08, 6, 5), 0xffa62b, { p: [0.09, 0.03, 0.08], s: [1, 0.35, 1.5] }),
    part(sph(0.08, 6, 5), 0xffa62b, { p: [-0.09, 0.03, 0.08], s: [1, 0.35, 1.5] }),
  ]));
  const fl = [];
  for (const sx of [-1, 1]) {
    const f = M([part(sph(0.1, 6, 5), 0x23232e, { p: [0, -0.14, 0], s: [0.35, 1.6, 0.9] })], { shadow: false });
    f.position.set(sx * 0.22, 0.52, 0);
    inner.add(f);
    fl.push(f);
  }
  g.add(inner);
  g.scale.setScalar(o.s || 1);
  const ph = o.phase || 0;
  return {
    obj: g,
    update(t) {
      loopPos(t, o, _lp);
      g.position.set(_lp.x, o.y, _lp.z);
      g.rotation.y = _lp.h;
      inner.rotation.z = Math.sin(t * 7 + ph) * 0.16;
      inner.position.y = Math.abs(Math.sin(t * 7 + ph)) * 0.03;
      fl[0].rotation.z = -0.3 - Math.sin(t * 7 + ph) * 0.3;
      fl[1].rotation.z = 0.3 - Math.sin(t * 7 + ph) * 0.3;
    },
  };
}

export function raptor(o) {
  const g = new THREE.Group();
  const c = o.color === undefined ? 0x4fa86a : o.color, c2 = o.color2 === undefined ? 0xf1e08a : o.color2;
  const inner = new THREE.Group();
  inner.add(M([
    part(sph(0.22, 10, 8), c, { p: [0, 0.5, 0], s: [0.8, 0.85, 1.5], top: 0x7fd08a }),
    part(sph(0.17, 8, 6), c2, { p: [0, 0.44, 0.03], s: [0.7, 0.7, 1.3] }),
    part(cone(0.13, 0.8, 7), c, { p: [0, 0.52, -0.62], r: [-Math.PI / 2 - 0.1, 0, 0] }),
    part(capsule(0.08, 0.26, 3, 7), c, { p: [0, 0.74, 0.3], r: [0.6, 0, 0] }),
    part(sph(0.13, 8, 6), c, { p: [0, 0.92, 0.46], s: [0.85, 0.8, 1.4] }),
    part(sph(0.03, 5, 4), 0xffffff, { p: [0.08, 0.97, 0.5] }),
    part(sph(0.03, 5, 4), 0xffffff, { p: [-0.08, 0.97, 0.5] }),
    part(sph(0.016, 5, 4), 0x111118, { p: [0.09, 0.975, 0.525] }),
    part(sph(0.016, 5, 4), 0x111118, { p: [-0.09, 0.975, 0.525] }),
    part(capsule(0.025, 0.1, 3, 5), c, { p: [0.12, 0.5, 0.26], r: [0.9, 0, 0] }),
    part(capsule(0.025, 0.1, 3, 5), c, { p: [-0.12, 0.5, 0.26], r: [0.9, 0, 0] }),
  ]));
  const legs = [];
  for (const sx of [-1, 1]) {
    const l = M([
      part(capsule(0.05, 0.2, 3, 6), c, { p: [0, -0.14, 0] }),
      part(sph(0.07, 6, 5), c, { p: [0, -0.3, 0.06], s: [0.8, 0.4, 1.6] }),
    ], { shadow: false });
    l.position.set(sx * 0.13, 0.36, -0.02);
    inner.add(l);
    legs.push(l);
  }
  g.add(inner);
  g.scale.setScalar(o.s || 1);
  const ph = o.phase || 0;
  return {
    obj: g,
    update(t) {
      loopPos(t, o, _lp);
      g.position.set(_lp.x, o.y, _lp.z);
      g.rotation.y = _lp.h;
      const r = t * 11 + ph;
      legs[0].rotation.x = Math.sin(r) * 0.8;
      legs[1].rotation.x = -Math.sin(r) * 0.8;
      inner.position.y = Math.abs(Math.sin(r)) * 0.05;
      inner.rotation.x = Math.sin(r * 2) * 0.04;
    },
  };
}

export function robot(o) {
  const g = new THREE.Group();
  const c = o.color === undefined ? 0xffb703 : o.color;
  const inner = new THREE.Group();
  inner.add(M([
    part(box(0.5, 0.5, 0.44), c, { p: [0, 0.55, 0], top: 0xffd866 }),
    part(box(0.4, 0.3, 0.36), 0xdfe7f2, { p: [0, 0.98, 0] }),
    part(cyl(0.02, 0.02, 0.22, 5), 0x5a677a, { p: [0, 1.24, 0] }),
    part(cyl(0.06, 0.06, 0.3, 8), 0x5a677a, { p: [0.3, 0.6, 0], r: [0.4, 0, 0] }),
    part(cyl(0.06, 0.06, 0.3, 8), 0x5a677a, { p: [-0.3, 0.6, 0], r: [-0.4, 0, 0] }),
    part(box(0.26, 0.06, 0.02), 0x23232e, { p: [0, 0.9, 0.19] }),
  ]));
  const wheel = M([part(cyl(0.2, 0.2, 0.2, 14), 0x2c2c38, { r: [0, 0, Math.PI / 2] }), part(cyl(0.1, 0.1, 0.22, 8), 0xdfe7f2, { r: [0, 0, Math.PI / 2] })]);
  wheel.position.y = 0.2;
  g.add(wheel);
  const eyes = new THREE.Mesh(merge([
    part(sph(0.05, 8, 6), 0x38f0ff, { p: [0.1, 1.0, 0.18] }),
    part(sph(0.05, 8, 6), 0x38f0ff, { p: [-0.1, 1.0, 0.18] }),
    part(sph(0.045, 8, 6), 0xff4d4d, { p: [0, 1.37, 0] }),
  ]), glowMat(2.3));
  inner.add(eyes);
  g.add(inner);
  g.scale.setScalar(o.s || 1);
  const ph = o.phase || 0;
  return {
    obj: g,
    update(t) {
      loopPos(t, o, _lp);
      g.position.set(_lp.x, o.y, _lp.z);
      g.rotation.y = _lp.h;
      wheel.rotation.x = t * 6;
      inner.rotation.x = Math.sin(t * 3 + ph) * 0.08;
      inner.rotation.z = Math.sin(t * 2.2 + ph) * 0.05;
    },
  };
}

// ------------------------------------------------------------ swimmers
export function duck(o) {
  const g = new THREE.Group();
  g.add(M([
    part(sph(0.2, 10, 8), o.color === undefined ? 0xffd23f : o.color, { p: [0, 0.1, 0], s: [0.85, 0.7, 1.25] }),
    part(sph(0.12, 9, 7), o.color === undefined ? 0xffd23f : o.color, { p: [0, 0.32, 0.16] }),
    part(sph(0.06, 6, 5), 0xff8a1f, { p: [0, 0.3, 0.29], s: [1, 0.45, 1.3] }),
    part(cone(0.08, 0.16, 5), o.color === undefined ? 0xffd23f : o.color, { p: [0, 0.2, -0.27], r: [-0.9, 0, 0] }),
    part(sph(0.02, 5, 4), 0x111118, { p: [0.07, 0.36, 0.24] }),
    part(sph(0.02, 5, 4), 0x111118, { p: [-0.07, 0.36, 0.24] }),
  ], { shadow: false }));
  g.scale.setScalar(o.s || 1);
  const ph = o.phase || 0;
  return {
    obj: g,
    update(t) {
      loopPos(t, o, _lp);
      g.position.set(_lp.x, o.y + Math.sin(t * 2 + ph) * 0.025, _lp.z);
      g.rotation.set(Math.sin(t * 2.2 + ph) * 0.06, _lp.h, Math.sin(t * 1.7 + ph) * 0.06);
    },
  };
}

export function fish(o) {
  const g = new THREE.Group();
  const c = o.color === undefined ? 0xff8a3c : o.color;
  g.add(M([
    part(sph(0.18, 9, 7), c, { s: [0.5, 0.85, 1.5], top: 0xffc27a }),
    part(cone(0.14, 0.24, 4), c, { p: [0, 0, -0.36], r: [Math.PI / 2, 0, 0], s: [0.3, 1, 1] }),
    part(cone(0.07, 0.16, 4), c, { p: [0, 0.18, -0.02], s: [0.3, 1, 1] }),
    part(sph(0.025, 5, 4), 0x111118, { p: [0.07, 0.04, 0.18] }),
    part(sph(0.025, 5, 4), 0x111118, { p: [-0.07, 0.04, 0.18] }),
  ], { shadow: false }));
  g.scale.setScalar(o.s || 1);
  const period = o.period || 5;
  const ph = o.phase || 0;
  return {
    obj: g,
    splashAt: null,
    update(t) {
      const c2 = ((t + ph * period) % period) / period;
      const jump = 0.22;
      if (c2 < jump) {
        const k = c2 / jump;
        const a = o.angle || 0;
        const d = (k - 0.5) * (o.len || 1.8);
        g.visible = true;
        g.position.set(o.x + Math.sin(a) * d, o.y + Math.sin(k * Math.PI) * (o.h || 1.1) - 0.15, o.z + Math.cos(a) * d);
        g.rotation.set(-(0.5 - k) * 2.2, a, 0);
      } else {
        g.visible = false;
      }
    },
  };
}

export function sharkFin(o) {
  const g = new THREE.Group();
  const fin = cone(0.3, 0.75, 4);
  fin.scale(0.18, 1, 1);
  const pos = fin.attributes.position;
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0.3) pos.setZ(i, pos.getZ(i) - 0.22);
  fin.computeVertexNormals();
  g.add(M([part(fin, 0x5a6b7d, { p: [0, 0.32, 0], top: 0x7f93a8 })], { shadow: false }));
  g.scale.setScalar(o.s || 1);
  const ph = o.phase || 0;
  return {
    obj: g,
    update(t) {
      loopPos(t, o, _lp);
      const dive = Math.sin(t * 0.35 + ph);
      g.position.set(_lp.x, o.y - Math.max(0, dive - 0.6) * 1.6, _lp.z);
      g.rotation.set(0, _lp.h, Math.sin(t * 1.5 + ph) * 0.08);
    },
  };
}

// ------------------------------------------------------------ spooky / cosmic
export function ghost(o) {
  const g = new THREE.Group();
  const body = lathe([[0.0, 0.62], [0.2, 0.58], [0.3, 0.42], [0.32, 0.2], [0.34, 0.0], [0.3, -0.12], [0.36, -0.22]], 14);
  const mat = toonMat({ transparent: true, opacity: 0.72, glow: 0.5, rim: 0.6, key: 'ghost' });
  const b = new THREE.Mesh(part(body, o.color === undefined ? 0xeafcff : o.color, { top: 0xffffff }), mat);
  b.layers.set(LAYER_FX);
  g.add(b);
  const face = new THREE.Mesh(merge([
    part(sph(0.05, 7, 6), 0x1a1430, { p: [0.11, 0.36, 0.25], s: [1, 1.4, 0.6] }),
    part(sph(0.05, 7, 6), 0x1a1430, { p: [-0.11, 0.36, 0.25], s: [1, 1.4, 0.6] }),
    part(sph(0.06, 7, 6), 0x1a1430, { p: [0, 0.2, 0.3], s: [1, 1.3, 0.5] }),
  ]), toonMat({ key: 'ghostface' }));
  face.layers.set(LAYER_FX);
  g.add(face);
  const arms = [];
  for (const sx of [-1, 1]) {
    const a = new THREE.Mesh(part(sph(0.1, 7, 6), o.color === undefined ? 0xeafcff : o.color, { s: [1.5, 0.7, 0.7] }), mat);
    a.position.set(sx * 0.36, 0.2, 0.08);
    a.layers.set(LAYER_FX);
    g.add(a);
    arms.push(a);
  }
  g.scale.setScalar(o.s || 1);
  const ph = o.phase || 0;
  return {
    obj: g,
    update(t) {
      loopPos(t, o, _lp);
      g.position.set(_lp.x, o.y + Math.sin(t * 1.6 + ph) * 0.25, _lp.z);
      g.rotation.set(Math.sin(t * 1.1 + ph) * 0.12, _lp.h, Math.sin(t * 1.3 + ph) * 0.1);
      arms[0].position.y = 0.2 + Math.sin(t * 2.4 + ph) * 0.08;
      arms[1].position.y = 0.2 + Math.sin(t * 2.4 + ph + 1.5) * 0.08;
    },
  };
}

export function wisp(o) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), makeHaloMaterial(o.color === undefined ? 0xffe08a : o.color, o.strength || 1.6));
  m.layers.set(LAYER_FX);
  m.scale.setScalar(o.size || 0.35);
  const ph = o.phase || 0;
  const sp = o.speed || 1;
  return {
    obj: m,
    update(t) {
      m.position.set(
        o.x + Math.sin(t * 0.5 * sp + ph) * o.r + Math.sin(t * 1.7 * sp + ph * 2) * 0.3,
        o.y + Math.sin(t * 0.9 * sp + ph * 3) * (o.ry === undefined ? 0.5 : o.ry),
        o.z + Math.cos(t * 0.4 * sp + ph * 1.3) * o.r + Math.cos(t * 1.3 * sp + ph) * 0.3,
      );
      const k = 0.6 + 0.4 * Math.sin(t * 3 * sp + ph * 5);
      m.scale.setScalar((o.size || 0.35) * (0.7 + 0.3 * k));
    },
  };
}

export function ufo(o) {
  const g = new THREE.Group();
  const saucer = lathe([[0.0, -0.12], [0.5, -0.1], [1.0, 0.0], [1.05, 0.06], [0.6, 0.18], [0.0, 0.22]], 20);
  g.add(M([part(saucer, o.color === undefined ? 0xb8c4d8 : o.color, { top: 0xe6ecf7 })], { rim: 0.4 }));
  const dome = new THREE.Mesh(part(new THREE.SphereGeometry(0.45, 14, 8, 0, TAU, 0, Math.PI / 2), 0x7dffb0, { p: [0, 0.16, 0] }), toonMat({ glow: 0.9, transparent: true, opacity: 0.8, key: 'ufodome' }));
  dome.layers.set(LAYER_FX);
  g.add(dome);
  const lights = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    lights.push(part(sph(0.07, 6, 5), i % 2 ? 0xff4df0 : 0x38f0ff, { p: [Math.cos(a) * 0.85, 0.0, Math.sin(a) * 0.85] }));
  }
  const lm = new THREE.Mesh(merge(lights), glowMat(2.6));
  g.add(lm);
  if (o.beam) {
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 1.1, 3.2, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0x7dffb0, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    beam.position.y = -1.7;
    beam.layers.set(LAYER_FX);
    g.add(beam);
  }
  g.scale.setScalar(o.s || 1);
  const ph = o.phase || 0;
  return {
    obj: g,
    update(t) {
      loopPos(t, o, _lp);
      g.position.set(_lp.x, o.y + Math.sin(t * 1.3 + ph) * 0.35, _lp.z);
      g.rotation.set(Math.sin(t * 0.9 + ph) * 0.12, t * 0.8, Math.cos(t * 0.7 + ph) * 0.12);
      lm.rotation.y = t * 2;
    },
  };
}

export function astronaut(o) {
  const g = new THREE.Group();
  g.add(M([
    part(capsule(0.26, 0.36, 4, 10), 0xf4f4f8, { p: [0, 0, 0] }),
    part(sph(0.26, 12, 10), 0xf4f4f8, { p: [0, 0.52, 0] }),
    part(box(0.4, 0.5, 0.2), 0xd0d6e2, { p: [0, 0.05, -0.27] }),
    part(capsule(0.09, 0.3, 3, 8), 0xf4f4f8, { p: [0.38, 0.1, 0], r: [0, 0, -0.7] }),
    part(capsule(0.09, 0.3, 3, 8), 0xf4f4f8, { p: [-0.38, 0.15, 0], r: [0, 0, 1.1] }),
    part(capsule(0.1, 0.3, 3, 8), 0xf4f4f8, { p: [0.14, -0.5, 0.05], r: [0.3, 0, 0.1] }),
    part(capsule(0.1, 0.3, 3, 8), 0xf4f4f8, { p: [-0.14, -0.5, -0.05], r: [-0.4, 0, -0.1] }),
    part(box(0.2, 0.12, 0.04), 0xff4d4d, { p: [0, 0.12, 0.26] }),
  ], { rim: 0.35, shadow: false }));
  g.add(new THREE.Mesh(part(sph(0.19, 12, 10), 0x38b6ff, { p: [0, 0.54, 0.1], s: [1, 0.85, 0.8], top: 0xbdf3ff }), toonMat({ glow: 0.5, key: 'visor' })));
  g.scale.setScalar(o.s || 1);
  const ph = o.phase || 0;
  return {
    obj: g,
    update(t) {
      loopPos(t, o, _lp);
      g.position.set(_lp.x, o.y + Math.sin(t * 0.5 + ph) * 0.8, _lp.z);
      g.rotation.set(t * 0.23 + ph, t * 0.31, Math.sin(t * 0.4) * 0.6);
    },
  };
}

export function lavaSprite(o) {
  const g = new THREE.Group();
  const body = lathe([[0.0, -0.22], [0.16, -0.18], [0.22, 0.0], [0.16, 0.18], [0.06, 0.34], [0.0, 0.42]], 10);
  g.add(new THREE.Mesh(part(body, 0xff7a12, { top: 0xffe066 }), glowMat(2.0)));
  g.add(new THREE.Mesh(merge([
    part(sph(0.04, 6, 5), 0x3a0d05, { p: [0.08, 0.04, 0.18] }),
    part(sph(0.04, 6, 5), 0x3a0d05, { p: [-0.08, 0.04, 0.18] }),
  ]), toonMat({ key: 'lavaeye' })));
  g.scale.setScalar(o.s || 1);
  const period = o.period || 4;
  const ph = o.phase || 0;
  return {
    obj: g,
    update(t) {
      const c = ((t + ph * period) % period) / period;
      const k = c / 0.35;
      if (k < 1) {
        g.visible = true;
        const y = Math.sin(k * Math.PI) * (o.h || 2.2);
        g.position.set(o.x, o.y + y - 0.3, o.z);
        const sq = 1 + Math.cos(k * Math.PI) * 0.25;
        g.scale.set((o.s || 1) / Math.sqrt(sq), (o.s || 1) * sq, (o.s || 1) / Math.sqrt(sq));
        g.rotation.y = t * 3;
        g.rotation.x = k > 0.5 ? Math.PI : 0;
      } else {
        g.visible = false;
      }
    },
  };
}

/** Bobbing ship sail that billows. */
export function sail(w, h, color = 0xf7f1dc, stripe) {
  const geo = new THREE.PlaneGeometry(w, h, 8, 6);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / (w / 2), y = pos.getY(i) / (h / 2);
    pos.setZ(i, (1 - x * x) * (1 - y * y * 0.6) * 0.5);
  }
  geo.computeVertexNormals();
  const g = part(geo, color, {});
  if (stripe !== undefined) {
    const col = g.attributes.color;
    const c = new THREE.Color(stripe);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i += 3) {
      const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3;
      if (Math.floor((cx + w) / (w / 4)) % 2 === 0) for (let k = 0; k < 3; k++) col.setXYZ(i + k, c.r, c.g, c.b);
    }
  }
  const m = new THREE.Mesh(g, toonMat({ side: THREE.DoubleSide }));
  m.castShadow = true;
  return m;
}
