import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../content/aldmoor';
import type { BackgroundId } from '../content/backgrounds';
import { apply, memoriesOf, visit, type Card, type GameState, type Result } from './game';
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

  it('lets only a Courtier who knows the song sing it, once the Baron has been beaten in the field (#232)', () => {
    const lullaby = (s: GameState) => button(cardOf(visit(s, 'hideout')), 'Sing him Old Nan\u2019s lullaby')!;
    expect(lullaby(fresh('knight', { lullaby: true, baronRouted: true }))).toMatchObject({ label: 'Sing him Old Nan\u2019s lullaby (Courtier)', disabled: true });
    expect(lullaby(fresh('courtier', { baronRouted: true })).disabled).toBe(true);
    // Knowing the song isn't enough while he's sure of his walls.
    expect(lullaby(fresh('courtier', { lullaby: true }))).toMatchObject({ label: 'Sing him Old Nan\u2019s lullaby (not until he has been beaten in the field)', disabled: true });
    expect(choose(fresh('courtier', { lullaby: true }), 'hideout', 'parley/lullaby')).toBeNull();
    expect(choose(fresh('courtier', { lullaby: true }), 'hideout', 'parley/lullabyTooSoon')).toBeNull();
    expect(lullaby(fresh('courtier', { lullaby: true, baronRouted: true })).disabled).toBeUndefined();
    expect(choose(fresh('courtier', { baronRouted: true }), 'hideout', 'parley/lullaby')).toBeNull();
    expect(choose(fresh('knight', { lullaby: true, baronRouted: true }), 'hideout', 'parley/lullaby')).toBeNull();
    // The old lunch, which cost nothing, is gone.
    expect(choose(fresh(), 'hideout', 'parley/pardon')).toBeNull();
  });

  it('tells a Courtier who hasn\u2019t learned the song what he lacks, not who he is (#116)', () => {
    const lullaby = (s: GameState) => button(cardOf(visit(s, 'hideout')), 'Sing him Old Nan\u2019s lullaby')!;
    expect(lullaby(fresh('courtier', { baronRouted: true }))).toMatchObject({ label: 'Sing him Old Nan\u2019s lullaby (a song you don\u2019t know yet)', disabled: true });
    // Anyone else can't sing it, song or no song, and hears only that.
    expect(lullaby(fresh('knight'))).toMatchObject({ label: 'Sing him Old Nan\u2019s lullaby (Courtier)', disabled: true });
    // Once he knows it, the button is his.
    expect(lullaby(fresh('courtier', { lullaby: true, baronRouted: true }))).toEqual({ label: 'Sing him Old Nan\u2019s lullaby (Courtier)', action: { type: 'choose', id: 'hideout', choice: 'parley/lullaby' } });
  });

  it('has the Baron beaten in the field once his band is beaten in the open', () => {
    const grimsby = ALDMOOR.locations.find((l) => l.id === 'hideout')!.enemy!.sortie!.band;
    expect(grimsby.enemy!.spoils?.flags).toEqual({ baronRouted: true });
  });

  it('sends two in five of his garrison home instead of winning the stockade, as the King says after', () => {
    const start = fresh('courtier', { lullaby: true, baronRouted: true });
    const garrison = (s: GameState) => s.locations.find((l) => l.id === 'hideout')!.enemy!.army;
    const sung = choose(start, 'hideout', 'parley/lullaby')!;
    expect(sung.state.over).toBeUndefined();
    expect(sung.state.flags?.lullaby).toBe(false);
    for (const stack of garrison(start)) {
      const left = garrison(sung.state).find((s) => s.troop === stack.troop)!.count;
      expect(left).toBe(stack.troop === 'baron' ? 1 : stack.count - Math.round(stack.count * 0.4));
    }
    const card = cardOf(sung);
    expect(card.lines[0]).toContain('Hush-a-bye, Baron');
    expect(card.lines.join(' ')).toContain('slip away from Grimsby\u2019s Hideout');
    // Sung once, it's gone from his walls.
    expect(button(cardOf(visit(sung.state, 'hideout')), 'Sing him Old Nan\u2019s lullaby')).toBeUndefined();
    const court = apply({ ...sung.state, over: 'won', bounty: 'paid' }, { type: 'court' })!.state;
    expect(memoriesOf(court)[0]).toContain('went home to their mothers');
  });

  it('has the King remember a song heard and never sung, and the Baron\u2019s dig', () => {
    const won = { ...fresh('knight', { lullaby: true, dig: 'raided' }), over: 'won' as const, bounty: 'paid' as const };
    const memories = memoriesOf(apply(won, { type: 'court' })!.state);
    expect(memories).toEqual([expect.stringContaining('He was never going to find it there'), expect.stringContaining('he\u2019ll cry for a week')]);
  });
});
