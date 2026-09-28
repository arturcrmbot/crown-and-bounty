import type { BackgroundId } from '../content/backgrounds';
import { troopPower, TROOPS, type TroopId } from '../content/troops';
import { VANISHES, type Army, type GameState, type Location } from '../rules/game';
import type { Point } from '../rules/map/geometry';
import { Terrain, type MapModel } from '../rules/map/model';
import { AdventureScreen, type Placed } from './adventureScreen';
import { Bitmap, blit, SHADOW } from './bitmap';
import { FogMask } from './fog';
import { GOLD, INK, SILHOUETTE } from './palette';
import { animFrames, bodyHeight, everyFrame, STAND, troopFigure } from './battleSprites';
import { heroArtId } from './units';
import {
  abbey, boulder, camp,
  butts, cottage, castle, standingStones, chest, crag, goldPile, hideout, hut, mill, mine, mirror, oak, peatHut, pine, signpost, stiltHut, shrine, stoneBridge,
  watchtower, well, willow, windmill, xMark,
} from './sprites';
import { paintTerrain } from './terrain';

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
  hero: HeroRig;
  hitboxes: Hitbox[];
  /** Objects that vanish once their location is done: pickups and enemies. */
  pickups: Map<string, Placed>;
};

const place = (sprite: Bitmap, [x, y]: Point, footFromTop: number): Placed => ({ sprite, x: x - sprite.width / 2, y: y - footFromTop });

/** The troop that stands for a stack on the map: the one worth most, leaving out a lone villain. */
function leadTroop(army: Army): TroopId {
  const ranked = [...army].filter((s) => s.count > 0).sort((a, b) => b.count * troopPower(b.troop) - a.count * troopPower(a.troop));
  return (ranked.find((s) => TROOPS[s.troop].leadership < 99) ?? ranked[0]).troop;
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
    case 'stones':
      return { frames: [standingStones()], foot: 36, animated: false };
    case 'range':
      return { frames: [butts()], foot: 34, animated: false };
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
      const frames = [...Array<Bitmap>(fidget.length > 4 ? 24 : 14).fill(still.sprite), ...fidget];
      const turn = [...l.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % frames.length;
      return { frames: [...frames.slice(turn), ...frames.slice(0, turn)], foot: -still.y, animated: true };
    }
  }
}

/** The same sprite a pixel higher. */
function raised(sprite: Bitmap): Bitmap {
  const out = new Bitmap(sprite.width, sprite.height);
  out.data.set(sprite.data.subarray(sprite.width));
  return out;
}

/** The gold ring round the hero's feet that says he is the one you move: bright, with a dark edge. */
function ringed(sprite: Bitmap, foot: number): Bitmap {
  const out = new Bitmap(sprite.width, sprite.height + 6);
  out.data.set(sprite.data);
  const rx = Math.round(sprite.width * 0.36);
  const ry = Math.max(4, Math.round(rx * 0.26));
  for (const [grow, colour] of [[1, INK], [-1, GOLD[3]], [0, GOLD[6]]] as const) {
    for (let a = 0; a < Math.PI * 2; a += 0.005) {
      const x = Math.round(sprite.width / 2 + Math.cos(a) * (rx + grow));
      const y = Math.round(foot - 1 + Math.sin(a) * (ry + grow * 0.6));
      if (out.get(x, y) === 0 || out.get(x, y) === SHADOW || grow === 0 && (out.get(x, y) === INK || out.get(x, y) === GOLD[3])) out.set(x, y, colour);
    }
  }
  return out;
}

/** Puts a place on the map after the scene was built, like the X once the map is whole. */
export function addPlace(scene: AdventureScene, l: Location) {
  const look = landmark(l);
  if (!look) return;
  const o: Placed = { ...place(look.frames[0], l.at, look.foot), frames: look.frames.length > 1 ? look.frames : undefined };
  scene.view.animate(o);
  scene.pickups.set(l.id, o);
  scene.hitboxes.push({ id: l.id, x0: o.x, y0: o.y, x1: o.x + o.sprite.width, y1: o.y + o.sprite.height });
}

/** Paints the province and sets out everything on it, as the rules state has it right now. */
export function buildAdventureScene(map: MapModel, state: GameState): AdventureScene {
  const { province } = map;
  const terrain = paintTerrain(map);
  const scenery: Placed[] = [];
  const landmarks: Placed[] = [];
  const hitboxes: Hitbox[] = [];
  const pickups = new Map<string, Placed>();
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
    const o = place(hut(d.seed), d.at, 28);
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
    } else if (look.animated) animated.push(o);
    else landmarks.push(o);
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
  for (const o of [...scenery, ...landmarks].sort((a, b) => footY(a) - footY(b))) {
    blit(terrain.bitmap, o.sprite, Math.round(o.x), Math.round(o.y));
    blit(terrain.wild, isLandmark.has(o) ? silhouette(o.sprite) : o.sprite, Math.round(o.x), Math.round(o.y));
  }
  const fog = new FogMask(province.width, province.height, state.explored);
  const view = new AdventureScreen(terrain.bitmap, terrain.wild, fog);
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
  return { view, fog, hero: rig, hitboxes, pickups };
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
