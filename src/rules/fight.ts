import { BACKGROUNDS } from '../content/backgrounds';
import { ARTIFACTS, type ArtifactId } from '../content/artifacts';
import { ABILITIES, crowd, heroTroop, TROOPS, type HeroId, type TroopId } from '../content/troops';
import type { StatusId } from '../content/spells';
import { autoResolve } from './battle/ai';
import { applyEffects } from './effects/core';
import { CAMPAIGN_LENGTH, campaignLines, commissionOf, hasNextCommission, provinceOf } from './campaign';
import { revealDisc } from './map/fog';
import { createBattle, heroFell, SHOOTER_MELEE, survivors, type BattleHero, type BattleState, type Side } from './battle/battle';
import { artifactChoices, foundNote, gainXp, giveArtifact, heroStats, namedBonuses } from './hero';
import { addTroops, again, armyPower, close, coins, locationById, roll, roman, show, stillWithYou, troops, update, VANISHES, type Army, type BattleResultCard, type Choice, type GameEvent, type GameState, type Location, type Result } from './state';

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
    spells: s.spells,
    castRound: 0,
    melee: s.melee,
    ranged: s.ranged,
    armour: s.armour,
    luck: s.luck,
    morale: s.morale,
    manaDiscount: s.manaDiscount,
    troops: s.troops,
    slows: s.slows,
    ...(Object.keys(s.wards).length ? { wards: s.wards } : {}),
    ...(s.charges.length ? { charges: s.charges } : {}),
    ...(broughtBy(state).length ? { brought: broughtBy(state) } : {}),
    ...(s.charge.length ? { charge: s.charge } : {}),
    ...(s.volley ? { volley: true } : {}),
    ...(s.casts > 1 ? { casts: s.casts } : {}),
    ...(s.shooterMelee !== SHOOTER_MELEE ? { shooterMelee: s.shooterMelee } : {}),
    unit: { troop: own.troop, hp: own.hp, damage: own.damage },
  };
}

/** Where each status the hero brings to a battle comes from, for its opening words. */
function broughtBy(state: GameState): NonNullable<BattleHero['brought']> {
  const out: NonNullable<BattleHero['brought']> = [];
  for (const { name, bonus } of namedBonuses(state)) {
    if (bonus.slows?.length) out.push({ source: name, side: 'enemy', troops: bonus.slows, status: 'slowed' });
    for (const [troop, statuses] of Object.entries(bonus.wards ?? {}) as [TroopId, StatusId[]][]) for (const status of statuses) out.push({ source: name, side: 'player', troops: [troop], status });
  }
  return out;
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

/** The likely cost of a fight, using the same fixed trials as the sergeants' odds. */
export function likelyLossesLine(state: GameState, id: string, samples = 16): string {
  const place = locationById(state, id);
  if (!place.enemy || !state.army.length) return '';
  const estimate = simulateFight(state, place, place.enemy.army, samples);
  const losses = estimate.losses.filter((stack) => stack.count > 0).sort((a, b) => b.count - a.count);
  if (!losses.length) return '*The sergeants expect to bring everyone home.*';
  if (heroStats(state).counts) {
    return `*The sergeants expect to lose about ${losses.map((stack) => troops(stack.troop, stack.count)).join(' and ')}.*`;
  }
  const lost = losses.reduce((sum, stack) => sum + stack.count, 0);
  const army = state.army.reduce((sum, stack) => sum + stack.count, 0);
  const share = lost / army;
  if (share < 0.1) return `*You\u2019d likely lose ${losses.map((stack) => crowd(stack.troop, stack.count)).join(' and ')}.*`;
  const amount = share < 0.3 ? 'about a fifth' : share < 0.45 ? 'about a third' : share < 0.65 ? 'about half' : share < 0.9 ? 'most' : 'nearly all';
  const first = losses.slice(0, 2).map((stack) => TROOPS[stack.troop].name);
  const order = first.length === 1 ? `${first[0]} first` : `${first[0]}, then ${first[1]}`;
  return `*You\u2019d likely lose ${amount} of your army, ${order}.*`;
}

function fallen(battle: BattleState, side: Side): Army {
  const losses = new Map<Army[number]['troop'], number>();
  for (const fighter of battle.fighters) {
    if (fighter.side !== side || fighter.hero) continue;
    const count = fighter.startCount - fighter.count;
    if (count > 0) losses.set(fighter.troop, (losses.get(fighter.troop) ?? 0) + count);
  }
  return [...losses].map(([troop, count]) => ({ troop, count }));
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
export function bountyPaid(state: GameState, id: string, opening: string[], reward: number, spoils: string[], battleResult?: BattleResultCard, decisions: Choice[] = []): Result {
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
      ...(battleResult ? { wide: true, battleResult } : {}),
    };
    return { state: next, events: [{ type: 'added', id: 'sceptre' }, { type: 'reveal', at: sceptre, radius: 110 }, show(card, place.at, place.id)] };
  }
  const next: GameState = { ...state, bounty: 'paid', over: 'won' };
  const more = hasNextCommission(next);
  const card = {
    title: 'The bounty is paid!',
    lines: [...lines, `Among ${c.villain}\u2019s things: a torn piece of an old map (**${piece} of ${CAMPAIGN_LENGTH}**).`, `*Commission complete on day ${roman(next.day)}.*`, ...(more ? [] : campaignLines(next))],
    choices: [...decisions, ...(more ? [{ label: 'Ride to the King\u2019s court', action: { type: 'court' as const } }] : [again, close])],
    ...(battleResult ? { wide: true, battleResult } : {}),
  };
  return { state: next, events: [{ type: 'over', result: 'won' }, show(card, place.at, place.id)] };
}

/**
 * An enemy beaten, in battle or by other means: its gold, its artifact and the experience, the
 * enemy gone from the map, and at a hideout, the bounty.
 */
export function beat(state: GameState, id: string, how: { title: string; lines: string[]; reward: number; xp: number; sayGold?: boolean; battleResult?: BattleResultCard; choices?: Choice[] }): Result {
  const place = locationById(state, id);
  let next = update({ ...state, gold: state.gold + how.reward }, id, { done: true });
  const events: GameEvent[] = VANISHES.has(place.kind) ? [{ type: 'removed', id }] : [];
  const spoils: string[] = [];
  const decisions = [...(how.choices ?? [])];
  if (place.artifact) {
    next = giveArtifact(next, place.artifact as ArtifactId);
    spoils.push(`Among the spoils: **${ARTIFACTS[place.artifact as ArtifactId].name}**. ${foundNote(next, place.artifact as ArtifactId)}`);
    decisions.push(...artifactChoices(next, place.artifact as ArtifactId));
  }
  if (place.enemy?.spoils) {
    const extra = applyEffects(next, place, place.enemy.spoils);
    next = extra.state;
    events.push(...extra.events);
    spoils.push(...extra.lines);
    if (place.enemy.spoils.artifact) decisions.push(...artifactChoices(next, place.enemy.spoils.artifact));
  }
  if (how.xp) {
    const grown = gainXp(next, how.xp);
    next = grown.state;
    events.push(...grown.events);
    spoils.push(`**+${how.xp} experience.**`);
  }
  if (place.kind === 'hideout') {
    const paid = bountyPaid(next, id, how.lines, how.reward, spoils, how.battleResult, decisions);
    return { state: paid.state, events: [...events, ...paid.events] };
  }
  const gold = how.sayGold && how.reward ? [`**+${coins(how.reward)} gold.**`] : [];
    events.push(show({ title: how.title, lines: [...how.lines, ...spoils, ...gold], choices: decisions.length ? decisions : [close], ...(how.battleResult ? { wide: true, battleResult: how.battleResult } : {}) }, place.at, place.id));
  return { state: next, events };
}

/** Turns a finished battle back into the map: survivors, rewards, and what the card says. */
/**
 * What the hero's skills and gear do once a battle is won (`before` is his army as it rode in): a
 * share of his mana comes back (`manaBack`), and a share of each company's fallen get up (`mend`).
 */
export function afterVictory(state: GameState, before: Army): { state: GameState; lines: string[] } {
  const s = heroStats(state);
  let next = state;
  const lines: string[] = [];
  const back = Math.min(s.maxMana - state.hero.mana, Math.round(s.maxMana * s.manaBack));
  if (back > 0) {
    next = { ...next, hero: { ...next.hero, mana: next.hero.mana + back } };
    lines.push(`As the dust settles, **${back} mana** comes back to you.`);
  }
  if (s.mend > 0) {
    const up: string[] = [];
    for (const stack of before) {
      const fallen = stack.count - (next.army.find((a) => a.troop === stack.troop)?.count ?? 0);
      const count = Math.floor(fallen * s.mend);
      const army = count > 0 ? addTroops(next.army, stack.troop, count) : null;
      if (!army) continue;
      next = { ...next, army };
      up.push(`**${troops(stack.troop, count)}**`);
    }
    if (up.length) lines.push(`${up.join(' and ')} get back on their feet.`);
  }
  return { state: next, lines };
}

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
  const battleResult: BattleResultCard = {
    player: fallen(battle, 'player'),
    enemy: fallen(battle, 'enemy'),
    manaSpent: Math.max(0, state.hero.mana - battle.hero.mana),
    manaAvailable: state.hero.mana,
  };
  if (battle.result === 'won') {
    const after = afterVictory(base, state.army);
    const opening = place.kind === 'hideout' ? [commissionOf(base).surrender, ...after.lines, ...carried] : [enemy.flees, ...after.lines, ...carried, enemy.loot.replace('{gold}', `**${coins(enemy.reward)} gold**`)];
    return beat(after.state, place.id, { title: 'Victory!', lines: opening, reward: enemy.reward, xp: battleXp(enemy.army), battleResult });
  }
  const castle = state.locations.find((l) => l.kind === 'castle');
  const home = castle ? ([castle.at[0], castle.at[1] + 14] as const) : state.hero.at;
  const shaken = battle.result === 'fled' && !battle.standoff ? army.map((s) => ({ ...s, count: s.count - Math.ceil(s.count * 0.25) })).filter((s) => s.count > 0) : army;
  if (battle.result === 'fled' && shaken.length === 0 && battle.fighters.some((f) => f.hero && f.count > 0)) {
    // Nobody who rode with him is left: Aldric gets away alone, and rides home to raise another army.
    return {
      state: { ...base, army: [], movement: 0, hero: { ...base.hero, at: home } },
      events: [
        { type: 'moved', at: home, facing: base.hero.facing },
        show({ title: 'Retreat!', lines: [`${who} gets away alone: nobody who rode with him is left standing.`, `He rides back to ${castle?.name ?? 'safety'} to raise another army.`], choices: [close], wide: true, battleResult }, null),
      ],
    };
  }
  if (battle.result === 'fled' && battle.standoff) {
    // They had no way through to you, and you didn't go to them: both sides draw off, nobody cut down.
    const next = { ...base, movement: 0 };
    return {
      state: next,
      events: [show({ title: 'A stand-off', lines: ['Neither side can get at the other. As the light goes, both draw off.', ...carried, stillWithYou(army)], choices: [close], wide: true, battleResult }, place.at, place.id)],
    };
  }
  if (battle.result === 'fled') {
    const next = { ...base, army: shaken, movement: 0 };
    return {
      state: next,
      events: [show({ title: 'Retreat!', lines: ['Your men fall back in good order, mostly.', ...carried, stillWithYou(shaken)], choices: [close], wide: true, battleResult }, place.at, place.id)],
    };
  }
  return {
    state: { ...base, army: [], movement: 0, hero: { ...base.hero, at: home } },
    events: [
      { type: 'moved', at: home, facing: base.hero.facing },
      show({ title: 'Defeat', lines: ['Your army is scattered to the four winds.', `You limp back to ${castle?.name ?? 'safety'} to raise another.`], choices: [close], wide: true, battleResult }, null),
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
const estimates = new Map<string, { chance: number; losses: Army }>();

/** `army` asks about only part of the enemy: the beasts among a band, say. */
export function winChance(state: GameState, id: string, samples = 16, army?: Army): number {
  const place = locationById(state, id);
  if (!place.enemy || state.army.length === 0) return 0;
  const enemy = army ?? place.enemy.army;
  const key = JSON.stringify([state.army, heroInBattle(state), enemy, place.kind, provinceOf(state).fen ?? false, samples]);
  const known = chances.get(key);
  if (known !== undefined) return known;
  const estimate = simulateFight(state, place, enemy, samples);
  if (chances.size > 2000) {
    chances.clear();
    estimates.clear();
  }
  chances.set(key, estimate.chance);
  estimates.set(key, estimate);
  return estimate.chance;
}

function simulateFight(state: GameState, place: Location, enemy: Army, samples: number): { chance: number; losses: Army } {
  const key = JSON.stringify([state.army, heroInBattle(state), enemy, place.kind, provinceOf(state).fen ?? false, samples]);
  const known = estimates.get(key);
  if (known) return known;
  let wins = 0;
  const wonLosses: number[][] = state.army.map(() => []);
  const allLosses: number[][] = state.army.map(() => []);
  for (let i = 1; i <= samples; i++) {
    const battle = createBattle({ place: place.id, seed: sampleSeed(i), player: state.army, enemy, hero: heroAgainst(state, place), obstacles: place.kind === 'hideout' ? 3 : 5 });
    const result = autoResolve(battle);
    const after = survivors(result, 'player');
    const won = result.result === 'won';
    if (won) wins++;
    state.army.forEach((stack, index) => {
      const lost = stack.count - (after.find((survivor) => survivor.troop === stack.troop)?.count ?? 0);
      allLosses[index].push(lost);
      if (won) wonLosses[index].push(lost);
    });
  }
  const source = wins ? wonLosses : allLosses;
  const losses = state.army.map((stack, index) => {
    const values = source[index].sort((a, b) => a - b);
    const middle = Math.floor(values.length / 2);
    const count = Math.round(values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2);
    return { troop: stack.troop, count };
  });
  const estimate = { chance: wins / samples, losses };
  if (estimates.size > 2000) estimates.clear();
  estimates.set(key, estimate);
  return estimate;
}

/** A whole battle at once: both sides play by the same rules and AI as a hand-fought one. */
export function fight(state: GameState, id: string): Result | null {
  const started = startFight(state, id)?.state;
  return started ? finishFight({ ...started, battle: autoResolve(started.battle!) }) : null;
}
