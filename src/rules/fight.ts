import { BACKGROUNDS } from '../content/backgrounds';
import { ARTIFACTS, type ArtifactId } from '../content/artifacts';
import { autoResolve } from './battle/ai';
import { campaignLines, commissionOf, hasNextCommission, provinceOf } from './campaign';
import { createBattle, survivors, type BattleHero } from './battle/battle';
import { foundNote, gainXp, giveArtifact, heroStats } from './hero';
import { again, armyLine, armyPower, close, coins, locationById, roll, roman, show, troops, update, VANISHES, type Army, type GameEvent, type GameState, type Result } from './state';

export function heroInBattle(state: GameState): BattleHero {
  const s = heroStats(state);
  return {
    name: BACKGROUNDS[state.hero.background].short,
    attack: s.attack,
    defence: s.defence,
    spellPower: s.spellPower,
    mana: state.hero.mana,
    spells: state.hero.spells,
    castRound: 0,
    melee: s.melee,
    ranged: s.ranged,
    armour: s.armour,
    manaDiscount: s.manaDiscount,
    troops: s.troops,
    slows: s.slows,
  };
}

/** Experience for a won battle: the fighting worth of what was beaten. */
export const battleXp = (enemy: Army) => Math.round(armyPower(enemy));

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
  const battle = createBattle({ place: id, seed: state.seed, player: state.army, enemy: place.enemy!.army, hero: heroInBattle(state), obstacles: place.kind === 'hideout' ? 3 : 5, ground: provinceOf(state).fen ? 'fen' : 'meadow' });
  return { state: { ...state, seed, battle }, events: [{ type: 'battle', place: id }] };
}

/** Turns a finished battle back into the map: survivors, rewards, and what the card says. */
export function finishFight(state: GameState): Result {
  const battle = state.battle!;
  const place = locationById(state, battle.place);
  const enemy = place.enemy!;
  const army = survivors(battle, 'player');
  // The battle rolled its own dice from the state's seed: carry on from where it stopped, not from the start again.
  const base: GameState = { ...state, seed: battle.seed, battle: undefined, army, hero: { ...state.hero, mana: battle.hero.mana } };
  const lost = lossesLine(state.army, army);
  const events: GameEvent[] = [];
  if (battle.result === 'won') {
    let next = update({ ...base, gold: base.gold + enemy.reward }, place.id, { done: true });
    if (VANISHES.has(place.kind)) events.push({ type: 'removed', id: place.id });
    const spoils: string[] = [];
    if (place.artifact) {
      next = giveArtifact(next, place.artifact as ArtifactId);
      spoils.push(`Among the spoils: **${ARTIFACTS[place.artifact as ArtifactId].name}**. ${foundNote(next, place.artifact as ArtifactId)}`);
    }
    const xp = battleXp(enemy.army);
    const grown = gainXp(next, xp);
    next = grown.state;
    events.push(...grown.events);
    spoils.push(`**+${xp} experience.**`);
    if (place.kind === 'hideout') {
      next = { ...next, bounty: 'paid', over: 'won' };
      const c = commissionOf(next);
      const more = hasNextCommission(next);
      events.push({ type: 'over', result: 'won' });
      events.push(
        show(
          {
            title: 'The bounty is paid!',
            lines: [c.surrender, lost, `The Crown pays **${coins(enemy.reward)} gold**. ${c.homecoming}`, ...spoils, `*Commission complete on day ${roman(next.day)}.*`, ...(more ? [] : campaignLines(next))],
            choices: more ? [{ label: 'Ride to the King\u2019s court', action: { type: 'court' } }] : [again, close],
          },
          place.at,
          place.id,
        ),
      );
      return { state: next, events };
    }
    events.push(show({ title: 'Victory!', lines: [enemy.flees, lost, enemy.loot.replace('{gold}', `**${coins(enemy.reward)} gold**`), ...spoils], choices: [close] }, place.at, place.id));
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
      show({ title: 'Defeat', lines: ['Your army is scattered to the four winds.', `You limp back to ${castle?.name ?? 'safety'} to raise another.`], choices: [close] }, null),
    ],
  };
}

/**
 * The sergeants' estimate: how often the army wins this fight when both sides play it out by the
 * AI, over a few fixed seeds. Honest about tactics in a way raw troop numbers aren't.
 */
export function winChance(state: GameState, id: string, samples = 8): number {
  const place = locationById(state, id);
  if (!place.enemy || state.army.length === 0) return 0;
  let wins = 0;
  for (let i = 1; i <= samples; i++) {
    const battle = createBattle({ place: id, seed: i * 7919, player: state.army, enemy: place.enemy.army, hero: heroInBattle(state), obstacles: place.kind === 'hideout' ? 3 : 5 });
    if (autoResolve(battle).result === 'won') wins++;
  }
  return wins / samples;
}

/** A whole battle at once: both sides play by the same rules and AI as a hand-fought one. */
export function fight(state: GameState, id: string): Result {
  const started = startFight(state, id).state;
  return finishFight({ ...started, battle: autoResolve(started.battle!) });
}
