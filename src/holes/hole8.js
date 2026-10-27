// Hole 8 - Haunted Hollow. Swinging pendulums guard the path to three
// portals. Only a portal reaches the green on the hill.
import * as THREE from 'three';
import { CourseBuilder, MAT, PATTERN } from '../builder.js';
import * as P from '../props.js';
import * as C from '../critters.js';
import * as S from '../scenery.js';
import { part, merge, box, cyl, sph, cone, torus, rockGeo } from '../geo.js';
import { toonMat, glowMat } from '../materials.js';
import { TAU, circlePoly } from '../utils.js';

const PIVOT_Y = 4.5, ARM = 4.0;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function pendulumMesh() {
  const blade = new THREE.CylinderGeometry(0.62, 0.62, 0.1, 20, 1, false, 0, Math.PI);
  blade.rotateX(Math.PI / 2);
  blade.rotateZ(Math.PI / 2);
  const parts = [
    part(cyl(0.06, 0.06, ARM - 0.2, 8), 0x6b4424, { p: [0, -(ARM - 0.2) / 2, 0] }),
    part(blade, 0xc9d2e3, { p: [0, -ARM + 0.12, 0], top: 0xffffff }),
    part(box(0.34, 0.5, 0.16), 0x4a4a5a, { p: [0, -ARM + 0.3, 0] }),
    part(sph(0.14, 10, 8), 0x3a3a48, { p: [0, 0, 0] }),
    part(torus(0.12, 0.03, 6, 12), 0xd9a441, { p: [0, -ARM + 0.62, 0] }),
  ];
  const m = new THREE.Mesh(merge(parts), toonMat({ rim: 0.3, side: THREE.DoubleSide, key: 'pend' }));
  m.castShadow = true;
  return m;
}

export default function build(opts = {}) {
  const b = new CourseBuilder({ ...opts, seed: 808 });
  b.meta({
    name: 'Haunted Hollow', par: 4,
    hint: 'Green is good, purple is fine, red sends you back. Time the pendulums.',
    path: [[0, 0, 0], [0, 0, -9], [0, 0, -13.7], [-3, 1.5, -20.8], [-3, 1.5, -25.9], [2.8, 1.5, -25.6]],
    flyover: { height: 5.5, back: 7, side: 4 },
    solverDelays: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5],
  });
  b.theme({
    skyTop: 0x140c14, skyHorizon: 0x6a3050, skyBottom: 0x2a1818,
    sunDir: [-0.38, 0.5, -0.78], sunColor: 0xffe0b0, sunIntensity: 1.55, sunDisc: 0xfff0d0, sunSize: 5,
    hemiSky: 0x8a6080, hemiGround: 0x3a4a28, hemiIntensity: 1.35,
    fog: 0x2a1828, fogDensity: 0.016, outline: 0x07060f,
    clouds: 0.55, cloudCut: 0.5, cloudColor: 0x4a4280, cloudShade: 0x1d1a40,
    stars: 1.1, ambient: 'spooky', bloom: 0.8, bloomThreshold: 0.85, wind: 1.2,
  });
  b.wallColor = 0x4a3a32;
  b.wallCap = 0x7a6858;
  b.wallMat = MAT.stone;
  b.floorThick = 0.5;

  const TURF = 0x4a6840;
  const lower = [[-2.5, 2], [2.5, 2], [2.5, -9], [5.5, -9], [5.5, -15], [-5.5, -15], [-5.5, -9], [-2.5, -9]];
  b.floor(lower, 0, { color: TURF, side: 0x2a2420 });
  b.border(lower, 0);
  b.tee(0, 0, 0);

  // gates with pendulums
  const gates = [[-3.5, 0], [-6.5, 1.9]];
  for (const [z, phase] of gates) {
    b.wall([-2.5, z], [-1.0, z], { h: 0.62, t: 0.36, color: 0x5a4838 });
    b.wall([1.0, z], [2.5, z], { h: 0.62, t: 0.36, color: 0x5a4838 });
    b.kinematic({
      mat: MAT.metal,
      shapes: [{ type: 'sph', c: [0, -ARM, 0], r: 0.5 }, { type: 'cap', a: [0, -0.3, 0], b: [0, -ARM + 0.5, 0], r: 0.08 }],
      mesh: b.visual ? pendulumMesh() : null,
      pose: (t, o) => {
        o.pos.set(0, PIVOT_Y, z);
        o.quat.setFromAxisAngle(Z_AXIS, Math.sin(t * 1.6 + phase) * 1.0);
      },
    });
  }

  // low wall hiding the lucky portal
  b.wall([3.2, -9], [3.2, -11.55], { h: 0.62, t: 0.3, color: 0x5a4838 });
  b.wall([3.2, -12.45], [3.2, -15], { h: 0.62, t: 0.3, color: 0x5a4838 });

  // upper green on the hill
  const upper = [[-4.5, -19], [4.5, -19], [4.5, -28], [-4.5, -28]];
  const swamp = circlePoly(-0.4, -23.6, 1.25, 22);
  b.floor(upper, 1.5, { color: TURF, holes: [swamp], thick: 2.3, side: 0x2a2420 });
  b.pool(swamp, { type: 'water', level: 1.37, depth: 0.4, bottom: 0x1f3a2a, water: { shallow: 0x7dff9a, deep: 0x1f7a4a, foam: 0xd9ffd0, opacity: 0.92 } });
  b.border(upper, 1.5, { below: 0.4 });
  b.box([-2.3, 1.9, -22.4], [0.7, 0.8, 0.22], { mat: MAT.stone, color: 0x8c8fa3, rotY: 0.3 });
  b.box([1.3, 1.9, -22.0], [0.7, 0.8, 0.22], { mat: MAT.stone, color: 0x8c8fa3, rotY: -0.4 });
  b.box([0.6, 1.9, -26.4], [0.7, 0.8, 0.22], { mat: MAT.stone, color: 0x8c8fa3, rotY: 1.2 });
  b.cup(2.8, 1.5, -25.6, { flagColor: 0xb26bff });

  // portals
  b.portal({ id: 'purple', from: [0, 0, -14.35], facing: [0, 1], to: [-3, 1.5, -20.2], exitDir: [0, -1], colorA: 0x7c3cff, colorB: 0xe08aff, frame: 0x4a4a62, minSpeed: 2.4, maxSpeed: 6 });
  b.portal({ id: 'red', from: [-4.2, 0, -14.35], facing: [0, 1], to: [1.7, 0, -0.9], exitDir: [0, -1], colorA: 0xff3b3b, colorB: 0xffb347, frame: 0x4a4a62, minSpeed: 2, maxSpeed: 3 });
  b.portal({ id: 'green', from: [4.9, 0, -12], facing: [-1, 0], to: [2.8, 1.5, -20.3], exitDir: [0, -1], colorA: 0x2fe08a, colorB: 0xd9ff5c, frame: 0x4a4a62, minSpeed: 4.4, maxSpeed: 6.4 });

  b.terrain({ y: -0.35, color: 0x3a4a32, color2: 0x2a3828, color3: 0x4a4038, cx: 0, cz: -13, flat: 24, hills: 8 });

  b.decor(() => {
    const rng = b.rng;
    // pendulum frames
    const frames = [];
    for (const [z] of gates) {
      frames.push(part(box(0.28, 5.2, 0.28), 0x4a3526, { p: [-3.05, 2.25, z] }));
      frames.push(part(box(0.28, 5.2, 0.28), 0x4a3526, { p: [3.05, 2.25, z] }));
      frames.push(part(box(6.6, 0.3, 0.3), 0x4a3526, { p: [0, PIVOT_Y + 0.22, z] }));
      frames.push(part(box(1.4, 0.2, 0.2), 0x4a3526, { p: [-2.5, 3.9, z], r: [0, 0, 0.8] }));
      frames.push(part(box(1.4, 0.2, 0.2), 0x4a3526, { p: [2.5, 3.9, z], r: [0, 0, -0.8] }));
    }
    b.put(merge(frames), 'toon');

    // mausoleum behind the portals
    const crypt = [
      part(box(12.4, 3.4, 2.6), 0x6e6e8c, { p: [0, 1.35, -16.75], top: 0x9a9aba }),
      part(box(13.2, 0.4, 3.2), 0x6a6a86, { p: [0, 3.2, -16.75] }),
    ];
    const roof = new THREE.CylinderGeometry(1.9, 1.9, 13, 3, 1);
    roof.rotateZ(Math.PI / 2);
    roof.rotateX(-Math.PI / 6 + Math.PI);
    roof.scale(1, 0.55, 1);
    crypt.push(part(roof, 0x3a3a52, { p: [0, 3.95, -16.75] }));
    for (let i = 0; i < 7; i++) crypt.push(part(cyl(0.22, 0.26, 3.0, 10), 0x8a8aa8, { p: [-6 + i * 2, 1.3, -15.3] }));
    b.put(merge(crypt), 'toon');
    // cliff of the upper green
    const cliff = [];
    const ringPts = [];
    for (let x = -4; x <= 4; x += 2) { ringPts.push([x, -18.4, 0], [x, -28.9, 0]); }
    for (let z = -20; z >= -27; z -= 2.2) { ringPts.push([-5.5, z, 1], [5.5, z, 1]); }
    for (const [x, z] of ringPts) {
      const r = 0.9 + rng() * 0.7;
      const g = rockGeo(r, rng, 1.25, 1);
      const pos = g.attributes.position;
      const y0 = 0.2 + rng() * 0.3;
      for (let i = 0; i < pos.count; i++) pos.setY(i, Math.min(pos.getY(i), 1.25 - y0));
      g.computeVertexNormals();
      cliff.push(part(g, 0x4a4e68, { p: [x + (rng() - 0.5) * 0.6, y0, z + (rng() - 0.5) * 0.5], top: 0x6a6e8e }));
    }
    b.put(merge(cliff), 'toon');

    // lanterns and pumpkins
    for (const [x, z] of [[-2.7, 1.8], [2.7, 1.8], [-5.7, -9.2], [5.7, -9.2]]) {
      b.prop(P.lampPost({ h: 2.2, color: 0x23232e }), x, 0, z, 0, 1, 'toon');
      S.bulb(b, x, 2.42, z, 0xffb347, 0.14, true);
    }
    const pk = [[-3.4, -0.35, 0.6, 1.2, 0.6], [3.5, -0.35, -2.2, 1.0, -0.9], [-3.3, -0.35, -7.4, 1.4, 0.9], [6.3, -0.35, -13.5, 1.1, -1.2], [-6.4, -0.35, -11, 1.3, 1.4], [3.4, 0.62, -13.6, 0.7, -1.57]];
    for (const [x, y, z, s, r] of pk) {
      b.prop(P.pumpkin(rng, { s }), x, y, z, r, 1, 'rim');
      b.prop(P.pumpkinFace(s), x, y, z, r, 1, 'glow');
      b.light(x + Math.sin(r) * 0.4, y + 0.3 * s, z + Math.cos(r) * 0.4, 0xff8a1f, 3.2, 5, 0.5);
    }
    // graveyard
    b.scatter(34, [-16, -34, 16, 8], (x, y, z) => b.prop(P.gravestone(rng), x, y - 0.03, z, (rng() - 0.5) * 0.8, 0.9 + rng() * 0.4, 'toon'), { margin: 1.1, minDist: 1.8, reject: (x, z) => Math.abs(x) < 7.5 && z < -15.2 && z > -29.5 });
    b.scatter(16, [-30, -44, 30, 16], (x, y, z) => b.prop(P.deadTree(rng), x, y - 0.1, z, rng() * TAU, 1.1 + rng() * 0.8, 'sway'), { margin: 3, minDist: 4, reject: (x, z) => Math.abs(x) < 7.5 && z < -15.2 && z > -29.5 });
    b.scatter(18, [-16, -34, 16, 8], (x, y, z) => b.prop(P.rock(rng, 0.3 + rng() * 0.5, 0x4a4e66, 0x6a6e8a), x, y, z, 0, 1, 'toon'), { margin: 0.9 });
    // iron fence
    const fence = [];
    for (let i = 0; i < 36; i++) {
      const x = -8 + (i % 18) * 0.95, z = i < 18 ? 4.6 : -31;
      fence.push(part(box(0.06, 1.3, 0.06), 0x23232e, { p: [x, 0.3, z] }));
      fence.push(part(cone(0.07, 0.2, 4), 0x23232e, { p: [x, 1.05, z] }));
    }
    fence.push(part(box(17, 0.06, 0.06), 0x23232e, { p: [0.1, 0.75, 4.6] }), part(box(17, 0.06, 0.06), 0x23232e, { p: [0.1, 0.1, 4.6] }));
    fence.push(part(box(17, 0.06, 0.06), 0x23232e, { p: [0.1, 0.75, -31] }), part(box(17, 0.06, 0.06), 0x23232e, { p: [0.1, 0.1, -31] }));
    b.put(merge(fence), 'toon');

    // haunted house on the hill
    const hx = -24, hz = -34, hy = b.terrainFn(hx, hz) - 0.3;
    const house = [
      part(box(6, 6, 5), 0x2f2a48, { p: [hx, hy + 3, hz], top: 0x4a4270 }),
      part(box(2.4, 9, 2.4), 0x2f2a48, { p: [hx + 2.6, hy + 4.5, hz + 1.6], top: 0x4a4270 }),
      part(cone(2.2, 3, 4), 0x1d1a30, { p: [hx + 2.6, hy + 10.5, hz + 1.6], r: [0, Math.PI / 4, 0] }),
    ];
    const hr = cone(4.6, 3, 4);
    hr.rotateY(Math.PI / 4);
    house.push(part(hr, 0x1d1a30, { p: [hx - 0.4, hy + 7.5, hz] }));
    b.put(merge(house), 'toon');
    const windows = [];
    for (const [dx, dy] of [[-1.8, 2], [0, 2], [-1.8, 4.2], [0, 4.2]]) windows.push(part(box(0.8, 1.1, 0.1), 0xffd866, { p: [hx + dx, hy + dy, hz + 2.52] }));
    windows.push(part(box(0.7, 1.0, 0.1), 0xffd866, { p: [hx + 2.6, hy + 7, hz + 2.82] }));
    b.put(merge(windows), 'glow');

    S.mountains(b, { color: 0x2a1c28, snow: 0x4a3840, snowLine: 0.8, cz: -13, h: 18, r: 18, count: 12 });

    // spirits
    b.critter(C.ghost({ cx: 0, cz: -5, radius: 5.5, rx: 1.2, rz: 0.7, speed: 1.0, y: 2.6, phase: 0 }));
    b.critter(C.ghost({ cx: 0, cz: -23.5, radius: 6.5, speed: 1.1, y: 3.4, phase: 2, dir: -1, s: 1.2 }));
    b.critter(C.ghost({ cx: 7, cz: -12, radius: 2.5, speed: 0.7, y: 1.6, phase: 4, s: 0.8, color: 0xd9ffe6 }));
    for (let i = 0; i < 6; i++) {
      b.critter(C.bat({ cx: rng.range(-6, 6), cz: rng.range(-24, -2), radius: 5 + rng() * 7, speed: 4 + rng() * 2, y: 4.5 + rng() * 3, phase: rng() * 6, dir: rng.sign() }));
    }
    for (let i = 0; i < 12; i++) {
      b.critter(C.wisp({ x: -9 + rng() * 18, y: 0.5 + rng() * 1.6, z: -28 + rng() * 30, r: 1 + rng() * 2, color: rng.pick([0x7dffb0, 0xb26bff, 0x9be7ff]), size: 0.32, phase: rng() * 10, speed: 0.7 }));
    }
    b.grass({ count: 3600, around: true, spread: 7, height: 0.4, base: 0x1f4a3a, tip: 0x5aa87a, cut: 0.4, reject: (x, z) => Math.abs(x) < 7.5 && z < -15.2 && z > -29.5 });
    // ground mist
    b.emitter({ follow: true, min: [-15, -0.2, -15], max: [15, 0.4, 15], rate: 7, life: [5, 9], size: [1.6, 3.2], colors: [0x8a86c8, 0x6a66a8], vel: [0.35, 0, 0.1], spread: [0.2, 0.02, 0.2], alpha: 0.13, grow: 0.6 });
  });

  return b.finish();
}
