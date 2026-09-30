import { describe, expect, it } from 'vitest';
import type { BackgroundId } from '../content/backgrounds';
import type { TroopId } from '../content/troops';
import type { BattleState, Fighter } from './battle/battle';
import { finishFight, locationById, oddsKnown, startFight, visit, winChance, type Card, type GameState, type Result } from './game';
import { newGame } from './scenario';

const fresh = (background: BackgroundId = 'knight'): GameState => ({ ...newGame(1066, undefined, background), opening: undefined });
const armyOf = (state: GameState, id: string) => locationById(state, id).enemy!.army;
const cardOf = (result: Result): Card => {
  const e = result.events.find((x) => x.type === 'card');
  if (!e || e.type !== 'card') throw new Error('no card');
  return e.card;
};

/**
 * The fight at `id` as it ends: each enemy troop cut down to its count in `counts` (the rest as they
 * began), and `more` fighters on the field besides. A lost fight has nobody of his left standing.
 */
function ended(state: GameState, id: string, result: 'fled' | 'lost', counts: Partial<Record<TroopId, number | Partial<Fighter>>>, more: (b: BattleState) => Fighter[] = () => []): GameState {
  const started = startFight(state, id)!.state;
  const b = started.battle!;
  const fighters = b.fighters.map((f) => {
    const to = f.side === 'enemy' ? counts[f.troop] : undefined;
    if (to !== undefined) return { ...f, ...(typeof to === 'number' ? { count: to } : to) };
    if (result === 'lost' && f.side === 'player' && !f.hero) return { ...f, count: 0, hp: 0 };
    return f;
  });
  return { ...started, battle: { ...b, result, fighters: [...fighters, ...more(b)] } };
}

describe('the enemy keeps its losses', () => {
  it('after a retreat: whoever of them fell stays fallen, the card says who is left, and the next fight is with them', () => {
    const s = fresh();
    const r = finishFight(ended(s, 'patrol', 'fled', { swordsmen: 28, crossbowmen: 0 }));
    expect(armyOf(r.state, 'patrol')).toEqual([{ troop: 'swordsmen', count: 28 }]);
    // Everything else about them is as it was.
    expect(locationById(r.state, 'patrol').enemy!.reward).toBe(locationById(s, 'patrol').enemy!.reward);
    const card = cardOf(r);
    expect(card.title).toBe('Retreat!');
    expect(card.battleResult!.enemy).toEqual([{ troop: 'swordsmen', count: 42 }, { troop: 'crossbowmen', count: 40 }]);
    expect(card.lines.at(-1)).toBe('*They have 28 Swordsmen left.*');
    // The map draws them as they are now.
    expect(r.events).toContainEqual({ type: 'changed', id: 'patrol' });
    const again = startFight({ ...r.state, army: s.army }, 'patrol')!.state.battle!;
    expect(again.fighters.filter((f) => f.side === 'enemy').map((f) => [f.troop, f.count])).toEqual([['swordsmen', 28]]);
  });

  it('after a defeat at the stockade: Grimsby has who is left, and the guard he called goes back where it came from', () => {
    // The Wizard's day XVI: his bolts cut the swordsmen down to 4 and every crossbowman, and the Baron called his guard.
    const s = fresh('wizard');
    const guard = (b: BattleState): Fighter[] => {
      const swordsmen = b.fighters.find((f) => f.side === 'enemy' && f.troop === 'swordsmen')!;
      return [{ ...swordsmen, id: b.fighters.length, count: 9, startCount: 21, called: true }];
    };
    const r = finishFight(ended(s, 'hideout', 'lost', { swordsmen: 4, crossbowmen: 0 }, guard));
    expect(armyOf(r.state, 'hideout')).toEqual([{ troop: 'swordsmen', count: 4 }, { troop: 'baron', count: 1 }]);
    const card = cardOf(r);
    expect(card.title).toBe('Defeat');
    // Every one of his that fell is counted, his guard's too.
    expect(card.battleResult!.enemy).toEqual([{ troop: 'swordsmen', count: 65 + 12 }, { troop: 'crossbowmen', count: 36 }]);
    expect(card.lines.at(-1)).toBe('*Baron Grimsby has 4 Swordsmen left.*');
    // He rode home to raise another army; storming the stockade again is against the 4 and the Baron.
    const back = { ...r.state, army: s.army };
    const again = startFight(back, 'hideout')!.state.battle!;
    expect(again.fighters.filter((f) => f.side === 'enemy').map((f) => [f.troop, f.count])).toEqual([['swordsmen', 4], ['baron', 1]]);
    expect(winChance(back, 'hideout', 8)).toBeGreaterThan(winChance(s, 'hideout', 8));
  });

  it('keeps those paid to go home gone, and those bought over with you', () => {
    const s = fresh('courtier');
    const bribed = (b: BattleState): Fighter[] => {
      const swordsmen = b.fighters.find((f) => f.side === 'enemy' && f.troop === 'swordsmen')!;
      return [{ ...swordsmen, id: b.fighters.length, side: 'player', count: 12, startCount: 12 }];
    };
    // 70 swordsmen: 30 paid to go home, 12 bought over, and 28 still there.
    const r = finishFight(ended(s, 'patrol', 'fled', { swordsmen: { count: 28, left: 42 } }, bribed));
    expect(armyOf(r.state, 'patrol')).toEqual([{ troop: 'swordsmen', count: 28 }, { troop: 'crossbowmen', count: 40 }]);
    expect(cardOf(r).battleResult!.enemy).toEqual([]);
    expect(cardOf(r).lines.at(-1)).toBe('*They have 28 Swordsmen and 40 Crossbowmen left.*');
    // A quarter of every company is lost on the way back, the turncoats' too.
    expect(r.state.army.find((x) => x.troop === 'swordsmen')?.count).toBe(9);
  });

  it('changes nothing when they lost nobody: the odds worked out already still hold', () => {
    const s = fresh();
    const before = locationById(s, 'patrol').enemy!;
    const r = finishFight(ended(s, 'patrol', 'fled', {}));
    expect(locationById(r.state, 'patrol').enemy).toBe(before);
    expect(r.events.some((e) => e.type === 'changed')).toBe(false);
    expect(cardOf(r).lines.join(' ')).not.toContain('left.*');
  });

  it('gives the odds of the fight with who is left: the ones worked out for the whole band are no use now', () => {
    const s = fresh();
    winChance(s, 'patrol');
    expect(oddsKnown(s, 'patrol')).toBe(true);
    const r = finishFight(ended(s, 'patrol', 'fled', { swordsmen: 10, crossbowmen: 5 }));
    const back = { ...r.state, army: s.army };
    // The odds worker goes after them again (see game/odds.ts), and they're better.
    expect(oddsKnown(back, 'patrol')).toBe(false);
    expect(winChance(back, 'patrol')).toBeGreaterThan(winChance(s, 'patrol'));
    expect(oddsKnown(back, 'patrol')).toBe(true);
  });

  it('keeps the goose\u2019s hymn for when there are crossbowmen left to run after her', () => {
    const s: GameState = { ...fresh(), flags: { goose: true } };
    const hymn = (state: GameState) => cardOf(visit(state, 'hideout')).choices.some((c) => c.label.startsWith('Whistle'));
    expect(hymn(s)).toBe(true);
    const r = finishFight(ended(s, 'hideout', 'lost', { crossbowmen: 0 }));
    expect(hymn({ ...r.state, army: s.army })).toBe(false);
  });
});
