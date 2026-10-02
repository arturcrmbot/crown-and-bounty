import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../content/aldmoor';
import { bribeOffer, battleAct, type BattleState } from './battle/battle';
import { apply, battleXp, finishFight, levelUpCard, locationById, startFight, visit, type Card, type GameState, type Result } from './game';
import { purseLines } from './fight';
import { hireOffer } from './places/enemy';
import { leadershipUsed } from './state';
import { newGame } from './scenario';

/** What the Courtier's playtest asked for (#231): his gold, told plainly on the cards. */
const fresh = (background: 'courtier' | 'knight' = 'courtier'): GameState => ({ ...newGame(1066, ALDMOOR, background), opening: undefined });
const cardOf = (result: Result | null): Card => {
  const e = result?.events.find((x) => x.type === 'card');
  if (!e || e.type !== 'card') throw new Error('no card');
  return e.card;
};
const lordOf = (b: BattleState) => b.fighters.find((f) => f.hero)!;
const turnOf = (b: BattleState, id: number): BattleState => ({ ...b, order: [id, ...b.order.filter((x) => x !== id)] });

describe('a fight card tells a Courtier what his gold could buy (#231)', () => {
  it('says who of them would take his gold, and what sending them home or winning them over would cost', () => {
    // On day 4 of the playtest the patrol's card said he'd likely lose, and 23 of its 40 crossbowmen would have taken his gold.
    const s = { ...fresh(), leadership: fresh().leadership + 100, army: [{ troop: 'knights' as const, count: 15 }, { troop: 'archers' as const, count: 32 }] };
    const b = startFight(s, 'patrol')!.state.battle!;
    const crossbows = b.fighters.find((f) => f.side === 'enemy' && f.troop === 'crossbowmen')!;
    const home = bribeOffer(b, lordOf(b), crossbows)!;
    const over = bribeOffer(b, lordOf(b), crossbows, true)!;
    expect(home.count).toBeGreaterThan(0);
    expect(home.count).toBeLessThan(crossbows.count);
    const [line] = purseLines(s, 'patrol');
    expect(line).toBe(`*The sergeants\u2019 odds leave out your purse.* In battle, ${home.count} of the ${crossbows.count} Crossbowmen would take your gold. **${home.price} gold** would send them home, or **${over.price} gold** would win them over to your side.`);
    expect(cardOf(visit({ ...s, hero: { ...s.hero, at: locationById(s, 'patrol').at } }, 'patrol')).lines).toContain(line);
  });

  it('names every stack that would take it, and leaves out winning them over when there is no room for them all', () => {
    const s = fresh();
    const [line] = purseLines(s, 'highwaymen');
    expect(line).toContain('In battle, all 14 Highwaymen would take your gold.');
    expect(line).toContain('would win them over to your side');
    const crowded = { ...s, leadership: 0 };
    expect(purseLines(crowded, 'highwaymen')[0]).not.toContain('win them over');
  });

  it('says so when none of them would take it, and says nothing to an enemy that takes no gold, or to a hero who isn\u2019t a bard', () => {
    expect(purseLines({ ...fresh(), army: [{ troop: 'archers', count: 5 }] }, 'hideout')).toEqual(['*The sergeants\u2019 odds leave out your purse.* In battle, none of them would take gold from an army no stronger than theirs.']);
    expect(purseLines(fresh(), 'wolves')).toEqual([]);
    expect(purseLines(fresh('knight'), 'patrol')).toEqual([]);
  });
});

describe('the card after a battle says what his gold did (#231)', () => {
  it('names whom it sent home and whom it won over, as well as what it cost', () => {
    const s = fresh();
    let b = startFight(s, 'collectors')!.state.battle!;
    const lord = lordOf(b);
    const swordsmen = b.fighters.find((f) => f.side === 'enemy' && f.troop === 'swordsmen')!;
    const crossbows = b.fighters.find((f) => f.side === 'enemy' && f.troop === 'crossbowmen')!;
    const over = battleAct(turnOf(b, lord.id), { type: 'bribe', target: swordsmen.id, join: true });
    expect(over.battle.fighters.find((f) => f.side === 'player' && f.troop === 'swordsmen')?.turncoat).toBe(true);
    b = battleAct(turnOf(over.battle, lord.id), { type: 'bribe', target: crossbows.id }).battle;
    expect(b.result).toBe('won');
    const paid = s.gold - b.hero.gold!;
    const card = cardOf(finishFight({ ...s, battle: b }));
    expect(card.lines).toContain(`Your gold sent **${crossbows.count} Crossbowmen** home, and won **${swordsmen.count} Swordsmen** over to your side.`);
    expect(card.lines).toContain(`Bribes cost you **${paid} gold**, and those you paid off teach you half what beating them would.`);
  });
});

describe('what a Courtier has already is nothing new (#231)', () => {
  it('Advanced Diplomacy says it changes nothing for him, though he needs it before Expert', () => {
    const s = fresh();
    const offered = { ...s, hero: { ...s.hero, skills: { diplomacy: 1 }, offers: [{ level: 2, stat: 'attack' as const, options: ['skill:diplomacy', 'skill:estates', 'perk:warchest'] }] } };
    expect(levelUpCard(offered)!.choices[0].detail).toContain('*Your bribes are half off already, as low as they go, and small bands take your coin already, so this rank changes nothing for you, though you need it before Expert.*');
    // Basic Diplomacy's surrender is new to him, so only the bribes are nothing new.
    const basic = { ...s, hero: { ...s.hero, offers: offered.hero.offers } };
    expect(levelUpCard(basic)!.choices[0].detail).toContain('*Your bribes are half off already, as low as they go, so that part changes nothing for you.*');
    // A knight learns all of it.
    const knight = fresh('knight');
    expect(levelUpCard({ ...knight, hero: { ...knight.hero, offers: offered.hero.offers } })!.choices[0].detail).not.toContain('changes nothing');
  });

  it('the armoury tells him the Silver Signet would change nothing for him, and tells a knight nothing of the sort', () => {
    const signet = (s: GameState) => cardOf(apply(s, { type: 'choose', id: 'castle', choice: 'armoury' })).choices.find((c) => c.label.startsWith('Buy Silver Signet'))!.detail;
    expect(signet(fresh())).toContain('*Your bribes are half off already, as low as they go, and small bands take your coin already, so it would change nothing for you.*');
    expect(signet(fresh('knight'))).not.toContain('change nothing');
  });
});

describe('a band he hires hands over what it carried (#231)', () => {
  /** A courtier whose army outweighs these bands twice over, with room to lead them and gold to pay them. */
  const strong = (s: GameState = fresh()): GameState => ({ ...s, gold: 10000, leadership: 600, army: [{ troop: 'knights', count: 40 }, { troop: 'archers', count: 40 }] });
  const hireCard = (s: GameState, id: string) => cardOf(apply(s, { type: 'choose', id, choice: 'hire' }));

  it('the highwaymen, hired whole, hand over their takings, the Baron\u2019s letter and their black banner, and teach him half', () => {
    const s = fresh();
    const offer = hireOffer(s, locationById(s, 'highwaymen'))!;
    expect(offer.all).toBe(true);
    const r = apply(s, { type: 'choose', id: 'highwaymen', choice: 'hire' })!;
    const half = Math.round(battleXp(locationById(s, 'highwaymen').enemy!.army) / 2);
    expect(r.state.gold).toBe(s.gold - offer.price + 200);
    expect(r.state.hero.xp).toBe(s.hero.xp + half);
    expect(r.state.flags?.orders).toBe(true);
    expect(r.state.hero.pack).toContain('blackBanner');
    expect(r.state.army.find((x) => x.troop === 'bandits')?.count).toBe(14);
    expect(locationById(r.state, 'highwaymen').done).toBe(true);
    expect(r.events).toContainEqual({ type: 'removed', id: 'highwaymen' });
    const card = cardOf(r);
    expect(card.lines).toContain('Their takings come to **200 gold**, and among them is a letter with the Baron\u2019s seal. *"All patrols back to the stockade if the King\u2019s man comes. G."*');
    expect(card.lines).toContain(`You gain **${half} experience**.`);
    expect(card.choices.map((c) => c.label)).toEqual(['Wear it', 'Keep it in your pack']);
    // The letter opens the patrol's way past, as it does for a hero who beats them.
    expect(cardOf(visit({ ...r.state, hero: { ...r.state.hero, at: locationById(s, 'patrol').at } }, 'patrol')).choices.map((c) => c.label)).toContain('Show them the Baron\u2019s orders');
  });

  it('Grimsby\u2019s dig, hired whole, counts as raided, and the grain cart\u2019s escort leaves the carter asking whose grain it is now', () => {
    const dug = apply(strong(), { type: 'choose', id: 'diggings', choice: 'hire' })!.state;
    expect(dug.flags?.dig).toBe('raided');
    const s = strong();
    const onTheRoad = { ...s, locations: s.locations.map((l) => (l.id === 'cart' ? { ...l, done: false } : l)) };
    const card = hireCard(onTheRoad, 'cart');
    expect(card.lines).toContain('*The carter would like to know whose grain it is now.*');
    expect(card.choices.map((c) => c.label)).toEqual(['Take it home to Westmere', 'Keep it for your men']);
  });

  it('those who come over from a band that only half comes teach him half, and the rest attack', () => {
    const s = strong();
    // Room under his banner for only some of the dig's swordsmen.
    const tight = { ...s, leadership: leadershipUsed(s.army) + 30 };
    const offer = hireOffer(tight, locationById(tight, 'diggings'))!;
    expect(offer.all).toBe(false);
    const r = apply(tight, { type: 'choose', id: 'diggings', choice: 'hire' })!;
    const half = Math.round(battleXp(offer.joining) / 2);
    expect(r.state.hero.xp).toBe(tight.hero.xp + half);
    expect(r.state.gold).toBe(tight.gold - offer.price);
    expect(r.state.ambush).toBe('diggings');
    expect(locationById(r.state, 'diggings').done).toBe(false);
    expect(r.state.flags?.dig).toBeUndefined();
    expect(cardOf(r).lines).toContain(`You gain **${half} experience**.`);
  });
});

describe('the hire and tame buttons don\u2019t contradict the odds (#231)', () => {
  it('say the band doesn\u2019t think much of his army, rather than that it isn\u2019t strong enough', () => {
    const s = { ...fresh(), army: [{ troop: 'archers' as const, count: 5 }] };
    const dig = cardOf(visit({ ...s, hero: { ...s.hero, at: locationById(s, 'diggings').at } }, 'diggings'));
    expect(dig.choices.map((c) => c.label)).toContain('Hire them (they don\u2019t think much of your army yet)');
  });
});
