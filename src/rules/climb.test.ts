import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../content/aldmoor';
import { leads } from '../content/troops';
import { BAND_GROWTH } from './days';
import { battleXp, TEACHES } from './fight';
import { armyPower, endDay, locationById, type GameState } from './game';
import { buildMap, CELL } from './map/model';
import { nearestPassable, reachFrom } from './map/pathfinding';
import { newGame } from './scenario';
import type { Location } from './state';

/** The fifteen bands of #239's design, ring by ring, with the hero who leads each band of men. */
const TABLE: Record<string, { ring: number; hero?: [string, number] }> = {
  cutpurses: { ring: 1, hero: ['cutpurseCaptain', 1] },
  poachers: { ring: 2, hero: ['poacherCaptain', 2] },
  rustlers: { ring: 2, hero: ['highwaymanCaptain', 2] },
  collectors: { ring: 2, hero: ['sergeant', 2] },
  boars: { ring: 2 },
  chaseBoars: { ring: 3 },
  bears: { ring: 3 },
  outlaws: { ring: 3, hero: ['highwaymanCaptain', 4] },
  patrol: { ring: 3, hero: ['pike', 5] },
  highwaymen: { ring: 4, hero: ['highwaymanCaptain', 5] },
  heathWolves: { ring: 4 },
  diggings: { ring: 4, hero: ['foreman', 6] },
  wolves: { ring: 5, hero: ['rook', 7] },
  spiders: { ring: 5 },
  pickets: { ring: 5, hero: ['picketCaptain', 8] },
};

const fresh = (): GameState => ({ ...newGame(1066, ALDMOOR, 'knight'), opening: undefined });
const bands = ALDMOOR.locations.filter((l) => l.enemy?.ring && !l.enemy.convoy);
const count = (l: Location, troop: string) => l.enemy!.army.find((s) => s.troop === troop)?.count ?? 0;
const paydays = (state: GameState, n: number) => {
  let s = state;
  for (let i = 0; i < n * 7; i++) s = { ...endDay(s).state, ambush: undefined };
  return s;
};

describe('the climb (#239)', () => {
  it('has the fifteen bands of the design, each in its ring, and every band of men under its hero', () => {
    expect(bands.map((l) => l.id).sort()).toEqual(Object.keys(TABLE).sort());
    for (const band of bands) {
      const { ring, hero } = TABLE[band.id];
      expect(band.enemy!.ring, band.id).toBe(ring);
      const leader = band.enemy!.army.find((s) => leads(s.troop));
      expect(leader ? [leader.troop, leader.level] : undefined, band.id).toEqual(hero);
    }
    // The villain is the top of the climb, at level X, and the old bridge and the kennels are the gates.
    expect(locationById(fresh(), 'hideout').enemy!.army).toContainEqual({ troop: 'baron', count: 1, level: 10 });
    expect(bands.filter((l) => l.enemy!.gate).map((l) => l.id).sort()).toEqual(['patrol', 'wolves']);
  });

  it('rings by the ride from the start: each ring lies further out than the one before', () => {
    const map = buildMap(ALDMOOR);
    const cell = ([x, y]: readonly number[]) => nearestPassable(map.grid, { x: Math.floor(x / CELL), y: Math.floor(y / CELL) }, 16)!;
    const ride = reachFrom(map.grid, cell(ALDMOOR.hero)).g;
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
    const rides = [1, 2, 3, 4, 5].map((ring) => median(bands.filter((l) => l.enemy!.ring === ring).map((l) => ride[cell(l.at).y * map.width + cell(l.at).x])));
    for (let i = 1; i < rides.length; i++) expect(rides[i], `ring ${i + 1}`).toBeGreaterThan(rides[i - 1]);
  });

  it('grows every band by a seventh each payday for three weeks, as HoMM2 does, its hero still one', () => {
    const start = fresh();
    const week = paydays(start, 1);
    const swordsmen = count(locationById(start, 'collectors'), 'swordsmen');
    expect(count(locationById(week, 'collectors'), 'swordsmen')).toBe(Math.round(swordsmen * (1 + BAND_GROWTH)));
    expect(locationById(week, 'collectors').enemy!.army).toContainEqual({ troop: 'sergeant', count: 1, level: 2 });
    expect(count(locationById(week, 'heathWolves'), 'wolves')).toBe(Math.round(count(locationById(start, 'heathWolves'), 'wolves') * (1 + BAND_GROWTH)));
    // Three paydays, and no more.
    const later = paydays(week, 3);
    const grown = locationById(later, 'heathWolves');
    expect(grown.enemy!.grown).toBe(3);
    expect(count(grown, 'wolves')).toBe(count(locationById(paydays(week, 2), 'heathWolves'), 'wolves'));
    // The villain recruits at his own rate, for five.
    expect(count(locationById(week, 'hideout'), 'swordsmen')).toBe(Math.round(count(locationById(start, 'hideout'), 'swordsmen') * 1.03));
  });

  it('teaches less for a fight than the worth of what it beat', () => {
    const army = locationById(fresh(), 'patrol').enemy!.army;
    expect(TEACHES).toBeLessThan(1);
    expect(battleXp(army)).toBe(Math.round(armyPower(army) * TEACHES));
  });
});
