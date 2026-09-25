import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../content/aldmoor';
import { COMMISSIONS } from '../content/campaign';
import { FENMARCH } from '../content/fenmarch';
import {
  apply, briefingCard, courtCard, heroStats, leadershipUsed, levelUpCard, nextArmy, provinceOf, veterans, visit, type GameState,
} from './game';
import { equip, gainXp, giveArtifact, learn } from './hero';
import { buildMap, CELL } from './map/model';
import { planRoute } from './map/movement';
import { findPath, nearestPassable } from './map/pathfinding';
import { beginCommission, newGame } from './scenario';

const fen = buildMap(FENMARCH);
const cellOf = (x: number, y: number) => ({ x: Math.floor(x / CELL), y: Math.floor(y / CELL) });

/** Aldmoor, won: a knight at level 5 with a few troops left and some gold. */
function wonAldmoor(): GameState {
  let s: GameState = { ...newGame(7, ALDMOOR, 'knight'), opening: undefined };
  s = gainXp(s, 1300).state;
  s = { ...s, hero: { ...s.hero, offers: [] } };
  s = giveArtifact(s, 'oldBanner');
  return { ...s, day: 12, gold: 900, over: 'won', bounty: 'paid', army: [{ troop: 'knights', count: 21 }, { troop: 'archers', count: 36 }, { troop: 'peasants', count: 40 }] };
}

/** Takes an action that must be allowed, and returns the new state. */
function act(state: GameState, action: Parameters<typeof apply>[1]): GameState {
  const result = apply(state, action);
  expect(result, action.type).not.toBeNull();
  return result!.state;
}

describe('the Fenmarch', () => {
  it('can reach every place from the start, over its bridges and causeways', () => {
    const start = cellOf(...FENMARCH.hero);
    for (const place of FENMARCH.locations) {
      const goal = nearestPassable(fen.grid, cellOf(...place.at), 16);
      expect(goal, place.id).not.toBeNull();
      expect(findPath(fen.grid, start, goal!), place.id).not.toBeNull();
    }
  });

  it('has a bridge for each road over the river, and none by accident', () => {
    const state = beginCommission(FENMARCH, 1, newGame().campaign.start, 1, []);
    expect(planRoute(state, fen, [1118, 214])).not.toBeNull();
    const bridges = [...fen.terrain].filter((t) => t === 7).length;
    expect(bridges).toBeGreaterThan(2);
    expect(bridges).toBeLessThan(24);
  });

  it('lets you pay the troll\u2019s toll in knights instead of fighting', () => {
    const state = beginCommission(FENMARCH, 1, newGame().campaign.start, 1, []);
    const card = apply(state, { type: 'go', id: 'troll' });
    expect(card).toBeNull();
    const paid = act(state, { type: 'parley', id: 'troll', parley: 'toll' });
    expect(paid.army.find((s) => s.troop === 'knights')!.count).toBe(8);
    expect(paid.locations.find((l) => l.id === 'troll')!.done).toBe(true);
    expect(paid.hero.xp).toBe(state.hero.xp);
    expect(planRoute(paid, fen, [1160, 880])).not.toBeNull();
    const noKnights = { ...state, army: [{ troop: 'archers' as const, count: 30 }] };
    expect(apply(noKnights, { type: 'parley', id: 'troll', parley: 'toll' })).toBeNull();
  });

  it('cannot get past the troll to Mother Mirrow until he is beaten', () => {
    const state = beginCommission(FENMARCH, 1, newGame().campaign.start, 1, []);
    expect(planRoute(state, fen, [1160, 880])).toBeNull();
    expect(planRoute(state, fen, [1046, 780])).toBeNull();
    const beaten = { ...state, locations: state.locations.map((l) => (l.id === 'troll' ? { ...l, done: true } : l)) };
    expect(planRoute(beaten, fen, [1160, 880])).not.toBeNull();
  });
});

describe('the campaign', () => {
  it('starts in Aldmoor with the opening card still to answer', () => {
    const s = newGame();
    expect(s.opening).toBe(true);
    expect(provinceOf(s).id).toBe('aldmoor');
    expect(apply(s, { type: 'background', id: 'ranger' })!.state.opening).toBeUndefined();
  });

  it('goes to court after a won commission: the King pays and offers three boons', () => {
    const won = wonAldmoor();
    const court = act(won, { type: 'court' });
    expect(court.gold).toBe(won.gold + COMMISSIONS[0].reward);
    expect(court.campaign.record).toEqual([{ chapter: 0, days: 12, level: won.hero.level }]);
    expect(new Set(court.campaign.court!.boons).size).toBe(3);
    const card = courtCard(court);
    expect(card.title).toBe('The King\u2019s Court');
    expect(card.choices).toHaveLength(3);
    // Going to court twice changes nothing.
    expect(act(court, { type: 'court' })).toEqual(court);
  });

  it('grants one boon, then reads out the next commission', () => {
    const court = act(wonAldmoor(), { type: 'court' });
    const boon = court.campaign.court!.boons[0];
    const granted = act(court, { type: 'boon', id: boon });
    expect(granted.campaign.court!.chosen).toBe(boon);
    expect(apply(granted, { type: 'boon', id: court.campaign.court!.boons[1] })).toBeNull();
    const brief = briefingCard(granted);
    expect(brief.title).toBe('Commission II: The Fenmarch');
    expect(brief.choices[0].action).toEqual({ type: 'nextCommission' });
    expect(courtCard(granted)).toEqual(brief);
  });

  it('carries the hero, his gear and purse into the Fenmarch, with a fresh levy and a few veterans', () => {
    const court = act(wonAldmoor(), { type: 'court' });
    const granted = act(court, { type: 'boon', id: court.campaign.court!.boons[0] });
    const result = apply(granted, { type: 'nextCommission' })!;
    const next = result.state;
    expect(result.events[0].type).toBe('commission');
    expect(provinceOf(next).id).toBe('fenmarch');
    expect(next.campaign.chapter).toBe(1);
    expect(next.day).toBe(1);
    expect(next.over).toBeUndefined();
    expect(next.bounty).toBe('open');
    expect(next.hero.level).toBe(granted.hero.level);
    expect(next.hero.gear).toEqual(granted.hero.gear);
    expect(next.hero.at).toEqual(FENMARCH.hero);
    expect(next.gold).toBe(granted.gold);
    expect(next.locations.map((l) => l.id)).toEqual(FENMARCH.locations.map((l) => l.id));
    // The levy (10 knights, 20 archers) plus a quarter of each stack, within leadership.
    expect(veterans(granted.army)).toEqual([{ troop: 'knights', count: 5 }, { troop: 'archers', count: 9 }, { troop: 'peasants', count: 10 }]);
    expect(next.army).toEqual(nextArmy(granted));
    expect(next.army.find((s) => s.troop === 'knights')!.count).toBe(15);
    expect(leadershipUsed(next.army)).toBeLessThanOrEqual(heroStats(next).leadership);
    expect(next.hero.mana).toBe(heroStats(next).maxMana);
  });

  it('keeps veterans within leadership', () => {
    const won = { ...wonAldmoor(), army: [{ troop: 'knights' as const, count: 200 }] };
    const army = nextArmy(won);
    expect(leadershipUsed(army)).toBeLessThanOrEqual(heroStats(won).leadership);
    expect(army.find((s) => s.troop === 'knights')!.count).toBeGreaterThan(10);
  });

  it('offers a lost commission again, from how it began', () => {
    const s = beginCommission(FENMARCH, 3, { hero: newGame().hero, gold: 4000, leadership: 200, army: [{ troop: 'knights', count: 30 }] }, 1, [{ chapter: 0, days: 9, level: 5 }]);
    const lost = { ...s, day: 101, gold: 12, army: [], over: 'lost' as const };
    const again = act(lost, { type: 'retry' });
    expect(again.day).toBe(1);
    expect(again.gold).toBe(4000);
    expect(again.army).toEqual([{ troop: 'knights', count: 30 }]);
    expect(again.campaign.chapter).toBe(1);
    expect(again.campaign.record).toEqual(s.campaign.record);
    expect(apply(s, { type: 'retry' })).toBeNull();
  });

  it('ends after the last commission, with no court to go to', () => {
    const last = { ...beginCommission(FENMARCH, 3, newGame().campaign.start, COMMISSIONS.length - 1, []), over: 'won' as const };
    expect(apply(last, { type: 'court' })).toBeNull();
  });

  it('keeps every state JSON-safe, court and all', () => {
    const court = act(wonAldmoor(), { type: 'court' });
    const granted = act(court, { type: 'boon', id: court.campaign.court!.boons[0] });
    const next = act(granted, { type: 'nextCommission' });
    for (const s of [court, granted, next]) expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});

describe('level-ups and gear', () => {
  it('never offer a perk twice, even when two levels come at once', () => {
    let s: GameState = newGame(35, ALDMOOR, 'knight');
    s = { ...s, hero: { ...s.hero, offers: [{ level: 2, stat: 'attack', options: ['perk:treasureHunter', 'skill:archery', 'skill:logistics'] }, { level: 3, stat: 'attack', options: ['perk:treasureHunter', 'skill:leadership', 'skill:scouting'] }] } };
    const after = learn(s, 'perk:treasureHunter')!.state;
    expect(after.hero.perks).toEqual(['treasureHunter']);
    expect(after.hero.offers[0].options).not.toContain('perk:treasureHunter');
    expect(learn({ ...after, hero: { ...after.hero, offers: [{ level: 3, stat: 'attack', options: ['perk:treasureHunter'] }] } }, 'perk:treasureHunter')).toBeNull();
    expect(levelUpCard(after)!.choices).toHaveLength(3);
  });

  it('never raise a skill past Expert', () => {
    const s = newGame(1, ALDMOOR, 'knight');
    const expert = { ...s, hero: { ...s.hero, skills: { archery: 3 }, offers: [{ level: 2, stat: 'attack' as const, options: ['skill:archery'] }] } };
    expect(learn(expert, 'skill:archery')).toBeNull();
  });

  it('take mana away with the knowledge that gave it', () => {
    let s = newGame(1, ALDMOOR, 'knight');
    s = giveArtifact(s, 'millersLoaf');
    s = { ...s, hero: { ...s.hero, mana: heroStats(s).maxMana } };
    s = giveArtifact(s, 'wizardsButton');
    s = giveArtifact(s, 'luckyHorseshoe');
    const swapped = equip(s, 'luckyHorseshoe')!.state;
    expect(swapped.hero.mana).toBe(heroStats(swapped).maxMana);
    expect(swapped.hero.mana).toBeLessThan(s.hero.mana);
  });
});

describe('parleys', () => {
  it('show every way past, greyed out when the hero is the wrong sort or can\u2019t pay', () => {
    const knight = { ...newGame(1, ALDMOOR, 'knight'), opening: undefined };
    const card = (s: GameState, id: string) => {
      const e = visit(s, id).events.find((x) => x.type === 'card');
      return e?.type === 'card' ? e.card : null;
    };
    const pardon = card(knight, 'hideout')!.choices.find((c) => c.label.startsWith('Talk the Baron round'))!;
    expect(pardon.label).toBe('Talk the Baron round (Courtier)');
    expect(pardon.disabled).toBe(true);
    const courtier = { ...newGame(1, ALDMOOR, 'courtier'), opening: undefined };
    expect(card(courtier, 'hideout')!.choices.find((c) => c.label.startsWith('Talk the Baron round'))!.disabled).toBeUndefined();
    const broke = { ...knight, gold: 100 };
    expect(card(broke, 'patrol')!.choices.find((c) => c.label.startsWith('Pay them to go home'))!.disabled).toBe(true);
  });

  it('let a courtier take Grimsby without a fight, for a smaller bounty', () => {
    const courtier = { ...newGame(1, ALDMOOR, 'courtier'), opening: undefined };
    const result = apply(courtier, { type: 'parley', id: 'hideout', parley: 'pardon' })!;
    expect(result.state.over).toBe('won');
    expect(result.state.bounty).toBe('paid');
    expect(result.state.gold).toBe(courtier.gold + 1000);
    expect(result.state.hero.xp).toBe(450);
    const bounty = result.events.find((e) => e.type === 'card');
    expect(bounty?.type === 'card' && bounty.card.title).toBe('The bounty is paid!');
    expect(apply({ ...newGame(1, ALDMOOR, 'knight') }, { type: 'parley', id: 'hideout', parley: 'pardon' })).toBeNull();
  });

  it('let anyone pay the patrol to go home, which costs gold and gains nothing', () => {
    const s = { ...newGame(1, ALDMOOR, 'knight'), opening: undefined };
    const paid = apply(s, { type: 'parley', id: 'patrol', parley: 'bribe' })!;
    expect(paid.state.gold).toBe(s.gold - 400);
    expect(paid.state.hero.xp).toBe(0);
    expect(paid.state.locations.find((l) => l.id === 'patrol')!.done).toBe(true);
    expect(paid.events[0]).toEqual({ type: 'removed', id: 'patrol' });
  });
});
