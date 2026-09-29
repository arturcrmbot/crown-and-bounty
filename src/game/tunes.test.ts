import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../content/aldmoor';
import { FENMARCH } from '../content/fenmarch';
import { endDay, startFight } from '../rules/game';
import { beginCommission, newGame } from '../rules/scenario';
import { battleMood, battleTune, lairTune, provinceTune, villainTune } from './tunes';

describe('which tune plays', () => {
  it('each commission has its own, and the villains theirs', () => {
    expect([0, 1, 2, 3, 4].map((c) => provinceTune(c, c % 2 === 1))).toEqual(['heath', 'fen', 'weald', 'marsh', 'reach']);
    expect(villainTune(['swordsmen', 'baron'])).toBe('grimsby');
    expect(villainTune(['goblins', 'witch'])).toBe('mirrow');
    expect(villainTune(['baron', 'bramble'])).toBe('bramble');
    expect(villainTune(['wolves'])).toBeNull();
  });

  it("Grimsby's march plays by his stockade, and Mother Mirrow's waltz by her hut", () => {
    const aldmoor = newGame(7, ALDMOOR, 'knight');
    const stockade = aldmoor.locations.find((l) => l.kind === 'hideout')!;
    expect(lairTune(aldmoor, [stockade.at[0] + 80, stockade.at[1] + 60])).toBe('grimsby');
    expect(lairTune(aldmoor, aldmoor.hero.at)).toBeNull();
    const fen = beginCommission(FENMARCH, 1, newGame().campaign.start, 1, []);
    const hut = fen.locations.find((l) => l.kind === 'hideout')!;
    expect(lairTune(fen, hut.at)).toBe('mirrow');
    // Once the villain is taken, his lair is quiet.
    const won = { ...aldmoor, locations: aldmoor.locations.map((l) => (l.id === stockade.id ? { ...l, done: true } : l)) };
    expect(lairTune(won, stockade.at)).toBeNull();
  });

  it("Grimsby's march rides out with him, and leaves his stockade quiet", () => {
    const s = { ...newGame(7, ALDMOOR, 'knight'), opening: undefined };
    const out = endDay({ ...s, flags: { dig: 'raided' }, hero: { ...s.hero, at: [700, 530] } }).state;
    const band = out.locations.find((l) => l.id === 'grimsby')!;
    const stockade = out.locations.find((l) => l.kind === 'hideout')!;
    expect(lairTune(out, band.at)).toBe('grimsby');
    expect(lairTune(out, [stockade.at[0] + 80, stockade.at[1] + 60])).toBeNull();
  });

  it('a battle builds, and knows who is winning', () => {
    const s = { ...newGame(7, ALDMOOR, 'knight'), opening: undefined };
    const b = startFight(s, 'patrol')!.state.battle!;
    expect(battleTune(b)).toBe('battle');
    const start = battleMood(b);
    expect(start.intensity).toBeCloseTo(0.25);
    expect(start.balance).toBeCloseTo(0);
    // Half the enemy down and none of ours, in round 3: harder, and winning.
    const later = { ...b, round: 3, fighters: b.fighters.map((f) => (f.side === 'enemy' ? { ...f, count: Math.floor(f.count / 2) } : f)) };
    const mood = battleMood(later);
    expect(mood.intensity).toBeGreaterThan(0.6);
    expect(mood.balance).toBeGreaterThan(0.3);
    // And the other way round.
    const losing = { ...b, round: 3, fighters: b.fighters.map((f) => (f.side === 'player' ? { ...f, count: Math.floor(f.count / 3) } : f)) };
    expect(battleMood(losing).balance).toBeLessThan(-0.3);
  });

  it("the villain's own battle plays his theme", () => {
    const s = { ...newGame(7, ALDMOOR, 'knight'), opening: undefined };
    const stockade = s.locations.find((l) => l.kind === 'hideout')!;
    const b = startFight(s, stockade.id)!.state.battle!;
    expect(battleTune(b)).toBe('grimsby');
  });
});
