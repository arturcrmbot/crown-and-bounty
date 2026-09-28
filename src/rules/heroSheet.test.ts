import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../content/aldmoor';
import { apply, heroInBattle, heroStats, type GameState } from './game';
import { barNote, manaInBattle, manaNote, nextPayday } from './heroSheet';
import { newGame } from './scenario';

const wizard = (): GameState => ({ ...newGame(1066, ALDMOOR, 'wizard'), opening: undefined });

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
