import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../../content/aldmoor';
import type { SpellId } from '../../content/spells';
import { TROOPS, type TroopId } from '../../content/troops';
import { withNewPlaces } from '../campaign';
import { apply, describe as about, endDay, finishFight, heroInBattle, locationById, startFight, winChance, type GameState, type Result } from '../game';
import { heroLines } from '../places/common';
import { hireOffer } from '../places/enemy';
import { newGame } from '../scenario';
import { leadershipUsed, update, type Army } from '../state';
import { autoResolve, chooseAction, evaluate } from './ai';
import { battleAct, bribeOffer, createBattle, fighterById, heroHelp, heroMana, heroPower, options, REAR, statsOf, strike, type BattleEvent, type BattleHero, type BattleState } from './battle';

/** The enemy's heroes (#239): each leads a band from behind its line, at his level. */
const hero: BattleHero = { attack: 2, defence: 2, spellPower: 2, mana: 20, spells: ['bolt'], castRound: 0 };
/** "sergeant", 1, 5: a level-V sergeant. */
const army = (...stacks: [TroopId, number, number?][]): Army => stacks.map(([troop, count, level]) => ({ troop, count, ...(level ? { level } : {}) }));
const fight = (enemy: Army, seed = 7, player: Army = army(['knights', 10], ['archers', 20])) => createBattle({ place: 'x', seed, player, enemy, hero });
const of = (b: BattleState, troop: TroopId) => b.fighters.find((f) => f.troop === troop)!;
/** The battle with `troop`'s stack acting now. */
const turnOf = (b: BattleState, troop: TroopId): BattleState => {
  const id = of(b, troop).id;
  return { ...b, order: [id, ...b.order.filter((x) => x !== id)] };
};
/** Both sides play it out by the AI, as the sergeants do, and everything that happened. */
function playOut(b: BattleState): { battle: BattleState; events: BattleEvent[] } {
  const events: BattleEvent[] = [];
  for (let n = 0; n < 4000 && !b.result; n++) {
    const done = battleAct(b, chooseAction(b));
    if (!done.events.length) break;
    events.push(...done.events);
    b = done.battle;
  }
  return { battle: b, events };
}
/** The spells and orders a leader cast in a fight. */
const castBy = (events: BattleEvent[], id: number) => new Set(events.flatMap((e) => ((e.type === 'spell' || e.type === 'volley') && e.by === id && e.spell ? [e.spell] : [])));

describe('an enemy hero\u2019s level (#239)', () => {
  it('lends every stack of his side a point of attack or defence for each level after the first, attack first', () => {
    expect([1, 2, 3, 5, 8, 10].map(heroHelp)).toEqual([
      { attack: 0, defence: 0 },
      { attack: 1, defence: 0 },
      { attack: 1, defence: 1 },
      { attack: 2, defence: 2 },
      { attack: 4, defence: 3 },
      { attack: 5, defence: 4 },
    ]);
    const led = fight(army(['swordsmen', 20], ['sergeant', 1, 5]));
    const alone = fight(army(['swordsmen', 20]));
    expect(led.enemyHelp).toEqual({ attack: 2, defence: 2 });
    expect(statsOf(led, of(led, 'swordsmen'))).toEqual({ attack: 8, defence: 8 });
    expect(statsOf(alone, of(alone, 'swordsmen'))).toEqual({ attack: 6, defence: 6 });
    // Your side is as it was; his men hit harder and take less.
    expect(statsOf(led, of(led, 'knights'))).toEqual(statsOf(alone, of(alone, 'knights')));
    expect(strike(led, of(led, 'swordsmen'), of(led, 'knights'), false).damage).toBeGreaterThan(strike(alone, of(alone, 'swordsmen'), of(alone, 'knights'), false).damage);
    expect(strike(led, of(led, 'knights'), of(led, 'swordsmen'), false).damage).toBeLessThan(strike(alone, of(alone, 'knights'), of(alone, 'swordsmen'), false).damage);
  });

  it('lends nothing at level I, nor from a leader with no level: Rook and the Baron fight as they did', () => {
    expect(fight(army(['cutpurses', 20], ['cutpurseCaptain', 1, 1])).enemyHelp).toBeUndefined();
    const baron = fight(army(['swordsmen', 20], ['baron', 1]));
    expect(baron.enemyHelp).toBeUndefined();
    expect(of(baron, 'baron').book).toMatchObject({ spellPower: 2, mana: 15, spells: ['haste', 'slow'] });
    expect(fight(army(['wolves', 20], ['rook', 1])).enemyHelp).toBeUndefined();
  });

  it('knows his spells from level III, with spell power and mana that grow with his level, and gives his orders at any level', () => {
    expect([3, 6, 8, 10].map((l) => [heroPower(l), heroMana(l)])).toEqual([[1, 10], [2, 20], [3, 30], [4, 40]]);
    const green = of(fight(army(['swordsmen', 20], ['sergeant', 1, 2])), 'sergeant');
    expect(green.book).toMatchObject({ spells: [], mana: 0, charges: [{ spell: 'shieldwall', uses: 1 }, { spell: 'crossbows', uses: 1 }] });
    const pike = of(fight(army(['swordsmen', 20], ['pike', 1, 5])), 'pike');
    expect(pike.book).toMatchObject({ name: 'Sergeant Pike', spellPower: 2, mana: 20, maxMana: 20, spells: ['stoneskin', 'haste'] });
    // One who knows nothing yet, and gives no orders, has no book at all; nor does one who only shoots.
    expect(of(fight(army(['cutpurses', 20], ['cutpurseCaptain', 1, 2])), 'cutpurseCaptain').book).toBeUndefined();
    expect(of(fight(army(['cutpurses', 20], ['cutpurseCaptain', 1, 3])), 'cutpurseCaptain').book).toMatchObject({ spells: ['slow', 'curse'], mana: 10 });
    expect(of(fight(army(['poachers', 20], ['poacherCaptain', 1, 6])), 'poacherCaptain').book).toBeUndefined();
    // One whose band forgets his level leads it at level I.
    const forgotten = fight(army(['swordsmen', 20], ['foreman', 1]));
    expect(forgotten.enemyHelp).toBeUndefined();
    expect(of(forgotten, 'foreman').book).toMatchObject({ spells: [], mana: 0, charges: [{ spell: 'shieldwall', uses: 1 }, { spell: 'crossbows', uses: 1 }] });
  });

  it('stands behind his men, where nothing can reach him, and is taken when they are beaten', () => {
    const b = fight(army(['bandits', 6], ['highwaymanCaptain', 1, 2]), 3, army(['knights', 30], ['archers', 40]));
    const captain = of(b, 'highwaymanCaptain');
    expect(captain.at).toBe(REAR);
    const mine = turnOf(b, 'archers');
    expect(options(mine).shoot).not.toContain(captain.id);
    const end = autoResolve(b);
    expect(end.result).toBe('won');
  });
});

describe('a test fight with each kind of enemy hero (#239)', () => {
  it('a sergeant shouts the Baron\u2019s orders, and from level III casts Stone Skin and Haste over his men', () => {
    const b = fight(army(['swordsmen', 30], ['crossbowmen', 12], ['sergeant', 1, 5]));
    const { events } = playOut(b);
    const cast = castBy(events, of(b, 'sergeant').id);
    expect([...cast].some((s) => s === 'shieldwall' || s === 'crossbows')).toBe(true);
    expect([...cast].some((s) => s === 'stoneskin' || s === 'haste')).toBe(true);
    // Every one lands on his own men.
    for (const e of events) if (e.type === 'spell' && e.by === of(b, 'sergeant').id && (e.spell === 'stoneskin' || e.spell === 'haste')) expect(fighterById(b, e.target).side).toBe('enemy');
  });

  it('the Foreman gives orders as a sergeant does, and calls down Lightning Bolts as hard as his level', () => {
    const b = fight(army(['swordsmen', 30], ['crossbowmen', 12], ['foreman', 1, 6]));
    const foreman = of(b, 'foreman');
    const { events } = playOut(b);
    const bolts = events.filter((e) => e.type === 'spell' && e.by === foreman.id && e.spell === 'bolt');
    expect(bolts.length).toBeGreaterThan(0);
    // Spell power 2 at level VI: forty a bolt, at your stacks.
    for (const e of bolts) expect(e).toMatchObject({ damage: 40 });
    for (const e of bolts) if (e.type === 'spell') expect(fighterById(b, e.target).side).toBe('player');
    // The pickets' captain, at level VIII, bolts for sixty.
    const picket = fight(army(['menAtArms', 20], ['pikemen', 20], ['picketCaptain', 1, 8]));
    const captain = of(picket, 'picketCaptain');
    const bolt = battleAct(turnOf(picket, 'pikemen'), { type: 'cast', spell: 'bolt', target: of(picket, 'knights').id, by: captain.id }).events[0];
    expect(bolt).toMatchObject({ type: 'spell', spell: 'bolt', by: captain.id, damage: 60 });
  });

  it('an outlaw captain jeers your stacks and sings his own on, and never pays anyone', () => {
    const b = fight(army(['cutpurses', 30], ['poachers', 15], ['cutpurseCaptain', 1, 2]));
    const captain = of(b, 'cutpurseCaptain');
    const { events } = playOut(b);
    const words = events.filter((e) => (e.type === 'jeer' || e.type === 'song') && e.fighter === captain.id);
    expect(words.length).toBeGreaterThan(0);
    for (const e of words) {
      if (e.type === 'jeer') expect(fighterById(b, e.target).side).toBe('player');
      if (e.type === 'song') for (const id of e.targets) expect(fighterById(b, id).side).toBe('enemy');
    }
    expect(events.some((e) => e.type === 'bribe')).toBe(false);
    // Aldric's purse is the only one on the field.
    expect(bribeOffer(b, captain, of(b, 'knights'))).toBeNull();
    expect(battleAct({ ...b, order: [captain.id, ...b.order.filter((x) => x !== captain.id)] }, { type: 'bribe', target: of(b, 'knights').id }).events).toEqual([]);
  });

  it('an outlaw captain from level III slows and curses your stacks', () => {
    const b = fight(army(['bandits', 30], ['cutpurses', 20], ['highwaymanCaptain', 1, 4]));
    const captain = of(b, 'highwaymanCaptain');
    const { events } = playOut(b);
    const cast = castBy(events, captain.id);
    expect([...cast].some((s) => s === 'slow' || s === 'curse')).toBe(true);
    for (const e of events) if (e.type === 'spell' && e.by === captain.id) expect(fighterById(b, e.target).side).toBe('player');
  });

  it('a poacher captain shoots from behind his men, at any of your stacks', () => {
    const b = fight(army(['poachers', 20], ['cutpurses', 10], ['poacherCaptain', 1, 2]));
    const captain = of(b, 'poacherCaptain');
    expect(captain.at).toBe(REAR);
    expect(options(turnOf(b, 'poacherCaptain')).shoot.sort()).toEqual(b.fighters.filter((f) => f.side === 'player').map((f) => f.id).sort());
    const { events } = playOut(b);
    expect(events.some((e) => e.type === 'hit' && e.attacker === captain.id && e.ranged)).toBe(true);
  });
});

describe('Curse (#239)', () => {
  it('makes a stack roll its worst damage for the rest of the battle, and a Bless cancels it', () => {
    const b = fight(army(['bandits', 30], ['highwaymanCaptain', 1, 3]));
    const captain = of(b, 'highwaymanCaptain');
    const cursed = battleAct(turnOf(b, 'bandits'), { type: 'cast', spell: 'curse', target: of(b, 'knights').id, by: captain.id }).battle;
    const knights = of(cursed, 'knights');
    expect(knights.status).toContain('cursed');
    expect(knights.until?.cursed).toBeUndefined();
    // Ten knights at their worst, 5 a blow, against 30 highwaymen: the same whatever the dice.
    const bandits = of(cursed, 'bandits');
    const worst = strike(cursed, knights, bandits, false).damage;
    expect(strike(cursed, knights, bandits, false, 1).damage).toBe(worst);
    expect(strike(cursed, knights, bandits, false, 99).damage).toBe(worst);
    expect(worst).toBeLessThan(strike(b, of(b, 'knights'), of(b, 'bandits'), false).damage);
    const both = { ...knights, status: [...knights.status, 'blessed' as const] };
    expect(strike(cursed, both, bandits, false).damage).toBe(strike(b, of(b, 'knights'), of(b, 'bandits'), false).damage);
    // Your sergeants know a cursed stack is worth less.
    expect(evaluate(cursed, 'enemy')).toBeGreaterThan(evaluate(battleAct(turnOf(b, 'bandits'), { type: 'defend' }).battle, 'enemy'));
  });
});

describe('your sergeants count an enemy hero\u2019s help (#239)', () => {
  /** A knight and four archers: a sure thing against the highwaymen, until a veteran leads them. */
  const aldmoor = (army: GameState['army'] = [{ troop: 'knights', count: 1 }, { troop: 'archers', count: 4 }]): GameState => ({ ...newGame(5, ALDMOOR, 'knight'), opening: undefined, army });
  /** The highwaymen as they were before the climb (#239), fourteen of them, led by this captain. */
  const led = (s: GameState, id: string, captain: Army[number]) => update(s, id, { enemy: { ...locationById(s, id).enemy!, army: [{ troop: 'bandits', count: 14 }, captain] } });

  it('in the odds on a fight, and in the battle as it goes', () => {
    const s = aldmoor();
    const green = led(s, 'highwaymen', { troop: 'highwaymanCaptain', count: 1, level: 1 });
    const veteran = led(s, 'highwaymen', { troop: 'highwaymanCaptain', count: 1, level: 10 });
    expect(winChance(veteran, 'highwaymen')).toBeLessThan(winChance(green, 'highwaymen'));
    const b = startFight(veteran, 'highwaymen')!.state.battle!;
    expect(b.enemyHelp).toEqual({ attack: 5, defence: 4 });
    expect(evaluate(b, 'player')).toBeLessThan(evaluate(startFight(green, 'highwaymen')!.state.battle!, 'player'));
  });

  it('say what his level gives his band, on its cards', () => {
    expect(heroLines(army(['swordsmen', 20], ['sergeant', 1, 2]))).toEqual(['**The Sergeant** is level II, so his band fights with +1 attack.']);
    expect(heroLines(army(['swordsmen', 20], ['pike', 1, 5]))).toEqual(['**Sergeant Pike** is level V, so his band fights with +2 attack and +2 defence, and he knows Stone Skin and Haste.']);
    expect(heroLines(army(['cutpurses', 20], ['cutpurseCaptain', 1, 1]))).toEqual(['**The Cutpurse Captain** is only level I, so his band fights on its own numbers.']);
    expect(heroLines(army(['wolves', 20], ['rook', 1]))).toEqual([]);
    const s = led(aldmoor(), 'highwaymen', { troop: 'highwaymanCaptain', count: 1, level: 4 });
    expect(about(s, 'highwaymen').lines).toContain('**The Highwayman Captain** is level IV, so his band fights with +2 attack and +1 defence, and he knows Slow and Curse.');
  });
});

describe('an enemy hero on the map (#239)', () => {
  const courtier = (): GameState => ({ ...newGame(1066, ALDMOOR, 'courtier'), opening: undefined, gold: 10000, leadership: 600, army: [{ troop: 'knights', count: 40 }, { troop: 'archers', count: 40 }] });
  /** The highwaymen as they were before the climb (#239), fourteen of them, with a captain at level III. */
  const withCaptain = (s: GameState) => update(s, 'highwaymen', { enemy: { ...locationById(s, 'highwaymen').enemy!, army: [{ troop: 'bandits', count: 14 }, { troop: 'highwaymanCaptain', count: 1, level: 3 }] } });
  const cardOf = (r: Result) => r.events.flatMap((e) => (e.type === 'card' ? [e.card] : []))[0];

  it('a Courtier who hires his band buys the men, and their hero, left with nobody, is taken', () => {
    const s = withCaptain(courtier());
    const offer = hireOffer(s, locationById(s, 'highwaymen'))!;
    expect(offer.all).toBe(true);
    expect(offer.joining.map((x) => x.troop)).toEqual(['bandits']);
    const r = apply(s, { type: 'choose', id: 'highwaymen', choice: 'hire' })!;
    expect(locationById(r.state, 'highwaymen').done).toBe(true);
    expect(r.state.army.some((x) => x.troop === 'highwaymanCaptain')).toBe(false);
    // Only some of them fit under his banner: the rest attack, their hero at their head.
    const tight = { ...s, leadership: leadershipUsed(s.army) + 20 };
    const some = apply(tight, { type: 'choose', id: 'highwaymen', choice: 'hire' })!;
    expect(some.state.ambush).toBe('highwaymen');
    expect(locationById(some.state, 'highwaymen').enemy!.army).toContainEqual({ troop: 'highwaymanCaptain', count: 1, level: 3 });
    expect(cardOf(some).title).toBe(locationById(s, 'highwaymen').name);
  });

  it('keeps his band, and his level, when he holds the field', () => {
    const s = { ...withCaptain(courtier()), army: [{ troop: 'peasants' as const, count: 12 }] };
    const started = startFight(s, 'highwaymen')!.state;
    const done = finishFight({ ...started, battle: autoResolve(started.battle!) }).state;
    expect(locationById(done, 'highwaymen').done).toBe(false);
    expect(locationById(done, 'highwaymen').enemy!.army).toContainEqual({ troop: 'highwaymanCaptain', count: 1, level: 3 });
  });

  it('rides out with the Baron at his level, when he has one', () => {
    const s = { ...newGame(3, ALDMOOR, 'knight'), opening: undefined, army: [{ troop: 'knights' as const, count: 10 }], flags: { dig: 'raided' } };
    const lair = locationById(s, 'hideout').enemy!;
    const levelled = update({ ...s, hero: { ...s.hero, at: [700, 530] as [number, number] } }, 'hideout', { enemy: { ...lair, army: lair.army.map((x) => (x.troop === 'baron' ? { ...x, level: 10 } : x)) } });
    const out = endDay(levelled).state;
    expect(locationById(out, 'grimsby').enemy!.army).toContainEqual({ troop: 'baron', count: 1, level: 10 });
    expect(heroInBattle(out)).toBeDefined();
  });

  it('leads his band at the level the province gives him now, in a save from before', () => {
    const wolves = ALDMOOR.locations.find((l) => l.id === 'wolves')!;
    const saved = { ...newGame(5, ALDMOOR, 'knight'), opening: undefined };
    const was = wolves.enemy!.army;
    try {
      wolves.enemy!.army = was.map((x) => (x.troop === 'rook' ? { ...x, level: 7 } : x));
      expect(locationById(withNewPlaces(saved), 'wolves').enemy!.army).toContainEqual({ troop: 'rook', count: 1, level: 7 });
      // Whatever has happened to his pack stays as it was.
      const thinned = update(saved, 'wolves', { enemy: { ...locationById(saved, 'wolves').enemy!, army: [{ troop: 'wolves', count: 40 }, { troop: 'rook', count: 1 }] } });
      expect(locationById(withNewPlaces(thinned), 'wolves').enemy!.army).toEqual([{ troop: 'wolves', count: 40 }, { troop: 'rook', count: 1, level: 7 }]);
      // Beaten, he stays as he was.
      const beaten = update(saved, 'wolves', { done: true });
      expect(locationById(withNewPlaces(beaten), 'wolves').enemy!.army).toEqual(locationById(saved, 'wolves').enemy!.army);
    } finally {
      wolves.enemy!.army = was;
    }
  });

  it('leads Aldmoor\u2019s bands at a level from 1 to 10, and only a leader has one', () => {
    const bands = ALDMOOR.locations.flatMap((l) => [l, ...(l.enemy?.sortie ? [l.enemy.sortie.band] : [])]).filter((l) => l.enemy);
    for (const band of bands) {
      for (const s of band.enemy!.army) {
        if (s.level === undefined) continue;
        expect(TROOPS[s.troop].abilities, `${band.id}: ${s.troop}`).toContain('leads');
        expect(Number.isInteger(s.level) && s.level >= 1 && s.level <= 10, `${band.id}: ${s.troop} at level ${s.level}`).toBe(true);
      }
    }
  });

  it('every enemy hero leads from behind the line, knows only the spells of his people, and says so in the game\u2019s voice', () => {
    for (const id of ['sergeant', 'pike', 'foreman', 'picketCaptain', 'cutpurseCaptain', 'highwaymanCaptain', 'poacherCaptain'] as TroopId[]) {
      const t = TROOPS[id];
      expect(t.abilities, id).toContain('leads');
      expect(t.leadership, id).toBe(99);
      expect(t.note, id).not.toMatch(/[:;\u2014]/);
      for (const spell of t.caster?.spells ?? []) expect(['stoneskin', 'haste', 'slow', 'curse', 'bolt'] as SpellId[]).toContain(spell);
    }
  });
});
