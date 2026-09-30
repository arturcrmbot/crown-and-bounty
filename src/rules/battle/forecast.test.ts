import { describe, expect, it } from 'vitest';
import type { TroopId } from '../../content/troops';
import { heroInBattle } from '../game';
import { newGame } from '../scenario';
import { battleAct, createBattle, type BattleEvent, type BattleHero, type BattleState } from './battle';
import { aimTag, bardTag, forecastOf, type AimTag } from './forecast';
import { hexIndex } from './hex';

const hero: BattleHero = { attack: 1, defence: 1, spellPower: 2, mana: 40, spells: ['bolt', 'bless', 'slow', 'fireball', 'brew'], castRound: 0 };
/** A battle with the stacks where `at` puts them (by id: yours first, then theirs), and `order` to act. */
const field = (player: [TroopId, number][], enemy: [TroopId, number][], at: Record<number, number>, order: number[], more: Partial<BattleHero> = {}): BattleState => {
  const b = createBattle({ place: 'test', seed: 7, player: player.map(([troop, count]) => ({ troop, count })), enemy: enemy.map(([troop, count]) => ({ troop, count })), hero: { ...hero, ...more }, obstacles: 0 });
  return { ...b, order, fighters: b.fighters.map((f) => (at[f.id] !== undefined ? { ...f, at: at[f.id] } : f)) };
};
const hits = (events: BattleEvent[]) => events.filter((e): e is Extract<BattleEvent, { type: 'hit' }> => e.type === 'hit');
const texts = (tag: AimTag | null) => tag!.lines.map((l) => l.text);

describe('the forecast by the pointer', () => {
  it('reckons a blow as the rules would strike it, and their answer', () => {
    const b = field([['knights', 10]], [['swordsmen', 30]], { 0: hexIndex(5, 4), 1: hexIndex(6, 4) }, [0, 1]);
    const action = { type: 'melee' as const, target: 1, from: hexIndex(5, 4) };
    const [blow, back] = hits(battleAct(b, action, true).events);
    const forecast = forecastOf(b, action)!;
    expect(forecast.target).toEqual({ fighter: 1, damage: blow.damage, killed: blow.killed, count: 30 });
    expect(forecast.back).toEqual({ fighter: 0, damage: back.damage, killed: back.killed });
    expect(forecast.first).toBeUndefined();
    expect(forecast.charge).toBe(false);
    const tag = aimTag(b, action)!;
    expect(tag.title).toBe('Attack their swordsmen');
    expect(texts(tag)[0]).toBe(`About ${blow.damage} damage kills ${blow.killed} of the 30.`);
    expect(texts(tag)[1]).toMatch(/^They strike back (and kill \d+|but kill none) of your knights\.$/);
  });

  it('says a charge can\u2019t be answered, and winds the chargers', () => {
    const b = field([['knights', 20]], [['swordsmen', 60]], { 0: hexIndex(2, 4), 1: hexIndex(6, 4) }, [0, 1], { charge: ['knights'] });
    const action = { type: 'melee' as const, target: 1, from: hexIndex(5, 4) };
    const forecast = forecastOf(b, action)!;
    expect(forecast.charge).toBe(true);
    expect(forecast.back).toBeUndefined();
    const tag = aimTag(b, action)!;
    expect(tag.title).toBe('Charge their swordsmen!');
    expect(texts(tag).slice(1)).toEqual(['Nobody can strike back at a charge.', 'The charge winds your knights.']);
  });

  it('warns of a first strike, which costs men before the blow lands, and the blow it weakens', () => {
    const b = field([['swordsmen', 10]], [['peasants', 50]], { 0: hexIndex(0, 4), 1: hexIndex(1, 4) }, [0, 1]);
    const action = { type: 'melee' as const, target: 1, from: hexIndex(0, 4) };
    const [first, blow] = hits(battleAct(b, action, true).events);
    const forecast = forecastOf(b, action)!;
    expect(forecast.first).toEqual({ fighter: 0, damage: first.damage, killed: first.killed });
    expect(forecast.target.damage).toBe(blow.damage);
    expect(forecast.back).toBeUndefined();
    expect(texts(aimTag(b, action))[1]).toMatch(/^They strike first/);
  });

  it('says why a stack that lives won\u2019t strike back: it already has, or it can\u2019t', () => {
    const b = field([['knights', 10]], [['swordsmen', 30]], { 0: hexIndex(5, 4), 1: hexIndex(6, 4) }, [0, 1]);
    const action = { type: 'melee' as const, target: 1, from: hexIndex(5, 4) };
    const spent = { ...b, fighters: b.fighters.map((f) => (f.id === 1 ? { ...f, retaliated: true } : f)) };
    expect(texts(aimTag(spent, action))[1]).toBe('They have already struck back this round.');
    const newts = { ...b, fighters: b.fighters.map((f) => (f.id === 1 ? { ...f, status: ['newts' as const] } : f)) };
    expect(texts(aimTag(newts, action))[1]).toBe('Newts can\u2019t strike back.');
    const winded = { ...b, fighters: b.fighters.map((f) => (f.id === 1 ? { ...f, status: ['winded' as const] } : f)) };
    expect(texts(aimTag(winded, action))[1]).toBe('They are winded, so they can\u2019t strike back.');
  });

  it('forecasts a shot, which nobody answers', () => {
    const b = field([['archers', 20]], [['wolves', 12]], {}, [0, 1]);
    const action = { type: 'shoot' as const, target: 1 };
    const [shot] = hits(battleAct(b, action, true).events);
    const tag = aimTag(b, action)!;
    expect(tag.title).toBe('Shoot their wolves');
    expect(texts(tag)).toEqual([`About ${shot.damage} damage kills ${shot.killed ? `${shot.killed} of the 12` : 'none of the 12'}.`]);
  });

  it('counts everyone a fireball would catch, and yours in red', () => {
    // Your knights stand next to their bog goblins, and their wolves on the goblins' other side.
    const b = field([['knights', 10]], [['goblins', 30], ['wolves', 12]], { 0: hexIndex(5, 4), 1: hexIndex(6, 4), 2: hexIndex(7, 4) }, [0, 1, 2]);
    const action = { type: 'cast' as const, spell: 'fireball' as const, target: 1 };
    const forecast = forecastOf(b, action)!;
    expect(forecast.target.damage).toBe(24);
    expect(forecast.caught.map((c) => [c.fighter, c.side]).sort()).toEqual([[0, 'player'], [2, 'enemy']]);
    const tag = aimTag(b, action)!;
    expect(tag.title).toBe('Cast Fireball on their bog goblins');
    expect(tag.lines[0].text).toMatch(/^24 damage kills \d+ of the 30\.$/);
    expect(tag.lines.find((l) => l.text.startsWith('It also hits their wolves'))?.danger).toBeFalsy();
    expect(tag.lines.find((l) => l.text.startsWith('It hits your own knights too'))?.danger).toBe(true);
  });

  it('says what a spell that hurts nobody does, and when it would be wasted', () => {
    const b = field([['knights', 10]], [['wolves', 12]], {}, [0, 1]);
    expect(texts(aimTag(b, { type: 'cast', spell: 'slow', target: 1 }))).toEqual(['It halves the stack\u2019s speed for the rest of the battle.']);
    const slowed = { ...b, fighters: b.fighters.map((f) => (f.id === 1 ? { ...f, status: ['slowed' as const] } : f)) };
    expect(texts(aimTag(slowed, { type: 'cast', spell: 'slow', target: 1 }))).toEqual(['They are already slowed.']);
    const hurt = { ...b, fighters: b.fighters.map((f) => (f.id === 0 ? { ...f, count: 7 } : f)) };
    expect(texts(aimTag(hurt, { type: 'cast', spell: 'brew', target: 0 }))).toEqual(['They get 30 health back, and 1 gets up again.']);
    const peasants = field([['peasants', 40]], [['wolves', 12]], {}, [0, 1]);
    const thinned = { ...peasants, fighters: peasants.fighters.map((f) => (f.id === 0 ? { ...f, count: 30 } : f)) };
    expect(texts(aimTag(thinned, { type: 'cast', spell: 'brew', target: 0 }))).toEqual(['They get 30 health back, and 10 get up again.']);
    expect(texts(aimTag(b, { type: 'cast', spell: 'brew', target: 0 }))).toEqual(['They have all their health already.']);
  });

  it('has nothing to say about a move, a wait, or a blow the rules wouldn\u2019t allow', () => {
    const b = field([['knights', 10]], [['wolves', 12]], {}, [0, 1]);
    expect(forecastOf(b, { type: 'move', to: hexIndex(1, 4) })).toBeNull();
    expect(forecastOf(b, { type: 'wait' })).toBeNull();
    expect(forecastOf(b, { type: 'melee', target: 1, from: hexIndex(9, 4) })).toBeNull();
  });

  it('prices a bard\u2019s moves on one of their stacks', () => {
    const tagFor = (swordsmen: number) => {
      const b = createBattle({ place: 'x', seed: 1, player: [{ troop: 'knights', count: 10 }], enemy: [{ troop: 'swordsmen', count: swordsmen }], hero: heroInBattle({ ...newGame(1066, undefined, 'courtier'), opening: undefined }), obstacles: 0 });
      const lord = b.fighters.find((f) => f.hero)!;
      const turn = { ...b, order: [lord.id, ...b.order.filter((x) => x !== lord.id)] };
      return bardTag(turn, turn.fighters.find((f) => f.troop === 'swordsmen')!)!;
    };
    expect(tagFor(5).title).toBe('Pay or jeer their swordsmen');
    expect(texts(tagFor(5))[0]).toBe('80 gold sends them home.');
    // Only as many as his army outweighs take his gold, and none of a stack as strong as his army.
    expect(texts(tagFor(10))[0]).toBe('130 gold sends 8 of them home.');
    expect(texts(tagFor(50))[0]).toBe('They take no gold from an army no stronger than theirs, but you can jeer them.');
  });

  it('keeps the game\u2019s voice: short full sentences, with no colons or dashes', () => {
    const b = field([['knights', 10]], [['goblins', 30], ['wolves', 12]], { 0: hexIndex(5, 4), 1: hexIndex(6, 4), 2: hexIndex(7, 4) }, [0, 1, 2], { charge: ['knights'] });
    const tags = [aimTag(b, { type: 'melee', target: 1, from: hexIndex(5, 4) }), aimTag(b, { type: 'cast', spell: 'fireball', target: 1 }), aimTag(b, { type: 'cast', spell: 'bless', target: 0 }), aimTag(b, { type: 'cast', spell: 'bolt', target: 2 })];
    for (const line of tags.flatMap((t) => t!.lines)) {
      expect(line.text).toMatch(/^[A-Z0-9].*[.!]$/);
      expect(line.text).not.toMatch(/[:;\u2013\u2014]| - /);
    }
  });
});
