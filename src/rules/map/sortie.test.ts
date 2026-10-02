import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../../content/aldmoor';
import { battleEnd, createBattle, type BattleState } from '../battle/battle';
import { apply, choose, describe as about, endDay, finishFight, heroInBattle, locationById, placeOdds, startFight, visit, type GameEvent, type GameState } from '../game';
import { withNewPlaces } from '../campaign';
import { newGame } from '../scenario';
import { listed, troops } from '../state';
import { riddenOut } from './sortie';

type Point = [number, number];
/** The heath junction, just off Grimsby's dig, where the road he rides out by begins. */
const HEATH: Point = [700, 530];
const CASTLE = locationById(newGame(3, ALDMOOR), 'castle').at;

const aldmoor = (army: GameState['army'] = [{ troop: 'knights', count: 10 }], at: Point = HEATH, flags: GameState['flags'] = {}): GameState => {
  const s = { ...newGame(3, ALDMOOR, 'knight'), opening: undefined, army };
  return { ...s, flags, hero: { ...s.hero, at } };
};
const raided = (army?: GameState['army'], at?: Point) => aldmoor(army, at, { dig: 'raided' });
const count = (s: GameState, id: string, troop: string) => locationById(s, id).enemy!.army.find((x) => x.troop === troop)?.count ?? 0;
const band = (s: GameState) => s.locations.find((l) => l.id === 'grimsby');
/** Grimsby's stockade as the content has it, and the share of it he rides out with. */
const LAIR = ALDMOOR.locations.find((l) => l.id === 'hideout')!.enemy!;
const MEN = (troop: string) => LAIR.army.find((x) => x.troop === troop)!.count;
const GUARD = LAIR.sortie!.guard;
const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const cardLines = (r: { events: GameEvent[] }) => r.events.flatMap((e) => (e.type === 'card' ? e.card.lines : []));
/** Nights pass until something falls on the camp, or `n` have. */
const nights = (s: GameState, n: number) => {
  for (let i = 0; i < n && !s.ambush; i++) s = endDay(s).state;
  return s;
};

describe('Grimsby riding out', () => {
  it('stays behind his walls until he\u2019s hurt', () => {
    expect(band(nights(aldmoor(), 5))).toBeUndefined();
  });

  it('rides out the night his dig is raided, with a fifth of his men, and comes up the road for the hero', () => {
    const start = raided();
    const r = endDay(start);
    const out = band(r.state)!;
    expect(out).toBeDefined();
    expect(out.done).toBe(false);
    expect(count(r.state, 'grimsby', 'baron')).toBe(1);
    expect(count(r.state, 'grimsby', 'swordsmen')).toBe(Math.round(MEN('swordsmen') * GUARD));
    expect(count(r.state, 'hideout', 'baron')).toBe(0);
    expect(count(r.state, 'hideout', 'swordsmen') + count(r.state, 'grimsby', 'swordsmen')).toBe(MEN('swordsmen'));
    // He has set off, and the dawn says so.
    const gate = ALDMOOR.locations.find((l) => l.id === 'hideout')!.enemy!.sortie!.band.at;
    expect(dist(out.at, start.hero.at)).toBeLessThan(dist(gate, start.hero.at));
    expect(r.events.some((e) => e.type === 'added' && e.id === 'grimsby')).toBe(true);
    expect(cardLines(r).some((l) => l.includes('ridden out of his stockade'))).toBe(true);
    // Once is enough: the same hurt doesn't send him out again.
    expect(locationById(r.state, 'hideout').enemy!.answered).toEqual(['dig']);
  });

  it('bars his gate while he\u2019s out', () => {
    const s = endDay(raided()).state;
    const hideout = locationById(s, 'hideout');
    expect(riddenOut(s, hideout)?.id).toBe('grimsby');
    expect(cardLines(visit(s, 'hideout')).join(' ')).toContain('The gate is barred');
    expect(choose(s, 'hideout', 'fight')).toBeNull();
    expect(choose(s, 'hideout', 'parley/goose')).toBeNull();
    // No fight, so no odds at his gate: they go with him, on his band out on the road.
    expect(placeOdds(s, 'hideout')).toBeNull();
    expect(about(s, 'hideout').verdict).toBeUndefined();
    expect(placeOdds(s, 'grimsby')).toEqual(about(s, 'grimsby').verdict);
    expect(placeOdds(s, 'grimsby')).not.toBeNull();
  });

  it('waits for a hero out of his reach, and rides out once he comes back', () => {
    const far = nights(raided(undefined, [CASTLE[0], CASTLE[1] + 14]), 3);
    expect(band(far)).toBeUndefined();
    expect(locationById(far, 'hideout').enemy!.answered).toBeUndefined();
    const back = endDay({ ...far, hero: { ...far.hero, at: HEATH } }).state;
    expect(band(back)?.done).toBe(false);
  });

  it('falls on the hero\u2019s camp within days, whatever the odds, and flees home when his guard is beaten', () => {
    const s = nights(raided([{ troop: 'knights', count: 60 }, { troop: 'archers', count: 60 }]), 8);
    expect(s.ambush).toBe('grimsby');
    const r = apply(s, { type: 'choose', id: 'grimsby', choice: 'auto' })!;
    expect(band(r.state)!.done).toBe(true);
    expect(r.state.bounty).toBe('open');
    // Home again, and his guard straggles in after him: his stockade is as strong as it was.
    expect(count(r.state, 'hideout', 'baron')).toBe(1);
    expect(count(r.state, 'hideout', 'swordsmen')).toBe(MEN('swordsmen'));
    expect(count(r.state, 'hideout', 'crossbowmen')).toBe(MEN('crossbowmen'));
    expect(locationById(r.state, 'hideout').enemy!.humbled).toBeUndefined();
    expect(cardLines(r).join(' ')).toContain('Baron Grimsby flees home');
    // His gate is open again.
    expect(cardLines(visit(r.state, 'hideout')).join(' ')).not.toContain('The gate is barred');
    // The same hurt doesn't send him out again; a new one does.
    expect(band(endDay(r.state).state)!.done).toBe(true);
    const again = endDay({ ...r.state, flags: { ...r.state.flags, patrolGone: true } }).state;
    expect(band(again)?.done).toBe(false);
    expect(count(again, 'grimsby', 'swordsmen')).toBe(Math.round(MEN('swordsmen') * GUARD));
  });

  it('gets his guard back in a save from before, when he came home without it', () => {
    const s = aldmoor();
    const lair = locationById(s, 'hideout');
    // As the stockade stood then: 46 swordsmen and 24 crossbowmen, a third of them his guard, which never came home.
    const short = { ...lair, enemy: { ...lair.enemy!, humbled: true, sortie: { ...lair.enemy!.sortie!, guard: 0.35 }, army: [{ troop: 'swordsmen' as const, count: 30 }, { troop: 'crossbowmen' as const, count: 16 }, { troop: 'baron' as const, count: 1 }] } };
    const loaded = withNewPlaces({ ...s, locations: s.locations.map((l) => (l.id === 'hideout' ? short : l)) });
    expect(count(loaded, 'hideout', 'swordsmen')).toBe(46);
    expect(count(loaded, 'hideout', 'crossbowmen')).toBe(25);
    expect(count(loaded, 'hideout', 'baron')).toBe(1);
    expect(locationById(loaded, 'hideout').enemy!.humbled).toBeUndefined();
  });

  it('keeps what his band loses when the hero falls back from it, and rides home with whoever is left', () => {
    const out = endDay(raided()).state;
    const started = startFight(out, 'grimsby')!.state;
    const b = started.battle!;
    // The hero cuts his guard's swordsmen down to 3, and falls back.
    const fled: BattleState = { ...b, result: 'fled', fighters: b.fighters.map((f) => (f.side === 'enemy' && f.troop === 'swordsmen' ? { ...f, count: 3 } : f)) };
    const r = finishFight({ ...started, battle: fled });
    expect(count(r.state, 'grimsby', 'swordsmen')).toBe(3);
    expect(count(r.state, 'grimsby', 'crossbowmen')).toBe(Math.round(MEN('crossbowmen') * GUARD));
    expect(count(r.state, 'grimsby', 'baron')).toBe(1);
    const left = locationById(r.state, 'grimsby').enemy!.army.filter((x) => x.troop !== 'baron');
    expect(cardLines(r).at(-1)).toBe(`*Baron Grimsby has ${listed(left.map((x) => troops(x.troop, x.count)))} left.*`);
    // He can't find the hero, so he goes home, and the 3 go in with him.
    let s: GameState = { ...r.state, hero: { ...r.state.hero, at: [CASTLE[0], CASTLE[1] + 14] } };
    for (let i = 0; i < 12 && !band(s)!.done; i++) s = endDay(s).state;
    expect(band(s)!.done).toBe(true);
    expect(count(s, 'hideout', 'swordsmen')).toBe(MEN('swordsmen') - Math.round(MEN('swordsmen') * GUARD) + 3);
    expect(count(s, 'hideout', 'crossbowmen')).toBe(MEN('crossbowmen'));
    expect(count(s, 'hideout', 'baron')).toBe(1);
  });

  it('gives up and goes home, guard and all, when the hero rides off where he can\u2019t follow', () => {
    const out = endDay(raided()).state;
    let s: GameState = { ...out, hero: { ...out.hero, at: [CASTLE[0], CASTLE[1] + 14] } };
    let home: ReturnType<typeof endDay> | null = null;
    for (let i = 0; i < 12 && !home; i++) {
      const r = endDay(s);
      s = r.state;
      if (band(s)!.done) home = r;
    }
    expect(home).not.toBeNull();
    expect(home!.events.some((e) => e.type === 'removed' && e.id === 'grimsby')).toBe(true);
    expect(cardLines(home!).some((l) => l.includes('gone home to his stockade'))).toBe(true);
    expect(count(s, 'hideout', 'baron')).toBe(1);
    expect(count(s, 'hideout', 'swordsmen')).toBe(MEN('swordsmen'));
    expect(locationById(s, 'hideout').enemy!.humbled).toBeUndefined();
    // Hurt him again, and he comes out again.
    const again = endDay({ ...s, hero: { ...s.hero, at: HEATH }, flags: { ...s.flags, patrolGone: true } }).state;
    expect(band(again)?.done).toBe(false);
  });

  it('rides out when his patrol is taken off the bridge, and comes all the way there, round his wolves', () => {
    // Aldric waits at the east end of the bridge, on it: Grimsby comes to him over it, not the long way round by the ford.
    const s = aldmoor(undefined, [1692, 1468], { patrolGone: true });
    const bridge = { ...s, locations: s.locations.map((l) => (l.id === 'patrol' ? { ...l, done: true } : l)) };
    expect(band(endDay(bridge).state)?.done).toBe(false);
    expect(nights(bridge, 8).ambush).toBe('grimsby');
  });

  it('says, on the field and on the card alike, that he flees home instead of being taken', () => {
    const s = endDay(raided()).state;
    const b = createBattle({ place: 'grimsby', seed: 1, player: [{ troop: 'knights', count: 50 }], enemy: locationById(s, 'grimsby').enemy!.army, hero: heroInBattle(s), flees: true });
    expect(battleEnd({ ...b, result: 'won' })?.leader).toBe('Baron Grimsby flees home');
    expect(battleEnd({ ...b, flees: undefined, result: 'won' })?.leader).toBe('Baron Grimsby is taken');
  });
});
