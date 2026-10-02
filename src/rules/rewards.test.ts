import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../content/aldmoor';
import { ARTIFACTS, RELICS } from '../content/artifacts';
import type { BackgroundId } from '../content/backgrounds';
import { battleAct, createBattle, fighterById, statsOf, type BattleHero, type BattleState } from './battle/battle';
import { hexIndex } from './battle/hex';
import { apply, commissionAt, heroStats, locationById, visit, type GameState, type Result } from './game';
import { mapOf } from './map/maps';
import { planRoute } from './map/movement';
import { newGame } from './scenario';

const fresh = (background: BackgroundId = 'knight'): GameState => ({ ...newGame(1066, ALDMOOR, background), opening: undefined });
const choose = (state: GameState, id: string, choice: string) => apply(state, { type: 'choose', id, choice });
const labels = (result: Result) => {
  const e = result.events.find((x) => x.type === 'card');
  if (!e || e.type !== 'card') throw new Error('no card');
  return e.card.choices.map((c) => `${c.label}${c.disabled ? ' [off]' : ''}`);
};
/** A hero with an army big enough to beat anything in Aldmoor on the first day. */
const strong = (state: GameState): GameState => ({ ...state, leadership: 2000, army: [{ troop: 'knights', count: 80 }, { troop: 'archers', count: 120 }] });

describe('Old Nan', () => {
  it('teaches Stone Skin for 300 gold, once', () => {
    const start = fresh();
    const taught = choose(start, 'nan', 'door/stone')!.state;
    expect(taught.hero.spells).toContain('stoneskin');
    expect(taught.gold).toBe(start.gold - 300);
    expect(choose(taught, 'nan', 'door/stone')).toBeNull();
  });

  it('and Fireball for a wolf pelt, which only the wolves have', () => {
    expect(choose(fresh(), 'nan', 'door/fire')).toBeNull();
    expect(labels(visit(fresh(), 'nan'))).toContain('Give her the wolf pelt [off]');
    const pelted = { ...fresh(), flags: { wolfpelt: true } };
    const taught = choose(pelted, 'nan', 'door/fire')!.state;
    expect(taught.hero.spells).toContain('fireball');
    expect(taught.flags?.wolfpelt).toBe(false);
  });
});

describe('choices that come back later', () => {
  it('spared poachers point the way to their cache, and the horn in it', () => {
    const spared = choose(fresh(), 'poachers', 'parley/spare')!;
    expect(locationById(spared.state, 'poachers').done).toBe(true);
    expect(spared.events).toContainEqual({ type: 'added', id: 'cache' });
    const opened = choose(spared.state, 'cache', 'keep')!.state;
    expect(Object.values(opened.hero.gear)).toContain('poachersHorn');
    expect(heroStats(opened).volley).toBe(true);
    // Their leader keeps his lucky rabbit's foot.
    expect(Object.values(opened.hero.gear)).not.toContain('rabbitsFoot');
  });

  it('beaten poachers leave their venison, and the wolves will go after it', () => {
    expect(choose(fresh(), 'wolves', 'parley/venison')).toBeNull();
    const beaten = choose(fresh(), 'poachers', 'auto')!.state;
    expect(locationById(beaten, 'poachers').done).toBe(true);
    expect(beaten.flags?.venison).toBe(true);
    // And their leader's rabbit's foot, which wasn't so lucky for him.
    expect(Object.values(beaten.hero.gear)).toContain('rabbitsFoot');
    expect(heroStats(beaten).luck).toBeCloseTo(0.1);
    const past = choose(beaten, 'wolves', 'parley/venison')!.state;
    expect(locationById(past, 'wolves').done).toBe(true);
    expect(past.flags?.wolfpelt).toBeUndefined();
  });

  it('the highwaymen carry Grimsby\u2019s orders: some of the patrol goes to his stockade, the rest desert', () => {
    // The highwaymen are the climb's fourth ring: an army that could take them.
    const beaten = choose({ ...fresh(), army: [{ troop: 'knights', count: 60 }, { troop: 'archers', count: 60 }] }, 'highwaymen', 'auto')!.state;
    expect(beaten.flags?.orders).toBe(true);
    const before = locationById(beaten, 'hideout').enemy!.army;
    const sent = choose(beaten, 'patrol', 'parley/orders')!.state;
    expect(locationById(sent, 'patrol').done).toBe(true);
    const after = locationById(sent, 'hideout').enemy!.army;
    const count = (army: typeof after, troop: string) => army.find((s) => s.troop === troop)?.count ?? 0;
    const patrol = locationById(beaten, 'patrol').enemy!.army;
    expect(count(after, 'swordsmen')).toBe(count(before, 'swordsmen') + Math.round(count(patrol, 'swordsmen') * 0.3));
    expect(count(after, 'crossbowmen')).toBe(count(before, 'crossbowmen') + Math.round(count(patrol, 'crossbowmen') * 0.3));
    // The rest desert, and can be hired.
    expect(locationById(sent, 'deserters').recruits?.troop).toBe('swordsmen');
  });

  it('beaten wolves leave a cloak for riding the woods, and a pelt for Old Nan', () => {
    const won = choose(strong(fresh('knight')), 'wolves', 'auto')!.state;
    expect(locationById(won, 'wolves').done).toBe(true);
    expect(won.hero.gear.armour).toBe('greenwoodCloak');
    expect(heroStats(won).forestWalk).toBe(true);
    expect(won.flags?.wolfpelt).toBe(true);
  });

  it('a knight who buys the silver signet can hire bands like a courtier', () => {
    const rich = { ...fresh('knight'), gold: 5000 };
    const signed = choose(rich, 'castle', 'buy:silverSignet')!.state;
    expect(heroStats(signed).hires).toBe(true);
    expect(labels(visit(signed, 'highwaymen')).some((l) => l.startsWith('Hire them'))).toBe(true);
  });

  it('the new places can be reached from the start', () => {
    const start = fresh();
    const map = mapOf(start);
    expect(planRoute(start, map, locationById(start, 'nan').at)).not.toBeNull();
    const spared = choose(start, 'poachers', 'parley/spare')!.state;
    expect(planRoute(spared, map, locationById(spared, 'cache').at)).not.toBeNull();
  });
});

describe('the new spells', () => {
  const hero: BattleHero = { attack: 1, defence: 1, spellPower: 3, mana: 40, spells: ['fireball', 'stoneskin'], castRound: 0 };
  /** Our archers stand right beside two enemy stacks, so a fireball on one catches all three. */
  const crowded = (): BattleState => {
    const b = createBattle({ place: 'test', seed: 7, player: [{ troop: 'knights', count: 10 }, { troop: 'archers', count: 20 }], enemy: [{ troop: 'swordsmen', count: 30 }, { troop: 'crossbowmen', count: 30 }], hero, obstacles: 0 });
    fighterById(b, 1).at = hexIndex(5, 4);
    fighterById(b, 2).at = hexIndex(6, 4);
    fighterById(b, 3).at = hexIndex(7, 4);
    return b;
  };

  it('Fireball burns its target and everyone beside it, friend or foe', () => {
    const b = crowded();
    const r = battleAct(b, { type: 'cast', spell: 'fireball', target: 2 });
    const hit = r.events.filter((e) => e.type === 'spell') as { target: number; damage: number; splash?: boolean }[];
    expect(hit.map((h) => h.target).sort()).toEqual([1, 2, 3]);
    expect(hit.every((h) => h.damage === 36)).toBe(true);
    expect(hit.find((h) => h.target === 2)!.splash).toBeUndefined();
    expect(hit.find((h) => h.target === 1)!.splash).toBe(true);
    expect(fighterById(r.battle, 0).count).toBe(10);
  });

  it('Stone Skin hardens a stack by 3 defence', () => {
    const b = crowded();
    const before = statsOf(b, fighterById(b, 0)).defence;
    const r = battleAct(b, { type: 'cast', spell: 'stoneskin', target: 0 });
    expect(statsOf(r.battle, fighterById(r.battle, 0)).defence).toBe(before + 3);
  });
});

describe('relics', () => {
  it('each carries a trick, not just a number', () => {
    for (const id of RELICS) {
      const b = ARTIFACTS[id].bonus;
      expect(Boolean(b.charge?.length || b.volley || b.forestWalk || b.casts || b.mapSpells?.length || b.hires || b.tames), id).toBe(true);
    }
  });
});

describe('generated provinces', () => {
  it('give their gatekeepers a relic, sell one at the castle, and teach charms at a shrine', () => {
    for (const seed of [1066, 7, 99]) {
      const { campaign } = newGame(seed);
      for (const chapter of [2, 3, 4]) {
        const province = commissionAt(campaign, chapter).province;
        const place = (id: string) => province.locations.find((l) => l.id === id);
        expect(RELICS, `${seed}/${chapter}`).toContain(place('guardian')!.artifact);
        expect(place('castle')!.wares!.some((w) => RELICS.includes(w)), `${seed}/${chapter}`).toBe(true);
        expect(place('stones')?.pages?.[0].choices.length, `${seed}/${chapter}`).toBe(3);
      }
    }
  }, 60_000);
});
