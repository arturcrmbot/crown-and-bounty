import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../content/aldmoor';
import { apply, update, visit, type Card, type GameState, type Location, type Result } from './game';
import { mapOf } from './map/maps';
import { daysAway } from './map/movement';
import { PLACE_KINDS } from './places';
import { newGame } from './scenario';

const fresh = (): GameState => ({ ...newGame(1066, ALDMOOR, 'knight'), opening: undefined });
const withPlaces = (state: GameState, ...places: Location[]): GameState => ({ ...state, locations: [...state.locations, ...places] });
const cardOf = (result: Result): Card => {
  const e = result.events.find((x) => x.type === 'card');
  if (!e || e.type !== 'card') throw new Error('no card');
  return e.card;
};
const choose = (state: GameState, id: string, choice: string) => {
  const result = apply(state, { type: 'choose', id, choice });
  expect(result, `${id} ${choice}`).not.toBeNull();
  return result!;
};
const placeOf = (state: GameState, id: string) => state.locations.find((l) => l.id === id)!;

const GOLD: Location = { id: 'testChest', kind: 'chest', name: 'Treasure Chest', at: [3000, 1100], done: false, gold: 150 };
const SCROLL: Location = {
  id: 'scrollChest',
  kind: 'chest',
  name: 'Treasure Chest',
  at: [3000, 1100],
  done: false,
  pages: [
    {
      id: 'scroll',
      when: { notSpell: 'slow' },
      lines: ['Inside, wrapped in oilcloth, is a scroll with a charm written on it.'],
      choices: [{ id: 'read', label: 'Read the charm', effects: { spell: 'slow', done: true } }],
    },
    { id: 'known', lines: ['Inside is a scroll with a charm you know already.'], choices: [{ id: 'keep', label: 'Read the notes in its margins', effects: { xp: 100, done: true } }] },
  ],
};
const MAP: Location = {
  id: 'mapChest',
  kind: 'chest',
  name: 'Treasure Chest',
  at: [3000, 1100],
  done: false,
  pages: [{ id: 'map', lines: ['Inside is a map of the King\u2019s chase.'], choices: [{ id: 'look', label: 'Study the map', effects: { reveal: { at: [2400, 2000], radius: 400 }, done: true } }] }],
};
const WOLVES: Location = {
  id: 'testWolves',
  kind: 'patrol',
  name: 'A Pack of Wolves',
  at: [3040, 1100],
  done: false,
  enemy: { look: 'wolves', tier: 'band', behaviour: 'guard', lines: ['Wolves lie round the chest.'], army: [{ troop: 'wolves', count: 12 }], reward: 40, threat: 'The wolves get up.', flees: 'The wolves run.', loot: 'You find {gold}.' },
};
const GUARDED: Location = {
  id: 'guardedChest',
  kind: 'chest',
  name: 'Treasure Chest',
  at: [3000, 1100],
  done: false,
  guard: 'testWolves',
  pages: [{ id: 'button', lines: ['Inside lies a brass button.'], choices: [{ id: 'take', label: 'Take the button', effects: { artifact: 'wizardsButton', done: true } }] }],
};

describe('a treasure chest', () => {
  it('stays on the map once it is opened, open and empty', () => {
    const state = withPlaces(fresh(), GOLD);
    expect(cardOf(visit(state, 'testChest')).choices.map((c) => c.label)).toEqual(['Keep the gold', 'Hand it out (+8 leadership)']);
    const opened = choose(state, 'testChest', 'keep');
    expect(opened.state.gold).toBe(state.gold + 150);
    expect(placeOf(opened.state, 'testChest').done).toBe(true);
    expect(opened.events).toContainEqual({ type: 'changed', id: 'testChest' });
    expect(opened.events.some((e) => e.type === 'removed')).toBe(false);
    expect(cardOf(visit(opened.state, 'testChest')).lines).toEqual(['The chest is empty. You check twice anyway.']);
  });

  it('can hold a spell scroll, which anyone who doesn\u2019t know the charm learns from', () => {
    const state = withPlaces(fresh(), SCROLL);
    expect(cardOf(visit(state, 'scrollChest')).choices.map((c) => c.label)).toEqual(['Read the charm']);
    const read = choose(state, 'scrollChest', 'scroll/read');
    expect(read.state.hero.spells).toContain('slow');
    expect(placeOf(read.state, 'scrollChest').done).toBe(true);
    expect(read.events).toContainEqual({ type: 'changed', id: 'scrollChest' });
  });

  it('gives a hero who knows the charm already something else for it', () => {
    const start = withPlaces(fresh(), SCROLL);
    const state = { ...start, hero: { ...start.hero, spells: [...start.hero.spells, 'slow' as const] } };
    expect(cardOf(visit(state, 'scrollChest')).choices.map((c) => c.label)).toEqual(['Read the notes in its margins']);
    expect(choose(state, 'scrollChest', 'known/keep').state.hero.xp).toBeGreaterThan(state.hero.xp);
  });

  it('can hold a map that lifts the mist over a land', () => {
    const state = withPlaces(fresh(), MAP);
    const read = choose(state, 'mapChest', 'map/look');
    expect(read.events).toContainEqual({ type: 'reveal', at: [2400, 2000], radius: 400 });
    expect(placeOf(read.state, 'mapChest').done).toBe(true);
  });

  it('brings its guard to its feet while the guard still stands over it', () => {
    const state = withPlaces(fresh(), WOLVES, GUARDED);
    const card = cardOf(visit(state, 'guardedChest'));
    expect(card.title).toBe('A Pack of Wolves');
    expect(placeOf(visit(state, 'guardedChest').state, 'guardedChest').done).toBe(false);
    const gone = update(state, 'testWolves', { done: true });
    expect(cardOf(visit(gone, 'guardedChest')).choices.map((c) => c.label)).toEqual(['Take the button']);
    expect(choose(gone, 'guardedChest', 'button/take').state.hero.gear).toMatchObject({ trinket: 'wizardsButton' });
  });

  it('is left alone by the bot while its guard stands, and wanted once it has gone', () => {
    const state = withPlaces(fresh(), WOLVES, GUARDED);
    expect(PLACE_KINDS.chest.worth(state, placeOf(state, 'guardedChest'))).toBeNull();
    const gone = update(state, 'testWolves', { done: true });
    expect(PLACE_KINDS.chest.worth(gone, placeOf(gone, 'guardedChest'))).not.toBeNull();
  });
});

describe('Aldmoor\u2019s chests', () => {
  const chests = ALDMOOR.locations.filter((l) => l.kind === 'chest');

  it('number nine, two of them guarded by a band that stands beside them', () => {
    expect(chests.length).toBe(9);
    const guarded = chests.filter((c) => c.guard);
    expect(guarded.length).toBe(2);
    for (const chest of guarded) {
      const guard = ALDMOOR.locations.find((l) => l.id === chest.guard);
      expect(guard?.enemy, chest.id).toBeTruthy();
      expect(Math.hypot(guard!.at[0] - chest.at[0], guard!.at[1] - chest.at[1]), chest.id).toBeLessThan(80);
    }
  });

  it('can every one be reached from the start', () => {
    const state = fresh();
    const map = mapOf(state);
    for (const chest of chests) expect(daysAway(state, map, chest.at), chest.id).not.toBeNull();
  });

  it('hold no more than about 700 gold between them, beyond the chest on the downs', () => {
    const gold = chests.filter((c) => c.id !== 'chest').reduce((sum, c) => sum + (c.gold ?? 0), 0);
    expect(gold).toBeLessThanOrEqual(700);
  });
});
