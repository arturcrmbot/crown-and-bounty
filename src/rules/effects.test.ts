import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../content/aldmoor';
import { apply, choose, heroStats, locationById, visit, type GameState, type Location } from './game';
import { newGame } from './scenario';

const cardOf = (r: { events: { type: string }[] } | null) => r?.events.find((e) => e.type === 'card') as { card: { title: string; lines: string[]; choices: { label: string; disabled?: boolean; action: unknown }[] } } | undefined;
const fresh = (): GameState => ({ ...newGame(1, ALDMOOR, 'knight'), opening: undefined });

/** A place written only as content, to show nothing else is needed. */
const hermit: Location = {
  id: 'hermit', kind: 'event', name: 'The Hermit', at: [560, 610], done: false,
  pages: [
    {
      id: 'start', when: { notFlag: 'metHermit' }, lines: ['An old man in a barrel.'],
      choices: [
        { id: 'wolves', label: 'Ask about the wolves', effects: { flags: { metHermit: true }, troops: [{ troop: 'wolves', count: 500 }], page: 'friends' }, lines: ['"Take my dogs," he says. They are wolves.'] },
        { id: 'learn', label: 'Ask to be taught', needs: { level: 3 }, effects: { spell: 'haste', flags: { metHermit: true } } },
        { id: 'buy', label: 'Buy his barrel', needs: { gold: 200, troop: 'archers', count: 5 }, effects: { gold: 50, flags: { metHermit: true } } },
      ],
    },
    { id: 'friends', answer: true, lines: ['The wolves wag their tails.'], choices: [{ id: 'bye', label: 'Leave' }] },
    { id: 'later', when: { flag: 'metHermit' }, lines: ['The barrel is empty.'], choices: [] },
  ],
};

describe('choices written as content', () => {
  it('show the first page that holds, greying out what the hero can\u2019t do', () => {
    const state = { ...fresh(), locations: [...fresh().locations, hermit] };
    const card = cardOf(visit(state, 'hermit'))!.card;
    expect(card.title).toBe('The Hermit');
    expect(card.lines[0]).toBe('An old man in a barrel.');
    expect(card.choices.map((c) => c.label)).toEqual(['Ask about the wolves', 'Ask to be taught (level 3)', 'Buy his barrel (200 gold, 5 Archers)']);
    expect(card.choices[1].disabled).toBe(true);
    expect(apply(state, { type: 'choose', id: 'hermit', choice: 'start/learn' })).toBeNull();
  });

  it('do what they say: flags, troops as leadership allows, and the next page', () => {
    const state = { ...fresh(), locations: [...fresh().locations, hermit] };
    const result = apply(state, { type: 'choose', id: 'hermit', choice: 'start/wolves' })!;
    const s = result.state;
    expect(s.flags?.metHermit).toBe(true);
    const wolves = s.army.find((a) => a.troop === 'wolves')!.count;
    expect(wolves).toBe(Math.floor((heroStats(state).leadership - 90) / 2));
    const card = cardOf(result)!.card;
    expect(card.lines).toContain('The wolves wag their tails.');
    expect(cardOf(visit(s, 'hermit'))!.card.lines).toEqual(['The barrel is empty.']);
    // The first page no longer holds, so its choices can't be taken again.
    expect(choose(s, 'hermit', 'start/buy')).toBeNull();
  });

  it('take what they cost', () => {
    const state = { ...fresh(), locations: [...fresh().locations, hermit] };
    const s = apply(state, { type: 'choose', id: 'hermit', choice: 'start/buy' })!.state;
    expect(s.gold).toBe(state.gold - 200 + 50);
    expect(s.army.find((a) => a.troop === 'archers')!.count).toBe(15);
  });

  it('make St Aldhelm\u2019s shrine in Aldmoor, with nothing but content', () => {
    const state = fresh();
    expect(cardOf(visit(state, 'shrine'))!.card.choices.map((c) => c.label)).toEqual(['Pray for the royal goose', 'Borrow the saint\u2019s crown', 'Ride on']);
    const prayed = apply(state, { type: 'choose', id: 'shrine', choice: 'start/pray' })!.state;
    expect(prayed.flags?.goose).toBe(true);
    expect(locationById(prayed, 'shrine').done).toBe(true);
    expect(apply(prayed, { type: 'choose', id: 'shrine', choice: 'start/crown' })).toBeNull();
    expect(cardOf(visit(prayed, 'shrine'))!.card.lines).toEqual(['The shrine is quiet. The feather has gone.']);
  });
});
