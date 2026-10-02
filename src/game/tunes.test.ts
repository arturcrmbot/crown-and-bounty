import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../content/aldmoor';
import { startFight } from '../rules/game';
import { newGame } from '../rules/scenario';
import { battleTune, provinceTune, villainTune } from './tunes';

describe('which tune plays', () => {
  it('each commission has its own, and the villains theirs', () => {
    expect([0, 1, 2, 3, 4].map((c) => provinceTune(c, c % 2 === 1))).toEqual(['heath', 'fen', 'weald', 'marsh', 'reach']);
    expect(villainTune(['swordsmen', 'baron'])).toBe('grimsby');
    expect(villainTune(['goblins', 'witch'])).toBe('mirrow');
    expect(villainTune(['baron', 'bramble'])).toBe('bramble');
    expect(villainTune(['wolves'])).toBeNull();
  });

  it('a battle plays the battle\'s tune', () => {
    const s = { ...newGame(7, ALDMOOR, 'knight'), opening: undefined };
    const b = startFight(s, 'patrol')!.state.battle!;
    expect(battleTune(b)).toBe('battle');
  });

  it("the villain's own battle plays his theme", () => {
    const s = { ...newGame(7, ALDMOOR, 'knight'), opening: undefined };
    const stockade = s.locations.find((l) => l.kind === 'hideout')!;
    const b = startFight(s, stockade.id)!.state.battle!;
    expect(battleTune(b)).toBe('grimsby');
  });
});
