import { Bitmap, SHADOW } from './bitmap';
import { COLORS, CYCLING, SILHOUETTE } from './palette';
import { decodePng, type Rgba } from './png';
import { FIGURES, GROUNDS, PIECE_FEET, TREES, type GroundName, type PieceName } from './mapPieces';

/**
 * Aldmoor's painted map (#178): its places, trees, crags and ground, drawn in the spirit of HoMM2's
 * adventure map. The PNGs are in public/assets/map/, cut from the sheets by `npm run mapart`, and
 * already in the game's palette. They load with the units' art; until they have (or if one never
 * comes), the map is drawn as it was, in code.
 */

const pieces = new Map<string, Bitmap>();
const grounds = new Map<GroundName, Bitmap>();
const figures = new Map<string, Bitmap>();
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
  ]).then(() => undefined);
  return loading;
}

/** A piece and how far below its top it stands, if it's loaded. */
export function piece(name: PieceName): { sprite: Bitmap; foot: number } | null {
  const sprite = pieces.get(name);
  return sprite ? { sprite, foot: PIECE_FEET[name] } : null;
}

/** A ground's seamless square, if it's loaded. */
export const ground = (name: GroundName): Bitmap | null => grounds.get(name) ?? null;

/** Whether the whole painted map is in: every piece and every ground. */
export const mapArtReady = () => pieces.size === Object.keys(PIECE_FEET).length && grounds.size === GROUNDS.length;

const [darkPines, firs, greens, autumn] = [[0, 2, 5, 6, 8, 10], [1, 3, 4, 7, 9, 11], [12, 13, 14, 15, 16, 17, 18, 24], [19, 20, 21, 22, 23]].map((l) => l.map((i) => TREES[i]));
/**
 * The trees, by kind, as often as each should come up: pinewoods are dark pines with a blue fir here
 * and there; broadleaf woods are green, with a tree turning gold or red now and then.
 */
export const TREE_KINDS = {
  pine: [...Array(14).fill(darkPines).flat(), ...firs],
  oak: [...greens, ...greens, ...greens, ...autumn],
} as const;

/** A troop's (or Aldric's) painted figure (#178), facing right, at battle or map size, if it's loaded. */
export const paintedFigure = (id: string, size: 'battle' | 'map'): Bitmap | null => figures.get(`${id}-${size}`) ?? null;
