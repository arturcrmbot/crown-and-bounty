/**
 * The battle's pointers, drawn in code as the map's crossed swords are (`statIcon`): 16 pixels square,
 * in the icons' colours, inked round, and shown twice their size. Each says what a click would do
 * there: a sword or a lance pointing the way the blow goes in, a bow, a boot (a horseshoe for riders,
 * a paw for beasts), a spell's sign, a lute for a bard's business, and "no" where nothing can be done.
 */
import { Bitmap, outline } from './bitmap';
import { picture, statIcon } from './artifactIcons';
import { EARTH, INK, RED } from './palette';

/** Which way a blow goes in, from the hex it is struck from to the stack it lands on. */
export type Heading = 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export type CursorKind = 'sword' | 'lance' | 'bow' | 'boot' | 'horseshoe' | 'paw' | 'wand' | 'flame' | 'lightning' | 'lute' | 'no';

/** A sword going in down and to the right: its hilt at the top left, its point at the bottom right. */
const SWORD_SE = [
  '................',
  '.Gg.............',
  '.gh.............',
  '..vW...g........',
  '...vW.G.........',
  '.....G..........',
  '....GtS.........',
  '...g..tS........',
  '.......tS.......',
  '........tS......',
  '.........tS.....',
  '..........tS....',
  '...........tS...',
  '............tS..',
  '..............S.',
  '................',
];

/** A sword going in to the right. */
const SWORD_E = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '....G...........',
  '....g...........',
  '.GwwgSSSSSSSSSS.',
  '.gvvgtttttttts..',
  '....g...........',
  '....h...........',
  '................',
  '................',
  '................',
  '................',
  '................',
];

/** A knight's lance going in down and to the right, the King's blue pennant at its head. */
const LANCE_SE = [
  '................',
  '.v..............',
  '..w.............',
  '..sS............',
  '..tSS...........',
  '...tSS..........',
  '....wW..........',
  '.....wW.........',
  '......wW..BB....',
  '.......wWBBb....',
  '........wWb.....',
  '.........wW.....',
  '..........sS....',
  '...........sS...',
  '............S...',
  '................',
];

/** A lance going in to the right. */
const LANCE_E = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '...s............',
  '...sS......BBBb.',
  'wWWSSWWWWWWWWSSS',
  'vwwtswwwwwwwwtt.',
  '...t.......Bb...',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];

/** A bow drawn, an arrow on the string, aimed to the right. */
const BOW = [
  '................',
  '..Ww............',
  '..m.Ww..........',
  '..m...Ww........',
  '..m....Ww.......',
  '..m.....W.......',
  '..m......W......',
  'NNm......W..s...',
  'mmMtttttttttSSS.',
  'NNm......W..t...',
  '..m......W......',
  '..m.....W.......',
  '..m....wW.......',
  '..m...wW........',
  '..m.ww..........',
  '..wW............',
];

/** A boot, for a stack that marches there. */
const BOOT = [
  '................',
  '................',
  '....yYYYYy......',
  '....wWWWWw......',
  '....wWWWWw......',
  '....wWWWWw......',
  '....wWWWWw......',
  '....wWWWWw......',
  '....wWWWWWw.....',
  '....wWWWWWWww...',
  '....wWWWWWWWWw..',
  '....wWWWWWWWWWw.',
  '....vvvvvvvvvvv.',
  '................',
  '................',
  '................',
];

/** A horseshoe, for a stack that rides there. */
const HORSESHOE = [
  '................',
  '................',
  '.....SSSSSS.....',
  '...SSsttttsSS...',
  '..SSt......tSS..',
  '..St........tS..',
  '.SSt........tSS.',
  '.St..........tS.',
  '.SuS........SuS.',
  '.St..........tS.',
  '.St..........tS.',
  '.SuS........SuS.',
  '.St..........tS.',
  '.SS..........SS.',
  '.tt..........tt.',
  '................',
];

/** A ball of fire, for a fireball. */
const FLAME = [
  '................',
  '.......R........',
  '......RR........',
  '......RGR.......',
  '.....RGGR...R...',
  '....RRGGGR.RR...',
  '....RGGNGGRRR...',
  '...RGGNNNGGR....',
  '...RGNNNNNGR....',
  '..RGGNNNNNGGR...',
  '..RGNNNNNNNGR...',
  '..rRGNNNNNGRr...',
  '...rRGGGGGRr....',
  '....rrRRRrr.....',
  '................',
  '................',
];

/** A bolt from the sky, for lightning. */
const LIGHTNING = [
  '................',
  '.......GGGGG....',
  '......GNNNG.....',
  '.....GNNNG......',
  '....GNNNG.......',
  '...GNNNGGGGG....',
  '..GGGGGNNNG.....',
  '......GNNG......',
  '.....GNNG.......',
  '....GNNG........',
  '...GNNG.........',
  '..GNG...........',
  '.GG.............',
  '................',
  '................',
  '................',
];

/** A lute, for a bard's business with a stack: paying it off, or jeering at it. */
const LUTE = [
  '.............hh.',
  '............hgh.',
  '...........Ww...',
  '..........Ww....',
  '.........Ww.....',
  '........Ww......',
  '......WWWw......',
  '....WWWWWWw.....',
  '...WWWWvvWWw....',
  '..WWWWvvvvWw....',
  '..WWWWWvvWWw....',
  '..wWWWWWWWWw....',
  '...wWWWWWWw.....',
  '....wwwwww......',
  '................',
  '................',
];

/**
 * A knight's steel gauntlet, pointing, for the map's pointer over a place to visit (#256): its finger's
 * tip is at (6, 1). The map's own crossed swords stand over an enemy.
 */
const GAUNTLET = [
  '................',
  '.....Ss.........',
  '.....St.........',
  '.....St.........',
  '.....Sto........',
  '.....StoSs......',
  '.....StoStoSs...',
  '.Ss.oStoStoStS..',
  '.StSoSttStttStt.',
  '..StSttttttttSt.',
  '...Stttttttttts.',
  '...Sttttttttts..',
  '....Stttttttts..',
  '.....Gggggggg...',
  '.....Ghhhhhhg...',
  '................',
];

/** The gauntlet, for the map's pointer over a place (#256). */
export const gauntletIcon = (): Bitmap => picture(GAUNTLET);

/** A paw print, for a beast that pads there: four toes over a pad. */
function paw(): Bitmap {
  const b = new Bitmap(16, 16);
  const blob = (cx: number, cy: number, rx: number, ry: number) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (d <= 1) b.set(x, y, x - cx + (y - cy) < -1 ? EARTH[5] : EARTH[3]);
      }
    }
  };
  for (const [cx, cy] of [[3, 6.5], [6, 3], [10, 3], [13, 6.5]]) blob(cx, cy, 1.6, 2);
  blob(8, 10.5, 3.6, 3);
  return outline(b, INK);
}

/** "No": a red ring with a bar across it, where a click would do nothing. */
function no(): Bitmap {
  const b = new Bitmap(16, 16);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      const ring = d >= 4.9 && d <= 7;
      const bar = d < 5.5 && Math.abs(x - y) <= 1;
      if (ring || bar) b.set(x, y, y < 8 ? RED[5] : RED[4]);
    }
  }
  return outline(b, INK);
}

function flipped(b: Bitmap, across: boolean, down: boolean): Bitmap {
  const out = new Bitmap(b.width, b.height);
  for (let y = 0; y < b.height; y++) for (let x = 0; x < b.width; x++) out.set(across ? b.width - 1 - x : x, down ? b.height - 1 - y : y, b.get(x, y));
  return out;
}

/** A blow's picture turned to go in the way `heading` says, from one pointing right and one pointing down and to the right. */
function turned(east: string[], southEast: string[], heading: Heading): Bitmap {
  const flat = heading === 'e' || heading === 'w';
  return flipped(picture(flat ? east : southEast), heading.endsWith('w'), heading.startsWith('n'));
}

const drawn = new Map<string, Bitmap>();

/** The pointer for `kind`: a sword or a lance turned to go in the way `heading` says. */
export function cursorIcon(kind: CursorKind, heading: Heading = 'e'): Bitmap {
  const key = kind === 'sword' || kind === 'lance' ? `${kind}:${heading}` : kind;
  let icon = drawn.get(key);
  if (!icon) {
    icon =
      kind === 'sword' ? turned(SWORD_E, SWORD_SE, heading)
      : kind === 'lance' ? turned(LANCE_E, LANCE_SE, heading)
      : kind === 'bow' ? picture(BOW)
      : kind === 'boot' ? picture(BOOT)
      : kind === 'horseshoe' ? picture(HORSESHOE)
      : kind === 'paw' ? paw()
      : kind === 'wand' ? statIcon('spellPower')
      : kind === 'flame' ? picture(FLAME)
      : kind === 'lightning' ? picture(LIGHTNING)
      : kind === 'lute' ? picture(LUTE)
      : no();
    drawn.set(key, icon);
  }
  return icon;
}
