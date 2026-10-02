import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../content/aldmoor';
import { chooseAction } from './battle/ai';
import { battleAct, CHARGE_BONUS, createBattle, fighterById, strike, type BattleHero, type BattleState } from './battle/battle';
import { hexIndex } from './battle/hex';
import { apply, leadershipUsed, locationById, visit, type GameState, type Location, type Result } from './game';
import { mapOf } from './map/maps';
import { cellCentre, Terrain } from './map/model';
import { costsFor } from './map/movement';
import { hunting } from './map/roaming';
import { newGame } from './scenario';

const hero: BattleHero = { attack: 1, defence: 1, spellPower: 2, mana: 20, spells: ['bolt', 'bless'], castRound: 0 };
const field = (h: BattleHero, player: BattleState['fighters'][number]['troop'][], enemyAt?: number) => {
  const b = createBattle({ place: 'test', seed: 7, player: player.map((troop) => ({ troop, count: 10 })), enemy: [{ troop: 'swordsmen', count: 30 }], hero: h, obstacles: 0 });
  if (enemyAt !== undefined) b.fighters.find((f) => f.side === 'enemy')!.at = enemyAt;
  return b;
};
type Hit = { damage: number; retaliation: boolean; charge?: boolean };
const hits = (r: { events: { type: string }[] }) => r.events.filter((e) => e.type === 'hit') as unknown as Hit[];
const cardOf = (r: Result) => {
  const e = r.events.find((x) => x.type === 'card');
  if (!e || e.type !== 'card') throw new Error('no card');
  return e.card;
};

describe('the knight\u2019s charge', () => {
  const lancer = { ...hero, charge: ['knights' as const] };

  it('hits a quarter harder after riding three hexes, and nobody strikes back', () => {
    const b = field(lancer, ['knights'], hexIndex(4, 4));
    const knights = b.fighters[0];
    const target = fighterById(b, 1);
    const r = battleAct(b, { type: 'melee', target: target.id, from: hexIndex(3, 4) }, true);
    const [blow, ...rest] = hits(r);
    expect(blow.charge).toBe(true);
    const moved = { ...knights, at: hexIndex(3, 4) };
    expect(blow.damage).toBe(strike(b, moved, target, false, undefined, CHARGE_BONUS).damage);
    expect(blow.damage).toBeGreaterThan(strike(b, moved, target, false).damage * 1.2);
    expect(rest).toHaveLength(0);
  });

  it('is an ordinary blow from close by, or for a hero who has no lancers', () => {
    const near = battleAct(field(lancer, ['knights'], hexIndex(2, 4)), { type: 'melee', target: 1, from: hexIndex(1, 4) }, true);
    expect(hits(near)[0].charge).toBeUndefined();
    expect(hits(near).some((h) => h.retaliation)).toBe(true);
    const plain = battleAct(field(hero, ['knights'], hexIndex(4, 4)), { type: 'melee', target: 1, from: hexIndex(3, 4) }, true);
    expect(hits(plain)[0].charge).toBeUndefined();
  });
});

describe('the ranger\u2019s volley', () => {
  const ranger = { ...hero, volley: true };

  it('opens the battle: every archer looses once before anyone moves', () => {
    const b = field(ranger, ['knights', 'archers']);
    expect(b.volley).toBe(true);
    expect(chooseAction(b)).toEqual({ type: 'volley' });
    const r = battleAct(b, { type: 'volley' });
    expect(r.events[0]).toEqual({ type: 'volley' });
    expect(hits(r)).toHaveLength(1);
    expect(fighterById(r.battle, 1).shots).toBe(fighterById(b, 1).shots - 1);
    expect(r.battle.volley).toBeUndefined();
    expect(r.battle.order[0]).toBe(b.order[0]);
    expect(battleAct(r.battle, { type: 'volley' }).events).toHaveLength(0);
  });

  it('needs someone who can shoot', () => {
    expect(field(ranger, ['knights']).volley).toBeUndefined();
    expect(field(hero, ['archers']).volley).toBeUndefined();
  });
});

describe('the wizard\u2019s twin casting', () => {
  it('casts two spells a round, and no more', () => {
    const b = field({ ...hero, casts: 2 }, ['knights']);
    const one = battleAct(b, { type: 'cast', spell: 'bless', target: 0 });
    const two = battleAct(one.battle, { type: 'cast', spell: 'bolt', target: 1 });
    expect(two.events.some((e) => e.type === 'spell')).toBe(true);
    expect(battleAct(two.battle, { type: 'cast', spell: 'bolt', target: 1 }).events).toHaveLength(0);
  });

  it('while anyone else casts once', () => {
    const one = battleAct(field(hero, ['knights']), { type: 'cast', spell: 'bless', target: 0 });
    expect(battleAct(one.battle, { type: 'cast', spell: 'bolt', target: 1 }).events).toHaveLength(0);
  });
});

describe('on the map', () => {
  const map = mapOf(newGame(1066, ALDMOOR, 'ranger'));
  const forest = map.terrain.findIndex((t) => t === Terrain.Forest);

  it('a ranger rides through the woods, which stop everyone else', () => {
    expect(costsFor(newGame(1066, ALDMOOR, 'ranger'), map)[forest]).toBe(3);
    expect(costsFor(newGame(1066, ALDMOOR, 'knight'), map)[forest]).toBe(Infinity);
  });

  it('and nothing hunts him while he is among the trees', () => {
    const at = cellCentre(map, forest);
    const hunter = { id: 'h', kind: 'patrol', name: 'Hunters', at: [at[0] + 40, at[1]], done: false, enemy: { behaviour: 'hunt', range: 500, army: [{ troop: 'wolves', count: 200 }] } } as unknown as Location;
    const place = (background: 'ranger' | 'knight') => ({ ...newGame(1066, ALDMOOR, background), hero: { ...newGame(1066, ALDMOOR, background).hero, at } });
    expect(hunting(place('knight'), hunter)).toBe(true);
    expect(hunting(place('ranger'), hunter)).toBe(false);
  });

  it('a wizard casts Far Sight from today\u2019s mana', () => {
    const wizard: GameState = { ...newGame(1066, ALDMOOR, 'wizard'), opening: undefined };
    const seen = (s: GameState) => s.explored.reduce((n, v) => n + (v ? 1 : 0), 0);
    const r = apply(wizard, { type: 'mapSpell', spell: 'farsight' })!;
    expect(r.state.hero.mana).toBe(wizard.hero.mana - 10);
    expect(seen(r.state)).toBeGreaterThan(seen(wizard));
    expect(apply({ ...newGame(1066, ALDMOOR, 'knight'), opening: undefined }, { type: 'mapSpell', spell: 'farsight' })).toBeNull();
  });

  it('a courtier pays half a bribe, and buys small bands outright', () => {
    const fresh: GameState = { ...newGame(1066, ALDMOOR, 'courtier'), opening: undefined };
    // The highwaymen as they were, a small band, before the climb made them its fourth ring (#239).
    const courtier: GameState = { ...fresh, locations: fresh.locations.map((l) => (l.id === 'highwaymen' ? { ...l, enemy: { ...l.enemy!, army: [{ troop: 'bandits', count: 14 }], reward: 200 } } : l)) };
    const labels = (s: GameState, id: string) => cardOf(visit(s, id)).choices.map((c) => c.label);
    expect(labels(courtier, 'patrol')).toContain('Pay them to go home (1,350 gold)');
    const offer = labels(courtier, 'highwaymen').find((l) => l.startsWith('Hire them'));
    expect(offer).toBeDefined();
    const hired = apply(courtier, { type: 'choose', id: 'highwaymen', choice: 'hire' })!.state;
    expect(hired.army.some((s) => s.troop === 'bandits')).toBe(true);
    expect(hired.gold).toBeLessThan(courtier.gold);
    expect(locationById(hired, 'highwaymen').done).toBe(true);
    // With no room under his banner, he can't pay for anyone.
    const full: GameState = { ...courtier, leadership: leadershipUsed(courtier.army) };
    expect(cardOf(visit(full, 'highwaymen')).choices.find((c) => c.label.startsWith('Hire'))).toMatchObject({ label: 'Hire them (no room to lead them)', disabled: true });
    expect(apply(full, { type: 'choose', id: 'highwaymen', choice: 'hire' })).toBeNull();
    // Beasts won't take coin, gates won't sell out, and nobody else gets the offer.
    expect(labels(courtier, 'boars').some((l) => l.startsWith('Hire'))).toBe(false);
    expect(labels(courtier, 'patrol').some((l) => l.startsWith('Hire'))).toBe(false);
    expect(labels({ ...newGame(1066, ALDMOOR, 'knight'), opening: undefined }, 'highwaymen').some((l) => l.startsWith('Hire'))).toBe(false);
  });

  it('a courtier\u2019s offer names who of a mixed band would come over, as taming does', () => {
    const courtier: GameState = { ...newGame(1066, ALDMOOR, 'courtier'), opening: undefined };
    const strong: GameState = { ...courtier, army: [{ troop: 'knights', count: 40 }, { troop: 'archers', count: 60 }] };
    // Room under his banner for only some of them: 6 swordsmen at 3 leadership each, and then 1 crossbowman at 2.
    const tight: GameState = {
      ...strong,
      leadership: leadershipUsed(strong.army) + 20,
      locations: strong.locations.map((l) => (l.id === 'highwaymen' ? { ...l, enemy: { ...l.enemy!, army: [{ troop: 'swordsmen' as const, count: 14 }, { troop: 'crossbowmen' as const, count: 8 }] } } : l)),
    };
    const offer = cardOf(visit(tight, 'highwaymen')).choices.find((c) => c.label.startsWith('Hire'));
    expect(offer?.label).toMatch(/^Hire 6 Swordsmen and 1 Crossbowman, and fight the rest \([\d,]+ gold\)$/);
  });
});
