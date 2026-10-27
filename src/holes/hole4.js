// Hole 4 - Frozen Peak. An icy chute with a banked hairpin down to a snowy green.
import * as THREE from 'three';
import { CourseBuilder, MAT, PATTERN } from '../builder.js';
import * as P from '../props.js';
import * as C from '../critters.js';
import * as S from '../scenery.js';
import { part, merge, box, cyl, sph } from '../geo.js';
import { TAU, lerp, smoothstep, circlePoly } from '../utils.js';

export default function build(opts = {}) {
  const b = new CourseBuilder({ ...opts, seed: 404 });
  b.meta({
    name: 'Frozen Peak', par: 3,
    hint: 'The ice is slippery. A gentle tap is all it takes to slide down the chute.',
    path: [[0, 1.5, 0], [0, 1.5, -2.5], [0, 0.9, -8], [-1.2, 0.8, -10.8], [-4, 0.68, -12], [-6.8, 0.55, -10.8], [-8, 0.45, -8], [-8, 0, -3], [-8, 0, 0], [-6.3, 0, 3]],
    flyover: { height: 5.5, back: 6.5, side: 2 },
  });
  b.theme({
    skyTop: 0x163060, skyHorizon: 0x9ec0ea, skyBottom: 0xd6e8ff,
    sunDir: [-0.45, 0.5, 0.6], sunColor: 0xfff6e8, sunIntensity: 1.9, sunDisc: 0xfff8ee, sunSize: 2.2,
    hemiSky: 0xc5d8f5, hemiGround: 0xe8f2ff, hemiIntensity: 1.55,
    fog: 0xb8d0ee, fogDensity: 0.0062, outline: 0x141a3c,
    clouds: 0.35, cloudCut: 0.6, cloudColor: 0xbfd0f5, cloudShade: 0x8aa0d6,
    stars: 0.9, aurora: 0.85, ambient: 'snow', wind: 0.8, bloom: 0.5,
  });
  b.wallColor = 0x8fc7f2;
  b.wallCap = 0xffffff;
  b.wallMat = { ...MAT.ice, e: 0.55 };

  const SNOW = 0xf2f8ff, ICE = 0xa9e2ff;

  // tee platform
  const tee = [[-1.6, 1.5], [1.6, 1.5], [1.6, -2.5], [1.3, -2.5], [-1.3, -2.5], [-1.6, -2.5]];
  b.floor(tee, 1.5, { color: SNOW, mat: MAT.snow, pattern: PATTERN.sand, thick: 2.0, side: 0xbfdcf5 });
  b.border(tee, 1.5, { skip: [3], below: 0.3 });
  b.tee(0, 1.5, 0);

  // ice chute
  const samples = [];
  for (let i = 0; i <= 12; i++) {
    const s = i / 12;
    samples.push({ p: [0, lerp(1.5, 0.9, s), lerp(-2.5, -8, s)], bank: 0 });
  }
  for (let i = 1; i <= 26; i++) {
    const s = i / 26;
    const a = s * Math.PI;
    samples.push({ p: [-4 + 4 * Math.cos(a), lerp(0.9, 0.45, s), -8 - 4 * Math.sin(a)], bank: Math.sin(a) });
  }
  for (let i = 1; i <= 11; i++) {
    const s = i / 11;
    samples.push({ p: [-8, lerp(0.45, 0, s), lerp(-8, -3, s)], bank: 0 });
  }
  const n = samples.length;
  b.track(samples, {
    width: 2.6, segs: 8, mat: MAT.ice, color: ICE, pattern: PATTERN.ice,
    wallL: 0.5, wallR: 1.0, wallT: 0.2, wallMat: MAT.ice, wallColor: 0x8fc7f2, side: 0x7fb4e6, thick: 0.3,
    profile: (u, s) => {
      const k = samples[Math.min(n - 1, Math.round(s * (n - 1)))].bank;
      const out = Math.max(0, u);
      return 0.04 * u * u + k * 0.6 * out * out;
    },
  });

  // snowy green with an ice patch and a fishing hole
  const green = [[-11.5, -3], [-9.3, -3], [-6.7, -3], [-4.5, -3], [-4.5, 5], [-11.5, 5]];
  const pond = circlePoly(-10, 1.7, 0.85, 20);
  const patch = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU;
    const r = 1.35 + 0.3 * Math.sin(a * 3 + 1) + 0.15 * Math.sin(a * 5);
    patch.push([-8 + Math.cos(a) * r * 1.15, 0.2 + Math.sin(a) * r]);
  }
  b.floor(green, 0, { color: SNOW, mat: MAT.snow, pattern: PATTERN.sand, holes: [pond, patch], side: 0xbfdcf5 });
  b.floor(patch, 0, { color: ICE, mat: MAT.ice, pattern: PATTERN.ice, thick: 0 });
  b.pool(pond, { type: 'water', level: -0.13, depth: 0.37, bottom: 0x2a5f9a, water: { shallow: 0x7fd6ff, deep: 0x1b5fae, opacity: 0.9 } });
  b.border(green, 0, { skip: [1] });
  // snowmen stand in the way
  b.cyl(-5.7, -0.8, 0.46, -0.2, 1.3, { mat: MAT.snow, visual: false });
  b.cyl(-10.2, 4.0, 0.46, -0.2, 1.3, { mat: MAT.snow, visual: false });
  b.cyl(-8.6, 3.6, 0.3, -0.2, 0.9, { mat: MAT.ice, visual: false });
  b.cup(-6.3, 0, 3.0, { flagColor: 0xff4d6d });

  b.terrain({ y: -0.35, color: 0xf4f9ff, color2: 0xdcebff, color3: 0xffffff, cx: -4, cz: -4, flat: 22, hills: 6 });

  b.decor(() => {
    const rng = b.rng;
    b.prop(P.snowman(rng), -5.7, 0, -0.8, -2.2, 1, 'toon');
    b.prop(P.snowman(rng), -10.2, 0, 4.0, 2.6, 0.95, 'toon');
    b.prop(P.crystal(rng, 0x8fe3ff, 0xffffff, 0.8), -8.6, 0, 3.6, 0, 1, 'rim');
    // supports under the chute
    const sup = [];
    for (let i = 4; i < n - 6; i += 5) {
      const p = samples[i].p;
      const h = p[1] + 0.2;
      if (h < 0.4) continue;
      sup.push(part(cyl(0.22, 0.34, h, 8), 0x9ecff5, { p: [p[0], h / 2 - 0.4, p[2]], top: 0xdff2ff }));
      sup.push(part(box(2.9, 0.16, 0.3), 0x7fb4e6, { p: [p[0], p[1] - 0.38, p[2]], r: [0, Math.atan2(samples[i + 1].p[0] - p[0], samples[i + 1].p[2] - p[2]), 0] }));
    }
    b.put(merge(sup), 'toon');
    // start gate
    b.put(merge([
      part(cyl(0.09, 0.11, 2.4, 8), 0xe63946, { p: [-1.45, 2.7, -2.4] }),
      part(cyl(0.09, 0.11, 2.4, 8), 0xe63946, { p: [1.45, 2.7, -2.4] }),
      part(box(3.2, 0.45, 0.12), 0xffffff, { p: [0, 3.95, -2.4] }),
      part(box(3.2, 0.12, 0.14), 0xe63946, { p: [0, 3.7, -2.4] }),
      part(box(3.2, 0.12, 0.14), 0xe63946, { p: [0, 4.2, -2.4] }),
    ]), 'toon');

    S.mountains(b, { color: 0x6f86c4, snow: 0xffffff, snowLine: 0.4, cx: -4, cz: -4, h: 22, r: 18, count: 16 });
    b.prop(P.igloo(), 3.5, -0.35, 4.5, -2.4, 1.3, 'toon');
    // camp fire
    b.put(merge([
      part(cyl(0.07, 0.07, 0.8, 6), 0x6b4424, { p: [0.8, -0.27, 7.2], r: [0, 0.4, Math.PI / 2] }),
      part(cyl(0.07, 0.07, 0.8, 6), 0x6b4424, { p: [0.8, -0.27, 7.2], r: [0, 2.0, Math.PI / 2] }),
      part(cyl(0.07, 0.07, 0.8, 6), 0x6b4424, { p: [0.8, -0.2, 7.2], r: [0, 1.2, Math.PI / 2] }),
    ]), 'toon');
    S.flame(b, 0.8, -0.2, 7.2, { s: 1.5, intensity: 12, distance: 12 });
    b.emitter({ min: [0.6, 0.3, 7], max: [1.0, 0.5, 7.4], rate: 9, life: [0.8, 1.6], size: [0.04, 0.08], colors: [0xffb347, 0xff7a12], vel: [0, 1.6, 0], spread: [0.3, 0.5, 0.3], additive: true, bright: 2.2 });

    b.scatter(34, [-36, -38, 30, 28], (x, y, z) => b.prop(P.pine(rng, { snow: true, leaf: 0x2a7f66, leaf2: 0x5fc29a }), x, y - 0.05, z, rng() * TAU, 0.9 + rng() * 0.8, 'sway'), { margin: 3, minDist: 3 });
    b.scatter(12, [-24, -26, 18, 18], (x, y, z) => b.prop(P.crystal(rng, 0x7de3ff, 0xffffff, 0.7 + rng() * 0.8), x, y - 0.05, z, rng() * TAU, 1, 'rim'), { margin: 1.2, minDist: 3 });
    b.scatter(14, [-24, -26, 18, 18], (x, y, z) => b.prop(P.rock(rng, 0.4 + rng() * 0.6, 0xa9bfe0, 0xffffff), x, y, z, 0, 1, 'toon'), { margin: 1, minDist: 2 });
    b.prop(P.snowman(rng), 2.8, -0.35, -4.6, -0.9, 1.1, 'toon');

    b.critter(C.penguin({ cx: -1.5, cz: 3.2, radius: 2.0, speed: 0.55, y: -0.35, phase: 0 }));
    b.critter(C.penguin({ cx: -1.5, cz: 3.2, radius: 2.0, speed: 0.55, y: -0.35, phase: 0.9, s: 0.8 }));
    b.critter(C.penguin({ cx: -1.5, cz: 3.2, radius: 2.0, speed: 0.55, y: -0.35, phase: 1.7, s: 0.7 }));
    b.critter(C.penguin({ cx: -14.5, cz: -1, radius: 1.6, speed: 0.5, y: -0.35, phase: 2, dir: -1 }));
    b.critter(C.penguin({ cx: -4, cz: -7.5, radius: 1.3, speed: 0.45, y: -0.35, phase: 4, s: 0.9 }));
    for (let i = 0; i < 7; i++) {
      b.critter(C.wisp({ x: -12 + rng() * 16, y: 1.5 + rng() * 2.5, z: -14 + rng() * 20, r: 1.5 + rng() * 2, color: rng.pick([0x9be7ff, 0xc9b6ff, 0xffffff]), size: 0.3, phase: rng() * 10, speed: 0.6 }));
    }
    b.emitter({
      follow: true, min: [-16, 5, -16], max: [16, 9, 16], rate: 60, life: [5, 8], size: [0.05, 0.11],
      colors: [0xffffff, 0xe6f2ff], vel: [0.5, -1.5, 0.2], spread: [0.5, 0.3, 0.5], alpha: 0.9,
    });
    b.light(-8, 1.6, 1, 0x9be7ff, 4, 9, 0);
  });

  return b.finish();
}
