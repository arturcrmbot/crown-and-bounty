import { RELICS } from '../content/artifacts';
import type { Commission } from '../content/campaign';
import { SPELLS, type SpellId } from '../content/spells';
import type { Band, VillainTemplate } from '../content/villains';
import { troopPower, troops, type TroopId } from '../content/troops';
import type { Province } from '../content/types';
import { buildMap, CELL, gridWithEnemies, poolDistance, Terrain } from './map/model';
import { nearest, smooth, type Point } from './map/geometry';
import { APPROACH } from './map/movement';
import { findPath, nearestPassable, reachableNear } from './map/pathfinding';
import { rng } from './noise';
import type { Army, ContentChoice, Enemy, Location, Page } from './state';

const W = 40 * 32;
const H = 30 * 32;

/** How much stronger each generated commission is than the Fenmarch: a fifth again, and again. */
export const strengthFor = (chapter: number) => 1.2 ** (chapter - 1);

/** Words for generated places, by the lie of the land: a few of each to pick from. */
const WORDS = {
  heath: {
    castle: [['The King\u2019s castle in these parts, draughty but loyal.', 'Knights to recruit, and an armoury.'], ['The steward bows so low his hat falls off.', 'Knights to recruit, and an armoury.']],
    village: [['Shepherds, gossip, and a pie shop.'], ['Everyone here has an opinion about the Baron.']],
    tower: [['An old tower on a rise, full of pigeons.', '*The pigeons look like they know something.*']],
    towerDone: ['Pigeons, and nothing else.'],
    mine: [['The rails lead down into the dark. Something is clanking.']],
    mineVisit: ['A cart of ore nobody came back for: **{gold} gold**.'],
    mineDone: ['Nothing down there now but echoes.'],
    mineStash: ['A cart of ore nobody came back for, a good **{gold} gold** of it. And the rails go on down into the dark, where something glints.', '*The props are creaking. There\u2019s time for one of them.*'],
    mineGold: 'You push the cart out as the props give way behind you.',
    mineDeep: 'You climb down, find it, and climb back up as the props give way. Worth it.',
    deepLabel: 'Follow the rails down',
    towerFinds: ['At the top, a watcher\u2019s things: a **note** for the King\u2019s officer, and a **charm** scratched into the windowsill.', '*The pigeons are eating the note. Save it, or copy down the charm before the light goes: not both.*'],
    towerCharm: 'You copy it into your book. The pigeons finish the note.',
    mill: [['The sails creak round. The miller is singing, badly.']],
    millVisit: ['"Bread for the King\u2019s men!" Your troops eat well and march on.'],
    millDone: ['"Next week, officer. The wind has to rest too."'],
  },
  fen: {
    castle: [['The King\u2019s keep, sinking a little every year.', 'Knights to recruit, and an armoury.'], ['The castellan hands you a towel before you ask.', 'Knights to recruit, and an armoury.']],
    village: [['A village on stilts. The ducks outnumber the people.'], ['Eel pie, eel soup, and eel on toast.']],
    tower: [['A ruin on a hump of dry ground. Frogs sing in the cloister.', '*One of the frogs is humming a hymn.*']],
    towerDone: ['Just frogs now, and not very tuneful ones.'],
    mine: [['Peat stacked high, and a door off its hinges.']],
    mineVisit: ['A tin box of wages nobody came back for: **{gold} gold**.'],
    mineDone: ['The peat stacks lean in the wind.'],
    mineStash: ['A tin box of wages nobody came back for: **{gold} gold**. And under the floorboards, something wrapped in oilcloth.', '*The hut is sinking. There\u2019s time to save one of them.*'],
    mineGold: 'You wade out with the box as the floor goes under.',
    mineDeep: 'You fish it out as the floor goes under, and unwrap it on the bank.',
    deepLabel: 'Fish out the oilcloth',
    towerFinds: ['In the ruin, a watcher\u2019s things: a **note** for the King\u2019s officer, and a **charm** written in candle wax.', '*The damp is eating the note. Save it, or copy down the charm before the candle goes: not both.*'],
    towerCharm: 'You copy it down by the last of the candle. The damp finishes the note.',
    mill: [['It pumps the fen dry, one bucket at a time.']],
    millVisit: ['The miller opens every sluice, and your troops march on firm ground.'],
    millDone: ['"Come back next week. The fen came back first."'],
  },
};

/** Enemy strength in the Fenmarch, which generated commissions scale from. */
const BASE = { band: 760, guardian: 860, hideout: 1900 };

/** An army of about `power` fighting worth, split between troops by share. */
function armyOf(troops: [TroopId, number][], power: number): Army {
  return troops.map(([troop, share]) => ({ troop, count: Math.max(1, Math.round((power * share) / troopPower(troop))) }));
}

type Rand = () => number;
const pick = <T>(random: Rand, list: readonly T[]) => list[Math.floor(random() * list.length)];
const between = (random: Rand, a: number, b: number) => a + random() * (b - a);
/** Fisher-Yates, so the same seed gives the same order in every browser. */
function shuffle<T>(random: Rand, list: readonly T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** A road from a to b that wanders a little. */
function road(random: Rand, a: Point, b: Point): Point[] {
  const steps = Math.max(2, Math.round(dist(a, b) / 90));
  const [nx, ny] = [-(b[1] - a[1]) / (dist(a, b) || 1), (b[0] - a[0]) / (dist(a, b) || 1)];
  const bend = between(random, -0.18, 0.18) * dist(a, b);
  const points: Point[] = [a];
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const sway = Math.sin(t * Math.PI) * bend + between(random, -12, 12);
    points.push([a[0] + (b[0] - a[0]) * t + nx * sway, a[1] + (b[1] - a[1]) * t + ny * sway]);
  }
  points.push(b);
  return points;
}

/** A point `share` of the way along a road, by length. */
function along(path: Point[], share: number): Point {
  const fine = smooth(path);
  const lengths = fine.slice(1).map((p, i) => dist(p, fine[i]));
  let left = lengths.reduce((a, b) => a + b, 0) * share;
  for (let i = 0; i < lengths.length; i++) {
    if (left <= lengths[i]) {
      const t = left / lengths[i];
      return [Math.round(fine[i][0] + (fine[i + 1][0] - fine[i][0]) * t), Math.round(fine[i][1] + (fine[i + 1][1] - fine[i][1]) * t)];
    }
    left -= lengths[i];
  }
  return fine[fine.length - 1];
}

function enemy(band: Band, power: number, reward: number, bosses: TroopId[] = []): Enemy {
  const words: Enemy = { look: band.look, lines: band.lines, threat: band.threat, flees: band.flees, loot: band.loot, army: [...armyOf(band.troops, power), ...bosses.map((troop) => ({ troop, count: 1 }))], reward };
  if (band.charge) words.charge = band.charge;
  return words;
}

/**
 * Standing stones on the heath, or a drowned chapel in the fen, that teach one charm for gold and
 * another to anyone with the wits for it.
 */
function charmShrine(at: Point, fen: boolean, bought: SpellId, earned: SpellId, s: number): Location {
  const price = Math.round((250 * s) / 10) * 10;
  return {
    id: 'stones',
    kind: 'event',
    look: fen ? 'shrine' : 'stones',
    name: fen ? 'The Drowned Chapel' : 'The Humming Stones',
    at,
    done: false,
    text: { about: fen ? ['A chapel up to its windows in the mere. Candles still burn inside.'] : ['A ring of old standing stones. They hum when the wind drops.'] },
    pages: [
      {
        id: 'charms',
        lines: fen
          ? ['On the altar, two charms are written in candle wax. The collection box is suspiciously clean.']
          : ['The stones hum louder as you come near. Two charms are carved on the tallest, and under one of them, a slot the size of a coin.'],
        choices: [
          { id: 'buy', label: `Learn ${SPELLS[bought].name}`, needs: { gold: price, notSpell: bought }, effects: { spell: bought }, lines: ['The coins drop into the dark. The words come to you as if you had always known them.'] },
          { id: 'read', label: `Read ${SPELLS[earned].name}`, needs: { spellPower: 3, notSpell: earned }, effects: { spell: earned }, lines: ['It takes a clever head to read it, and you have one. The charm is yours.'] },
          { id: 'leave', label: 'Ride on', lines: [fen ? 'You leave the candles to burn.' : 'The humming follows you for a mile or so.'] },
        ],
      },
    ],
  };
}

/** The watcher's things at the tower: the note (where the villain hides, and their weakness) or a charm. */
function towerPage(v: VillainTemplate, hideout: Point, charm: SpellId): Page {
  const words = WORDS[v.land];
  return {
    id: 'watch',
    when: { notFlag: 'tower' },
    lines: words.towerFinds,
    choices: [
      { id: 'note', label: 'Save the note', effects: { reveal: { at: hideout, radius: 90 }, flags: { tower: 'note', weakness: true }, done: true }, lines: [v.towerClue, v.weakness.note] },
      { id: 'charm', label: `Copy down ${SPELLS[charm].name}`, needs: { notSpell: charm }, effects: { spell: charm, flags: { tower: 'charm' }, done: true }, lines: [words.towerCharm] },
    ],
  };
}

/** The mine's stash, or what lies deeper: a relic that teaches another hero's trick. */
function minePage(v: VillainTemplate, gold: number, relic: (typeof RELICS)[number]): Page {
  const words = WORDS[v.land];
  return {
    id: 'stash',
    when: { notFlag: 'mine' },
    lines: words.mineStash.map((line) => line.replace('{gold}', gold.toLocaleString('en-GB'))),
    choices: [
      { id: 'gold', label: 'Take the gold', effects: { treasure: gold, flags: { mine: 'gold' }, done: true }, lines: [words.mineGold] },
      { id: 'deep', label: words.deepLabel, needs: { notArtifact: relic }, effects: { artifact: relic, flags: { mine: 'deep' }, done: true }, lines: [words.mineDeep] },
    ],
  };
}

/** On the first visit, the miller offers his sons (the village's troops) or his old mum's charm. */
function millPage(v: VillainTemplate, count: number, charm: SpellId): Page {
  const sons = troops(v.village.troop, count);
  return {
    id: 'miller',
    when: { notFlag: 'miller' },
    lines: [`*"And for the King\u2019s officer, one thing, mind: my sons and their cousins, **${sons}**, if you can lead them, or my old mum\u2019s **${SPELLS[charm].name}** charm."*`],
    choices: [
      { id: 'sons', label: 'Take on his sons', effects: { troops: [{ troop: v.village.troop, count }], flags: { miller: 'sons' } }, lines: ['They turn up with their bows, a great many opinions and a basket of pies.'] },
      { id: 'charm', label: `Learn ${SPELLS[charm].name}`, needs: { notSpell: charm }, effects: { spell: charm, flags: { miller: 'charm' } }, lines: ['He teaches it to you between the millstones, shouting over the noise.'] },
    ],
  };
}

/** What the watcher's note makes possible at the hideout: some of the villain's troops slip away. */
function weaknessParley(v: VillainTemplate, s: number): ContentChoice {
  const w = v.weakness;
  return {
    id: 'weakness',
    label: w.label,
    needs: { flag: 'weakness', ...(w.gold ? { gold: Math.round((w.gold * s) / 10) * 10 } : {}) },
    effects: { desert: { troop: w.troop, share: w.share }, flags: { weakness: false } },
    lines: w.lines,
  };
}

/** One attempt at a province; the caller checks it can be played and tries again if not. */
function attempt(seed: number, v: VillainTemplate, chapter: number): Province {
  const random = rng(seed);
  const flipX = random() < 0.5;
  const flipY = random() < 0.5;
  const P = ([x, y]: Point): Point => [Math.round(flipX ? W - x : x), Math.round(flipY ? H - y : y)];
  const s = strengthFor(chapter);

  // A river runs down the middle about half the time; roads that cross it get bridges.
  const hasRiver = random() < 0.55;
  const riverX = between(random, 560, 760);
  const river: Point[] = hasRiver ? Array.from({ length: 12 }, (_, i) => [riverX + Math.sin(i * 0.9 + random() * 0.6) * 50 + between(random, -18, 18), -20 + i * 92] as Point) : [[-400, -400], [-400, -399]];
  const riverLine = smooth(river);
  const wet = (p: Point) => (hasRiver ? nearest(riverLine, p[0], p[1]).d : Infinity);
  /** Moves a place sideways, away from the river, if it stands too close. The river runs north to south, so a negative side is its east bank. */
  const dry = (p: Point): Point => {
    const d = wet(p);
    if (d >= 70) return p;
    const east = nearest(riverLine, p[0], p[1]).side < 0;
    return [Math.min(W - 90, Math.max(90, p[0] + (east ? 1 : -1) * (80 - d))), p[1]];
  };

  // Laid out with the hero top left and the villain bottom right, then flipped.
  const hero: Point = [between(random, 130, 230), between(random, 120, 200)];
  const hideout: Point = [between(random, W - 230, W - 150), between(random, H - 200, H - 150)];
  const castleNorth = random() < 0.5;
  const castle: Point = dry(castleNorth ? [between(random, 760, 1080), between(random, 150, 260)] : [between(random, 150, 280), between(random, 560, 760)]);
  const village: Point = dry(castleNorth ? [between(random, 200, 460), between(random, 560, 800)] : [between(random, 700, 1000), between(random, 170, 300)]);
  const tower: Point = dry([between(random, 520, 760), between(random, 380, 560)]);
  const mine: Point = dry(castleNorth ? [between(random, 1020, 1160), between(random, 360, 520)] : [between(random, 420, 620), between(random, 140, 240)]);
  const mill: Point = dry([village[0] + between(random, -140, 140), village[1] + (village[1] > 480 ? -1 : 1) * between(random, 90, 150)]);

  // Roads: each place joins the nearest one already on the network; the hideout comes last, as a spur.
  const nodes: Point[] = [hero, castle, village, tower, mine, mill];
  const joined: Point[] = [nodes[0]];
  const paths: Point[][] = [];
  for (const node of nodes.slice(1).sort((a, b) => dist(a, hero) - dist(b, hero))) {
    const from = joined.reduce((best, p) => (dist(p, node) < dist(best, node) ? p : best));
    paths.push(road(random, from, node));
    joined.push(node);
  }
  const gateFrom = joined.filter((p) => p !== hero).reduce((best, p) => (dist(p, hideout) < dist(best, hideout) ? p : best));
  const hideoutRoad = road(random, gateFrom, hideout);
  paths.push(hideoutRoad);

  const signpost = along(paths[0], 0.35);
  const guardianAt = along(hideoutRoad, Math.max(0.55, 1 - 150 / dist(gateFrom, hideout)));
  const bandSpots = paths.slice(0, -1).filter((p) => dist(p[0], p[p.length - 1]) > 260).map((p) => along(p, between(random, 0.45, 0.6)));
  const bands = bandSpots.filter((p) => dist(p, hero) > 200 && wet(p) > 40).slice(0, v.bands.length);

  const taken: Point[] = [hero, castle, village, tower, mine, mill, hideout, signpost, guardianAt, ...bands];
  const free = (p: Point, gap: number) => taken.every((q) => dist(p, q) > gap) && wet(p) > 50 && paths.every((path) => nearest(smooth(path), p[0], p[1]).d > 30);
  const spot = (gap: number): Point => {
    for (let i = 0; i < 60; i++) {
      const p: Point = [between(random, 80, W - 80), between(random, 90, H - 80)];
      if (free(p, gap) && dist(p, hideout) > 260) {
        taken.push(p);
        return p;
      }
    }
    return [between(random, 80, W - 80), between(random, 90, H - 80)];
  };
  const chests = [spot(130), spot(130), spot(130)];
  const sceptre = spot(150);
  const piles = [spot(120), spot(120)];

  // A wood rings the hideout, so the gatekeepers' road is the only way in.
  const forests: [number, number, number, number][] = [[hideout[0], hideout[1], 230, 200]];
  for (let i = 0; i < 6; i++) {
    const c = spot(160);
    forests.push([c[0], c[1], between(random, 60, 140), between(random, 50, 110)]);
  }
  const fen = v.land === 'fen';
  const pools: [number, number, number, number][] = [];
  if (fen) {
    for (let i = 0; i < 40 && pools.length < 9; i++) {
      const c: Point = [between(random, 80, W - 80), between(random, 80, H - 80)];
      const size: [number, number] = [between(random, 45, 120), between(random, 26, 60)];
      const pool: [number, number, number, number] = [c[0], c[1], size[0], size[1]];
      const probe: Province = { pools: [pool] } as Province;
      const clear = taken.every((q) => poolDistance(probe, q[0], q[1]) > 40) && paths.every((path) => smooth(path).every(([x, y]) => poolDistance(probe, x, y) > 16));
      if (clear) pools.push(pool);
    }
  }
  // Sprites are drawn in whole pixels.
  const crags: [number, number, number, number][] = [];
  if (!fen) {
    for (let i = 0; i < 4; i++) {
      const c = spot(120);
      crags.push([Math.round(c[0]), Math.round(c[1] + 20), Math.round(between(random, 50, 110)), Math.round(between(random, 36, 70))]);
    }
  }
  // Lone trees and boulders on the open ground, off the roads.
  const trees: [number, number, boolean][] = [];
  const rocks: [number, number, number][] = [];
  for (let i = 0; i < 26; i++) {
    const p: Point = [Math.round(between(random, 40, W - 40)), Math.round(between(random, 50, H - 30))];
    if (!free(p, 50) || poolDistance({ pools } as Province, p[0], p[1]) < 14) continue;
    if (i % 3 === 0) rocks.push([p[0], p[1], Math.round(between(random, 5, 9))]);
    else trees.push([p[0], p[1], !fen && random() < 0.4]);
  }

  // Extras roll their own dice, so adding them never moves anything drawn above.
  const extra = rng(seed ^ 0x51ed);
  const relic = pick(extra, RELICS);
  const forSale = pick(extra, ['crystalBall', 'silverSignet'] as const);
  // The stones teach the first two charms; the watcher at the tower and the miller know the next two.
  const charms = shuffle(extra, ['fireball', 'stoneskin', 'haste', 'slow', 'bless', 'bolt'] as SpellId[]);
  const [firstCharm, secondCharm, towerCharm, millCharm] = charms;
  const clearOf = (p: Point, areas: readonly [number, number, number, number][], room: number) => areas.every(([x, y, rx, ry]) => ((p[0] - x) / rx) ** 2 + ((p[1] - y) / ry) ** 2 > room);
  let stones: Point | null = null;
  for (let i = 0; i < 120 && !stones; i++) {
    const p: Point = [between(extra, 100, W - 100), between(extra, 110, H - 100)];
    if (free(p, 120) && dist(p, hideout) > 300 && dist(p, hero) > 220 && clearOf(p, forests, 1.4) && clearOf(p, crags, 2) && poolDistance({ pools } as Province, p[0], p[1]) > 30) stones = p;
  }

  // Finds roll dice of their own, after everything else, so they never move what was drawn above.
  const finds = rng(seed ^ 0xf1d5);
  const deepRelic = pick(finds, RELICS.filter((r) => r !== relic && r !== forSale));
  const guardian: Enemy = { ...enemy(v.guardian, BASE.guardian * s, Math.round(600 * s)), ...(v.parleys?.guardian ? { parleys: v.parleys.guardian } : {}) };
  const names = v.names;
  const words = WORDS[v.land];
  const at = (p: Point) => P(p);
  const bandLocations: Location[] = bands.map((p, i) => ({
    id: `band${i}`,
    kind: 'patrol',
    name: v.bands[i].name,
    at: at(p),
    done: false,
    // The first band roams its stretch of road; the second hunts anyone weaker who wanders near.
    enemy: { ...enemy(v.bands[i], BASE.band * s * (0.9 + i * 0.2), Math.round(400 * s)), behaviour: i === 0 ? 'roam' : 'hunt', range: i === 0 ? 130 : 160 },
  }));
  const locations: Location[] = [
    {
      id: 'castle',
      kind: 'castle',
      name: pick(random, names.castle),
      at: at(castle),
      done: false,
      text: { about: pick(random, words.castle) },
      recruits: { troop: 'knights', count: 6, price: 110 },
      wares: [...shuffle(random, ['harrowgateMail', 'fenBanner', 'astrolabe', 'swordOfAldmoor', 'breastplate', 'luckyHorseshoe'] as const).slice(0, 3), forSale],
    },
    { id: 'village', kind: 'village', name: pick(random, names.village), at: at(village), done: false, recruits: { ...v.village }, text: { about: pick(random, words.village) } },
    { id: 'tower', kind: 'tower', ...(fen ? { look: 'abbey' as const } : {}), name: pick(random, names.tower), at: at(tower), done: false, text: { about: pick(random, words.tower), done: words.towerDone }, pages: [towerPage(v, at(hideout), towerCharm)] },
    { id: 'mine', kind: 'mine', ...(fen ? { look: 'peathut' as const } : {}), name: pick(random, names.mine), at: at(mine), done: false, text: { about: pick(random, words.mine), done: words.mineDone }, pages: [minePage(v, Math.round(500 * s), deepRelic)] },
    { id: 'mill', kind: 'mill', look: 'windmill', name: pick(random, names.mill), at: at(mill), done: false, text: { about: pick(random, words.mill), visit: words.millVisit, done: words.millDone }, pages: [millPage(v, Math.round(10 * s), millCharm)] },
    { id: 'signpost', kind: 'signpost', name: 'Signpost', at: at(signpost), done: false, text: { about: [`**THIS WAY:** ${v.villain}, probably. Somebody has added *"DON\u2019T"* in charcoal.`] } },
    ...chests.map((p, i): Location => ({ id: `chest${i}`, kind: 'chest', name: 'Treasure Chest', at: at(p), done: false, gold: Math.round((500 + i * 150) * s) })),
    ...piles.map((p, i): Location => ({ id: `gold${i}`, kind: 'gold', name: 'Pile of Gold', at: at(p), done: false, gold: Math.round((300 + i * 150) * s) })),
    ...bandLocations,
    {
      id: 'guardian',
      kind: 'patrol',
      name: v.guardian.name,
      at: at(guardianAt),
      done: false,
      // The gatekeepers carry a relic: a reason to fight them, not just a door.
      artifact: relic,
      enemy: { ...guardian, lines: [...guardian.lines, '*Something glints in their baggage.*'] },
    },
    ...(stones ? [charmShrine(at(stones), fen, firstCharm, secondCharm, s)] : []),
    {
      id: 'hideout',
      kind: 'hideout',
      ...(v.hideout.placeLook ? { look: v.hideout.placeLook } : {}),
      name: v.hideout.name,
      at: at(hideout),
      done: false,
      enemy: { ...enemy(v.hideout, BASE.hideout * s, Math.round(3000 * s), v.hideout.bosses), grows: 0.05, parleys: [weaknessParley(v, s), ...(v.parleys?.hideout ?? [])] },
      text: { done: v.hideout.done },
    },
  ];
  const hutSpots: Point[] = [];
  for (let k = 0; k < 24 && hutSpots.length < 4; k++) {
    const a = k * 0.83 + random() * 0.3;
    const p: Point = [village[0] + Math.cos(a) * (40 + (k % 3) * 8), village[1] + Math.sin(a) * (24 + (k % 3) * 6) - 6];
    const clear = paths.every((path) => nearest(smooth(path), p[0], p[1]).d > 16) && wet(p) > 30 && poolDistance({ pools } as Province, p[0], p[1]) > 16 && hutSpots.every((q) => dist(p, q) > 26);
    if (clear) hutSpots.push(p);
  }
  const huts = hutSpots.map((p, i) => ({ sprite: 'hut' as const, at: at(p), place: 'village', seed: 30 + i }));

  const flip = (list: Point[]) => list.map(at);
  const provinceName = pick(random, names.province);
  return {
    id: `generated-${chapter}-${seed}`,
    name: provinceName,
    width: W,
    height: H,
    river: flipY ? flip(river).reverse() : flip(river),
    cliff: null,
    paths: paths.map(flip),
    forests: forests.map(([x, y, rx, ry]) => [...at([x, y]), rx, ry] as [number, number, number, number]),
    pools: pools.map(([x, y, rx, ry]) => [...at([x, y]), rx, ry] as [number, number, number, number]),
    woods: fen ? { pine: 0.3, willow: 0.6 } : { pine: 0.7, willow: 0 },
    fen,
    crags: crags.map(([x, y, w, h]) => [...at([x, y]), w, h] as [number, number, number, number]),
    trees: trees.map(([x, y, pine]) => [...at([x, y]), pine] as [number, number, boolean]),
    rocks: rocks.map(([x, y, size]) => [...at([x, y]), size] as [number, number, number]),
    decor: huts,
    hero: at(hero),
    sceptre: at(sceptre),
    explored: { trails: [flip(paths[0])], trailRadius: 120, discs: [[...at(hero), 190], [...at(castle), 150]] },
    locations,
  };
}

/**
 * Whether a province can be played: the castle and village are open from the start, everything
 * else once the bands are beaten, and the hideout only past its gatekeepers.
 */
export function playable(province: Province): boolean {
  const map = buildMap(province);
  const cell = ([x, y]: Point) => ({ x: Math.floor(x / CELL), y: Math.floor(y / CELL) });
  const start = nearestPassable(map.grid, cell(province.hero), 2);
  if (!start) return false;
  // As the hero rides: places by the nearest open cell, enemies from his own side of them.
  const reach = (standing: Set<string>, place: Location) => {
    const grid = gridWithEnemies(map, province.locations.filter((l) => standing.has(l.id)));
    const goal = place.enemy ? reachableNear(grid, start, cell(place.at), APPROACH) : nearestPassable(grid, cell(place.at), 16);
    return goal !== null && findPath(grid, start, goal) !== null;
  };
  const enemies = province.locations.filter((l) => l.enemy && l.kind !== 'hideout').map((l) => l.id);
  const all = new Set(enemies);
  const onlyGuardian = new Set(['guardian']);
  const hideout = province.locations.find((l) => l.kind === 'hideout')!;
  for (const l of province.locations) {
    if (l.kind === 'hideout') continue;
    if ((l.kind === 'castle' || l.kind === 'village') && !reach(all, l)) return false;
    if (!reach(onlyGuardian, l)) return false;
  }
  // A bridge is where a road crosses water, not a road that runs along it.
  const bridges = new Set([...map.terrain.keys()].filter((i) => map.terrain[i] === Terrain.Bridge));
  for (const first of bridges) {
    const group = [first];
    bridges.delete(first);
    for (let k = 0; k < group.length; k++) {
      for (const n of [group[k] - 1, group[k] + 1, group[k] - map.width, group[k] + map.width, group[k] - map.width - 1, group[k] - map.width + 1, group[k] + map.width - 1, group[k] + map.width + 1]) {
        if (bridges.delete(n)) group.push(n);
      }
    }
    const xs = group.map((i) => i % map.width);
    const ys = group.map((i) => Math.floor(i / map.width));
    if (Math.max(...ys) - Math.min(...ys) > 4 || Math.max(...xs) - Math.min(...xs) > 9) return false;
  }
  // Nothing stands in the water.
  for (const l of province.locations) if (map.terrain[Math.floor(l.at[1] / CELL) * map.width + Math.floor(l.at[0] / CELL)] === Terrain.Water) return false;
  const sceptre: Location | null = province.sceptre ? { id: 'sceptre', kind: 'dig', name: 'X', at: province.sceptre, done: false } : null;
  if (sceptre && !reach(new Set(), sceptre)) return false;
  return !reach(onlyGuardian, hideout) && reach(new Set(), hideout);
}

/** A commission in a generated province: the villain's words, with a map that has been checked. */
export function generateCommission(seed: number, v: VillainTemplate, chapter: number): Commission {
  for (let tries = 0; tries < 60; tries++) {
    const province = attempt(seed + tries * 7919, v, chapter);
    if (playable(province)) {
      return { province, villain: v.villain, brief: v.brief, surrender: v.surrender, homecoming: v.homecoming, timeout: v.timeout, praise: v.praise, arrival: v.arrival, reward: Math.round(2500 * strengthFor(chapter)) };
    }
  }
  throw new Error(`No playable province for seed ${seed}`);
}
