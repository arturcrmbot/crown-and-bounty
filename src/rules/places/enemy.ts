import { ARTIFACTS } from '../../content/artifacts';
import { isBeast, TROOPS } from '../../content/troops';
import { grumbleLine } from '../army';
import { applyEffects, choiceButton } from '../effects';
import { battleXp, beat, fight, likelyLossesLine, startFight, winChance } from '../fight';
import { artifactChoices, foundNote, gainXp, giveArtifact, heroStats } from '../hero';
import { addTroops, close, coins, leadershipUsed, show, stillWithYou, update, type Army, type Choice, type ContentChoice, type GameState, type Location, type Result } from '../state';
import { countsExactly, forceLine, note, option, ride, say, words } from './common';
import type { PlaceKind } from './kind';

const retreat: Choice = { label: 'Retreat', action: { type: 'close' } };

/** A parley as this hero would strike it: a courtier talks any bribe down. */
export function haggled(state: GameState, parley: ContentChoice): ContentChoice {
  const off = heroStats(state).bribes;
  const gold = parley.needs?.gold;
  return off && gold ? { ...parley, needs: { ...parley.needs, gold: Math.round((gold * (1 - off)) / 10) * 10 } } : parley;
}

/**
 * The other ways past them, as buttons: greyed out, with what they need, when the hero can't take
 * them. One whose story flag has been spent (the goose already called) is gone.
 */
const parleys = (state: GameState, place: Location) =>
  (place.enemy?.parleys ?? []).filter((p) => !(p.needs?.flag && state.flags?.[p.needs.flag] === false)).map((p) => choiceButton(state, place, haggled(state, p), `parley/${p.id}`));

/** Who of a band would fit under the hero's banner: as many as his leadership and his stacks allow. */
function joiners(state: GameState, band: Army): Army {
  let room = heroStats(state).leadership - leadershipUsed(state.army);
  let army = state.army;
  const joining: Army = [];
  for (const stack of band) {
    const count = Math.min(stack.count, Math.floor(room / TROOPS[stack.troop].leadership));
    const next = count > 0 ? addTroops(army, stack.troop, count) : null;
    if (!next) continue;
    army = next;
    room -= count * TROOPS[stack.troop].leadership;
    joining.push({ troop: stack.troop, count });
  }
  return joining;
}

/**
 * What a band asks to change sides, and who of it would fit: only troops that draw wages will
 * (no beasts, no villains), and only small fry. He pays only for the ones he can lead.
 */
export function hireOffer(state: GameState, place: Location): { price: number; joining: Army; all: boolean } | null {
  const foe = place.enemy;
  const s = heroStats(state);
  if (!foe || place.done || place.kind === 'hideout' || !s.hires) return null;
  // Small fry sell out to anyone who hires; gatekeepers only to a diplomat, and dearly.
  const small = foe.tier === 'pest' || foe.tier === 'band';
  if (!small && !s.hiresGates) return null;
  if (foe.army.some((t) => !TROOPS[t.troop].wage)) return null;
  // Content with its own offer for this sort of hero knows better.
  if (foe.parleys?.some((p) => p.needs?.background === state.hero.background)) return null;
  const joining = joiners(state, foe.army);
  const price = joining.reduce((sum, t) => sum + t.count * TROOPS[t.troop].wage * HIRE_PRICE, 0) * (small ? 1 : GATE_PRICE);
  const all = foe.army.every((t) => joining.find((j) => j.troop === t.troop)?.count === t.count);
  return { price, joining, all };
}
/** Gold per point of a troop's weekly wage, to buy him off his old employer. */
const HIRE_PRICE = 12;
/** Gatekeepers cost this many times as much to buy. */
const GATE_PRICE = 2;

function hire(state: GameState, place: Location): Result | null {
  const offer = hireOffer(state, place);
  if (!offer || !offer.joining.length || state.gold < offer.price) return null;
  const done = applyEffects({ ...state, gold: state.gold - offer.price }, place, { troops: offer.joining, done: true });
  const lines = [
    'They count your gold twice, bite a coin, and fall in behind your banner.',
    `**\u2212${coins(offer.price)} gold.**`,
    ...done.lines,
    ...(offer.all ? [] : ['The rest, for whom you have no room, wander off home.']),
  ];
  return { state: done.state, events: [...done.events, show({ title: place.name, lines, choices: [close] }, place.at, place.id)] };
}

/** The courtier's offer, as a button: greyed out when his purse is too light. */
function hireButton(state: GameState, place: Location): Choice[] {
  const offer = hireOffer(state, place);
  if (!offer) return [];
  if (!offer.joining.length) return [option(place, 'Hire them (no room to lead them)', 'hire', true)];
  const label = offer.all ? 'Hire them' : 'Hire as many as you can lead';
  return [option(place, `${label} (${coins(offer.price)} gold)`, 'hire', state.gold < offer.price)];
}

/** A pack follows whoever could beat it: taming needs the odds the card calls close, or better. */
export const TAME_RESPECT = 0.55;

export type TameOffer = {
  /** The beasts among them, and those of them who'd fit under the hero's banner. */
  beasts: Army;
  joining: Army;
  /** Every one of the beasts would come. */
  all: boolean;
  /** They are nothing but beasts, so the whole band goes with them. */
  whole: boolean;
  /** Whether they respect him: he could beat them. */
  respected: boolean;
};

const beastsOf = (place: Location) => (place.enemy?.army ?? []).filter((s) => s.count > 0 && isBeast(s.troop));
const headcount = (army: Army) => army.reduce((n, s) => n + s.count, 0);

/**
 * What a hero with a way with beasts could win over here: a band's beasts (never at a villain's
 * walls), as many as his leadership and stacks allow, if they respect him. A band of nothing but
 * beasts is gone from the road; a mixed one loses its beasts and fights on without them.
 */
export function tameOffer(state: GameState, place: Location, samples = 16): TameOffer | null {
  const beasts = beastsOf(place);
  if (!beasts.length || place.done || place.kind === 'hideout' || !heroStats(state).tames) return null;
  const whole = beasts.length === place.enemy!.army.filter((s) => s.count > 0).length;
  const joining = joiners(state, beasts);
  const all = beasts.every((s) => joining.find((j) => j.troop === s.troop)?.count === s.count);
  const respected = winChance(state, place.id, samples, whole ? undefined : beasts) >= TAME_RESPECT;
  return { beasts, joining, all, whole, respected };
}

/** The beasts join: in their own words, as many as fit, and whatever they kept in their den. */
function tame(state: GameState, place: Location): Result | null {
  const offer = tameOffer(state, place);
  if (!offer?.respected || !offer.joining.length) return null;
  const foe = place.enemy!;
  const joined = applyEffects(state, place, { troops: offer.joining, ...(offer.whole ? { done: true } : {}) });
  let next = joined.state;
  const events = [...joined.events];
  const words = foe.tamed ?? offer.beasts.map((s) => TROOPS[s.troop].tamed).find(Boolean) ?? 'They decide you will do, and follow you.';
  const lines = [words, ...joined.lines];
  if (!offer.all) lines.push('The rest, for whom you have no room, wander off into the wild, looking back now and then.');
  if (!offer.whole) {
    next = update(next, place.id, { enemy: { ...foe, army: foe.army.filter((s) => !isBeast(s.troop)) } });
    lines.push(`**${place.name}** will have to manage without them.`);
  } else if (place.artifact) {
    next = giveArtifact(next, place.artifact);
    lines.push(`They lead you to their den, where you find **${ARTIFACTS[place.artifact].name}**. ${foundNote(next, place.artifact)}`);
  }
  // Half what beating them would teach: there was no fight, but it took some nerve.
  const xp = Math.round(battleXp(offer.beasts) / 2);
  const grown = gainXp(next, xp);
  lines.push(`**+${xp} experience.**`);
  const choices = place.artifact && offer.whole ? artifactChoices(grown.state, place.artifact) : [];
  return { state: grown.state, events: [...events, ...grown.events, show({ title: place.name, lines, choices: choices.length ? choices : [close] }, place.at, place.id)] };
}

/** Taming, as a button: greyed out, with the reason, when it can't be done. Other heroes see it as a hint. */
function tameButton(state: GameState, place: Location): Choice[] {
  const beasts = beastsOf(place);
  if (!beasts.length || place.done || place.kind === 'hideout') return [];
  const offer = tameOffer(state, place);
  const whole = beasts.length === place.enemy!.army.filter((s) => s.count > 0).length;
  const them = whole ? 'them' : `their ${TROOPS[beasts[0].troop].name}`;
  if (!offer) return [option(place, `Tame ${them} (a way with beasts)`, 'tame', true)];
  if (!offer.respected) return [option(place, `Tame ${them} (they don\u2019t respect you yet)`, 'tame', true)];
  if (!offer.joining.length) return [option(place, `Tame ${them} (no room to lead them)`, 'tame', true)];
  return [option(place, offer.all ? `Tame ${them}` : `Tame as many as you can lead (${headcount(offer.joining)} of ${headcount(offer.beasts)})`, 'tame')];
}

/** What a hero with a way with beasts reads in their eyes. */
function tameLine(state: GameState, place: Location): string[] {
  const offer = tameOffer(state, place);
  if (!offer) return [];
  return [offer.respected ? '*The beasts watch you the way a pack watches its leader.*' : '*Beasts follow only someone who could beat them, and these don\u2019t think you could. Not yet.*'];
}

/** Before a band is hired or tamed: who in the army won't march happily beside them. */
function grumbleLines(state: GameState, place: Location): string[] {
  const tamed = tameOffer(state, place);
  const joining = [...(hireOffer(state, place)?.joining ?? []), ...(tamed?.respected ? tamed.joining : [])].map((s) => s.troop);
  const line = joining.length ? grumbleLine(state.army, joining) : null;
  return line ? [line] : [];
}

/** Odds the sergeants think are safe: the enemy looks nervous, and a band this weak surrenders to a diplomat. */
export const SAFE = 0.9;

/** The odds of a fight, in the army's own words and then in plain ones: the same on every card. */
export function oddsLine(chance: number): string {
  if (chance >= SAFE) return 'They look nervous. *You should win.*';
  if (chance >= 0.55) return 'It will be close. *The odds are on your side.*';
  if (chance >= 0.3) return 'Your army looks at you. Then at them. *The odds are against you.*';
  return 'Your army looks at you. Then at them. Then at you. *You\u2019d likely lose.*';
}

const TENTHS = ['not one', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** The odds as a scout puts them: a number, in tenths. */
export function scoutsLine(chance: number): string {
  const tenths = Math.round(chance * 10);
  if (tenths === 0) return '*Your scouts don\u2019t give you one chance in ten.*';
  if (tenths === 10) return '*Your scouts would bet their boots on you: ten chances in ten.*';
  return `*Your scouts give you ${TENTHS[tenths]} ${tenths === 1 ? 'chance' : 'chances'} in ten.*`;
}

/** What a scout has seen in their baggage. */
function carriesLine(state: GameState, place: Location): string[] {
  if (!place.artifact || !heroStats(state).odds || place.done) return [];
  const a = ARTIFACTS[place.artifact];
  return [`*Your scouts have seen what they carry:* **${a.name}**. ${a.note}`];
}

/** A band of people (no beasts, no villain) far weaker than him lays down its arms to a diplomat. */
function cowed(state: GameState, place: Location, chance: number): boolean {
  const foe = place.enemy;
  return Boolean(foe) && !place.done && place.kind === 'patrol' && heroStats(state).cows && chance >= SAFE && foe!.army.every((t) => TROOPS[t.troop].wage > 0);
}

/** They surrender: their gold and everything they carried, and half what a fight would have taught. */
function surrender(state: GameState, place: Location): Result | null {
  if (!cowed(state, place, winChance(state, place.id))) return null;
  const foe = place.enemy!;
  const lines = ['You ride up and explain, politely, what will happen otherwise. They throw down their weapons.', foe.loot.replace('{gold}', `**${coins(foe.reward)} gold**`)];
  return beat(state, place.id, { title: 'They surrender!', lines, reward: foe.reward, xp: Math.round(battleXp(foe.army) / 2) });
}

/**
 * Whether the bot would fight this enemy now: a band when the sergeants like the odds; a gatekeeper
 * or the villain only when it's a sure thing, since losing to them costs the whole army, and that
 * takes weeks to raise again in a big province, while the villain recruits. Once the days run
 * short, a villain is worth a gamble.
 */
export function worthAFight(state: GameState, place: Location): boolean {
  const foe = place.enemy;
  if (!foe || place.done) return false;
  const odds = winChance(state, place.id, 8);
  if (place.kind === 'hideout' && ((state.day > 50 && odds >= 0.5) || (state.day > 75 && odds >= 0.25))) return true;
  const sure = foe.tier === 'gate' || place.kind === 'hideout';
  return odds >= (place.kind === 'hideout' ? 0.85 : 0.9) && (!sure || winChance(state, place.id, 16) >= 0.95);
}

/** What the two ways to fight mean, under their buttons. */
export const FIGHT_NOTE = 'You command every stack yourself.';
export const SERGEANTS_NOTE = 'They fight it out for you, by the same rules, in a moment.';

/** An enemy on the map: fight it, let the sergeants fight it, or take one of its parleys. */
export function enemy(kind: 'patrol' | 'hideout'): PlaceKind {
  return {
    about: (state, place) => {
      const exact = countsExactly(state);
      const force = forceLine(place.enemy!.army, exact);
      const line = exact ? `Your scouts count ${force}.` : `${force.replace(/^\*\*(.)/, (_, c: string) => `**${c.toUpperCase()}`)}.`;
      const e = place.enemy!;
      // Hunters say so, and say when they have your scent, so an ambush is never a surprise.
      const shadowed = heroStats(state).shadow;
      const hunt = e.behaviour !== 'hunt' ? [] : [shadowed ? '*They hunt anyone weaker, but your scouts are watching them: they won\u2019t find your trail.*' : e.trailing ? '*They have your scent. Camp near them tonight and they\u2019ll fall on you at dawn.*' : '*They hunt anyone weaker who camps near their ground, though never in a town.*'];
      return { title: place.name, lines: [...e.lines, line, ...carriesLine(state, place), ...hunt], choices: [ride(place, 'Approach'), { label: 'Close', action: { type: 'close' } }] };
    },
    arrive(state, place) {
      const foe = place.enemy!;
      if (place.done) return say(state, place, note(place, words(place, 'done')));
      if (state.army.length === 0) return say(state, place, { title: place.name, lines: [foe.threat, 'You have no troops to fight with. Recruit some first.'], choices: [...parleys(state, place), retreat] });
      const chance = winChance(state, place.id);
      const scouts = heroStats(state).odds ? [scoutsLine(chance)] : [];
      const yields = cowed(state, place, chance) ? [option(place, 'Demand their surrender', 'surrender')] : [];
      return say(state, place, {
        title: place.name,
        lines: [foe.threat, oddsLine(chance), likelyLossesLine(state, place.id), ...scouts, ...carriesLine(state, place), ...tameLine(state, place), ...grumbleLines(state, place)],
        choices: [{ ...option(place, foe.charge ?? 'Fight', 'fight'), detail: FIGHT_NOTE }, { ...option(place, 'Let the sergeants handle it', 'auto'), detail: SERGEANTS_NOTE }, ...yields, ...hireButton(state, place), ...tameButton(state, place), ...parleys(state, place), retreat],
      });
    },
    choose(state, place, choice) {
      const calm: GameState = state.ambush === place.id ? { ...state, ambush: undefined } : state;
      if (choice === 'fight') return startFight(calm, place.id);
      if (choice === 'hire') return hire(calm, place);
      if (choice === 'surrender') return surrender(calm, place);
      if (choice === 'tame') return tame(calm, place);
      if (choice === 'auto') return fight(calm, place.id);
      if (choice === 'flee' && state.ambush === place.id) {
        const army = state.army.map((s) => ({ ...s, count: s.count - Math.ceil(s.count * 0.2) })).filter((s) => s.count > 0);
        return say({ ...calm, army }, place, note(place, ['You leave the camp fires burning and ride hard. Not everyone keeps up.', stillWithYou(army)]));
      }
      return null;
    },
    worth(state, place) {
      if (place.done) return null;
      if (worthAFight(state, place)) return kind === 'patrol' ? place.enemy!.reward + 200 : 5000;
      if (kind !== 'patrol') return null;
      // A pack that would follow him is worth the ride, even when a fight would be a gamble.
      const offer = tameOffer(state, place);
      return offer?.whole && offer.respected && offer.joining.length ? place.enemy!.reward + 200 : null;
    },
  };
}
