// Custom GLSL materials: sky, water, lava, grass, portals, flags, belts...
import * as THREE from 'three';
import { U, GLSL_NOISE } from './materials.js';

const FOG_PARS = /* glsl */`
uniform vec3 uFogColor;
uniform float uFogDensity;
vec3 applyFog(vec3 c, float d) {
  float f = 1.0 - exp(-uFogDensity * uFogDensity * d * d);
  return mix(c, uFogColor, clamp(f, 0.0, 1.0));
}
`;

const DEPTH_PARS = /* glsl */`
uniform sampler2D tDepth;
uniform vec2 uRes;
uniform float uNear;
uniform float uFar;
float sceneViewZ(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  float z = (uNear * uFar) / ((uFar - uNear) * d - uFar);
  return -z;
}
`;

function shared(extra = {}) {
  return {
    uTime: U.time,
    uFogColor: U.fogColor,
    uFogDensity: U.fogDensity,
    uSunDir: U.sunDir,
    ...extra,
  };
}

function depthUniforms() {
  return { tDepth: U.tDepth, uRes: U.resolution, uNear: U.camNear, uFar: U.camFar };
}

const col = (c) => ({ value: new THREE.Color(c) });

// ------------------------------------------------------------------ sky
export function makeSkyMaterial(t) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTime: U.time,
      uSunDir: U.sunDir,
      uTop: col(t.skyTop), uHorizon: col(t.skyHorizon), uBottom: col(t.skyBottom),
      uSunColor: col(t.sunDisc ?? 0xfff2c0),
      uSunSize: { value: t.sunSize ?? 1 },
      uCloudColor: col(t.cloudColor ?? 0xffffff), uCloudShade: col(t.cloudShade ?? 0xd8e4f4),
      uCloud: { value: t.clouds ?? 0.9 },
      uCloudCut: { value: t.cloudCut ?? 0.52 },
      uStars: { value: t.stars ?? 0 },
      uAurora: { value: t.aurora ?? 0 },
      uNebula: { value: t.nebula ?? 0 },
      uNebA: col(t.nebulaA ?? 0x6a2cff), uNebB: col(t.nebulaB ?? 0x12b5ff),
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec3 vDir;
      uniform float uTime;
      uniform vec3 uSunDir, uTop, uHorizon, uBottom, uSunColor, uCloudColor, uCloudShade, uNebA, uNebB;
      uniform float uSunSize, uCloud, uCloudCut, uStars, uAurora, uNebula;
      ${GLSL_NOISE}
      float hash31(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 c = mix(uHorizon, uTop, smoothstep(0.0, 0.6, h));
        c = mix(c, uBottom, smoothstep(0.0, -0.3, h));

        if (uNebula > 0.0) {
          float n1 = fbm(d.xz * 2.2 + d.y * 1.7 + 5.0);
          float n2 = fbm(d.zy * 2.6 - d.x * 1.3 + 11.0);
          c += uNebA * smoothstep(0.45, 0.85, n1) * uNebula;
          c += uNebB * smoothstep(0.5, 0.9, n2) * uNebula * 0.8;
        }
        if (uStars > 0.0) {
          vec3 p = d * 85.0;
          vec3 ip = floor(p), fp = fract(p) - 0.5;
          float rnd = hash31(ip);
          float star = step(0.986, rnd) * smoothstep(0.32, 0.0, length(fp));
          float tw = 0.6 + 0.4 * sin(uTime * (2.0 + rnd * 5.0) + rnd * 100.0);
          c += vec3(star * tw * uStars * 2.4);
        }
        if (uAurora > 0.0 && h > 0.0) {
          float w = fbm(vec2(d.x * 3.0 + uTime * 0.03, d.z * 3.0)) * 5.0;
          float a = sin(d.x * 7.0 + w + uTime * 0.25) * 0.5 + 0.5;
          float band = smoothstep(0.55, 1.0, a) * smoothstep(0.08, 0.3, h) * smoothstep(0.85, 0.4, h);
          vec3 ac = mix(vec3(0.1, 1.0, 0.55), vec3(0.6, 0.25, 1.0), smoothstep(0.2, 0.7, h));
          c += ac * band * uAurora;
        }

        float sd = dot(d, normalize(uSunDir));
        float size = 0.0016 * uSunSize;
        float disc = smoothstep(1.0 - size - 0.0006, 1.0 - size, sd);
        float halo = pow(max(sd, 0.0), 32.0) * 0.3 + pow(max(sd, 0.0), 6.0) * 0.1;
        c += uSunColor * (disc * 2.2 + halo);

        if (h > 0.0 && uCloud > 0.0) {
          vec2 cp = d.xz / (h + 0.2) * 1.1;
          cp += uTime * vec2(0.01, 0.004);
          float n = fbm(cp);
          float n2 = fbm(cp + vec2(0.05, 0.09));
          float cov = smoothstep(uCloudCut, uCloudCut + 0.04, n);
          float lit = smoothstep(uCloudCut + 0.1, uCloudCut + 0.13, n2);
          vec3 cc = mix(uCloudShade, uCloudColor, lit);
          c = mix(c, cc, cov * smoothstep(0.0, 0.2, h) * uCloud);
        }
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}

// ------------------------------------------------------------------ water
export function makeWaterMaterial({
  shallow = 0x4fd6e8, deep = 0x1b7fc4, foam = 0xffffff, opacity = 0.86, wave = 1, scale = 1,
} = {}) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: shared({
      ...depthUniforms(),
      uShallow: col(shallow), uDeep: col(deep), uFoam: col(foam),
      uOpacity: { value: opacity }, uWave: { value: wave }, uScale: { value: scale },
    }),
    vertexShader: /* glsl */`
      uniform float uTime;
      uniform float uWave;
      varying vec3 vWPos;
      varying float vViewZ;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float w = sin(wp.x * 0.6 + uTime * 1.2) * 0.035 + sin(wp.z * 0.8 + uTime * 0.9) * 0.035
                + sin((wp.x + wp.z) * 0.3 + uTime * 0.6) * 0.04;
        wp.y += w * uWave;
        vWPos = wp.xyz;
        vec4 mv = viewMatrix * wp;
        vViewZ = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform float uTime;
      uniform vec3 uShallow, uDeep, uFoam, uSunDir;
      uniform float uOpacity, uScale;
      varying vec3 vWPos;
      varying float vViewZ;
      ${GLSL_NOISE}
      ${FOG_PARS}
      ${DEPTH_PARS}
      void main() {
        vec2 suv = gl_FragCoord.xy / uRes;
        float diff = sceneViewZ(suv) - vViewZ;
        float depthK = smoothstep(0.0, 1.6, diff);
        vec3 c = mix(uShallow, uDeep, depthK);

        vec2 uv = vWPos.xz * 0.42 * uScale;
        vec2 v1 = voronoi(uv + vec2(uTime * 0.05, uTime * 0.03), uTime * 0.7);
        vec2 v2 = voronoi(uv * 1.9 - vec2(uTime * 0.04, -uTime * 0.05) + 3.7, uTime * 0.9 + 2.0);
        float fade = clamp(1.0 - vViewZ / 90.0, 0.0, 1.0);
        float lines = (1.0 - smoothstep(0.03, 0.07, v1.y)) * 0.55 + (1.0 - smoothstep(0.02, 0.05, v2.y)) * 0.3;
        c = mix(c, uFoam, lines * fade * 0.8);

        // toon band from a fake normal
        float band = sin(vWPos.x * 0.6 + uTime * 1.2) + sin(vWPos.z * 0.8 + uTime * 0.9);
        c *= 0.96 + 0.06 * step(0.4, band);

        // shoreline foam where the water meets geometry
        float wob = vnoise(vWPos.xz * 3.0 + uTime * 0.6) * 0.18;
        float shore = 1.0 - smoothstep(0.1 + wob, 0.24 + wob, diff);
        float shore2 = (1.0 - smoothstep(0.34 + wob, 0.4 + wob, diff)) * step(0.5, fract(diff * 3.0 - uTime * 0.5));
        c = mix(c, uFoam, clamp(shore + shore2 * 0.5, 0.0, 1.0));

        float a = mix(0.55, uOpacity, depthK);
        a = max(a, shore);
        c = applyFog(c, vViewZ);
        gl_FragColor = vec4(c, a);
      }`,
  });
}

// ------------------------------------------------------------------ lava
export function makeLavaMaterial({ scale = 1, glow = 0.5 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: shared({
      ...depthUniforms(),
      uDark: col(0x3a0d05), uRed: col(0xd92b0b), uOrange: col(0xff7a12), uYellow: col(0xffe066),
      uScale: { value: scale }, uGlow: { value: glow },
    }),
    vertexShader: /* glsl */`
      uniform float uTime;
      varying vec3 vWPos;
      varying float vViewZ;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        wp.y += sin(wp.x * 0.7 + uTime * 0.8) * 0.02 + sin(wp.z * 0.9 + uTime * 0.6) * 0.02;
        vWPos = wp.xyz;
        vec4 mv = viewMatrix * wp;
        vViewZ = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform float uTime, uScale, uGlow;
      uniform vec3 uDark, uRed, uOrange, uYellow;
      varying vec3 vWPos;
      varying float vViewZ;
      ${GLSL_NOISE}
      ${FOG_PARS}
      ${DEPTH_PARS}
      void main() {
        vec2 uv = vWPos.xz * 0.3 * uScale;
        float t = uTime * 0.06;
        float n1 = fbm(uv * 1.4 + vec2(t, t * 0.6));
        float n2 = fbm(uv * 3.0 - vec2(t * 1.3, -t) + n1 * 1.6);
        vec2 vo = voronoi(uv * 2.0 + n1 * 0.7, uTime * 0.25);
        float crack = 1.0 - smoothstep(0.04, 0.2, vo.y);
        float heat = n2 * 0.75 + crack * 0.75 + 0.08 * sin(uTime * 1.5 + n1 * 12.0);
        vec3 c = uDark;
        c = mix(c, uRed, smoothstep(0.36, 0.4, heat));
        c = mix(c, uOrange, smoothstep(0.56, 0.6, heat));
        c = mix(c, uYellow, smoothstep(0.84, 0.88, heat));
        c *= 0.82 + smoothstep(0.45, 1.0, heat) * uGlow;
        float diff = sceneViewZ(gl_FragCoord.xy / uRes) - vViewZ;
        float shore = 1.0 - smoothstep(0.05, 0.3, diff);
        c = mix(c, uYellow * (1.0 + uGlow), shore);
        c = applyFog(c, vViewZ * 0.6);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}

// ------------------------------------------------------------------ grass
export function makeGrassMaterial({ base = 0x2f8f3a, tip = 0x9be05a } = {}) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: shared({ uWind: U.wind, uBase: col(base), uTip: col(tip) }),
    vertexShader: /* glsl */`
      attribute vec3 aOffset;
      attribute vec4 aParams; // height, angle, phase, tint
      uniform float uTime, uWind;
      varying float vH;
      varying float vTint;
      varying float vViewZ;
      void main() {
        float h = position.y;
        vec3 lp = vec3(position.x * 0.085, h * aParams.x, h * h * (0.22 + 0.2 * sin(aParams.z)) * aParams.x);
        float c = cos(aParams.y), s = sin(aParams.y);
        vec3 wp = vec3(c * lp.x + s * lp.z, lp.y, -s * lp.x + c * lp.z) + aOffset;
        float ph = aOffset.x * 0.35 + aOffset.z * 0.27;
        vec2 sw = vec2(sin(uTime * 1.6 + ph) + 0.4 * sin(uTime * 3.1 + ph * 2.3), cos(uTime * 1.3 + ph * 1.2));
        wp.xz += sw * 0.14 * uWind * h * h * aParams.x;
        vH = h;
        vTint = aParams.w;
        vec4 mv = viewMatrix * vec4(wp, 1.0);
        vViewZ = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform vec3 uBase, uTip;
      varying float vH;
      varying float vTint;
      varying float vViewZ;
      ${FOG_PARS}
      void main() {
        vec3 c = mix(uBase, uTip, smoothstep(0.1, 0.95, vH));
        c *= 0.82 + 0.36 * vTint;
        c = applyFog(c, vViewZ);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}

// ------------------------------------------------------------------ portal
export function makePortalMaterial(colorA = 0x7c3cff, colorB = 0x2ff3ff) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: shared({ uA: col(colorA), uB: col(colorB) }),
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform float uTime;
      uniform vec3 uA, uB;
      varying vec2 vUv;
      ${GLSL_NOISE}
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        p.y *= 1.0;
        float r = length(p);
        float a = atan(p.y, p.x);
        float sw = sin(a * 3.0 + r * 9.0 - uTime * 3.5);
        float sw2 = sin(a * 5.0 - r * 14.0 + uTime * 2.2);
        float n = vnoise(vec2(a * 2.0, r * 5.0 - uTime * 1.2));
        float k = smoothstep(-0.2, 0.2, sw + sw2 * 0.4 + n - 0.5);
        vec3 c = mix(uA, uB, k);
        c *= 1.4 + 1.6 * smoothstep(0.75, 1.0, r) + 0.8 * (1.0 - smoothstep(0.0, 0.25, r));
        float alpha = 1.0 - smoothstep(0.93, 1.0, r);
        gl_FragColor = vec4(c, alpha);
      }`,
  });
}

// ------------------------------------------------------------------ flag
export function makeFlagMaterial(color = 0xff3b3b, color2 = 0xffffff) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    transparent: true,
    uniforms: shared({ uColor: col(color), uColor2: col(color2), uAlpha: { value: 1 } }),
    vertexShader: /* glsl */`
      uniform float uTime;
      varying vec2 vUv;
      varying float vShade;
      varying float vViewZ;
      void main() {
        vUv = uv;
        vec3 p = position;
        float k = uv.x;
        float w = sin(uv.x * 7.0 - uTime * 6.0 + uv.y * 2.0);
        p.z += w * 0.07 * k;
        p.y += sin(uv.x * 4.0 - uTime * 4.0) * 0.03 * k;
        vShade = 0.85 + 0.15 * cos(uv.x * 7.0 - uTime * 6.0 + uv.y * 2.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vViewZ = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform vec3 uColor, uColor2;
      uniform float uAlpha;
      varying vec2 vUv;
      varying float vShade;
      varying float vViewZ;
      ${FOG_PARS}
      void main() {
        // triangular pennant with a contrast stripe
        float edge = abs(vUv.y - 0.5) * 2.0;
        if (edge > 1.0 - vUv.x * 0.85) discard;
        vec3 c = mix(uColor, uColor2, step(0.62, vUv.x + edge * 0.1) * step(vUv.x, 0.72));
        c *= floor(vShade * 4.0 + 0.5) / 4.0 + 0.1;
        c = applyFog(c, vViewZ);
        gl_FragColor = vec4(c, uAlpha);
      }`,
  });
}

// ------------------------------------------------------------------ belts and boosters
export function makeBeltMaterial({ speed = 2, dark = 0x2b2f3a, light = 0xf2b52e, glow = 0 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: shared({ uSpeed: { value: speed }, uDark: col(dark), uLight: col(light), uGlow: { value: glow } }),
    vertexShader: /* glsl */`
      varying vec2 vUv;
      varying float vViewZ;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vViewZ = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform float uTime, uSpeed, uGlow;
      uniform vec3 uDark, uLight;
      varying vec2 vUv;
      varying float vViewZ;
      ${FOG_PARS}
      void main() {
        // uv.y runs along the direction of travel in world units
        float v = vUv.y - uTime * uSpeed;
        float ch = fract(v / 1.1 + abs(vUv.x - 0.5) * 0.9);
        float fw = fwidth(vUv.y / 1.1) * 1.5;
        float k = smoothstep(0.5 - fw, 0.5 + fw, ch) * (1.0 - smoothstep(0.78 - fw, 0.78 + fw, ch));
        float edge = smoothstep(0.44, 0.47, abs(vUv.x - 0.5));
        vec3 c = mix(uDark, uLight, k);
        c = mix(c, uDark * 0.6, edge);
        c *= 1.0 + uGlow * k * 2.2;
        c = applyFog(c, vViewZ);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}

// ------------------------------------------------------------------ waterfall
export function makeWaterfallMaterial({ color = 0x6fdcf0, foam = 0xffffff, speed = 1.6 } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    uniforms: shared({ uColor: col(color), uFoam: col(foam), uSpeed: { value: speed } }),
    vertexShader: /* glsl */`
      varying vec2 vUv;
      varying float vViewZ;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vViewZ = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform float uTime, uSpeed;
      uniform vec3 uColor, uFoam;
      varying vec2 vUv;
      varying float vViewZ;
      ${GLSL_NOISE}
      ${FOG_PARS}
      void main() {
        vec2 p = vec2(vUv.x * 9.0, vUv.y * 2.2 + uTime * uSpeed);
        float n = vnoise(p) * 0.6 + vnoise(p * vec2(2.3, 0.6) + 4.0) * 0.4;
        float streak = smoothstep(0.52, 0.6, n);
        vec3 c = mix(uColor, uFoam, streak * 0.85);
        float bottom = 1.0 - smoothstep(0.0, 0.16, vUv.y + vnoise(vec2(vUv.x * 14.0, uTime * 3.0)) * 0.08);
        c = mix(c, uFoam, bottom);
        float side = smoothstep(0.0, 0.06, vUv.x) * smoothstep(1.0, 0.94, vUv.x);
        c = applyFog(c, vViewZ);
        gl_FragColor = vec4(c, 0.92 * side);
      }`,
  });
}

// ------------------------------------------------------------------ flames / glows
export function makeFlameMaterial(inner = 0xfff1a0, outer = 0xff5a12) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: shared({ uInner: col(inner), uOuter: col(outer), uSeed: { value: Math.random() * 10 } }),
    vertexShader: /* glsl */`
      uniform float uTime, uSeed;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        float k = uv.y;
        p.x += sin(uTime * 9.0 + uSeed * 7.0 + p.y * 6.0) * 0.06 * k;
        p.z += cos(uTime * 7.0 + uSeed * 3.0 + p.y * 5.0) * 0.06 * k;
        p.y *= 1.0 + 0.12 * sin(uTime * 11.0 + uSeed * 5.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform vec3 uInner, uOuter;
      varying vec2 vUv;
      void main() {
        float k = smoothstep(0.0, 0.75, vUv.y);
        vec3 c = mix(uInner * 2.4, uOuter * 1.8, k);
        float a = 1.0 - smoothstep(0.7, 1.0, vUv.y);
        gl_FragColor = vec4(c, a);
      }`,
  });
}

/** Soft additive glow sprite material (fireflies, wisps, lamp halos). */
export function makeHaloMaterial(color = 0xffe08a, strength = 1.5) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: col(color), uStrength: { value: strength }, uTime: U.time, uSeed: { value: Math.random() * 10 } },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        // billboard
        vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        vec2 sc = vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
        mv.xy += position.xy * sc;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform vec3 uColor;
      uniform float uStrength, uTime, uSeed;
      varying vec2 vUv;
      void main() {
        float r = length(vUv - 0.5) * 2.0;
        float a = pow(max(1.0 - r, 0.0), 2.2);
        float fl = 0.85 + 0.15 * sin(uTime * 8.0 + uSeed * 9.0);
        gl_FragColor = vec4(uColor * uStrength * fl * a, a);
      }`,
  });
}

/** Ground-hugging ring used for the aim guide and landing markers. */
export function makeAimMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uColor: col(0xffffff), uPower: { value: 0 }, uAlpha: { value: 1 } },
    vertexShader: /* glsl */`
      attribute float aIndex;
      varying vec2 vUv;
      varying float vI;
      void main() {
        vUv = uv;
        vI = aIndex;
        #ifdef USE_INSTANCING
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        #else
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        #endif
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform vec3 uColor;
      uniform float uPower, uAlpha;
      varying vec2 vUv;
      varying float vI;
      void main() {
        float r = length(vUv - 0.5) * 2.0;
        float a = 1.0 - smoothstep(0.8, 1.0, r);
        vec3 lo = vec3(0.35, 1.0, 0.45), mid = vec3(1.0, 0.9, 0.2), hi = vec3(1.0, 0.25, 0.2);
        vec3 c = mix(lo, mid, smoothstep(0.0, 0.55, uPower));
        c = mix(c, hi, smoothstep(0.55, 1.0, uPower));
        c = mix(uColor, c, step(0.001, uPower));
        float ring = smoothstep(0.55, 0.7, r);
        c = mix(c * 1.5, vec3(1.0), ring * 0.6);
        gl_FragColor = vec4(c, a * uAlpha * (1.0 - vI * 0.55));
      }`,
  });
}
