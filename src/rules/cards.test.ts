import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../content/aldmoor';
import { apply, bountyCard, describe as fromAfar, endDay, heroStats, joinLine, learnOdds, listed, locationById, lossesLine, oddsFor, oddsKnown, placeOdds, stillWithYou, visit, whenThere, winChance, type Army, type Card, type GameState, type Result } from './game';
import { ambushCard } from './days';
import { likelyLossesLine, verdict } from './places/enemy';
import { applyEffects } from './effects';
import { mapOf } from './map/maps';
import { daysAway } from './map/movement';
import { newGame } from './scenario';

const knight = (): GameState => ({ ...newGame(1066, ALDMOOR, 'knight'), opening: undefined });
const cardOf = (result: Result | null): Card => {
  const e = result?.events.find((x) => x.type === 'card');
  if (!e || e.type !== 'card') throw new Error('no card');
  return e.card;
};

describe('the days', () => {
  it('pass without a card when nothing happened, and with one when something did', () => {
    const quiet = endDay(knight());
    expect(quiet.events.some((e) => e.type === 'card')).toBe(false);
    expect(quiet.events).toContainEqual({ type: 'day', day: 2, payday: false });
    let s = knight();
    for (let i = 0; i < 6; i++) s = endDay(s).state;
    expect(cardOf(endDay(s)).lines[0]).toContain('Payday!');
  });

  it('only mentions the mill’s flour on payday once he has found a mill', () => {
    let s = knight();
    for (let i = 0; i < 6; i++) s = endDay(s).state;
    expect(cardOf(endDay(s)).lines).toContain('There are fresh volunteers to recruit.');
    const found = { ...s, locations: s.locations.map((l) => (l.kind === 'mill' ? { ...l, seen: true } : l)) };
    expect(cardOf(endDay(found)).lines).toContain('The mill has flour again, and there are fresh volunteers.');
  });

  it('records first-time hints in existing story flags', () => {
    const first = apply(knight(), { type: 'hint', id: 'ride' })!;
    expect(first.state.flags?.['hint:ride']).toBe(true);
    expect(first.events).toEqual([]);
  });
});

describe('the castle', () => {
  it('shows each ware once, as a button with its price and what it does, greyed when too dear', () => {
    const card = cardOf(apply(knight(), { type: 'choose', id: 'castle', choice: 'armoury' }));
    expect(card.lines).toEqual(['The armourer polishes something that was already clean.']);
    const sword = card.choices.find((c) => c.label.startsWith('Buy Sword of Aldmoor'))!;
    expect(sword.label).toBe('Buy Sword of Aldmoor (900 gold)');
    expect(sword.detail).toBe('It gives +2 attack. It came with the castle, like the damp.');
    expect(sword.disabled).toBeUndefined();
    const poor = cardOf(apply({ ...knight(), gold: 450 }, { type: 'choose', id: 'castle', choice: 'armoury' }));
    const dear = poor.choices.find((c) => c.label.startsWith('Buy Sword of Aldmoor'))!;
    expect(dear.disabled).toBe(true);
    expect(dear.detail).toContain('You\u2019re 450 gold short.');
    expect(poor.choices.find((c) => c.label.startsWith('Buy Lucky Horseshoe'))!.disabled).toBeUndefined();
    expect(card.choices.map((c) => c.label)).toContain('Buy a Scout\u2019s Spyglass (600 gold)');
  });

  it('says where a bought artifact went', () => {
    const rich = { ...knight(), gold: 5000 };
    const bought = apply(rich, { type: 'choose', id: 'castle', choice: 'buy:swordOfAldmoor' })!;
    expect(cardOf(bought).lines[0]).toBe('The **Sword of Aldmoor** is yours. You take it up.');
    const second = apply({ ...bought.state, locations: rich.locations }, { type: 'choose', id: 'castle', choice: 'buy:breastplate' })!;
    expect(cardOf(second).lines[0]).toBe('The **Breastplate of the Crown** is yours. You put it on.');
    const armed = { ...rich, hero: { ...rich.hero, gear: { helm: 'crystalBall' as const } } };
    expect(cardOf(apply(armed, { type: 'choose', id: 'castle', choice: 'buy:helmOfFarSight' })).lines[0]).toContain('it goes in your pack');
  });

  it('asks before wearing a bought artifact with a drawback', () => {
    const start = knight();
    const rich = {
      ...start,
      gold: 5000,
      locations: start.locations.map((l) => l.id === 'castle' ? { ...l, wares: [...(l.wares ?? []), 'headsmansAxe' as const] } : l),
    };
    const bought = apply(rich, { type: 'choose', id: 'castle', choice: 'buy:headsmansAxe' })!;
    expect(bought.state.hero.gear.weapon).toBeUndefined();
    expect(bought.state.hero.pack).toContain('headsmansAxe');
    expect(cardOf(bought).choices.map((c) => c.label)).toContain('Wear the Headsman\u2019s Axe');
    expect(cardOf(bought).choices.map((c) => c.label)).toContain('Keep it in your pack');
  });

  it('still offers a way out when arriving somewhere with nothing to wear', () => {
    expect(cardOf(visit(knight(), 'castle')).choices.map((c) => c.label)).toContain('Not today');
    expect(cardOf(visit(knight(), 'village')).choices.map((c) => c.label)).toContain('Not today');
  });

  it('says why fewer can be recruited than are on offer', () => {
    const poor = { ...knight(), gold: 35 };
    const village = cardOf(visit(poor, 'village'));
    expect(village.lines).toContain('You can only afford 3.');
    expect(village.choices[0].label).toBe('Recruit 3 (30 gold)');
    const broke = cardOf(visit({ ...knight(), gold: 0 }, 'village'));
    expect(broke.lines).toContain('You can\u2019t afford even one.');
    expect(broke.choices[0]).toMatchObject({ label: 'Recruit', disabled: true });
    const full: GameState = { ...knight(), leadership: 5000, army: (['knights', 'archers', 'swordsmen', 'crossbowmen', 'bandits'] as const).map((troop) => ({ troop, count: 1 })) };
    expect(cardOf(visit(full, 'village')).lines).toContain('Five companies are all one officer can lead. Dismiss one on the hero screen to make room.');
  });

  it('warns before recruits join companies they won\u2019t march happily beside', () => {
    const grumble = '*Your Wolves and Wild Boars won\u2019t march happily beside Knights, and all of them lose 10% morale.*';
    const wild = { ...knight(), army: [{ troop: 'wolves' as const, count: 10 }, { troop: 'boars' as const, count: 5 }] };
    expect(cardOf(visit(wild, 'castle')).lines).toContain(grumble);
    expect(cardOf(visit(knight(), 'castle')).lines.some((line) => line.includes('march happily'))).toBe(false);
    // An old quarrel isn't news: the King's folk already march with the wolves.
    const mixed = { ...knight(), army: [...knight().army, { troop: 'wolves' as const, count: 10 }] };
    expect(cardOf(visit(mixed, 'castle')).lines.some((line) => line.includes('march happily'))).toBe(false);
  });

  it('warns before tamed beasts fall in with the King\u2019s folk', () => {
    const ranger: GameState = { ...newGame(1066, ALDMOOR, 'ranger'), opening: undefined };
    const card = cardOf(visit(ranger, 'boars'));
    expect(card.choices.map((c) => c.label)).toContain('Tame them');
    expect(card.lines).toContain('*Your Knights and Archers won\u2019t march happily beside Wild Boars, and all of them lose 10% morale.*');
  });
});

describe('the odds', () => {
  it('lead the card with a verdict in plain words, and the army says what it thinks after the threat', () => {
    const card = cardOf(visit(knight(), 'patrol'));
    expect(card.verdict).toEqual({ odds: 'lose', words: 'You\u2019d likely lose.' });
    expect(card.lines[1]).toBe('Your army looks at you. Then at them. Then at you.');
    const [fight, sergeants] = card.choices;
    expect(fight).toMatchObject({ label: 'Fight', detail: 'You command every stack yourself.' });
    expect(sergeants).toMatchObject({ label: 'Let the sergeants handle it', detail: 'They fight it out for you, by the same rules, in a moment.' });
    const strong = { ...knight(), leadership: 5000, army: [{ troop: 'knights' as const, count: 200 }] };
    const sure = cardOf(visit(strong, 'patrol'));
    expect(sure.verdict).toEqual({ odds: 'win', words: 'You should win.' });
    expect(sure.lines).toContain('They look nervous.');
  });

  it('come in four colours, at the sergeants\u2019 old thresholds', () => {
    expect(verdict(1)).toEqual({ odds: 'win', words: 'You should win.' });
    expect(verdict(0.9).odds).toBe('win');
    expect(verdict(0.89)).toEqual({ odds: 'close', words: 'The odds are on your side.' });
    expect(verdict(0.55).odds).toBe('close');
    expect(verdict(0.54)).toEqual({ odds: 'against', words: 'The odds are against you.' });
    expect(verdict(0.3).odds).toBe('against');
    expect(verdict(0.29)).toEqual({ odds: 'lose', words: 'You\u2019d likely lose.' });
    expect(verdict(0).odds).toBe('lose');
  });

  it('are the same from afar, under the pointer and on arrival (#154)', () => {
    const armies: Army[] = [knight().army, [{ troop: 'knights', count: 17 }, { troop: 'archers', count: 33 }], [{ troop: 'knights', count: 200 }]];
    for (const army of armies) {
      const s = { ...knight(), leadership: 5000, army };
      for (const id of ['patrol', 'wolves', 'hideout']) {
        const arrival = cardOf(visit(s, id)).verdict;
        expect(arrival).toBeDefined();
        expect(fromAfar(s, id).verdict).toEqual(arrival);
        expect(placeOdds(s, id)).toEqual(arrival);
      }
    }
    // Only a fight has odds.
    expect(placeOdds(knight(), 'castle')).toBeNull();
    expect(fromAfar(knight(), 'castle').verdict).toBeUndefined();
  });

  it('put a number on the chances from afar too, for a hero whose scouts give one', () => {
    expect(fromAfar(knight(), 'patrol').lines.some((line) => line.includes('chance'))).toBe(false);
    const scout = { ...knight(), hero: { ...knight().hero, skills: { scouting: 2 } } };
    expect(fromAfar(scout, 'patrol').lines).toContain('*Your scouts don\u2019t give you one chance in ten.*');
  });

  it('say so plainly with no troops to fight with', () => {
    const alone = { ...knight(), army: [] };
    const card = cardOf(visit(alone, 'patrol'));
    expect(card.verdict).toEqual({ odds: 'lose', words: 'You have no troops to fight with.' });
    expect(card.lines).toContain('Recruit some troops first.');
    expect(placeOdds(alone, 'patrol')).toEqual(card.verdict);
  });

  it('can be worked out elsewhere and learned, as the odds worker does', () => {
    const s: GameState = { ...knight(), army: [{ troop: 'knights', count: 11 }, { troop: 'archers', count: 23 }] };
    expect(oddsKnown(s, 'bears')).toBe(false);
    const odds = oddsFor(s, 'bears')!;
    expect(odds.chance).toBe(winChance(s, 'bears'));
    expect(oddsKnown(s, 'bears')).toBe(true);
    learnOdds({ ...odds, chance: 0.5 });
    expect(placeOdds(s, 'bears')).toEqual(verdict(0.5));
    learnOdds(odds);
  });

  it('forecasts likely losses on threat and ambush cards, with exact counts for Rangers', () => {
    const army = [{ troop: 'swordsmen' as const, count: 12 }, { troop: 'knights' as const, count: 2 }, { troop: 'poachers' as const, count: 2 }, { troop: 'archers' as const, count: 1 }];
    const state = { ...knight(), army };
    const threat = cardOf(visit(state, 'patrol'));
    const cost = likelyLossesLine(state, 'patrol');
    expect(cost).toMatch(/sergeants/);
    expect(threat.lines).toContain(cost);

    const ambush = ambushCard({ ...state, ambush: 'patrol' });
    expect(ambush.lines).toContain(cost);
    expect(ambush.verdict).toEqual(threat.verdict);

    // An army that wins, so the scouts count what the win costs.
    const big = army.map((stack) => ({ ...stack, count: stack.count * 6 }));
    const ranger = { ...state, army: big, hero: { ...state.hero, background: 'ranger' as const } };
    const scouted = cardOf(visit(ranger, 'patrol'));
    expect(scouted.lines.some((line) => line.includes('expect to lose about') && /\d+/.test(line))).toBe(true);
    // Three kinds or more read as a list, with one "and" (#115).
    expect(scouted.lines.find((line) => line.includes('expect to lose about'))).toMatch(/about \d+ [A-Z]\w+(, \d+ [A-Z]\w+)+ and \d+ [A-Z]\w+\.\*$/);
  });
});

describe('the likely cost beside the odds (#171)', () => {
  it('says a likely defeat costs the whole army, and that the cost it names is a win\u2019s', () => {
    const base = knight();
    const seen = new Set<string>();
    for (const n of [20, 57, 58, 59, 60, 61, 62, 80]) {
      const state = { ...base, army: [{ troop: 'swordsmen' as const, count: n }, { troop: 'archers' as const, count: n }] };
      const chance = winChance(state, 'hideout');
      const line = likelyLossesLine(state, 'hideout');
      const odds = verdict(chance).odds;
      seen.add(chance === 0 ? 'none' : odds);
      if (chance === 0) expect(line).toBe('*The sergeants can\u2019t find a way to win this, so you would lose your whole army.*');
      else if (odds === 'lose') expect(line).toMatch(/^\*Most likely you would lose your whole army\. Even if you win, the sergeants expect to (lose|bring everyone home)/);
      else if (odds === 'against') expect(line).toMatch(/^\*If you win, the sergeants expect to .+\. If you lose, you lose your whole army\.\*$/);
      else expect(line).toMatch(/^\*The sergeants expect to /);
      // It never sounds like a win when the verdict says a loss.
      if (odds === 'lose') expect(line).toMatch(/whole army/);
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('lists in words', () => {
  it('put commas between them and "and" only before the last, as the sergeants\u2019 cost line does (#115)', () => {
    expect(listed([])).toBe('');
    expect(listed(['3 Knights'])).toBe('3 Knights');
    expect(listed(['3 Knights', '2 Archers'])).toBe('3 Knights and 2 Archers');
    expect(listed(['3 Knights', '2 Archers', '1 Swordsman'])).toBe('3 Knights, 2 Archers and 1 Swordsman');
    const before: Army = [{ troop: 'knights', count: 5 }, { troop: 'archers', count: 10 }, { troop: 'poachers', count: 2 }, { troop: 'swordsmen', count: 20 }];
    const after: Army = [{ troop: 'knights', count: 3 }, { troop: 'archers', count: 9 }, { troop: 'swordsmen', count: 8 }];
    expect(lossesLine(before, after)).toBe('You lost **2 Knights**, **1 Archer**, **2 Poachers** and **12 Swordsmen**.');
  });

  it('say who slips away from a band the same way', () => {
    const state = knight();
    const patrol = locationById(state, 'patrol');
    const band = { ...patrol, enemy: { ...patrol.enemy!, army: [{ troop: 'swordsmen' as const, count: 20 }, { troop: 'crossbowmen' as const, count: 10 }, { troop: 'poachers' as const, count: 4 }] } };
    const s = { ...state, locations: state.locations.map((l) => (l.id === 'patrol' ? band : l)) };
    expect(applyEffects(s, band, { desert: { share: 0.5 } }).lines).toEqual(['**10 Swordsmen**, **5 Crossbowmen** and **2 Poachers** slip away from Grimsby\u2019s Patrol.']);
  });
});

describe('recruiting', () => {
  it('lets the steward at the castle raise more men for gold, as often as he can pay (Artur, 30 Sep)', () => {
    const k = knight();
    const lead = heroStats(k).leadership;
    const card = cardOf(apply(k, { type: 'choose', id: 'castle', choice: 'muster' }));
    expect(card.lines[0]).toBe('The steward sends criers round the villages, and more men come to your banner. You gain **20 leadership**.');
    const once = apply(k, { type: 'choose', id: 'castle', choice: 'muster' })!.state;
    expect(heroStats(once).leadership).toBe(lead + 20);
    expect(once.gold).toBe(k.gold - 500);
    const twice = apply(once, { type: 'choose', id: 'castle', choice: 'muster' })!.state;
    expect(heroStats(twice).leadership).toBe(lead + 40);
    // Short of gold, the button is greyed, and nothing happens.
    const poor = { ...k, gold: 499 };
    expect(cardOf(visit(poor, 'castle')).choices.find((c) => c.label.startsWith('Raise more men'))?.disabled).toBe(true);
    expect(apply(poor, { type: 'choose', id: 'castle', choice: 'muster' })).toBeNull();
    // Only at a castle.
    expect(apply(k, { type: 'choose', id: 'village', choice: 'muster' })).toBeNull();
    expect(cardOf(visit(k, 'village')).choices.some((c) => c.label.startsWith('Raise more men'))).toBe(false);
  });

  it('shows the place again afterwards, with who joined and the armoury still there', () => {
    const card = cardOf(apply(knight(), { type: 'choose', id: 'castle', choice: 'recruit' }));
    expect(card.lines[0]).toBe('**5 Knights** join your army.');
    expect(card.lines[1]).toBe('"All out of volunteers, officer. Come back after payday."');
    expect(card.choices.map((c) => c.label)).toEqual(['Raise more men (500 gold for +20 leadership)', 'Visit the armoury', 'Close']);
    const village = cardOf(apply({ ...knight(), gold: 55 }, { type: 'choose', id: 'village', choice: 'recruit' }));
    expect(village.lines.slice(0, 2)).toEqual(['**5 Peasants** join your army.', '**15 Peasants** will join you for **10 gold** each.']);
    expect(village.choices.map((c) => c.label)).toEqual(['Recruit', 'Close']);
  });
});

describe('the map', () => {
  it('knows how many days a ride is', () => {
    const s = knight();
    const map = mapOf(s);
    const near: [number, number] = [s.hero.at[0] + 40, s.hero.at[1]];
    expect(daysAway(s, map, near)).toBe(0);
    // With his legs spent, even the nearest ride waits for tomorrow.
    expect(daysAway({ ...s, movement: 0 }, map, near)).toBe(1);
    // The castle is within the first day's ride, and Grimsby, the long way round by the ford, days away.
    const castle = locationById(s, 'castle').at;
    expect(daysAway(s, map, castle, true)).toBe(0);
    expect(daysAway({ ...s, movement: 10 }, map, castle, true)).toBe(1);
    expect(daysAway(s, map, locationById(s, 'hideout').at, true)).toBeGreaterThanOrEqual(3);
    expect(whenThere(0)).toBe('today');
    expect(whenThere(1)).toBe('tomorrow');
    expect(whenThere(3)).toBe('in 3 days');
  });

  it('puts up the bounty poster from the bar', () => {
    const poster = bountyCard(knight());
    expect(poster).toMatchObject({ title: 'WANTED', poster: true, portrait: 'grimsby' });
    expect(poster.lines[0]).toBe('**Baron Grimsby** of Aldmoor');
    expect(poster.lines).toContain('Reward: **2,000 gold**. By day 100: **99 days** left.');
  });
});

describe('what cards say about troops', () => {
  it('counts them in words that agree', () => {
    expect(joinLine('knights', 1)).toBe('**1 Knight** joins your army.');
    expect(joinLine('peasants', 10)).toBe('**10 Peasants** join your army.');
    expect(stillWithYou([{ troop: 'archers', count: 1 }])).toBe('*You still have 1 Archer.*');
    expect(stillWithYou([])).toBe('*Nobody is left with you.*');
  });
});
