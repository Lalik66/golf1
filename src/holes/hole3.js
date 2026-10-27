// Hole 3 - Pirate Cove. Take the rickety bridge, or launch over the lagoon.
import * as THREE from 'three';
import { CourseBuilder, MAT, PATTERN } from '../builder.js';
import * as P from '../props.js';
import * as C from '../critters.js';
import * as S from '../scenery.js';
import { part, merge, box, cyl, sph, cone, rockGeo } from '../geo.js';
import { toonMat } from '../materials.js';
import { makeFlagMaterial } from '../shaders.js';
import { LAYER_FX } from '../materials.js';
import { TAU } from '../utils.js';

const SEA = -0.7;

export default function build(opts = {}) {
  const b = new CourseBuilder({ ...opts, seed: 303 });
  b.meta({
    name: 'Pirate Cove', par: 3,
    hint: 'Play it safe over the bridge, or hit the ramp at full power and fly across.',
    path: [[0, 0, 0], [-5.5, 0, -5], [-5.5, 0.35, -10], [-5.5, 0, -14.2], [-3.6, 0, -15.6], [1.2, 0, -19.2]],
    flyover: { side: 6, height: 5, back: 7 },
  });
  b.theme({
    skyTop: 0xc46a32, skyHorizon: 0xffc98a, skyBottom: 0x3a9aaa,
    sunDir: [0.55, 0.7, 0.3], sunColor: 0xffe0b8, sunIntensity: 2.5,
    hemiSky: 0xffd8b0, hemiGround: 0x4a8a78, fog: 0xf0d2b0, fogDensity: 0.0048,
    ambient: 'sea', cloudCut: 0.55, wind: 1.2,
  });
  b.wallColor = 0x8a5528;
  b.wallCap = 0xd4a06a;
  b.wallMat = MAT.wood;

  const WOOD = 0xc99258, TURF = 0x7d9a32, SAND = 0xf2d2a0;
  const deck = [[-2, 2], [2, 2], [2, -7], [-4.8, -7], [-6.2, -7], [-7, -7], [-7, -3], [-2, -3]];
  b.floor(deck, 0, { color: WOOD, pattern: PATTERN.planks, mat: MAT.plank, side: 0x8a5a33 });
  b.border(deck, 0, { skip: [3] });

  // launch ramp
  b.ramp([-0.8, 0, -4.6], [0.8, 0, -4.6], [0.8, 0.9, -7], [-0.8, 0.9, -7], { color: 0xf2c46a, pattern: PATTERN.planks, mat: MAT.plank, base: 0, side: 0x9a6336 });
  b.world.addTriUp([-0.8, 0, -4.6], [-0.8, 0, -7], [-0.8, 0.9, -7], MAT.wood, [-1, 0, 0]);
  b.world.addTriUp([0.8, 0, -4.6], [0.8, 0, -7], [0.8, 0.9, -7], MAT.wood, [1, 0, 0]);

  // bridge
  const samples = [];
  for (let i = 0; i <= 16; i++) {
    const s = i / 16;
    samples.push({ p: [-5.5, 0.35 * Math.sin(Math.PI * s), -7 - 6 * s] });
  }
  b.track(samples, { width: 1.4, segs: 2, wallL: 0.1, wallR: 0.1, wallT: 0.1, mat: MAT.plank, color: WOOD, pattern: PATTERN.planks, wallColor: 0x8a5a33, side: 0x8a5a33, thick: 0.18 });

  // island
  const island = [[-3, -10.6], [3, -10.6], [3, -21], [-3, -21], [-3, -17], [-7, -17], [-7, -13], [-6.2, -13], [-4.8, -13], [-3, -13]];
  b.rect(-3, -10.6, 3, -14.5, 0, { color: TURF, mat: MAT.green, side: 0xc9a86a });
  b.rect(-3, -14.5, 3, -17, 0, { color: SAND, mat: MAT.sand, pattern: PATTERN.sand, side: 0xc9a86a });
  b.rect(-3, -17, 3, -21, 0, { color: TURF, mat: MAT.green, side: 0xc9a86a });
  b.rect(-7, -13, -3, -17, 0, { color: TURF, mat: MAT.green, side: 0xc9a86a });
  b.border(island, 0, { skip: [7] });
  b.rock(-1.6, 0, -18.4, 0.5, { color: 0x9aa0ae, top: 0xc4c9d6 });
  b.cyl(2.2, -12.2, 0.34, -0.2, 0.8, { mat: MAT.wood, color: 0xa8683a, visual: false });

  b.tee(0, 0, 0);
  b.cup(1.2, 0, -19.2, { flagColor: 0x23232e });

  b.sea(SEA, { water: { shallow: 0x5fe0e8, deep: 0x1b86c9 }, z: -10 });

  b.decor(() => {
    const rng = b.rng;
    // pillars under the decks
    const posts = [];
    for (const [x, z] of [[-1.8, 1.8], [1.8, 1.8], [1.8, -6.8], [-1.8, -6.8], [-6.8, -6.8], [-6.8, -3.2], [-2.8, -10.8], [2.8, -10.8], [2.8, -20.8], [-2.8, -20.8], [-6.8, -16.8], [-6.8, -13.2], [-5.5, -8.5], [-5.5, -11.5], [0, -2.5], [0, -15.5]]) {
      posts.push(part(cyl(0.16, 0.18, 2.6, 8), 0x7a4a2b, { p: [x, -1.6, z] }));
    }
    // rope rail of the bridge
    for (let i = 0; i <= 6; i++) {
      const s = i / 6;
      const y = 0.35 * Math.sin(Math.PI * s);
      for (const sx of [-1, 1]) {
        posts.push(part(cyl(0.035, 0.04, 0.55, 6), 0x7a4a2b, { p: [-5.5 + sx * 0.78, y + 0.25, -7 - 6 * s] }));
        if (i < 6) {
          const y2 = 0.35 * Math.sin(Math.PI * (i + 1) / 6);
          const g = cyl(0.018, 0.018, 1.02, 5);
          g.rotateX(Math.PI / 2 - Math.atan2(y2 - y, 1));
          posts.push(part(g, 0xe8d8a8, { p: [-5.5 + sx * 0.78, (y + y2) / 2 + 0.46, -7.5 - 6 * s] }));
        }
      }
    }
    b.put(merge(posts), 'toon');
    b.prop(P.barrel(), 2.2, 0, -12.2, 0, 1, 'toon');
    b.prop(P.chest(), -2.2, 0, -20.2, 0.5, 1, 'toon');
    b.prop(P.barrel(), -6.4, 0, -3.6, 0, 0.9, 'toon');
    b.prop(P.crate(0.6), 1.5, 0, 1.5, 0.3, 1, 'toon');
    S.arrowSign(b, -2.5, 0, -3.4, [-1, -0.4], 0xffd23f);
    for (const [x, z] of [[-1.9, 1.9], [1.9, 1.9], [2.9, -20.9], [-6.9, -16.9]]) {
      b.prop(P.torchPost({ h: 1.5, color: 0x6b4424 }), x, 0.4, z, 0, 1, 'toon');
      S.flame(b, x, 2.05, z, { s: 0.9, intensity: 3, distance: 6 });
    }

    // sandy islets with palms
    const islets = [[11, -24, 5], [-14, -22, 6], [-13, 2, 5], [9, 6, 4.5], [17, -6, 4], [-2, -33, 7]];
    const isl = [];
    for (const [x, z, r] of islets) {
      const g = sph(1, 16, 8);
      g.scale(r, 1.3, r);
      isl.push(part(g, 0xf0d98c, { p: [x, SEA - 0.25, z], top: 0xfff0b8 }));
      const n = 2 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i++) {
        const a = rng() * TAU, d = rng() * r * 0.5;
        b.prop(P.palm(rng), x + Math.cos(a) * d, SEA + 0.75, z + Math.sin(a) * d, rng() * TAU, 0.9 + rng() * 0.4, 'sway');
      }
      b.prop(P.rock(rng, 0.5 + rng() * 0.5, 0x9aa0ae, 0xc4c9d6), x + r * 0.5, SEA + 0.4, z - r * 0.3, 0, 1, 'toon');
      b.critter(C.crab({ x: x - r * 0.2, y: SEA + 0.85, z: z + r * 0.35, range: 1.2, speed: 0.7 + rng() * 0.5, phase: rng() * 6, rot: rng() * 3 }));
    }
    b.put(merge(isl), 'toon');
    b.prop(P.chest(), 11.5, SEA + 0.95, -23, -0.6, 1.2, 'toon');
    b.prop(P.bush(rng, { color: 0x3aa655 }), -14.5, SEA + 0.8, -20.5, 0, 1.2, 'sway');

    // cliff with a waterfall at the back
    const cliff = [];
    for (let i = 0; i < 9; i++) {
      const r = 3 + rng() * 2.5;
      cliff.push(part(rockGeo(r, rng, 1.1, 1), 0x7f8aa0, { p: [-2 + (rng() - 0.5) * 10, SEA + 1 + rng() * 3.5, -36 - rng() * 4], top: 0xa9b3c7 }));
    }
    cliff.push(part(box(3.2, 0.4, 2.2), 0x6f7a90, { p: [-2, 6.3, -35.2] }));
    b.put(merge(cliff), 'toon');
    S.waterfall(b, -2, 6.4, SEA, -33.6, 3.0, { color: 0x7fe3f2 });
    b.prop(P.palm(rng), 2.5, SEA + 5.4, -37, 0, 1.2, 'sway');
    b.prop(P.palm(rng), -6.5, SEA + 4.6, -37.5, 2, 1.0, 'sway');

    // pirate ship
    const ship = new THREE.Group();
    const hull = new THREE.Mesh(P.shipHull(), toonMat({ rim: 0.15 }));
    hull.castShadow = true;
    ship.add(hull);
    const s1 = C.sail(2.6, 1.7, 0xf7f1dc, 0xe8503a);
    s1.position.set(0, 4.45, 0.42);
    const s2 = C.sail(2.2, 1.3, 0xf7f1dc);
    s2.position.set(0, 3.1, 0.42);
    s2.scale.set(1.15, 1, 1);
    const s3 = C.sail(1.8, 1.3, 0xf7f1dc, 0xe8503a);
    s3.position.set(0, 3.5, 2.32);
    ship.add(s1, s2, s3);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55, 12, 5).translate(0.45, 0, 0), makeFlagMaterial(0x23232e, 0xffffff));
    flag.position.set(0, 6.75, 0.3);
    flag.layers.set(LAYER_FX);
    ship.add(flag);
    ship.scale.setScalar(1.25);
    b.add(ship);
    b.anim((t) => {
      ship.position.set(12.5, SEA - 0.35 + Math.sin(t * 0.9) * 0.12, -13);
      ship.rotation.set(Math.sin(t * 0.8) * 0.035, -2.2 + Math.sin(t * 0.2) * 0.05, Math.sin(t * 1.1) * 0.05);
    });

    // sea life
    b.critter(C.sharkFin({ cx: 0.5, cz: -8.8, radius: 1.3, rx: 1.9, rz: 0.75, speed: 0.9, y: SEA - 0.05, phase: 0 }));
    b.critter(C.sharkFin({ cx: 8, cz: -2, radius: 4, speed: 1.2, y: SEA - 0.05, phase: 2, dir: -1 }));
    b.critter(C.fish({ x: 5, y: SEA, z: -8.5, angle: 0.6, period: 5.5, phase: 0.1 }));
    b.critter(C.fish({ x: -9.5, y: SEA, z: -10, angle: 2.4, period: 7, phase: 0.5, color: 0x4fc3f7 }));
    b.critter(C.fish({ x: 6, y: SEA, z: -24, angle: 4, period: 6.3, phase: 0.8, color: 0xffd23f }));
    for (let i = 0; i < 6; i++) {
      b.critter(C.bird({ cx: rng.range(-6, 8), cz: rng.range(-20, -2), radius: 9 + rng() * 9, speed: 3.2 + rng(), y: 8 + rng() * 5, phase: rng() * 6, dir: rng.sign(), color: 0xf4f4f8, belly: 0xffffff, beak: 0xffb703, s: 1.3, flap: 5 }));
    }
    S.mountains(b, { color: 0x8a9a62, snowLine: 2, cz: -10, h: 10, r: 18, dist: 120, y: SEA - 2, count: 9 });
    S.clouds(b, { count: 8, y: 26 });
    // floating barrels and a buoy
    const floats = [];
    for (const [x, z] of [[4.5, -4], [-10, -8], [6.5, -17]]) {
      const m = new THREE.Mesh(P.barrel(), toonMat({}));
      m.castShadow = true;
      b.add(m);
      floats.push({ m, x, z, ph: rng() * 6 });
    }
    b.anim((t) => {
      for (const f of floats) {
        f.m.position.set(f.x + Math.sin(t * 0.3 + f.ph) * 0.3, SEA - 0.35 + Math.sin(t * 1.3 + f.ph) * 0.06, f.z);
        f.m.rotation.set(1.3 + Math.sin(t + f.ph) * 0.1, f.ph, Math.sin(t * 0.8 + f.ph) * 0.15);
      }
    });
    b.emitter({
      min: [-8, SEA, -10.4], max: [4, SEA + 0.1, -7.2], rate: 5, life: [0.8, 1.4], size: [0.05, 0.1],
      colors: [0xffffff], vel: [0, 0.6, 0], spread: [0.3, 0.3, 0.3], alpha: 0.7, gravity: 1,
    });
  });

  return b.finish();
}
