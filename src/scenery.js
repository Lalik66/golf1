// Shared scenery helpers used by several holes (visual only).
import * as THREE from 'three';
import * as P from './props.js';
import { part, merge, cyl, sph, cone, box } from './geo.js';
import { toonMat, glowMat, LAYER_FX } from './materials.js';
import { makeWaterMaterial, makeFlameMaterial, makeWaterfallMaterial, makeHaloMaterial } from './shaders.js';
import { TAU } from './utils.js';

/** Ring of far mountains for depth. */
export function mountains(b, o = {}) {
  if (!b.visual) return;
  const n = o.count || 14;
  const cx = o.cx || 0, cz = o.cz === undefined ? -10 : o.cz;
  const rng = b.rng;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rng() * 0.3;
    const d = (o.dist || 95) + rng() * 30;
    const r = (o.r || 16) + rng() * 12;
    const h = (o.h || 18) + rng() * 16;
    const g = P.mountain(rng, r, h, o.color === undefined ? 0x7a86a8 : o.color, o.snow === undefined ? 0xffffff : o.snow, o.snowLine === undefined ? 0.62 : o.snowLine);
    b.prop(g, cx + Math.cos(a) * d, (o.y === undefined ? -1 : o.y), cz + Math.sin(a) * d, rng() * TAU, 1, 'toon');
  }
}

/** A few 3D clouds drifting slowly across the sky. */
export function clouds(b, o = {}) {
  if (!b.visual) return;
  const n = o.count || 7;
  const rng = b.rng;
  const mat = toonMat({ key: 'cloud', glow: 0.25 });
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(P.puffCloud(rng, 1.6 + rng() * 1.6), mat);
    const x0 = -70 + rng() * 140, y = (o.y || 22) + rng() * 14, z = -80 + rng() * 120;
    const sp = 0.4 + rng() * 0.6;
    m.layers.set(LAYER_FX);
    b.add(m);
    b.anim((t) => {
      m.position.set(((x0 + t * sp + 90) % 180) - 90, y, z);
    });
  }
}

/** Decorative pond (not a hazard). */
export function pond(b, x, z, r, level, o = {}) {
  if (!b.visual) return;
  const g = new THREE.CircleGeometry(r, 36);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, makeWaterMaterial({ wave: 0.25, scale: 1.4, ...o }));
  m.position.set(x, level, z);
  m.layers.set(LAYER_FX);
  m.renderOrder = 2;
  b.add(m);
}

/** Animated flame with light; returns the group. */
export function flame(b, x, y, z, o = {}) {
  if (!b.visual) return null;
  const s = o.s || 1;
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const geo = new THREE.ConeGeometry(0.16 * s, 0.55 * s, 8, 4, true);
  geo.translate(0, 0.27 * s, 0);
  const outer = new THREE.Mesh(geo, makeFlameMaterial(o.inner === undefined ? 0xfff1a0 : o.inner, o.outer === undefined ? 0xff5a12 : o.outer));
  outer.layers.set(LAYER_FX);
  g.add(outer);
  const geo2 = new THREE.ConeGeometry(0.08 * s, 0.32 * s, 8, 3, true);
  geo2.translate(0, 0.16 * s, 0);
  const inner = new THREE.Mesh(geo2, makeFlameMaterial(0xffffff, o.inner === undefined ? 0xfff1a0 : o.inner));
  inner.layers.set(LAYER_FX);
  g.add(inner);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), makeHaloMaterial(o.outer === undefined ? 0xff8a3c : o.outer, 0.7));
  halo.position.y = 0.25 * s;
  halo.scale.setScalar(1.6 * s);
  halo.layers.set(LAYER_FX);
  g.add(halo);
  b.add(g);
  if (o.light !== false) b.light(x, y + 0.4 * s, z, o.lightColor === undefined ? 0xff9a4a : o.lightColor, o.intensity || 7, o.distance || 8, 0.5);
  return g;
}

/** Torch = post + flame. */
export function torch(b, x, y, z, o = {}) {
  if (!b.visual) return;
  b.prop(P.torchPost({ h: o.h || 1.4, color: o.color }), x, y, z, 0, 1, 'toon');
  flame(b, x, y + (o.h || 1.4) + 0.14, z, o);
}

/** Waterfall sheet between two heights, facing +Z by default. */
export function waterfall(b, x, yTop, yBottom, z, width, o = {}) {
  if (!b.visual) return;
  const h = yTop - yBottom;
  const g = new THREE.PlaneGeometry(width, h, 1, 1);
  const m = new THREE.Mesh(g, makeWaterfallMaterial(o));
  m.position.set(x, (yTop + yBottom) / 2, z);
  m.rotation.y = o.rotY || 0;
  m.layers.set(LAYER_FX);
  m.renderOrder = 3;
  b.add(m);
  b.emitter({
    min: [x - width / 2, yBottom, z - 0.3], max: [x + width / 2, yBottom + 0.2, z + 0.5], rate: 26 * (width / 2),
    life: [0.5, 1.1], size: [0.12, 0.3], colors: [0xffffff, 0xd8f6ff], vel: [0, 1.2, 0.4], spread: [0.6, 0.8, 0.6], gravity: 3, alpha: 0.75, grow: 1.2,
  });
}

/** Glowing lantern light bulb (goes into the glow batch). */
export function bulb(b, x, y, z, color = 0xffe08a, r = 0.12, light = true) {
  if (!b.visual) return;
  b.put(part(sph(r, 10, 8), color, { p: [x, y, z] }), 'glow');
  if (light) b.light(x, y, z, color, 5, 7, 0.15);
}

/** Wooden arrow sign pointing along a direction. */
export function arrowSign(b, x, y, z, dir, color) {
  if (!b.visual) return;
  b.prop(P.signArrow({ color }), x, y, z, Math.atan2(-dir[1], dir[0]), 1, 'toon');
}

export { part, merge, cyl, sph, cone, box, glowMat };
