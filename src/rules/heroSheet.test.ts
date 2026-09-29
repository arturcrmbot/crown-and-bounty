import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../content/aldmoor';
import { createBattle } from './battle/battle';
import { rowOf } from './battle/hex';
import { apply, giveArtifact, heroInBattle, heroStats, visit, type GameState } from './game';
import { barNote, heroSheet, leaderSheet, manaInBattle, manaNote, nextPayday, spiritsOf, stackSheet } from './heroSheet';
import { newGame } from './scenario';

const wizard = (): GameState => ({ ...newGame(1066, ALDMOOR, 'wizard'), opening: undefined });
const knight = (): GameState => ({ ...newGame(1066, ALDMOOR, 'knight'), opening: undefined });

describe('mana you can see', () => {
  it('says what is left, the most he holds, and when it comes back', () => {
    const w = wizard();
    expect(manaNote(w)).toBe('Mana 30/30 · full; a quarter back every dawn, and a holy well or your castle fills it');
    const spent = apply(w, { type: 'mapSpell', spell: 'farsight' })!.state;
    expect(manaNote(spent)).toBe('Mana 20/30 · a quarter back every dawn, and a holy well or your castle fills it');
    // A quarter of the most he holds comes back at dawn (rounded up), never past it.
    const dawn = apply(spent, { type: 'endDay' })!.state;
    expect(dawn.hero.mana).toBe(28);
    expect(apply(dawn, { type: 'endDay' })!.state.hero.mana).toBe(30);
    const dry = apply({ ...w, hero: { ...w.hero, mana: 0 } }, { type: 'endDay' })!.state;
    expect(dry.hero.mana).toBe(8);
    const empty = { ...w, hero: { ...w.hero, knowledge: 0 } };
    expect(manaNote(empty)).toContain('No mana');
    // Advanced Mysticism brings mana back on the road, too.
    const mystic = { ...spent, hero: { ...spent.hero, skills: { mysticism: 2 } } };
    expect(manaNote(mystic)).toBe('Mana 20/50 · a point back every 15 movement ridden, and a quarter at dawn, and a holy well or your castle fills it');
    expect(heroSheet(mystic).mana.back).toBe('back as you ride');
  });

  it('fills up at his castle, as at a holy well', () => {
    const w = wizard();
    const low = { ...w, hero: { ...w.hero, mana: 4, at: w.locations.find((l) => l.id === 'castle')!.at } };
    const r = visit(low, 'castle');
    expect(r.state.hero.mana).toBe(30);
    const card = r.events.find((e) => e.type === 'card');
    expect(card?.type === 'card' && card.card.lines[0]).toBe('An hour in the castle chapel, and your head is clear again: **+26 mana**, 30 of 30.');
    // Full already: nothing to say.
    const again = visit(r.state, 'castle');
    const plain = again.events.find((e) => e.type === 'card');
    expect(plain?.type === 'card' && plain.card.lines.join(' ')).not.toContain('chapel');
    // A village has no chapel for it.
    const village = visit({ ...low, hero: { ...low.hero, at: w.locations.find((l) => l.id === 'village')!.at } }, 'village');
    expect(village.state.hero.mana).toBe(4);
  });

  it('goes into battle with its maximum, for the spellbook', () => {
    const w = wizard();
    expect(heroInBattle(w).maxMana).toBe(30);
    expect(manaInBattle(12, 30)).toBe('Mana **12/30**: none comes back in battle, and only a quarter at dawn.');
    expect(manaInBattle(12)).toContain('none comes back');
  });
});

describe('the bottom bar', () => {
  it('knows when payday comes', () => {
    const w = wizard();
    expect(nextPayday(w)).toBe(8);
    expect(nextPayday({ ...w, day: 7 })).toBe(8);
    expect(nextPayday({ ...w, day: 8 })).toBe(15);
  });

  it('says what each number means under the pointer', () => {
    const w = wizard();
    expect(barNote(w, { kind: 'gold' })).toBe('1,250 gold · payday on day VIII: the King sends 1,000, wages take 130');
    expect(barNote(w, { kind: 'stack', index: 0 })).toContain('8 Knights');
    expect(barNote(w, { kind: 'mana' })).toContain('Mana 30/30');
    expect(barNote(w, { kind: 'movement' })).toBe('150 movement left today, of 150 · E ends the day');
    expect(barNote(w, { kind: 'bounty' })).toBe('Wanted: Baron Grimsby, by day 100 · 99 days left · click for the poster');
    expect(barNote(w, { kind: 'day' })).toBe('Day I of 100 · payday once a week, next on day VIII');
    expect(barNote({ ...w, day: 7 }, { kind: 'day' })).toContain('next on day VIII');
    expect(barNote(w, { kind: 'hourglass' })).toBe('End the day (E)');
    // The panel's plates beside the minimap: Aldric's, and the pieces of the old map on the bounty's.
    expect(barNote(w, { kind: 'hero' })).toBe('Aldric the Hedge Wizard \u00b7 level I \u00b7 click (or H) for his gear and army');
    expect(barNote(w, { kind: 'pieces' })).toContain('Pieces of the old map: 0 of 5');
    expect(barNote({ ...w, bounty: 'paid' }, { kind: 'pieces' })).toContain('1 of 5');
  });
});

describe('gear, moved by hand', () => {
  const kitted = (): GameState => {
    let s = giveArtifact(knight(), 'luckyHorseshoe');
    for (const id of ['wizardsButton', 'swordOfAldmoor', 'goldenFeather', 'astrolabe', 'breastplate', 'trollhide', 'dwarvenHelm', 'helmOfFarSight'] as const) s = giveArtifact(s, id);
    return s;
  };

  it('wears from a pack square, and what was worn takes that square', () => {
    const s = kitted();
    expect(s.hero.gear).toEqual({ trinket: 'luckyHorseshoe', trinket2: 'wizardsButton', weapon: 'swordOfAldmoor', trinket3: 'goldenFeather', armour: 'breastplate', helm: 'dwarvenHelm' });
    expect(s.hero.pack).toEqual(['astrolabe', 'trollhide', 'helmOfFarSight']);
    const worn = apply(s, { type: 'wear', from: 0, slot: 'trinket2' })!.state;
    expect(worn.hero.gear.trinket2).toBe('astrolabe');
    expect(worn.hero.pack).toEqual(['wizardsButton', 'trollhide', 'helmOfFarSight']);
    expect(apply(s, { type: 'wear', from: 9 })).toBeNull();
  });

  it('can target the third trinket slot directly', () => {
    const s = kitted();
    const worn = apply(s, { type: 'wear', from: 0, slot: 'trinket3' })!.state;
    expect(worn.hero.gear.trinket3).toBe('astrolabe');
    expect(worn.hero.pack).toEqual(['goldenFeather', 'trollhide', 'helmOfFarSight']);
  });

  it('takes off into a chosen square, or the end of the pack', () => {
    const s = kitted();
    const off = apply(s, { type: 'unequip', slot: 'weapon' })!.state;
    expect(off.hero.gear.weapon).toBeUndefined();
    expect(off.hero.pack).toEqual(['astrolabe', 'trollhide', 'helmOfFarSight', 'swordOfAldmoor']);
    expect(heroStats(off).attack).toBe(heroStats(s).attack - 2);
    const placed = apply(s, { type: 'unequip', slot: 'weapon', to: 0 })!.state;
    expect(placed.hero.pack).toEqual(['swordOfAldmoor', 'astrolabe', 'trollhide', 'helmOfFarSight']);
    expect(apply(s, { type: 'unequip', slot: 'banner' })).toBeNull();
  });

  it('swaps what is worn with an artifact for the same slot it is dropped on', () => {
    const swapped = apply(kitted(), { type: 'unequip', slot: 'trinket', to: 0 })!.state;
    expect(swapped.hero.gear.trinket).toBe('astrolabe');
    expect(swapped.hero.pack).toEqual(['luckyHorseshoe', 'trollhide', 'helmOfFarSight']);
  });

  it('moves artifacts between pack squares: onto another they swap, past the last they go to the end', () => {
    const s = kitted();
    expect(apply(s, { type: 'movePack', from: 0, to: 2 })!.state.hero.pack).toEqual(['helmOfFarSight', 'trollhide', 'astrolabe']);
    expect(apply(s, { type: 'movePack', from: 0, to: 7 })!.state.hero.pack).toEqual(['trollhide', 'helmOfFarSight', 'astrolabe']);
    expect(apply(s, { type: 'movePack', from: 2, to: 7 })).toBeNull();
    expect(apply(s, { type: 'movePack', from: 1, to: 1 })).toBeNull();
  });

  it('takes the mana away with the knowledge that gave it', () => {
    let s = giveArtifact(knight(), 'astrolabe');
    s = { ...s, hero: { ...s.hero, mana: heroStats(s).maxMana } };
    const off = apply(s, { type: 'unequip', slot: 'trinket' })!.state;
    expect(off.hero.mana).toBe(heroStats(off).maxMana);
    expect(off.hero.mana).toBeLessThan(s.hero.mana);
  });
});

describe('the army, moved by hand', () => {
  const three = (): GameState => ({ ...knight(), army: [{ troop: 'knights', count: 10 }, { troop: 'archers', count: 20 }, { troop: 'peasants', count: 30 }] });

  it('moves stacks along the line, and the line sets their rows in battle', () => {
    const moved = apply(three(), { type: 'moveStack', from: 2, to: 0 })!.state;
    expect(moved.army.map((s) => s.troop)).toEqual(['peasants', 'archers', 'knights']);
    expect(stackSheet(moved, 0)!.row).toBe('In battle they stand in the middle of the line.');
    expect(stackSheet(moved, 2)!.row).toBe('In battle they stand below the middle of the line.');
    const battle = createBattle({ place: 'x', seed: 1, player: moved.army, enemy: [{ troop: 'wolves', count: 5 }], hero: heroInBattle(moved) });
    expect(rowOf(battle.fighters.find((f) => f.troop === 'peasants')!.at)).toBe(4);
    expect(apply(three(), { type: 'moveStack', from: 0, to: 4 })!.state.army.map((s) => s.troop)).toEqual(['archers', 'peasants', 'knights']);
    expect(apply(three(), { type: 'moveStack', from: 2, to: 4 })).toBeNull();
  });

  it('dismisses a stack for good, but never the last one', () => {
    const fewer = apply(three(), { type: 'dismiss', index: 1 })!.state;
    expect(fewer.army.map((s) => s.troop)).toEqual(['knights', 'peasants']);
    const alone = { ...knight(), army: [{ troop: 'knights' as const, count: 10 }] };
    expect(apply(alone, { type: 'dismiss', index: 0 })).toBeNull();
    expect(stackSheet(alone, 0)!.canDismiss).toBe(false);
  });
});

describe('the hero screen', () => {
  it('shows his numbers, what he knows and what he can cast', () => {
    const sheet = heroSheet(wizard());
    expect(sheet.title).toBe('Aldric the Hedge Wizard');
    expect(sheet.level).toBe('Level I');
    expect(sheet.xp).toEqual({ share: 0, line: '0 / 150 experience: 150 more for level II. Fights and new places bring it.' });
    expect(sheet.stats.map((s) => s.value)).toEqual([0, 1, 3, 3]);
    expect(sheet.stats[2].note).toContain('a Lightning Bolt does 60 damage');
    expect(sheet.mana).toEqual({ left: 30, max: 30, line: 'Mana 30/30 · full; a quarter back every dawn, and a holy well or your castle fills it', back: 'full' });
    expect(sheet.leadership.used).toBe(84);
    expect(sheet.signature.name).toBe('Hedge Magic');
    expect(sheet.spells.map((s) => s.name)).toEqual(['Lightning Bolt', 'Bless', 'Slow', 'Haste']);
    expect(sheet.spells[0].note.startsWith('5 mana')).toBe(true);
    expect(sheet.mapSpells).toEqual([{ spell: 'farsight', label: 'Cast Far Sight (10 mana)', note: expect.any(String), disabled: false }]);
    const skilled = { ...wizard(), hero: { ...wizard().hero, attack: 1, skills: { sorcery: 2 } } };
    const again = heroSheet(giveArtifact(skilled, 'swordOfAldmoor'));
    expect(again.skills).toEqual([{ name: 'Advanced Sorcery', note: expect.any(String) }]);
    expect(again.stats[0].note).toBe('Attack 3 (1 his own, +2 from skills and gear): added to his own attack in battle, and to every stack\u2019s.');
  });

  it('shows what a stack fights with, and what the hero adds', () => {
    const k = stackSheet(knight(), 0)!;
    expect(k.title).toBe('10 Knights');
    expect(k.stats.slice(0, 2)).toEqual([
      { name: 'Attack', value: '10', note: '8 their own, +2 from Sir Aldric' },
      { name: 'Defence', value: '10', note: '8 their own, +2 from Sir Aldric' },
    ]);
    expect(k.traits.map((t) => t.name)).toEqual(['Banner of the Realm', 'Charge (Banner of the Realm)']);
    // Taught twice, still one charge.
    const lanced = stackSheet(giveArtifact(knight(), 'brannocsLance'), 0)!;
    expect(lanced.traits.filter((t) => t.name.startsWith('Charge'))).toHaveLength(1);
    expect(lanced.traits.map((t) => t.name)).toContain('Charge (Banner of the Realm, Sir Brannoc\u2019s Lance)');
    expect(k.wages).toBe('Wages: 80 gold every payday');
    const ranger = { ...newGame(1066, ALDMOOR, 'ranger'), opening: undefined };
    const archers = stackSheet(ranger, 1)!;
    expect(archers.stats.find((s) => s.name === 'Shots')).toEqual({ name: 'Shots', value: '16', note: '12 their own, +4 from Aldric' });
    expect(archers.traits.map((t) => t.name)).toEqual(['Shooter', 'Pathfinder', 'First volley (Pathfinder)']);
    const horned = stackSheet(giveArtifact(ranger, 'poachersHorn'), 1)!;
    expect(horned.traits.filter((t) => t.name.startsWith('First volley')).map((t) => t.name)).toEqual(['First volley (Pathfinder, The Poacher\u2019s Horn)']);
    // The old King's huntsmen draw no wages, and say why; beasts work for the fun of it.
    const hunters = stackSheet({ ...knight(), army: [{ troop: 'huntsmen', count: 12 }, { troop: 'bears', count: 2 }] }, 0)!;
    expect(hunters.wages).toBe('Wages: none. They serve the old King still, and they have a score to settle with Rook.');
    expect(hunters.traits.map((t) => t.name)).toContain('Hunter');
    expect(stackSheet({ ...knight(), army: [{ troop: 'huntsmen', count: 12 }, { troop: 'bears', count: 2 }] }, 1)!.wages).toBe('Wages: none. They work for the fun of it.');
  });

  it('gives every stack its luck and morale, and says why', () => {
    expect(stackSheet(knight(), 0)!.stats.slice(-2)).toEqual([
      { name: 'Luck', value: '0', note: 'none to speak of' },
      { name: 'Morale', value: '0', note: 'steady' },
    ]);
    const favoured = { ...knight(), hero: { ...knight().hero, perks: ['fortunesFavour' as const] } };
    expect(stackSheet(favoured, 0)!.stats.slice(-2)).toEqual([
      { name: 'Luck', value: '+10%', note: 'chance a blow lands twice as hard' },
      { name: 'Morale', value: '+10%', note: 'chance they go again, each round' },
    ]);
    // Why, a line for each gift among the traits.
    expect(stackSheet(favoured, 0)!.traits).toContainEqual({ name: 'Fortune\u2019s Favour', note: '+10% luck, +10% morale.' });
    const footed = stackSheet(giveArtifact(favoured, 'rabbitsFoot'), 1)!;
    expect(footed.stats.at(-2)).toMatchObject({ name: 'Luck', value: '+20%' });
    expect(footed.traits).toContainEqual({ name: 'A Rabbit\u2019s Foot', note: '+10% luck.' });
    // Wild things in the King's army: both sides grumble.
    const wild = { ...knight(), army: [...knight().army, { troop: 'wolves' as const, count: 10 }] };
    expect(stackSheet(wild, 0)!.stats.at(-1)).toEqual({ name: 'Morale', value: '\u221210%', note: 'chance they lose heart, and their turn' });
    expect(stackSheet(wild, 0)!.traits).toContainEqual({ name: 'Uneasy company', note: 'They won\u2019t march happily beside the Wolves: \u221210% morale.' });
    expect(stackSheet(wild, 2)!.traits).toContainEqual({ name: 'Uneasy company', note: 'They won\u2019t march happily beside the Knights and Archers: \u221210% morale.' });
    const evened = stackSheet({ ...wild, hero: favoured.hero }, 0)!;
    expect(evened.stats.at(-1)).toEqual({ name: 'Morale', value: '0', note: 'steady: it evens out' });
    expect(evened.traits.map((t) => t.name)).toEqual(expect.arrayContaining(['Fortune\u2019s Favour', 'Uneasy company']));
  });

  it('names songs and jeers among the reasons, in battle', () => {
    const b = createBattle({ place: 'x', seed: 1, player: [{ troop: 'knights', count: 5 }, { troop: 'wolves', count: 5 }], enemy: [{ troop: 'swordsmen', count: 5 }], hero: heroInBattle(knight()), obstacles: 0 });
    const knights = { ...b.fighters[0], status: ['heartened' as const] };
    const sung = { ...b, fighters: [knights, ...b.fighters.slice(1)] };
    const s = spiritsOf(sung, knights);
    expect(s.gifts).toEqual([]);
    expect(s.moods).toEqual([{ source: 'Heartened', morale: 0.25 }]);
    expect(s.uneasy).toEqual(['Wolves']);
    expect(s.morale).toBeCloseTo(0.15);
  });
});

describe('the hero\u2019s own card', () => {
  it('shows how he fights from behind the line, from his troop and himself', () => {
    const me = leaderSheet(knight());
    expect(me.troop).toBe('heroKnight');
    expect(me.title).toBe('Sir Aldric, Knight of the Realm');
    expect(me.stats).toEqual([
      { name: 'Attack', value: '6', note: '5 as a fighter, +1 from his Attack' },
      { name: 'Damage', value: '12\u201318', note: 'each blow: +2 a level' },
      { name: 'Speed', value: '6', note: 'hexes he rides out' },
    ]);
    const names = me.traits.map((t) => t.name);
    expect(names.slice(0, 5)).toEqual(['Leads', 'Spells', 'Charge', 'Behind the line', 'Rides out']);
    expect(names.filter((n) => n === 'Charge')).toHaveLength(1);
    expect(me.traits[2].note.startsWith('He and his Knights charge')).toBe(true);
    expect(me.traits[1].note).toBe('One a round from the 1 in his book, cast from behind the line. Mana 10/10: none comes back in battle.');
    expect(me.lines[0]).toBe('In battle Sir Aldric stands behind his men, where no blow, shot or spell can reach him.');
    expect(me.lines[1]).toBe('If his army is beaten, he retreats, and rides home to raise another.');
  });

  it('knows a caster\u2019s bolts grow with his spell power, and that a courtier is a bard who strikes no blow', () => {
    const w = leaderSheet(wizard());
    expect(w.stats.find((s) => s.name === 'Damage')).toEqual({ name: 'Damage', value: '12\u201314', note: 'each blow: +1 a level, +3 per spell power' });
    expect(w.traits[0]).toEqual({ name: 'Leads', note: 'Every stack fights with +1 defence.' });
    expect(w.stats.find((s) => s.name === 'Shots')).toEqual({ name: 'Shots', value: '10', note: 'a battle' });
    expect(w.traits.find((t) => t.name === 'Shooter')?.note).toBe('Shoots from behind the line, at any stack on the field.');
    expect(w.traits.map((t) => t.name)).not.toContain('2 spells a round');
    const courtier = { ...newGame(1066, ALDMOOR, 'courtier'), opening: undefined };
    const lord = leaderSheet(courtier);
    expect(lord.stats).toEqual([]);
    expect(lord.traits.map((t) => t.name)).toEqual(['Leads', 'Spells', 'Behind the line', 'Bard', 'Bribes']);
    // What a bribe costs him, with his silver tongue's half off.
    expect(lord.traits[4].note.startsWith('He pays 4 weeks of a stack\u2019s wages to send it home, or 12 to bring it over if it fits under his banner, less 50%.')).toBe(true);
    const knights = stackSheet(courtier, 0)!;
    expect(knights.stats[0]).toEqual({ name: 'Attack', value: '9', note: '8 their own, +1 from Lord Aldric' });
    expect(knights.traits.map((t) => t.name)).not.toContain('Rallied');
  });
});

