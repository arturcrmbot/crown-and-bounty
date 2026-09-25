import { Vector3 } from 'three';

/**
 * Hand-picked ramps, dark to light. Shadows lean blue or violet and lights lean yellow,
 * the way pixel artists hue-shift their ramps.
 */
export const PALETTE = [
  // neutrals and outlines
  '#14131f', '#2a2838', '#45445a', '#6b6a80', '#9a9ab0', '#cfd0dd', '#f4f1e8',
  // meadow
  '#1f3322', '#2f4d24', '#4a6b24', '#6e8a26', '#93a82e', '#b8c440', '#dcdc70',
  // forest
  '#173a36', '#1f5a45', '#2b7a4f', '#45a05a',
  // water and sky
  '#182850', '#1f3f7a', '#2a5fa8', '#3f86cc', '#69b1e3', '#a5dbf2',
  // earth, road and wood
  '#3b2419', '#5e3a24', '#86552f', '#ae7a45', '#cfa267', '#e8c88f',
  // reds
  '#4a1a22', '#7c2a2d', '#b33d33', '#d9643c', '#f09a5a',
  // gold
  '#a8721f', '#d9a332', '#f2d25c',
  // skin
  '#c98b6b', '#eab89a',
  // violet shadows
  '#3a2a4d', '#5c4a78',
];

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** Björn Ottosson's Oklab, from linear sRGB. */
function oklab(r: number, g: number, b: number): Vector3 {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return new Vector3(
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  );
}

export function paletteUniforms(hexes: string[] = PALETTE) {
  const srgb = hexes.map((hex) => {
    const n = parseInt(hex.slice(1), 16);
    return new Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
  });
  const lab = srgb.map((c) => oklab(toLinear(c.x), toLinear(c.y), toLinear(c.z)));
  return { srgb, lab };
}
