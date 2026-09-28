import { describe, expect, it } from 'vitest';
import { battleAct, createBattle, type BattleState } from '../rules/battle/battle';
import { upcomingFighters } from './battleOrder';

const makeBattle = () =>
  createBattle({
    place: 'test',
    seed: 1,
    player: [{ troop: 'knights', count: 5 }, { troop: 'archers', count: 10 }],
    enemy: [{ troop: 'swordsmen', count: 8 }, { troop: 'wolves', count: 6 }],
    hero: { attack: 0, defence: 0, spellPower: 0, mana: 0, spells: [], castRound: 0 },
    obstacles: 0,
  });

describe('the battle turn strip', () => {
  it('follows the live queue, including a stack moved back by Wait', () => {
    const battle = makeBattle();
    const waited = battleAct(battle, { type: 'wait' }).battle;

    expect(upcomingFighters(battle).map((fighter) => fighter.id)).toEqual(battle.order);
    expect(upcomingFighters(waited).map((fighter) => fighter.id)).toEqual(waited.order);
    expect(waited.order.at(-1)).toBe(battle.order[0]);
  });

  it('omits dead fighters, keeps repeated turns, and shows no more than six', () => {
    const battle = makeBattle();
    const ordered = battle.order[0];
    const state: BattleState = {
      ...battle,
      order: [ordered, ...battle.order, ordered],
      fighters: battle.fighters.map((fighter) => (fighter.id === battle.order[1] ? { ...fighter, count: 0 } : fighter)),
    };

    expect(upcomingFighters(state, 6).map((fighter) => fighter.id)).toEqual([ordered, ordered, ...battle.order.slice(2), ordered].slice(0, 6));
  });
});
