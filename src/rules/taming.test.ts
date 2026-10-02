import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../content/aldmoor';
import type { BackgroundId } from '../content/backgrounds';
import { FENMARCH } from '../content/fenmarch';
import { befriends, isBeast, TROOPS, type TroopId } from '../content/troops';
import { autoResolve, chooseAction } from './battle/ai';
import { createBattle } from './battle/battle';
import { ambushCard, apply, battleXp, commissionAt, endDay, fightingPower, heroStats, leadershipUsed, locationById, visit, wages, type Card, type GameState, type Result } from './game';
import { tameOffer } from './places/enemy';
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
  it('takes a whole pack once his army is half as strong again as theirs, for the rest of the day: the ranger\u2019s boars on day I', () => {
    const start = fresh();
    expect(labels(start, 'boars')).toContain('Tame them (until dusk)');
    const result = choose(start, 'boars', 'tame')!;
    const s = result.state;
    expect(count(s, 'boars')).toBe(9);
    expect(s.movement).toBe(0);
    expect(cardOf(result).lines).toContain('*It has taken you the rest of the day.*');
    // The bears follow a ranger whole too, where once only 4 of the 7 did. Anyone else who tames, with the same
    // army, still wins over only as many as it outweighs: the Ranger is the one beasts follow readily (Artur, 2 Oct).
    expect(count(choose(start, 'bears', 'tame')!.state, 'bears')).toBe(7);
    const knight = fresh('knight');
    const friend: GameState = { ...knight, army: start.army, hero: { ...knight.hero, perks: ['beastFriend'] } };
    expect(count(choose(friend, 'bears', 'tame')!.state, 'bears')).toBe(4);
    expect(locationById(s, 'boars').done).toBe(true);
    expect(s.ambush).toBeUndefined();
    expect(result.events).toContainEqual({ type: 'removed', id: 'boars' });
    // No truffles: those are for whoever beats them.
    expect(s.gold).toBe(start.gold);
    const boars = locationById(start, 'boars').enemy!;
    expect(s.hero.xp).toBe(Math.round(battleXp(boars.army) / 2));
    const lines = cardOf(result).lines;
    expect(lines[0]).toBe(boars.tamed);
    expect(lines).toContain('**9 Wild Boars** join your army.');
  });

  it('wins over as much of a pack as befriends him, and the rest fall on him there and then', () => {
    // Power is the one number (Artur, 30 Sep), and beasts follow far more of it (2 Oct): 9 knights and 34 archers are
    // three fifths as strong as Rook's 100 wolves, so a tenth of them come over, where none did before.
    const start = fresh();
    const wolves = locationById(start, 'wolves');
    const share = befriends(fightingPower(start.army), fightingPower(wolves.enemy!.army));
    expect(share).toBeGreaterThan(0.1);
    expect(share).toBeLessThan(0.15);
    const come = Math.floor(100 * share);
    expect(labels(start, 'wolves')).toContain(`Tame ${come} of the 100, and fight the rest (until dusk)`);
    const result = choose(start, 'wolves', 'tame')!;
    const s = result.state;
    expect(count(s, 'wolves')).toBe(come);
    expect(s.hero.xp).toBe(start.hero.xp + Math.round(battleXp([{ troop: 'wolves', count: come }]) / 2));
    // The rest attack: fight them, or run.
    expect(s.ambush).toBe('wolves');
    expect(s.ambushRest).toBe(true);
    expect(locationById(s, 'wolves')).toMatchObject({ done: false, enemy: { army: [{ troop: 'wolves', count: 100 - come }, { troop: 'rook', count: 1 }] } });
    const card = cardOf(result);
    expect(card.title).toBe('Rook\u2019s Wolves');
    expect(card.lines).toContain(`**${come} Wolves** join your army.`);
    const rest = card.lines.find((l) => l.endsWith('come at you!'))!;
    expect(rest).toContain(`${100 - come} Wolves`);
    // The old grey leader has just come over, so the rest don't get up the way the whole band would (#217).
    expect(card.lines).not.toContain(wolves.enemy!.threat);
    expect(card.choices.map((c) => c.label)).toEqual(['To arms!', 'Let the sergeants handle it', 'Run for it (lose a fifth of the army)']);
    expect(ambushCard(s).lines).toContain(rest);
    expect(ambushCard(s).lines).not.toContain(wolves.enemy!.threat);
    const after = choose(s, 'wolves', 'auto')!.state;
    expect(after.ambush).toBeUndefined();
    expect(after.ambushRest).toBeUndefined();
  });

  it('says who comes at him with a capital letter, though his scouts count only roughly', () => {
    // A Knight with a way with beasts hears "a few", not "3", and the line still starts a sentence.
    const knight = fresh('knight');
    const tamer: GameState = { ...knight, hero: { ...knight.hero, perks: ['beastFriend'] } };
    const result = choose(tamer, 'bears', 'tame')!;
    expect(result.state.ambushRest).toBe(true);
    const line = cardOf(result).lines.find((l) => l.endsWith('come at you!'))!;
    expect(line).toMatch(/^\*\*[A-Z]/);
    expect(ambushCard(result.state).lines).toContain(line);
  });

  it('only for an army more than half as strong as theirs: the wolves won\u2019t follow a small one, and all follow one half as strong again', () => {
    const start: GameState = { ...fresh(), army: [{ troop: 'knights', count: 3 }, { troop: 'archers', count: 10 }] };
    expect(labels(start, 'wolves')).toContain('Tame them (they don\u2019t think much of your army yet) [off]');
    expect(cardOf(visit(start, 'wolves')).lines.some((l) => l.includes('Beasts follow nobody whose army is half as strong as theirs or weaker'))).toBe(true);
    expect(choose(start, 'wolves', 'tame')).toBeNull();
    const card = cardOf(visit(grown(start), 'wolves'));
    expect(card.lines.some((l) => l.includes('the way a pack watches its leader'))).toBe(true);
    const tamed = choose(grown(start), 'wolves', 'tame')!.state;
    expect(count(tamed, 'wolves')).toBe(ALDMOOR.locations.find((l) => l.id === 'wolves')!.enemy!.army.find((x) => x.troop === 'wolves')!.count);
    expect(locationById(tamed, 'wolves').done).toBe(true);
    expect(tamed.ambush).toBeUndefined();
    // They show him their den and the old cloak, but he doesn't skin his friends: no pelt for Old Nan.
    expect(tamed.hero.gear.armour).toBe('greenwoodCloak');
    expect(tamed.flags?.wolfpelt).toBeUndefined();
    expect(tamed.gold).toBe(start.gold);
  });

  it('takes the rest of the day, so it needs half a day\u2019s riding left (Artur, 2 Oct, #167)', () => {
    const start = fresh();
    const late = { ...start, movement: Math.floor(heroStats(start).movement / 2) - 1 };
    expect(labels(late, 'boars')).toContain('Tame them (not this late in the day) [off]');
    expect(choose(late, 'boars', 'tame')).toBeNull();
    const noon = { ...start, movement: Math.ceil(heroStats(start).movement / 2) };
    expect(choose(noon, 'boars', 'tame')!.state.movement).toBe(0);
  });

  it('needs a company free in his line, but no leadership', () => {
    const full: GameState = { ...fresh(), leadership: 0, army: (['knights', 'archers', 'peasants', 'swordsmen', 'bandits'] as TroopId[]).map((troop) => ({ troop, count: 30 })) };
    expect(labels(full, 'boars')).toContain('Tame them (no room in your line) [off]');
    expect(choose(full, 'boars', 'tame')).toBeNull();
    const roomless = { ...fresh(), leadership: leadershipUsed(fresh().army) };
    expect(count(choose(roomless, 'boars', 'tame')!.state, 'boars')).toBe(9);
  });

  it('shows other heroes it can be done, and teaches it with St Aldhelm\u2019s crown or the Beast Friend perk', () => {
    const knight = fresh('knight');
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

  it('calls a mixed band\u2019s beasts away, and the rest of it falls on him at once', () => {
    const start = newGame(1066);
    const province = commissionAt(start.campaign, 2).province;
    const s: GameState = { ...grown(beginCommission(province, 5, { ...start.campaign.start, hero: { ...start.hero, background: 'ranger' } }, 2, [], start.campaign.seed)), leadership: 2000 };
    const gate = locationById(s, 'guardian');
    const wolves = gate.enemy!.army.find((x) => x.troop === 'wolves')!.count;
    expect(labels(s, 'guardian')).toContain('Tame their Wolves, and fight the rest (until dusk)');
    const after = choose(s, 'guardian', 'tame')!.state;
    expect(count(after, 'wolves')).toBe(wolves);
    const left = locationById(after, 'guardian');
    expect(left.done).toBe(false);
    expect(left.enemy!.army.some((x) => x.troop === 'wolves')).toBe(false);
    expect(left.enemy!.army.length).toBe(gate.enemy!.army.length - 1);
    expect(after.ambush).toBe('guardian');
    // The gatekeepers' relic stays with the gatekeepers.
    expect(Object.values(after.hero.gear).concat(after.hero.pack)).not.toContain(gate.artifact);
  });

  it('gives the ranger something to win over in the Fenmarch too', () => {
    const fen = beginCommission(FENMARCH, 1, { ...newGame(1066, ALDMOOR, 'ranger').campaign.start, leadership: 200 }, 1, []);
    expect(labels(fen, 'boars')).toContain('Tame them (until dusk)');
    expect(count(choose(fen, 'boars', 'tame')!.state, 'boars')).toBe(14);
  });
});

describe('tamed beasts', () => {
  it('are every wild thing that draws no wages and follows no villain, and each says how it feels about joining', () => {
    const beasts = (Object.keys(TROOPS) as TroopId[]).filter(isBeast);
    expect(beasts.sort()).toEqual(['bears', 'boars', 'spiders', 'wolves']);
    for (const b of beasts) expect(TROOPS[b].tamed, b).toBeTruthy();
    // The old King's huntsmen draw no wages either, but nobody tames them: they say why they serve.
    expect(TROOPS.huntsmen.wage).toBe(0);
    expect(isBeast('huntsmen')).toBe(false);
    expect(TROOPS.huntsmen.unpaid).toBeTruthy();
    // Nobody who draws no wages needs leadership: they just help.
    for (const t of [...beasts, 'huntsmen' as const]) expect(TROOPS[t].leadership, t).toBe(0);
    expect(leadershipUsed([{ troop: 'bears', count: 7 }, { troop: 'huntsmen', count: 12 }])).toBe(0);
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

  it('and the bot\u2019s ranger wins every time, taming only what would follow him', () => {
    // Beasts follow only as far as his army outweighs them, and the bot tames a pack only when all of it would come. Since the wolves came to guard a chest on the heath (#192), a grown ranger wins a pack of wolves over too.
    const runs = simulate([1, 2, 3, 4, 5, 6, 7, 8], 'ranger');
    expect(runs.every((r) => r.won)).toBe(true);
    for (const run of runs) for (const line of run.log.filter((l) => l.includes('tamed'))) expect(line).toMatch(/tamed (Wild Boars|A Sounder of Boars|Bears|Wolves|Rook)/);
  }, 600_000);
});
