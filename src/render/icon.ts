/**
 * The game's icon (#148): a gold crown on royal blue, drawn like the artifacts' pictures, in the palette's
 * letters and inked round. It is the browser tab's icon and a phone's home-screen icon: `npm run icons`
 * saves each size as the PNG in `public/` that `index.html` and `manifest.webmanifest` name.
 */
import { Bitmap, outline } from './bitmap';
import { BLUE, GOLD, INK, NEUTRAL, RED } from './palette';

/** The letters the crown is drawn in: gold, a ruby, sapphires and pearls, lit from the top left. */
const KEY: Record<string, number> = {
  F: GOLD[6], G: GOLD[5], g: GOLD[4], H: GOLD[3], h: GOLD[2], j: GOLD[1],
  R: RED[5], r: RED[3], q: RED[1],
  B: BLUE[6], b: BLUE[4], n: BLUE[2],
  N: NEUTRAL[7], m: NEUTRAL[6], M: NEUTRAL[5],
};

/** The crown for a tab's 16 pixels. */
const SMALL = [
  '................',
  '................',
  '.......Nm.......',
  '..Nm...mM...Nm..',
  '..mM...Fg...mM..',
  '..F...FRrH...h..',
  '..FH..FrqH..Fh..',
  '..FgH.FGgH.Fgh..',
  '..FggHFGgHFggh..',
  '..FgggGGgggggh..',
  '..HHHHHHHHHHHh..',
  '..FFFFFFFFFFGh..',
  '..GgBggRrggBHh..',
  '..GgnggrqggnHh..',
  '..HHHHHHhhhhhj..',
  '................',
];

/** The crown for everything bigger, drawn at 32 pixels and grown in whole pixels. */
const LARGE = [
  '................................',
  '................................',
  '................................',
  '................................',
  '...............NN...............',
  '..............NNmm..............',
  '..............NmmM..............',
  '..............mmMM..............',
  '....NNm..................NNm....',
  '....Nmm........FH........Nmm....',
  '....mmM........FH........mmM....',
  '.....F........FGgH........h.....',
  '.....FH.......FGgH.......Fh.....',
  '.....FH......FGRrgH......Fh.....',
  '.....FgH.....FGRrgH.....FGh.....',
  '.....FggH...FGGrqggH...FGGh.....',
  '.....FggH...FGGGgggH...FGGh.....',
  '.....FgggH.FGGGGggggH.FGGGh.....',
  '.....FgggggGGGGGgggggGGGGGh.....',
  '.....FHHHHHHHHHHHHHHHHHHHHh.....',
  '.....Ghhhhhhhhhhhhhhhhhhhhh.....',
  '.....FFFFFFFFFFFFFFFFGGGGGh.....',
  '.....GGGGBgggggRRgggggBHHHh.....',
  '.....GGGBBbgggRRrrgggBBbHHh.....',
  '.....GGGBbngggRrrqgggBbnHHh.....',
  '.....GGGGngggggrqgggggnHHHh.....',
  '.....GGGGGggggggggggggHHHHh.....',
  '.....HHHHHHHHHHHhhhhhhhhhhj.....',
  '................................',
  '................................',
  '................................',
  '................................',
];

/** Each icon file: its size in pixels, which crown, and how many pixels each of the crown's takes. */
export const ICONS = [
  { file: 'icon-16.png', size: 16, crown: 'small', scale: 1 },
  { file: 'icon-32.png', size: 32, crown: 'large', scale: 1 },
  { file: 'apple-touch-icon.png', size: 180, crown: 'large', scale: 5 },
  { file: 'icon-192.png', size: 192, crown: 'large', scale: 6 },
  { file: 'icon-512.png', size: 512, crown: 'large', scale: 16 },
  // Android cuts a maskable icon to its own shape, a circle at the smallest: the crown keeps inside it.
  { file: 'icon-maskable.png', size: 512, crown: 'large', scale: 11 },
] as const;

export type Icon = (typeof ICONS)[number];

/** An icon, every pixel of it: the crown in the middle, on royal blue that is lighter behind it. */
export function gameIcon({ size, crown, scale }: Icon): Bitmap {
  const rows = crown === 'small' ? SMALL : LARGE;
  const grid = rows.length;
  const art = new Bitmap(grid, grid);
  rows.forEach((row, y) => [...row].forEach((ch, x) => KEY[ch] !== undefined && art.set(x, y, KEY[ch])));
  const inked = outline(art, INK);
  const icon = new Bitmap(size, size);
  const offset = (size - grid * scale) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // The blue is drawn in the crown's own big pixels too, out to the edges.
      const [cx, cy] = [Math.floor((x - offset) / scale), Math.floor((y - offset) / scale)];
      const inside = cx >= 0 && cy >= 0 && cx < grid && cy < grid;
      const away = Math.hypot(cx + 0.5 - grid / 2, cy + 0.5 - grid / 2) / (grid / 2);
      icon.set(x, y, (inside && inked.get(cx, cy)) || (away < 0.55 ? BLUE[4] : away < 0.95 ? BLUE[3] : BLUE[2]));
    }
  }
  return icon;
}
