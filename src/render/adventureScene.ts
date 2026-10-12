import type { BackgroundId } from '../content/backgrounds';
import { leads, troopPower, type TroopId } from '../content/troops';
import { finished, geeseHome, VANISHES, type Army, type GameState, type Location } from '../rules/game';
import type { Point } from '../rules/map/geometry';
import { forestAmount, Terrain, type MapModel } from '../rules/map/model';
import { AdventureScreen, type Placed } from './adventureScreen';
import { Bitmap, SHADOW } from './bitmap';
import { FogMask } from './fog';
import { MINIMAP } from './frame';
import { MapTiles } from './mapTiles';
import { Minimap } from './minimap';
import { hash } from './noise';
import { BLUE, GOLD, INK, NEUTRAL, PARCHMENT, RED, SILHOUETTE, WOOD } from './palette';
import { animFrames, bodyHeight, everyFrame, STAND, troopFigure, type Figure, type Pose } from './battleSprites';
import { heroArtId, type ArtId } from './units';
import {
  abbey, boat, boulder, camp, campfire,
  butts, CART_GROUND as DRAWN_CART_GROUND, cottage, castle, standingStones, chest, crag, fold, goldPile, grainCart, hayrick, hideout, holes, huntHall, hut, kiln, lodge, mews, mill, mine, mirror, nest, oak, pack, peatHut, pine, pond, signpost, skeps, stiltHut, shrine,
  stoneBridge, swimmingGoose, washingCottage, watchtower, wayside, well, willow, windmill, xMark, lostGoose, cairn, kingsPennant, PENNANT_FOOT, shadowOval,
} from './sprites';
import { TerrainPainter } from './terrain';
import { dress } from './dressing';
import { mapArtReady, paintedAnimation, paintedFigure, piece } from './mapArt';
import type { PieceName } from './mapPieces';

/**
 * Whether the scene being drawn is Aldmoor's painted map (#178): set as each scene is built, and read
 * when a place is drawn anew. Elsewhere, or until the pieces have loaded, the map is drawn in code.
 */
let painted = false;

/** A place drawn as one of the painted pieces, if this is the painted map. */
function art(name: PieceName, animated = false): { frames: Bitmap[]; foot: number; animated: boolean } | null {
  const p = painted ? piece(name) : null;
  return p ? { frames: [p.sprite], foot: p.foot, animated } : null;
}

/** What each place's look (or, failing that, its kind) is on the painted map. */
const PAINTED_LOOKS: Partial<Record<string, PieceName>> = {
  cottage: 'cottage',
  house: 'washing',
  stones: 'stones',
  range: 'butts',
  lodge: 'lodge',
  mews: 'mews',
  pack: 'pack',
  campfire: 'campfire',
  fold: 'fold',
  boat: 'boat',
  skeps: 'skeps',
  hayrick: 'hayrick',
  pond: 'pond',
  kiln: 'kiln',
  nest: 'nest',
  purse: 'goldSmall',
  oats: 'haystack',
  crystals: 'crystals',
  lonePine: 'bFir',
  stand: 'gazebo',
  camp: 'tents',
  windmill: 'windmill',
  shrine: 'shrine',
};
const PAINTED_KINDS: Partial<Record<string, PieceName>> = {
  castle: 'castle',
  tower: 'tower',
  mine: 'mine',
  village: 'well',
  well: 'well',
  mill: 'watermill',
  signpost: 'signpost',
  event: 'shrine',
  chest: 'chestShut',
  gold: 'goldHeap',
  hideout: 'stockade',
};

const FRAMES = 8;
const animation = <T>(make: (t: number) => T) => Array.from({ length: FRAMES }, (_, i) => make(i / FRAMES));
const footY = (o: Placed) => o.y + o.sprite.height;

/** Landmarks under fog show only as flat dark shapes. */
function silhouette(sprite: Bitmap): Bitmap {
  const out = new Bitmap(sprite.width, sprite.height);
  for (let i = 0; i < sprite.data.length; i++) if (sprite.data[i] !== 0 && sprite.data[i] !== SHADOW) out.data[i] = SILHOUETTE;
  return out;
}

/** A map character's travel and idle poses on one grounded canvas. */
type Gait = { stride: number; frames: readonly number[]; footfalls: readonly number[] };
export type HeroRig = {
  object: Placed;
  idle: Bitmap[];
  walk: Bitmap[];
  idleLeft: Bitmap[];
  walkLeft: Bitmap[];
  /** Pixels from the sprite's top to his feet (or the hooves), and from his feet to the top of his head. */
  foot: number;
  head: number;
  gait?: Gait;
};

/** A gait's frame boundaries and contacts are map distances, so turns and Shift keep the same steps. */
export function walkFrame(distance: number, gait?: Gait): number {
  return gait ? gait.frames.findIndex((end) => distance % gait.stride < end) : Math.floor(distance / 5);
}

export function walkFootfalls(from: number, to: number, gait: Gait): number {
  return gait.footfalls.reduce((count, phase) => count + Math.floor((to - phase) / gait.stride) - Math.floor((from - phase) / gait.stride), 0);
}

/** A clickable area in map pixels, for one location of the rules. */
export type Hitbox = { id: string; x0: number; y0: number; x1: number; y1: number };

export type AdventureScene = {
  view: AdventureScreen;
  fog: FogMask;
  /** The whole province in the right-hand panel, painted into the view's frame. */
  minimap: Minimap;
  hero: HeroRig;
  hitboxes: Hitbox[];
  /** Objects that vanish once their location is done: pickups and enemies. */
  pickups: Map<string, Placed>;
  /** Enemy rigs, including both characters of a led band and a convoy's escort. */
  bands: Map<string, HeroRig>;
  /** Animated landmarks by place, so one that changes (the hunt hall, opened) can be drawn anew. */
  sights: Map<string, Placed>;
  /** Each place's pictures (a village's huts with its well), by place: what lights up under the pointer (#256). */
  parts: Map<string, Placed[]>;
  /** The King's pennant beside each place the hero has done with (#256), by place. */
  pennants: Map<string, Placed>;
  /** The places it flies at: a new set only when that changes, so the minimap marks them again only then. */
  flown: ReadonlySet<string>;
};

const place = (sprite: Bitmap, [x, y]: Point, footFromTop: number): Placed => ({ sprite, x: x - sprite.width / 2, y: y - footFromTop });

/** The troop worth most in an army, leaving out its leader. */
const mainTroop = (army: Army): TroopId | undefined =>
  army.filter((s) => s.count > 0 && !leads(s.troop)).sort((a, b) => b.count * troopPower(b.troop) - a.count * troopPower(a.troop))[0]?.troop;

/** The troop that stands for a stack on the map: its leader, a villain or a captain, if it has one; else the one worth most. */
function leadTroop(army: Army): TroopId {
  return army.find((s) => s.count > 0 && leads(s.troop))?.troop ?? mainTroop(army) ?? army[0].troop;
}

/**
 * A band's leader with one of his men at his heel, a step behind him and to the side, away from
 * whoever comes: one sprite, with his feet where the leader's are, as wide on either side of them.
 */
function atHeel(leader: Bitmap, lead: Figure, man: Figure, facing: 1 | -1, width: number): { sprite: Bitmap; foot: number } {
  const [lx, ly] = [-lead.x, -lead.y];
  const [mx, my] = [-man.x, -man.y];
  const [dx, dy] = [-facing * Math.round(width * 0.62), -5];
  const half = Math.max(lx, leader.width - lx, mx - dx, dx - mx + man.sprite.width);
  const top = Math.min(-ly, dy - my);
  const out = new Bitmap(half * 2, Math.max(leader.height - ly, dy - my + man.sprite.height) - top);
  // His man first, behind him; a shadow only where nothing else is.
  const paint = (src: Bitmap, x0: number, y0: number) => {
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const v = src.data[y * src.width + x];
        if (v !== 0 && (v !== SHADOW || out.get(x0 + x, y0 + y) === 0)) out.set(x0 + x, y0 + y, v);
      }
    }
  };
  paint(man.sprite, half + dx - mx, -top + dy - my);
  paint(leader, half - lx, -top - ly);
  return { sprite: out, foot: -top };
}

/**
 * A convoy on the map: its cart ahead, heading west as its road does, and one of its escort (already
 * in his red ring) walking at its tail. One sprite, with his feet and the cart's wheel on the ground.
 */
function withCart(escort: Bitmap, foot: number, facing: 1 | -1): { sprite: Bitmap; foot: number } {
  const painting = painted ? piece('cart') : null;
  const original = painting?.sprite ?? grainCart();
  const cart = facing < 0 ? original : mirror(original);
  const CART_GROUND = painting?.foot ?? DRAWN_CART_GROUND;
  const overlap = 6;
  const top = Math.max(foot, CART_GROUND);
  const out = new Bitmap(cart.width + escort.width - overlap, top + Math.max(escort.height - foot, cart.height - CART_GROUND));
  const paint = (src: Bitmap, x0: number, y0: number) => {
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const v = src.data[y * src.width + x];
        if (v !== 0 && (v !== SHADOW || out.get(x0 + x, y0 + y) === 0)) out.set(x0 + x, y0 + y, v);
      }
    }
  };
  paint(cart, facing < 0 ? 0 : escort.width - overlap, top - CART_GROUND);
  paint(escort, facing < 0 ? cart.width - overlap : 0, top - foot);
  return { sprite: out, foot: top };
}

/** Where the lost geese swim on the painted pond once they're home, in the order they come (#192). */
const POND_SPOTS: readonly [number, number, boolean][] = [[27, 10, true], [9, 22, false], [40, 15, true], [3, 13, false], [37, 22, true], [18, 23, false], [49, 13, false]];

/** The painted pond with `home` of the lost geese swimming on it too. */
function withGeese(pond: Bitmap, home: number): Bitmap {
  const out = new Bitmap(pond.width, pond.height);
  out.data.set(pond.data);
  for (const [x, y, right] of POND_SPOTS.slice(0, home)) swimmingGoose(out, x, y, right);
  return out;
}

/** The seal on a scroll stone, by its circle: red wax for the 1st, blue for the 2nd, gold for the 3rd. */
const SEALS = [RED[3], BLUE[4], GOLD[5]] as const;

/** A standing stone with a scroll bound across its face, sealed in its circle's colour (#240). */
function withScroll(stone: Bitmap, circle: number): Bitmap {
  const out = new Bitmap(stone.width, stone.height);
  out.data.set(stone.data);
  const w = 18;
  const [x0, y0] = [Math.floor((stone.width - w) / 2), 13];
  const body = [PARCHMENT[6], PARCHMENT[5], PARCHMENT[5], PARCHMENT[4], PARCHMENT[2]];
  const roll = [PARCHMENT[4], PARCHMENT[3], PARCHMENT[2], PARCHMENT[1], PARCHMENT[0]];
  for (let x = x0; x < x0 + w; x++) {
    const edge = x === x0 || x === x0 + w - 1;
    const rolled = x <= x0 + 2 || x >= x0 + w - 3;
    // The rolled ends stand a pixel proud of the sheet, above and below.
    const [top, bottom] = rolled ? [y0 - 1, y0 + 5] : [y0, y0 + 4];
    for (let y = top; y <= bottom; y++) out.set(x, y, edge || y === bottom ? INK : rolled ? roll[Math.min(4, y - top)] : body[y - y0]);
  }
  // The cord round it, and the seal over the cord.
  const mid = x0 + Math.floor(w / 2);
  for (let y = y0; y <= y0 + 3; y++) out.set(mid - 3, y, WOOD[2]);
  const seal = SEALS[Math.max(0, Math.min(2, circle - 1))];
  for (let dy = 0; dy < 4; dy++) for (let dx = -1; dx <= 1; dx++) if (!((dy === 0 || dy === 3) && dx !== 0)) out.set(mid + dx, y0 + dy, seal);
  for (const [dx, dy] of [[-2, 1], [-2, 2], [2, 1], [2, 2]]) out.set(mid + dx, y0 + dy, INK);
  out.set(mid, y0 + 1, NEUTRAL[7]);
  return out;
}

/** One painted piece standing on another: `top`'s foot at `at` on `base` (the beacon's fire on its hill). */
function stacked(base: { sprite: Bitmap; foot: number }, top: { sprite: Bitmap; foot: number }, at: Point): { frames: Bitmap[]; foot: number; animated: boolean } {
  const x0 = Math.min(0, at[0] - Math.floor(top.sprite.width / 2));
  const y0 = Math.min(0, at[1] - top.foot);
  const out = new Bitmap(Math.max(base.sprite.width, at[0] + Math.ceil(top.sprite.width / 2)) - x0, base.sprite.height - y0);
  const paint = (src: Bitmap, ox: number, oy: number) => {
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const v = src.data[y * src.width + x];
        if (v !== 0 && (v !== SHADOW || out.get(ox + x, oy + y) === 0)) out.set(ox + x, oy + y, v);
      }
    }
  };
  paint(base.sprite, -x0, -y0);
  paint(top.sprite, at[0] - Math.floor(top.sprite.width / 2) - x0, at[1] - top.foot - y0);
  return { frames: [out], foot: base.foot - y0, animated: false };
}

/**
 * The sprite (or frames) that stands for a place on the map, and how far below its top the foot is.
 * The goose pond shows the lost geese that are `home` (#192).
 */
function landmark(l: Location, home = 0): { frames: Bitmap[]; foot: number; animated: boolean; figure?: Omit<HeroRig, 'object'> } | null {
  if (painted) {
    // The goose pond is drawn anew as the lost geese come home to it, so it's kept with the places that change.
    if (l.look === 'pond') {
      const look = art('pond', true);
      if (look) return home ? { ...look, frames: [withGeese(look.frames[0], home)] } : look;
    }
    // The beacon on the downs: a fire on a little hill.
    if (l.look === 'beacon') {
      const [hill, fire] = [piece('hill'), piece('fire')];
      if (hill && fire) return stacked(hill, fire, [Math.round(hill.sprite.width / 2), 9]);
    }
    // A scroll stone (#240): one standing stone, with a scroll bound across its face under a seal of its circle's colour.
    if (l.look === 'stone1' || l.look === 'stone2' || l.look === 'stone3') {
      const stone = piece('menhir');
      if (stone) return { frames: [withScroll(stone.sprite, Number(l.look.slice(5)))], foot: stone.foot, animated: false };
    }
    // The hunt hall is drawn anew once it opens, so it's kept with the places that change.
    if (l.look === 'hall') return art(l.recruits ? 'hallOpen' : 'hallShut', true) ?? drawn(l);
    // So is a chest, which stays open and empty once it's opened; a guarded one is gilded (#192).
    if (l.kind === 'chest') return art(l.done ? 'chestOpen' : l.guard ? 'chestGold' : 'chestShut', true) ?? drawn(l);
    const name = (l.look && PAINTED_LOOKS[l.look]) ?? (!l.look || !(l.look in LOOKS_DRAWN) ? PAINTED_KINDS[l.kind] : undefined);
    const look = name ? art(name) : null;
    if (look) return look;
  }
  return drawn(l);
}

/** Looks that stand for a place on the map in their own drawing, even on the painted map. */
const LOOKS_DRAWN = { cart: 1, hamper: 1, abbey: 1, peathut: 1, stilthut: 1, cairn: 1 } as const;

/** A place as it's drawn in code. */
function drawn(l: Location): ReturnType<typeof landmark> {
  switch (l.look) {
    case 'abbey':
      return { frames: [abbey()], foot: 60, animated: false };
    case 'peathut':
      return { frames: [peatHut()], foot: 32, animated: false };
    case 'windmill':
      return { frames: animation((t) => windmill(t)), foot: 66, animated: true };
    case 'stilthut':
      return { frames: animation((t) => stiltHut(t * Math.PI * 2)), foot: 80, animated: true };
    case 'camp':
      return { frames: animation((t) => camp(t * Math.PI * 2)), foot: 36, animated: true };
    case 'cottage':
      return { frames: animation((t) => cottage(t)), foot: 44, animated: true };
    case 'house':
      return { frames: [washingCottage(11)], foot: 28, animated: false };
    case 'stones':
      return { frames: [standingStones()], foot: 36, animated: false };
    case 'range':
      return { frames: [butts()], foot: 34, animated: false };
    case 'hall':
      // Shut up until the huntsmen come back to it: then the door stands open and smoke rises.
      return { frames: l.recruits ? animation((t) => huntHall(true, t)) : [huntHall(false)], foot: 62, animated: true };
    case 'lodge':
      return { frames: [lodge()], foot: 46, animated: false };
    case 'mews':
      return { frames: [mews()], foot: 36, animated: false };
    case 'pack':
    case 'hamper':
      return { frames: [pack(l.look === 'hamper')], foot: 18, animated: true };
    case 'campfire':
      return { frames: animation((t) => campfire(t)), foot: 30, animated: true };
    case 'fold':
      return { frames: [fold()], foot: 34, animated: false };
    case 'boat':
      return { frames: [boat()], foot: 26, animated: false };
    // Still, so they show through the mist as the silhouettes that draw a player off the road.
    case 'skeps':
      return { frames: [skeps(0.3)], foot: 31, animated: false };
    case 'hayrick':
      return { frames: [hayrick()], foot: 42, animated: false };
    case 'pond':
      return { frames: [pond()], foot: 31, animated: false };
    case 'kiln':
      return { frames: [kiln(0.3)], foot: 40, animated: false };
    case 'nest':
      return { frames: animation((t) => nest(t)), foot: 38, animated: true };
    case 'purse':
    case 'oats':
    case 'crystals':
    case 'letter':
      return { frames: [wayside(l.look)], foot: 12, animated: true };
    case 'beacon':
      return { frames: animation((t) => campfire(t)), foot: 30, animated: true };
    case 'lonePine':
      return { frames: [pine(77, 52)], foot: 47, animated: false };
    case 'stand':
      return { frames: [lodge()], foot: 46, animated: false };
    case 'cairn':
      return { frames: [cairn()], foot: 28, animated: false };
    case 'cart': {
      const figure = bandFrames(l);
      return { frames: figure.idleLeft, foot: figure.foot, animated: true, figure };
    }
  }
  switch (l.kind) {
    case 'castle':
      return { frames: animation((t) => castle(t * Math.PI * 2)), foot: 104, animated: true };
    case 'tower':
      return { frames: [watchtower(0.2)], foot: 74, animated: false };
    case 'mine':
      return { frames: [mine()], foot: 44, animated: false };
    case 'village':
    case 'well':
      return { frames: [well()], foot: 23, animated: false };
    case 'mill':
      return { frames: animation((t) => mill(t / 8)), foot: 44, animated: true };
    case 'signpost':
      return { frames: [signpost()], foot: 23, animated: false };
    case 'dig':
      return { frames: animation((t) => xMark(t * Math.PI * 2)), foot: 30, animated: true };
    case 'event':
      return { frames: [shrine()], foot: 30, animated: false };
    case 'chest':
      return { frames: [chest(l.done)], foot: 19, animated: true };
    case 'gold':
      return { frames: [goldPile()], foot: 15, animated: true };
    case 'hideout':
      return { frames: [hideout(0.4)], foot: 64, animated: false };
    case 'patrol': {
      const figure = bandFrames(l);
      return { frames: figure.idleLeft, foot: figure.foot, animated: true, figure };
    }
    case 'pickup':
      return { frames: [wayside('purse')], foot: 12, animated: true };
    case 'goose':
      return { frames: [lostGoose()], foot: 15, animated: true };
  }
}

/** The same sprite a pixel higher. */
function raised(sprite: Bitmap): Bitmap {
  const out = new Bitmap(sprite.width, sprite.height);
  out.data.set(sprite.data.subarray(sprite.width));
  return out;
}

/** The ring round a figure's feet (as wide as `width` asks), bright with a dark edge: gold for the hero, red for a foe. */
function ringed(sprite: Bitmap, foot: number, ramp: readonly number[] = GOLD, width = sprite.width): Bitmap {
  const out = new Bitmap(sprite.width, sprite.height + 6);
  out.data.set(sprite.data);
  const rx = Math.round(width * 0.36);
  const ry = Math.max(4, Math.round(rx * 0.26));
  for (const [grow, colour] of [[1, INK], [-1, ramp[3]], [0, ramp[6]]] as const) {
    for (let a = 0; a < Math.PI * 2; a += 0.005) {
      const x = Math.round(sprite.width / 2 + Math.cos(a) * (rx + grow));
      const y = Math.round(foot - 1 + Math.sin(a) * (ry + grow * 0.6));
      if (out.get(x, y) === 0 || out.get(x, y) === SHADOW || grow === 0 && (out.get(x, y) === INK || out.get(x, y) === ramp[3])) out.set(x, y, colour);
    }
  }
  return out;
}

/** Draws a place anew where it stands, as the state has it now: the hunt hall, opened, a band with fewer men, or the goose pond with `home` of the lost geese on it. */
export function refreshPlace(scene: AdventureScene, l: Location, home = 0) {
  const o = scene.sights.get(l.id) ?? scene.pickups.get(l.id);
  const look = landmark(l, home);
  if (!o || !look) return;
  Object.assign(o, place(look.frames[0], l.at, look.foot), { frames: look.frames.length > 1 ? look.frames : undefined, frame: undefined, foot: look.figure ? look.foot : undefined });
  if (look.figure) {
    const rig = scene.bands.get(l.id);
    if (rig) Object.assign(rig, look.figure);
    else scene.bands.set(l.id, { object: o, ...look.figure });
  } else scene.bands.delete(l.id);
  // A band may stand for itself as another of its troops now, so it's clicked where the new figure stands.
  const box = scene.pickups.has(l.id) ? scene.hitboxes.find((b) => b.id === l.id) : undefined;
  if (box) Object.assign(box, { x0: o.x, y0: o.y, x1: o.x + o.sprite.width, y1: o.y + o.sprite.height });
}

/** Puts a place on the map after the scene was built, like the X once the map is whole, or a villain riding out again. */
export function addPlace(scene: AdventureScene, l: Location) {
  const look = landmark(l);
  if (!look) return;
  const o: Placed = { ...place(look.frames[0], l.at, look.foot), frames: look.frames.length > 1 ? look.frames : undefined, foot: look.figure ? look.foot : undefined, hidden: Boolean(l.enemy?.unseen) };
  scene.view.animate(o);
  scene.pickups.set(l.id, o);
  scene.parts.set(l.id, [o]);
  if (look.figure) scene.bands.set(l.id, { object: o, ...look.figure });
  // A place back on the map (a band that rode out before) is clicked where it stands now.
  const old = scene.hitboxes.findIndex((b) => b.id === l.id);
  if (old >= 0) scene.hitboxes.splice(old, 1);
  scene.hitboxes.push({ id: l.id, x0: o.x, y0: o.y, x1: o.x + o.sprite.width, y1: o.y + o.sprite.height });
}

/** The King's pennant, waving: the frames every pennant on the map takes turns through. */
let pennantFrames: Bitmap[] | null = null;

/**
 * The King's pennant flies beside every place the hero has done with (#256), as HoMM2's mines fly their
 * owner's flag, and comes down again if something new opens there. Returns the places it flies at.
 */
export function flyPennants(scene: AdventureScene, state: GameState): ReadonlySet<string> {
  pennantFrames ??= animation((t) => kingsPennant(t * Math.PI * 2));
  const ids = new Set(state.locations.filter((l) => finished(state, l)).map((l) => l.id));
  for (const [id, o] of scene.pennants) {
    if (ids.has(id)) continue;
    scene.view.remove(o);
    scene.pennants.delete(id);
  }
  for (const l of state.locations) {
    const box = ids.has(l.id) && !scene.pennants.has(l.id) ? scene.hitboxes.find((b) => b.id === l.id) : undefined;
    if (!box) continue;
    // Planted just off its right side, each waving in its own time.
    const turn = [...l.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % FRAMES;
    const frames = [...pennantFrames.slice(turn), ...pennantFrames.slice(0, turn)];
    const o: Placed = { sprite: frames[0], frames, x: Math.round(box.x1) - 3 - PENNANT_FOOT[0], y: l.at[1] + 2 - PENNANT_FOOT[1] };
    scene.view.animate(o);
    scene.pennants.set(l.id, o);
  }
  const same = ids.size === scene.flown.size && [...ids].every((id) => scene.flown.has(id));
  if (!same) scene.flown = ids;
  return scene.flown;
}

/** The meadow's small things, by kind: bushes, flowers, grass and ferns, and the odd stump, log, mushrooms, stones or bramble. */
const BUSHES = [0, 1, 2, 3, 4, 5, 26, 27, 28] as const;
const FLOWERS = [6, 7, 8, 9, 10, 11] as const;
const GRASS_TUFTS = [12, 13, 14, 15, 16] as const;
const ODDS = [17, 18, 19, 20, 21, 22, 23, 24, 25] as const;

/**
 * Scatters the meadow's small things over open land, as HoMM2 fills its map: never on a road, the water,
 * a place or in a wood, thickest along the edge of a wood, and a little everywhere else, so open
 * country is never a bare green sheet. One in four, on a jittered grid; what grows is the hash's choice.
 */
function meadow(map: MapModel, scenery: Placed[]) {
  const { province } = map;
  const near = [...province.locations.map((l) => l.at), ...province.decor.map((d) => d.at), province.hero];
  for (let gy = 20; gy < province.height - 10; gy += 26) {
    for (let gx = 16; gx < province.width - 10; gx += 26) {
      const x = gx + (hash(gx, gy, 420) - 0.5) * 22;
      const y = gy + (hash(gx, gy, 421) - 0.5) * 22;
      const cell = map.terrain[Math.floor(y / 8) * map.width + Math.floor(x / 8)];
      if (cell !== Terrain.Grass) continue;
      const wood = forestAmount(province, x, y);
      if (wood > 0.45) continue;
      // Thick along the edge of a wood, sparse in the open.
      const chance = wood > 0.2 ? 0.75 : 0.22;
      if (hash(gx, gy, 422) > chance) continue;
      if (near.some(([px, py]) => Math.abs(px - x) < 40 && Math.abs(py - y) < 34)) continue;
      const pick = hash(gx, gy, 423);
      const list = wood > 0.2 ? (pick < 0.7 ? BUSHES : GRASS_TUFTS) : pick < 0.35 ? GRASS_TUFTS : pick < 0.62 ? FLOWERS : pick < 0.88 ? BUSHES : ODDS;
      const p = piece(`decor${list[Math.floor(hash(gx, gy, 424) * list.length)]}` as PieceName);
      if (!p) continue;
      scenery.push(place(hash(gx, gy, 425) < 0.5 ? mirror(p.sprite) : p.sprite, [x, y], p.foot));
    }
  }
}

/**
 * The painted map's trees, rocks, crags and village huts. The rules plant a tree every few pixels for
 * the drawn map's little ones; the painted trees are bigger, so one in four of those stands. Woods of
 * pines are dark pines and blue firs; the rest broadleaves, a few of them in autumn colours.
 */
function paintedScenery(map: MapModel, locations: readonly Location[], scenery: Placed[], landmarks: Placed[], partOf: (id: string, o: Placed) => void) {
  const { province } = map;
  const pick = <T,>(list: readonly T[], v: number) => list[Math.floor(v * list.length) % list.length];
  dress(map, locations, scenery);
  province.rocks.forEach(([x, y, size], i) => {
    const p = piece(size >= 8 ? 'boulder2' : pick(['boulder1', 'boulder3'] as const, hash(i, 2, 413)))!;
    scenery.push(place(p.sprite, [x, y], p.foot));
  });
  // Crags stand as ranges, not dots: most are the big range, the rest the single peak, mirrored at random.
  province.crags.forEach(([x, y, w], i) => {
    const p = piece(w >= 95 ? 'cragBig' : 'cragMid')!;
    scenery.push(place(hash(i, 3, 414) < 0.5 ? mirror(p.sprite) : p.sprite, [x, y], p.foot));
  });
  // The step the river falls over: a line of crags along it, either side of the falls.
  if (province.cliff) {
    const line = province.cliff.line;
    const riverX = (y: number) => {
      for (let n = 1; n < province.river.length; n++) {
        const [ax, ay] = province.river[n - 1];
        const [bx, by] = province.river[n];
        if (y >= ay && y <= by) return ax + ((bx - ax) * (y - ay)) / (by - ay || 1);
      }
      return Infinity;
    };
    const p = piece('cragMid')!;
    for (let x = line[0][0] - 20; x <= line[line.length - 1][0] + 20; x += 34) {
      const n = line.findIndex(([lx]) => lx >= x);
      const [ax, ay] = line[Math.max(0, n - 1)];
      const [bx, by] = line[Math.max(0, n)] ?? line[line.length - 1];
      const y = ay + ((by - ay) * (x - ax)) / (bx - ax || 1);
      if (Math.abs(x - riverX(y)) < 30) continue;
      scenery.push(place(hash(x, 4, 415) < 0.5 ? mirror(p.sprite) : p.sprite, [x, y + province.cliff.height + 4], p.foot));
    }
  }
  meadow(map, scenery);
  for (const d of province.decor) {
    const p = piece(d.sprite === 'holes' ? 'holes' : d.seed % 2 ? 'hut' : 'cottage')!;
    const o = place(p.sprite, d.at, p.foot);
    landmarks.push(o);
    partOf(d.place, o);
  }
}

/** Sets out the province and everything on it, as the rules state has it right now. The land is painted as it comes into view. */
export function buildAdventureScene(map: MapModel, state: GameState): AdventureScene {
  const { province } = map;
  const scenery: Placed[] = [];
  const landmarks: Placed[] = [];
  const hitboxes: Hitbox[] = [];
  const pickups = new Map<string, Placed>();
  const bands = new Map<string, HeroRig>();
  const sights = new Map<string, Placed>();
  const animated: Placed[] = [];
  const parts = new Map<string, Placed[]>();
  const partOf = (id: string, o: Placed) => parts.set(id, [...(parts.get(id) ?? []), o]);

  painted = province.id === 'aldmoor' && mapArtReady();
  if (painted) paintedScenery(map, state.locations, scenery, landmarks, partOf);
  else {
    const pines = Array.from({ length: 18 }, (_, i) => pine(500 + i, 13 + (i % 6) * 2));
    const oaks = Array.from({ length: 12 }, (_, i) => oak(700 + i, 12 + (i % 4) * 2));
    const willows = map.trees.some((t) => t.kind === 'willow') ? Array.from({ length: 10 }, (_, i) => willow(760 + i, 14 + (i % 4) * 2)) : [];
    for (const t of map.trees) {
      const variants = t.kind === 'pine' ? pines : t.kind === 'willow' ? willows : oaks;
      scenery.push(place(variants[Math.floor(t.variant * variants.length)], [t.x, t.y], variants[0].height - 5));
    }
    province.trees.forEach(([x, y, isPine], i) => {
      const sprite = isPine ? pine(300 + i, 22) : oak(320 + i, 22);
      scenery.push(place(sprite, [x, y], sprite.height - 5));
    });
    province.rocks.forEach(([x, y, size], i) => scenery.push(place(boulder(260 + i, size), [x, y], Math.ceil(size * 0.8) + 2)));
    province.crags.forEach(([x, y, w, h], i) => scenery.push(place(crag(w, h, 40 + i), [x, y], h)));
    for (const d of province.decor) {
      const o = d.sprite === 'holes' ? place(holes(d.seed), d.at, 26) : place(hut(d.seed), d.at, 28);
      landmarks.push(o);
      partOf(d.place, o);
    }
  }

  for (const l of state.locations) {
    const look = landmark(l, l.look === 'pond' ? geeseHome(state) : 0);
    if (!look) continue;
    const o: Placed = { ...place(look.frames[0], l.at, look.foot), frames: look.frames.length > 1 ? look.frames : undefined, foot: look.figure ? look.foot : undefined };
    partOf(l.id, o);
    const vanishes = VANISHES.has(l.kind);
    if (vanishes) {
      if (!l.done) {
        // A band out of the hero's sight stays off the map until he sees it (see `rules/map/sight.ts`).
        o.hidden = Boolean(l.enemy?.unseen);
        pickups.set(l.id, o);
        if (look.figure) bands.set(l.id, { object: o, ...look.figure });
        animated.push(o);
      }
    } else if (look.animated) {
      animated.push(o);
      sights.set(l.id, o);
    } else landmarks.push(o);
  }

  // A bridge over each group of cells where a road crosses water.
  const unvisited = new Set([...map.terrain.keys()].filter((i) => map.terrain[i] === Terrain.Bridge));
  for (const first of unvisited) {
    const group = [first];
    unvisited.delete(first);
    for (let k = 0; k < group.length; k++) {
      const i = group[k];
      for (const n of [i - 1, i + 1, i - map.width, i + map.width, i - map.width - 1, i - map.width + 1, i + map.width - 1, i + map.width + 1]) {
        if (unvisited.has(n)) {
          unvisited.delete(n);
          group.push(n);
        }
      }
    }
    const xs = group.map((i) => i % map.width);
    const cx = xs.reduce((a, b) => a + b, 0) / group.length;
    const cy = group.reduce((s, i) => s + Math.floor(i / map.width), 0) / group.length;
    const span = (Math.max(...xs) - Math.min(...xs) + 1) * 8;
    const arch = painted ? piece('bridge') : null;
    landmarks.push(arch ? place(arch.sprite, [cx * 8 + 4, cy * 8 + 4], arch.foot - 6) : place(stoneBridge(Math.max(46, span + 18)), [cx * 8 + 4, cy * 8 + 4], 12));
  }

  const isLandmark = new Set(landmarks);
  const fixtures = [...scenery, ...landmarks]
    .sort((a, b) => footY(a) - footY(b))
    .map((o) => ({ sprite: o.sprite, wild: isLandmark.has(o) ? silhouette(o.sprite) : o.sprite, x: Math.round(o.x), y: Math.round(o.y) }));
  const fog = new FogMask(province.width, province.height, state.explored);
  const painter = new TerrainPainter(map);
  const view = new AdventureScreen(new MapTiles(painter, fixtures), fog);
  const minimap = new Minimap(map, painter, fog, MINIMAP);
  for (const o of animated) view.animate(o);

  for (const [id, objects] of parts) {
    hitboxes.push({
      id,
      x0: Math.min(...objects.map((o) => o.x)),
      y0: Math.min(...objects.map((o) => o.y)),
      x1: Math.max(...objects.map((o) => o.x + o.sprite.width)),
      y1: Math.max(...objects.map((o) => o.y + o.sprite.height)),
    });
  }

  // The hero, in his background's figure, in a gold ring.
  const figure = figureFrames(heroArtId(state.hero.background), false);
  const rig: HeroRig = { object: { ...place(figure.idle[0], state.hero.at, figure.foot), frames: figure.idle, foot: figure.foot }, ...figure };
  if (state.hero.facing < 0) rig.object.frames = rig.idleLeft;
  view.animate(rig.object);
  return { view, fog, minimap, hero: rig, hitboxes, pickups, bands, sights, parts, pennants: new Map(), flown: new Set() };
}

/** Packs poses round their foot anchors, including both facings and any companion. */
function commonFrames(all: Figure[]): { frames: Bitmap[]; foot: number } {
  const half = Math.max(...all.flatMap((frame) => [-frame.x, frame.x + frame.sprite.width]));
  const foot = Math.max(...all.map((frame) => -frame.y));
  const height = foot + Math.max(4, ...all.map((frame) => frame.y + frame.sprite.height));
  const frames = all.map((frame) => {
    const out = new Bitmap(half * 2, height);
    for (let y = 0; y < frame.sprite.height; y++) {
      for (let x = 0; x < frame.sprite.width; x++) {
        const v = frame.sprite.get(x, y);
        if (v !== 0) out.set(half + frame.x + x, foot + frame.y + y, v);
      }
    }
    return out;
  });
  return { frames, foot };
}

/**
 * Painted travel and gentle idle share one grounded canvas, shadow and ring. Until a set loads,
 * its previous painted or Wesnoth figure still stands in.
 */
function figureFrames(art: ArtId, enemy: boolean, ring = true): Omit<HeroRig, 'object'> {
  const team = enemy ? 'red' : 'blue';
  const ramp = enemy ? RED : GOLD;
  const still = troopFigure(art, team, 1, STAND, 'map');
  const moving = paintedAnimation(art, 'map', 'move');
  if (moving?.stride && moving.footfalls) {
    const waiting = paintedAnimation(art, 'map', 'idle');
    const duration = moving.frames.reduce((total, frame) => total + frame.ms, 0);
    const poses: Pose[] = [];
    for (const [anim, sequence] of [['idle', waiting], ['move', moving]] as const) {
      let ms = 0;
      for (const frame of sequence?.frames ?? []) {
        poses.push({ anim, ms });
        ms += frame.ms;
      }
      if (anim === 'idle' && !sequence) poses.push(STAND);
    }
    const count = waiting?.frames.length ?? 1;
    const right = poses.map((pose) => troopFigure(art, team, 1, pose, 'map'));
    const left = poses.map((pose) => troopFigure(art, team, -1, pose, 'map'));
    const packed = commonFrames([...right, ...left]);
    const { foot } = packed;
    const grounded = (out: Bitmap): Bitmap => {
      for (let i = 0; i < out.data.length; i++) if (out.data[i] === SHADOW) out.data[i] = 0;
      // The sun's shadow stays on the same side even when the body turns.
      shadowOval(out, out.width / 2 + 2, foot + 1, Math.max(4, still.sprite.width * 0.3), 2);
      return ring ? ringed(out, foot, ramp, still.sprite.width) : out;
    };
    let end = 0;
    const stride = moving.stride;
    const idle = (frames: Bitmap[]) => frames.slice(0, count).flatMap((frame, i) =>
      Array<Bitmap>(waiting ? Math.max(1, Math.round(waiting.frames[i].ms / 120)) : 1).fill(grounded(frame)),
    );
    return {
      idle: idle(packed.frames.slice(0, right.length)), walk: packed.frames.slice(count, right.length).map(grounded),
      idleLeft: idle(packed.frames.slice(right.length)), walkLeft: packed.frames.slice(right.length + count).map(grounded),
      foot, head: bodyHeight(art, 'map'),
      gait: {
        stride,
        frames: moving.frames.map((frame) => (end += frame.ms) / duration * stride),
        footfalls: moving.footfalls.map((contact) => contact / duration * stride),
      },
    };
  }
  const foot = -still.y;
  const fidget = animFrames(art, 'idle').length > 1 && !paintedFigure(art, 'map') ? everyFrame(art, 'idle', team, 1, 'map', 120) : Array<Bitmap>(4).fill(raised(still.sprite));
  // Still for at least half again as long as the fidget lasts, so it comes now and then.
  const decorate = (frame: Bitmap) => ring ? ringed(frame, foot, ramp) : frame;
  const idle = [...Array<Bitmap>(Math.max(16, Math.round(fidget.length * 1.5))).fill(still.sprite), ...fidget].map(decorate);
  const up = raised(still.sprite);
  const stride = [still.sprite, still.sprite, up, raised(up), raised(up), up];
  // Until a figure has a painted gait, keep its existing bob.
  const walk = (!paintedFigure(art, 'map') && animFrames(art, 'move').length > 1 ? everyFrame(art, 'move', team, 1, 'map', 70) : stride).map(decorate);
  return { idle, walk, idleLeft: idle.map(mirror), walkLeft: walk.map(mirror), foot, head: bodyHeight(art, 'map') };
}

function bandFrames(l: Location): Omit<HeroRig, 'object'> {
  const lead = leadTroop(l.enemy!.army);
  const leader = figureFrames(lead, true);
  const men = leads(lead) ? mainTroop(l.enemy!.army) : undefined;
  const man = men ? figureFrames(men, true, false) : null;
  const width = troopFigure(lead, 'red', 1, STAND, 'map').sprite.width;
  const seed = [...l.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const poses: Figure[] = [];
  for (const facing of [1, -1] as const) {
    for (const anim of ['idle', 'walk'] as const) {
      const frames = facing > 0 ? leader[anim] : leader[anim === 'idle' ? 'idleLeft' : 'walkLeft'];
      const followers = man ? facing > 0 ? man[anim] : man[anim === 'idle' ? 'idleLeft' : 'walkLeft'] : null;
      for (let i = 0; i < frames.length; i++) {
        let sprite = frames[i];
        let foot = leader.foot;
        if (man && followers) {
          const k = anim === 'idle' ? (i + seed + Math.floor(followers.length / 2)) % followers.length : Math.floor(i * followers.length / frames.length + followers.length / 2) % followers.length;
          const escort = followers[k];
          const joined = atHeel(sprite, { sprite, x: -Math.round(sprite.width / 2), y: -foot }, { sprite: escort, x: -Math.round(escort.width / 2), y: -man.foot }, facing, width);
          [sprite, foot] = [joined.sprite, joined.foot];
        }
        if (l.look === 'cart') {
          const joined = withCart(sprite, foot, facing);
          [sprite, foot] = [joined.sprite, joined.foot];
        }
        poses.push({ sprite, x: -Math.round(sprite.width / 2), y: -foot });
      }
    }
  }
  const packed = commonFrames(poses);
  const take = (start: number, length: number) => packed.frames.slice(start, start + length);
  const rotate = (frames: Bitmap[]) => [...frames.slice(seed % frames.length), ...frames.slice(0, seed % frames.length)];
  const n = leader.idle.length;
  const m = leader.walk.length;
  return {
    idle: rotate(take(0, n)), walk: rotate(take(n, m)),
    idleLeft: rotate(take(n + m, n)), walkLeft: rotate(take(n * 2 + m, m)),
    foot: packed.foot, head: leader.head, gait: leader.gait,
  };
}

/** Puts the hero in another background's figure, where he stands: when the choice on the opening card changes who he was. */
export function setHeroFigure(scene: AdventureScene, background: BackgroundId, facing: 1 | -1) {
  const rig = scene.hero;
  const feet = rig.object.y + rig.foot;
  const centre = rig.object.x + rig.object.sprite.width / 2;
  const figure = figureFrames(heroArtId(background), false);
  Object.assign(rig, figure, { gait: figure.gait });
  rig.object.frames = facing < 0 ? rig.idleLeft : rig.idle;
  rig.object.sprite = rig.object.frames[0];
  rig.object.x = centre - rig.object.sprite.width / 2;
  rig.object.y = feet - rig.foot;
  rig.object.foot = rig.foot;
}
