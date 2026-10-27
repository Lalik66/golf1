// Rexy the T-Rex: a big animated dinosaur that straddles the fairway.
// The same pose functions drive the colliders and the visible model.
import * as THREE from 'three';
import { part, merge, box, cyl, cone, sph, capsule, tube } from './geo.js';
import { toonMat, glowMat } from './materials.js';
import { MAT } from './physics.js';
import { clamp, smoothstep, easeInOut, TAU } from './utils.js';

export const CHOMP_PERIOD = 5.4;
export const CHOMP_MAX = 0.761; // rad, head just above the turf
const TAIL_N = 9;
const TAIL_LEN = 0.85;
const TAIL_Y = [3.15, 2.7, 2.05, 1.35, 0.74, 0.4, 0.31, 0.26, 0.22, 0.19];
const TAIL_R = [0.95, 0.86, 0.74, 0.62, 0.5, 0.39, 0.31, 0.24, 0.18, 0.12];
const TAIL_W = (TAU) / 3.4;

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const _d = new THREE.Vector3();

/** Pitch of the upper body (0 = standing tall, CHOMP_MAX = biting the turf). */
export function chompAngle(t) {
  const p = ((t % CHOMP_PERIOD) + CHOMP_PERIOD) % CHOMP_PERIOD;
  if (p < 3.0) return 0.035 * Math.sin(t * 1.3);
  if (p < 3.45) return -0.16 * easeInOut((p - 3.0) / 0.45);
  if (p < 3.8) {
    const k = (p - 3.45) / 0.35;
    return -0.16 + (CHOMP_MAX + 0.16) * k * k;
  }
  if (p < 4.55) return CHOMP_MAX - 0.05 * Math.abs(Math.sin((p - 3.8) * 9)) * (1 - (p - 3.8) / 0.75);
  return CHOMP_MAX * (1 - easeInOut((p - 4.55) / (CHOMP_PERIOD - 4.55)));
}

export function jawAngle(t) {
  const p = ((t % CHOMP_PERIOD) + CHOMP_PERIOD) % CHOMP_PERIOD;
  if (p < 2.9) return 0.06 + 0.05 * Math.sin(t * 1.3);
  if (p < 3.75) return 0.06 + 0.75 * smoothstep(2.9, 3.4, p);
  if (p < 3.85) return 0.81 * (1 - (p - 3.75) / 0.1);
  if (p < 4.55) return 0.25 * Math.abs(Math.sin((p - 3.85) * 8));
  return 0.06;
}

let tailT = NaN;
const tailPts = [];
for (let i = 0; i <= TAIL_N; i++) tailPts.push([0, 0, 0]);

/** Tail joints for a given time, in the dinosaur frame (hips at the origin, facing +Z). */
export function tailPoints(t) {
  if (t === tailT) return tailPts;
  tailT = t;
  let x = 0, z = -1.0;
  tailPts[0][0] = 0; tailPts[0][1] = TAIL_Y[0]; tailPts[0][2] = z;
  for (let i = 0; i < TAIL_N; i++) {
    const amp = 0.1 + 0.36 * (i / (TAIL_N - 1));
    const yaw = amp * Math.sin(TAIL_W * t - i * 0.42);
    const dy = TAIL_Y[i + 1] - TAIL_Y[i];
    const hl = Math.sqrt(Math.max(0.01, TAIL_LEN * TAIL_LEN - dy * dy));
    x += Math.sin(yaw) * hl;
    z -= Math.cos(yaw) * hl;
    tailPts[i + 1][0] = x; tailPts[i + 1][1] = TAIL_Y[i + 1]; tailPts[i + 1][2] = z;
  }
  return tailPts;
}

function segPose(i, t, origin, out) {
  const p = tailPoints(t);
  const a = p[i], c = p[i + 1];
  out.pos.set(origin[0] + a[0], a[1], origin[2] + a[2]);
  _d.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]).normalize();
  out.quat.setFromUnitVectors(Z_AXIS, _d);
}

function ell(rx, ry, rz, color, o = {}) {
  const g = sph(1, o.ws || 16, o.hs || 12);
  g.scale(rx, ry, rz);
  return part(g, color, o);
}

/**
 * Adds the dinosaur to a course. origin = ground point under the hips.
 * Returns nothing; colliders and visuals are registered on the builder.
 */
export function addRex(b, origin, o = {}) {
  const ox = origin[0], oz = origin[2];
  const HIP_Y = 3.4;
  const SKIN = o.skin === undefined ? 0x5fb04f : o.skin;
  const SKIN2 = o.skin2 === undefined ? 0x8fd36a : o.skin2;
  const BELLY = o.belly === undefined ? 0xe3e6a0 : o.belly;
  const DARK = o.dark === undefined ? 0x2f7a3a : o.dark;

  // ---------------------------------------------------------------- static legs
  for (const sx of [-1, 1]) {
    b.world.addCapsule([ox + sx * 1.95, 0.3, oz - 0.55], [ox + sx * 1.95, 0.3, oz + 0.95], 0.35, { mat: MAT.flesh });
    b.world.addCapsule([ox + sx * 1.9, 0.55, oz - 0.35], [ox + sx * 1.75, 1.75, oz + 0.55], 0.42, { mat: MAT.flesh });
    b.world.addCapsule([ox + sx * 1.75, 1.75, oz + 0.55], [ox + sx * 1.05, 3.1, oz], 0.62, { mat: MAT.flesh });
  }

  // ---------------------------------------------------------------- upper body (kinematic)
  const upperShapes = [
    { type: 'box', c: [0, 1.55, 4.6], h: [0.9, 0.7, 1.15] },
    { type: 'cap', a: [0, 0.6, 1.2], b: [0, 1.5, 3.4], r: 0.95 },
  ];
  let upper = null, jaw = null, headGroup = null;
  if (b.visual) {
    upper = new THREE.Group();
    const torso = [
      ell(1.3, 1.4, 2.35, SKIN, { p: [0, 0.35, 1.0], r: [-0.22, 0, 0], top: SKIN2 }),
      ell(0.95, 1.05, 1.9, BELLY, { p: [0, -0.22, 1.25], r: [-0.22, 0, 0] }),
      ell(0.85, 0.95, 1.35, SKIN, { p: [0, 1.25, 3.15], r: [-0.62, 0, 0], top: SKIN2 }),
      ell(0.6, 0.62, 1.0, BELLY, { p: [0, 0.85, 3.35], r: [-0.62, 0, 0] }),
    ];
    for (let i = 0; i < 7; i++) {
      torso.push(ell(0.5 - i * 0.03, 0.12, 0.2, DARK, { p: [0, 1.62 + i * 0.05 - (i > 4 ? (i - 4) * 0.2 : 0), -0.4 + i * 0.55], r: [-0.22, 0, 0] }));
    }
    // tiny arms
    for (const sx of [-1, 1]) {
      torso.push(part(capsule(0.13, 0.5, 3, 8), SKIN, { p: [sx * 0.95, -0.1, 2.85], r: [0.9, 0, sx * -0.25] }));
      torso.push(part(capsule(0.1, 0.4, 3, 8), SKIN, { p: [sx * 1.0, -0.42, 3.22], r: [-0.5, 0, 0] }));
      for (let k = 0; k < 2; k++) torso.push(part(cone(0.04, 0.16, 5), 0xf7f1dc, { p: [sx * (0.95 + k * 0.1), -0.66, 3.34], r: [Math.PI * 0.8, 0, 0] }));
    }
    const tm = new THREE.Mesh(merge(torso), toonMat({ rim: 0.18 }));
    tm.castShadow = true;
    upper.add(tm);

    headGroup = new THREE.Group();
    headGroup.position.set(0, 1.75, 3.9);
    const skull = [
      ell(0.88, 0.72, 1.0, SKIN, { p: [0, 0.12, 0.45], top: SKIN2 }),
      ell(0.7, 0.5, 1.0, SKIN, { p: [0, 0.02, 1.25], top: SKIN2 }),
      ell(0.3, 0.2, 0.34, DARK, { p: [0.5, 0.5, 0.45] }),
      ell(0.3, 0.2, 0.34, DARK, { p: [-0.5, 0.5, 0.45] }),
      ell(0.09, 0.06, 0.1, 0x1b2a1b, { p: [0.28, 0.3, 2.12] }),
      ell(0.09, 0.06, 0.1, 0x1b2a1b, { p: [-0.28, 0.3, 2.12] }),
      part(box(1.2, 0.1, 1.9), 0xb8323a, { p: [0, -0.34, 1.15] }),
    ];
    for (let i = 0; i < 9; i++) {
      for (const sx of [-1, 1]) {
        skull.push(part(cone(0.075, 0.26 - (i % 2) * 0.06, 5), 0xffffff, { p: [sx * (0.6 - i * 0.025), -0.47, 0.35 + i * 0.2], r: [Math.PI, 0, 0] }));
      }
    }
    for (let i = 0; i < 4; i++) skull.push(part(cone(0.075, 0.24, 5), 0xffffff, { p: [-0.3 + i * 0.2, -0.46, 2.12], r: [Math.PI, 0, 0] }));
    const sm = new THREE.Mesh(merge(skull), toonMat({ rim: 0.18 }));
    sm.castShadow = true;
    headGroup.add(sm);
    const eyes = new THREE.Mesh(merge([
      ell(0.15, 0.15, 0.1, 0xffe14d, { p: [0.62, 0.36, 0.7], r: [0, 0.9, 0] }),
      ell(0.15, 0.15, 0.1, 0xffe14d, { p: [-0.62, 0.36, 0.7], r: [0, -0.9, 0] }),
    ]), glowMat(1.25));
    headGroup.add(eyes);
    headGroup.add(new THREE.Mesh(merge([
      ell(0.05, 0.12, 0.05, 0x111118, { p: [0.71, 0.36, 0.76] }),
      ell(0.05, 0.12, 0.05, 0x111118, { p: [-0.71, 0.36, 0.76] }),
    ]), toonMat({ key: 'pupil' })));

    jaw = new THREE.Group();
    jaw.position.set(0, -0.42, 0.25);
    const jw = [
      ell(0.66, 0.26, 1.0, SKIN, { p: [0, -0.16, 0.85] }),
      ell(0.5, 0.2, 0.85, BELLY, { p: [0, -0.26, 0.8] }),
      part(box(1.0, 0.08, 1.6), 0xb8323a, { p: [0, 0.02, 0.85] }),
      ell(0.3, 0.06, 0.6, 0xff7a8a, { p: [0, 0.08, 0.8] }),
    ];
    for (let i = 0; i < 8; i++) {
      for (const sx of [-1, 1]) jw.push(part(cone(0.065, 0.2, 5), 0xffffff, { p: [sx * (0.5 - i * 0.025), 0.14, 0.3 + i * 0.19] }));
    }
    const jm = new THREE.Mesh(merge(jw), toonMat({ rim: 0.18 }));
    jm.castShadow = true;
    jaw.add(jm);
    headGroup.add(jaw);
    upper.add(headGroup);

    // legs and hips (static visuals)
    const legs = [ell(1.25, 1.2, 1.5, SKIN, { p: [ox, HIP_Y - 0.1, oz - 0.2], top: SKIN2 })];
    for (const sx of [-1, 1]) {
      legs.push(ell(0.75, 1.15, 0.95, SKIN, { p: [ox + sx * 1.3, 2.55, oz + 0.3], r: [0.5, 0, sx * -0.3], top: SKIN2 }));
      legs.push(part(capsule(0.4, 0.9, 4, 10), SKIN, { p: [ox + sx * 1.82, 1.15, oz + 0.1], r: [-0.62, 0, sx * -0.1] }));
      legs.push(part(capsule(0.3, 0.5, 4, 10), SKIN, { p: [ox + sx * 1.92, 0.55, oz - 0.35], r: [0.5, 0, 0] }));
      legs.push(ell(0.42, 0.26, 0.85, SKIN, { p: [ox + sx * 1.95, 0.24, oz + 0.35] }));
      for (let k = -1; k <= 1; k++) {
        legs.push(ell(0.14, 0.13, 0.36, SKIN, { p: [ox + sx * 1.95 + k * 0.26, 0.15, oz + 1.1], r: [0, k * 0.25, 0] }));
        legs.push(part(cone(0.08, 0.26, 6), 0xf7f1dc, { p: [ox + sx * 1.95 + k * 0.3, 0.12, oz + 1.48], r: [Math.PI / 2, 0, 0] }));
      }
    }
    b.put(merge(legs), 'rim');
  }
  const hip = [ox, HIP_Y, oz];
  b.kinematic({
    mat: MAT.flesh, shapes: upperShapes, mesh: upper,
    pose: (t, out) => {
      out.pos.set(hip[0], hip[1], hip[2]);
      out.quat.setFromAxisAngle(X_AXIS, chompAngle(t));
    },
  });

  // ---------------------------------------------------------------- tail
  for (let i = 0; i < TAIL_N; i++) {
    const r = (TAIL_R[i] + TAIL_R[i + 1]) / 2;
    let mesh = null;
    if (b.visual) {
      const g = cyl(TAIL_R[i + 1], TAIL_R[i], TAIL_LEN, 12, true);
      g.rotateX(Math.PI / 2);
      g.translate(0, 0, TAIL_LEN / 2);
      const parts = [part(g, SKIN, {}), part(sph(TAIL_R[i], 12, 8), SKIN, {})];
      if (i === TAIL_N - 1) parts.push(part(sph(TAIL_R[i + 1], 8, 6), SKIN, { p: [0, 0, TAIL_LEN] }));
      if (i < 6) parts.push(ell(TAIL_R[i] * 0.45, 0.1, 0.18, DARK, { p: [0, TAIL_R[i] * 0.93, 0.3] }));
      mesh = new THREE.Mesh(merge(parts), toonMat({ rim: 0.18 }));
      mesh.castShadow = true;
    }
    const shapes = i >= 3 ? [{ type: 'cap', a: [0, 0, 0], b: [0, 0, TAIL_LEN], r }] : [{ type: 'sph', c: [0, 0, TAIL_LEN / 2], r: r * 0.9 }];
    b.kinematic({ mat: MAT.flesh, shapes, mesh, pose: (t, out) => segPose(i, t, origin, out) });
  }

  // ---------------------------------------------------------------- life
  if (b.visual) {
    let lastPhase = 0;
    const look = new THREE.Vector3();
    b.info.watch = (ballPos) => { look.copy(ballPos); };
    b.anim((t) => {
      const p = t % CHOMP_PERIOD;
      jaw.rotation.x = jawAngle(t);
      const idle = p < 2.9 ? 1 : 0;
      // glance at the ball while idle
      const dx = look.x - ox, dz = look.z - (oz + 4);
      const want = idle ? clamp(Math.atan2(dx, Math.max(2, Math.abs(dz) + 2)), -0.5, 0.5) * (dz > -3 ? 1 : 0.3) : 0;
      headGroup.rotation.y += (want + Math.sin(t * 0.7) * 0.12 * idle - headGroup.rotation.y) * 0.06;
      headGroup.rotation.z = Math.sin(t * 0.9) * 0.05 * idle;
      if (lastPhase < 3.0 && p >= 3.0) b.sound('roar');
      if (lastPhase < 3.8 && p >= 3.8) b.sound('stomp');
      lastPhase = p;
    });
  }
}
