import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../content/aldmoor';
import type { Slot } from '../content/artifacts';
import { COMMISSIONS } from '../content/campaign';
import { FENMARCH } from '../content/fenmarch';
import { withNewPlaces } from './campaign';
import {
  apply, briefingCard, CAMPAIGN_LENGTH, commissionAt, courtCard, heroStats, leadershipUsed, levelUpCard, nextArmy, provinceOf, veterans, visit, type GameState,
} from './game';
import { gainXp, giveArtifact, learn, unequip } from './hero';
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
    const paid = act(state, { type: 'choose', id: 'troll', choice: 'parley/toll' });
    expect(paid.army.find((s) => s.troop === 'knights')!.count).toBe(8);
    expect(paid.locations.find((l) => l.id === 'troll')!.done).toBe(true);
    expect(paid.hero.xp).toBe(state.hero.xp);
    expect(planRoute(paid, fen, [1160, 880])).not.toBeNull();
    const noKnights = { ...state, army: [{ troop: 'archers' as const, count: 30 }] };
    expect(apply(noKnights, { type: 'choose', id: 'troll', choice: 'parley/toll' })).toBeNull();
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
    expect(card.title).toBe('The King\u2019s Thanks');
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
    const last = { ...beginCommission(FENMARCH, 3, newGame().campaign.start, CAMPAIGN_LENGTH - 1, []), over: 'won' as const };
    expect(apply(last, { type: 'court' })).toBeNull();
  });

  it('keeps every state JSON-safe, court and all', () => {
    const court = act(wonAldmoor(), { type: 'court' });
    const granted = act(court, { type: 'boon', id: court.campaign.court!.boons[0] });
    const next = act(granted, { type: 'nextCommission' });
    for (const s of [court, granted, next]) expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });

  it('gives a saved commission the places added to its province since', () => {
    const played = { ...newGame(7, ALDMOOR, 'knight'), opening: undefined, gold: 123 };
    const old = { ...played, locations: played.locations.filter((l) => l.id !== 'butts') };
    const loaded = withNewPlaces(JSON.parse(JSON.stringify(old)));
    expect(loaded.locations.find((l) => l.id === 'butts')?.recruits).toEqual({ troop: 'archers', count: 12, price: 30 });
    expect(loaded.gold).toBe(123);
    expect(withNewPlaces(played)).toBe(played);
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
    s = giveArtifact(s, 'astrolabe');
    s = { ...s, hero: { ...s.hero, mana: heroStats(s).maxMana } };
    s = giveArtifact(s, 'wizardsButton');
    s = giveArtifact(s, 'luckyHorseshoe');
    const knowledge = (Object.keys(s.hero.gear) as Slot[]).find((slot) => s.hero.gear[slot] === 'astrolabe')!;
    expect(knowledge).toBeDefined();
    const off = unequip(s, knowledge)!.state;
    expect(off.hero.gear[knowledge]).toBeUndefined();
    expect(off.hero.mana).toBe(heroStats(off).maxMana);
    expect(off.hero.mana).toBeLessThan(s.hero.mana);
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
    const result = apply(courtier, { type: 'choose', id: 'hideout', choice: 'parley/pardon' })!;
    expect(result.state.over).toBe('won');
    expect(result.state.bounty).toBe('paid');
    expect(result.state.gold).toBe(courtier.gold + 1000);
    expect(result.state.hero.xp).toBe(450);
    const bounty = result.events.find((e) => e.type === 'card');
    expect(bounty?.type === 'card' && bounty.card.title).toBe('The bounty is paid!');
    expect(apply({ ...newGame(1, ALDMOOR, 'knight') }, { type: 'choose', id: 'hideout', choice: 'parley/pardon' })).toBeNull();
  });

  it('let anyone pay the patrol to go home, which costs gold and gains nothing', () => {
    const s = { ...newGame(1, ALDMOOR, 'knight'), opening: undefined };
    const paid = apply(s, { type: 'choose', id: 'patrol', choice: 'parley/bribe' })!;
    expect(paid.state.gold).toBe(s.gold - 900);
    expect(paid.state.hero.xp).toBe(0);
    expect(paid.state.locations.find((l) => l.id === 'patrol')!.done).toBe(true);
    expect(paid.events[0]).toEqual({ type: 'removed', id: 'patrol' });
  });
});

describe('the end of a commission', () => {
  it('stops the days: no paydays once it is won or lost', () => {
    const won = wonAldmoor();
    expect(apply(won, { type: 'endDay' })).toBeNull();
    expect(apply({ ...won, over: 'lost' }, { type: 'endDay' })).toBeNull();
  });
});

describe('the end of the campaign', () => {
  it('turns the last bounty into an X on the map, and digging there wins the campaign', () => {
    const start = newGame(5, ALDMOOR, 'knight');
    const province = commissionAt(start.campaign, CAMPAIGN_LENGTH - 1).province;
    const last = beginCommission(province, 5, start.campaign.start, CAMPAIGN_LENGTH - 1, [], start.campaign.seed);
    const hideout = last.locations.find((l) => l.kind === 'hideout')!;
    const strong = { ...last, army: [{ troop: 'knights' as const, count: 4000 }] };
    const won = apply(strong, { type: 'choose', id: hideout.id, choice: 'auto' })!;
    expect(won.state.bounty).toBe('paid');
    expect(won.state.over).toBeUndefined();
    expect(won.events.some((e) => e.type === 'added' && e.id === 'sceptre')).toBe(true);
    const x = won.state.locations.find((l) => l.id === 'sceptre')!;
    expect(x.at).toEqual(province.sceptre);
    const dug = apply(won.state, { type: 'choose', id: 'sceptre', choice: 'dig' })!;
    expect(dug.state.over).toBe('won');
    const card = dug.events.find((e) => e.type === 'card');
    expect(card?.type === 'card' && card.card.title).toBe('The Sceptre of Order!');
    expect(apply(dug.state, { type: 'choose', id: 'sceptre', choice: 'dig' })).toBeNull();
  });

  it('gives a piece of the map with every bounty', () => {
    const won = apply({ ...newGame(), opening: undefined, army: [{ troop: 'knights', count: 4000 }] }, { type: 'choose', id: 'hideout', choice: 'auto' })!;
    const card = won.events.find((e) => e.type === 'card');
    expect(card?.type === 'card' && card.card.lines.some((l) => l.includes('**1 of 5**'))).toBe(true);
  });
});

describe('parleys, carefully', () => {
  it('turn up the place\u2019s artifact when they count as a win', () => {
    const courtier = { ...newGame(1, ALDMOOR, 'courtier'), opening: undefined };
    const won = apply(courtier, { type: 'choose', id: 'hideout', choice: 'parley/pardon' })!;
    expect(Object.values(won.state.hero.gear).concat(won.state.hero.pack)).toContain('goldenFeather');
  });

  it('never take a whole army as a toll, and nobody fights with no army', () => {
    const state = beginCommission(FENMARCH, 1, newGame().campaign.start, 1, []);
    const two = { ...state, army: [{ troop: 'knights' as const, count: 2 }] };
    expect(apply(two, { type: 'choose', id: 'troll', choice: 'parley/toll' })).toBeNull();
    const none = { ...state, army: [] };
    expect(apply(none, { type: 'choose', id: 'goblins', choice: 'auto' })).toBeNull();
    expect(apply(none, { type: 'choose', id: 'goblins', choice: 'fight' })).toBeNull();
    const card = visit(none, 'goblins').events.find((e) => e.type === 'card');
    expect(card?.type === 'card' && card.card.lines.some((l) => l.includes('no troops'))).toBe(true);
  });
});

describe('the campaign seed', () => {
  it('builds the province read out at court, even for an old save without a seed', () => {
    const court = act({ ...wonAldmoor(), campaign: { ...wonAldmoor().campaign, chapter: 1 } }, { type: 'court' });
    const old = { ...court, campaign: { ...court.campaign, seed: undefined } };
    const briefed = act(old, { type: 'boon', id: old.campaign.court!.boons[0] });
    const next = act(briefed, { type: 'nextCommission' });
    expect(provinceOf(next).name).toBe(commissionAt(old.campaign, 2).province.name);
    expect(next.hero.at).toEqual(provinceOf(next).hero);
  });

  it('gives each campaign its own later provinces', () => {
    const a = commissionAt(newGame(1).campaign, 2).province;
    const b = commissionAt(newGame(2).campaign, 2).province;
    expect(a.hero).not.toEqual(b.hero);
  });
});
