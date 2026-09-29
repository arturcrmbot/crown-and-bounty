import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../content/aldmoor';
import type { BackgroundId } from '../content/backgrounds';
import { apply, bountyCard, memoriesOf, visit, type Card, type GameState, type Result } from './game';
import { newGame } from './scenario';

const fresh = (background: BackgroundId = 'courtier', flags: GameState['flags'] = {}): GameState => ({ ...newGame(1066, ALDMOOR, background), opening: undefined, flags });
const choose = (state: GameState, id: string, choice: string) => apply(state, { type: 'choose', id, choice });
const cardOf = (result: Result): Card => {
  const e = result.events.find((x) => x.type === 'card');
  if (!e || e.type !== 'card') throw new Error('no card');
  return e.card;
};
const button = (card: Card, start: string) => card.choices.find((c) => c.label.startsWith(start));

describe('Grimsby\u2019s parley has a price, and a song to learn first', () => {
  it('has Old Nan remember the lullaby she sang him as a boy, once asked, and keep her charms after', () => {
    const start = fresh();
    expect(button(cardOf(visit(start, 'nan')), 'Ask her about the Baron')?.disabled).toBeUndefined();
    const asked = choose(start, 'nan', 'door/baron')!;
    expect(asked.state.flags?.lullaby).toBe(true);
    expect(cardOf(asked).lines[0]).toContain('I was his nanny');
    // Asked once: her door says so, and her charms are still for sale.
    const again = cardOf(visit(asked.state, 'nan'));
    expect(button(again, 'Ask her about the Baron')).toBeUndefined();
    expect(again.choices.map((c) => c.action)).toContainEqual({ type: 'choose', id: 'nan', choice: 'hearth/stone' });
    expect(choose(asked.state, 'nan', 'hearth/stone')!.state.hero.spells).toContain('stoneskin');
    expect(choose(asked.state, 'nan', 'door/baron')).toBeNull();
  });

  it('lets only a Courtier who knows the song sing the Baron round, and never for free', () => {
    const lullaby = (s: GameState) => button(cardOf(visit(s, 'hideout')), 'Sing him Old Nan\u2019s lullaby')!;
    expect(lullaby(fresh('knight', { lullaby: true }))).toMatchObject({ label: 'Sing him Old Nan\u2019s lullaby (Courtier)', disabled: true });
    expect(lullaby(fresh()).disabled).toBe(true);
    expect(lullaby(fresh('courtier', { lullaby: true })).disabled).toBeUndefined();
    expect(choose(fresh(), 'hideout', 'parley/lullaby')).toBeNull();
    expect(choose(fresh('knight', { lullaby: true }), 'hideout', 'parley/lullaby')).toBeNull();
    // The old lunch, which cost nothing, is gone.
    expect(choose(fresh(), 'hideout', 'parley/pardon')).toBeNull();
  });

  it('takes him for half the bounty, which goes to his old nanny, as the poster and the King both say', () => {
    const start = fresh('courtier', { lullaby: true });
    const sung = choose(start, 'hideout', 'parley/lullaby')!;
    expect(sung.state.over).toBe('won');
    expect(sung.state.gold).toBe(start.gold + 1000);
    expect(sung.state.paid).toEqual({ gold: 1000, because: 'the other half went to the Baron\u2019s old nanny' });
    expect(sung.state.flags?.lullaby).toBe(false);
    const card = cardOf(sung);
    expect(card.title).toBe('Baron Grimsby is taken!');
    expect(card.lines[0]).toContain('Hush-a-bye, Baron');
    expect(bountyCard(sung.state).lines).toContain('The poster said **2,000 gold**. The Crown pays **1,000**, because the other half went to the Baron\u2019s old nanny.');
    const court = apply(sung.state, { type: 'court' })!.state;
    expect(memoriesOf(court)[0]).toContain('half his bounty went to his old nanny');
  });

  it('has the King remember a song heard and never sung, and the Baron\u2019s dig', () => {
    const won = { ...fresh('knight', { lullaby: true, dig: 'raided' }), over: 'won' as const, bounty: 'paid' as const };
    const memories = memoriesOf(apply(won, { type: 'court' })!.state);
    expect(memories).toEqual([expect.stringContaining('He won\u2019t find it there'), expect.stringContaining('He\u2019d cry for a week')]);
  });
});
