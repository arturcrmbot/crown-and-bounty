import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../content/aldmoor';
import type { BackgroundId } from '../content/backgrounds';
import { FENMARCH } from '../content/fenmarch';
import { isBeast, TROOPS, type TroopId } from '../content/troops';
import { autoResolve, chooseAction } from './battle/ai';
import { createBattle } from './battle/battle';
import { apply, battleXp, commissionAt, endDay, heroStats, leadershipUsed, locationById, visit, wages, type Card, type GameState, type Result } from './game';
import { SAFE, TAME_RESPECT, tameOffer } from './places/enemy';
import { simulate } from './sim';
import { beginCommission, newGame } from './scenario';

const fresh = (background: BackgroundId = 'ranger'): GameState => ({ ...newGame(1066, ALDMOOR, background), opening: undefined });
const choose = (state: GameState, id: string, choice: string) => apply(state, { type: 'choose', id, choice });
const cardOf = (result: Result): Card => {
  const e = result.events.find((x) => x.type === 'card');
  if (!e || e.type !== 'card') throw new Error('no card');
  return e.card;
};
const labels = (state: GameState, id: string) => cardOf(visit(state, id)).choices.map((c) => `${c.label}${c.disabled ? ' [off]' : ''}`);
const count = (state: GameState, troop: TroopId) => state.army.find((s) => s.troop === troop)?.count ?? 0;
/** A hero with room to lead a pack, and an army that could beat anything in Aldmoor. */
const grown = (state: GameState): GameState => ({ ...state, leadership: 900, army: [{ troop: 'knights', count: 60 }, { troop: 'archers', count: 90 }] });

describe('taming', () => {
  it('wins beasts over for a ranger: as many as he can lead, and the rest wander off', () => {
    const start = fresh();
    expect(labels(start, 'boars')).toContain('Tame as many as you can lead (3 of 9)');
    const result = choose(start, 'boars', 'tame')!;
    const s = result.state;
    expect(count(s, 'boars')).toBe(3);
    expect(locationById(s, 'boars').done).toBe(true);
    expect(result.events).toContainEqual({ type: 'removed', id: 'boars' });
    // No truffles: those are for whoever beats them.
    expect(s.gold).toBe(start.gold);
    const boars = locationById(start, 'boars').enemy!;
    expect(s.hero.xp).toBe(Math.round(battleXp(boars.army) / 2));
    const lines = cardOf(result).lines;
    expect(lines[0]).toBe(boars.tamed);
    expect(lines).toContain('**3 Wild Boars** join your army.');
    expect(lines.some((l) => l.startsWith('The rest, for whom you have no room'))).toBe(true);
  });

  it('takes the whole pack when there is room for it', () => {
    const roomy = { ...fresh(), leadership: 150 };
    expect(labels(roomy, 'boars')).toContain('Tame them');
    const s = choose(roomy, 'boars', 'tame')!;
    expect(count(s.state, 'boars')).toBe(9);
    expect(cardOf(s).lines.some((l) => l.startsWith('The rest'))).toBe(false);
    expect(leadershipUsed(s.state.army)).toBeLessThanOrEqual(heroStats(s.state).leadership);
  });

  it('only if they respect him: the wolves won\u2019t follow a fresh army, and do follow one that could beat them', () => {
    // Respect is the odds the card calls "You should win", not merely close.
    expect(TAME_RESPECT).toBe(SAFE);
    const start = fresh();
    expect(labels(start, 'wolves')).toContain('Tame them (they don\u2019t respect you yet) [off]');
    expect(choose(start, 'wolves', 'tame')).toBeNull();
    const card = cardOf(visit(grown(start), 'wolves'));
    expect(card.lines.some((l) => l.includes('the way a pack watches its leader'))).toBe(true);
    const tamed = choose(grown(start), 'wolves', 'tame')!.state;
    expect(count(tamed, 'wolves')).toBe(84);
    expect(locationById(tamed, 'wolves').done).toBe(true);
    // They show him their den and the old cloak, but he doesn't skin his friends: no pelt for Old Nan.
    expect(tamed.hero.gear.armour).toBe('greenwoodCloak');
    expect(tamed.flags?.wolfpelt).toBeUndefined();
    expect(tamed.gold).toBe(start.gold);
  });

  it('has no room to offer when every banner is full', () => {
    const full = { ...grown(fresh()), leadership: leadershipUsed(grown(fresh()).army) };
    expect(labels(full, 'boars')).toContain('Tame them (no room to lead them) [off]');
    expect(choose(full, 'boars', 'tame')).toBeNull();
  });

  it('shows other heroes it can be done, and teaches it with St Aldhelm\u2019s crown or the Beast Friend perk', () => {
    const knight = { ...fresh('knight'), leadership: 200 };
    expect(labels(knight, 'boars')).toContain('Tame them (a way with beasts) [off]');
    expect(choose(knight, 'boars', 'tame')).toBeNull();
    const crowned = choose(knight, 'shrine', 'start/crown')!.state;
    expect(crowned.hero.gear.helm).toBe('hawthornCrown');
    expect(heroStats(crowned).tames).toBe(true);
    expect(count(choose(crowned, 'boars', 'tame')!.state, 'boars')).toBe(9);
    const friend = { ...knight, hero: { ...knight.hero, perks: [...knight.hero.perks, 'beastFriend' as const] } };
    expect(count(choose(friend, 'boars', 'tame')!.state, 'boars')).toBe(9);
  });

  it('never at a villain\u2019s walls, nor for troops that draw wages', () => {
    const s = grown(fresh());
    expect(tameOffer(s, locationById(s, 'hideout'))).toBeNull();
    expect(tameOffer(s, locationById(s, 'patrol'))).toBeNull();
    expect(labels(s, 'patrol').some((l) => l.startsWith('Tame'))).toBe(false);
  });

  it('calls a mixed band\u2019s beasts away, and leaves the rest of it to fight', () => {
    const start = newGame(1066);
    const province = commissionAt(start.campaign, 2).province;
    const s: GameState = { ...grown(beginCommission(province, 5, { ...start.campaign.start, hero: { ...start.hero, background: 'ranger' } }, 2, [], start.campaign.seed)), leadership: 2000 };
    const gate = locationById(s, 'guardian');
    const wolves = gate.enemy!.army.find((x) => x.troop === 'wolves')!.count;
    expect(labels(s, 'guardian')).toContain('Tame their Wolves');
    const after = choose(s, 'guardian', 'tame')!.state;
    expect(count(after, 'wolves')).toBe(wolves);
    const left = locationById(after, 'guardian');
    expect(left.done).toBe(false);
    expect(left.enemy!.army.some((x) => x.troop === 'wolves')).toBe(false);
    expect(left.enemy!.army.length).toBe(gate.enemy!.army.length - 1);
    // The gatekeepers' relic stays with the gatekeepers.
    expect(Object.values(after.hero.gear).concat(after.hero.pack)).not.toContain(gate.artifact);
  });

  it('gives the ranger something to win over in the Fenmarch too', () => {
    const fen = beginCommission(FENMARCH, 1, { ...newGame(1066, ALDMOOR, 'ranger').campaign.start, leadership: 200 }, 1, []);
    expect(labels(fen, 'boars')).toContain('Tame them');
    expect(count(choose(fen, 'boars', 'tame')!.state, 'boars')).toBe(14);
  });
});

describe('tamed beasts', () => {
  it('are every wild thing that draws no wages and follows no villain, and each says how it feels about joining', () => {
    const beasts = (Object.keys(TROOPS) as TroopId[]).filter(isBeast);
    expect(beasts.sort()).toEqual(['bears', 'boars', 'wolves']);
    for (const b of beasts) expect(TROOPS[b].tamed, b).toBeTruthy();
    // The old King's huntsmen draw no wages either, but nobody tames them: they say why they serve.
    expect(TROOPS.huntsmen.wage).toBe(0);
    expect(isBeast('huntsmen')).toBe(false);
    expect(TROOPS.huntsmen.unpaid).toBeTruthy();
  });

  it('draw no wages on payday', () => {
    const tamed = choose({ ...fresh(), leadership: 150 }, 'boars', 'tame')!.state;
    expect(wages(tamed.army)).toBe(wages(fresh().army));
    let s = tamed;
    for (let i = 0; i < 7; i++) s = endDay(s).state;
    expect(count(s, 'boars')).toBe(9);
  });

  it('fight on the hero\u2019s side, moved by the same commander as everyone else', () => {
    const hero = { attack: 1, defence: 1, spellPower: 1, mana: 0, spells: [], castRound: 0 };
    const b = createBattle({ place: 'test', seed: 3, player: [{ troop: 'wolves', count: 40 }, { troop: 'boars', count: 9 }], enemy: [{ troop: 'bandits', count: 14 }], hero, obstacles: 0 });
    const wolves = b.fighters.find((f) => f.side === 'player' && f.troop === 'wolves')!;
    // The wolves are fastest, so they go first.
    expect(b.order[0]).toBe(wolves.id);
    expect(chooseAction(b).type).not.toBe('defend');
    const after = autoResolve(b);
    expect(after.result).toBe('won');
    expect(after.fighters.find((f) => f.id === wolves.id)!.at).not.toBe(wolves.at);
  });

  it('and the bot\u2019s ranger tames what will follow him', () => {
    // With Aldric on the field too, most of his fights with beasts are no gamble, so he tames only now and then.
    const runs = simulate([1, 2, 3, 4, 5, 6, 7, 8], 'ranger');
    expect(runs.every((r) => r.won)).toBe(true);
    expect(runs.some((r) => r.log.some((l) => l.includes('tamed')))).toBe(true);
  }, 600_000);
});
