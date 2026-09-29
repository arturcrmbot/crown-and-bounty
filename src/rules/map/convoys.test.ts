import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../../content/aldmoor';
import { apply, choose, endDay, fight, heroStats, locationById, wages, type Card, type GameState, type Result } from '../game';
import { newGame } from '../scenario';
import { pointAlong } from './convoys';
import { nearest, smooth, type Point } from './geometry';

const fresh = (): GameState => ({ ...newGame(1066, ALDMOOR, 'knight'), opening: undefined });
const cart = (state: GameState) => locationById(state, 'cart');
const patrol = (state: GameState) => locationById(state, 'patrol').enemy!.army;
/** The patrol on the bridge as the content has it, and the share of it that goes with the cart. */
const PATROL = ALDMOOR.locations.find((l) => l.id === 'patrol')!.enemy!.army;
const SHARE = ALDMOOR.locations.find((l) => l.id === 'cart')!.enemy!.convoy!.share;
const road = smooth(cart(fresh()).enemy!.convoy!.route);
/** How far along its road the cart stands, and how far off it. */
const along = (state: GameState) => nearest(road, cart(state).at[0], cart(state).at[1]);
const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const cardOf = (result: Result): Card => {
  const e = result.events.filter((x) => x.type === 'card').at(-1);
  if (!e || e.type !== 'card') throw new Error('no card');
  return e.card;
};

/** Days go by, with the hero kept where he is and out of every fight. */
function until(state: GameState, day: number, hold?: Point): { state: GameState; last: Result } {
  let last: Result = { state, events: [] };
  while (last.state.day < day) {
    last = endDay(last.state);
    last = { ...last, state: { ...last.state, ambush: undefined, ...(hold ? { hero: { ...last.state.hero, at: hold } } : {}) } };
  }
  return { state: last.state, last };
}

describe('the grain cart', () => {
  it('leaves Westmere every payday with a squad of Pike\u2019s patrol, and none before', () => {
    const start = fresh();
    expect(cart(start).done).toBe(true);
    expect(until(start, 7).state.locations.find((l) => l.id === 'cart')!.done).toBe(true);
    const { state, last } = until(start, 8);
    expect(cart(state).done).toBe(false);
    expect(cart(state).at).toEqual(cart(start).enemy!.convoy!.route[0]);
    const squad = PATROL.map((x) => ({ troop: x.troop, count: Math.round(x.count * SHARE) }));
    expect(cart(state).enemy!.army).toEqual(squad);
    // The squad comes from the bridge, which is that much weaker while it's out.
    expect(patrol(state)).toEqual(PATROL.map((x, i) => ({ troop: x.troop, count: x.count - squad[i].count })));
    expect(last.events.some((e) => e.type === 'added' && e.id === 'cart')).toBe(true);
    expect(cardOf(last).lines.join(' ')).toMatch(/loading the village\u2019s grain/);
  });

  it('keeps to the road over the bridge and through Darkwood, and its squad goes back to the bridge', () => {
    let { state } = until(fresh(), 8);
    let s = along(state).s;
    const patrolAt = locationById(state, 'patrol').at;
    for (let day = 9; !cart(state).done; day++) {
      expect(day, 'it reaches the stockade before the next payday').toBeLessThan(15);
      state = until(state, day).state;
      if (cart(state).done) break;
      const where = along(state);
      expect(where.d, `day ${day}: on the road`).toBeLessThan(2);
      expect(where.s, `day ${day}: going on`).toBeGreaterThan(s);
      expect(where.s - s).toBeLessThanOrEqual(cart(state).enemy!.convoy!.pace + 1);
      // It doesn't end a night on top of the patrol it passes on the bridge.
      expect(dist(cart(state).at, patrolAt)).toBeGreaterThanOrEqual(72);
      s = where.s;
    }
    expect(patrol(state)).toEqual(PATROL);
    // And it sets out again on the next payday.
    expect(cart(until(state, 15).state).done).toBe(false);
  });

  it('stops short of the hero standing in its road, where he can catch it, and the grain is his', () => {
    const start = fresh();
    const ahead = pointAlong(road, 240);
    const { state } = until({ ...start, hero: { ...start.hero, at: ahead } }, 9, ahead);
    const gap = dist(cart(state).at, ahead);
    expect(gap).toBeGreaterThanOrEqual(56);
    expect(gap).toBeLessThan(80);
    expect(along(state).s).toBeLessThan(240);
    const caught = fight({ ...state, army: [{ troop: 'knights', count: 30 }, { troop: 'archers', count: 40 }] }, 'cart')!;
    expect(cart(caught.state).done).toBe(true);
    expect(caught.state.rations).toBe(1);
    const card = cardOf(caught);
    expect(card.choices.map((c) => c.label)).toEqual(['Take it home to Westmere', 'Keep it for your men']);
    expect(card.lines.join(' ')).toMatch(/rations/);
    // The squad never goes back to the bridge.
    expect(patrol(caught.state)).toEqual(PATROL.map((x) => ({ troop: x.troop, count: x.count - Math.round(x.count * SHARE) })));
  });

  it('feeds the troops on payday instead of their wages, or goes home to Westmere for its volunteers', () => {
    const start = fresh();
    const ahead = pointAlong(road, 240);
    const { state } = until({ ...start, hero: { ...start.hero, at: ahead } }, 9, ahead);
    const caught = fight({ ...state, army: [{ troop: 'knights', count: 30 }, { troop: 'archers', count: 40 }] }, 'cart')!.state;
    // Kept: next payday, no wages.
    const before = until(caught, 14).state;
    const payday = until(before, 15);
    const hungry = until({ ...before, rations: 0 }, 15).state;
    expect(payday.state.gold - hungry.gold).toBe(Math.round(wages(before.army) * (1 + heroStats(before).wages)));
    expect(payday.state.rations).toBe(0);
    expect(cardOf(payday.last).lines.join(' ')).toMatch(/no wages/);
    // Eaten, the rations are gone: the payday after, wages as usual.
    expect(cardOf(until(payday.state, 22).last).lines.join(' ')).toMatch(/in wages/);
    // Given back: Westmere has more to recruit, its name is Aldric's, and the rations are gone.
    const peasants = locationById(caught, 'village').recruits!.count;
    const home = choose(caught, 'cart', 'grain/westmere')!;
    expect(locationById(home.state, 'village').recruits!.count).toBe(peasants + 30);
    expect(home.state.leadership).toBe(caught.leadership + 10);
    expect(home.state.rations).toBe(0);
    expect(cardOf(home).lines.join(' ')).toMatch(/Westmere/);
    // Either way, the question is answered once.
    expect(choose(home.state, 'cart', 'grain/keep')).toBeNull();
    const kept = choose(caught, 'cart', 'grain/keep')!.state;
    expect(kept.rations).toBe(1);
    expect(choose(kept, 'cart', 'grain/westmere')).toBeNull();
  });

  it('passes through Grimsby\u2019s own people on the road, but not the hero, and never ends a night on them', () => {
    const start = fresh();
    // Rook's wolves, off the leash, standing in the road past the bridge.
    const inRoad = pointAlong(road, 520);
    const { state } = until(start, 8);
    const blocked = { ...state, locations: state.locations.map((l) => (l.id === 'wolves' ? { ...l, at: inRoad, enemy: { ...l.enemy!, behaviour: 'guard' as const } } : l)) };
    const night1 = until(blocked, 9).state;
    const night2 = until(night1, 10).state;
    expect(along(night2).s).toBeGreaterThan(520);
    for (const s of [night1, night2]) expect(dist(cart(s).at, inRoad)).toBeGreaterThanOrEqual(72);
  });

  it('stops running once the patrol has gone from the bridge', () => {
    const start = fresh();
    const gone = { ...start, locations: start.locations.map((l) => (l.id === 'patrol' ? { ...l, done: true } : l)) };
    expect(cart(until(gone, 8).state).done).toBe(true);
    // One already on the road goes on to the stockade, and its squad has no bridge to go back to.
    const out = until(start, 8).state;
    let paidOff = apply(out, { type: 'choose', id: 'patrol', choice: 'parley/bribe' })!.state;
    expect(locationById(paidOff, 'patrol').done).toBe(true);
    for (let day = 9; !cart(paidOff).done; day++) paidOff = until(paidOff, day).state;
    expect(paidOff.day).toBeLessThan(15);
    expect(cart(until(paidOff, 15).state).done).toBe(true);
  });
});
