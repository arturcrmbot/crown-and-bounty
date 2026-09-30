import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../content/aldmoor';
import { COMMISSIONS } from '../content/campaign';
import { FRIENDS } from '../content/friends';
import { FENMARCH } from '../content/fenmarch';
import { afterVictory } from './fight';
import {
  apply, briefingCard, commissionAt, courtCard, friendsOf, happened, heroSheet, heroStats, memoriesOf, nextArmy, speechCard, type BoonId, type FlagValue, type GameState, type Result,
} from './game';
import { beginCommission, newGame } from './scenario';

/** Aldmoor, won, with these things having happened on the way. */
function wonAldmoor(flags: Record<string, FlagValue> = {}, background: 'knight' | 'courtier' = 'knight'): GameState {
  const s = { ...newGame(7, ALDMOOR, background), opening: undefined };
  return { ...s, day: 14, gold: 900, over: 'won', bounty: 'paid', flags, army: [{ troop: 'knights', count: 21 }, { troop: 'archers', count: 36 }] };
}

function act(state: GameState, action: Parameters<typeof apply>[1]): GameState {
  const result = apply(state, action);
  expect(result, action.type).not.toBeNull();
  return result!.state;
}

const cardOf = (result: Result) => {
  const e = result.events.find((x) => x.type === 'card');
  if (!e || e.type !== 'card') throw new Error('no card');
  return e.card;
};

/** Everything that happens to a hero who did right by Pike, the goose, Old Nan and the dwarf. */
const KIND = { pike: false, goose: false, wolfpelt: false, dwarf: 'friend', tower: 'journal', aldhelm: 'prayed' };

describe('the court remembers', () => {
  it('reads story flags: true for anything set, anything else exactly, and false for a flag spent', () => {
    const s = wonAldmoor({ goose: false, dwarf: 'friend', aldhelm: 'prayed' });
    expect(happened(s, { goose: false })).toBe(true);
    expect(happened(s, { goose: true })).toBe(false);
    expect(happened(s, { aldhelm: true, dwarf: 'friend' })).toBe(true);
    expect(happened(s, { dwarf: 'robbed' })).toBe(false);
    expect(happened(s, { pike: false })).toBe(false);
    expect(happened(s, {})).toBe(true);
  });

  it('has the King say up to three things you did, the most telling first', () => {
    const court = act(wonAldmoor(KIND), { type: 'court' });
    const memories = memoriesOf(court);
    expect(memories).toHaveLength(3);
    expect(memories[0]).toContain('Sergeant Pike is home with his mother');
    expect(memories[1]).toContain('whistled St Aldhelm\u2019s hymn');
    expect(memories[2]).toContain('Old Nan sends her thanks for the wolf pelt');
    const speech = speechCard(court);
    expect(speech.title).toBe('The King\u2019s Court');
    expect(speech.lines).toEqual([COMMISSIONS[0].praise, ...memories]);
    expect(speech.choices.map((c) => c.action)).toEqual([{ type: 'close' }]);
  });

  it('remembers what another hero did differently, and has a plain word for one who did none of it', () => {
    const robber = memoriesOf(wonAldmoor({ dwarf: 'robbed', tower: 'banner', miller: 'loaf' }));
    expect(robber).toEqual([expect.stringContaining('ore cart'), expect.stringContaining('old Pike\u2019s banner'), expect.stringContaining('miller\u2019s loaf')]);
    expect(memoriesOf(wonAldmoor())).toEqual(['"You went straight at him, and no nonsense. I like that in an officer."']);
    // Hints the rules record for themselves are no memories.
    expect(memoriesOf(wonAldmoor({ 'hint:ride': true, 'hint:place': true }))).toHaveLength(1);
  });

  it('has its own memories for every commission, generated provinces included', () => {
    const fen = { ...beginCommission(FENMARCH, 3, newGame().campaign.start, 1, [{ chapter: 0, days: 9, level: 3 }]), flags: { anselm: false, peat: 'punt' } };
    expect(memoriesOf(fen)).toEqual([expect.stringContaining('Brother Anselm writes'), expect.stringContaining('in a punt')]);
    const start = newGame(5, ALDMOOR, 'knight');
    const third = beginCommission(commissionAt(start.campaign, 2).province, 5, start.campaign.start, 2, [], start.campaign.seed);
    const weakness = commissionAt(start.campaign, 2).memories!.find((m) => m.when?.weakness === false)!;
    expect(memoriesOf({ ...third, flags: { weakness: false, mine: 'deep', tower: 'note' } })).toEqual([weakness.line, expect.stringContaining('went down further'), expect.stringContaining('watchman')]);
    expect(memoriesOf(third)).toEqual([expect.stringContaining('I like that in an officer')]);
  });
});

describe('a boon carries someone forward', () => {
  it('offers the people you helped, up to two of them, beside at least one of the King\u2019s own boons', () => {
    expect(friendsOf(wonAldmoor(KIND))).toEqual(['pike', 'nan', 'dwarf']);
    const court = act(wonAldmoor(KIND), { type: 'court' });
    const boons = court.campaign.court!.boons;
    expect(boons).toHaveLength(3);
    expect(boons.filter((b) => b in FRIENDS)).toHaveLength(2);
    // The King's favourite gets four: still no more than two of them people.
    const favourite = act({ ...wonAldmoor(KIND), hero: { ...wonAldmoor(KIND).hero, perks: ['favourite'] } }, { type: 'court' });
    expect(favourite.campaign.court!.boons.filter((b) => b in FRIENDS)).toHaveLength(2);
    expect(favourite.campaign.court!.boons).toHaveLength(4);
    // One person, and two of the King's boons.
    const one = act(wonAldmoor({ wolfpelt: false }), { type: 'court' }).campaign.court!.boons;
    expect(one[0]).toBe('nan');
    expect(one.slice(1).every((b) => !(b in FRIENDS))).toBe(true);
    // A hero who helped nobody gets the King's boons, as before.
    expect(act(wonAldmoor(), { type: 'court' }).campaign.court!.boons.some((b) => b in FRIENDS)).toBe(false);
  });

  it('shows each person with their face and what they would do, and the King\u2019s boons with theirs', () => {
    const court = act(wonAldmoor({ pike: false }), { type: 'court' });
    const card = courtCard(court);
    expect(card.title).toBe('The King\u2019s Thanks');
    expect(card.lines).toEqual(['Commission I took **14 days**. The King adds **1,500 gold** to your purse, and offers you a boon of your choice.']);
    const pike = card.choices.find((c) => c.action.type === 'boon' && c.action.id === 'pike')!;
    expect(pike).toMatchObject({ label: 'Sergeant Pike', portrait: 'sergeant' });
    expect(pike.detail).toContain('**20 swordsmen**');
    for (const choice of card.choices.filter((c) => c !== pike)) expect(choice.detail).toBeTruthy();
  });

  it('brings Sergeant Pike and his lads into the next commission, and his drill for good', () => {
    const court = act({ ...wonAldmoor({ pike: false }), leadership: 200 }, { type: 'court' });
    const granted = act(court, { type: 'boon', id: 'pike' });
    expect(granted.hero.friends).toEqual(['pike']);
    expect(heroStats(granted).troops.swordsmen).toEqual({ attack: 1, defence: 1, shots: 0 });
    const army = nextArmy(granted);
    expect(army.find((s) => s.troop === 'swordsmen')?.count).toBe(20);
    const brief = briefingCard(granted);
    expect(brief.lines).toContain('**Sergeant Pike** rides with you.');
    expect(brief.lines.at(-1)).toContain('20 Swordsmen');
    const result = apply(granted, { type: 'nextCommission' })!;
    expect(result.state.army).toEqual(army);
    expect(result.state.campaign.start.hero.friends).toEqual(['pike']);
    expect(cardOf(result).lines).toContain(FRIENDS.pike.arrival);
    // Trying the commission again keeps him, and his lads.
    const again = act({ ...result.state, over: 'lost', army: [] }, { type: 'retry' });
    expect(again.hero.friends).toEqual(['pike']);
    expect(again.army.find((s) => s.troop === 'swordsmen')?.count).toBe(20);
    // He shows on the hero screen, and isn't offered again.
    expect(heroSheet(result.state).company).toEqual([{ name: 'Sergeant Pike', note: FRIENDS.pike.note }]);
    expect(friendsOf({ ...granted, flags: { pike: false } })).toEqual([]);
  });

  it('brings only as many of his lads as the hero can lead', () => {
    const court = act({ ...wonAldmoor({ pike: false }), leadership: 100 }, { type: 'court' });
    const granted = act(court, { type: 'boon', id: 'pike' });
    const room = heroStats(granted).leadership - 90;
    expect(nextArmy(granted).find((s) => s.troop === 'swordsmen')?.count).toBe(Math.floor(room / 3));
  });

  it('has Old Nan put a tenth of the fallen back on their feet after a won battle', () => {
    const court = act(wonAldmoor({ wolfpelt: false }), { type: 'court' });
    const granted = act(court, { type: 'boon', id: 'nan' });
    expect(heroStats(granted).mend).toBe(0.1);
    const before = [{ troop: 'archers' as const, count: 30 }];
    const after = afterVictory({ ...granted, army: [{ troop: 'archers', count: 10 }] }, before);
    expect(after.state.army).toEqual([{ troop: 'archers', count: 12 }]);
    expect(after.lines).toContain('**2 Archers** get back on their feet.');
  });

  it('lets the dwarf smell out treasure, and Brother Anselm lift spirits', () => {
    const dwarf = act(act(wonAldmoor({ dwarf: 'friend' }), { type: 'court' }), { type: 'boon', id: 'dwarf' });
    expect(heroStats(dwarf)).toMatchObject({ smells: 300, loot: 0.25 });
    const fen = { ...beginCommission(FENMARCH, 3, newGame().campaign.start, 1, [{ chapter: 0, days: 9, level: 3 }]), over: 'won' as const, bounty: 'paid' as const, flags: { anselm: false } };
    const court = act(fen, { type: 'court' });
    expect(court.campaign.court!.boons).toContain('anselm');
    expect(heroStats(act(court, { type: 'boon', id: 'anselm' })).morale).toBeCloseTo(0.1);
  });

  it('keeps friends through the whole campaign, JSON-safe', () => {
    const court = act(wonAldmoor({ pike: false }), { type: 'court' });
    const granted = act(court, { type: 'boon', id: 'pike' as BoonId });
    const next = act(granted, { type: 'nextCommission' });
    for (const s of [court, granted, next]) expect(JSON.parse(JSON.stringify(s))).toEqual(s);
    // Old saves have no friends at all.
    const old = { ...next, hero: { ...next.hero, friends: undefined } };
    expect(heroSheet(old).company).toEqual([]);
    expect(heroStats(old).troops.swordsmen).toBeUndefined();
  });
});
