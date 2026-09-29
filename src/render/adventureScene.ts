import type { BackgroundId } from '../content/backgrounds';
import { leads, troopPower, type TroopId } from '../content/troops';
import { VANISHES, type Army, type GameState, type Location } from '../rules/game';
import type { Point } from '../rules/map/geometry';
import { Terrain, type MapModel } from '../rules/map/model';
import { AdventureScreen, type Placed } from './adventureScreen';
import { Bitmap, SHADOW } from './bitmap';
import { FogMask } from './fog';
import { MINIMAP } from './frame';
import { MapTiles } from './mapTiles';
import { Minimap } from './minimap';
import { GOLD, INK, RED, SILHOUETTE } from './palette';
import { animFrames, bodyHeight, everyFrame, STAND, troopFigure, type Figure } from './battleSprites';
import { heroArtId } from './units';
import {
  abbey, boulder, camp,
  butts, CART_GROUND, cottage, castle, standingStones, chest, crag, goldPile, grainCart, hideout, holes, huntHall, hut, lodge, mill, mine, mirror, oak, peatHut, pine, signpost, stiltHut, shrine,
  stoneBridge, washingCottage, watchtower, well, willow, windmill, xMark,
} from './sprites';
import { TerrainPainter } from './terrain';

const FRAMES = 8;
const animation = <T>(make: (t: number) => T) => Array.from({ length: FRAMES }, (_, i) => make(i / FRAMES));
const footY = (o: Placed) => o.y + o.sprite.height;

/** Landmarks under fog show only as flat dark shapes. */
function silhouette(sprite: Bitmap): Bitmap {
  const out = new Bitmap(sprite.width, sprite.height);
  for (let i = 0; i < sprite.data.length; i++) if (sprite.data[i] !== 0 && sprite.data[i] !== SHADOW) out.data[i] = SILHOUETTE;
  return out;
}

/** Everything the controller needs to ride the hero around. */
export type HeroRig = {
  object: Placed;
  idle: Bitmap[];
  walk: Bitmap[];
  idleLeft: Bitmap[];
  walkLeft: Bitmap[];
  /** Pixels from the sprite's top to his feet (or the hooves), and from his feet to the top of his head. */
  foot: number;
  head: number;
};

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
  /** Animated landmarks by place, so one that changes (the hunt hall, opened) can be drawn anew. */
  sights: Map<string, Placed>;
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
function atHeel(leader: Bitmap, lead: Figure, man: Figure): { sprite: Bitmap; foot: number } {
  const [lx, ly] = [-lead.x, -lead.y];
  const [mx, my] = [-man.x, -man.y];
  const [dx, dy] = [Math.round(leader.width * 0.62), -5];
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
function withCart(escort: Bitmap, foot: number): { sprite: Bitmap; foot: number } {
  const cart = grainCart();
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
  paint(cart, 0, top - CART_GROUND);
  paint(escort, cart.width - overlap, top - foot);
  return { sprite: out, foot: top };
}

/** The sprite (or frames) that stands for a place on the map, and how far below its top the foot is. */
function landmark(l: Location): { frames: Bitmap[]; foot: number; animated: boolean } | null {
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
    case 'cart': {
      // Pike's grain cart, and one of his lads at its tail in a foe's red ring, fidgeting as they wait.
      const lead = leadTroop(l.enemy!.army);
      const still = troopFigure(lead, 'red', -1, STAND, 'map');
      const fidget = animFrames(lead, 'idle').length > 1 ? everyFrame(lead, 'idle', 'red', -1, 'map', 120) : Array<Bitmap>(4).fill(raised(still.sprite));
      const joined = [...Array<Bitmap>(fidget.length > 4 ? 24 : 14).fill(still.sprite), ...fidget].map((f) => withCart(ringed(f, -still.y, RED), -still.y));
      return { frames: joined.map((j) => j.sprite), foot: joined[0].foot, animated: true };
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
      return { frames: [chest()], foot: 19, animated: true };
    case 'gold':
      return { frames: [goldPile()], foot: 15, animated: true };
    case 'hideout':
      return { frames: [hideout(0.4)], foot: 64, animated: false };
    case 'patrol': {
      // One creature stands for the stack, HoMM2 style, at the same scale as everything else. Now
      // and then it fidgets, as its Wesnoth unit does, each band in its own time.
      const lead = leadTroop(l.enemy!.army);
      const still = troopFigure(lead, 'red', -1, STAND, 'map');
      // Those Wesnoth gave no fidget just breathe: a pixel up for a moment, every couple of seconds.
      const fidget = animFrames(lead, 'idle').length > 1 ? everyFrame(lead, 'idle', 'red', -1, 'map', 120) : Array<Bitmap>(4).fill(raised(still.sprite));
      let poses = [...Array<Bitmap>(fidget.length > 4 ? 24 : 14).fill(still.sprite), ...fidget];
      let foot = -still.y;
      // A villain or a captain has one of his men at his heel, so a band reads as his: a wolf at the huntsman's.
      const men = leads(lead) ? mainTroop(l.enemy!.army) : undefined;
      if (men) {
        const man = troopFigure(men, 'red', -1, STAND, 'map');
        const joined = poses.map((f) => atHeel(f, still, man));
        poses = joined.map((j) => j.sprite);
        foot = joined[0].foot;
      }
      // The red ring under his feet says he is a foe, as the hero's gold one says he is your own.
      const frames = poses.map((f) => ringed(f, foot, RED, still.sprite.width));
      const turn = [...l.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % frames.length;
      return { frames: [...frames.slice(turn), ...frames.slice(0, turn)], foot, animated: true };
    }
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

/** Draws a place anew where it stands, as the state has it now: the hunt hall, opened. */
export function refreshPlace(scene: AdventureScene, l: Location) {
  const o = scene.sights.get(l.id);
  const look = landmark(l);
  if (!o || !look) return;
  Object.assign(o, place(look.frames[0], l.at, look.foot), { frames: look.frames.length > 1 ? look.frames : undefined });
}

/** Puts a place on the map after the scene was built, like the X once the map is whole, or a villain riding out again. */
export function addPlace(scene: AdventureScene, l: Location) {
  const look = landmark(l);
  if (!look) return;
  const o: Placed = { ...place(look.frames[0], l.at, look.foot), frames: look.frames.length > 1 ? look.frames : undefined };
  scene.view.animate(o);
  scene.pickups.set(l.id, o);
  // A place back on the map (a band that rode out before) is clicked where it stands now.
  const old = scene.hitboxes.findIndex((b) => b.id === l.id);
  if (old >= 0) scene.hitboxes.splice(old, 1);
  scene.hitboxes.push({ id: l.id, x0: o.x, y0: o.y, x1: o.x + o.sprite.width, y1: o.y + o.sprite.height });
}

/** Sets out the province and everything on it, as the rules state has it right now. The land is painted as it comes into view. */
export function buildAdventureScene(map: MapModel, state: GameState): AdventureScene {
  const { province } = map;
  const scenery: Placed[] = [];
  const landmarks: Placed[] = [];
  const hitboxes: Hitbox[] = [];
  const pickups = new Map<string, Placed>();
  const sights = new Map<string, Placed>();
  const animated: Placed[] = [];
  const parts = new Map<string, Placed[]>();
  const partOf = (id: string, o: Placed) => parts.set(id, [...(parts.get(id) ?? []), o]);

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

  for (const l of state.locations) {
    const look = landmark(l);
    if (!look) continue;
    const o: Placed = { ...place(look.frames[0], l.at, look.foot), frames: look.frames.length > 1 ? look.frames : undefined };
    partOf(l.id, o);
    const vanishes = VANISHES.has(l.kind);
    if (vanishes) {
      if (!l.done) {
        pickups.set(l.id, o);
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
    landmarks.push(place(stoneBridge(Math.max(46, span + 18)), [cx * 8 + 4, cy * 8 + 4], 12));
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

  // The hero, in his background's figure, in a gold ring (see `heroFrames`).
  const figure = heroFrames(state.hero.background);
  const rig: HeroRig = { object: { ...place(figure.idle[0], state.hero.at, figure.foot), frames: figure.idle }, ...figure };
  if (state.hero.facing < 0) rig.object.frames = rig.idleLeft;
  view.animate(rig.object);
  return { view, fog, minimap, hero: rig, hitboxes, pickups, sights };
}

/**
 * The hero's frames on the map, in his background's figure. He fidgets now and then as he waits, as
 * his Wesnoth unit does (the Knight's pennant flutters; those Wesnoth gave no fidget just breathe).
 * A rider gallops when he rides; anyone on foot steps along, bobbing with each stride.
 */
function heroFrames(background: BackgroundId): Omit<HeroRig, 'object'> {
  const art = heroArtId(background);
  const still = troopFigure(art, 'blue', 1, STAND, 'map');
  const foot = -still.y;
  const fidget = animFrames(art, 'idle').length > 1 ? everyFrame(art, 'idle', 'blue', 1, 'map', 120) : Array<Bitmap>(4).fill(raised(still.sprite));
  // Still for at least half again as long as the fidget lasts, so it comes now and then.
  const idle = [...Array<Bitmap>(Math.max(16, Math.round(fidget.length * 1.5))).fill(still.sprite), ...fidget].map((f) => ringed(f, foot));
  const up = raised(still.sprite);
  const stride = [still.sprite, still.sprite, up, raised(up), raised(up), up];
  const walk = (animFrames(art, 'move').length > 1 ? everyFrame(art, 'move', 'blue', 1, 'map', 70) : stride).map((f) => ringed(f, foot));
  return { idle, walk, idleLeft: idle.map(mirror), walkLeft: walk.map(mirror), foot, head: bodyHeight(art, 'map') };
}

/** Puts the hero in another background's figure, where he stands: when the choice on the opening card changes who he was. */
export function setHeroFigure(scene: AdventureScene, background: BackgroundId, facing: 1 | -1) {
  const rig = scene.hero;
  const feet = rig.object.y + rig.foot;
  Object.assign(rig, heroFrames(background));
  rig.object.frames = facing < 0 ? rig.idleLeft : rig.idle;
  rig.object.sprite = rig.idle[0];
  rig.object.y = feet - rig.foot;
}
