import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../content/aldmoor';
import { leads, TROOPS } from '../content/troops';
import { autoResolve } from './battle/ai';
import { battleAct, battleEnd, createBattle, fighterById, isLeader, options, REAR, statsOf, type BattleState } from './battle/battle';
import { withNewPlaces } from './campaign';
import { choose, describe as about, endDay, fight, heroInBattle, locationById, startFight, visit, type GameEvent, type GameState } from './game';
import { hunting } from './map/roaming';
import { tameOffer } from './places/enemy';
import { newGame } from './scenario';

type Point = [number, number];
/** On the bridge road, a little way short of Rook's kennels. */
const NEAR_KENNELS: Point = [1180, 1510];
const aldmoor = (army: GameState['army'] = [{ troop: 'knights', count: 10 }, { troop: 'archers', count: 20 }], at?: Point): GameState => {
  const s = { ...newGame(5, ALDMOOR, 'knight'), opening: undefined, army };
  return at ? { ...s, hero: { ...s.hero, at } } : s;
};
const cardLines = (events: GameEvent[]) => events.flatMap((e) => (e.type === 'card' ? e.card.lines : []));
/** Days go by: the hero camps where he stands. */
const until = (s: GameState, day: number) => {
  while (s.day < day && !s.ambush) s = endDay(s).state;
  return s;
};

describe('Rook the Huntsman, Grimsby\u2019s captain', () => {
  it('leads the Baron\u2019s wolves as a captain: a name, a face, his words, and the leader\u2019s rule', () => {
    const s = aldmoor();
    const band = locationById(s, 'wolves');
    expect(band.enemy!.army.map((x) => x.troop)).toEqual(['wolves', 'rook']);
    expect(leads('rook')).toBe(true);
    expect(TROOPS.rook.face).toBe('rook');
    // His face on his band's cards, before the ride and on arrival.
    expect(about(s, 'wolves').portrait).toBe('rook');
    const there = visit(s, 'wolves').events.find((e) => e.type === 'card');
    expect(there?.type === 'card' && there.card.portrait).toBe('rook');
  });

  it('stands behind his wolves, where nothing can reach him, and is taken when his pack is beaten', () => {
    const s = aldmoor([{ troop: 'knights', count: 60 }, { troop: 'archers', count: 80 }]);
    const b = startFight(s, 'wolves')!.state.battle!;
    const rook = b.fighters.find((f) => f.troop === 'rook')!;
    expect(isLeader(rook)).toBe(true);
    expect(rook.at).toBe(REAR);
    // Nobody can aim at him: not a blow, not a shot.
    for (let i = 0; i < 12 && fighterById(b, b.order[0]).side !== 'player'; i++) b.order.push(b.order.shift()!);
    const opts = options(b);
    expect(opts.melee.some((m) => m.target === rook.id) || opts.shoot.includes(rook.id)).toBe(false);
    const done = autoResolve(b);
    expect(done.result).toBe('won');
    expect(battleEnd(done)).toEqual({ army: 'Their army is beaten', leader: 'Rook the Huntsman is taken' });
    // Taken, as the story remembers it.
    const won = fight(s, 'wolves')!.state;
    expect(locationById(won, 'wolves').done).toBe(true);
    expect(won.flags?.rook).toBe('taken');
  });

  it('marks the quarry: whatever his arrows hit loses 3 defence for two rounds, and the pack bites it harder', () => {
    const hero = heroInBattle(aldmoor());
    let b: BattleState = createBattle({ place: 'wolves', seed: 9, player: [{ troop: 'knights', count: 20 }], enemy: [{ troop: 'wolves', count: 30 }, { troop: 'rook', count: 1 }], hero, obstacles: 0 });
    const rook = b.fighters.find((f) => f.troop === 'rook')!;
    const knights = b.fighters.find((f) => f.troop === 'knights')!;
    const before = statsOf(b, knights).defence;
    b = { ...b, order: [rook.id, ...b.order.filter((id) => id !== rook.id)] };
    const shot = battleAct(b, { type: 'shoot', target: knights.id });
    const hit = shot.events.find((e) => e.type === 'hit');
    expect(hit?.type === 'hit' && hit.status).toBe('marked');
    const marked = fighterById(shot.battle, knights.id);
    expect(marked.status).toContain('marked');
    expect(statsOf(shot.battle, marked).defence).toBe(before - 3);
    // It wears off as the round after next begins.
    expect(marked.until?.marked).toBe(shot.battle.round + 2);
  });

  it('holds the kennels through the first week, and from the second hunts whoever camps near them', () => {
    const weak = aldmoor([{ troop: 'peasants', count: 30 }], NEAR_KENNELS);
    const home = locationById(weak, 'wolves').at;
    expect(hunting(weak, locationById(weak, 'wolves'))).toBe(false);
    expect(about(weak, 'wolves').lines.join(' ')).toContain('For now, they hold their ground');
    // Through week one, not a step.
    let s = until(weak, 7);
    expect(locationById(s, 'wolves').at).toEqual(home);
    expect(s.ambush).toBeUndefined();
    // Day VIII: word gets about, and the hunt is on.
    const dawn = endDay(s);
    expect(cardLines(dawn.events).join(' ')).toContain('**Rook the Huntsman** to bring you in');
    s = dawn.state;
    expect(hunting(s, locationById(s, 'wolves'))).toBe(true);
    s = until(s, 12);
    expect(s.ambush).toBe('wolves');
    // A hero his pack couldn't beat, he leaves alone.
    const strong = until(aldmoor([{ troop: 'knights', count: 200 }], NEAR_KENNELS), 12);
    expect(strong.ambush).toBeUndefined();
  });

  it('hurts Grimsby when he\u2019s taken: the Baron rides out', () => {
    const s = { ...aldmoor(undefined, [1180, 1510]), flags: { rook: 'taken' } };
    const taken = { ...s, locations: s.locations.map((l) => (l.id === 'wolves' ? { ...l, done: true } : l)) };
    expect(endDay(taken).state.locations.find((l) => l.id === 'grimsby')?.done).toBe(false);
  });

  it('can\u2019t keep his pack from a ranger they respect: the wolves go over, and Rook gives himself up', () => {
    const s = { ...aldmoor([{ troop: 'knights', count: 40 }, { troop: 'archers', count: 60 }]), hero: { ...newGame(5, ALDMOOR, 'ranger').hero, at: NEAR_KENNELS }, leadership: 1000 };
    const offer = tameOffer(s, locationById(s, 'wolves'))!;
    expect(offer.whole).toBe(true);
    expect(offer.respected).toBe(true);
    const r = choose(s, 'wolves', 'tame')!;
    expect(locationById(r.state, 'wolves').done).toBe(true);
    expect(r.state.army.find((x) => x.troop === 'wolves')?.count).toBe(84);
    expect(r.state.army.some((x) => x.troop === 'rook')).toBe(false);
    expect(cardLines(r.events).join(' ')).toContain('gives himself up');
    // Taken all the same: the pelt stays on the wolves, but Grimsby hears of it, and rides out.
    expect(r.state.flags?.rook).toBe('taken');
    expect(r.state.flags?.wolfpelt).toBeUndefined();
    expect(endDay(r.state).state.locations.find((l) => l.id === 'grimsby')?.done).toBe(false);
  });

  it('takes over the wolves in a save from before him, even if Aldric has met them, until they\u2019re beaten', () => {
    const now = aldmoor();
    const old = JSON.parse(JSON.stringify({ ...now, locations: now.locations.map((l) => (l.id === 'wolves' ? { ...l, seen: true, name: 'Wolf Pack', enemy: { ...l.enemy!, army: [{ troop: 'wolves', count: 70 }], behaviour: undefined, range: undefined, sight: undefined, wakes: undefined } } : l)) })) as GameState;
    const wolves = locationById(withNewPlaces(old), 'wolves');
    expect(wolves.name).toBe('Rook\u2019s Wolves');
    expect(wolves.enemy!.army).toEqual([{ troop: 'wolves', count: 70 }, { troop: 'rook', count: 1 }]);
    expect(wolves.enemy!.wakes?.day).toBe(8);
    const beaten = { ...old, locations: old.locations.map((l) => (l.id === 'wolves' ? { ...l, done: true } : l)) };
    expect(locationById(withNewPlaces(beaten), 'wolves').enemy!.army).toEqual([{ troop: 'wolves', count: 70 }]);
  });
});
