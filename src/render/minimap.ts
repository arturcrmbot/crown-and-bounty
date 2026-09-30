import { VANISHES, type Location } from '../rules/game';
import { nearest, type Point } from '../rules/map/geometry';
import { CELL, forestAt, poolEdge, riverHalfWidth, Terrain, type MapModel } from '../rules/map/model';
import { Bitmap } from './bitmap';
import { trim, type Rect } from './frame';
import { hash } from './noise';
import { BLUE, DIRT, FOG_LUT, GOLD, INK, LEAF, NEUTRAL, PARCHMENT, PINE, RED, ROCK, SLATE, STONE, WATER } from './palette';
import type { TerrainPainter } from './terrain';

/** The minimap's colours: the land's own, in pairs or threes to speckle them, and the marks on it. */
export const MINIMAP_COLOURS = {
  pine: [PINE[3], PINE[4]],
  oak: [LEAF[3], LEAF[4]],
  willow: [LEAF[4], LEAF[5]],
  mountain: [ROCK[4], ROCK[5], ROCK[6]],
  cliff: ROCK[3],
  river: WATER[4],
  pool: WATER[2],
  falls: WATER[8],
  ford: WATER[8],
  bridge: STONE[6],
  road: DIRT[6],
  town: BLUE[5],
  villain: RED[5],
  foe: RED[4],
  treasure: GOLD[5],
  place: PARCHMENT[6],
  spent: STONE[4],
  hero: GOLD[5],
  heart: NEUTRAL[7],
  gold: GOLD[6],
  view: NEUTRAL[7],
};

/**
 * What a mark on the minimap stands for: a castle or village (where troops are for hire), the villain
 * (in his lair, or where he rides when he's out), an enemy band, treasure (and the X where the sceptre
 * lies), any other place, or a place already used up.
 */
export type MarkKind = 'town' | 'villain' | 'foe' | 'treasure' | 'place' | 'spent';
export type Mark = { id: string; at: Point; kind: MarkKind };

/** Drawn in this order, so enemies and the villain come out on top of what they stand near. */
const ORDER: Record<MarkKind, number> = { spent: 0, place: 1, treasure: 2, town: 3, foe: 4, villain: 5 };
/** How big each mark is, in minimap pixels, inside its ink edge. */
const SIZE: Record<MarkKind, number> = { spent: 2, place: 2, treasure: 2, town: 3, foe: 3, villain: 3 };
/** How far the hero's diamond reaches from its heart, ink edge included. */
const HERO_REACH = 3;

/** `out` is whether a villain's band has ridden out of this place: then he's marked where he rides, and his lair as his men's. */
function markOf(l: Location, out: boolean): MarkKind {
  if (l.enemy?.lair && !l.done) return 'villain';
  if (l.kind === 'hideout') return l.done ? 'spent' : out ? 'foe' : 'villain';
  if (l.enemy && !l.done) return 'foe';
  if (l.kind === 'castle' || l.kind === 'village') return 'town';
  if (l.kind === 'chest' || l.kind === 'gold' || l.kind === 'dig') return l.done ? 'spent' : 'treasure';
  return l.done ? 'spent' : 'place';
}

/** Anything that says where the fog still lies, in map pixels: the adventure screen's own fog. */
export type Fog = { isFogged(x: number, y: number): boolean };

/** The places the hero has found, and the enemies he knows are there: whatever the map itself shows clear of the fog. */
export function marksOf(locations: readonly Location[], fog: Fog): Mark[] {
  const out = new Set(locations.filter((l) => l.enemy?.lair && !l.done).map((l) => l.enemy!.lair));
  return locations
    .filter((l) => !(l.done && VANISHES.has(l.kind)) && !l.enemy?.unseen && !fog.isFogged(l.at[0], l.at[1] - 2))
    .map((l) => ({ id: l.id, at: l.at, kind: markOf(l, out.has(l.id)) }))
    .sort((a, b) => ORDER[a.kind] - ORDER[b.kind]);
}

/** How a stretch of land shows on the minimap: as explored, and under the fog. */
type Look = { land: number; wild: number };

/** How many cells of each terrain a minimap pixel covers, counted afresh for each. */
const COUNT = new Uint8Array(Object.keys(Terrain).length);

/** How far the gold moulding round the minimap reaches out from it, as round every box of the interface. */
const TRIM = 5;
/** The button in the minimap's top right corner, which folds it away; folded, it's all that's left. */
const BUTTON = 15;
/** Pixels round the button that still count as on it: it's small. */
const BUTTON_SLACK = 3;

/** The button's pictures, from the top left of its face: a bar to fold the minimap away, and a little folded map to bring it back. */
const FOLD = ['', '', '', '', '..ggggggg', '..GGGGGGG', '...ooooooo'];
const UNFOLD = [
  '',
  'ooooooooooo',
  'oLLLLdLLLLo',
  'owLLLdLrLro',
  'oLwwLdLLrLo',
  'oLLLwdLrLro',
  'oLLLLwwLLLo',
  'oLLLLdLwwLo',
  'oLLLLdLLLwo',
  'ooooooooooo',
];

/**
 * The whole province at a glance, in the top right corner of the map's view, as HoMM2 had it. The land
 * is worked out once, from the rules' walk grid and the painter's regions; the fog is laid over it only
 * where the hero has just seen; marks, the hero and the view's frame go on top. It's painted, in its
 * moulding, only when something it shows has changed, and laid over the map every frame, after the
 * light and the night, as it's a chart, not a window. A button in its corner folds it away (Tab does too).
 */
export class Minimap {
  /** Where it sits on the screen, inside its moulding. */
  readonly rect: Rect;
  /** Minimap pixels per map pixel. */
  readonly scale: number;
  /** Its size in pixels. A province of another shape than `rect`'s sits in its middle. */
  readonly width: number;
  readonly height: number;
  /** Whether it's out, or folded away into its button. */
  shown = true;
  /** Whether the pointer is on its button, which lights up. */
  lit = false;
  private readonly left: number;
  private readonly top: number;
  private readonly world: { width: number; height: number };
  private readonly fogged: Fog;
  /** The land as explored, and under the fog: no roads there, in the fog's colours. */
  private readonly land: Uint8Array;
  private readonly wild: Uint8Array;
  /** The land with the fog laid over it, as it stands. */
  private readonly base: Uint8Array;
  /** The minimap as last painted, in its moulding; and folded away, the moulding round its button alone. */
  private readonly box: Bitmap;
  private readonly stub: Bitmap;
  private marks: Mark[] = [];
  /** What was painted last: the fog's turn, the places, where the hero and the view were. */
  private painted = { fog: -1, locations: null as readonly Location[] | null, key: '' };
  private fogTurn = 0;

  constructor(map: MapModel, painter: TerrainPainter, fog: Fog, rect: Rect) {
    const { province } = map;
    this.rect = rect;
    this.world = { width: province.width, height: province.height };
    this.fogged = fog;
    this.scale = Math.min(rect.width / province.width, rect.height / province.height);
    this.width = Math.min(rect.width, Math.round(province.width * this.scale));
    this.height = Math.min(rect.height, Math.round(province.height * this.scale));
    this.left = rect.x + Math.floor((rect.width - this.width) / 2);
    this.top = rect.y + Math.floor((rect.height - this.height) / 2);
    const size = this.width * this.height;
    this.land = new Uint8Array(size);
    this.wild = new Uint8Array(size);
    this.base = new Uint8Array(size);
    for (let my = 0; my < this.height; my++) {
      for (let mx = 0; mx < this.width; mx++) {
        const look = this.lookAt(map, painter, mx, my);
        this.land[my * this.width + mx] = look.land;
        this.wild[my * this.width + mx] = FOG_LUT[look.wild];
      }
    }
    this.box = new Bitmap(rect.width + TRIM * 2, rect.height + TRIM * 2);
    trim(this.box, { x: TRIM, y: TRIM, width: rect.width, height: rect.height });
    this.stub = new Bitmap(BUTTON + TRIM * 2, BUTTON + TRIM * 2);
    trim(this.stub, { x: TRIM, y: TRIM, width: BUTTON, height: BUTTON });
    this.refog();
  }

  /**
   * How the land under one minimap pixel shows: the cells of the walk grid it covers, a crossing or a
   * road before anything else so they run unbroken, then whatever most of it is.
   */
  private lookAt(map: MapModel, painter: TerrainPainter, mx: number, my: number): Look {
    const { province } = map;
    const C = MINIMAP_COLOURS;
    const x = (mx + 0.5) / this.scale;
    const y = (my + 0.5) / this.scale;
    const cx0 = Math.min(map.width - 1, Math.floor(mx / this.scale / CELL));
    const cy0 = Math.min(map.height - 1, Math.floor(my / this.scale / CELL));
    const cx1 = Math.min(map.width - 1, Math.max(cx0, Math.ceil((mx + 1) / this.scale / CELL) - 1));
    const cy1 = Math.min(map.height - 1, Math.max(cy0, Math.ceil((my + 1) / this.scale / CELL) - 1));
    const count = COUNT.fill(0);
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) count[map.terrain[cy * map.width + cx]]++;
    const water = poolEdge(province, x, y) < 3 ? C.pool : C.river;
    if (count[Terrain.Bridge]) return { land: C.bridge, wild: water };
    if (count[Terrain.Ford]) return { land: C.ford, wild: C.ford };
    if (count[Terrain.Road]) return { land: C.road, wild: painter.overview(x, y) };
    // Ties go to the rarer, narrower thing: water before rock before woods before open land.
    const open = count[Terrain.Grass] + count[Terrain.Building];
    const most = Math.max(count[Terrain.Water], count[Terrain.Cliff], count[Terrain.Rock], count[Terrain.Forest], open);
    const speckle = (ramp: readonly number[], seed: number) => ramp[Math.floor(hash(mx, my, seed) * ramp.length)];
    let colour: number;
    if (count[Terrain.Water] === most) colour = water;
    else if (count[Terrain.Cliff] === most) {
      // Where the river goes over the cliff, the falls.
      const river = nearest(map.river, x, y);
      colour = river.d < riverHalfWidth(river.s) ? C.falls : C.cliff;
    } else if (count[Terrain.Rock] === most) colour = speckle(C.mountain, 213);
    else if (count[Terrain.Forest] === most) {
      // Each wood in its own mix of trees, as the painter plants them: Darkwood all pines, the chase mostly oaks.
      const pines = province.forests[forestAt(province, x, y)]?.[4] ?? province.woods?.pine ?? 0.75;
      const willows = province.woods?.willow ?? 0;
      const pick = hash(mx, my, 211);
      colour = speckle(pick < pines ? C.pine : pick < pines + willows ? C.willow : C.oak, 212);
    } else colour = painter.overview(x, y);
    return { land: colour, wild: colour };
  }

  /** The minimap pixel over a map point. */
  private pixel(x: number, y: number): [number, number] {
    return [Math.max(0, Math.min(this.width - 1, Math.floor(x * this.scale))), Math.max(0, Math.min(this.height - 1, Math.floor(y * this.scale)))];
  }

  /** Lays the fog over the land again: all of it, or just round where the hero has seen. */
  refog(around?: { at: Point; radius: number }) {
    let [x0, y0, x1, y1] = [0, 0, this.width - 1, this.height - 1];
    if (around) {
      // The fog's soft edge reaches a few cells past what was seen.
      const reach = around.radius + CELL * 4;
      [x0, y0] = this.pixel(around.at[0] - reach, around.at[1] - reach);
      [x1, y1] = this.pixel(around.at[0] + reach, around.at[1] + reach);
    }
    for (let my = y0; my <= y1; my++) {
      for (let mx = x0; mx <= x1; mx++) {
        const i = my * this.width + mx;
        this.base[i] = this.fogged.isFogged((mx + 0.5) / this.scale, (my + 0.5) / this.scale) ? this.wild[i] : this.land[i];
      }
    }
    this.fogTurn++;
  }

  /**
   * Paints the minimap, in its moulding, if anything it shows has changed since last time: the fog,
   * the places, the hero's pixel or the view's frame. `view` is the part of the map on screen, in map
   * pixels. Returns whether it painted. `draw` lays it over the map.
   */
  paint(locations: readonly Location[], hero: Point, view: Rect): boolean {
    const [hx, hy] = this.pixel(hero[0], hero[1]);
    const frame = this.frameOf(view);
    const key = `${hx},${hy}|${frame.join(',')}`;
    const stale = this.painted.fog !== this.fogTurn || this.painted.locations !== locations;
    if (!stale && key === this.painted.key) return false;
    if (stale) this.marks = marksOf(locations, this.fogged);
    this.painted = { fog: this.fogTurn, locations, key };
    const { box, rect } = this;
    const [ox, oy] = this.origin();
    box.fill(TRIM, TRIM, rect.width, rect.height, INK);
    for (let my = 0; my < this.height; my++) box.data.set(this.base.subarray(my * this.width, (my + 1) * this.width), (oy + my) * box.width + ox);
    for (const mark of this.marks) {
      const [mx, my] = this.pixel(mark.at[0], mark.at[1] - 4);
      // The villain's mark has his gold at its heart.
      this.dot(mx, my, SIZE[mark.kind], MINIMAP_COLOURS[mark.kind], mark.kind === 'villain' ? MINIMAP_COLOURS.gold : undefined);
    }
    this.outline(frame, MINIMAP_COLOURS.view);
    this.diamond(hx, hy);
    return true;
  }

  /**
   * Lays the minimap over the map's view, or folded away, its button alone in the corner. It goes on
   * after the light, the weather and the night, as it's a chart, not a window.
   */
  draw(screen: Bitmap) {
    const { rect } = this;
    const image = this.shown ? this.box : this.stub;
    const x = this.shown ? rect.x - TRIM : rect.x + rect.width - BUTTON - TRIM;
    const y = rect.y - TRIM;
    for (let j = 0; j < image.height; j++) screen.data.set(image.data.subarray(j * image.width, (j + 1) * image.width), (y + j) * screen.width + x);
    button(screen, rect.x + rect.width - BUTTON, rect.y, this.shown ? FOLD : UNFOLD, this.lit);
  }

  /** Where the minimap's own pixels start in its box: inside the moulding, and centred if the province is another shape. */
  private origin(): [number, number] {
    return [this.left - this.rect.x + TRIM, this.top - this.rect.y + TRIM];
  }

  /** The view's frame, in minimap pixels: left, top, right, bottom, inside the minimap. */
  private frameOf(view: Rect): [number, number, number, number] {
    const clampX = (v: number) => Math.max(0, Math.min(this.width - 1, v));
    const clampY = (v: number) => Math.max(0, Math.min(this.height - 1, v));
    return [
      clampX(Math.round(view.x * this.scale)),
      clampY(Math.round(view.y * this.scale)),
      clampX(Math.round((view.x + view.width) * this.scale) - 1),
      clampY(Math.round((view.y + view.height) * this.scale) - 1),
    ];
  }

  /** Sets a minimap pixel in the box, if it's on the minimap. */
  private put(mx: number, my: number, colour: number) {
    if (mx < 0 || my < 0 || mx >= this.width || my >= this.height) return;
    const [ox, oy] = this.origin();
    this.box.set(ox + mx, oy + my, colour);
  }

  /** A square mark `size` pixels across in an ink edge, centred on a minimap pixel, maybe with a heart of another colour. */
  private dot(mx: number, my: number, size: number, colour: number, heart = colour) {
    const x0 = mx - Math.floor(size / 2);
    const y0 = my - Math.floor(size / 2);
    for (let y = y0 - 1; y <= y0 + size; y++) {
      for (let x = x0 - 1; x <= x0 + size; x++) {
        const edge = x < x0 || y < y0 || x >= x0 + size || y >= y0 + size;
        this.put(x, y, edge ? INK : x === mx && y === my ? heart : colour);
      }
    }
  }

  /** The hero: a gold diamond round a bright heart, a shape no place has, so he's the first thing the eye finds. */
  private diamond(mx: number, my: number) {
    for (let y = my - HERO_REACH; y <= my + HERO_REACH; y++) {
      for (let x = mx - HERO_REACH; x <= mx + HERO_REACH; x++) {
        const d = Math.abs(x - mx) + Math.abs(y - my);
        if (d <= HERO_REACH) this.put(x, y, d === HERO_REACH ? INK : d === 0 ? MINIMAP_COLOURS.heart : MINIMAP_COLOURS.hero);
      }
    }
  }

  private outline([x0, y0, x1, y1]: [number, number, number, number], colour: number) {
    for (let x = x0; x <= x1; x++) {
      this.put(x, y0, colour);
      this.put(x, y1, colour);
    }
    for (let y = y0; y <= y1; y++) {
      this.put(x0, y, colour);
      this.put(x1, y, colour);
    }
  }

  /** Whether a screen point is on the minimap, out and clear of its button. */
  contains(x: number, y: number): boolean {
    return this.shown && !this.onButton(x, y) && x >= this.left && y >= this.top && x < this.left + this.width && y < this.top + this.height;
  }

  /** Whether a screen point is on the button in its corner, out or folded away, or near enough. */
  onButton(x: number, y: number): boolean {
    const x0 = this.rect.x + this.rect.width - BUTTON;
    const y0 = this.rect.y;
    return x >= x0 - BUTTON_SLACK && x < x0 + BUTTON + BUTTON_SLACK && y >= y0 - BUTTON_SLACK && y < y0 + BUTTON + BUTTON_SLACK;
  }

  /** The screen point over a map point: where on the minimap to press to look there. */
  toScreen([x, y]: Point): Point {
    return [this.left + x * this.scale - 0.5, this.top + y * this.scale - 0.5];
  }

  /** The map point under a screen point, kept on the map: a drag that runs off the minimap still steers. */
  toMap(x: number, y: number): Point {
    const mx = Math.max(0, Math.min(this.width - 0.5, x - this.left + 0.5));
    const my = Math.max(0, Math.min(this.height - 0.5, y - this.top + 0.5));
    return [Math.min(this.world.width, mx / this.scale), Math.min(this.world.height, my / this.scale)];
  }

  /** The mark nearest a screen point on the minimap, if one is within a couple of pixels. */
  markAt(x: number, y: number): Mark | null {
    let best: Mark | null = null;
    let bestD = 3;
    for (const mark of this.marks) {
      const [mx, my] = this.pixel(mark.at[0], mark.at[1] - 4);
      const d = Math.max(Math.abs(this.left + mx - x), Math.abs(this.top + my - y));
      if (d <= bestD) {
        best = mark;
        bestD = d;
      }
    }
    return best;
  }

  /** Whether a screen point is within a couple of pixels of a map point's place on the minimap. */
  near(x: number, y: number, at: Point): boolean {
    const [mx, my] = this.pixel(at[0], at[1]);
    return Math.max(Math.abs(this.left + mx - x), Math.abs(this.top + my - y)) <= 3;
  }

  /** Whether the minimap shows fog under a screen point: whatever lies there isn't known yet. */
  foggedAt(x: number, y: number): boolean {
    const [mx, my] = this.toMap(x, y);
    return this.fogged.isFogged(mx, my);
  }
}

/** The button's colours: its glyphs' letters, lit and not. */
const GLYPH: Record<string, [number, number]> = {
  g: [GOLD[5], GOLD[6]],
  G: [GOLD[3], GOLD[5]],
  o: [INK, INK],
  L: [PARCHMENT[5], PARCHMENT[6]],
  d: [PARCHMENT[3], PARCHMENT[4]],
  w: [WATER[5], WATER[6]],
  r: [RED[4], RED[5]],
};

/** The minimap's button at (x, y): a slate square in an ink edge, lit from the top left, with its glyph; brighter under the pointer. */
function button(screen: Bitmap, x: number, y: number, glyph: readonly string[], lit: boolean) {
  const last = BUTTON - 1;
  for (let j = 0; j <= last; j++) {
    for (let i = 0; i <= last; i++) {
      const colour = i === 0 || j === 0 || i === last || j === last ? INK : i === 1 || j === 1 ? SLATE[lit ? 6 : 5] : i === last - 1 || j === last - 1 ? SLATE[1] : SLATE[lit ? 4 : 3];
      screen.set(x + i, y + j, colour);
    }
  }
  glyph.forEach((row, j) => [...row].forEach((ch, i) => GLYPH[ch] && screen.set(x + 2 + i, y + 2 + j, GLYPH[ch][lit ? 1 : 0])));
}
