import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../content/aldmoor';
import { courtCard, speechCard, toCourt } from './campaign';
import { apply, describe as about, fight, locationById, visit, type GameEvent, type GameState } from './game';
import { foundOf, placeNote } from './heroSheet';
import { bandPrice, PRICE_A_LEVEL } from './ransom';
import { newGame } from './scenario';

const strong = (background: 'knight' | 'courtier' = 'knight'): GameState => ({ ...newGame(5, ALDMOOR, background), opening: undefined, gold: 10000, leadership: 2000, army: [{ troop: 'knights', count: 80 }, { troop: 'archers', count: 120 }] });
const cardLines = (events: GameEvent[]) => events.flatMap((e) => (e.type === 'card' ? e.card.lines : []));

describe('the Crown\u2019s price on enemy captains (#258)', () => {
  it('is 100 gold a level, and the band\u2019s cards and hover label say so before the fight', () => {
    const s = strong();
    const band = locationById(s, 'collectors');
    expect(bandPrice(band)).toBe(2 * PRICE_A_LEVEL);
    const price = 'There is a price of **200 gold** on the Sergeant\u2019s head, and the steward pays it at Castle Aldmoor.';
    expect(about(s, 'collectors').lines).toContain(price);
    expect(cardLines(visit(s, 'collectors').events)).toContain(price);
    expect(placeNote(s, 'collectors')).toContain('200 gold for the captain');
    // The villain is the bounty, not a captain.
    expect(bandPrice(locationById(s, 'hideout'))).toBe(0);
  });

  it('a captain taken goes back to the castle in irons, and the steward pays for him there, once', () => {
    const s = strong();
    const won = fight(s, 'collectors')!;
    expect(won.state.captives).toEqual([{ place: 'collectors', troop: 'sergeant', level: 2 }]);
    expect(cardLines(won.events)).toContain('Your men march **the Sergeant** back to Castle Aldmoor in irons. The steward will pay you the Crown\u2019s price of **200 gold** for him when you next ride in.');
    expect(foundOf(won.state).find((f) => f.what === 'Captains taken')).toEqual({ what: 'Captains taken', got: 1, of: 10 });
    const home = visit(won.state, 'castle');
    expect(home.state.gold).toBe(won.state.gold + 200);
    expect(cardLines(home.events)).toContain('**The Sergeant** is safe in the castle\u2019s cells, and the steward pays you the Crown\u2019s price on his head. You get **200 gold**.');
    expect(home.state.captives?.[0].paid).toBe('castle');
    expect(visit(home.state, 'castle').state.gold).toBe(home.state.gold);
  });

  it('counts a captain whose band a Courtier hires whole, but not one paid to go home', () => {
    const s = strong('courtier');
    const hired = apply(s, { type: 'choose', id: 'cutpurses', choice: 'hire' })!;
    expect(hired.state.captives).toEqual([{ place: 'cutpurses', troop: 'cutpurseCaptain', level: 1 }]);
    const bribed = apply(s, { type: 'choose', id: 'patrol', choice: 'parley/bribe' })!;
    expect(locationById(bribed.state, 'patrol').done).toBe(true);
    expect(bribed.state.captives).toBeUndefined();
  });

  it('counts Rook when a Ranger tames his whole pack', () => {
    const ranger: GameState = { ...newGame(5, ALDMOOR, 'ranger'), opening: undefined, leadership: 2000, army: strong().army };
    const tamed = apply(ranger, { type: 'choose', id: 'wolves', choice: 'tame' })!;
    expect(tamed.state.captives).toEqual([{ place: 'wolves', troop: 'rook', level: 7 }]);
    expect(cardLines(tamed.events).some((l) => l.includes('**Rook the Huntsman** back to Castle Aldmoor in irons'))).toBe(true);
  });

  it('the King pays for anyone still in the cells at court, and his gaoler has counted them', () => {
    const s = strong();
    const won = fight(fight(fight(s, 'collectors')!.state, 'cutpurses')!.state, 'rustlers')!.state;
    expect(won.captives?.length).toBe(3);
    const over: GameState = { ...won, over: 'won', bounty: 'paid' };
    const court = toCourt(over)!.state;
    expect(court.gold).toBe(over.gold + 1500 + 500);
    expect(court.captives?.every((c) => c.paid === 'court')).toBe(true);
    expect(courtCard(court).lines[0]).toContain('The King adds **1,500 gold** to your purse, with **500 gold** more for the captains still in your cells, and offers you a boon of your choice.');
    expect(speechCard(court).lines[1]).toBe('"My gaoler tells me you sent him three of Baron Grimsby\u2019s captains. He has had to borrow chairs from the kitchen."');
  });
});
