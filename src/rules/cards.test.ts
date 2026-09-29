import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../content/aldmoor';
import { apply, bountyCard, endDay, joinLine, locationById, stillWithYou, visit, whenThere, type Card, type GameState, type Result } from './game';
import { ambushCard } from './days';
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
    expect(sword.detail).toBe('+2 attack. Came with the castle, like the damp.');
    expect(sword.disabled).toBeUndefined();
    const poor = cardOf(apply({ ...knight(), gold: 450 }, { type: 'choose', id: 'castle', choice: 'armoury' }));
    const dear = poor.choices.find((c) => c.label.startsWith('Buy Sword of Aldmoor'))!;
    expect(dear.disabled).toBe(true);
    expect(dear.detail).toContain('You\u2019re 450 gold short.');
    expect(poor.choices.find((c) => c.label.startsWith('Buy Lucky Horseshoe'))!.disabled).toBeUndefined();
  });

  it('says where a bought artifact went', () => {
    const rich = { ...knight(), gold: 5000 };
    const bought = apply(rich, { type: 'choose', id: 'castle', choice: 'buy:swordOfAldmoor' })!;
    expect(cardOf(bought).lines[0]).toBe('**Sword of Aldmoor** is yours: you put it on straight away.');
    const second = apply({ ...bought.state, locations: rich.locations }, { type: 'choose', id: 'castle', choice: 'buy:breastplate' })!;
    expect(cardOf(second).lines[0]).toContain('you put it on');
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
    expect(cardOf(bought).choices.map((c) => c.label)).toContain('Wear it');
    expect(cardOf(bought).choices.map((c) => c.label)).toContain('Keep it in your pack');
  });

  it('still offers a way out when arriving somewhere with nothing to wear', () => {
    expect(cardOf(visit(knight(), 'castle')).choices.map((c) => c.label)).toContain('Not today');
    expect(cardOf(visit(knight(), 'village')).choices.map((c) => c.label)).toContain('Not today');
  });

  it('says why fewer can be recruited than are on offer', () => {
    const poor = { ...knight(), gold: 35 };
    const village = cardOf(visit(poor, 'village'));
    expect(village.lines).toContain('Your purse runs to 3.');
    expect(village.choices[0].label).toBe('Recruit 3 (30 gold)');
    const broke = cardOf(visit({ ...knight(), gold: 0 }, 'village'));
    expect(broke.lines).toContain('You can\u2019t pay for even one.');
    expect(broke.choices[0]).toMatchObject({ label: 'Recruit', disabled: true });
    const full: GameState = { ...knight(), leadership: 5000, army: (['knights', 'archers', 'swordsmen', 'crossbowmen', 'bandits'] as const).map((troop) => ({ troop, count: 1 })) };
    expect(cardOf(visit(full, 'village')).lines).toContain('Five companies are all one officer can lead. Dismiss one (H) to make room.');
  });
});

describe('the odds', () => {
  it('say in plain words how a fight would go, and what each way to fight means', () => {
    const card = cardOf(visit(knight(), 'patrol'));
    expect(card.lines).toContain('Your army looks at you. Then at them. Then at you. *You\u2019d likely lose.*');
    const [fight, sergeants] = card.choices;
    expect(fight).toMatchObject({ label: 'Fight', detail: 'You command every stack yourself.' });
    expect(sergeants).toMatchObject({ label: 'Let the sergeants handle it', detail: 'They fight it out for you, by the same rules, in a moment.' });
    const strong = { ...knight(), leadership: 5000, army: [{ troop: 'knights' as const, count: 200 }] };
    expect(cardOf(visit(strong, 'patrol')).lines).toContain('They look nervous. *You should win.*');
  });

  it('forecasts likely losses on threat and ambush cards, with exact counts for Rangers', () => {
    const army = [{ troop: 'swordsmen' as const, count: 12 }, { troop: 'knights' as const, count: 2 }, { troop: 'poachers' as const, count: 2 }, { troop: 'archers' as const, count: 1 }];
    const state = { ...knight(), army };
    const threat = cardOf(visit(state, 'patrol'));
    expect(threat.lines.some((line) => line.includes('You\u2019d likely lose') || line.includes('bring everyone home'))).toBe(true);

    const ambush = ambushCard({ ...state, ambush: 'patrol' });
    expect(ambush.lines.some((line) => line.includes('You\u2019d likely lose') || line.includes('bring everyone home'))).toBe(true);

    const ranger = { ...state, hero: { ...state.hero, background: 'ranger' as const } };
    const scouted = cardOf(visit(ranger, 'patrol'));
    expect(scouted.lines.some((line) => line.includes('expect to lose about') && /\d+/.test(line))).toBe(true);
  });
});

describe('recruiting', () => {
  it('shows the place again afterwards, with who joined and the armoury still there', () => {
    const card = cardOf(apply(knight(), { type: 'choose', id: 'castle', choice: 'recruit' }));
    expect(card.lines[0]).toBe('**5 Knights** join your army.');
    expect(card.lines[1]).toBe('"All out of volunteers, officer. Come back after payday."');
    expect(card.choices.map((c) => c.label)).toEqual(['Visit the armoury', 'Close']);
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
    // The castle is a day's ride from the start, and Grimsby is out of reach behind his patrol.
    const castle = locationById(s, 'castle').at;
    expect(daysAway(s, map, castle, true)).toBe(0);
    expect(daysAway({ ...s, movement: 10 }, map, castle, true)).toBe(1);
    expect(daysAway(s, map, locationById(s, 'hideout').at, true)).toBeNull();
    expect(whenThere(0)).toBe('today');
    expect(whenThere(1)).toBe('tomorrow');
    expect(whenThere(3)).toBe('in 3 days');
  });

  it('puts up the bounty poster from the bar', () => {
    const poster = bountyCard(knight());
    expect(poster).toMatchObject({ title: 'WANTED', poster: true, portrait: 'grimsby' });
    expect(poster.lines[0]).toBe('**Baron Grimsby** of Aldmoor');
    expect(poster.lines).toContain('Reward: **1,500 gold**. By day 100: **99 days** left.');
  });
});

describe('what cards say about troops', () => {
  it('counts them in words that agree', () => {
    expect(joinLine('knights', 1)).toBe('**1 Knight** joins your army.');
    expect(joinLine('peasants', 10)).toBe('**10 Peasants** join your army.');
    expect(stillWithYou([{ troop: 'archers', count: 1 }])).toBe('*Still with you: 1 Archer.*');
    expect(stillWithYou([])).toBe('*Nobody is left with you.*');
  });
});
