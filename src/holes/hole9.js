// Hole 9 - Cosmic Loop. Low gravity finale: booster, loop-the-loop, a leap
// across the void, a bumper field and a guarded island green.
import * as THREE from 'three';
import { CourseBuilder, MAT, PATTERN } from '../builder.js';
import * as P from '../props.js';
import * as C from '../critters.js';
import * as S from '../scenery.js';
import { part, merge, box, cyl, sph, cone, torus, rockGeo } from '../geo.js';
import { toonMat, glowMat, LAYER_FX } from '../materials.js';
import { TAU, circlePoly } from '../utils.js';

const R = 1.7, SHIFT = 2.2, LOOP_Z = -9;
const ISLE = [-10.5, -27];
const Y_AXIS = new THREE.Vector3(0, 1, 0);

export default function build(opts = {}) {
  const b = new CourseBuilder({ ...opts, seed: 909 });
  b.meta({
    name: 'Cosmic Loop', par: 5,
    hint: 'Roll onto the booster and enjoy the ride. Then cross the light bridge and beat the sweeper.',
    path: [[0, 0, 0], [0, 0, -8.6], [SHIFT, 0, -9.6], [SHIFT, 0, -13], [SHIFT, 0.72, -15.5], [SHIFT, 0, -24.5], [-3.4, 0, -27], [-7.9, 0, -27], [-11.4, 0, -28]],
    flyover: {
      duration: 9,
      keys: [
        { pos: [-16, 5, -22], look: [-10.5, 0, -27] },
        { pos: [-6, 7, -17], look: [0, 0, -27] },
        { pos: [9, 6, -20], look: [2, 0.5, -17] },
        { pos: [8, 4.5, -8], look: [1.5, 1.6, -9.5] },
        { pos: [3.5, 3.4, 1], look: [0.8, 1.2, -8] },
        { pos: [0, 1.9, 3.2], look: [0, 0.4, -4] },
      ],
    },
  });
  b.theme({
    skyTop: 0x120810, skyHorizon: 0x4a2040, skyBottom: 0x1a0c10,
    sunDir: [0.45, 0.62, -0.5], sunColor: 0xffd8b0, sunIntensity: 2.3, sunDisc: 0xfff4e4, sunSize: 0.7,
    hemiSky: 0xc07090, hemiGround: 0x4a2818, hemiIntensity: 1.1,
    fog: 0x140810, fogDensity: 0.0022, outline: 0x05030f,
    clouds: 0, stars: 1.3, nebula: 0.55, nebulaA: 0xc23b4a, nebulaB: 0xe8741a,
    ambient: 'space', bloom: 0.5, bloomThreshold: 0.9, wind: 0,
  });
  // Load-bearing tuning: completing this hole relies on the ballistic launch off
  // the ramp clearing the void gap, which depends on this gravity together with
  // the booster speeds below. Changing either can make the hole uncompletable —
  // re-run `npm run verify -- 9` after any change here.
  b.world.gravity = 14;
  b.world.killY = -5;
  b.world.killType = 'void';
  b.wallColor = 0x3a2820;
  b.wallCap = 0xe8a15a;
  b.capKind = 'glowSoft';
  b.wallMat = MAT.metal;
  b.wallH = 0.42;
  b.floorThick = 0.4;

  const FLOOR = 0x3a2430;
  const neon = { color: FLOOR, pattern: PATTERN.neon, glowColor: 0xe8a15a, mat: MAT.neon, side: 0x241610 };
  const neon2 = { color: 0x4a2838, pattern: PATTERN.neon, glowColor: 0xc23b4a, mat: MAT.neon, side: 0x241610 };

  // ---- start pad
  const start = [[-1.6, 2], [1.6, 2], [1.6, -4], [0.7, -4], [-0.7, -4], [-1.6, -4]];
  b.floor(start, 0, neon);
  b.border(start, 0, { skip: [3] });
  b.tee(0, 0, 0);

  // ---- lane + loop + exit lane + launch ramp as one ribbon
  const samples = [];
  for (let i = 0; i <= 10; i++) samples.push({ p: [0, 0, -4 - (i / 10) * 5] });
  const N = 56;
  for (let i = 1; i <= N; i++) {
    const a = (i / N) * TAU;
    samples.push({ p: [(SHIFT * a) / TAU, R * (1 - Math.cos(a)), LOOP_Z - R * Math.sin(a)], up: [0, Math.cos(a), Math.sin(a)] });
  }
  for (let i = 1; i <= 8; i++) samples.push({ p: [SHIFT, 0, LOOP_Z - (i / 8) * 4] });
  const m = 0.36, d = 1.0;
  for (let i = 1; i <= 10; i++) {
    const z = (i / 10) * 2.5;
    const y = z < d ? (m / (2 * d)) * z * z : (m * d) / 2 + m * (z - d);
    samples.push({ p: [SHIFT, y, -13 - z] });
  }
  b.track(samples, {
    width: 1.4, segs: 4, mat: MAT.neon, wallMat: MAT.metal, wallL: 0.26, wallR: 0.26, wallT: 0.14,
    color: 0x4a2838, pattern: PATTERN.neon, glowColor: 0xc23b4a, wallColor: 0x3a2820, side: 0x241610, thick: 0.22,
  });
  b.booster(0, -5.9, 0, [0, -1], 1.8, 1.3, 13.5, { light: 0x7dff8a });
  b.booster(SHIFT, -11.4, 0, [0, -1], 1.6, 1.3, 12.5, { light: 0xffe14d });
  b.camZone({ x0: -1.4, x1: 3.8, z0: -15.4, z1: -6.6, pos: [-5.2, 4.0, -4.6] });

  // ---- asteroid platform with bumpers
  const plat = [[-4.2, -20], [5.2, -20], [5.2, -31.5], [-4.2, -31.5], [-4.2, -27.55], [-4.2, -26.45]];
  b.floor(plat, 0, neon);
  b.border(plat, 0, { skip: [4] });
  const bump = { color: 0xff4df0, capColor: 0x38f0ff, band: 0xffffff, r: 0.5, kick: 6.5 };
  b.bumper(2.2, -29.4, 0, bump);
  b.bumper(-0.9, -25.3, 0, { ...bump, color: 0x38f0ff, capColor: 0xffe14d });
  b.bumper(-2.4, -29.6, 0, { ...bump, color: 0xffe14d, capColor: 0xff4df0 });
  b.bumper(4.1, -26.2, 0, { ...bump, color: 0x7dff8a, capColor: 0xff4df0 });
  b.bumper(0.4, -22.4, 0, { ...bump, color: 0xb26bff, capColor: 0x7dff8a });

  // ---- light bridge
  b.rect(-7.95, -27.55, -4.2, -26.45, 0, { color: 0x1a4a6a, pattern: PATTERN.neon, glowColor: 0x7dffb0, mat: MAT.neon, thick: 0.12, side: 0x38f0ff });

  // ---- island green with a sweeper
  const isle = circlePoly(ISLE[0], ISLE[1], 2.6, 32);
  b.floor(isle, 0, neon2);
  b.border(isle, 0, { skip: [31, 0] });
  b.cyl(ISLE[0], ISLE[1], 0.3, -0.2, 0.55, { mat: MAT.metal, color: 0x38f0ff, kind: 'glowSoft' });
  let sweep = null;
  if (b.visual) {
    const parts = [];
    for (const s of [-1, 1]) {
      const g = cyl(0.14, 0.14, 1.85, 10);
      g.rotateZ(Math.PI / 2);
      parts.push(part(g, 0xff4df0, { p: [s * 1.375, 0, 0] }));
      parts.push(part(sph(0.2, 10, 8), 0xffffff, { p: [s * 2.3, 0, 0] }));
    }
    sweep = new THREE.Mesh(merge(parts), glowMat(1.35));
  }
  b.kinematic({
    mat: MAT.metal, mesh: sweep,
    shapes: [{ type: 'cap', a: [0.45, 0, 0], b: [2.3, 0, 0], r: 0.15 }, { type: 'cap', a: [-0.45, 0, 0], b: [-2.3, 0, 0], r: 0.15 }],
    pose: (t, o) => { o.pos.set(ISLE[0], 0.2, ISLE[1]); o.quat.setFromAxisAngle(Y_AXIS, t * 0.9); },
  });
  b.cup(-11.4, 0, -28.0, { flagColor: 0x38f0ff });

  b.decor(() => {
    const rng = b.rng;
    // rocky undersides
    const under = [];
    const rockUnder = (x, z, rx, rz, depth) => {
      const g = rockGeo(1, rng, 1, 1);
      g.scale(rx, depth, rz);
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setY(i, Math.min(pos.getY(i), depth * 0.85 - 0.05));
      g.computeVertexNormals();
      under.push(part(g, 0x4a3f7a, { p: [x, -0.4 - depth * 0.85, z], top: 0x6a5faa }));
    };
    rockUnder(0, -1, 2.2, 3.6, 2.2);
    rockUnder(0.5, -24.5, 5.4, 5.2, 3.4);
    rockUnder(0.5, -29, 5, 3.4, 2.6);
    rockUnder(ISLE[0], ISLE[1], 3, 3, 2.6);
    rockUnder(1.1, -9.5, 2.6, 3.4, 1.6);
    rockUnder(SHIFT, -14, 1.2, 2, 1.2);
    rockUnder(-3.6, 0.5, 1.6, 1.6, 1.4);
    b.put(merge(under), 'toon');
    // loop pylons
    const py = [];
    for (const sx of [-1.15, SHIFT + 1.15]) {
      py.push(part(cyl(0.12, 0.18, 4.2, 8), 0x2a2f5a, { p: [sx, 1.7, LOOP_Z] }));
      py.push(part(sph(0.2, 10, 8), 0x2a2f5a, { p: [sx, 3.85, LOOP_Z] }));
    }
    b.put(merge(py), 'toon');
    b.put(merge([
      part(sph(0.14, 8, 6), 0xff4df0, { p: [-1.15, 4.1, LOOP_Z] }),
      part(sph(0.14, 8, 6), 0xff4df0, { p: [SHIFT + 1.15, 4.1, LOOP_Z] }),
      part(box(3.75, 0.05, 0.06), 0x7dffb0, { p: [-6.07, 0.0, -27.55] }),
      part(box(3.75, 0.05, 0.06), 0x7dffb0, { p: [-6.07, 0.0, -26.45] }),
    ]), 'glow');

    // rocket, antenna, beacons
    b.prop(P.rocket(), -3.6, -1.4, 0.5, 0.4, 1.3, 'rim');
    b.prop(P.antenna(), 4.6, 0, -30.9, -0.6, 0.9, 'toon');
    const beacons = [];
    for (const [x, z] of [[-1.75, 2.15], [1.75, 2.15], [-4.35, -19.85], [5.35, -19.85], [5.35, -31.65], [-4.35, -31.65]]) {
      b.put(part(cyl(0.06, 0.08, 1.2, 6), 0x2a2f5a, { p: [x, 0.6, z] }), 'toon');
      const mesh = new THREE.Mesh(part(sph(0.13, 10, 8), 0x38f0ff, {}), glowMat(2.6));
      mesh.position.set(x, 1.3, z);
      b.add(mesh);
      beacons.push(mesh);
    }
    b.anim((t) => beacons.forEach((bm, i) => bm.scale.setScalar(0.7 + 0.5 * Math.max(0, Math.sin(t * 2.2 - i * 0.9)))));
    b.light(0, 2.5, -2, 0x38f0ff, 5, 9, 0);
    b.light(1, 3, -25, 0xff4df0, 7, 12, 0);
    b.light(ISLE[0], 2.5, ISLE[1], 0x7dffb0, 6, 9, 0);

    // planets
    const planets = [
      [-60, 34, -120, 26, 0xff9a5a, 0xffd9a0, 0xe8c9a0],
      [80, 10, -60, 9, 0x4fc3f7, 0xb8f1ff, undefined],
      [40, 50, 70, 7, 0xb26bff, 0xe8c9ff, undefined],
      [-90, -8, 20, 12, 0x7dff8a, 0xd9ffb0, 0xb8f1ff],
    ];
    const pm = toonMat({ rim: 0.5, side: THREE.DoubleSide, key: 'planet' });
    for (const [x, y, z, r, c1, c2, ring] of planets) {
      const mesh = new THREE.Mesh(P.planet(r, c1, c2, ring), pm);
      mesh.position.set(x, y, z);
      mesh.rotation.set(0.4, 0, 0.3);
      mesh.layers.set(LAYER_FX);
      b.add(mesh);
      b.anim((t) => { mesh.rotation.y = t * 0.03; });
    }
    // drifting asteroids
    const am = toonMat({ rim: 0.35 });
    for (let i = 0; i < 26; i++) {
      const a = rng() * TAU, dist = 12 + rng() * 38;
      const x = Math.cos(a) * dist, z = -16 + Math.sin(a) * dist, y = -8 + rng() * 22;
      if (b.onCourse(x, z, 4) && y > -3 && y < 6) continue;
      const mesh = new THREE.Mesh(P.asteroid(rng, 0.6 + rng() * 2.2, rng.pick([0x5a4f8a, 0x6a5f7a, 0x4a5a8a]), 0x9a8fc0), am);
      mesh.position.set(x, y, z);
      mesh.castShadow = false;
      b.add(mesh);
      const w = [(rng() - 0.5) * 0.4, (rng() - 0.5) * 0.4], ph = rng() * 6;
      b.anim((t) => { mesh.rotation.set(t * w[0], t * w[1], 0); mesh.position.y = y + Math.sin(t * 0.3 + ph) * 0.6; });
      if (rng() < 0.35) {
        const cr = new THREE.Mesh(P.crystal(rng, rng.pick([0x38f0ff, 0xff4df0, 0x7dffb0]), 0xffffff, 0.8), glowMat(1.5));
        cr.position.set(0, 0.5, 0);
        mesh.add(cr);
      }
    }
    b.critter(C.ufo({ cx: 7, cz: -12, radius: 5, speed: 1.2, y: 5.5, phase: 0, beam: true }));
    b.critter(C.ufo({ cx: -8, cz: -18, radius: 4, speed: 0.9, y: 7, phase: 2, dir: -1, s: 0.8, color: 0xd9b8ff }));
    b.critter(C.ufo({ cx: -2, cz: -36, radius: 6, speed: 1.4, y: 4, phase: 4, s: 1.2 }));
    b.critter(C.astronaut({ cx: -6, cz: -6, radius: 3, speed: 0.25, y: 3.2, phase: 1 }));
    b.critter(C.astronaut({ cx: 9, cz: -28, radius: 2, speed: 0.2, y: 4.5, phase: 3, s: 0.9 }));
    for (let i = 0; i < 10; i++) {
      b.critter(C.wisp({ x: -12 + rng() * 22, y: 1 + rng() * 5, z: -32 + rng() * 34, r: 2 + rng() * 3, color: rng.pick([0x38f0ff, 0xff4df0, 0xffffff]), size: 0.26, phase: rng() * 10, speed: 0.4 }));
    }
    // shooting stars and space dust
    b.emitter({ min: [-60, 20, -80], max: [60, 45, 20], rate: 0.5, life: [0.7, 1.1], size: [0.5, 0.9], colors: [0xffffff, 0xbdf3ff], vel: [-38, -16, 6], spread: [6, 3, 3], additive: true, bright: 3, shape: 3 });
    b.emitter({ follow: true, min: [-14, -3, -14], max: [14, 7, 14], rate: 9, life: [4, 7], size: [0.04, 0.09], colors: [0xffffff, 0xbdf3ff, 0xffb8f5], vel: [0.1, 0.05, 0], spread: [0.15, 0.1, 0.15], additive: true, bright: 1.8 });
  });

  return b.finish();
}
