import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../../content/aldmoor';
import { FENMARCH } from '../../content/fenmarch';
import { apply, endDay, heroStats, locationById, type GameState, type Location } from '../game';
import { beginCommission, newGame } from '../scenario';
import { gridSize, isExplored } from './fog';
import type { Point } from './geometry';
import { buildMap } from './model';
import { planRoute, stepAlong } from './movement';
import { look, loseSight, seeBands } from './sight';

const aldmoor = (): GameState => ({ ...newGame(3, ALDMOOR, 'knight'), opening: undefined });
const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const map = buildMap(ALDMOOR);

/** The cells the hero has seen. */
function seen(s: GameState): number[] {
  const { width, height } = gridSize(s.world);
  const out: number[] = [];
  for (let i = 0; i < width * height; i++) if (isExplored(s.explored, i)) out.push(i);
  return out;
}

/** Deals with whatever fell on the camp, the sergeants' way. */
const settle = (s: GameState) => (s.ambush ? apply(s, { type: 'choose', id: s.ambush, choice: 'auto' })!.state : s);

/** Rides towards `to` as far as today's legs go (or all the way, with `legs`). */
function ride(s: GameState, to: Point, approach = false, legs?: number): GameState {
  if (legs) s = { ...s, movement: legs };
  let route = planRoute(s, map, to, approach) ?? [];
  for (let step = stepAlong(s, map, route); step; step = stepAlong(s, map, route)) {
    s = step.state;
    route = route.slice(1);
  }
  return s;
}

/** A band on the move, somewhere out of the way, with its whereabouts known or not. */
const band = (id: string, at: Point, more: Partial<Location['enemy']> = {}): Location => ({
  id,
  kind: 'patrol',
  name: id,
  at,
  done: false,
  enemy: { look: 'wolves', behaviour: 'roam', lines: [], army: [{ troop: 'wolves', count: 5 }], reward: 10, threat: '', flees: '', loot: '', ...more },
});
const withBands = (s: GameState, ...bands: Location[]): GameState => ({ ...s, locations: [...s.locations, ...bands] });
const unseen = (s: GameState, id: string) => Boolean(locationById(s, id).enemy!.unseen);

describe('land the hero has seen', () => {
  it('stays explored for the rest of the commission: through days, nights, fights, and a save and a load', () => {
    let s = aldmoor();
    const known = new Set(seen(s));
    const lost = () => [...known].filter((i) => !isExplored(s.explored, i));
    const days: Point[] = [[2532, 884], [2104, 1392], [2262, 1846], [2800, 1500], [1880, 1456], [2910, 650]];
    for (const to of days) {
      s = ride(s, to);
      expect(lost(), `riding to ${to}`).toEqual([]);
      for (const i of seen(s)) known.add(i);
      s = settle(endDay(s).state);
      expect(lost(), `the night after day ${s.day - 1}`).toEqual([]);
    }
    // A fight, won or lost: he comes back to the map with everything he'd seen.
    s = ride(s, locationById(s, 'boars').at, true, 2000);
    for (const i of seen(s)) known.add(i);
    s = apply(s, { type: 'choose', id: 'boars', choice: 'auto' })!.state;
    expect(lost(), 'after the boars').toEqual([]);
    // A save is the rules state as JSON, and so is what he has seen.
    s = JSON.parse(JSON.stringify(s)) as GameState;
    expect(lost(), 'after a save and a load').toEqual([]);
    expect(known.size).toBeGreaterThan(seen(aldmoor()).length * 2);
  });
});

describe('bands out of sight', () => {
  it('a band that moves in the night where he can\u2019t see it is out of sight; one that moves within sight of his camp is seen', () => {
    const s = aldmoor();
    const sight = heroStats(s).sight;
    const [hx, hy] = s.hero.at;
    const before = withBands(s, band('far', [hx - 600, hy]), band('near', [hx - 400, hy]), band('still', [hx - 500, hy]));
    const after: GameState = {
      ...before,
      locations: before.locations.map((l) => (l.id === 'far' ? { ...l, at: [hx - 640, hy] } : l.id === 'near' ? { ...l, at: [hx - sight + 20, hy] } : l)),
    };
    const dawn = loseSight(before, after);
    expect(unseen(dawn, 'far')).toBe(true);
    expect(unseen(dawn, 'near')).toBe(false);
    // One that stayed put is where he saw it; guards and places are never out of sight.
    expect(unseen(dawn, 'still')).toBe(false);
    expect(dawn.locations.filter((l) => l.enemy?.unseen).map((l) => l.id)).toEqual(['far']);
    // Out of sight it stays, until he sees it: moving again doesn't bring it back.
    const later = { ...dawn, locations: dawn.locations.map((l) => (l.id === 'far' ? { ...l, at: [hx - 660, hy] as Point } : l)) };
    expect(unseen(loseSight(dawn, later), 'far')).toBe(true);
    expect(unseen(loseSight(dawn, { ...dawn }), 'far')).toBe(true);
  });

  it('a band that comes out in the night is out of sight too, unless it\u2019s on his trail: the dawn tells him, and he sees it', () => {
    const s = aldmoor();
    const [hx, hy] = s.hero.at;
    const before = withBands(s, { ...band('wagon', [hx - 700, hy]), done: true });
    const after = withBands(s, band('wagon', [hx - 700, hy]), band('baron', [hx - 900, hy], { behaviour: 'hunt', trailing: true }), band('sortie', [hx - 900, hy + 120]));
    const dawn = loseSight(before, after);
    expect(unseen(dawn, 'wagon')).toBe(true);
    expect(unseen(dawn, 'sortie')).toBe(true);
    expect(unseen(dawn, 'baron')).toBe(false);
  });

  it('is seen at dawn when it\u2019s on his trail, even if it couldn\u2019t take a step tonight, and so is anything standing by it', () => {
    const s = aldmoor();
    const [hx, hy] = s.hero.at;
    const before = withBands(s, band('stuck', [hx - 600, hy], { behaviour: 'hunt', unseen: true }), band('beside', [hx - 630, hy], { unseen: true }), band('off', [hx - 700, hy], { unseen: true }));
    const after = { ...before, locations: before.locations.map((l) => (l.id === 'stuck' ? { ...l, enemy: { ...l.enemy!, trailing: true } } : l)) };
    const dawn = loseSight(before, after);
    expect(unseen(dawn, 'stuck')).toBe(false);
    expect(unseen(dawn, 'beside')).toBe(false);
    expect(unseen(dawn, 'off')).toBe(true);
    // In play: a bold hunter that can't find a step it may take tonight still picks up the trail, and the dawn shows it.
    const [x, y] = s.hero.at;
    const hunter = band('hunter', [x - 170, y], { behaviour: 'hunt', bold: true, sight: 400, range: 100, home: [x, y], unseen: true });
    const night = endDay(withBands(s, hunter));
    expect(night.events.some((e) => e.type === 'enemyMoved' && e.id === 'hunter')).toBe(false);
    expect(locationById(night.state, 'hunter').enemy!.trailing).toBe(true);
    expect(unseen(night.state, 'hunter')).toBe(false);
  });

  it('comes back on the map as soon as he rides within sight of it, and not before', () => {
    let s = aldmoor();
    const boars = locationById(s, 'boars');
    s = { ...s, locations: s.locations.map((l) => (l.id === 'boars' ? { ...l, enemy: { ...l.enemy!, unseen: true } } : l)) };
    const sight = heroStats(s).sight;
    let route = planRoute(s, map, boars.at, true)!;
    s = { ...s, movement: 5000 };
    let stepped = 0;
    for (let step = stepAlong(s, map, route); step; step = stepAlong(s, map, route)) {
      s = step.state;
      route = route.slice(1);
      stepped++;
      expect(unseen(s, 'boars'), `${Math.round(dist(s.hero.at, boars.at))} away`).toBe(dist(s.hero.at, boars.at) > sight);
    }
    expect(stepped).toBeGreaterThan(20);
    expect(unseen(s, 'boars')).toBe(false);
  });

  it('is seen wherever the mist lifts, and seeing changes nothing when nobody is out of sight', () => {
    const s = withBands(aldmoor(), band('lost', [1000, 1000], { unseen: true }), band('other', [1400, 1000], { unseen: true }));
    const lifted = look(s, [1010, 1000], 90).state;
    expect(unseen(lifted, 'lost')).toBe(false);
    expect(unseen(lifted, 'other')).toBe(true);
    expect(isExplored(lifted.explored, Math.floor(1000 / 8) * gridSize(s.world).width + Math.floor(1000 / 8))).toBe(true);
    // Nothing to see: the very same state, so the walk grid's caches hold.
    const none = aldmoor();
    expect(seeBands(none, none.hero.at, 5000)).toBe(none);
  });

  it('in play: the poachers roam out of sight at night while he is far off, and a hunter on his trail is seen at dawn', () => {
    let s = aldmoor();
    let moved = false;
    for (let night = 0; night < 12 && !moved; night++) {
      const dawn = endDay(s);
      s = dawn.state;
      moved = dawn.events.some((e) => e.type === 'enemyMoved' && e.id === 'poachers');
    }
    expect(moved).toBe(true);
    expect(dist(locationById(s, 'poachers').at, s.hero.at)).toBeGreaterThan(heroStats(s).sight);
    expect(unseen(s, 'poachers')).toBe(true);
    // Guards never move: Pike's patrol is always where he saw it.
    expect(unseen(s, 'patrol')).toBe(false);
    // In the Fenmarch the goblins pick up the trail of a weak hero: he is told at dawn, and sees them.
    const fen = beginCommission(FENMARCH, 3, { ...newGame().campaign.start, army: [{ troop: 'peasants', count: 10 }] }, 1, []);
    const first = endDay({ ...fen, hero: { ...fen.hero, at: [470, 590] } }).state;
    expect(locationById(first, 'goblins').enemy!.trailing).toBe(true);
    expect(unseen(first, 'goblins')).toBe(false);
  });

  it('with scouts shadowing every band, he sees them all at dawn', () => {
    const s = aldmoor();
    const far = withBands(s, band('lost', [900, 1800], { unseen: true }));
    const scout = { ...far, hero: { ...far.hero, skills: { ...far.hero.skills, scouting: 3 } } };
    expect(unseen(endDay(far).state, 'lost')).toBe(true);
    expect(unseen(endDay(scout).state, 'lost')).toBe(false);
  });
});
