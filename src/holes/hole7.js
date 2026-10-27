// Hole 7 - Clockwork Factory. Conveyor belts, a spinning gear arm and a
// shuttle platform across the goo tank.
import * as THREE from 'three';
import { CourseBuilder, MAT, PATTERN } from '../builder.js';
import * as P from '../props.js';
import * as C from '../critters.js';
import * as S from '../scenery.js';
import { part, merge, box, cyl, sph, torus } from '../geo.js';
import { toonMat, glowMat } from '../materials.js';
import { makeWaterMaterial } from '../shaders.js';
import { TAU, easeInOut } from '../utils.js';

const SPIN = [0, -15.2];
const SPIN_W = 1.0;
const NEAR_Z = -19.65, FAR_Z = -24.9;
const PERIOD = 10;

export function platformZ(t) {
  const p = ((t % PERIOD) + PERIOD) % PERIOD;
  if (p < 2.5) return NEAR_Z;
  if (p < 5) return NEAR_Z + (FAR_Z - NEAR_Z) * easeInOut((p - 2.5) / 2.5);
  if (p < 7.5) return FAR_Z;
  return FAR_Z + (NEAR_Z - FAR_Z) * easeInOut((p - 7.5) / 2.5);
}

export default function build(opts = {}) {
  const b = new CourseBuilder({ ...opts, seed: 707 });
  b.meta({
    name: 'Clockwork Factory', par: 4,
    hint: 'Ride the left belt, dodge the gear arm, then hop on the shuttle and get off on the far side.',
    path: [[0, 0, 0], [-1.1, 0, -4.5], [-1.1, 0, -12], [-0.4, 0, -17.6], [0, 0, -19.6], [0, 0, -24.9], [-3, 0, -24.9], [-6.6, 0, -24.9]],
    flyover: { height: 6, back: 7, side: 5 },
    solverDelays: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  });
  b.theme({
    skyTop: 0x3a2218, skyHorizon: 0xe8843a, skyBottom: 0x5a3428,
    sunDir: [0.55, 0.45, 0.5], sunColor: 0xffd0a8, sunIntensity: 2.3, sunDisc: 0xffd9a0, sunSize: 1.8,
    hemiSky: 0xe8c0a0, hemiGround: 0x6a4030, hemiIntensity: 1.2,
    fog: 0xc48458, fogDensity: 0.0085, outline: 0x1d1428,
    clouds: 0.8, cloudCut: 0.47, cloudColor: 0xffc79a, cloudShade: 0x8a5a6a,
    ambient: 'factory', bloom: 0.55, wind: 0.4,
  });
  b.wallColor = 0x6a4a32;
  b.wallCap = 0xe8a04a;
  b.wallMat = MAT.metal;

  const STEEL = 0xb48458;
  const outline = [
    [-2, 2], [2, 2], [2, -12], [2.6, -12], [2.6, -18.4], [1.25, -18.4], [-1.25, -18.4],
    [-2.6, -18.4], [-2.6, -12], [-2, -12],
  ];
  b.rect(-2, 2, 2, -4, 0, { color: STEEL, pattern: PATTERN.metal, mat: MAT.deck, side: 0x5a3a2c });
  b.rect(-0.15, -4, 0.15, -12, 0, { color: 0x8a6244, pattern: PATTERN.none, mat: MAT.deck, side: 0x5a3a2c });
  b.rect(-2.6, -12, 2.6, -18.4, 0, { color: STEEL, pattern: PATTERN.metal, mat: MAT.deck, side: 0x5a3a2c });
  b.belt(-2, -4, -0.15, -12, 0, [0, -1], 3.0, { light: 0x7dff8a });
  b.belt(0.15, -4, 2, -12, 0, [0, 1], 2.6, { light: 0xff5a4d });
  b.border(outline, 0, { skip: [5] });
  b.wall([0, -5.2], [0, -10.8], { h: 0.45, t: 0.3 });
  b.tee(0, 0, 0);

  // ---- spinning gear arm
  b.cyl(SPIN[0], SPIN[1], 0.42, -0.2, 0.62, { mat: MAT.metal, color: 0xd9a441, top: 0xffd866 });
  const armShapes = [];
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    armShapes.push({ type: 'cap', a: [Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5], b: [Math.cos(a) * 2.3, 0, Math.sin(a) * 2.3], r: 0.16 });
  }
  let armMesh = null;
  if (b.visual) {
    const parts = [P.gear(0.85, 10, 0.2, 0xd9a441, 0x8a6a2f)];
    parts[0].translate(0, 0.32, 0);
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      const g = cyl(0.15, 0.15, 1.95, 10);
      g.rotateZ(Math.PI / 2);
      parts.push(part(g, k % 2 ? 0xe8503a : 0xf4f4f8, { p: [Math.cos(a) * 1.4, 0, Math.sin(a) * 1.4], r: [0, -a, 0] }));
      parts.push(part(sph(0.2, 10, 8), 0xffc93c, { p: [Math.cos(a) * 2.34, 0, Math.sin(a) * 2.34] }));
    }
    armMesh = new THREE.Mesh(merge(parts), toonMat({ rim: 0.2 }));
    armMesh.castShadow = true;
  }
  const Y = new THREE.Vector3(0, 1, 0);
  b.kinematic({
    mat: MAT.metal, shapes: armShapes, mesh: armMesh,
    pose: (t, o) => { o.pos.set(SPIN[0], 0.2, SPIN[1]); o.quat.setFromAxisAngle(Y, t * SPIN_W); },
  });

  // ---- goo tank with the shuttle platform
  const tank = [[-2.6, -18.4], [2.6, -18.4], [2.6, -27.2], [-1.25, -27.2], [-1.25, -22.6], [-2.6, -22.6]];
  const goo = b.visual ? makeWaterMaterial({ shallow: 0xc8ff5c, deep: 0x3fae2a, foam: 0xf1ffc0, opacity: 0.96, wave: 0.3, scale: 1.3 }) : null;
  b.pool(tank, { type: 'water', level: -0.2, depth: 0.6, material: goo, bottom: 0x2f6a2a });
  // the hazard surface of pool() is water: re-tag it as goo
  for (let i = 0; i < b.world.triMat.length; i++) if (b.world.triMat[i] === MAT.water) b.world.triMat[i] = MAT.goo;
  b.wall([2.75, -18.4], [2.75, -27.2], { below: 1.3, ext1: 0.3 });
  b.wall([2.6, -27.35], [-1.25, -27.35], { below: 1.3 });
  b.wall([-2.75, -18.4], [-2.75, -22.6], { below: 1.3 });
  b.wall([-2.6, -22.75], [-1.4, -22.75], { below: 1.3, ext0: 0.3 });

  const platShapes = [
    { type: 'box', c: [0, -0.15, 0], h: [1.2, 0.15, 1.2] },
    { type: 'box', c: [0, 0.2, -1.12], h: [1.2, 0.2, 0.08] },
    { type: 'box', c: [1.12, 0.2, 0], h: [0.08, 0.2, 1.2] },
  ];
  let platMesh = null;
  if (b.visual) {
    const parts = [
      part(box(2.4, 0.3, 2.4), 0xffc93c, { p: [0, -0.15, 0] }),
      part(box(2.2, 0.02, 2.2), 0x4f5a72, { p: [0, 0.011, 0] }),
      part(box(2.4, 0.4, 0.16), 0xe8503a, { p: [0, 0.2, -1.12] }),
      part(box(0.16, 0.4, 2.4), 0xe8503a, { p: [1.12, 0.2, 0] }),
      part(cyl(0.12, 0.12, 1.4, 8), 0x3a3f4d, { p: [0.9, -1.0, 0.9] }),
      part(cyl(0.12, 0.12, 1.4, 8), 0x3a3f4d, { p: [-0.9, -1.0, 0.9] }),
      part(cyl(0.12, 0.12, 1.4, 8), 0x3a3f4d, { p: [0.9, -1.0, -0.9] }),
      part(cyl(0.12, 0.12, 1.4, 8), 0x3a3f4d, { p: [-0.9, -1.0, -0.9] }),
    ];
    for (let i = 0; i < 5; i++) parts.push(part(box(0.3, 0.025, 0.12), 0xffc93c, { p: [-0.85, 0.013, -0.8 + i * 0.4], r: [0, 0.5, 0] }));
    platMesh = new THREE.Mesh(merge(parts), toonMat({}));
    platMesh.castShadow = true;
    platMesh.receiveShadow = true;
  }
  b.kinematic({
    mat: MAT.deck, shapes: platShapes, mesh: platMesh,
    pose: (t, o) => { o.pos.set(0, 0, platformZ(t)); o.quat.identity(); },
  });

  // ---- final floor
  const fin = [[-1.25, -22.6], [-1.25, -23.7], [-1.25, -26.1], [-1.25, -27.2], [-8.5, -27.2], [-8.5, -22.6]];
  b.floor(fin, 0, { color: STEEL, pattern: PATTERN.metal, mat: MAT.deck, side: 0x5a3a2c });
  b.border(fin, 0, { skip: [1] });
  b.box([-4.1, 0.35, -23.4], [0.8, 0.7, 0.8], { mat: MAT.wood, color: 0xc48a4a, rotY: 0.3 });
  b.cyl(-4.6, -26.3, 0.36, -0.2, 0.85, { mat: MAT.metal, color: 0x3d6fa8, top: 0x6fa8e8 });
  b.cup(-6.6, 0, -24.9, { flagColor: 0xffc93c });

  b.terrain({ y: -0.35, color: 0x5a4838, color2: 0x4a3a2c, color3: 0x6a5844, cx: -2, cz: -12, flat: 26, hills: 3 });

  b.decor(() => {
    const rng = b.rng;
    // rails along the belts and rollers
    const bits = [];
    for (const z of [-4, -12]) {
      const g = cyl(0.14, 0.14, 4.0, 10);
      g.rotateZ(Math.PI / 2);
      bits.push(part(g, 0x3a3f4d, { p: [0, -0.14, z] }));
    }
    // dock gate lights and hazard stripes
    for (let i = 0; i < 8; i++) bits.push(part(box(0.3, 0.02, 0.22), i % 2 ? 0x23232e : 0xffc93c, { p: [-1.05 + i * 0.3, 0.012, -18.25] }));
    for (let i = 0; i < 8; i++) bits.push(part(box(0.22, 0.02, 0.3), i % 2 ? 0x23232e : 0xffc93c, { p: [-1.4, 0.012, -23.85 - i * 0.3] }));
    b.put(merge(bits), 'toon');

    // big decorative gears
    const gears = [
      [4.6, 1.6, -7, 1.5, 0.5, 0xd9a441], [6.2, 2.9, -7, 1.0, -0.75, 0xc0c8d8], [4.4, 3.9, -7, 0.75, 1.0, 0xe8503a],
      [-4.8, 1.8, -15, 1.7, -0.4, 0xc0c8d8], [-6.6, 3.4, -15, 1.1, 0.62, 0xd9a441],
      [6.4, 2.0, -22, 1.6, 0.45, 0xd9a441], [6.4, 4.2, -22, 0.9, -0.8, 0xc0c8d8],
    ];
    const gm = toonMat({ rim: 0.2 });
    for (const [x, y, z, r, w, c] of gears) {
      const g = P.gear(r, Math.round(8 + r * 3), 0.3, c, 0x5a4a3a);
      g.rotateX(Math.PI / 2);
      const m = new THREE.Mesh(g, gm);
      m.position.set(x, y, z);
      m.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2;
      m.castShadow = true;
      b.add(m);
      b.anim((t) => { m.rotation.z = t * w; });
      b.put(part(box(0.3, y + 0.35, 0.3), 0x3a3f4d, { p: [x + (x > 0 ? 0.35 : -0.35), (y - 0.35) / 2, z] }), 'toon');
    }
    // tanks, pipes, chimneys
    b.prop(P.tank(0xb8651f), 6.5, -0.35, -13.5, 0, 1.2, 'toon');
    b.prop(P.tank(0x3d6fa8), -6.2, -0.35, -5.5, 0, 1.0, 'toon');
    b.prop(P.tank(0x6fae4a), 7.5, -0.35, -28, 0, 1.3, 'toon');
    b.prop(P.pipe(6, 0.3, 0x8a96ac), 6.4, 0.6, -17.5, Math.PI / 2, 1, 'toon');
    b.prop(P.pipe(8, 0.25, 0xc98a4a), -5.8, 0.3, -10, Math.PI / 2, 1, 'toon');
    b.prop(P.pipe(5, 0.35, 0x8a96ac), 4.5, 0.4, -29.5, 0, 1, 'toon');
    for (const [x, z, h] of [[-11, -20, 9], [-13.5, -16, 7], [12, -6, 8], [14, -24, 10]]) {
      b.prop(P.chimney(h), x, -0.35, z, 0, 1.2, 'toon');
      b.emitter({ min: [x - 0.3, h * 1.2, z - 0.3], max: [x + 0.3, h * 1.2 + 0.3, z + 0.3], rate: 3.5, life: [4, 7], size: [1.2, 2.4], colors: [0x6a6272, 0x8a8290, 0x4a4450], vel: [0.8, 1.6, 0.2], spread: [0.3, 0.3, 0.3], alpha: 0.5, grow: 2.2 });
    }
    // factory sheds
    for (const [x, z, w, d, h, c] of [[-13, -8, 7, 9, 4, 0x8a5a4a], [13, -14, 7, 12, 5, 0x6a748a], [-17, -30, 8, 7, 4.5, 0x7a6a8a]]) {
      const parts = [part(box(w, h, d), c, { p: [x, h / 2 - 0.35, z], top: 0xb8a090 })];
      for (let i = 0; i < 3; i++) {
        const g = new THREE.CylinderGeometry(w / 6, w / 6, d, 3, 1);
        g.rotateX(Math.PI / 2);
        g.rotateZ(Math.PI / 2);
        parts.push(part(g, 0x4a4450, { p: [x - w / 3 + i * (w / 3), h - 0.35 + w / 12, z], s: [1, 0.8, 1] }));
      }
      b.put(merge(parts), 'toon');
      const win = [];
      for (let i = 0; i < 4; i++) win.push(part(box(0.9, 0.9, 0.08), 0xffd866, { p: [x - w / 2 + 1 + i * ((w - 2) / 3), h * 0.55 - 0.35, z + (z > -12 ? -1 : 1) * 0 + d / 2 + 0.02] }));
      b.put(merge(win), 'glowSoft');
    }
    // steam vents
    for (const [x, z] of [[3.1, -3.5], [-3.2, -13], [3.3, -20.5], [-9, -24.5]]) {
      b.put(part(cyl(0.22, 0.28, 0.5, 8), 0x3a3f4d, { p: [x, -0.1, z] }), 'toon');
      b.emitter({ min: [x - 0.05, 0.2, z - 0.05], max: [x + 0.05, 0.3, z + 0.05], rate: 7, life: [0.9, 1.6], size: [0.25, 0.5], colors: [0xffffff, 0xe6ecf7], vel: [0, 2.4, 0], spread: [0.25, 0.5, 0.25], alpha: 0.45, grow: 2.4, drag: 1 });
    }
    // warning lamps
    const lamps = [];
    for (const [x, y, z] of [[-2.75, 0.75, -18.4], [2.75, 0.75, -18.4], [-1.25, 0.75, -22.75], [-1.25, 0.75, -27.35]]) {
      const m = new THREE.Mesh(part(sph(0.14, 10, 8), 0xff5a36, {}), glowMat(2.6));
      m.position.set(x, y, z);
      b.add(m);
      b.put(part(cyl(0.05, 0.07, 0.3, 6), 0x3a3f4d, { p: [x, y - 0.24, z] }), 'toon');
      lamps.push(m);
    }
    b.anim((t) => { lamps.forEach((m, i) => { m.scale.setScalar(0.75 + 0.35 * (Math.sin(t * 5 + i * 1.6) > 0 ? 1 : 0)); }); });
    for (const [x, z] of [[-3.6, -1], [3.6, -9], [-4, -20], [-9.5, -22]]) {
      b.prop(P.lampPost({ h: 2.6 }), x, -0.35, z, 0, 1, 'toon');
      S.bulb(b, x, 2.45, z, 0xffd866, 0.15, true);
    }
    b.critter(C.robot({ cx: 5.2, cz: -2, radius: 1.6, speed: 0.9, y: -0.35, phase: 0 }));
    b.critter(C.robot({ cx: -5.6, cz: -17, radius: 1.3, speed: 0.8, y: -0.35, phase: 2, dir: -1, color: 0x4fc3f7 }));
    b.critter(C.robot({ cx: -5, cz: -30, radius: 2.0, speed: 1.0, y: -0.35, phase: 4, color: 0xff7ab8, s: 0.85 }));
    b.scatter(18, [-18, -34, 18, 8], (x, y, z) => b.prop(P.crate(0.5 + rng() * 0.5, rng.pick([0xc48a4a, 0x8a96ac, 0xd9553f])), x, y, z, rng() * TAU, 1, 'toon'), { margin: 1.4, minDist: 2.2 });
    b.scatter(8, [-18, -34, 18, 8], (x, y, z) => b.prop(P.barrel({ color: rng.pick([0x3d6fa8, 0xe8503a, 0x6fae4a]) }), x, y, z, 0, 1, 'toon'), { margin: 1.4, minDist: 2.2 });
    S.mountains(b, { color: 0x5a4034, snow: 0x8a6858, snowLine: 0.8, cz: -12, h: 14, r: 18, count: 10 });
    b.emitter({ min: [-2.4, -0.17, -27], max: [2.4, -0.14, -18.6], rate: 5, life: [0.6, 1.0], size: [0.15, 0.35], colors: [0xd9ff8a, 0xf1ffc0], grow: 2, alpha: 0.8, shape: 2 });
    b.emitter({ min: [-2.4, -0.17, -27], max: [2.4, -0.14, -18.6], rate: 3, life: [1.2, 2], size: [0.06, 0.12], colors: [0xd9ff8a], vel: [0, 0.9, 0], spread: [0.1, 0.3, 0.1], alpha: 0.8 });
  });

  return b.finish();
}
