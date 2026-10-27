// Toon materials (cel shading) built on MeshToonMaterial with shader patches
// for procedural floor patterns, rim light, plant sway and the cup cut-out.
import * as THREE from 'three';
import { CUP_R } from './physics.js';

/** Uniforms shared by every material in the game. */
export const U = {
  time: { value: 0 },
  wind: { value: 1 },
  cup: { value: new THREE.Vector4(0, -100, 0, CUP_R) },
  fogColor: { value: new THREE.Color(0xffffff) },
  fogDensity: { value: 0.008 },
  sunDir: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() },
  sunColor: { value: new THREE.Color(0xffffff) },
  tDepth: { value: null },
  resolution: { value: new THREE.Vector2(1, 1) },
  camNear: { value: 0.1 },
  camFar: { value: 600 },
};

export const LAYER_FX = 1; // objects on this layer are skipped by the outline pre-pass

function gradient(stops) {
  const data = new Uint8Array(stops.length * 4);
  stops.forEach((s, i) => {
    const v = Math.round(s * 255);
    data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255;
  });
  const tex = new THREE.DataTexture(data, stops.length, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

const GRAD = gradient([0.42, 0.42, 0.42, 0.72, 0.72, 1.0, 1.0, 1.0]);

export const GLSL_NOISE = /* glsl */`
float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}
// returns (F1, F2 - F1)
vec2 voronoi(vec2 p, float t) {
  vec2 n = floor(p), f = fract(p);
  float f1 = 8.0, f2 = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 o = hash22(n + g);
    o = 0.5 + 0.42 * sin(t + 6.2831 * o);
    vec2 r = g + o - f;
    float d = dot(r, r);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
  }
  f1 = sqrt(f1); f2 = sqrt(f2);
  return vec2(f1, f2 - f1);
}
`;

export const GLSL_SWAY = /* glsl */`
{
  vec4 swp = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    swp = instanceMatrix * swp;
  #endif
  swp = modelMatrix * swp;
  float ph = swp.x * 0.35 + swp.z * 0.27;
  vec2 sw = vec2(sin(uTime * 1.6 + ph) + 0.4 * sin(uTime * 3.1 + ph * 2.3), cos(uTime * 1.3 + ph * 1.2));
  transformed.xz += sw * 0.07 * uWind * aSway;
}
`;

const PATTERN_GLSL = /* glsl */`
float checker(vec2 p) {
  vec2 fw = max(fwidth(p), vec2(1e-4));
  vec2 i = 2.0 * (abs(fract((p - 0.5 * fw) * 0.5) - 0.5) - abs(fract((p + 0.5 * fw) * 0.5) - 0.5)) / fw;
  return 0.5 - 0.5 * i.x * i.y;
}
float gridLine(vec2 p, float w) {
  vec2 fw = max(fwidth(p), vec2(1e-4));
  vec2 g = abs(fract(p - 0.5) - 0.5) / fw;
  float l = min(g.x, g.y);
  float fade = clamp(1.0 - max(fw.x, fw.y) * 1.5, 0.0, 1.0);
  return (1.0 - smoothstep(w, w + 1.0, l)) * fade;
}
float lineX(float p, float w) {
  float fw = max(fwidth(p), 1e-4);
  float g = abs(fract(p - 0.5) - 0.5) / fw;
  float fade = clamp(1.0 - fw * 1.5, 0.0, 1.0);
  return (1.0 - smoothstep(w, w + 1.0, g)) * fade;
}
vec3 applyPattern(vec3 base, vec3 wp, vec3 op, inout vec3 glow) {
  #if PATTERN == 1
    base *= mix(1.0, 0.86, checker(wp.xz / 1.0));
  #elif PATTERN == 2
    float s = lineX(wp.z / 1.0 + 0.5, 0.0);
    float band = step(0.5, fract(wp.z * 0.5));
    float fwz = fwidth(wp.z * 0.5);
    band = mix(band, 0.5, clamp(fwz * 3.0, 0.0, 1.0));
    base *= mix(1.0, 0.88, band);
  #elif PATTERN == 3
    float pl = floor(wp.x / 0.45);
    float sh = hash11(pl * 7.31);
    float fwp = fwidth(wp.x / 0.45);
    base *= mix(0.88 + 0.2 * sh, 0.98, clamp(fwp * 2.0, 0.0, 1.0));
    base *= 1.0 - 0.45 * lineX(wp.x / 0.45, 0.6);
    float seg = wp.z / 2.2 + sh * 5.0;
    base *= 1.0 - 0.3 * lineX(seg, 0.4);
  #elif PATTERN == 4
    float gl = gridLine(wp.xz / 1.0, 0.8);
    float pulse = 0.75 + 0.25 * sin(uTime * 2.0 + wp.z * 0.6);
    glow += uGlowColor * gl * 0.85 * pulse;
    base *= 0.9 + 0.1 * checker(wp.xz / 2.0);
  #elif PATTERN == 5
    float n = fbm(wp.xz * 0.9);
    float streak = smoothstep(0.55, 0.75, vnoise(vec2(wp.x * 3.0 + wp.z * 1.2, wp.z * 0.35)));
    base = mix(base, vec3(1.0), 0.22 * streak + 0.12 * n);
  #elif PATTERN == 6
    vec2 tp = wp.xz / 1.1;
    tp.x += 0.5 * mod(floor(tp.y), 2.0);
    float th = hash21(floor(tp));
    float fwt = max(fwidth(tp.x), fwidth(tp.y));
    base *= mix(0.86 + 0.22 * th, 0.97, clamp(fwt * 2.0, 0.0, 1.0));
    base *= 1.0 - 0.4 * gridLine(tp, 0.7);
  #elif PATTERN == 7
    float r = sin(wp.x * 5.0 + sin(wp.z * 2.1) * 1.4) * 0.5 + 0.5;
    float fwr = fwidth(wp.x * 5.0);
    r = mix(r, 0.5, clamp(fwr * 0.7, 0.0, 1.0));
    base *= 0.93 + 0.1 * r;
  #elif PATTERN == 8
    vec2 mp = wp.xz / 1.4;
    base *= 1.0 - 0.35 * gridLine(mp, 0.6);
    vec2 rv = abs(fract(mp) - 0.5);
    float riv = 1.0 - smoothstep(0.03, 0.05, length(rv - vec2(0.42)));
    base *= 1.0 - 0.3 * riv * clamp(1.0 - fwidth(mp.x) * 6.0, 0.0, 1.0);
    base *= 0.95 + 0.08 * hash21(floor(mp));
  #elif PATTERN == 9
    vec3 d = normalize(op);
    float band = smoothstep(0.16, 0.2, abs(d.y));
    float dots = smoothstep(0.93, 0.95, abs(d.x));
    base = mix(uGlowColor, base, band);
    base = mix(base, uGlowColor, dots);
  #endif
  return base;
}
`;

function patch(shader, mat) {
  shader.uniforms.uTime = U.time;
  shader.uniforms.uWind = U.wind;
  shader.uniforms.uCup = U.cup;
  shader.uniforms.uGlowColor = { value: mat.userData.glowColor || new THREE.Color(0xffffff) };
  shader.uniforms.uRim = { value: mat.userData.rim || 0 };
  shader.uniforms.uGlow = { value: mat.userData.glow || 0 };

  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>
      varying vec3 vWPos;
      varying vec3 vOPos;
      uniform float uTime;
      uniform float uWind;
      #ifdef USE_SWAY
        attribute float aSway;
      #endif`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      vOPos = position;
      #ifdef USE_SWAY
        ${GLSL_SWAY}
      #endif`)
    .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
      {
        vec4 wp4 = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wp4 = instanceMatrix * wp4;
        #endif
        vWPos = (modelMatrix * wp4).xyz;
      }`);

  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>
      varying vec3 vWPos;
      varying vec3 vOPos;
      uniform float uTime;
      uniform vec4 uCup;
      uniform vec3 uGlowColor;
      uniform float uRim;
      uniform float uGlow;
      ${GLSL_NOISE}
      ${PATTERN_GLSL}`)
    .replace('#include <color_fragment>', `#include <color_fragment>
      vec3 patGlow = vec3(0.0);
      #ifdef CUP_HOLE
        if (abs(vWPos.y - uCup.y) < 0.06 && distance(vWPos.xz, uCup.xz) < uCup.w) discard;
      #endif
      diffuseColor.rgb = applyPattern(diffuseColor.rgb, vWPos, vOPos, patGlow);`)
    .replace('#include <opaque_fragment>', `
      #ifdef USE_RIM
        float rimV = 1.0 - max(dot(normalize(normal), normalize(vViewPosition)), 0.0);
        outgoingLight += diffuseColor.rgb * smoothstep(0.6, 0.7, rimV) * uRim;
      #endif
      outgoingLight += patGlow + diffuseColor.rgb * uGlow;
      #include <opaque_fragment>`);
}

const cache = new Map();

/**
 * Shared toon material. All colour comes from vertex colours so that static
 * geometry can be merged into very few draw calls.
 */
export function toonMat({
  pattern = 0, sway = false, rim = 0, glow = 0, glowColor = 0xffffff,
  side = THREE.FrontSide, cupHole = false, transparent = false, opacity = 1, key = '',
} = {}) {
  const k = [pattern, sway, rim, glow, glowColor, side, cupHole, transparent, opacity, key].join('|');
  if (cache.has(k)) return cache.get(k);
  const m = new THREE.MeshToonMaterial({
    vertexColors: true, gradientMap: GRAD, side, transparent, opacity,
  });
  m.defines = { TOON: '', PATTERN: pattern };
  if (sway) m.defines.USE_SWAY = '';
  if (rim > 0) m.defines.USE_RIM = '';
  if (cupHole) m.defines.CUP_HOLE = '';
  m.userData.rim = rim;
  m.userData.glow = glow;
  m.userData.glowColor = new THREE.Color(glowColor);
  m.onBeforeCompile = (shader) => patch(shader, m);
  cache.set(k, m);
  return m;
}

/** Unlit, HDR-bright material (bloom picks it up). Uses vertex colours. */
export function glowMat(strength = 2.0, { transparent = false, opacity = 1, side = THREE.FrontSide } = {}) {
  const k = ['glow', strength, transparent, opacity, side].join('|');
  if (cache.has(k)) return cache.get(k);
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, transparent, opacity, side, fog: true });
  m.color.setScalar(strength);
  m.toneMapped = false;
  cache.set(k, m);
  return m;
}

/** Override material of the outline pre-pass: view normals, with plant sway. */
export function makeNormalMaterial() {
  const m = new THREE.MeshNormalMaterial();
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = U.time;
    shader.uniforms.uWind = U.wind;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime;
        uniform float uWind;
        attribute float aSway;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        ${GLSL_SWAY}`);
  };
  return m;
}

export const PATTERN = {
  none: 0, checker: 1, stripes: 2, planks: 3, neon: 4, ice: 5, tiles: 6, sand: 7, metal: 8, ball: 9,
};
