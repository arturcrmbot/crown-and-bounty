import { describe, expect, it } from 'vitest';
import { newGame } from '../rules/scenario';
import { gainsOf } from './gains';

const start = () => ({ ...newGame(), opening: false });
const texts = (before: ReturnType<typeof start>, after: ReturnType<typeof start>) => gainsOf(before, after).map((g) => g.text);

describe('what rises off the hero', () => {
  it('says the gold, troops, leadership and experience he gained, as it always did', () => {
    const before = start();
    const after = { ...before, gold: before.gold + 250, leadership: before.leadership + 20, army: [...before.army, { troop: 'peasants' as const, count: 30 }], hero: { ...before.hero, xp: before.hero.xp + 40 } };
    expect(texts(before, after)).toEqual(['+250 gold', '+30 Peasants', '+20 leadership', '+40 experience']);
  });

  it('says gold spent in red words, as a minus', () => {
    const before = start();
    expect(gainsOf(before, { ...before, gold: before.gold - 1500 })).toEqual([{ kind: 'gold', amount: -1500, text: '\u22121,500 gold' }]);
  });

  it('says movement he gains during the day', () => {
    const before = { ...start(), movement: 60 };
    expect(texts(before, { ...before, movement: 100 })).toEqual(['+40 movement']);
  });

  it('says nothing of the new day\u2019s riding, or the mana that comes back at dawn', () => {
    const before = { ...start(), movement: 0, hero: { ...start().hero, mana: 2 } };
    const dawn = { ...before, day: before.day + 1, movement: 150, hero: { ...before.hero, mana: 5 } };
    expect(gainsOf(before, dawn).filter((g) => g.kind === 'movement' || g.kind === 'mana')).toEqual([]);
  });

  it('says mana he gains during the day', () => {
    const before = { ...start(), hero: { ...start().hero, mana: 4 } };
    expect(texts(before, { ...before, hero: { ...before.hero, mana: 20 } })).toEqual(['+16 mana']);
  });

  it('names a spell he learns', () => {
    const before = start();
    expect(texts(before, { ...before, hero: { ...before.hero, spells: [...before.hero.spells, 'haste'] } })).toEqual(['New spell: Haste']);
  });

  it('names gear he finds, and says which', () => {
    const before = start();
    const after = { ...before, hero: { ...before.hero, gear: { ...before.hero.gear, helm: 'pilgrimsHat' as const } } };
    expect(gainsOf(before, after)).toEqual([{ kind: 'gear', amount: 1, text: 'A Pilgrim\u2019s Hat', artifact: 'pilgrimsHat' }]);
  });

  it('says nothing of gear he only moves between his pack and a slot', () => {
    const before = { ...start(), hero: { ...start().hero, pack: ['pilgrimsHat' as const] } };
    const worn = { ...before, hero: { ...before.hero, pack: [], gear: { ...before.hero.gear, helm: 'pilgrimsHat' as const } } };
    expect(gainsOf(before, worn)).toEqual([]);
  });

  it('says the level he reaches, rather than the experience that took him there', () => {
    const before = start();
    expect(texts(before, { ...before, hero: { ...before.hero, level: 2, xp: 160 } })).toEqual(['Level II!']);
  });
});
