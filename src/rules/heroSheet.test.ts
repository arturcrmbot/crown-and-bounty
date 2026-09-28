import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../content/aldmoor';
import { createBattle } from './battle/battle';
import { rowOf } from './battle/hex';
import { apply, giveArtifact, heroInBattle, heroStats, type GameState } from './game';
import { barNote, heroSheet, manaInBattle, manaNote, nextPayday, stackSheet } from './heroSheet';
import { newGame } from './scenario';

const wizard = (): GameState => ({ ...newGame(1066, ALDMOOR, 'wizard'), opening: undefined });
const knight = (): GameState => ({ ...newGame(1066, ALDMOOR, 'knight'), opening: undefined });

describe('mana you can see', () => {
  it('says what is left, the most he holds, and when it comes back', () => {
    const w = wizard();
    expect(manaNote(w)).toBe('Mana 30/30 · it fills up again every dawn');
    const spent = apply(w, { type: 'mapSpell', spell: 'farsight' })!.state;
    expect(manaNote(spent)).toBe('Mana 20/30 · full again at dawn');
    const dawn = apply(spent, { type: 'endDay' })!.state;
    expect(dawn.hero.mana).toBe(heroStats(dawn).maxMana);
    const empty = { ...w, hero: { ...w.hero, knowledge: 0 } };
    expect(manaNote(empty)).toContain('No mana');
  });

  it('goes into battle with its maximum, for the spellbook', () => {
    const w = wizard();
    expect(heroInBattle(w).maxMana).toBe(30);
    expect(manaInBattle(12, 30)).toBe('Mana **12/30**: none comes back in battle, but it\u2019s full again at dawn.');
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
    expect(barNote(w, { kind: 'bounty' })).toBe('Wanted: Baron Grimsby, by day 100 · 99 days left');
    expect(barNote(w, { kind: 'day' })).toContain('next on day VIII');
    expect(barNote(w, { kind: 'hourglass' })).toBe('End the day (E)');
  });
});

describe('gear, moved by hand', () => {
  const kitted = (): GameState => {
    let s = giveArtifact(knight(), 'luckyHorseshoe');
    for (const id of ['wizardsButton', 'swordOfAldmoor', 'goldenFeather', 'astrolabe'] as const) s = giveArtifact(s, id);
    return s;
  };

  it('wears from a pack square, and what was worn takes that square', () => {
    const s = kitted();
    expect(s.hero.gear).toEqual({ trinket: 'luckyHorseshoe', weapon: 'swordOfAldmoor' });
    expect(s.hero.pack).toEqual(['wizardsButton', 'goldenFeather', 'astrolabe']);
    const worn = apply(s, { type: 'wear', from: 1 })!.state;
    expect(worn.hero.gear.trinket).toBe('goldenFeather');
    expect(worn.hero.pack).toEqual(['wizardsButton', 'luckyHorseshoe', 'astrolabe']);
    expect(apply(s, { type: 'wear', from: 9 })).toBeNull();
  });

  it('takes off into a chosen square, or the end of the pack', () => {
    const s = kitted();
    const off = apply(s, { type: 'unequip', slot: 'weapon' })!.state;
    expect(off.hero.gear.weapon).toBeUndefined();
    expect(off.hero.pack).toEqual(['wizardsButton', 'goldenFeather', 'astrolabe', 'swordOfAldmoor']);
    expect(heroStats(off).attack).toBe(heroStats(s).attack - 2);
    const placed = apply(s, { type: 'unequip', slot: 'weapon', to: 0 })!.state;
    expect(placed.hero.pack).toEqual(['swordOfAldmoor', 'wizardsButton', 'goldenFeather', 'astrolabe']);
    expect(apply(s, { type: 'unequip', slot: 'helm' })).toBeNull();
  });

  it('swaps what is worn with an artifact for the same slot it is dropped on', () => {
    const swapped = apply(kitted(), { type: 'unequip', slot: 'trinket', to: 2 })!.state;
    expect(swapped.hero.gear.trinket).toBe('astrolabe');
    expect(swapped.hero.pack).toEqual(['wizardsButton', 'goldenFeather', 'luckyHorseshoe']);
  });

  it('moves artifacts between pack squares: onto another they swap, past the last they go to the end', () => {
    const s = kitted();
    expect(apply(s, { type: 'movePack', from: 0, to: 2 })!.state.hero.pack).toEqual(['astrolabe', 'goldenFeather', 'wizardsButton']);
    expect(apply(s, { type: 'movePack', from: 0, to: 7 })!.state.hero.pack).toEqual(['goldenFeather', 'astrolabe', 'wizardsButton']);
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
    expect(sheet.xp).toEqual({ share: 0, line: '0 / 150 experience: 150 more for level II' });
    expect(sheet.stats.map((s) => s.value)).toEqual([0, 1, 3, 3]);
    expect(sheet.stats[2].note).toContain('a Lightning Bolt does 60 damage');
    expect(sheet.mana).toEqual({ left: 30, max: 30, line: 'Mana 30/30 · it fills up again every dawn' });
    expect(sheet.leadership.used).toBe(84);
    expect(sheet.signature.name).toBe('Hedge Magic');
    expect(sheet.spells.map((s) => s.name)).toEqual(['Lightning Bolt', 'Bless', 'Slow', 'Haste']);
    expect(sheet.spells[0].note.startsWith('5 mana')).toBe(true);
    expect(sheet.mapSpells).toEqual([{ spell: 'farsight', label: 'Cast Far Sight (10 mana)', note: expect.any(String), disabled: false }]);
    const skilled = { ...wizard(), hero: { ...wizard().hero, attack: 1, skills: { sorcery: 2 } } };
    const again = heroSheet(giveArtifact(skilled, 'swordOfAldmoor'));
    expect(again.skills).toEqual([{ name: 'Advanced Sorcery', note: expect.any(String) }]);
    expect(again.stats[0].note).toBe('Attack 3 (1 his own, +2 from skills and gear): every stack of his adds it to its own attack.');
  });

  it('shows what a stack fights with, and what the hero adds', () => {
    const k = stackSheet(knight(), 0)!;
    expect(k.title).toBe('10 Knights');
    expect(k.stats.slice(0, 2)).toEqual([
      { name: 'Attack', value: '10', note: '8 their own, +2 from Sir Aldric' },
      { name: 'Defence', value: '10', note: '8 their own, +2 from Sir Aldric' },
    ]);
    expect(k.traits.map((t) => t.name)).toEqual(['Banner of the Realm', 'Charge (Banner of the Realm)']);
    expect(k.wages).toBe('Wages: 80 gold every payday');
    const ranger = { ...newGame(1066, ALDMOOR, 'ranger'), opening: undefined };
    const archers = stackSheet(ranger, 1)!;
    expect(archers.stats.find((s) => s.name === 'Shots')).toEqual({ name: 'Shots', value: '16', note: '12 their own, +4 from Aldric' });
    expect(archers.traits.map((t) => t.name)).toEqual(['Shooter', 'Pathfinder', 'First volley (Pathfinder)']);
  });
});
