import { autoResolve } from './battle/ai';
import { createBattle, survivors, type BattleHero } from './battle/battle';
import { again, armyLine, close, coins, locationById, roll, roman, show, troops, update, VANISHES, type Army, type GameEvent, type GameState, type Result } from './state';

export const heroInBattle = (state: GameState): BattleHero => ({
  attack: state.hero.attack,
  defence: state.hero.defence,
  spellPower: state.hero.spellPower,
  mana: state.hero.mana,
  spells: state.hero.spells,
  castRound: 0,
});

/** "You lost 3 Knights and 7 Archers." */
export function lossesLine(before: Army, after: Army): string {
  const lost = before
    .map((s) => ({ troop: s.troop, dead: s.count - (after.find((a) => a.troop === s.troop)?.count ?? 0) }))
    .filter((l) => l.dead > 0)
    .map((l) => `**${troops(l.troop, l.dead)}**`);
  return lost.length ? `You lost ${lost.join(' and ')}.` : 'Nobody on your side so much as stubbed a toe.';
}

/** Lines the armies up. The battle lives in the state until it's over. */
export function startFight(state: GameState, id: string): Result {
  const place = locationById(state, id);
  const [, seed] = roll(state.seed);
  const battle = createBattle({ place: id, seed: state.seed, player: state.army, enemy: place.enemy!.army, hero: heroInBattle(state), obstacles: place.kind === 'hideout' ? 3 : 5 });
  return { state: { ...state, seed, battle }, events: [{ type: 'battle', place: id }] };
}

/** Turns a finished battle back into the map: survivors, rewards, and what the card says. */
export function finishFight(state: GameState): Result {
  const battle = state.battle!;
  const place = locationById(state, battle.place);
  const enemy = place.enemy!;
  const army = survivors(battle, 'player');
  const base: GameState = { ...state, battle: undefined, army, hero: { ...state.hero, mana: battle.hero.mana } };
  const lost = lossesLine(state.army, army);
  const events: GameEvent[] = [];
  if (battle.result === 'won') {
    let next = update({ ...base, gold: base.gold + enemy.reward }, place.id, { done: true });
    if (VANISHES.has(place.kind)) events.push({ type: 'removed', id: place.id });
    if (place.kind === 'hideout') {
      next = { ...next, bounty: 'paid', over: 'won' };
      events.push({ type: 'over', result: 'won' });
      events.push(
        show(
          {
            title: 'The bounty is paid!',
            lines: ['Baron Grimsby surrenders, still clutching the goose.', lost, `The Crown pays **${coins(enemy.reward)} gold**. The royal goose is going home.`, `*Commission complete on day ${roman(next.day)}.*`],
            choices: [again, close],
          },
          place.at,
          place.id,
        ),
      );
      return { state: next, events };
    }
    events.push(show({ title: 'Victory!', lines: [enemy.flees, lost, enemy.loot.replace('{gold}', `**${coins(enemy.reward)} gold**`)], choices: [close] }, place.at, place.id));
    return { state: next, events };
  }
  if (battle.result === 'fled') {
    const shaken = army.map((s) => ({ ...s, count: s.count - Math.ceil(s.count * 0.25) })).filter((s) => s.count > 0);
    const next = { ...base, army: shaken, movement: 0 };
    return {
      state: next,
      events: [show({ title: 'Retreat!', lines: ['Your men fall back in good order, mostly.', lossesLine(state.army, shaken), `*${armyLine(shaken)} are left.*`], choices: [close] }, place.at, place.id)],
    };
  }
  const castle = state.locations.find((l) => l.kind === 'castle');
  const home = castle ? ([castle.at[0], castle.at[1] + 14] as const) : state.hero.at;
  return {
    state: { ...base, army: [], movement: 0, hero: { ...base.hero, at: home } },
    events: [
      { type: 'moved', at: home, facing: base.hero.facing },
      show({ title: 'Defeat', lines: ['Your army is scattered to the four winds.', 'You limp back to Castle Aldmoor to raise another.'], choices: [close] }, null),
    ],
  };
}

/** A whole battle at once: both sides play by the same rules and AI as a hand-fought one. */
export function fight(state: GameState, id: string): Result {
  const started = startFight(state, id).state;
  return finishFight({ ...started, battle: autoResolve(started.battle!) });
}
