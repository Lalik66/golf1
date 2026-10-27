// Post-processing: depth/normal pre-pass -> ink outlines -> bloom -> tone map -> FXAA
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';
import { U, makeNormalMaterial, LAYER_FX } from './materials.js';

const OutlineShader = {
  name: 'InkOutline',
  uniforms: {
    tDiffuse: { value: null },
    tNormal: { value: null },
    tDepth: { value: null },
    uTexel: { value: new THREE.Vector2(1, 1) },
    uNear: { value: 0.1 },
    uFar: { value: 600 },
    uColor: { value: new THREE.Color(0x1a1430) },
    uThickness: { value: 1 },
    uStrength: { value: 0.85 },
    uVignette: { value: 0.22 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    precision highp float;
    uniform sampler2D tDiffuse, tNormal, tDepth;
    uniform vec2 uTexel;
    uniform float uNear, uFar, uThickness, uStrength, uVignette;
    uniform vec3 uColor;
    varying vec2 vUv;
    float vz(vec2 uv) {
      float d = texture2D(tDepth, uv).x;
      return -(uNear * uFar) / ((uFar - uNear) * d - uFar);
    }
    void main() {
      vec4 col = texture2D(tDiffuse, vUv);
      vec2 o = uTexel * uThickness;
      float zc = vz(vUv);
      float z1 = vz(vUv + vec2(o.x, 0.0));
      float z2 = vz(vUv - vec2(o.x, 0.0));
      float z3 = vz(vUv + vec2(0.0, o.y));
      float z4 = vz(vUv - vec2(0.0, o.y));
      // Laplacian of 1/z is zero on any plane, whatever the viewing angle
      float lap = abs(zc / z1 + zc / z2 + zc / z3 + zc / z4 - 4.0);
      float dEdge = smoothstep(0.012, 0.03, lap);
      vec3 nc = texture2D(tNormal, vUv).xyz;
      vec3 n1 = texture2D(tNormal, vUv + vec2(o.x, 0.0)).xyz;
      vec3 n2 = texture2D(tNormal, vUv - vec2(o.x, 0.0)).xyz;
      vec3 n3 = texture2D(tNormal, vUv + vec2(0.0, o.y)).xyz;
      vec3 n4 = texture2D(tNormal, vUv - vec2(0.0, o.y)).xyz;
      float nd = length(nc - n1) + length(nc - n2) + length(nc - n3) + length(nc - n4);
      float nEdge = smoothstep(0.45, 0.8, nd);
      float zmin = min(zc, min(min(z1, z2), min(z3, z4)));
      float fade = 1.0 - smoothstep(45.0, 120.0, zmin);
      float edge = max(dEdge, nEdge * 0.85) * fade * uStrength;
      col.rgb = mix(col.rgb, uColor, edge);
      // gentle vignette
      vec2 q = vUv - 0.5;
      col.rgb *= 1.0 - uVignette * smoothstep(0.35, 0.95, dot(q, q) * 2.0);
      gl_FragColor = col;
    }`,
};

export class PostFX {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.enabledBloom = true;
    this.enabledOutline = true;

    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.normalTarget = new THREE.WebGLRenderTarget(size.x, size.y, {
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
    });
    this.normalTarget.depthTexture = new THREE.DepthTexture(size.x, size.y);
    this.normalTarget.depthTexture.type = THREE.UnsignedIntType;
    U.tDepth.value = this.normalTarget.depthTexture;
    U.resolution.value.set(size.x, size.y);
    this.normalMat = makeNormalMaterial();

    this.composer = new EffectComposer(renderer);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    this.outline = new ShaderPass(OutlineShader);
    this.outline.uniforms.tNormal.value = this.normalTarget.texture;
    this.outline.uniforms.tDepth.value = this.normalTarget.depthTexture;
    this.composer.addPass(this.outline);

    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.42, 0.55, 0.92);
    this.composer.addPass(this.bloom);

    this.output = new OutputPass();
    this.composer.addPass(this.output);

    this.fxaa = new FXAAPass();
    this.composer.addPass(this.fxaa);

    this._clear = new THREE.Color();
  }

  setOutlineColor(c) { this.outline.uniforms.uColor.value.set(c); }

  setBloom(strength, threshold = 0.92, radius = 0.55) {
    this.bloom.strength = strength;
    this.bloom.threshold = threshold;
    this.bloom.radius = radius;
  }

  setQuality({ bloom, outline }) {
    this.enabledBloom = bloom;
    this.enabledOutline = outline;
    this.bloom.enabled = bloom;
    this.outline.enabled = outline;
  }

  setSize(w, h, pr) {
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    const bw = Math.max(2, Math.floor(w * pr)), bh = Math.max(2, Math.floor(h * pr));
    this.normalTarget.setSize(bw, bh);
    U.resolution.value.set(bw, bh);
    this.outline.uniforms.uTexel.value.set(1 / bw, 1 / bh);
    this.outline.uniforms.uThickness.value = Math.min(2.2, Math.max(1, bh / 820));
  }

  render(dt) {
    const r = this.renderer, scene = this.scene, cam = this.camera;
    U.camNear.value = cam.near;
    U.camFar.value = cam.far;
    this.outline.uniforms.uNear.value = cam.near;
    this.outline.uniforms.uFar.value = cam.far;

    // depth + normal pre-pass (also refreshes the shadow map once per frame)
    r.shadowMap.needsUpdate = true;
    r.getClearColor(this._clear);
    const alpha = r.getClearAlpha();
    const bg = scene.background;
    scene.background = null;
    scene.overrideMaterial = this.normalMat;
    cam.layers.set(0);
    r.setRenderTarget(this.normalTarget);
    r.setClearColor(0x8080ff, 1);
    r.clear();
    r.render(scene, cam);
    scene.overrideMaterial = null;
    scene.background = bg;
    cam.layers.enable(LAYER_FX);
    r.setClearColor(this._clear, alpha);
    r.setRenderTarget(null);

    this.composer.render(dt);
  }
}
