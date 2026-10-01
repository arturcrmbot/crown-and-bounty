import { Bitmap, SHADOW } from './bitmap';
import { BLUE, COLORS, CYCLING, RED, SILHOUETTE } from './palette';
import { loadMapArt } from './mapArt';
import { decodePng, type Rgba } from './png';
import { ART, artImages, unitImages } from './units';

/**
 * Battle for Wesnoth's unit art, turned into our indexed sprites. The PNGs stay as Wesnoth made
 * them (in `public/assets/wesnoth/`); here each is recoloured for its side, scaled and matched to
 * the palette, once, when first drawn.
 */

/** Blue for the player, red for the enemy, or none (beasts have no team colour anyway). */
export type Team = 'blue' | 'red' | null;

const images = new Map<string, Rgba>();
let loading: Promise<void> | null = null;
let loaded = false;

/** GitHub Pages can answer 503 for a moment after a deploy, so each image gets a few tries. */
const fetchImage = async (path: string) => {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(`${import.meta.env.BASE_URL}assets/wesnoth/units/${path}`).catch(() => null);
    if (response?.ok) return new Uint8Array(await response.arrayBuffer());
    if (attempt === 5) throw new Error(`missing unit art: ${path}`);
    await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
  }
};

/** Loads every unit image once, a few at a time, and the map's pieces. `read` fetches from the site unless a script gives its own. */
export function loadUnitArt(read: (path: string) => Promise<Uint8Array> = fetchImage): Promise<void> {
  if (loading) return loading;
  const queue = unitImages();
  const worker = async () => {
    for (let path = queue.pop(); path; path = queue.pop()) {
      try {
        images.set(path, await decodePng(await read(path)));
      } catch (error) {
        console.warn(error);
      }
    }
  };
  // In the browser, Aldmoor's painted map (#178) comes with them, so a scene is never built without it.
  const map = read === fetchImage ? loadMapArt() : Promise.resolve();
  loading = Promise.all([...Array.from({ length: 12 }, worker), map]).then(() => {
    loaded = true;
  });
  return loading;
}

/** Runs `then` once the unit art is in: at once if it is, or when it arrives. */
export function whenUnitArt(then: () => void) {
  if (loaded || !loading) then();
  else void loading.then(then);
}

const NOTHING: Rgba = { width: 1, height: 1, data: new Uint8Array(4) };

/** An image, or if it never came, its unit's standing pose, so one lost frame can't break a fight. */
export function unitImage(path: string): Rgba {
  const image = images.get(path);
  if (image) return image;
  const owner = Object.values(ART).find((art) => artImages(art).includes(path));
  return (owner && images.get(owner.stand)) ?? NOTHING;
}

/**
 * Wesnoth marks team colour with this magenta range; the first is the reference shade. From
 * `data/core/team-colors.cfg` (1.18).
 */
const MAGENTA = [
  0xf49ac1, 0x3f0016, 0x55002a, 0x690039, 0x7b0045, 0x8c0051, 0x9e005d, 0xb10069, 0xc30074, 0xd6007f, 0xec008c, 0xee3d96, 0xef5ba1, 0xf172ac, 0xf287b6, 0xf6adcd, 0xf8c1d9, 0xfad5e5,
  0xfde9f1,
];
const MAGENTA_SET = new Set(MAGENTA);

/**
 * Our sides' colours as Wesnoth colour ranges: the average shade, the highlight and the shadow. On
 * the map they run brighter, so a small figure's colours still show.
 */
const RANGES = { blue: [BLUE[3], BLUE[6], BLUE[0]], red: [RED[3], RED[6], RED[0]] } as const;
const BRIGHT_RANGES = { blue: [BLUE[5], BLUE[6], BLUE[2]], red: [RED[4], RED[6], RED[1]] } as const;

/**
 * Wesnoth's recolouring (`recolor_range` in `src/color_range.cpp`): each magenta shade goes to the
 * same brightness within the team's range, measured against the reference shade.
 */
function teamShades(team: 'blue' | 'red', bright: boolean): Map<number, [number, number, number]> {
  const [mid, max, min] = (bright ? BRIGHT_RANGES : RANGES)[team].map((i) => COLORS[i]);
  const avg = (c: number) => Math.floor((((c >> 16) & 255) + ((c >> 8) & 255) + (c & 255)) / 3);
  const reference = avg(MAGENTA[0]);
  return new Map(
    MAGENTA.map((c) => {
      const a = avg(c);
      const [k, far] = a <= reference ? [a / reference, min] : [(255 - a) / (255 - reference), max];
      return [c, [0, 1, 2].map((i) => Math.min(255, Math.floor(k * mid[i] + (1 - k) * far[i]))) as [number, number, number]];
    }),
  );
}
const SHADES = { blue: teamShades('blue', false), red: teamShades('red', false) };
const BRIGHT_SHADES = { blue: teamShades('blue', true), red: teamShades('red', true) };

/** A colour a little lighter and more vivid, as HoMM2's map creatures are: `lift` 0 leaves it be. */
function brighten(c: number, lift: number): number {
  if (!lift) return c;
  const [L, a, b] = oklab((c >> 16) & 255, (c >> 8) & 255, c & 255);
  const [r, g, bb] = fromOklab(Math.min(1, L + 0.035 * lift), a * (1 + 0.3 * lift), b * (1 + 0.3 * lift));
  return (r << 16) | (g << 8) | bb;
}

/** OKLab back to sRGB, clamped. */
function fromOklab(L: number, a: number, b: number): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const gamma = (c: number) => {
    const v = Math.min(1, Math.max(0, c));
    return Math.round((v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055) * 255);
  };
  return [gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), gamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)];
}

/** sRGB to OKLab, where nearness looks like nearness. */
export function oklab(r: number, g: number, b: number): [number, number, number] {
  const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

const LAB = COLORS.map(([r, g, b]) => oklab(r, g, b));
/**
 * What a unit may be painted in: any steady colour (not the clock's, not the fog's silhouette), but
 * not the sides' blue and red, which only team colour uses, so a side reads at a glance.
 */
const TEAM = new Set([...BLUE, ...RED]);
export const PAINT: readonly number[] = COLORS.map((_, i) => i).filter((i) => i > 0 && !CYCLING.has(i) && i !== SILHOUETTE && !TEAM.has(i));
const chosen = new Map<number, number>();

const STEADY = COLORS.map((_, i) => i).filter((i) => i > 0 && !CYCLING.has(i) && i !== SILHOUETTE);
const tints = new Map<number, number>();
/** The steady palette colour nearest to (r, g, b), the sides' own included: for flashes and fades. */
export function nearestTint(r: number, g: number, b: number): number {
  const key = (r << 16) | (g << 8) | b;
  let best = tints.get(key);
  if (best === undefined) {
    const [L, A, B] = oklab(r, g, b);
    best = STEADY.reduce((a, i) => ((LAB[i][0] - L) ** 2 + (LAB[i][1] - A) ** 2 + (LAB[i][2] - B) ** 2 < (LAB[a][0] - L) ** 2 + (LAB[a][1] - A) ** 2 + (LAB[a][2] - B) ** 2 ? i : a), STEADY[0]);
    tints.set(key, best);
  }
  return best;
}

/** The nearest palette colour to (r, g, b) among `from`, remembered by colour. */
function nearest(r: number, g: number, b: number, from: readonly number[], key: number): number {
  const known = chosen.get(key);
  if (known !== undefined) return known;
  const [L, A, B] = oklab(r, g, b);
  let best = from[0];
  let bestDistance = Infinity;
  for (const i of from) {
    const [l, a, bb] = LAB[i];
    const d = (l - L) ** 2 + (a - A) ** 2 + (bb - B) ** 2;
    if (d < bestDistance) [best, bestDistance] = [i, d];
  }
  chosen.set(key, best);
  return best;
}

/** A unit image after recolouring and scaling, before it meets the palette. */
export type UnitPixels = {
  width: number;
  height: number;
  /** Per pixel: 0 clear, 1 shadow, 2 painted, 3 team colour. */
  kinds: Uint8Array;
  /** Per pixel, 0xRRGGBB. */
  colours: Uint32Array;
};

/**
 * Wesnoth frames are opaque, clear, or its purple drop shadow at 60%. Recoloured for `team` (and
 * brightened by `lift`), then scaled by `scale`: by area when smaller, by EPX and then by area when
 * larger.
 */
export function unitPixels(path: string, team: Team, scale: number, lift = 0): UnitPixels {
  const { width: w, height: h, data } = unitImage(path);
  const kind = new Uint8Array(w * h);
  const colour = new Uint32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const a = data[i * 4 + 3];
    const c = (data[i * 4] << 16) | (data[i * 4 + 1] << 8) | data[i * 4 + 2];
    if (a === 0) continue;
    if (a < 250) {
      kind[i] = 1;
      continue;
    }
    const shade = team && MAGENTA_SET.has(c) ? (lift ? BRIGHT_SHADES : SHADES)[team].get(c)! : null;
    kind[i] = shade ? 3 : 2;
    colour[i] = shade ? (shade[0] << 16) | (shade[1] << 8) | shade[2] : brighten(c, lift);
  }
  const up = scale > 1 && Number.isInteger(scale) ? scale : scale > 1 ? 2 : 1;
  const [kinds, colours, sw, sh] = up > 1 ? enlarge(kind, colour, w, h, up) : [kind, colour, w, h];
  const k = scale / up;
  if (k === 1) return { width: sw, height: sh, kinds, colours };
  const width = Math.max(1, Math.round(sw * k));
  const height = Math.max(1, Math.round(sh * k));
  const out: UnitPixels = { width, height, kinds: new Uint8Array(width * height), colours: new Uint32Array(width * height) };
  for (let oy = 0; oy < height; oy++) {
    for (let ox = 0; ox < width; ox++) {
      // Of the source pixels under this one: how much is solid, shadow and team colour, and which
      // colour covers most. Taking that colour, not the average, keeps the painted pixels crisp.
      let [solid, shadow, tc] = [0, 0, 0];
      const seen: number[] = [];
      const weights: number[] = [];
      const [x0, x1, y0, y1] = [ox / k, (ox + 1) / k, oy / k, (oy + 1) / k];
      for (let y = Math.floor(y0); y < Math.min(sh, Math.ceil(y1)); y++) {
        const wy = Math.min(y + 1, y1) - Math.max(y, y0);
        for (let x = Math.floor(x0); x < Math.min(sw, Math.ceil(x1)); x++) {
          const weight = (Math.min(x + 1, x1) - Math.max(x, x0)) * wy;
          const i = y * sw + x;
          const what = kinds[i];
          if (what === 1) shadow += weight;
          else if (what >= 2) {
            solid += weight;
            if (what === 3) tc += weight;
            const c = colours[i];
            const at = seen.indexOf(c);
            if (at < 0) {
              seen.push(c);
              weights.push(weight);
            } else weights[at] += weight;
          }
        }
      }
      const area = (x1 - x0) * (y1 - y0);
      const o = oy * width + ox;
      if (solid >= area * 0.5) {
        out.kinds[o] = tc >= solid * 0.5 ? 3 : 2;
        out.colours[o] = seen[weights.indexOf(Math.max(...weights))];
      } else if (solid + shadow >= area * 0.5) out.kinds[o] = 1;
    }
  }
  return out;
}

/**
 * A unit image as one of our sprites: recoloured for its side, scaled, and matched to the palette
 * (team colour to its own ramp). Wesnoth's drop shadow becomes our SHADOW, which darkens whatever
 * it falls on.
 */
export function unitBitmap(path: string, team: Team, scale: number, lift = 0): Bitmap {
  const { width, height, kinds, colours } = unitPixels(path, team, scale, lift);
  const out = new Bitmap(width, height);
  const ramp = team === 'blue' ? BLUE : RED;
  const flag = team === 'blue' ? 0x1000000 : 0x2000000;
  for (let i = 0; i < width * height; i++) {
    const what = kinds[i];
    if (what === 1) out.data[i] = SHADOW;
    else if (what >= 2) {
      const c = colours[i];
      out.data[i] = nearest((c >> 16) & 255, (c >> 8) & 255, c & 255, what === 3 ? ramp : PAINT, what === 3 ? c + flag : c);
    }
  }
  return out;
}

/** EPX (Scale2x) and plain doubling beyond: sharper edges than blowing the pixels up. */
function enlarge(kind: Uint8Array, colour: Uint32Array, w: number, h: number, by: number): [Uint8Array, Uint32Array, number, number] {
  const W = w * by;
  const H = h * by;
  const kinds = new Uint8Array(W * H);
  const colours = new Uint32Array(W * H);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : y * w + x);
  // Outside the image counts as clear.
  const same = (a: number, b: number) => (a < 0 ? 0 : kind[a]) === (b < 0 ? 0 : kind[b]) && (a < 0 ? 0 : colour[a]) === (b < 0 ? 0 : colour[b]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = at(x, y);
      const [A, B, C, D] = [at(x, y - 1), at(x + 1, y), at(x - 1, y), at(x, y + 1)];
      // EPX: each quarter takes a neighbour's colour where two neighbours agree across its corner.
      const quarters = by === 2 && !same(A, D) && !same(C, B)
        ? [same(C, A) ? C : p, same(A, B) ? B : p, same(D, C) ? C : p, same(B, D) ? D : p]
        : [p, p, p, p];
      for (let j = 0; j < by; j++) {
        for (let i = 0; i < by; i++) {
          const q = by === 2 ? quarters[j * 2 + i] : p;
          const o = (y * by + j) * W + x * by + i;
          kinds[o] = q < 0 ? 0 : kind[q];
          colours[o] = q < 0 ? 0 : colour[q];
        }
      }
    }
  }
  return [kinds, colours, W, H];
}
