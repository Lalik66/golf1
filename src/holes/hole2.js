// Hole 2 - Windmill Way. Putt through the gap under the spinning blades.
import * as THREE from 'three';
import { CourseBuilder, MAT } from '../builder.js';
import * as P from '../props.js';
import * as C from '../critters.js';
import * as S from '../scenery.js';
import { part, merge, box, cyl, cone, sph, torus, ico } from '../geo.js';
import { toonMat } from '../materials.js';
import { TAU } from '../utils.js';

const HUB = [0, 3.3, -8.72];
const SPEED = 1.0; // rad / s

function bladesGeometry() {
  const parts = [];
  for (let k = 0; k < 4; k++) {
    const rz = (k * Math.PI) / 2;
    const m = new THREE.Matrix4().makeRotationZ(rz);
    const add = (g, color) => { const p = part(g, color, {}); p.applyMatrix4(m); parts.push(p); };
    const place = (g, x, y, z) => { g.translate(x, y, z); return g; };
    add(place(box(0.12, 3.05, 0.09), 0, 1.7, 0), 0x7a4a2b);
    add(place(box(0.8, 0.07, 0.06), 0.34, 0.75, 0), 0x7a4a2b);
    add(place(box(0.8, 0.07, 0.06), 0.34, 3.2, 0), 0x7a4a2b);
    add(place(box(0.07, 2.5, 0.06), 0.72, 1.97, 0), 0x7a4a2b);
    for (let i = 0; i < 5; i++) {
      add(place(box(0.62, 0.42, 0.035), 0.4, 0.98 + i * 0.49, 0), i % 2 ? 0xf7f1dc : 0xe8503a);
    }
  }
  parts.push(part(cyl(0.34, 0.34, 0.3, 14), 0x5a3a2a, { r: [Math.PI / 2, 0, 0] }));
  parts.push(part(sph(0.26, 12, 8), 0xffd23f, { p: [0, 0, 0.18], s: [1, 1, 0.6] }));
  return merge(parts);
}

export default function build(opts = {}) {
  const b = new CourseBuilder({ ...opts, seed: 202 });
  b.meta({
    name: 'Windmill Way', par: 3,
    hint: 'Time your putt to slip through the gap under the spinning blades.',
    path: [[0, 0, 0], [0, 0, -8.4], [0, 0, -12.6], [1.3, 0, -18.3]],
    flyover: { side: 7.5, height: 4.0, back: 7 },
  });
  b.theme({
    skyTop: 0xd4843a, skyHorizon: 0xffe2c0, skyBottom: 0x8aa04a,
    sunDir: [-0.5, 0.75, 0.42], sunColor: 0xffe6c4,
    hemiSky: 0xffe8cc, hemiGround: 0x6d8a32,
    fog: 0xf6e2c4, fogDensity: 0.0052, ambient: 'meadow',
    cloudCut: 0.48, wind: 1.5,
  });
  b.wallColor = 0xa86a38;
  b.wallCap = 0xe8b070;

  const GREEN = 0x86a33a;
  const outline = [
    [-2, 2], [2, 2], [2, -9], [0.6, -9], [0.6, -12], [2.6, -12], [2.6, -19.5], [1.4, -21],
    [-1.4, -21], [-2.6, -19.5], [-2.6, -12], [-0.6, -12], [-0.6, -9], [-2, -9],
  ];
  b.floor(outline, 0, { color: GREEN });
  b.border(outline, 0, { skip: [2, 3, 4, 10, 11, 12] });
  b.tee(0, 0, 0);
  b.cup(1.3, 0, -18.3);

  // ---- windmill base (solid) with the tunnel
  const STONE = 0xe9dcc3;
  b.box([-1.65, 1.1, -10.5], [2.1, 3.0, 3.0], { mat: MAT.stone, color: STONE, top: 0xf7efdd });
  b.box([1.65, 1.1, -10.5], [2.1, 3.0, 3.0], { mat: MAT.stone, color: STONE, top: 0xf7efdd });
  b.box([0, 1.62, -10.5], [1.2, 1.96, 3.0], { mat: MAT.stone, color: STONE, top: 0xf7efdd });
  // a mound in the back green keeps things interesting
  b.bumper(-1.2, -15.2, 0, { soft: true, r: 0.4, color: 0xffd23f, capColor: 0xff7043, band: 0xffffff });

  // ---- blades (kinematic)
  const shapes = [];
  for (let k = 0; k < 4; k++) {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), (k * Math.PI) / 2);
    const c = new THREE.Vector3(0.3, 1.93, 0).applyQuaternion(q);
    shapes.push({ type: 'box', c: [c.x, c.y, c.z], h: [0.44, 1.33, 0.09], quat: q });
  }
  const axis = new THREE.Vector3(0, 0, 1);
  let bladeMesh = null;
  if (b.visual) {
    bladeMesh = new THREE.Mesh(bladesGeometry(), toonMat({ key: 'blades' }));
    bladeMesh.castShadow = true;
    bladeMesh.receiveShadow = true;
  }
  b.kinematic({
    mat: MAT.wood,
    shapes,
    mesh: bladeMesh,
    pose: (t, o) => {
      o.pos.set(HUB[0], HUB[1], HUB[2]);
      o.quat.setFromAxisAngle(axis, t * SPEED + 0.5);
    },
  });

  b.camZone({ x0: -3.2, x1: 3.2, z0: -22, z1: -9.8, pos: [6.4, 4.4, -13.2] });

  b.terrain({ y: -0.35, color: 0x90a848, color2: 0x748c38, color3: 0xa4bc62, cz: -10, flat: 26, dips: [{ x: -13, z: -12, r: 5, d: 1.0 }, { x: -13, z: -4, r: 5, d: 1.0 }, { x: -13, z: -20, r: 5, d: 1.0 }] });

  b.decor(() => {
    const rng = b.rng;
    // ---- windmill body
    const tower = [];
    tower.push(part(cyl(1.0, 1.45, 4.9, 8), 0xfaf3e3, { p: [0, 5.05, -10.5], top: 0xffffff }));
    tower.push(part(cyl(1.62, 1.62, 0.16, 8), 0x8a5a33, { p: [0, 2.7, -10.5] }));
    tower.push(part(cone(1.42, 1.7, 8), 0xd9553f, { p: [0, 8.35, -10.5], top: 0xf07a5a }));
    tower.push(part(sph(0.14, 8, 6), 0xffd23f, { p: [0, 9.25, -10.5] }));
    tower.push(part(cyl(0.16, 0.16, 0.8, 10), 0x5a3a2a, { p: [0, HUB[1], -9.05], r: [Math.PI / 2, 0, 0] }));
    for (const [y, a] of [[4.4, 0], [6.2, 0], [5.2, Math.PI / 2], [5.2, -Math.PI / 2], [4.6, Math.PI]]) {
      const r = 1.47 - ((y - 2.6) / 4.9) * 0.45;
      tower.push(part(box(0.5, 0.7, 0.12), 0x3d6fa8, { p: [Math.sin(a) * r, y, -10.5 + Math.cos(a) * r], r: [0, a, 0] }));
      tower.push(part(box(0.62, 0.1, 0.16), 0x8a5a33, { p: [Math.sin(a) * r, y - 0.4, -10.5 + Math.cos(a) * r], r: [0, a, 0] }));
    }
    // railing on the base roof
    for (let i = 0; i < 12; i++) {
      const x = -2.5 + (i / 11) * 5;
      tower.push(part(box(0.08, 0.45, 0.08), 0x8a5a33, { p: [x, 2.82, -9.1] }));
      tower.push(part(box(0.08, 0.45, 0.08), 0x8a5a33, { p: [x, 2.82, -11.9] }));
    }
    tower.push(part(box(5.2, 0.07, 0.1), 0x8a5a33, { p: [0, 3.05, -9.1] }));
    tower.push(part(box(5.2, 0.07, 0.1), 0x8a5a33, { p: [0, 3.05, -11.9] }));
    // arch trims around the tunnel mouths
    for (const z of [-8.97, -12.03]) {
      tower.push(part(box(0.18, 0.7, 0.12), 0xc9a27a, { p: [-0.69, 0.35, z] }));
      tower.push(part(box(0.18, 0.7, 0.12), 0xc9a27a, { p: [0.69, 0.35, z] }));
      tower.push(part(box(1.56, 0.18, 0.12), 0xc9a27a, { p: [0, 0.74, z] }));
      tower.push(part(box(0.3, 0.26, 0.14), 0xd9553f, { p: [0, 0.78, z] }));
    }
    b.put(merge(tower), 'toon');
    // dark tunnel lining
    b.put(merge([
      part(box(0.02, 0.62, 3), 0x5a4a3a, { p: [-0.59, 0.31, -10.5] }),
      part(box(0.02, 0.62, 3), 0x5a4a3a, { p: [0.59, 0.31, -10.5] }),
    ]), 'toon');

    S.mountains(b, { color: 0x9a7a58, snowLine: 0.75, cz: -10, h: 12 });
    S.clouds(b, { count: 9, y: 24 });

    // ---- tulip fields
    const colors = [0xff3b3b, 0xffd23f, 0xff7ab8, 0xb26bff, 0xff8a1f, 0xffffff];
    const tulips = [];
    const head = ico(0.085, 0);
    head.scale(1, 1.45, 1);
    for (const side of [-1, 1]) {
      let row = 0;
      for (let z = 1.5; z > -24; z -= 1.25) {
        const color = colors[row % colors.length];
        row++;
        for (let x = 3.6; x < 12.5; x += 0.55) {
          const px = side * (x + (rng() - 0.5) * 0.15), pz = z + (rng() - 0.5) * 0.2;
          if (side < 0 && px < -8.4) continue; // canal
          const h = 0.42 + rng() * 0.14;
          tulips.push(part(box(0.03, h, 0.03), 0x3c9a3c, { p: [px, -0.35 + h / 2, pz], sway: 1.2, swayBase: -0.35 }));
          tulips.push(part(head.clone(), color, { p: [px, -0.35 + h + 0.06, pz], sway: 1.2, swayBase: -0.35, flat: true }));
        }
      }
    }
    b.put(merge(tulips, { sway: true }), 'sway');

    // ---- canal with a little boat
    for (const z of [-4, -12, -20]) S.pond(b, -13, z, 4.4, -0.62, { shallow: 0x6fdcf0, deep: 0x2a8fd0 });
    const boat = new THREE.Mesh(merge([
      part(box(0.9, 0.3, 2.0), 0xd9553f, { p: [0, 0.12, 0] }),
      part(box(0.7, 0.06, 1.7), 0xf2c088, { p: [0, 0.26, 0] }),
      part(cyl(0.04, 0.04, 1.6, 6), 0x7a4a2b, { p: [0, 1.0, 0.2] }),
      part(cone(0.6, 1.2, 3), 0xffffff, { p: [0, 1.15, -0.25], s: [0.1, 1, 1] }),
    ]), toonMat({ rim: 0.2 }));
    boat.castShadow = true;
    b.add(boat);
    b.anim((t) => {
      boat.position.set(-13 + Math.sin(t * 0.2) * 1.2, -0.66 + Math.sin(t * 1.4) * 0.04, -12 + Math.sin(t * 0.13) * 6);
      boat.rotation.set(Math.sin(t * 1.2) * 0.05, Math.cos(t * 0.13) * 0.3, Math.sin(t * 1.5) * 0.06);
    });
    for (let i = 0; i < 12; i++) b.prop(P.reed(rng), -9.2 + rng() * 0.8, -0.6, 2 - i * 2.2 + rng(), 0, 1, 'sway');

    // ---- far windmills with turning sails
    for (const [x, z, s, ph] of [[26, -34, 1.5, 0.3], [-30, -30, 1.8, 1.4], [18, 12, 1.2, 2.2]]) {
      const y = b.terrainFn(x, z) - 0.2;
      b.put(merge([
        part(cyl(0.8 * s, 1.3 * s, 4.5 * s, 8), 0xfaf3e3, { p: [x, y + 2.25 * s, z] }),
        part(cone(1.1 * s, 1.4 * s, 8), 0xd9553f, { p: [x, y + 5.2 * s, z] }),
      ]), 'toon');
      const sails = [];
      for (let k = 0; k < 4; k++) {
        const g = box(0.5 * s, 2.6 * s, 0.05);
        g.translate(0.2 * s, 1.5 * s, 0);
        g.applyMatrix4(new THREE.Matrix4().makeRotationZ((k * Math.PI) / 2));
        sails.push(part(g, 0xf7f1dc, {}));
      }
      const m = new THREE.Mesh(merge(sails), toonMat({ side: THREE.DoubleSide }));
      const toward = Math.atan2(-x, -10 - z);
      m.position.set(x + Math.sin(toward) * 1.25 * s, y + 4.0 * s, z + Math.cos(toward) * 1.25 * s);
      m.rotation.y = toward;
      b.add(m);
      b.anim((t) => { m.rotation.z = t * 0.6 + ph; });
    }

    // ---- life
    b.critter(C.sheep({ x: 6.5, y: -0.35, z: -25.5, rot: 0.6, phase: 0 }));
    b.critter(C.sheep({ x: 9.2, y: -0.35, z: -27, rot: -1.2, phase: 2, s: 0.9 }));
    b.critter(C.sheep({ x: -5.5, y: -0.35, z: -26, rot: 2.4, phase: 4 }));
    b.critter(C.sheep({ x: 4.5, y: -0.35, z: 6.5, rot: 3.4, phase: 1.2, s: 0.85 }));
    b.prop(P.fence(7), 7.5, -0.35, -24, 0, 1, 'toon');
    b.prop(P.fence(7), -6.5, -0.35, -24, 0, 1, 'toon');
    b.prop(P.hut(rng, { roof: 0x3d6fa8, wall: 0xfaf3e3 }), -7, -0.35, 8, 2.6, 1.4, 'toon');
    b.scatter(14, [-34, -46, 34, 20], (x, y, z) => b.prop(P.tree(rng, { leaf: 0x3aa655, leaf2: 0x9be07c }), x, y - 0.05, z, rng() * TAU, 1 + rng() * 0.6, 'sway'), { margin: 14, minDist: 5 });
    b.scatter(8, [-20, -32, 20, 12], (x, y, z) => b.prop(P.bush(rng), x, y - 0.05, z, rng() * TAU, 0.9 + rng() * 0.5, 'sway'), { margin: 13, minDist: 3 });
    // hay bales
    for (const [x, z] of [[4.2, -23.2], [5.1, -23.6], [4.7, -22.7]]) {
      b.put(part(cyl(0.5, 0.5, 0.7, 14), 0xf2d16b, { p: [x, 0.15, z], r: [0, rng() * 3, Math.PI / 2], top: 0xffe699 }), 'toon');
    }
    for (let i = 0; i < 7; i++) {
      b.critter(C.butterfly({ x: -7 + rng() * 14, y: 0.7 + rng() * 0.8, z: -20 + rng() * 20, r: 1.5 + rng() * 2.5, color: rng.pick([0xffffff, 0xffd23f, 0x4fc3f7]), phase: rng() * 10 }));
    }
    for (let i = 0; i < 5; i++) {
      b.critter(C.bird({ cx: rng.range(-6, 6), cz: rng.range(-16, -4), radius: 10 + rng() * 8, speed: 3.5 + rng(), y: 9 + rng() * 4, phase: rng() * 6, dir: rng.sign(), color: 0xffffff, belly: 0xffffff, beak: 0xff8a1f }));
    }
    b.grass({ count: 5200, around: true, spread: 1.6, height: 0.42, base: 0x3d9a44, tip: 0xa8e86a, cut: 0.2 });
    b.emitter({
      follow: true, min: [-14, 0.3, -14], max: [14, 5, 14], rate: 7, life: [3, 6], size: [0.05, 0.1],
      colors: [0xffffff, 0xffd6e8, 0xfff7c2], vel: [1.4, 0.1, 0.4], spread: [0.4, 0.25, 0.4], alpha: 0.85,
    });
  });

  return b.finish();
}
