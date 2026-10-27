// Hole 5 - Dino Valley. Rexy guards the fairway: dodge the bite, slip between
// the legs and get past the sweeping tail.
import * as THREE from 'three';
import { CourseBuilder, MAT, PATTERN } from '../builder.js';
import * as P from '../props.js';
import * as C from '../critters.js';
import * as S from '../scenery.js';
import { part, merge, box, cyl, sph, cone, rockGeo } from '../geo.js';
import { addRex } from '../dino.js';
import { TAU } from '../utils.js';

export default function build(opts = {}) {
  const b = new CourseBuilder({ ...opts, seed: 505 });
  b.meta({
    name: 'Dino Valley', par: 3,
    hint: 'Wait for Rexy to lift his head, then slip between his legs and past the tail.',
    path: [[0, 0, 0], [0, 0, -6], [0, 0, -11], [0, 0, -18], [1, 0, -22.6]],
    flyover: { side: 9.5, height: 3.6, back: 7.5 },
  });
  b.theme({
    skyTop: 0xd4783a, skyHorizon: 0xffd7a0, skyBottom: 0x7d9a32,
    sunDir: [0.6, 0.62, 0.35], sunColor: 0xffe0b0, sunIntensity: 2.5,
    hemiSky: 0xf0ddb0, hemiGround: 0x5a7a30, fog: 0xe8d8a8, fogDensity: 0.0075,
    ambient: 'jungle', cloudCut: 0.55, wind: 0.9,
  });
  b.wallColor = 0x8a5a32;
  b.wallCap = 0xc49258;
  b.wallMat = MAT.wood;

  const TURF = 0x6f8a34;
  const outline = [[-2.45, 2], [2.45, 2], [2.45, -23.5], [1.2, -25.2], [-1.2, -25.2], [-2.45, -23.5]];
  b.floor(outline, 0, { color: TURF, side: 0x8a6840 });
  b.border(outline, 0);
  b.tee(0, 0, 0);
  b.cup(1.0, 0, -22.6, { flagColor: 0xff8a1f });

  addRex(b, [0, 0, -11.2]);

  b.rock(-0.9, 0, -21.2, 0.42, { color: 0x9a927f, top: 0xc9c2ae });
  b.world.addSphere([1.95, 0.35, -19.9], 0.42, { mat: MAT.stone });

  b.terrain({ y: -0.35, color: 0x6a8430, color2: 0x587028, color3: 0x8aa048, cz: -11, flat: 24, hills: 7, dips: [{ x: 11, z: -18, r: 6, d: 1.1 }] });

  b.decor(() => {
    const rng = b.rng;
    b.prop(P.egg(0xf7f1dc, 0x8fc46a, 1), 1.95, -0.05, -19.9, 0.4, 1, 'rim');
    // volcano on the horizon
    const vol = P.mountain(rng, 34, 38, 0x6b5a52, 0xff6a2a, 0.9);
    b.prop(vol, 38, -2, -78, 0, 1, 'toon');
    b.put(part(sph(5, 12, 8), 0xff8a3c, { p: [38, 35, -78], s: [1, 0.35, 1] }), 'glow');
    b.emitter({ min: [35, 36, -81], max: [41, 38, -75], rate: 6, life: [6, 10], size: [4, 8], colors: [0x6a5f62, 0x8a7f80], vel: [1.2, 2.4, 0], spread: [0.6, 0.5, 0.6], alpha: 0.5, grow: 1.6 });
    S.mountains(b, { color: 0x6a8a40, snowLine: 2, cz: -11, h: 16, r: 20, count: 12 });
    S.clouds(b, { count: 6, y: 28 });

    // nest and bones
    const nest = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      nest.push(part(cyl(0.08, 0.08, 1.3, 5), 0x8a6a3a, { p: [-6.5 + Math.cos(a) * 1.1, -0.2, -5 + Math.sin(a) * 1.1], r: [0.3, -a, Math.PI / 2 - 0.2] }));
    }
    b.put(merge(nest), 'toon');
    const eggs = [];
    for (const [x, z, s, r] of [[-6.8, -5.2, 0.8, 0.2], [-6.1, -4.7, 0.7, -0.3], [-6.4, -5.6, 0.75, 0.1]]) {
      const g = P.egg(0xf7f1dc, 0xc98adf, s);
      const m = new THREE.Mesh(g, b._materialFor('rim'));
      m.position.set(x, -0.3, z);
      m.castShadow = true;
      b.add(m);
      eggs.push({ m, r });
    }
    b.anim((t) => {
      eggs.forEach((e, i) => {
        const w = Math.max(0, Math.sin(t * 0.9 + i * 2.1) - 0.6) * 2.5;
        e.m.rotation.z = Math.sin(t * 17 + i) * 0.12 * w + e.r;
      });
    });
    b.prop(P.ribcage(), 6.8, -0.3, -15, 0.5, 1.2, 'toon');
    b.prop(P.bone(1.4), 4.2, -0.3, -3, 0.8, 1, 'toon');
    b.prop(P.bone(1.1), -4.6, -0.3, -21, -0.4, 1, 'toon');

    // jungle
    b.scatter(26, [-34, -46, 34, 22], (x, y, z) => b.prop(P.palm(rng, { h: 4 + rng() * 2.5 }), x, y - 0.05, z, rng() * TAU, 1.1 + rng() * 0.6, 'sway'), { margin: 3.4, minDist: 3.5, reject: (x, z) => Math.hypot(x - 11, z + 18) < 6.5 });
    b.scatter(18, [-34, -46, 34, 22], (x, y, z) => b.prop(P.tree(rng, { leaf: 0x2f8f3f, leaf2: 0x7fcf5a, h: 3 + rng() * 2 }), x, y - 0.05, z, rng() * TAU, 1.3 + rng() * 0.8, 'sway'), { margin: 6, minDist: 4, reject: (x, z) => Math.hypot(x - 11, z + 18) < 6.5 });
    b.scatter(70, [-16, -32, 16, 8], (x, y, z) => b.prop(P.fern(rng, { s: 0.8 + rng() * 0.8 }), x, y, z, rng() * TAU, 1, 'sway'), { margin: 0.7, minDist: 0.9, reject: (x, z) => Math.hypot(x - 11, z + 18) < 5.2 });
    b.scatter(22, [-16, -32, 16, 8], (x, y, z) => b.prop(P.rock(rng, 0.35 + rng() * 0.7, 0x8f8a7a, 0xbdb7a3), x, y, z, 0, 1, 'toon'), { margin: 0.9, minDist: 2, reject: (x, z) => Math.hypot(x - 11, z + 18) < 5 });
    b.scatter(16, [-14, -30, 14, 8], (x, y, z) => b.prop(P.mushroom(rng, { s: 0.5 + rng() * 0.5, color: rng.pick([0xffa62b, 0xb26bff]) }), x, y, z, 0, 1, 'toon'), { margin: 0.8, reject: (x, z) => Math.hypot(x - 11, z + 18) < 5 });

    // watering hole with a little waterfall
    S.pond(b, 11, -18, 4.6, -0.7, { shallow: 0x6fe0d0, deep: 0x1f8f9a });
    const rocks = [];
    for (let i = 0; i < 7; i++) rocks.push(part(rockGeo(1.6 + rng() * 1.2, rng, 1.1, 1), 0x7f8a7a, { p: [13.5 + rng() * 3, 0.6 + rng() * 2.2, -22 + rng() * 3 - 1.5], top: 0xa9b39f }));
    b.put(merge(rocks), 'toon');
    S.waterfall(b, 13.2, 3.6, -0.7, -19.6, 1.8, { rotY: -0.7, color: 0x7fe3e0 });
    for (let i = 0; i < 6; i++) b.prop(P.reed(rng), 11 + Math.cos(i * 1.1) * 4.6, -0.75, -18 + Math.sin(i * 1.1) * 4.6, 0, 1, 'sway');

    // creatures
    b.critter(C.raptor({ cx: -8.5, cz: -14, radius: 3.2, speed: 3.2, y: -0.35, phase: 0 }));
    b.critter(C.raptor({ cx: -8.5, cz: -14, radius: 3.2, speed: 3.2, y: -0.35, phase: 0.8, s: 0.8, color: 0xd98a3a, color2: 0xf7e3a0 }));
    b.critter(C.raptor({ cx: 7.5, cz: -4, radius: 2.4, speed: 2.6, y: -0.35, phase: 2, dir: -1, color: 0x4f9ad9, color2: 0xe3f1ff, s: 0.9 }));
    b.critter(C.pterodactyl({ cx: 0, cz: -12, radius: 17, speed: 5, y: 13, phase: 0 }));
    b.critter(C.pterodactyl({ cx: 4, cz: -8, radius: 24, speed: 5.5, y: 17, phase: 3, dir: -1, s: 0.8, color: 0x7a5a8a }));
    for (let i = 0; i < 6; i++) {
      b.critter(C.butterfly({ x: -8 + rng() * 16, y: 0.8 + rng(), z: -22 + rng() * 22, r: 2 + rng() * 2, color: rng.pick([0x38f0ff, 0x7dff8a, 0xffd23f]), phase: rng() * 10, s: 1.2 }));
    }
    b.grass({ count: 8000, around: true, spread: 9, height: 0.62, base: 0x2f8a3a, tip: 0x8fe05a, cut: 0.28, reject: (x, z) => Math.hypot(x - 11, z + 18) < 5 });
    b.emitter({
      follow: true, min: [-14, 0.3, -14], max: [14, 5, 14], rate: 4, life: [4, 7], size: [0.05, 0.09],
      colors: [0xfff7c2, 0xd9ffb0], vel: [0.3, 0.15, 0.2], spread: [0.3, 0.2, 0.3], alpha: 0.8,
    });
  });

  return b.finish();
}
