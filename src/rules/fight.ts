import { BACKGROUNDS } from '../content/backgrounds';
import { artifactPhrase, type ArtifactId } from '../content/artifacts';
import { ABILITIES, crowd, heroTroop, TROOPS, type HeroId, type TroopId } from '../content/troops';
import type { StatusId } from '../content/spells';
import { autoResolve } from './battle/ai';
import { applyEffects, choiceButton, meets } from './effects/core';
import { bountyOf, CAMPAIGN_LENGTH, campaignLines, commissionOf, hasNextCommission, provinceOf } from './campaign';
import { look, seeBands } from './map/sight';
import { fleeHome, fleesHome } from './map/sortie';
import { battleEnd, createBattle, isLeader, SHOOTER_MELEE, survivors, type BattleHero, type BattleState, type Side } from './battle/battle';
import { artifactChoices, foundNote, gainXp, giveArtifact, heroStats, namedBonuses } from './hero';
import { addTroops, again, armyPower, close, coins, leadershipUsed, listed, locationById, roll, roman, show, stillWithYou, troops, update, VANISHES, type Army, type BattleResultCard, type Choice, type GameEvent, type GameState, type Location, type Result } from './state';

export function heroInBattle(state: GameState): BattleHero {
  const s = heroStats(state);
  const own = heroFighter(state);
  const spirits = spiritsBy(state);
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
    ...(spirits.length ? { spirits } : {}),
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
    // His purse, for a bard's bribes, and the room under his banner for troops who come over.
    gold: state.gold,
    ...(s.bribes ? { bribes: s.bribes } : {}),
    room: Math.max(0, s.leadership - leadershipUsed(state.army)),
  };
}

/** Where the hero's luck and morale come from, by name, so a stack's card can say why. */
function spiritsBy(state: GameState): NonNullable<BattleHero['spirits']> {
  return namedBonuses(state)
    .filter(({ bonus }) => bonus.luck || bonus.morale)
    .map(({ name, bonus }) => ({ source: name, ...(bonus.luck ? { luck: bonus.luck } : {}), ...(bonus.morale ? { morale: bonus.morale } : {}) }));
}

/** The hero as the odds see him: the sergeants never spend his gold, so his purse doesn't change them. */
function oddsHero(state: GameState) {
  const { gold: _gold, room: _room, ...hero } = heroInBattle(state);
  return hero;
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

/** Aldric as he'd lead the next battle, from behind the line: the troop he fights as, and his numbers. */
export type HeroFighter = {
  troop: HeroId;
  name: string;
  /** With his own attack and defence, and his troop's bonus, as in battle. */
  attack: number;
  defence: number;
  damage: readonly [number, number];
  /** His troop's health: nothing can reach him behind the line, so it never changes. */
  hp: number;
  speed: number;
  shots: number;
  /** Charges, as a Knight does: a quarter harder, and no strike-back. */
  charges: boolean;
  /** Whether he strikes at all: shoots, or rides out. */
  strikes: boolean;
  abilities: { name: string; note: string }[];
};

/**
 * Aldric's own numbers in battle, from his troop and himself. A level-I hero is modest; every level
 * adds damage (see `hero` in content/troops.ts), a caster's damage grows with his spell power, and
 * his attack (level-ups and gear) counts for his blows as for every stack's.
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
    hp: t.hp,
    speed: t.speed,
    shots: t.shots ? t.shots + (bonus?.shots ?? 0) : 0,
    charges: s.charge.includes(troop),
    strikes: Boolean(t.shots) || (t.abilities ?? []).some((a) => ABILITIES[a].rides),
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

/** Whoever of a side walked off the field, paid to go home or to change sides. */
function boughtOff(battle: BattleState, side: Side): Army {
  const gone = new Map<Army[number]['troop'], number>();
  for (const fighter of battle.fighters) if (fighter.side === side && fighter.left) gone.set(fighter.troop, (gone.get(fighter.troop) ?? 0) + fighter.left);
  return [...gone].map(([troop, count]) => ({ troop, count }));
}

/** What a won battle teaches: the worth of the army beaten, less half the worth of whoever was paid off, as a surrender teaches half. */
export const wonXp = (battle: BattleState, enemy: Army) => Math.max(0, battleXp(enemy) - Math.round(battleXp(boughtOff(battle, 'enemy')) / 2));

/** "You lost 3 Knights, 7 Archers and 1 Swordsman." */
export function lossesLine(before: Army, after: Army): string {
  const lost = before
    .map((s) => ({ troop: s.troop, dead: s.count - (after.find((a) => a.troop === s.troop)?.count ?? 0) }))
    .filter((l) => l.dead > 0)
    .map((l) => `**${troops(l.troop, l.dead)}**`);
  return lost.length ? `You lost ${listed(lost)}.` : 'Nobody on your side so much as stubbed a toe.';
}

/**
 * The likely cost of a fight, using the same fixed trials as the sergeants' odds: what the fights
 * they win cost ("about 19 Swordsmen and 6 Archers", "about a third of your army, the
 * Swordsmen first"), or null when they bring everyone home. With no win among the trials, `cost` is
 * what the lost ones cost, which is everyone. `places/enemy.ts` puts it in words beside the verdict.
 */
export function expectedLosses(state: GameState, id: string, samples = SAMPLES): { cost: string | null } | null {
  const place = locationById(state, id);
  if (!place.enemy || !state.army.length) return null;
  const estimate = simulateFight(state, place, place.enemy.army, samples);
  const losses = estimate.losses.filter((stack) => stack.count > 0).sort((a, b) => b.count - a.count);
  if (!losses.length) return { cost: null };
  if (heroStats(state).counts) return { cost: `about ${listed(losses.map((stack) => troops(stack.troop, stack.count)))}` };
  const lost = losses.reduce((sum, stack) => sum + stack.count, 0);
  const army = state.army.reduce((sum, stack) => sum + stack.count, 0);
  const share = lost / army;
  if (share < 0.1) return { cost: listed(losses.map((stack) => crowd(stack.troop, stack.count))) };
  const amount = share < 0.3 ? 'about a fifth' : share < 0.45 ? 'about a third' : share < 0.65 ? 'about half' : share < 0.9 ? 'most' : 'nearly all';
  const first = losses.slice(0, 2).map((stack) => TROOPS[stack.troop].name);
  const order = first.length === 1 ? `the ${first[0]} first` : `the ${first[0]} first and then the ${first[1]}`;
  return { cost: `${amount} of your army, ${order}` };
}

function fallen(battle: BattleState, side: Side): Army {
  const losses = new Map<Army[number]['troop'], number>();
  for (const fighter of battle.fighters) {
    if (fighter.side !== side || isLeader(fighter)) continue;
    // Troops who walked off, paid to go or to change sides, didn't fall.
    const count = fighter.startCount - fighter.count - (fighter.left ?? 0);
    if (count > 0) losses.set(fighter.troop, (losses.get(fighter.troop) ?? 0) + count);
  }
  return [...losses].map(([troop, count]) => ({ troop, count }));
}

/**
 * Who spent the hero's mana in a battle, for its result card: "You used 5 of your mana.", "The
 * sergeants used all 10 of your mana.", or both, when he cast some and they cast the rest.
 */
export function manaLine(card: Pick<BattleResultCard, 'manaSpent' | 'manaAvailable' | 'sergeantsSpent'>): string {
  const spent = card.manaSpent;
  if (spent <= 0) return 'You spent no mana.';
  const theirs = Math.min(spent, card.sergeantsSpent ?? 0);
  const all = spent >= card.manaAvailable;
  if (theirs === spent) return `The sergeants used ${all ? 'all ' : ''}${spent} of your mana.`;
  if (!theirs) return `You used ${all ? 'all ' : ''}${spent} of your mana.`;
  return `You used ${spent - theirs} of your mana, and the sergeants ${all ? 'the other' : 'another'} ${theirs}.`;
}

/** Lines the armies up. The battle lives in the state until it's over. At his lair, the villain has his last words ready. */
export function startFight(state: GameState, id: string): Result | null {
  const place = locationById(state, id);
  if (state.army.length === 0 || !place.enemy || place.done) return null;
  const [, seed] = roll(state.seed);
  const battle = createBattle({ place: id, seed: state.seed, player: state.army, enemy: place.enemy!.army, hero: heroAgainst(state, place), obstacles: place.kind === 'hideout' ? 3 : 5, ground: provinceOf(state).fen ? 'fen' : 'meadow', flees: fleesHome(state, place) });
  const words = place.enemy.lastWords ?? (place.kind === 'hideout' ? commissionOf(state).lastWords : undefined);
  return { state: { ...state, seed, battle: words ? { ...battle, lastWords: words } : battle }, events: [{ type: 'battle', place: id }] };
}

/** Why the Crown pays other than the poster's price, when the choice that took him doesn't say. */
const A_DEAL = 'he came of his own accord, more or less';

/** "Baron Grimsby is taken!", or two of them. */
const takenTitle = (villain: string) => `${villain} ${villain.includes(' and ') ? 'are' : 'is'} taken!`;

/**
 * The villain is taken: the commission is won. `state` already has the bounty's gold (`reward`). The
 * card shows his face and says how it went; claiming the bounty puts up his WANTED poster, stamped
 * PAID, which sends the hero to court (or back to the map, to dig, after the last commission). If
 * the Crown pays other than the poster's price, `because` says why.
 */
export function bountyPaid(state: GameState, id: string, opening: string[], reward: number, spoils: string[], battleResult?: BattleResultCard, decisions: Choice[] = [], because?: string): Result {
  const place = locationById(state, id);
  const c = commissionOf(state);
  const piece = state.campaign.chapter + 1;
  const sceptre = provinceOf(state).sceptre;
  const paid = { gold: reward, ...(reward !== bountyOf(state) ? { because: because ?? A_DEAL } : {}) };
  const lines = [...opening, ...spoils];
  const claim: Choice = { label: 'Claim the bounty', action: { type: 'poster' } };
  const looks = { wide: true, ...(c.face ? { portrait: c.face } : {}), ...(battleResult ? { battleResult } : {}) };
  if (!hasNextCommission(state) && sceptre) {
    // The last piece of the map: the commission goes on until the hero digs where the X is.
    const x: Location = { id: 'sceptre', kind: 'dig', name: 'X Marks the Spot', at: sceptre, done: false };
    const next = look({ ...state, bounty: 'paid', paid, locations: [...state.locations, x] }, sceptre, 110).state;
    const card = {
      title: 'The last piece of the map!',
      lines: [...lines, `Among ${c.villain}\u2019s things you find the last torn piece of an old map. Laid together, the ${piece} pieces show an **X**, right here in ${provinceOf(state).name}.`],
      choices: [...decisions, claim],
      ...looks,
    };
    return { state: next, events: [{ type: 'added', id: 'sceptre' }, { type: 'reveal', at: sceptre, radius: 110 }, show(card, place.at, place.id)] };
  }
  const next: GameState = { ...state, bounty: 'paid', paid, over: 'won' };
  const more = hasNextCommission(next);
  const card = {
    title: takenTitle(c.villain),
    lines: [...lines, `Among ${c.villain}\u2019s things you find a torn piece of an old map. You now have **${piece} of ${CAMPAIGN_LENGTH}** pieces.`, `*You complete the commission on day ${roman(next.day)}.*`, ...(more ? [] : campaignLines(next))],
    choices: [...decisions, ...(more ? [claim] : [again, close])],
    ...looks,
  };
  return { state: next, events: [{ type: 'over', result: 'won' }, show(card, place.at, place.id)] };
}

/**
 * An enemy beaten, in battle or by other means: its gold, its artifact and the experience, the
 * enemy gone from the map, and at a hideout, the bounty (with `because`, why it isn't the poster's).
 */
export function beat(state: GameState, id: string, how: { title: string; lines: string[]; reward: number; xp: number; sayGold?: boolean; battleResult?: BattleResultCard; choices?: Choice[]; because?: string }): Result {
  const place = locationById(state, id);
  let next = update({ ...state, gold: state.gold + how.reward }, id, { done: true });
  // A villain beaten in the open flees home to his walls, without his guard; a captain is taken.
  if (place.enemy?.lair) next = fleeHome(next, place);
  if (place.enemy?.taken) next = { ...next, flags: { ...next.flags, ...place.enemy.taken } };
  const events: GameEvent[] = VANISHES.has(place.kind) ? [{ type: 'removed', id }] : [];
  const spoils: string[] = [];
  const decisions = [...(how.choices ?? [])];
  if (place.artifact) {
    next = giveArtifact(next, place.artifact as ArtifactId);
    spoils.push(`Among the spoils is ${artifactPhrase(place.artifact as ArtifactId)}. ${foundNote(next, place.artifact as ArtifactId)}`);
    decisions.push(...artifactChoices(next, place.artifact as ArtifactId));
  }
  if (place.enemy?.spoils) {
    const extra = applyEffects(next, place, place.enemy.spoils);
    next = extra.state;
    events.push(...extra.events);
    spoils.push(...extra.lines);
    if (place.enemy.spoils.artifact) decisions.push(...artifactChoices(next, place.enemy.spoils.artifact));
    // A victory that asks a question: the page its spoils name, with its choices on the card.
    const asks = place.enemy.spoils.page ? place.pages?.find((p) => p.id === place.enemy!.spoils!.page) : undefined;
    if (asks && meets(next, asks.when)) {
      const after = locationById(next, id);
      spoils.push(...asks.lines);
      decisions.push(...asks.choices.filter((c) => meets(next, c.when)).map((c) => choiceButton(next, after, c, `${asks.id}/${c.id}`)));
    }
  }
  if (how.xp) {
    const grown = gainXp(next, how.xp);
    next = grown.state;
    events.push(...grown.events);
    spoils.push(`You gain **${coins(how.xp)} experience**.`);
  }
  if (place.kind === 'hideout') {
    const paid = bountyPaid(next, id, how.lines, how.reward, spoils, how.battleResult, decisions, how.because);
    return { state: paid.state, events: [...events, ...paid.events] };
  }
  const gold = how.sayGold && how.reward ? [`You get **${coins(how.reward)} gold**.`] : [];
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
    if (up.length) lines.push(`${listed(up)} get back on their feet.`);
  }
  return { state: next, lines };
}

export function finishFight(state: GameState): Result {
  const battle = state.battle!;
  const place = locationById(state, battle.place);
  const enemy = place.enemy!;
  const army = survivors(battle, 'player');
  const who = BACKGROUNDS[state.hero.background].short;
  // What became of the leaders, in the words the field said it in: "Their army is beaten, and Baron Grimsby is taken."
  const end = battleEnd(battle);
  // What his bribes cost comes out of his purse.
  const paid = Math.max(0, state.gold - (battle.hero.gold ?? state.gold));
  // And the villain's last words, on the card as on the field.
  const ended = end ? [`${end.army}, and **${end.leader}**.`, ...(battle.result === 'won' && battle.lastWords ? [`*\u201c${battle.lastWords}\u201d*`] : [])] : [];
  const bribed = paid ? [`Bribes cost you **${coins(paid)} gold**${battle.result === 'won' ? ', and those you paid off teach you half what beating them would' : ''}.`] : [];
  // The battle rolled its own dice from the state's seed: carry on from where it stopped, not from the start again.
  const base: GameState = { ...state, seed: battle.seed, battle: undefined, army, gold: state.gold - paid, hero: { ...state.hero, mana: battle.hero.mana } };
  const manaSpent = Math.max(0, state.hero.mana - battle.hero.mana);
  const sergeantsSpent = Math.min(manaSpent, battle.hero.sergeantsSpent ?? 0);
  const battleResult: BattleResultCard = {
    player: fallen(battle, 'player'),
    enemy: fallen(battle, 'enemy'),
    manaSpent,
    manaAvailable: state.hero.mana,
    ...(sergeantsSpent ? { sergeantsSpent } : {}),
  };
  if (battle.result === 'won') {
    const after = afterVictory(base, state.army);
    const lair = place.kind === 'hideout';
    const opening = lair ? [...ended, commissionOf(base).surrender, ...bribed, ...after.lines] : [...ended, enemy.flees, ...bribed, ...after.lines, enemy.loot.replace('{gold}', `**${coins(enemy.reward)} gold**`)];
    // Beside his face, the fallen come once he's taken, before what it cost and what it paid.
    return beat(after.state, place.id, { title: 'Victory!', lines: opening, reward: enemy.reward, xp: wonXp(battle, enemy.army), battleResult: lair ? { ...battleResult, after: ended.length + 1 } : battleResult });
  }
  const castle = state.locations.find((l) => l.kind === 'castle');
  const home = castle ? ([castle.at[0], castle.at[1] + 14] as const) : state.hero.at;
  /** Back at the castle, with nobody: he sees what's about, as he would riding in. */
  const alone = () => seeBands({ ...base, army: [], movement: 0, hero: { ...base.hero, at: home } }, home, heroStats(base).sight);
  const shaken = battle.result === 'fled' && !battle.standoff ? army.map((s) => ({ ...s, count: s.count - Math.ceil(s.count * 0.25) })).filter((s) => s.count > 0) : army;
  // Those lost on the way back fell too, so the card counts them with the rest.
  const lost = new Map(battleResult.player.map((s) => [s.troop, s.count]));
  for (const s of army) {
    const left = shaken.find((k) => k.troop === s.troop)?.count ?? 0;
    if (s.count > left) lost.set(s.troop, (lost.get(s.troop) ?? 0) + s.count - left);
  }
  const fledResult: BattleResultCard = { ...battleResult, player: [...lost].map(([troop, count]) => ({ troop, count })) };
  if (battle.result === 'fled' && shaken.length === 0 && battle.fighters.some((f) => f.hero)) {
    // Nobody who rode with him is left: Aldric gets away alone, and rides home to raise another army.
    return {
      state: alone(),
      events: [
        { type: 'moved', at: home, facing: base.hero.facing },
        show({ title: 'Retreat!', lines: [`${who} gets away alone, because nobody who rode with him is left standing.`, `He rides back to ${castle?.name ?? 'safety'} to raise another army.`, ...bribed], choices: [close], wide: true, battleResult: fledResult }, null),
      ],
    };
  }
  if (battle.result === 'fled' && battle.standoff) {
    // They had no way through to you, and you didn't go to them: both sides draw off, nobody cut down.
    const next = { ...base, movement: 0 };
    return {
      state: next,
      events: [show({ title: 'A stand-off', lines: ['Neither side can get at the other. As the light goes, both draw off.', ...bribed, stillWithYou(army)], choices: [close], wide: true, battleResult }, place.at, place.id)],
    };
  }
  if (battle.result === 'fled') {
    const next = { ...base, army: shaken, movement: 0 };
    return {
      state: next,
      events: [show({ title: 'Retreat!', lines: ['Your men fall back in good order, mostly.', ...bribed, stillWithYou(shaken)], choices: [close], wide: true, battleResult: fledResult }, place.at, place.id)],
    };
  }
  return {
    state: alone(),
    events: [
      { type: 'moved', at: home, facing: base.hero.facing },
      show({ title: 'Defeat', lines: [...(ended.length ? ended : ['Your army is scattered to the four winds.']), `${ended.length ? 'He rides' : 'You limp'} back to ${castle?.name ?? 'safety'} to raise another.`, ...bribed], choices: [close], wide: true, battleResult }, null),
    ],
  };
}

/** Well-mixed seeds for the sample battles, so the samples cover different fields and dice. */
const sampleSeed = (i: number) => (Math.imul(i + 1, 0x9e3779b1) ^ 0x85ebca6b) >>> 0;

/** Recent answers, since the same odds get asked for again and again (every card, every bot step). */
const chances = new Map<string, number>();
const estimates = new Map<string, { chance: number; losses: Army }>();

/** How many fights the cards' odds are worked out from. */
const SAMPLES = 16;

/** What the odds of a fight are kept under: the two armies and the hero as they'd meet, and how many fights they were worked out from. */
const oddsKey = (state: GameState, place: Location, enemy: Army, samples: number) => JSON.stringify([state.army, oddsHero(state), enemy, place.kind, provinceOf(state).fen ?? false, samples]);

/**
 * The sergeants' estimate: how often the army wins this fight when both sides play it out by the
 * AI, over a few fixed seeds. Honest about tactics in a way raw troop numbers aren't. `army` asks
 * about only part of the enemy: the beasts among a band, say.
 */
export function winChance(state: GameState, id: string, samples = SAMPLES, army?: Army): number {
  const place = locationById(state, id);
  if (!place.enemy || state.army.length === 0) return 0;
  const enemy = army ?? place.enemy.army;
  const key = oddsKey(state, place, enemy, samples);
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

/** Whether the cards' odds for a fight with this band are worked out already, so asking for them costs nothing. */
export function oddsKnown(state: GameState, id: string): boolean {
  const place = locationById(state, id);
  if (!place.enemy || state.army.length === 0) return true;
  const key = oddsKey(state, place, place.enemy.army, SAMPLES);
  return chances.has(key) || estimates.has(key);
}

/** The cards' odds for a fight with a band, and what they're kept under, as the odds worker sends them back. */
export type Odds = { key: string; chance: number; losses: Army };

/** Works out the cards' odds for a fight with this band, for the odds worker, off the page's thread. */
export function oddsFor(state: GameState, id: string): Odds | null {
  const place = locationById(state, id);
  if (!place.enemy || state.army.length === 0) return null;
  return { key: oddsKey(state, place, place.enemy.army, SAMPLES), ...simulateFight(state, place, place.enemy.army, SAMPLES) };
}

/** Odds the odds worker has worked out, kept as if they had been worked out here. */
export function learnOdds({ key, chance, losses }: Odds) {
  if (chances.size > 2000) {
    chances.clear();
    estimates.clear();
  }
  chances.set(key, chance);
  estimates.set(key, { chance, losses });
}

function simulateFight(state: GameState, place: Location, enemy: Army, samples: number): { chance: number; losses: Army } {
  const key = oddsKey(state, place, enemy, samples);
  const known = estimates.get(key);
  if (known) return known;
  let wins = 0;
  const wonLosses: number[][] = state.army.map(() => []);
  const allLosses: number[][] = state.army.map(() => []);
  for (let i = 1; i <= samples; i++) {
    const battle = createBattle({ place: place.id, seed: sampleSeed(i), player: state.army, enemy, hero: heroAgainst(state, place), obstacles: place.kind === 'hideout' ? 3 : 5, flees: fleesHome(state, place) });
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
