import {
  HalfFloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  ShaderMaterial,
  Vector2,
  VSMShadowMap,
  WebGLRenderTarget,
  type DirectionalLight,
  type PerspectiveCamera,
  type Scene,
  type WebGLRenderer,
} from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import type { Look } from './look';

const UV_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

/** Separable 9-tap Gaussian done with 5 bilinear fetches. `direction` is one step in UVs. */
const BLUR_FRAGMENT = /* glsl */ `
uniform sampler2D tSource;
uniform vec2 direction;
varying vec2 vUv;

void main() {
  vec3 sum = texture2D(tSource, vUv).rgb * 0.2270270270;
  sum += texture2D(tSource, vUv + direction * 1.3846153846).rgb * 0.3162162162;
  sum += texture2D(tSource, vUv - direction * 1.3846153846).rgb * 0.3162162162;
  sum += texture2D(tSource, vUv + direction * 3.2307692308).rgb * 0.0702702703;
  sum += texture2D(tSource, vUv - direction * 3.2307692308).rgb * 0.0702702703;
  gl_FragColor = vec4(sum, 1.0);
}`;

/** Tilt-shift: a sharp band across the middle that melts into two blur levels, then a toy-camera grade. */
const COMPOSITE_FRAGMENT = /* glsl */ `
#include <tonemapping_pars_fragment>

uniform sampler2D tSharp;
uniform sampler2D tBlurNear;
uniform sampler2D tBlurFar;
uniform float focusY;
uniform float focusHalfWidth;
uniform float falloff;
uniform float saturation;
uniform float contrast;
uniform float vignette;
varying vec2 vUv;

void main() {
  float blur = smoothstep(focusHalfWidth, focusHalfWidth + falloff, abs(vUv.y - focusY));
  vec3 color = texture2D(tSharp, vUv).rgb;
  color = mix(color, texture2D(tBlurNear, vUv).rgb, smoothstep(0.0, 0.45, blur));
  color = mix(color, texture2D(tBlurFar, vUv).rgb, smoothstep(0.4, 1.0, blur));

  color = NeutralToneMapping(color);
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = max(mix(vec3(luma), color, saturation), vec3(0.0));
  color = sRGBTransferOETF(vec4(color, 1.0)).rgb;
  color = (color - 0.5) * contrast + 0.5;
  float edge = smoothstep(0.45, 0.95, length((vUv - 0.5) * vec2(1.1, 1.0)));
  color *= 1.0 - edge * vignette;
  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}`;

export class DioramaLook implements Look {
  readonly id = 'b';
  readonly label = 'B · Toy diorama';

  private readonly renderer: WebGLRenderer;
  private readonly scene: Scene;
  private readonly camera: PerspectiveCamera;
  private readonly sun: DirectionalLight;
  private readonly sharp: WebGLRenderTarget;
  private readonly half: [WebGLRenderTarget, WebGLRenderTarget];
  private readonly quarter: [WebGLRenderTarget, WebGLRenderTarget];
  private readonly blurMaterial: ShaderMaterial;
  private readonly compositeMaterial: ShaderMaterial;
  private readonly quad = new FullScreenQuad();

  constructor(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera, sun: DirectionalLight) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.sun = sun;
    const hdr = { type: HalfFloatType, minFilter: LinearFilter, magFilter: LinearFilter, generateMipmaps: false };
    // Mipmaps let the first blur pass prefilter however far it downsamples.
    this.sharp = new WebGLRenderTarget(1, 1, {
      ...hdr,
      samples: 4,
      minFilter: LinearMipmapLinearFilter,
      generateMipmaps: true,
    });
    const blurTarget = () => new WebGLRenderTarget(1, 1, { ...hdr, depthBuffer: false });
    this.half = [blurTarget(), blurTarget()];
    this.quarter = [blurTarget(), blurTarget()];

    this.blurMaterial = new ShaderMaterial({
      uniforms: { tSource: { value: null }, direction: { value: new Vector2() } },
      vertexShader: UV_VERTEX,
      fragmentShader: BLUR_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });
    this.compositeMaterial = new ShaderMaterial({
      uniforms: {
        tSharp: { value: this.sharp.texture },
        tBlurNear: { value: this.half[1].texture },
        tBlurFar: { value: this.quarter[1].texture },
        focusY: { value: 0.47 },
        focusHalfWidth: { value: 0.07 },
        falloff: { value: 0.3 },
        saturation: { value: 1.05 },
        contrast: { value: 1.06 },
        vignette: { value: 0.28 },
        toneMappingExposure: { value: 1 },
      },
      vertexShader: UV_VERTEX,
      fragmentShader: COMPOSITE_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });
  }

  activate() {
    this.renderer.shadowMap.type = VSMShadowMap;
    this.sun.shadow.radius = 18;
    this.sun.shadow.blurSamples = 16;
  }

  setSize(width: number, height: number) {
    this.sharp.setSize(width, height);
    // Blur levels have a fixed row count, so the blur looks the same on any screen and pixel ratio.
    const near = Math.min(0.5, 480 / height);
    const far = Math.min(0.25, 240 / height);
    for (const target of this.half) target.setSize(Math.ceil(width * near), Math.ceil(height * near));
    for (const target of this.quarter) target.setSize(Math.ceil(width * far), Math.ceil(height * far));
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /** `dx` and `dy` are the tap step in target pixels. */
  private blurPass(source: WebGLRenderTarget, target: WebGLRenderTarget, dx: number, dy: number) {
    this.blurMaterial.uniforms.tSource.value = source.texture;
    this.blurMaterial.uniforms.direction.value.set(dx / target.width, dy / target.height);
    this.renderer.setRenderTarget(target);
    this.quad.render(this.renderer);
  }

  render() {
    const { renderer } = this;
    renderer.shadowMap.needsUpdate = true;
    renderer.setRenderTarget(this.sharp);
    renderer.render(this.scene, this.camera);

    this.quad.material = this.blurMaterial;
    this.blurPass(this.sharp, this.half[0], 1, 0);
    this.blurPass(this.half[0], this.half[1], 0, 1);
    this.blurPass(this.half[1], this.quarter[0], 1.5, 0);
    this.blurPass(this.quarter[0], this.quarter[1], 0, 1.5);

    this.quad.material = this.compositeMaterial;
    renderer.setRenderTarget(null);
    this.quad.render(renderer);
  }

  hint() {
    return 'tilt-shift and soft shadows';
  }
}
