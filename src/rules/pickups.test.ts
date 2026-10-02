import { describe, expect, it } from 'vitest';
import { ALDMOOR, landOf, LANDS, type Land } from '../content/aldmoor';
import { PICKUPS } from '../content/aldmoorPickups';
import { heardOf, withNewPlaces } from './campaign';
import { playCommission } from './bot';
import { describe as describePlace, heroStats, visit, type GameState, type Location } from './game';
import { buildMap, CELL } from './map/model';
import { mapOf } from './map/maps';
import { planRoute, stepAlong } from './map/movement';
import { foundOf } from './heroSheet';
import { pickUp, REACH } from './places/pickup';
import { newGame } from './scenario';

const fresh = (): GameState => ({ ...newGame(1066, ALDMOOR, 'knight'), opening: undefined });
const placeOf = (state: GameState, id: string) => state.locations.find((l) => l.id === id)!;

/** Rides the hero step by step to `to`, the rules' own way, and gathers what each step said. */
function rideTo(state: GameState, to: readonly [number, number]) {
  const map = mapOf(state);
  let route = planRoute(state, map, [to[0], to[1]])!;
  const events = [];
  let s = { ...state, movement: 10_000 };
  while (route.length) {
    const step = stepAlong(s, map, route)!;
    s = step.state;
    events.push(...step.events);
    route = route.slice(1);
  }
  return { state: s, events };
}

describe('things lying by the way (#192)', () => {
  it('are taken in passing, with no card, no stop and no experience for finding them', () => {
    const start = fresh();
    const purse = placeOf(start, 'purseKingsRoad');
    // The first thing on the King's road: he rides past it on his way to the castle.
    const { state, events } = rideTo(start, [2900, 990]);
    expect(placeOf(state, purse.id).done).toBe(true);
    expect(events).toContainEqual({ type: 'picked', id: purse.id });
    expect(events).toContainEqual({ type: 'removed', id: purse.id });
    expect(events.some((e) => e.type === 'card')).toBe(false);
    expect(state.gold).toBe(start.gold + purse.gives!.treasure!);
    expect(state.hero.xp).toBe(start.hero.xp);
  });

  it('lie out of reach unless he rides close by', () => {
    const start = fresh();
    const map = mapOf(start);
    const purse = placeOf(start, 'purseKingsRoad');
    const route = planRoute(start, map, [3200, 1100])!;
    // A step that ends further than its reach from the purse leaves it lying.
    const far = route.findIndex((cell) => {
      const [x, y] = [(cell % map.width) * CELL + 4, Math.floor(cell / map.width) * CELL + 4];
      return Math.hypot(x - purse.at[0], y - purse.at[1]) > REACH;
    });
    const step = stepAlong(start, map, route.slice(far))!;
    expect(placeOf(step.state, purse.id).done).toBe(false);
  });

  it('give what they say: movement for today, mana up to his most, experience', () => {
    const start = fresh();
    const oats = placeOf(start, 'oatsKingsRoad');
    const taken = visit(start, oats.id);
    expect(taken.state.movement).toBe(start.movement + 20);
    const crystals = placeOf(start, 'crystalsFord');
    const low = { ...start, hero: { ...start.hero, mana: 0 } };
    expect(visit(low, crystals.id).state.hero.mana).toBe(5);
    const letter = placeOf(start, 'letterBaron');
    expect(visit(start, letter.id).state.hero.xp).toBe(start.hero.xp + 25);
    // Ridden up to once it's gone, there's nothing left to say.
    expect(visit(taken.state, oats.id).events).toEqual([]);
  });

  it('a lost letter puts its words in the journal, and the journal keeps a tally of what was picked up', () => {
    const start = fresh();
    // Picked up in passing, it stops nobody: the journal quotes it as it was written.
    const picked = visit(start, 'letterPike');
    expect(picked.events.some((e) => e.type === 'card')).toBe(false);
    expect(placeOf(start, 'letterPike').text?.visit?.join(' ')).toContain('Dear Mum, I am a sergeant now');
    const read = picked.state;
    const heard = heardOf(read).map((h) => h.who);
    expect(heard.some((who) => who.includes('young Pike'))).toBe(true);
    expect(heardOf(start).some((h) => h.who.includes('young Pike'))).toBe(false);
    expect(foundOf(read)).toContainEqual({ what: 'Things picked up by the way', got: 1, of: PICKUPS.length });
  });

  it('the bot picks them up as it rides, as a player does', () => {
    const start = { ...newGame(3, ALDMOOR, 'knight'), opening: undefined };
    const run = playCommission(start, mapOf(start), 4000, { allow: (l) => l.kind !== 'hideout', stop: (s) => s.day > 3 });
    expect(run.state.locations.filter((l) => l.kind === 'pickup' && l.done).length).toBeGreaterThan(0);
  }, 60_000);

  it('crystals wait for him while his mana is full, and he takes them once he has room (#211)', () => {
    const start = fresh();
    const crystals = placeOf(start, 'crystalsFord');
    const full: GameState = { ...start, hero: { ...start.hero, mana: heroStats(start).maxMana } };
    // Riding past, he leaves them lying.
    const passed = pickUp(full, crystals.at);
    expect(passed.events).toEqual([]);
    expect(placeOf(passed.state, crystals.id).done).toBe(false);
    // Their card says why, and still lets him ride there, as to any spot on the map (#226).
    const about = describePlace(full, crystals.id);
    expect(about.lines.at(-1)).toContain('Your mana is full already');
    expect(about.choices.map((c) => c.label)).toEqual(['Ride there', 'Close']);
    expect(about.choices[0].action).toEqual({ type: 'go', id: crystals.id });
    // Ridden to on purpose, he says so there, and leaves them.
    const ridden = visit(full, crystals.id);
    expect(placeOf(ridden.state, crystals.id).done).toBe(false);
    expect(ridden.events.some((e) => e.type === 'card' && e.card.lines[0].startsWith('Your mana is full already'))).toBe(true);
    // With room for them, he takes them as he passes.
    const low: GameState = { ...full, hero: { ...full.hero, mana: 0 } };
    expect(placeOf(pickUp(low, crystals.at).state, crystals.id).done).toBe(true);
    expect(describePlace(low, crystals.id).choices.map((c) => c.label)).toEqual(['Pick them up', 'Close']);
    // Anything else lying by the way he takes whatever his mana.
    const purse = placeOf(full, 'purseKingsRoad');
    expect(placeOf(pickUp(full, purse.at).state, purse.id).done).toBe(true);
  });

  it('reach a saved game from before them', () => {
    const played = fresh();
    const old = { ...played, locations: played.locations.filter((l) => l.kind !== 'pickup') };
    const loaded = withNewPlaces(JSON.parse(JSON.stringify(old)));
    expect(loaded.locations.filter((l) => l.kind === 'pickup').map((l) => l.id).sort()).toEqual(PICKUPS.map((l) => l.id).sort());
  });
});

describe('Aldmoor\u2019s things lying by the way', () => {
  const map = buildMap(ALDMOOR);
  const places = ALDMOOR.locations.filter((l) => l.kind !== 'pickup');
  const passable = (x: number, y: number) => map.grid.cost[Math.floor(y / CELL) * map.width + Math.floor(x / CELL)] < Infinity;

  it('are about thirty, a little of everything, in every land, and little gold', () => {
    expect(PICKUPS.length).toBeGreaterThanOrEqual(28);
    expect(PICKUPS.length).toBeLessThanOrEqual(40);
    for (const land of Object.keys(LANDS) as Land[]) expect(PICKUPS.filter((p) => landOf(p.at) === land).length, LANDS[land]).toBeGreaterThanOrEqual(3);
    for (const look of ['purse', 'oats', 'crystals', 'letter']) expect(PICKUPS.some((p) => p.look === look), look).toBe(true);
    const gold = PICKUPS.reduce((sum, p) => sum + (p.gives?.gold ?? 0) + (p.gives?.treasure ?? 0), 0);
    expect(gold).toBeLessThanOrEqual(300);
    // Never a lasting gift, a spell or gear: those are for places worth stopping for.
    for (const p of PICKUPS) expect(Object.keys(p.gives ?? {}).every((k) => ['treasure', 'movement', 'mana', 'xp'].includes(k)), p.id).toBe(true);
  });

  it('each lies where a rider passes within reach of it, clear of every place and of each other', () => {
    for (const p of PICKUPS) {
      const near = (r: number) => [...Array(9).keys()].some((i) => passable(p.at[0] + Math.cos(i) * r, p.at[1] + Math.sin(i) * r));
      expect(passable(p.at[0], p.at[1]) || near(REACH / 2), p.id).toBe(true);
      for (const other of places) expect(Math.hypot(other.at[0] - p.at[0], other.at[1] - p.at[1]), `${p.id} and ${other.id}`).toBeGreaterThan(60);
      for (const other of PICKUPS) if (other !== p) expect(Math.hypot(other.at[0] - p.at[0], other.at[1] - p.at[1]), `${p.id} and ${other.id}`).toBeGreaterThan(100);
    }
  });

  it('every lost letter has its words in the journal', () => {
    const letters: Location[] = PICKUPS.filter((p) => p.look === 'letter');
    const all = letters.reduce((s, l) => visit(s, l.id).state, fresh());
    expect(heardOf(all).length - heardOf(fresh()).length).toBe(letters.length);
  });
});
