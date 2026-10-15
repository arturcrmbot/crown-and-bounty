import { Bitmap, SHADOW } from './bitmap';
import { COLORS, CYCLING, GRAIN_LUT, PLUM, SILHOUETTE } from './palette';
import { decodePng, type Rgba } from './png';
import { FEAST_PIECES, FIGURE_ANIMATIONS, FIGURES, GROUNDS, PAINTED_PORTRAITS, PIECE_FEET, type FeastPieceName, type FigureAnimation, type GroundName, type PieceName } from './mapPieces';
import type { AnimName } from './battleSprites';
import type { Size } from './scale';

/**
 * Aldmoor's painted map (#178): its places, trees, crags and ground, drawn in the spirit of HoMM2's
 * adventure map. The PNGs are in public/assets/map/, cut from the sheets by `npm run mapart`, and
 * already in the game's palette. They load with the units' art; until they have (or if one never
 * comes), the map is drawn as it was, in code.
 */

const pieces = new Map<string, Bitmap>();
const subdued = new Map<PieceName, Bitmap>();
const grounds = new Map<GroundName, Bitmap>();
const figures = new Map<string, Bitmap>();
const feast = new Map<FeastPieceName, Bitmap>();
const portraits = new Map<string, Bitmap>();
export type PaintedAnimation = Omit<FigureAnimation, 'frames' | 'feet'> & {
  frames: readonly { name: string; ms: number; sprite: Bitmap }[];
  foot: readonly [number, number];
};
const animations = new Map<string, PaintedAnimation>();
let loading: Promise<void> | null = null;

const fetchPiece = async (file: string) => {
  const response = await fetch(`${import.meta.env.BASE_URL}assets/${file.includes('/') ? file : `map/${file}`}`);
  if (!response.ok) throw new Error(`missing map art: ${file}`);
  return new Uint8Array(await response.arrayBuffer());
};

/** The palette index of each exact colour the pieces use. */
let lookup: Map<number, number> | null = null;
function indexOf(r: number, g: number, b: number): number {
  if (!lookup) {
    lookup = new Map();
    COLORS.forEach(([cr, cg, cb], i) => {
      const key = (cr << 16) | (cg << 8) | cb;
      if (i > 0 && !CYCLING.has(i) && i !== SILHOUETTE && !lookup!.has(key)) lookup!.set(key, i);
    });
  }
  const exact = lookup.get((r << 16) | (g << 8) | b);
  if (exact !== undefined) return exact;
  // Not one of ours (the palette has moved since `npm run mapart`): the nearest will do.
  let best = 1;
  let bestD = Infinity;
  for (const [key, i] of lookup) {
    const d = ((key >> 16) - r) ** 2 + (((key >> 8) & 255) - g) ** 2 + ((key & 255) - b) ** 2;
    if (d < bestD) [best, bestD] = [i, d];
  }
  lookup.set((r << 16) | (g << 8) | b, best);
  return best;
}

/** An RGBA picture as a palette bitmap: opaque pixels painted, half-clear ones shadow, the rest clear. */
export function toBitmap(image: Rgba): Bitmap {
  const out = new Bitmap(image.width, image.height);
  for (let i = 0; i < out.data.length; i++) {
    const a = image.data[i * 4 + 3];
    if (a >= 200) out.data[i] = indexOf(image.data[i * 4], image.data[i * 4 + 1], image.data[i * 4 + 2]);
    else if (a >= 64) out.data[i] = SHADOW;
  }
  return out;
}

/** Loads the map's pieces once. `read` fetches from the site unless a script or a test gives its own. */
export function loadMapArt(read: (file: string) => Promise<Uint8Array> = fetchPiece): Promise<void> {
  if (loading) return loading;
  const names = Object.keys(PIECE_FEET) as PieceName[];
  loading = Promise.all([
    ...names.map(async (name) => {
      try {
        pieces.set(name, toBitmap(await decodePng(await read(`${name}.png`))));
      } catch (error) {
        console.warn(error);
      }
    }),
    ...GROUNDS.map(async (name) => {
      try {
        grounds.set(name, toBitmap(await decodePng(await read(`ground-${name}.png`))));
      } catch (error) {
        console.warn(error);
      }
    }),
    ...FIGURES.flatMap((id) =>
      (['battle', 'map'] as const).map(async (size) => {
        try {
          figures.set(`${id}-${size}`, toBitmap(await decodePng(await read(`troops/${id}-${size}.png`))));
        } catch (error) {
          console.warn(error);
        }
      }),
    ),
    ...Object.values(FIGURE_ANIMATIONS).flatMap((poses) =>
      Object.values(poses).flatMap((animation) =>
        animation ? (['battle', 'map'] as const).flatMap((size) =>
          animation.feet[size] ? animation.frames.map(async (frame) => {
            const name = `${frame.name}-${size}`;
            try {
              figures.set(name, toBitmap(await decodePng(await read(`troops/${name}.png`))));
            } catch (error) {
              console.warn(error);
            }
          }) : [],
        ) : [],
      ),
    ),
    // The painted faces for the cards (#311).
    ...PAINTED_PORTRAITS.map(async (name) => {
      try {
        portraits.set(name, toBitmap(await decodePng(await read(`portraits/${name}.png`))));
      } catch (error) {
        console.warn(error);
      }
    }),
    // The payday feast's pieces (#191), small enough to come with the rest.
    ...FEAST_PIECES.map(async (name) => {
      try {
        feast.set(name, toBitmap(await decodePng(await read(`feast/${name}.png`))));
      } catch (error) {
        console.warn(error);
      }
    }),
  ]).then(() => undefined);
  return loading;
}

/** A piece and how far below its top it stands, if it's loaded. */
export function piece(name: PieceName): { sprite: Bitmap; foot: number } | null {
  const sprite = pieces.get(name);
  return sprite ? { sprite, foot: PIECE_FEET[name] } : null;
}

/** Small background decoration, a shade quieter; places and the original paintings stay unchanged. */
export function subduedPiece(name: PieceName): { sprite: Bitmap; foot: number } | null {
  const original = piece(name);
  if (!original) return null;
  let sprite = subdued.get(name);
  if (!sprite) {
    sprite = new Bitmap(original.sprite.width, original.sprite.height);
    // Purple flowers keep their purple a shade darker: the grain has no purples and turned them to grey rubble (#311).
    sprite.data.set(original.sprite.data.map((c) => (c === 0 || c === SHADOW ? c : PLUM.includes(c) ? PLUM[Math.max(0, PLUM.indexOf(c) - 1)] : GRAIN_LUT[c])));
    subdued.set(name, sprite);
  }
  return { sprite, foot: original.foot };
}

/** A ground's seamless square, if it's loaded. */
export const ground = (name: GroundName): Bitmap | null => grounds.get(name) ?? null;

/** Whether the whole painted map is in: every piece and every ground. */
export const mapArtReady = () => pieces.size === Object.keys(PIECE_FEET).length && grounds.size === GROUNDS.length;

/** A face for the cards, painted (#311), if it's one of those painted and it's loaded. */
export const paintedPortrait = (id: string): Bitmap | null => portraits.get(id) ?? null;

/** A troop's (or Aldric's) painted figure (#178), facing right, at battle or map size, if it's loaded. */
export const paintedFigure = (id: string, size: 'battle' | 'map'): Bitmap | null => figures.get(`${id}-${size}`) ?? null;

/** A pose sequence only when every frame has loaded; otherwise the existing figure still stands in. */
export function paintedAnimation(id: string, size: Size, anim: AnimName): PaintedAnimation | null {
  const key = `${id}-${size}-${anim}`;
  const cached = animations.get(key);
  if (cached) return cached;
  const animation = FIGURE_ANIMATIONS[id]?.[anim];
  const foot = animation?.feet[size];
  if (!animation || !foot) return anim === 'idle' ? paintedAnimation(id, size, 'stand') : null;
  const frames: PaintedAnimation['frames'][number][] = [];
  for (const frame of animation.frames) {
    const sprite = figures.get(`${frame.name}-${size}`);
    if (!sprite) return null;
    frames.push({ ...frame, sprite });
  }
  const ready = { ...animation, frames, foot };
  animations.set(key, ready);
  return ready;
}

/** A piece of the payday feast (#191), facing right as it was drawn, if it's loaded. */
export const feastPiece = (name: FeastPieceName): Bitmap | null => feast.get(name) ?? null;

/** Whether every piece of the feast is in: until then, payday's card opens over the map as it always did. */
export const feastArtReady = () => feast.size === FEAST_PIECES.length;
