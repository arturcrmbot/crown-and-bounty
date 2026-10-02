import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../content/aldmoor';
import { COMMISSIONS, type Clue } from '../content/campaign';
import { autoResolve } from './battle/ai';
import { apply, bountyOf, endDay, finishFight, heardOf, journalCard, startFight, visit, type GameState } from './game';
import { newGame } from './scenario';

const fresh = (): GameState => ({ ...newGame(1066, ALDMOOR, 'knight'), opening: undefined });
const take = (state: GameState, id: string, choice: string) => {
  const result = apply(state, { type: 'choose', id, choice });
  expect(result, `${id} ${choice}`).not.toBeNull();
  return result!.state;
};
const flagged = (state: GameState, flags: GameState['flags']): GameState => ({ ...state, flags: { ...state.flags, ...flags } });
/** What the journal has heard, in its order: who said it, ticked or not. */
const heard = (state: GameState) => heardOf(state).map((h) => `${h.done ? '[x]' : '[ ]'} ${h.who}`);

describe('the journal', () => {
  it('hears on payday that the villain has more men, where the payday card used to say it (#155)', () => {
    const eve = { ...fresh(), day: 7 };
    const payday = endDay(eve);
    const card = payday.events.find((e) => e.type === 'card');
    expect(card?.type === 'card' && card.card.lines[0]).toMatch(/^\*\*Payday!\*\*/);
    expect(card?.type === 'card' && card.card.lines.join(' ')).not.toMatch(/more men have joined/);
    expect(heardOf(eve).some((h) => h.who === 'the talk on payday')).toBe(false);
    expect(heardOf(payday.state)).toContainEqual({ who: 'the talk on payday', words: 'More men have joined **Grimsby\u2019s Hideout**.', done: false });
  });

  it('opens on the commission: the poster pinned in, the reward, the day and the pieces of the old map', () => {
    const card = journalCard({ ...fresh(), day: 5 });
    expect(card.title).toBe('Journal');
    expect(card.portrait).toBe('grimsby');
    expect(card.stamp).toBeUndefined();
    expect(card.lines).toEqual([
      'You are in Aldmoor on **Commission I**. It is day V of 100, and you have **95 days** left.',
      `**Baron Grimsby**, wanted ${COMMISSIONS[0].wanted}`,
      `Reward: **${bountyOf(fresh()).toLocaleString('en-GB')} gold**.`,
      '*You have 0 of the 5 pieces of the old map.*',
    ]);
    // Nothing heard yet, but the page is there for it.
    expect(card.journal?.heard).toEqual([]);
    expect(card.choices.map((c) => c.label)).toEqual(['Close']);
  });

  it('stamps the poster PAID once he is taken, with what the Crown paid, and a piece of the old map', () => {
    const started = startFight({ ...fresh(), army: [{ troop: 'knights', count: 400 }] }, 'hideout')!.state;
    const won = finishFight({ ...started, battle: autoResolve(started.battle!) }).state;
    expect(won.bounty).toBe('paid');
    const card = journalCard(won);
    expect(card.stamp).toBe('PAID');
    expect(card.lines[0]).toBe('You are in Aldmoor on **Commission I**. It is day I of 100.');
    expect(card.lines[2]).toContain('paid in full');
    expect(card.lines[3]).toBe('*You have 1 of the 5 pieces of the old map.*');
  });

  it('writes down what is heard on the road, and ticks it off once it pays off, below what is still open', () => {
    let state = fresh();
    expect(heardOf(state)).toEqual([]);
    // Old Nan on her doorstep: a good warm wolf pelt, and she'll show you something hotter.
    state = visit(state, 'nan').state;
    expect(heard(state)).toEqual(['[ ] Old Nan']);
    expect(heardOf(state)[0].words).toContain('wolf pelt');
    // Asked about the Baron, she sings the lullaby: heard, and not sung yet.
    state = take(state, 'nan', 'door/baron');
    expect(heard(state)).toEqual(['[ ] Old Nan', '[ ] Old Nan, of the Baron']);
    // The pelt, won off Rook's wolves and given to her: ticked off, and down below what's still open.
    state = take(flagged(state, { wolfpelt: true }), 'nan', 'hearth/fire');
    expect(heard(state)).toEqual(['[ ] Old Nan, of the Baron', '[x] Old Nan']);
    // The hunt hall, seen shut, and asked about: the key at the lodge. Taken, it's ticked off, and
    // still heard, though the key has changed what the lodge's flag says.
    state = take(visit(state, 'hall').state, 'nan', 'hearth/hall');
    expect(heard(state)).toContain('[ ] Old Nan, of the hunt hall');
    state = take(state, 'lodge', 'nail/key');
    expect(state.flags?.lodge).toBe('key');
    expect(heard(state)).toContain('[x] Old Nan, of the hunt hall');
    // The key itself says what it opens (#172), until the hall is open.
    expect(heard(state)).toContain('[ ] the key from the old King\u2019s lodge');
    expect(heardOf(state).find((h) => h.who.includes('key'))!.words).toMatch(/hunt hall by the bridge/);
    state = take(state, 'hall', 'door/open');
    expect(heard(state)).toContain('[x] the key from the old King\u2019s lodge');
    // A flag spent still counts as heard: the lullaby, sung at his walls, is ticked, not forgotten.
    expect(heard(flagged(state, { lullaby: false }))).toEqual(['[ ] the old King\u2019s huntsmen', '[x] Old Nan', '[x] Old Nan, of the Baron', '[x] Old Nan, of the hunt hall', '[x] the key from the old King\u2019s lodge']);
  });

  it('ticks off a place found, and leaves a question hanging open', () => {
    const spared = flagged(fresh(), { poachers: 'spared', dig: 'raided' });
    const withCache = { ...spared, locations: [...spared.locations, { id: 'cache', kind: 'chest' as const, name: 'The Poachers\u2019 Cache', at: [1700, 1600] as [number, number], done: false }] };
    expect(heard(withCache)).toEqual(['[ ] the Baron\u2019s orders, pinned to a spade', '[ ] the youngest poacher']);
    const opened = { ...withCache, locations: withCache.locations.map((l) => (l.id === 'cache' ? { ...l, done: true } : l)) };
    expect(heard(opened)).toEqual(['[ ] the Baron\u2019s orders, pinned to a spade', '[x] the youngest poacher']);
  });

  it('quotes everything as it was said or written in the province, and every flag and place it waits on is there', () => {
    for (const c of COMMISSIONS) {
      const text = JSON.stringify(c.province);
      for (const r of c.heard ?? []) {
        // Each sentence, as said: a comma before "says the eldest" may end a sentence here.
        for (const sentence of r.words.split(/(?<=[.?!]) /)) expect(text, r.who).toContain(sentence.replace(/[.,!?]$/, ''));
        for (const clue of [r.heard, r.done].filter((x): x is Clue => Boolean(x))) {
          for (const flag of Object.keys(clue.flags ?? {})) expect(text, `${r.who}: ${flag}`).toContain(`"${flag}":`);
          for (const place of [clue.seen, clue.used].filter(Boolean)) expect(text, `${r.who}: ${place}`).toContain(`"id":"${place}"`);
        }
      }
    }
  });
});

describe('the journal\u2019s tally of things found', () => {
  it('counts the chests he has opened, of all the province has', () => {
    const start = fresh();
    const chests = (state: GameState) => journalCard(state).journal?.found?.find((f) => f.what === 'Chests opened');
    expect(chests(start)).toEqual({ what: 'Chests opened', got: 0, of: 9 });
    const opened = take(start, 'hedgeChest', 'keep');
    expect(chests(opened)).toEqual({ what: 'Chests opened', got: 1, of: 9 });
  });
});
