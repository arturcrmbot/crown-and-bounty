import { describe, expect, it } from 'vitest';
import { STATUSES } from '../../content/spells';
import type { TroopId } from '../../content/troops';
import { finishFight, heroInBattle, startFight, type GameState } from '../game';
import { newGame } from '../scenario';
import { chooseAction, stackActions } from './ai';
import { bardOf, battleAct, bribePrice, canJoin, createBattle, hasTurn, luckOf, moraleOf, onField, options, strike, survivors, type BattleHero, type BattleState } from './battle';

const courtier = (): GameState => ({ ...newGame(1066, undefined, 'courtier'), opening: undefined });
const army = (...stacks: [TroopId, number][]) => stacks.map(([troop, count]) => ({ troop, count }));
const of = (b: BattleState, troop: TroopId, side: 'player' | 'enemy' = 'enemy') => b.fighters.find((f) => f.troop === troop && f.side === side)!;
const lordOf = (b: BattleState) => b.fighters.find((f) => f.hero)!;
/** The battle with `id` acting now, and the rest as they were. */
const turnOf = (b: BattleState, id: number): BattleState => ({ ...b, order: [id, ...b.order.filter((x) => x !== id)] });
const fight = (enemy: [TroopId, number][], hero: Partial<BattleHero> = {}) => {
  const b = createBattle({ place: 'x', seed: 1, player: army(['knights', 10], ['archers', 20]), enemy: army(...enemy), hero: { ...heroInBattle(courtier()), ...hero }, obstacles: 0 });
  return turnOf(b, lordOf(b).id);
};

describe('the Courtier, a bard', () => {
  it('strikes no blow, but takes his turn to pay, jeer or sing', () => {
    const b = fight([['swordsmen', 50]]);
    const lord = lordOf(b);
    expect(bardOf(lord)).toEqual({ jeer: 'jeered', songs: ['heartened', 'charmed'], weeks: { leave: 4, join: 12 } });
    expect(hasTurn(lord)).toBe(true);
    const opts = options(b);
    expect([...opts.melee, ...opts.shoot, ...opts.moves.keys()]).toEqual([]);
  });

  it('pays a stack a few weeks of its wages to go home, and his silver tongue halves the price', () => {
    const b = fight([['swordsmen', 50], ['wolves', 10]]);
    const lord = lordOf(b);
    const swordsmen = of(b, 'swordsmen');
    // 50 swordsmen, 4 gold a week each, for 4 weeks, at half price.
    expect(b.hero.gold).toBe(2400);
    expect(b.hero.bribes).toBe(0.5);
    expect(bribePrice(b, lord, swordsmen)).toBe(400);
    const { battle, events } = battleAct(b, { type: 'bribe', target: swordsmen.id });
    expect(events[0]).toEqual({ type: 'bribe', fighter: lord.id, target: swordsmen.id, gold: 400, count: 50 });
    expect(battle.hero.gold).toBe(2000);
    expect(of(battle, 'swordsmen')).toMatchObject({ count: 0, left: 50 });
    expect(onField(of(battle, 'swordsmen'))).toBe(false);
    expect(battle.result).toBeUndefined();
    // Wolves take no gold; and nobody sells for more than he carries.
    expect(bribePrice(b, lord, of(b, 'wolves'))).toBeNull();
    expect(battleAct(b, { type: 'bribe', target: of(b, 'wolves').id }).events).toEqual([]);
    expect(battleAct({ ...b, hero: { ...b.hero, gold: 399 } }, { type: 'bribe', target: swordsmen.id }).events).toEqual([]);
  });

  it('can\u2019t buy a villain or a captain', () => {
    const b = fight([['swordsmen', 20], ['baron', 1]]);
    const baron = of(b, 'baron');
    expect(bribePrice(b, lordOf(b), baron)).toBeNull();
    expect(battleAct(b, { type: 'bribe', target: baron.id }).events).toEqual([]);
    expect(battleAct(b, { type: 'jeer', target: baron.id }).events).toEqual([]);
  });

  it('pays more to bring a stack over, if it fits under his banner, and it rides on with him', () => {
    // Room for 35 leadership: 15 highwaymen need 30.
    const b = fight([['bandits', 15], ['swordsmen', 30]]);
    const bandits = of(b, 'bandits');
    expect(b.hero.room).toBe(35);
    expect(bribePrice(b, lordOf(b), bandits, true)).toBe(180);
    expect(canJoin(b, bandits)).toBe(true);
    const { battle, events } = battleAct(b, { type: 'bribe', target: bandits.id, join: true });
    const joined = events[0].type === 'bribe' ? events[0].joined! : -1;
    expect(battle.fighters[joined]).toMatchObject({ side: 'player', troop: 'bandits', count: 15, startCount: 15, at: bandits.at });
    expect(battle.hero).toMatchObject({ gold: 2220, room: 5 });
    expect(survivors(battle, 'player')).toEqual(army(['knights', 10], ['archers', 20], ['bandits', 15]));
    // Swordsmen need more room than he has.
    expect(canJoin(battle, of(battle, 'swordsmen'))).toBe(false);
    expect(battleAct(turnOf(battle, lordOf(battle).id), { type: 'bribe', target: of(battle, 'swordsmen').id, join: true }).events).toEqual([]);
    // And a sixth kind of troop has no place in his line.
    const full = createBattle({ place: 'x', seed: 1, player: army(['knights', 1], ['archers', 1], ['peasants', 1], ['swordsmen', 1], ['boars', 1]), enemy: army(['bandits', 2]), hero: { ...heroInBattle(courtier()), room: 100 } });
    expect(canJoin(full, of(full, 'bandits'))).toBe(false);
  });

  it('brings over goblins his knights won\u2019t march happily beside: they grumble at each other', () => {
    const b = fight([['goblins', 10], ['swordsmen', 30]]);
    const goblins = of(b, 'goblins');
    expect(moraleOf(b, of(b, 'knights', 'player'))).toBeCloseTo(0);
    const { battle, events } = battleAct(b, { type: 'bribe', target: goblins.id, join: true });
    const joined = events[0].type === 'bribe' ? events[0].joined! : -1;
    expect(moraleOf(battle, of(battle, 'knights', 'player'))).toBeCloseTo(-0.1);
    expect(moraleOf(battle, battle.fighters[joined])).toBeCloseTo(-0.1);
    // The outlaws they left behind don't mind.
    expect(moraleOf(battle, of(battle, 'swordsmen'))).toBe(0);
  });

  it('jeers a stack: its morale drops, and now and then it loses heart and its turn', () => {
    const b = fight([['swordsmen', 50]]);
    const swordsmen = of(b, 'swordsmen');
    const lord = lordOf(b);
    // Right after his jeer comes their turn: three times in ten, they falter.
    const ready = { ...b, order: [lord.id, swordsmen.id, ...b.order.filter((x) => x !== lord.id && x !== swordsmen.id)] };
    let falters = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const { battle, events } = battleAct({ ...ready, seed }, { type: 'jeer', target: swordsmen.id });
      expect(of(battle, 'swordsmen').status).toContain('jeered');
      expect(moraleOf(battle, of(battle, 'swordsmen'))).toBeCloseTo(STATUSES.jeered.morale!);
      if (events.some((e) => e.type === 'falter' && e.fighter === swordsmen.id)) {
        falters++;
        expect(battle.order[0]).not.toBe(swordsmen.id);
      }
    }
    expect(falters / 400).toBeGreaterThan(0.22);
    expect(falters / 400).toBeLessThan(0.38);
    // The AI's look-ahead never counts on it.
    expect(battleAct(ready, { type: 'jeer', target: swordsmen.id }, true).events.some((e) => e.type === 'falter')).toBe(false);
  });

  it('sings over his own: a marching song for their morale, a lucky one for their luck', () => {
    const b = fight([['swordsmen', 50]]);
    const knights = of(b, 'knights', 'player');
    const march = battleAct(b, { type: 'sing', song: 'heartened' });
    expect(march.events[0]).toMatchObject({ type: 'song', status: 'heartened', targets: b.fighters.filter((f) => f.side === 'player' && onField(f)).map((f) => f.id) });
    expect(moraleOf(march.battle, of(march.battle, 'knights', 'player'))).toBeCloseTo(moraleOf(b, knights) + 0.25);
    expect(lordOf(march.battle).status).toEqual([]);
    const lucky = battleAct(b, { type: 'sing', song: 'charmed' }).battle;
    expect(luckOf(lucky, of(lucky, 'knights', 'player'))).toBeCloseTo(luckOf(b, knights) + 0.2);
    const swordsmen = of(b, 'swordsmen');
    expect(strike(lucky, of(lucky, 'knights', 'player'), swordsmen, false).damage).toBeGreaterThan(strike(b, knights, swordsmen, false).damage);
    // Only the songs he knows.
    expect(battleAct(b, { type: 'sing', song: 'jeered' }).events).toEqual([]);
  });

  it('on auto, his sergeants jeer and sing, but never spend his gold', () => {
    expect(stackActions(fight([['swordsmen', 50]])).some((a) => a.type === 'bribe')).toBe(false);
    let b = createBattle({ place: 'x', seed: 5, player: army(['knights', 10], ['archers', 20]), enemy: army(['swordsmen', 30], ['crossbowmen', 12]), hero: heroInBattle(courtier()) });
    const moves = new Set<string>();
    for (let n = 0; n < 3000 && !b.result; n++) {
      const action = chooseAction(b);
      if (b.fighters.find((f) => f.id === b.order[0])?.hero) moves.add(action.type);
      b = battleAct(b, action).battle;
    }
    expect(b.result).toBeDefined();
    expect(b.hero.gold).toBe(2400);
    expect([...moves].some((m) => m === 'jeer' || m === 'sing')).toBe(true);
    expect(moves.has('bribe')).toBe(false);
  });

  it('pays out of the purse he rode in with, and the card says what his bribes cost', () => {
    const state = courtier();
    const b = startFight(state, 'highwaymen')!.state.battle!;
    const lord = lordOf(b);
    const bandits = of(b, 'bandits');
    const price = bribePrice(b, lord, bandits, true)!;
    const { battle } = battleAct(turnOf(b, lord.id), { type: 'bribe', target: bandits.id, join: true });
    expect(battle.result).toBe('won');
    const done = finishFight({ ...state, battle });
    const reward = state.locations.find((l) => l.id === 'highwaymen')!.enemy!.reward;
    expect(done.state.gold).toBe(state.gold - price + reward);
    expect(done.state.army.find((s) => s.troop === 'bandits')?.count).toBe(bandits.count);
    const card = done.events.find((e) => e.type === 'card');
    expect(card?.type === 'card' && card.card.lines).toContain(`Bribes cost you **${price} gold**.`);
    // Troops who walked off didn't fall: the card counts no highwaymen among their dead.
    expect(card?.type === 'card' && card.card.battleResult?.enemy).toEqual([]);
  });
});
