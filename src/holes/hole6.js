// Hole 6 - Lava Peak. Cross the narrow bridge and climb the cone: the cup
// sits in the crater at the top.
import * as THREE from 'three';
import { CourseBuilder, MAT, PATTERN } from '../builder.js';
import * as P from '../props.js';
import * as C from '../critters.js';
import * as S from '../scenery.js';
import { part, merge, box, cyl, sph, rockGeo } from '../geo.js';
import { makeLavaMaterial } from '../shaders.js';
import { TAU, smoothstep } from '../utils.js';

const LAVA = -0.6;
const CX = 0, CZ = -17;

function coneHeight(r) {
  if (r >= 5) return 0;
  if (r >= 1.7) return 1.25 * smoothstep(0, 1, (5 - r) / 3.3);
  if (r >= 0.5) return 0.9 + 0.35 * smoothstep(0, 1, (r - 0.5) / 1.2);
  return 0.9;
}

const STREAMS = [Math.PI / 2 + 1.05, Math.PI / 2 - 1.05, -Math.PI / 2];

function inStream(r, a) {
  if (r < 1.85 || r > 5.0) return false;
  for (const s of STREAMS) {
    let d = Math.abs(a - s) % TAU;
    if (d > Math.PI) d = TAU - d;
    if (d < 0.135) return true;
  }
  return false;
}

export default function build(opts = {}) {
  const b = new CourseBuilder({ ...opts, seed: 606 });
  b.meta({
    name: 'Lava Peak', par: 3,
    hint: 'Mind the bridge. Then give it just enough to climb the cone and drop into the crater.',
    path: [[0, 0, 0], [0, 0, -6], [0, 0, -10.8], [0, 0.35, -13.4], [0, 1.2, -15.4], [0, 0.9, -17]],
    flyover: { height: 5, back: 7.5, side: 4 },
  });
  b.theme({
    skyTop: 0x2a0c12, skyHorizon: 0xe8741a, skyBottom: 0x4a1408,
    sunDir: [-0.5, 0.62, 0.4], sunColor: 0xffd0a0, sunIntensity: 2.7, sunDisc: 0xffd9a0, sunSize: 1.6,
    hemiSky: 0xffc4a0, hemiGround: 0xe8502a, hemiIntensity: 1.6,
    fog: 0x8a3018, fogDensity: 0.0095, outline: 0x1a0808,
    clouds: 0.75, cloudCut: 0.5, cloudColor: 0x8a3a2a, cloudShade: 0x3a1a1a,
    ambient: 'lava', bloom: 0.42, bloomThreshold: 0.9, wind: 0.5,
  });
  b.floorThick = 0.95;
  b.wallColor = 0x5a4038;
  b.wallCap = 0x8a6858;
  b.wallMat = MAT.stone;

  const BASALT = 0x6a5048;
  const start = [[-2, 2], [2, 2], [2, -6], [0.85, -6], [-0.85, -6], [-2, -6]];
  b.floor(start, 0, { color: BASALT, pattern: PATTERN.tiles, mat: MAT.green, side: 0x3a2824 });
  b.border(start, 0, { skip: [3], below: 0.9 });
  b.tee(0, 0, 0);

  // bridge without rails
  b.rect(-0.85, -6, 0.85, -10.75, 0, { color: 0x8a7060, pattern: PATTERN.tiles, mat: MAT.green, thick: 0.35, side: 0x4a3830 });

  // volcano arena
  const radii = [0.25, 0.5, 0.7, 0.9, 1.1, 1.3, 1.5, 1.7, 1.95, 2.2, 2.5, 2.8, 3.1, 3.4, 3.7, 4.0, 4.3, 4.65, 5.0, 5.7, 6.4];
  const c1 = new THREE.Color(0x6a5048), c2 = new THREE.Color(0xc0684a), c3 = new THREE.Color(0x5a3a3a), tmp = new THREE.Color();
  const ring = b.radial(CX, CZ, radii, 48, (r) => coneHeight(r), {
    mat: MAT.rock, pattern: PATTERN.none, side: 0x3a3440,
    cell: (r, a) => (inStream(r, a) ? { mat: MAT.lava } : null),
    specialMaterial: b.visual ? makeLavaMaterial({ scale: 2.2, glow: 0.9 }) : null,
    colorFn: (r, y) => {
      if (r > 5.05) return 0x6a5048;
      if (r < 1.7) return tmp.copy(c3).lerp(c2, smoothstep(0.5, 1.7, r)).getHex();
      return tmp.copy(c1).lerp(c2, smoothstep(0.1, 1.25, y)).getHex();
    },
  });
  b.border(ring, 0, { skip: [11, 12], below: 0.9 });
  b.cup(CX, 0.9, CZ, { flagColor: 0xffd23f });

  b.sea(LAVA, { type: 'lava', scale: 0.8, z: -14, bed: false, material: b.visual ? makeLavaMaterial({ scale: 0.8, glow: 0.35 }) : null });

  b.decor(() => {
    const rng = b.rng;
    // bridge supports
    b.put(merge([
      part(cyl(0.3, 0.42, 1.4, 8), 0x4a4350, { p: [0, -1.0, -7.2], top: 0x6f6678 }),
      part(cyl(0.3, 0.42, 1.4, 8), 0x4a4350, { p: [0, -1.0, -9.5], top: 0x6f6678 }),
    ]), 'toon');
    for (const [x, z] of [[-1.9, 1.9], [1.9, 1.9], [-1.9, -5.9], [1.9, -5.9]]) S.torch(b, x, 0.45, z, { h: 1.2, color: 0x3a3440, intensity: 5, distance: 7 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + 0.39;
      if (Math.abs(a - Math.PI / 2) < 0.4) continue;
      S.torch(b, CX + Math.cos(a) * 6.55, 0.45, CZ + Math.sin(a) * 6.55, { h: 1.0, color: 0x3a3440, light: i % 2 === 0, intensity: 4, distance: 7 });
    }
    b.light(0, 1.2, -8.3, 0xff6a1f, 8, 9, 0.2);
    b.light(CX, 2.6, CZ, 0xff8a3a, 7, 10, 0.2);

    // the big volcano behind
    b.prop(P.mountain(rng, 30, 34, 0x3a2f38, 0xff5a1f, 0.86), 6, LAVA - 1, -62, 0.3, 1, 'toon');
    b.put(part(sph(4.5, 14, 8), 0xffb347, { p: [6, LAVA + 31.5, -62], s: [1, 0.35, 1] }), 'glow');
    b.emitter({ min: [3, 31, -65], max: [9, 33, -59], rate: 7, life: [6, 10], size: [4, 9], colors: [0x3a3038, 0x5a4a50], vel: [-1.2, 2.6, 0], spread: [0.8, 0.6, 0.8], alpha: 0.6, grow: 1.8 });
    b.emitter({ min: [4.5, 31, -63.5], max: [7.5, 32, -60.5], rate: 26, life: [1.6, 3], size: [0.4, 0.9], colors: [0xff7a12, 0xffe066, 0xff3b1f], vel: [0, 9, 0], spread: [3.5, 3, 3.5], gravity: 6, additive: true, bright: 2.4 });
    S.mountains(b, { color: 0x3a2a35, snow: 0x5a3a3a, snowLine: 0.8, cz: -14, h: 20, r: 20, count: 12, y: LAVA - 1, dist: 105 });

    // obsidian islands
    const rocks = [];
    for (let i = 0; i < 26; i++) {
      const a = rng() * TAU, d = 9 + rng() * 24;
      const x = Math.cos(a) * d, z = -12 + Math.sin(a) * d;
      if (b.onCourse(x, z, 2.5)) continue;
      const r = 0.8 + rng() * 2.2;
      rocks.push(part(rockGeo(r, rng, 0.9 + rng() * 0.8, 1), 0x3a3440, { p: [x, LAVA + r * 0.2, z], top: 0x6a5a66 }));
      if (rng() < 0.45) b.prop(P.crystal(rng, 0xff6a2a, 0xffe066, 0.7 + rng() * 0.6), x, LAVA + r * 0.75, z, rng() * TAU, 1, 'glowSoft');
      if (rng() < 0.3) b.prop(P.deadTree(rng, { color: 0x1f1a22, h: 2.4 + rng() }), x + r * 0.4, LAVA + r * 0.5, z, rng() * TAU, 1, 'sway');
    }
    b.put(merge(rocks), 'toon');
    // lava fall from a cliff on the right
    const cliff = [];
    for (let i = 0; i < 8; i++) cliff.push(part(rockGeo(2.5 + rng() * 2, rng, 1.3, 1), 0x3a3440, { p: [15 + rng() * 5, LAVA + 1.5 + rng() * 4, -22 + rng() * 9], top: 0x6a5a66 }));
    b.put(merge(cliff), 'toon');
    S.waterfall(b, 12.6, 5.6, LAVA, -18, 2.4, { rotY: -Math.PI / 2, color: 0xff6a12, foam: 0xffe066, speed: 0.7 });
    b.light(11.5, 2, -18, 0xff6a1f, 9, 12, 0.2);

    // fire sprites
    b.critter(C.lavaSprite({ x: -2.1, y: LAVA, z: -8.2, h: 2.4, period: 3.6, phase: 0 }));
    b.critter(C.lavaSprite({ x: 2.3, y: LAVA, z: -7.4, h: 2.0, period: 4.4, phase: 0.5, s: 0.8 }));
    b.critter(C.lavaSprite({ x: -8.5, y: LAVA, z: -13, h: 2.8, period: 5, phase: 0.3, s: 1.2 }));
    b.critter(C.lavaSprite({ x: 8.2, y: LAVA, z: -11, h: 2.2, period: 4.1, phase: 0.75 }));
    for (let i = 0; i < 4; i++) {
      b.critter(C.bat({ cx: rng.range(-5, 5), cz: rng.range(-18, -4), radius: 7 + rng() * 5, speed: 4 + rng() * 2, y: 5 + rng() * 3, phase: rng() * 6, dir: rng.sign(), s: 1.3 }));
    }
    // embers and bubbling lava
    b.emitter({ follow: true, min: [-16, LAVA, -16], max: [16, LAVA + 0.2, 16], rate: 34, life: [2, 4.5], size: [0.05, 0.12], colors: [0xff7a12, 0xffe066, 0xff3b1f], vel: [0.3, 1.3, 0], spread: [0.5, 0.7, 0.5], additive: true, bright: 1.6, drag: 0.2 });
    b.emitter({ follow: true, min: [-14, LAVA + 0.02, -14], max: [14, LAVA + 0.05, 14], rate: 9, life: [0.5, 0.9], size: [0.2, 0.5], colors: [0xffb347, 0xffe066], grow: 2.5, additive: true, bright: 0.9, alpha: 0.7, shape: 2 });
    b.emitter({ min: [CX - 0.3, 1.1, CZ - 0.3], max: [CX + 0.3, 1.3, CZ + 0.3], rate: 5, life: [1.5, 2.6], size: [0.3, 0.6], colors: [0x5a4a50, 0x8a7a80], vel: [0, 1.2, 0], spread: [0.2, 0.3, 0.2], alpha: 0.4, grow: 2 });
  });

  return b.finish();
}
