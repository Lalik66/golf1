// Hole 1 - Sunny Meadow. A gentle opener: roll over the mound, avoid the mushrooms.
import { CourseBuilder, MAT, PATTERN } from '../builder.js';
import * as P from '../props.js';
import * as C from '../critters.js';
import * as S from '../scenery.js';
import { TAU } from '../utils.js';

export default function build(opts = {}) {
  const b = new CourseBuilder({ ...opts, seed: 101 });
  b.meta({
    name: 'Sunny Meadow', par: 2,
    hint: 'A gentle start. Roll over the mound and mind the bouncy mushrooms.',
    path: [[0, 0, 0], [0, 0, -6], [0.5, 0, -11], [0.9, 0, -15.5]],
  });
  b.theme({
    skyTop: 0xc46a2a, skyHorizon: 0xffd7a8, skyBottom: 0x8aa04a,
    sunDir: [0.5, 0.78, 0.38], sunColor: 0xffe0b0,
    hemiSky: 0xffe4c4, hemiGround: 0x6d8a32,
    fog: 0xf3ddb8, fogDensity: 0.0055, ambient: 'meadow',
  });
  b.wallColor = 0x8a5a32;
  b.wallCap = 0xd4a06a;

  const GREEN = 0x7d9a32;
  const outline = [
    [-2, 2], [2, 2], [2, -10.5], [3.6, -12.5], [3.6, -17], [2.4, -18.4],
    [-2.4, -18.4], [-3.6, -17], [-3.6, -12.5], [-2, -10.5],
  ];
  b.rect(-2, 2, 2, -4, 0, { color: GREEN });
  const bump = (u) => (Math.abs(u) >= 1 ? 0 : Math.pow(Math.cos(u * Math.PI / 2), 2));
  b.height(-2, -8, 2, -4, 16, 16, (x, z) => 0.46 * bump(x / 2) * bump((z + 6) / 2), { color: GREEN });
  b.floor([
    [-2, -8], [2, -8], [2, -10.5], [3.6, -12.5], [3.6, -17], [2.4, -18.4],
    [-2.4, -18.4], [-3.6, -17], [-3.6, -12.5], [-2, -10.5],
  ], 0, { color: GREEN });
  b.border(outline, 0);

  b.tee(0, 0, 0);
  b.cup(0.9, 0, -15.5);

  b.bumper(-1.9, -12.9, 0, { soft: true, color: 0xff4d4d, capColor: 0xff4d4d, band: 0xfff2dc, r: 0.42 });
  b.bumper(2.2, -13.6, 0, { soft: true, color: 0xffa62b, capColor: 0xffa62b, band: 0xfff2dc, r: 0.42 });
  b.bumper(-0.7, -16.9, 0, { soft: true, color: 0xb26bff, capColor: 0xb26bff, band: 0xfff2dc, r: 0.42 });

  b.terrain({ y: -0.35, color: 0x8aa84a, color2: 0x6d8a32, color3: 0x9bb85a, cz: -8, flat: 24, dips: [{ x: -11, z: -7, r: 6.5, d: 1.0 }] });

  b.decor(() => {
    const rng = b.rng;
    S.mountains(b, { color: 0xa07a4a, snowLine: 0.7, cz: -8 });
    S.clouds(b, { count: 8 });
    S.pond(b, -11, -7, 5.2, -0.62);
    for (let i = 0; i < 7; i++) {
      const a = rng() * TAU, d = rng() * 3.6;
      b.prop(P.lilyPad(rng), -11 + Math.cos(a) * d, -0.6, -7 + Math.sin(a) * d, 0, 1, 'double');
    }
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + rng() * 0.4;
      b.prop(P.reed(rng), -11 + Math.cos(a) * 5.0, -0.7, -7 + Math.sin(a) * 5.0, 0, 1, 'sway');
    }
    b.critter(C.duck({ cx: -11, cz: -7, radius: 2.6, speed: 0.5, y: -0.62, phase: 0 }));
    b.critter(C.duck({ cx: -11.5, cz: -6.5, radius: 1.3, speed: 0.4, y: -0.62, phase: 2.5, dir: -1, s: 0.7 }));
    b.critter(C.duck({ cx: -11.3, cz: -6.7, radius: 1.5, speed: 0.4, y: -0.62, phase: 3.1, dir: -1, s: 0.6 }));

    const notPond = (x, z) => Math.hypot(x + 11, z + 7) < 7;
    b.scatter(30, [-34, -46, 34, 18], (x, y, z) => b.prop(P.tree(rng), x, y - 0.05, z, rng() * TAU, 0.9 + rng() * 0.7, 'sway'), { margin: 3.2, minDist: 3.2, reject: notPond });
    b.scatter(16, [-30, -40, 30, 14], (x, y, z) => b.prop(P.bush(rng, { berries: rng() < 0.4 ? 0xff4d6d : undefined }), x, y - 0.05, z, rng() * TAU, 0.8 + rng() * 0.6, 'sway'), { margin: 1.4, minDist: 2, reject: notPond });
    const fc = [0xff5fa2, 0xffd23f, 0xffffff, 0xb26bff, 0xff7043, 0x4fc3f7];
    b.scatter(150, [-14, -28, 14, 8], (x, y, z) => b.prop(P.flower(rng, rng.pick(fc)), x, y - 0.02, z, rng() * TAU, 0.9 + rng() * 0.6, 'sway'), { margin: 0.5, reject: notPond });
    b.scatter(14, [-16, -30, 16, 8], (x, y, z) => b.prop(P.rock(rng, 0.3 + rng() * 0.4, 0x9aa0ae, 0xc4c9d6), x, y, z, 0, 1, 'toon'), { margin: 0.8, reject: notPond });
    b.scatter(10, [-12, -26, 12, 6], (x, y, z) => b.prop(P.mushroom(rng, { s: 0.6 + rng() * 0.5, color: rng.pick([0xff4d4d, 0xffa62b, 0xb26bff]) }), x, y, z, 0, 1, 'toon'), { margin: 0.7, reject: notPond });
    b.prop(P.fence(5), 5.2, -0.35, 0.5, Math.PI / 2, 1, 'toon');
    b.prop(P.fence(5), -5.2, -0.35, 0.5, Math.PI / 2, 1, 'toon');
    b.prop(P.hut(rng, { roof: 0xe0523f }), 9.5, -0.35, -22, -0.6, 1.5, 'toon');
    S.arrowSign(b, 2.9, -0.35, 1.2, [0, -1]);

    b.grass({ count: 9000, around: true, spread: 11, height: 0.5, base: 0x3d9a44, tip: 0xa8e86a, reject: notPond, cut: 0.3 });

    const bc = [0xff9f1c, 0x4fc3f7, 0xff5fa2, 0xffffff, 0xffd23f];
    for (let i = 0; i < 9; i++) {
      b.critter(C.butterfly({ x: -6 + rng() * 12, y: 0.9 + rng() * 0.8, z: -18 + rng() * 18, r: 1.5 + rng() * 2.5, color: rng.pick(bc), phase: rng() * 10 }));
    }
    b.critter(C.bunny({ cx: 6.5, cz: -7, radius: 2.2, speed: 1.1, y: -0.35, phase: 0.2 }));
    b.critter(C.bunny({ cx: -6.2, cz: -15, radius: 1.7, speed: 1.0, y: -0.35, phase: 0.7, dir: -1, color: 0xd9b38c }));
    b.critter(C.bunny({ cx: 7, cz: -16, radius: 1.4, speed: 1.0, y: -0.35, phase: 0.45, color: 0xffffff, s: 0.8 }));
    for (let i = 0; i < 4; i++) {
      b.critter(C.bird({ cx: rng.range(-8, 8), cz: rng.range(-16, -2), radius: 9 + rng() * 8, speed: 3.5 + rng(), y: 7 + rng() * 5, phase: rng() * 6, dir: rng.sign(), color: rng.pick([0x3d5a80, 0xe63946, 0xffb703]) }));
    }
    b.emitter({
      follow: true, min: [-14, 0.3, -14], max: [14, 4, 14], rate: 5, life: [4, 7], size: [0.05, 0.09],
      colors: [0xffffff, 0xfff7c2], vel: [0.5, 0.1, 0.2], spread: [0.3, 0.2, 0.3], alpha: 0.8,
    });
  });

  return b.finish();
}
