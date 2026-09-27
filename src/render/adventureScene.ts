import { troopPower, TROOPS, type TroopId } from '../content/troops';
import { VANISHES, type Army, type GameState, type Location } from '../rules/game';
import type { Point } from '../rules/map/geometry';
import { Terrain, type MapModel } from '../rules/map/model';
import { AdventureScreen, type Placed } from './adventureScreen';
import { Bitmap, blit, SHADOW } from './bitmap';
import { FogMask } from './fog';
import { SILHOUETTE } from './palette';
import { figureFoot, troopFigure } from './battleSprites';
import {
  abbey, boulder, castle, chest, crag, goldPile, hero, hideout, hut, mill, mine, mirror, oak, peatHut, pine, signpost, stiltHut, shrine, stoneBridge,
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
  /** Pixels from the sprite's top to the hooves. */
  foot: number;
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
  }
  switch (l.kind) {
    case 'castle':
      return { frames: animation((t) => castle(t * Math.PI * 2)), foot: 104, animated: true };
    case 'tower':
      return { frames: [watchtower(0.2)], foot: 74, animated: false };
    case 'mine':
      return { frames: [mine()], foot: 44, animated: false };
    case 'village':
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
      // One creature stands for the stack, HoMM2 style, at the same scale as everything else.
      const lead = leadTroop(l.enemy!.army);
      const idle = troopFigure(lead, -1, 'idle', 'map');
      const step = troopFigure(lead, -1, 'step', 'map');
      return { frames: [idle, idle, idle, idle, step, step, idle, idle], foot: figureFoot(lead, 'map'), animated: true };
    }
  }
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

  const idle = animation((t) => hero(t * Math.PI * 2));
  const walk = animation((t) => hero(t, true, true));
  const rig: HeroRig = { object: { ...place(idle[0], state.hero.at, 57), frames: idle }, idle, walk, idleLeft: idle.map(mirror), walkLeft: walk.map(mirror), foot: 57 };
  if (state.hero.facing < 0) rig.object.frames = rig.idleLeft;
  view.animate(rig.object);
  return { view, fog, hero: rig, hitboxes, pickups };
}
