import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../content/aldmoor';
import { PERKS, type PerkId } from '../content/skills';
import { apply, endDay, heroStats, levelUpCard, locationById, visit, type Card, type GameState, type Result } from './game';
import { gainXp, LEVELS, MAX_INTEREST, RALLY } from './hero';
import { newGame } from './scenario';

const fresh = (): GameState => ({ ...newGame(1066, ALDMOOR, 'knight'), opening: undefined });
const perked = (perks: PerkId[], base = fresh()): GameState => ({ ...base, hero: { ...base.hero, perks } });
const cardOf = (result: Result): Card => {
  const e = result.events.find((x) => x.type === 'card');
  if (!e || e.type !== 'card') throw new Error('no card');
  return e.card;
};
const count = (s: GameState, troop: string) => s.army.find((x) => x.troop === troop)?.count ?? 0;

describe('perks bend rules', () => {
  it('every perk says what it does, and none is only a number', () => {
    for (const perk of Object.values(PERKS)) expect(perk.note.length).toBeGreaterThan(30);
    for (const id of ['quartermaster', 'nightRider', 'treasureHunter', 'warchest'] as const) {
      const bonus = PERKS[id].bonus;
      expect(Object.keys(bonus).some((k) => ['freeRecruits', 'carry', 'smells', 'interest'].includes(k))).toBe(true);
    }
  });

  it('Quartermaster: one free for every five recruited, on top of the offer', () => {
    const s = { ...perked(['quartermaster']), gold: 100 };
    const card = cardOf(visit(s, 'village'));
    expect(card.choices[0].label).toBe('Recruit 10 + 2 free (100 gold)');
    const r = apply(s, { type: 'choose', id: 'village', choice: 'recruit' })!;
    expect(count(r.state, 'peasants')).toBe(12);
    expect(r.state.gold).toBe(0);
    expect(locationById(r.state, 'village').recruits!.count).toBe(10);
    expect(cardOf(r).lines.slice(0, 2)).toEqual(['**10 Peasants** join your army.', 'Your quartermaster talks them into throwing in **2 more**, free.']);
    expect(count(apply({ ...fresh(), gold: 100 }, { type: 'choose', id: 'village', choice: 'recruit' })!.state, 'peasants')).toBe(10);
  });

  it('Night Rider: movement left unused rides on tomorrow, up to half a day', () => {
    const rider = perked(['nightRider']);
    const max = heroStats(rider).movement;
    expect(endDay({ ...rider, movement: 20 }).state.movement).toBe(max + 20);
    expect(endDay({ ...rider, movement: max }).state.movement).toBe(max + Math.round(max / 2));
    expect(endDay({ ...fresh(), movement: 100 }).state.movement).toBe(max);
  });

  it('Treasure Hunter: at dawn the mist lifts over treasure near his camp', () => {
    const chest = locationById(fresh(), 'chest');
    const fogged = { ...fresh(), explored: fresh().explored.map(() => 0) };
    const hunter = { ...perked(['treasureHunter'], fogged), hero: { ...perked(['treasureHunter'], fogged).hero, at: [chest.at[0] + 200, chest.at[1]] as [number, number] } };
    const reveals = endDay(hunter).events.filter((e) => e.type === 'reveal');
    expect(reveals).toContainEqual({ type: 'reveal', at: chest.at, radius: 36 });
    expect(endDay({ ...hunter, hero: { ...hunter.hero, perks: [] } }).events.some((e) => e.type === 'reveal' && e.at === chest.at)).toBe(false);
  });

  it('War Chest: the bankers pay a tenth of the purse on payday, up to 500', () => {
    const banker = { ...perked(['warchest']), day: 7, gold: 3000 };
    expect(heroStats(banker).interest).toBe(300);
    const r = endDay(banker);
    expect(cardOf(r).lines).toContain('Of that, **300 gold** is the bankers\u2019 interest on your purse.');
    expect(heroStats({ ...banker, gold: 90000 }).interest).toBe(MAX_INTEREST);
    expect(heroStats({ ...banker, gold: -50 }).interest).toBe(0);
  });

  it('Scholar: four choices at every level-up, and more leadership besides', () => {
    const scholar = gainXp(perked(['scholar']), LEVELS[2]).state;
    expect(scholar.hero.offers[0].options).toHaveLength(5);
    expect(scholar.hero.offers[0].options.at(-1)).toBe(RALLY);
    expect(levelUpCard(scholar)!.choices).toHaveLength(5);
    expect(gainXp(fresh(), LEVELS[2]).state.hero.offers[0].options).toHaveLength(4);
  });

  it('The King\u2019s Favourite: four boons at court', () => {
    const won = (s: GameState): GameState => ({ ...s, over: 'won', bounty: 'paid' });
    expect(apply(won(perked(['favourite'])), { type: 'court' })!.state.campaign.court!.boons).toHaveLength(4);
    expect(apply(won(fresh()), { type: 'court' })!.state.campaign.court!.boons).toHaveLength(3);
  });
});
