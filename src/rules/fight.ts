import { BACKGROUNDS } from '../content/backgrounds';
import { ARTIFACTS, type ArtifactId } from '../content/artifacts';
import { ABILITIES, heroTroop, TROOPS, type HeroId } from '../content/troops';
import { autoResolve } from './battle/ai';
import { applyEffects } from './effects/core';
import { CAMPAIGN_LENGTH, campaignLines, commissionOf, hasNextCommission, provinceOf } from './campaign';
import { revealDisc } from './map/fog';
import { createBattle, heroFell, survivors, type BattleHero } from './battle/battle';
import { foundNote, gainXp, giveArtifact, heroStats } from './hero';
import { again, armyPower, close, coins, locationById, roll, roman, show, stillWithYou, troops, update, VANISHES, type Army, type GameEvent, type GameState, type Location, type Result } from './state';

export function heroInBattle(state: GameState): BattleHero {
  const s = heroStats(state);
  const own = heroFighter(state);
  return {
    name: BACKGROUNDS[state.hero.background].short,
    attack: s.attack,
    defence: s.defence,
    spellPower: s.spellPower,
    mana: state.hero.mana,
    maxMana: s.maxMana,
    spells: state.hero.spells,
    castRound: 0,
    melee: s.melee,
    ranged: s.ranged,
    armour: s.armour,
    manaDiscount: s.manaDiscount,
    troops: s.troops,
    slows: s.slows,
    ...(s.charge.length ? { charge: s.charge } : {}),
    ...(s.volley ? { volley: true } : {}),
    ...(s.casts > 1 ? { casts: s.casts } : {}),
    unit: { troop: own.troop, hp: own.hp, damage: own.damage },
  };
}

/** Aldric as he'd take the field in the next battle: the troop he fights as, and his numbers. */
export type HeroFighter = {
  troop: HeroId;
  name: string;
  /** With his own attack and defence, and his troop's bonus, as in battle (before spells and rallies). */
  attack: number;
  defence: number;
  damage: readonly [number, number];
  hp: number;
  speed: number;
  shots: number;
  /** Charges, as a Knight does: a run-up of 3 hexes, a quarter harder, and no strike-back. */
  charges: boolean;
  abilities: { name: string; note: string }[];
};

/**
 * Aldric's own numbers on the field, from his troop and himself. A level-I hero is modest; every
 * level adds health and damage (see `hero` in content/troops.ts), a caster's damage grows with his
 * spell power, and his attack and defence (level-ups and gear) count for him as for every stack.
 */
export function heroFighter(state: GameState): HeroFighter {
  const s = heroStats(state);
  const troop = heroTroop(state.hero.background);
  const t = TROOPS[troop];
  const grow = t.hero!;
  const levels = state.hero.level - 1;
  const more = levels * grow.perLevel.damage + (grow.perPower ?? 0) * s.spellPower;
  const bonus = s.troops[troop];
  return {
    troop,
    name: t.name,
    attack: t.attack + s.attack + (bonus?.attack ?? 0),
    defence: t.defence + s.defence + (bonus?.defence ?? 0),
    damage: [t.damage[0] + more, t.damage[1] + more],
    hp: t.hp + levels * grow.perLevel.hp,
    speed: t.speed,
    shots: t.shots ? t.shots + (bonus?.shots ?? 0) : 0,
    charges: s.charge.includes(troop),
    abilities: (t.abilities ?? []).map((a) => ({ name: ABILITIES[a].name, note: ABILITIES[a].note })),
  };
}

/** The hero as he meets this enemy: a villain keeps to his walls, so there's no treeline for a volley. */
const heroAgainst = (state: GameState, place: Location): BattleHero => {
  const hero = heroInBattle(state);
  return place.kind === 'hideout' ? { ...hero, volley: undefined } : hero;
};

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
export function startFight(state: GameState, id: string): Result | null {
  const place = locationById(state, id);
  if (state.army.length === 0 || !place.enemy || place.done) return null;
  const [, seed] = roll(state.seed);
  const battle = createBattle({ place: id, seed: state.seed, player: state.army, enemy: place.enemy!.army, hero: heroAgainst(state, place), obstacles: place.kind === 'hideout' ? 3 : 5, ground: provinceOf(state).fen ? 'fen' : 'meadow' });
  return { state: { ...state, seed, battle }, events: [{ type: 'battle', place: id }] };
}

/**
 * The villain is taken: the commission is won. `state` already has the bounty's gold; the card
 * says how it went and sends the hero to court, or ends the campaign after the last commission.
 */
export function bountyPaid(state: GameState, id: string, opening: string[], reward: number, spoils: string[]): Result {
  const place = locationById(state, id);
  const c = commissionOf(state);
  const piece = state.campaign.chapter + 1;
  const sceptre = provinceOf(state).sceptre;
  const lines = [...opening, `The Crown pays **${coins(reward)} gold**. ${c.homecoming}`, ...spoils];
  if (!hasNextCommission(state) && sceptre) {
    // The last piece of the map: the commission goes on until the hero digs where the X is.
    const x: Location = { id: 'sceptre', kind: 'dig', name: 'X Marks the Spot', at: sceptre, done: false };
    const seen = revealDisc(state.explored, state.world, sceptre[0], sceptre[1], 110).bits;
    const next: GameState = { ...state, bounty: 'paid', explored: seen, locations: [...state.locations, x] };
    const card = {
      title: 'The last piece of the map!',
      lines: [...lines, `Among ${c.villain}\u2019s things: the last torn piece of an old map. Laid together, the ${piece} pieces show an **X**, right here in ${provinceOf(state).name}.`],
      choices: [close],
    };
    return { state: next, events: [{ type: 'added', id: 'sceptre' }, { type: 'reveal', at: sceptre, radius: 110 }, show(card, place.at, place.id)] };
  }
  const next: GameState = { ...state, bounty: 'paid', over: 'won' };
  const more = hasNextCommission(next);
  const card = {
    title: 'The bounty is paid!',
    lines: [...lines, `Among ${c.villain}\u2019s things: a torn piece of an old map (**${piece} of ${CAMPAIGN_LENGTH}**).`, `*Commission complete on day ${roman(next.day)}.*`, ...(more ? [] : campaignLines(next))],
    choices: more ? [{ label: 'Ride to the King\u2019s court', action: { type: 'court' as const } }] : [again, close],
  };
  return { state: next, events: [{ type: 'over', result: 'won' }, show(card, place.at, place.id)] };
}

/**
 * An enemy beaten, in battle or by other means: its gold, its artifact and the experience, the
 * enemy gone from the map, and at a hideout, the bounty.
 */
export function beat(state: GameState, id: string, how: { title: string; lines: string[]; reward: number; xp: number; sayGold?: boolean }): Result {
  const place = locationById(state, id);
  let next = update({ ...state, gold: state.gold + how.reward }, id, { done: true });
  const events: GameEvent[] = VANISHES.has(place.kind) ? [{ type: 'removed', id }] : [];
  const spoils: string[] = [];
  if (place.artifact) {
    next = giveArtifact(next, place.artifact as ArtifactId);
    spoils.push(`Among the spoils: **${ARTIFACTS[place.artifact as ArtifactId].name}**. ${foundNote(next, place.artifact as ArtifactId)}`);
  }
  if (place.enemy?.spoils) {
    const extra = applyEffects(next, place, place.enemy.spoils);
    next = extra.state;
    events.push(...extra.events);
    spoils.push(...extra.lines);
  }
  if (how.xp) {
    const grown = gainXp(next, how.xp);
    next = grown.state;
    events.push(...grown.events);
    spoils.push(`**+${how.xp} experience.**`);
  }
  if (place.kind === 'hideout') {
    const paid = bountyPaid(next, id, how.lines, how.reward, spoils);
    return { state: paid.state, events: [...events, ...paid.events] };
  }
  const gold = how.sayGold && how.reward ? [`**+${coins(how.reward)} gold.**`] : [];
  events.push(show({ title: how.title, lines: [...how.lines, ...spoils, ...gold], choices: [close] }, place.at, place.id));
  return { state: next, events };
}

/** Turns a finished battle back into the map: survivors, rewards, and what the card says. */
export function finishFight(state: GameState): Result {
  const battle = state.battle!;
  const place = locationById(state, battle.place);
  const enemy = place.enemy!;
  const army = survivors(battle, 'player');
  // Carried from the field, he's on his feet again by evening: it costs him only the rest of the day.
  const fell = heroFell(battle);
  const who = BACKGROUNDS[state.hero.background].short;
  const alone = !fell && army.length === 0 && battle.fighters.some((f) => f.hero);
  const carried = fell ? [`**${who} was carried from the field.** He's on his feet by evening, sore and cross, but goes no further today.`] : alone ? [`*Only ${who} is left standing.*`] : [];
  // The battle rolled its own dice from the state's seed: carry on from where it stopped, not from the start again.
  const base: GameState = { ...state, seed: battle.seed, battle: undefined, army, hero: { ...state.hero, mana: battle.hero.mana }, ...(fell ? { movement: 0 } : {}) };
  const lost = lossesLine(state.army, army);
  if (battle.result === 'won') {
    const opening = place.kind === 'hideout' ? [commissionOf(base).surrender, lost, ...carried] : [enemy.flees, lost, ...carried, enemy.loot.replace('{gold}', `**${coins(enemy.reward)} gold**`)];
    return beat(base, place.id, { title: 'Victory!', lines: opening, reward: enemy.reward, xp: battleXp(enemy.army) });
  }
  if (battle.result === 'fled' && battle.standoff) {
    // They had no way through to you, and you didn't go to them: both sides draw off, nobody cut down.
    const next = { ...base, movement: 0 };
    return {
      state: next,
      events: [show({ title: 'A stand-off', lines: ['Neither side can get at the other. As the light goes, both draw off.', lost, ...carried, stillWithYou(army)], choices: [close] }, place.at, place.id)],
    };
  }
  if (battle.result === 'fled') {
    const shaken = army.map((s) => ({ ...s, count: s.count - Math.ceil(s.count * 0.25) })).filter((s) => s.count > 0);
    const next = { ...base, army: shaken, movement: 0 };
    return {
      state: next,
      events: [show({ title: 'Retreat!', lines: ['Your men fall back in good order, mostly.', lossesLine(state.army, shaken), ...carried, stillWithYou(shaken)], choices: [close] }, place.at, place.id)],
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
/** Well-mixed seeds for the sample battles, so the samples cover different fields and dice. */
const sampleSeed = (i: number) => (Math.imul(i + 1, 0x9e3779b1) ^ 0x85ebca6b) >>> 0;

/** Recent answers, since the same odds get asked for again and again (every card, every bot step). */
const chances = new Map<string, number>();

/** `army` asks about only part of the enemy: the beasts among a band, say. */
export function winChance(state: GameState, id: string, samples = 16, army?: Army): number {
  const place = locationById(state, id);
  if (!place.enemy || state.army.length === 0) return 0;
  const enemy = army ?? place.enemy.army;
  const key = JSON.stringify([state.army, heroInBattle(state), enemy, place.kind, provinceOf(state).fen ?? false, samples]);
  const known = chances.get(key);
  if (known !== undefined) return known;
  const chance = simulateChance(state, place, enemy, samples);
  if (chances.size > 2000) chances.clear();
  chances.set(key, chance);
  return chance;
}

function simulateChance(state: GameState, place: Location, enemy: Army, samples: number): number {
  let wins = 0;
  for (let i = 1; i <= samples; i++) {
    const battle = createBattle({ place: place.id, seed: sampleSeed(i), player: state.army, enemy, hero: heroAgainst(state, place), obstacles: place.kind === 'hideout' ? 3 : 5 });
    if (autoResolve(battle).result === 'won') wins++;
  }
  return wins / samples;
}

/** A whole battle at once: both sides play by the same rules and AI as a hand-fought one. */
export function fight(state: GameState, id: string): Result | null {
  const started = startFight(state, id)?.state;
  return started ? finishFight({ ...started, battle: autoResolve(started.battle!) }) : null;
}
