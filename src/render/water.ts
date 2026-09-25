import { BufferGeometry, MeshStandardMaterial, type Texture } from 'three';

/** Water faces in the KayKit atlas sample the blue swatch in column 1, row 1 of the 8x4 grid. */
function isWaterUv(u: number, v: number) {
  return u >= 0.125 && u < 0.25 && v >= 0.25 && v < 0.5;
}

/** Reorders a tile's triangles into two groups: land (material 0) and water (material 1). */
export function splitWater(source: BufferGeometry): BufferGeometry | null {
  const index = source.getIndex();
  const uv = source.getAttribute('uv');
  if (!index || !uv) return null;
  const land: number[] = [];
  const water: number[] = [];
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);
    const u = (uv.getX(a) + uv.getX(b) + uv.getX(c)) / 3;
    const v = (uv.getY(a) + uv.getY(b) + uv.getY(c)) / 3;
    (isWaterUv(u, v) ? water : land).push(a, b, c);
  }
  if (water.length === 0) return null;
  const geometry = source.clone();
  geometry.setIndex([...land, ...water]);
  geometry.clearGroups();
  geometry.addGroup(0, land.length, 0);
  geometry.addGroup(land.length, water.length, 1);
  return geometry;
}

const WATER_GLSL = /* glsl */ `
uniform float uTime;
varying vec3 vWaterPos;

float kcHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float kcNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(kcHash(i), kcHash(i + vec2(1.0, 0.0)), u.x),
             mix(kcHash(i + vec2(0.0, 1.0)), kcHash(i + vec2(1.0, 1.0)), u.x), u.y);
}

// Moving streaks of light on the surface; the river flows roughly north to south (+z).
float kcWaterCrest(vec2 p, float t) {
  vec2 flow = vec2(0.05, 0.45) * t;
  float n = kcNoise(p * vec2(2.6, 1.3) - flow) * 0.6 + kcNoise(p * vec2(5.3, 2.4) - flow * 1.6 + 7.1) * 0.4;
  return smoothstep(0.64, 0.8, n);
}

// Slope of a few travelling sine waves, used to tilt the surface normal.
vec2 kcWaterSlope(vec2 p, float t) {
  vec2 g = vec2(0.0);
  vec2 d1 = vec2(0.28, 0.96);
  vec2 d2 = vec2(-0.7, 0.71);
  vec2 d3 = vec2(0.9, 0.44);
  g += 0.10 * d1 * cos(dot(p, d1) * 3.3 - t * 2.1);
  g += 0.07 * d2 * cos(dot(p, d2) * 5.1 - t * 2.9);
  g += 0.05 * d3 * cos(dot(p, d3) * 8.3 - t * 3.7);
  return g;
}
`;

/** KayKit's water colour from the atlas, with animated ripples, glints and drifting highlights. */
export function createWaterMaterial(map: Texture, time: { value: number }): MeshStandardMaterial {
  const material = new MeshStandardMaterial({ map, roughness: 0.22, metalness: 0 });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWaterPos;')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvWaterPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${WATER_GLSL}`)
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float crest = kcWaterCrest(vWaterPos.xz, uTime);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.86, 1.0), crest * 0.7);`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        vec2 slope = kcWaterSlope(vWaterPos.xz, uTime);
        normal = normalize((viewMatrix * vec4(normalize(vec3(-slope.x, 1.0, -slope.y)), 0.0)).xyz);`,
      );
  };
  material.customProgramCacheKey = () => 'kc-water';
  return material;
}
