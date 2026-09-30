import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../content/aldmoor';
import { COMMISSIONS } from '../content/campaign';
import { VILLAINS } from '../content/villains';
import { endCard, wantedCard } from '../game/intro';
import { apply, bountyCard, bountyOf, CAMPAIGN_LENGTH, commissionAt, finishFight, startFight, type Card, type GameState, type Result } from './game';
import { autoResolve } from './battle/ai';
import { beginCommission, newGame } from './scenario';

const knight = (army: GameState['army'] = [{ troop: 'knights', count: 400 }]): GameState => ({ ...newGame(3, ALDMOOR, 'knight'), opening: undefined, army });
const cardOf = (result: Result): Card => {
  const e = result.events.find((x) => x.type === 'card');
  if (!e || e.type !== 'card') throw new Error('no card');
  return e.card;
};

/** Grimsby's army beaten on the field, played out by the sergeants on both sides. */
function takeGrimsby(state = knight()): Result {
  const started = startFight(state, 'hideout')!.state;
  return finishFight({ ...started, battle: autoResolve(started.battle!) });
}

describe('the bounty paid, with a scene', () => {
  it('has the villain ready with his last words at his lair, and nowhere else', () => {
    expect(startFight(knight(), 'hideout')!.state.battle!.lastWords).toBe(COMMISSIONS[0].lastWords);
    expect(startFight(knight(), 'poachers')!.state.battle!.lastWords).toBeUndefined();
  });

  it('shows his face on the card that says he is taken, with his last words, and no price yet', () => {
    const state = knight();
    const result = takeGrimsby(state);
    expect(result.state.over).toBe('won');
    const card = cardOf(result);
    expect(card.title).toBe('Baron Grimsby is taken!');
    expect(card.portrait).toBe('grimsby');
    expect(card.lines.slice(0, 3)).toEqual(['Their army is beaten, and **Baron Grimsby is taken**.', '*\u201cUnhand me, sir! This doublet is Flemish!\u201d*', COMMISSIONS[0].surrender]);
    // The fallen come once he's taken, near the top, not at the foot of a long card (#114).
    expect(card.battleResult?.after).toBe(3);
    expect(card.lines.some((l) => l.includes('The Crown pays'))).toBe(false);
    expect(card.lines).toContain(`Among Baron Grimsby\u2019s things you find a torn piece of an old map. You now have **1 of ${CAMPAIGN_LENGTH}** pieces.`);
    expect(card.choices.at(-1)).toEqual({ label: 'Claim the bounty', action: { type: 'poster' } });
    // The poster's price, paid in full.
    expect(result.state.paid).toEqual({ gold: 2000 });
    expect(result.state.gold).toBe(state.gold + 2000);
  });

  it('brings the WANTED poster back stamped PAID, with the reward, and the goose', () => {
    const open = bountyCard(knight());
    expect(open).toMatchObject({ title: 'WANTED', poster: true, portrait: 'grimsby' });
    expect(open.stamp).toBeUndefined();
    expect(open.lines).toContain('Reward: **2,000 gold**. By day 100: **99 days** left.');
    const won = takeGrimsby().state;
    const paid = bountyCard(won);
    expect(paid).toMatchObject({ title: 'WANTED', poster: true, portrait: 'grimsby', stamp: 'PAID', inset: { portrait: 'goose', line: COMMISSIONS[0].homecoming } });
    expect(paid.lines).toEqual(['**Baron Grimsby** of Aldmoor', COMMISSIONS[0].wanted, 'Reward: **2,000 gold**, paid in full.']);
    expect(paid.choices).toEqual([{ label: 'Ride to the King\u2019s court', action: { type: 'court' } }]);
    // Put away, the commission's end waits on the same poster.
    expect(endCard(won)).toEqual(paid);
  });

  it('says why, when the Crown pays other than the poster\u2019s price', () => {
    const courtier = { ...newGame(1, ALDMOOR, 'courtier'), opening: undefined, flags: { lullaby: true } };
    const talked = apply(courtier, { type: 'choose', id: 'hideout', choice: 'parley/lullaby' })!;
    expect(cardOf(talked).title).toBe('Baron Grimsby is taken!');
    expect(talked.state.paid).toEqual({ gold: 1000, because: 'the other half went to the Baron\u2019s old nanny' });
    expect(bountyCard(talked.state).lines).toContain('The poster said **2,000 gold**. The Crown pays **1,000**, because the other half went to the Baron\u2019s old nanny.');
    // A deal with no reason of its own still gives one.
    const quiet = { ...talked.state, paid: { gold: 1000, because: undefined } };
    expect(bountyCard(quiet).lines.some((l) => l.startsWith('The poster said **2,000 gold**.'))).toBe(true);
    // An old save, from before the Crown kept a record, was paid in full.
    expect(bountyCard({ ...talked.state, paid: undefined }).lines).toContain('Reward: **2,000 gold**, paid in full.');
  });

  it('puts the same price on the King\u2019s first poster as the Crown pays at the lair', () => {
    expect(bountyOf(ALDMOOR)).toBe(2000);
    expect(wantedCard().lines).toContain('Reward: **2,000 gold**, alive. The goose also alive, please.');
    expect(wantedCard().lines[1]).toBe(COMMISSIONS[0].wanted);
  });

  it('gives no last words to a hero who loses', () => {
    const lost = takeGrimsby(knight([{ troop: 'peasants', count: 5 }]));
    expect(lost.state.over).toBeUndefined();
    expect(cardOf(lost).lines.some((l) => l.includes('Flemish'))).toBe(false);
  });

  it('gives every villain a face, a charge and last words, and every deal its reason', () => {
    for (const c of COMMISSIONS) expect([c.face, c.wanted, c.lastWords].every(Boolean), c.villain).toBe(true);
    for (const v of VILLAINS) {
      expect([v.face, v.wanted, v.lastWords].every(Boolean), v.villain).toBe(true);
      for (const deal of (v.parleys?.hideout ?? []).filter((p) => p.effects?.win)) expect(deal.because, deal.id).toBeTruthy();
    }
    const start = newGame(5, ALDMOOR, 'knight');
    for (let chapter = 2; chapter < CAMPAIGN_LENGTH; chapter++) {
      const c = commissionAt(start.campaign, chapter);
      expect([c.face, c.wanted, c.lastWords].every(Boolean), c.villain).toBe(true);
      const state = beginCommission(c.province, 5, start.campaign.start, chapter, [], start.campaign.seed);
      expect(bountyCard(state).portrait).toBe(c.face);
      expect(startFight({ ...state, opening: undefined }, 'hideout')!.state.battle!.lastWords).toBe(c.lastWords);
    }
  });
});
