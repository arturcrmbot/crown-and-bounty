import {
  DepthTexture,
  HalfFloatType,
  MeshNormalMaterial,
  NearestFilter,
  PCFShadowMap,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
  type DirectionalLight,
  type PerspectiveCamera,
  type Scene,
  type WebGLRenderer,
} from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import type { Look } from './look';
import { PALETTE, paletteUniforms } from './palette';

/** Art pixels from the top to the bottom of the screen, close to HoMM2's 480-line density on a map view. */
const TARGET_ROWS = 270;

const FULLSCREEN_VERTEX = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

/**
 * Runs at the low resolution. Outlines follow t3ssel8r's approach: pixels in front of a depth
 * step get darkened, and the near side of a convex crease in the normals gets a highlight.
 * The result is snapped to the nearest palette colour in Oklab, with light ordered dithering.
 */
const POST_FRAGMENT = /* glsl */ `
#include <packing>
#include <tonemapping_pars_fragment>

uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform sampler2D tNormal;
uniform vec2 resolution;
uniform float cameraNear;
uniform float cameraFar;
uniform float depthThreshold;
uniform float depthEdgeStrength;
uniform float normalEdgeStrength;
uniform float ditherStrength;
uniform float chromaWeight;
uniform vec3 paletteLab[PALETTE_SIZE];
uniform vec3 paletteSrgb[PALETTE_SIZE];

ivec2 clampPx(ivec2 p) {
  return clamp(p, ivec2(0), ivec2(resolution) - 1);
}

float linearDepth(ivec2 p) {
  return -perspectiveDepthToViewZ(texelFetch(tDepth, clampPx(p), 0).x, cameraNear, cameraFar);
}

vec3 viewNormal(ivec2 p) {
  return texelFetch(tNormal, clampPx(p), 0).xyz * 2.0 - 1.0;
}

vec3 toOklab(vec3 c) {
  c = max(c, vec3(0.0));
  float l = pow(0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b, 1.0 / 3.0);
  float m = pow(0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b, 1.0 / 3.0);
  float s = pow(0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b, 1.0 / 3.0);
  return vec3(
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s);
}

float bayer4(ivec2 p) {
  const float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return m[(p.x & 3) + ((p.y & 3) << 2)] / 16.0 - 0.46875;
}

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  float depth = linearDepth(p);
  vec3 normal = viewNormal(p);

  const ivec2 offsets[4] = ivec2[4](ivec2(0, 1), ivec2(0, -1), ivec2(1, 0), ivec2(-1, 0));
  float depthDiff = 0.0;
  float crease = 0.0;
  for (int i = 0; i < 4; i++) {
    ivec2 q = p + offsets[i];
    float d = linearDepth(q);
    depthDiff += max(d - depth, 0.0);
    vec3 n = viewNormal(q);
    float towardsBias = smoothstep(-0.01, 0.01, dot(normal - n, vec3(1.0)));
    float nearerSide = step(0.0, (d - depth) * 0.25 + 0.0025);
    crease += (1.0 - dot(normal, n)) * towardsBias * nearerSide;
  }
  float depthEdge = step(depth * depthThreshold, depthDiff);
  float normalEdge = smoothstep(0.12, 0.3, crease) * (1.0 - depthEdge);

  vec3 color = NeutralToneMapping(texelFetch(tColor, p, 0).rgb);
  color *= (1.0 - depthEdge * depthEdgeStrength) * (1.0 + normalEdge * normalEdgeStrength);

  vec3 lab = toOklab(color);
  lab.x += bayer4(p) * ditherStrength;
  float best = 1e9;
  vec3 result = vec3(0.0);
  for (int i = 0; i < PALETTE_SIZE; i++) {
    vec3 delta = lab - paletteLab[i];
    float dist = delta.x * delta.x + chromaWeight * dot(delta.yz, delta.yz);
    if (dist < best) {
      best = dist;
      result = paletteSrgb[i];
    }
  }
  gl_FragColor = vec4(result, 1.0);
}`;

/** Nearest-neighbour upscale with whole-pixel blocks, centred on the canvas. */
const UPSCALE_FRAGMENT = /* glsl */ `
uniform sampler2D tPost;
uniform vec2 resolution;
uniform vec2 offset;
uniform float pixelSize;

void main() {
  ivec2 p = ivec2(floor((gl_FragCoord.xy + offset) / pixelSize));
  gl_FragColor = texelFetch(tPost, clamp(p, ivec2(0), ivec2(resolution) - 1), 0);
}`;

export class PixelArtLook implements Look {
  readonly id = 'a';
  readonly label = 'A · Pixel art';
  /** Screen pixels per art pixel. 0 picks one from the canvas height. */
  pixelSize = 0;

  private readonly renderer: WebGLRenderer;
  private readonly scene: Scene;
  private readonly camera: PerspectiveCamera;
  private readonly sun: DirectionalLight;
  private readonly color: WebGLRenderTarget;
  private readonly normals: WebGLRenderTarget;
  private readonly post: WebGLRenderTarget;
  private readonly normalMaterial = new MeshNormalMaterial();
  private readonly postMaterial: ShaderMaterial;
  private readonly upscaleMaterial: ShaderMaterial;
  private readonly quad = new FullScreenQuad();
  private activePixelSize = 4;
  private canvasWidth = 1;
  private canvasHeight = 1;

  constructor(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera, sun: DirectionalLight) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.sun = sun;
    const nearest = { minFilter: NearestFilter, magFilter: NearestFilter, generateMipmaps: false };
    this.color = new WebGLRenderTarget(1, 1, { ...nearest, type: HalfFloatType, depthTexture: new DepthTexture(1, 1) });
    this.normals = new WebGLRenderTarget(1, 1, nearest);
    this.post = new WebGLRenderTarget(1, 1, nearest);

    const palette = paletteUniforms();
    this.postMaterial = new ShaderMaterial({
      defines: { PALETTE_SIZE: PALETTE.length },
      uniforms: {
        tColor: { value: this.color.texture },
        tDepth: { value: this.color.depthTexture },
        tNormal: { value: this.normals.texture },
        resolution: { value: new Vector2(1, 1) },
        cameraNear: { value: camera.near },
        cameraFar: { value: camera.far },
        depthThreshold: { value: 0.012 },
        depthEdgeStrength: { value: 0.5 },
        normalEdgeStrength: { value: 0.45 },
        ditherStrength: { value: 0.035 },
        chromaWeight: { value: 1.6 },
        toneMappingExposure: { value: 1 },
        paletteLab: { value: palette.lab },
        paletteSrgb: { value: palette.srgb },
      },
      vertexShader: FULLSCREEN_VERTEX,
      fragmentShader: POST_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });
    this.upscaleMaterial = new ShaderMaterial({
      uniforms: {
        tPost: { value: this.post.texture },
        resolution: { value: new Vector2(1, 1) },
        offset: { value: new Vector2() },
        pixelSize: { value: 4 },
      },
      vertexShader: FULLSCREEN_VERTEX,
      fragmentShader: UPSCALE_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });
  }

  activate() {
    this.renderer.shadowMap.type = PCFShadowMap;
    this.sun.shadow.radius = 1;
  }

  setSize(width: number, height: number) {
    this.canvasWidth = width;
    this.canvasHeight = height;
    const size = this.pixelSize || Math.max(2, Math.round(height / TARGET_ROWS));
    this.activePixelSize = size;
    const lowWidth = Math.ceil(width / size);
    const lowHeight = Math.ceil(height / size);
    for (const target of [this.color, this.normals, this.post]) target.setSize(lowWidth, lowHeight);
    this.camera.aspect = lowWidth / lowHeight;
    this.camera.updateProjectionMatrix();
    this.postMaterial.uniforms.resolution.value.set(lowWidth, lowHeight);
    this.postMaterial.uniforms.cameraNear.value = this.camera.near;
    this.postMaterial.uniforms.cameraFar.value = this.camera.far;
    const upscale = this.upscaleMaterial.uniforms;
    upscale.resolution.value.set(lowWidth, lowHeight);
    upscale.pixelSize.value = size;
    upscale.offset.value.set((lowWidth * size - width) / 2, (lowHeight * size - height) / 2);
  }

  /** Changes the art pixel size by a step, starting from the automatic size. */
  nudgePixelSize(step: number) {
    this.pixelSize = Math.min(12, Math.max(2, this.activePixelSize + step));
    this.setSize(this.canvasWidth, this.canvasHeight);
  }

  render() {
    const { renderer, scene, camera } = this;
    renderer.shadowMap.needsUpdate = true;
    renderer.setRenderTarget(this.color);
    renderer.render(scene, camera);

    scene.overrideMaterial = this.normalMaterial;
    renderer.setRenderTarget(this.normals);
    renderer.render(scene, camera);
    scene.overrideMaterial = null;

    this.quad.material = this.postMaterial;
    renderer.setRenderTarget(this.post);
    this.quad.render(renderer);

    this.quad.material = this.upscaleMaterial;
    renderer.setRenderTarget(null);
    this.quad.render(renderer);
  }

  hint() {
    const rows = Math.ceil(this.canvasHeight / this.activePixelSize);
    return `[ ] pixel size: ${this.activePixelSize} (${rows} rows)`;
  }
}
