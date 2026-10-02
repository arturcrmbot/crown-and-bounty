import { ARTIFACTS, artifactPhrase } from '../../content/artifacts';
import { befriends, isBeast, leads, outweighs, TROOPS } from '../../content/troops';
import { grumbleLine } from '../army';
import { applyEffects, choiceButton, meets } from '../effects';
import { battleXp, beat, expectedLosses, fight, purseLines, startFight, winChance } from '../fight';
import { artifactChoices, foundNote, gainXp, giveArtifact, heroStats } from '../hero';
import { asleep } from '../map/roaming';
import { riddenOut } from '../map/sortie';
import { addTroops, close, coins, fightingPower, fits, leadershipUsed, listed, locationById, roman, show, stillWithYou, troops, update, type Army, type Card, type Choice, type ContentChoice, type GameEvent, type GameState, type Location, type Result, type Verdict } from '../state';
import { countsExactly, faceOf, forceLine, note, option, ride, say, words } from './common';
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
 * them. One whose story flag has been spent (the goose already called) is gone, and so is one that
 * sends some of a troop away (half the crossbowmen after the goose) once none of that troop is left.
 */
const parleys = (state: GameState, place: Location) =>
  (place.enemy?.parleys ?? []).filter((p) => meets(state, p.when) && !(p.needs?.flag && state.flags?.[p.needs.flag] === false) && !nobodyToSend(place, p)).map((p) => choiceButton(state, place, haggled(state, p), `parley/${p.id}`));

/** Whether a parley would send away some of a troop the enemy no longer has. */
const nobodyToSend = (place: Location, parley: ContentChoice) => {
  const troop = parley.effects?.desert?.troop;
  return Boolean(troop) && !place.enemy!.army.some((s) => s.troop === troop && s.count > 0);
};

/** Who of a band would fit under the hero's banner: as many as his leadership and his stacks allow. */
function joiners(state: GameState, band: Army): Army {
  let room = heroStats(state).leadership - leadershipUsed(state.army);
  let army = state.army;
  const joining: Army = [];
  for (const stack of band) {
    const count = Math.min(stack.count, fits(room, stack.troop));
    const next = count > 0 ? addTroops(army, stack.troop, count) : null;
    if (!next) continue;
    army = next;
    room -= count * TROOPS[stack.troop].leadership;
    joining.push({ troop: stack.troop, count });
  }
  return joining;
}

/** How much of a band his army outweighs, so that it would come over (`outweighs`): power is the one number. */
const shareOf = (state: GameState, place: Location) => outweighs(fightingPower(state.army), fightingPower(place.enemy!.army));

/** That share of every stack, rounded down: those who would come. */
const sharing = (army: Army, share: number): Army => army.map((s) => ({ ...s, count: Math.floor(s.count * share) }));

/** Whoever of a band didn't come over: the rest of it, still standing there. */
const whoIsLeft = (army: Army, gone: Army): Army => army.map((s) => ({ ...s, count: s.count - (gone.find((g) => g.troop === s.troop)?.count ?? 0) })).filter((s) => s.count > 0);

/** Nobody left in a band but whoever led it. */
const nobodyLeft = (army: Army) => !army.some((s) => !leads(s.troop));

/** A line that opens a sentence starts with a capital, inside any bold: "**Several Wolves** come at you!" */
const opening = (line: string) => line.replace(/^(\**)(\p{Ll})/u, (_, bold: string, first: string) => bold + first.toUpperCase());

/**
 * The card while an enemy has fallen on him: fight, or run. It stays until answered, and it leads with
 * the odds, as every card about a fight does. It's a band that found his camp at dawn, or the rest of
 * one that came over to him only in part, falling on him where he stands (`ambushRest`).
 */
export function ambushCard(state: GameState, before: string[] = []): Card {
  const foe = locationById(state, state.ambush!);
  const choices: Choice[] = [
    { label: 'To arms!', detail: FIGHT_NOTE, action: { type: 'choose', id: foe.id, choice: 'fight' } },
    { label: 'Let the sergeants handle it', detail: SERGEANTS_NOTE, action: { type: 'choose', id: foe.id, choice: 'auto' } },
    { label: 'Run for it (lose a fifth of the army)', action: { type: 'choose', id: foe.id, choice: 'flee' } },
  ];
  const odds = oddsOf(state, foe);
  const says = state.army.length ? [oddsLine(winChance(state, foe.id)), likelyLossesLine(state, foe.id), ...purseLines(state, foe.id)] : [];
  const how = state.ambushRest ? `${opening(forceLine(foe.enemy!.army, countsExactly(state)))} come at you!` : `At first light, **${foe.name}** fall on your camp!`;
  // The rest of a band don't greet him again: their threat was for the whole band, and the biggest of a pack may have just come over to him.
  const threat = state.ambushRest ? [] : [foe.enemy!.threat];
  return { title: state.ambushRest ? foe.name : `An ambush on day ${roman(state.day)}!`, ...faceOf(foe.enemy!.army), ...(odds ? { verdict: odds } : {}), lines: [...before, how, ...threat, ...says], choices };
}

/** The rest of a band that came over only in part fall on him where he stands: fight them, or run. */
function theRestAttack(state: GameState, place: Location, rest: Army, lines: string[], events: GameEvent[]): Result {
  const next: GameState = { ...update(state, place.id, { enemy: { ...place.enemy!, army: rest } }), ambush: place.id, ambushRest: true };
  return { state: next, events: [...events, show(ambushCard(next, lines), place.at, place.id)] };
}

/** What a band asks to change sides, and who of it would come: see `hireOffer`. */
export type HireOffer = { price: number; joining: Army; all: boolean; share: number };

/**
 * What a band asks to change sides, and who of it would come: only troops that draw wages will (no
 * beasts, no villains), and only small fry. As many come as his army outweighs them (`outweighs`), and
 * as many of those as he can lead; he pays for each of them by its power, and the rest attack.
 */
export function hireOffer(state: GameState, place: Location): HireOffer | null {
  const foe = place.enemy;
  const s = heroStats(state);
  if (!foe || place.done || place.kind === 'hideout' || !s.hires) return null;
  // Small fry sell out to anyone who hires; gatekeepers only to a diplomat, and dearly.
  const small = foe.tier === 'pest' || foe.tier === 'band';
  if (!small && !s.hiresGates) return null;
  if (foe.army.some((t) => !TROOPS[t.troop].wage)) return null;
  // Content with its own offer for this sort of hero knows better.
  if (foe.parleys?.some((p) => p.needs?.background === state.hero.background)) return null;
  const share = shareOf(state, place);
  const joining = joiners(state, sharing(foe.army, share));
  const price = Math.round((fightingPower(joining) * HIRE_PRICE * (small ? 1 : GATE_PRICE)) / 10) * 10;
  const all = foe.army.every((t) => joining.find((j) => j.troop === t.troop)?.count === t.count);
  return { price, joining, all, share };
}
/** Gold for every point of a band's power, to buy it off its old employer: about what recruiting as much would cost. */
const HIRE_PRICE = 3;
/** Gatekeepers cost this many times as much to buy: about a week of recruits for the bridge (Artur, 2 Oct, #167). */
const GATE_PRICE = 6;

/**
 * They take his gold and come over, as many as the offer says, and teach him half what beating them
 * would, as a bribe on the field does. A band that comes over whole hands over whatever it carried,
 * as one that surrenders does: its takings, its gear and its story (#231). The rest attack.
 */
function hire(state: GameState, place: Location): Result | null {
  const offer = hireOffer(state, place);
  if (!offer || !offer.joining.length || state.gold < offer.price) return null;
  const foe = place.enemy!;
  const rest = whoIsLeft(foe.army, offer.joining);
  const joined = applyEffects({ ...state, gold: state.gold - offer.price }, place, { troops: offer.joining });
  const lines = [
    offer.all ? 'They count your gold twice, bite a coin, and fall in behind your banner.' : 'Some of them count your gold twice, bite a coin, and fall in behind your banner.',
    `You pay **${coins(offer.price)} gold**.`,
    ...joined.lines,
  ];
  const xp = Math.round(battleXp(offer.joining) / 2);
  if (nobodyLeft(rest)) {
    const won = beat(joined.state, place.id, { title: place.name, lines: [...lines, foe.loot.replace('{gold}', `**${coins(foe.reward)} gold**`)], reward: foe.reward, xp });
    return { state: won.state, events: [...joined.events, ...won.events] };
  }
  const grown = gainXp(joined.state, xp);
  return theRestAttack(grown.state, place, rest, [...lines, `You gain **${coins(xp)} experience**.`], [...joined.events, ...grown.events]);
}

/** The courtier's offer, as a button: greyed out when his purse is too light, or his army too weak. */
function hireButton(state: GameState, place: Location): Choice[] {
  const offer = hireOffer(state, place);
  if (!offer) return [];
  if (!offer.share) return [option(place, 'Hire them (they don\u2019t think much of your army yet)', 'hire', true)];
  if (!offer.joining.length) return [option(place, 'Hire them (no room to lead them)', 'hire', true)];
  // Who would come, by name: a band of several kinds sends some of each.
  const label = offer.all ? 'Hire them' : `Hire ${listed(offer.joining.map((s) => troops(s.troop, s.count)))}, and fight the rest`;
  return [option(place, `${label} (${coins(offer.price)} gold)`, 'hire', state.gold < offer.price)];
}

export type TameOffer = {
  /** The beasts among them, and those of them who'd follow him. */
  beasts: Army;
  joining: Army;
  /** Every one of the beasts would come. */
  all: boolean;
  /** They are nothing but beasts, so the whole band goes with them. */
  whole: boolean;
  /** How much of the pack would follow him (`befriends`): none at 0, all of them at 1. */
  share: number;
  /** Enough of the day left to win them over: it takes the rest of it, and at least half a day. */
  daylight: boolean;
};

const beastsOf = (place: Location) => (place.enemy?.army ?? []).filter((s) => s.count > 0 && isBeast(s.troop));
const headcount = (army: Army) => army.reduce((n, s) => n + s.count, 0);
/** Whether a band is nothing but beasts, leaving out whoever leads it: a captain whose pack follows another is beaten. */
const allBeasts = (place: Location) => beastsOf(place).length === place.enemy!.army.filter((s) => s.count > 0 && !leads(s.troop)).length;

/**
 * What a hero with a way with beasts could win over here: a band's beasts (never at a villain's
 * walls), as many as his army outweighs the band (`outweighs`), or far more for a ranger (`befriends`), in
 * as many companies as he has room for. Beasts need no leadership. It takes him the rest of the day, so he needs half a day's riding
 * left to try (Artur, 2 Oct, #167). Whoever doesn't follow him attacks, the rest of a mixed band too;
 * a band of nothing but beasts that all follow him is gone from the road, its captain too.
 */
export function tameOffer(state: GameState, place: Location): TameOffer | null {
  const beasts = beastsOf(place);
  const s = heroStats(state);
  if (!beasts.length || place.done || place.kind === 'hideout' || !s.tames) return null;
  // The Ranger is the one beasts follow readily (Artur, 2 Oct); anyone else who tames, as far as his army outweighs them.
  const share = s.beastMaster ? befriends(fightingPower(state.army), fightingPower(place.enemy!.army)) : shareOf(state, place);
  const joining = joiners(state, sharing(beasts, share));
  const all = beasts.every((b) => joining.find((j) => j.troop === b.troop)?.count === b.count);
  return { beasts, joining, all, whole: allBeasts(place), share, daylight: state.movement >= s.movement / 2 };
}

/** The beasts join: in their own words, as many as follow him, and whatever they kept in their den. The rest attack. */
function tame(state: GameState, place: Location): Result | null {
  const offer = tameOffer(state, place);
  if (!offer?.joining.length || !offer.daylight) return null;
  const foe = place.enemy!;
  const rest = whoIsLeft(foe.army, offer.joining);
  const gone = nobodyLeft(rest);
  // The whole pack gone over, its captain has nobody left to lead, and is taken.
  const taken = gone && foe.taken ? { flags: foe.taken } : {};
  // Winning them over takes the rest of the day.
  const joined = applyEffects({ ...state, movement: 0 }, place, { troops: offer.joining, ...taken, ...(gone ? { done: true } : {}) });
  let next = joined.state;
  const words = offer.all ? (foe.tamed ?? offer.beasts.map((s) => TROOPS[s.troop].tamed).find(Boolean) ?? 'They decide you will do, and follow you.') : 'The biggest of them decide you will do, and follow you. The rest don\u2019t think much of your army.';
  const lines = [words, ...joined.lines, '*It has taken you the rest of the day.*'];
  if (gone && place.artifact) {
    next = giveArtifact(next, place.artifact);
    lines.push(`They lead you to their den, where you find ${artifactPhrase(place.artifact)}. ${foundNote(next, place.artifact)}`);
  }
  // Half what beating them would teach: there was no fight, but it took some nerve.
  const xp = Math.round(battleXp(offer.joining) / 2);
  const grown = gainXp(next, xp);
  lines.push(`You gain **${coins(xp)} experience**.`);
  if (!gone) return theRestAttack(grown.state, place, rest, lines, [...joined.events, ...grown.events]);
  const choices = place.artifact ? artifactChoices(grown.state, place.artifact) : [];
  return { state: grown.state, events: [...joined.events, ...grown.events, show({ title: place.name, lines, choices: choices.length ? choices : [close] }, place.at, place.id)] };
}

/** Taming, as a button: greyed out, with the reason, when it can't be done. Other heroes see it as a hint. */
function tameButton(state: GameState, place: Location): Choice[] {
  const beasts = beastsOf(place);
  if (!beasts.length || place.done || place.kind === 'hideout') return [];
  const offer = tameOffer(state, place);
  const them = allBeasts(place) ? 'them' : `their ${TROOPS[beasts[0].troop].name}`;
  if (!offer) return [option(place, `Tame ${them} (a way with beasts)`, 'tame', true)];
  if (!offer.share) return [option(place, `Tame ${them} (they don\u2019t think much of your army yet)`, 'tame', true)];
  if (!offer.joining.length) return [option(place, `Tame ${them} (no room in your line)`, 'tame', true)];
  const fight = !nobodyLeft(whoIsLeft(place.enemy!.army, offer.joining));
  const which = offer.all ? `Tame ${them}` : `Tame ${headcount(offer.joining)} of the ${headcount(offer.beasts)}`;
  if (!offer.daylight) return [option(place, `${which} (not this late in the day)`, 'tame', true)];
  return [option(place, `${fight ? `${which}, and fight the rest` : which} (until dusk)`, 'tame')];
}

/** What a hero with a way with beasts reads in their eyes. */
function tameLine(state: GameState, place: Location): string[] {
  const offer = tameOffer(state, place);
  if (!offer) return [];
  if (!offer.share) return [heroStats(state).beastMaster ? '*Beasts follow nobody whose army is half as strong as theirs or weaker. Yours is, for now.*' : '*Beasts follow only an army stronger than theirs, and they don\u2019t think yours is. Not yet.*'];
  return [offer.all ? '*The beasts watch you the way a pack watches its leader.*' : '*Some of the beasts watch you the way a pack watches its leader. The rest are spoiling for a fight.*'];
}

/** Before a band is hired or tamed: who in the army won't march happily beside them. */
function grumbleLines(state: GameState, place: Location): string[] {
  const tamed = tameOffer(state, place);
  const joining = [...(hireOffer(state, place)?.joining ?? []), ...(tamed?.joining ?? [])].map((s) => s.troop);
  const line = joining.length ? grumbleLine(state.army, joining) : null;
  return line ? [line] : [];
}

/** Odds the sergeants think are safe: the enemy looks nervous, and a band this weak surrenders to a diplomat. */
export const SAFE = 0.9;
/** Odds still on your side, if only just. */
const FAIR = 0.55;
/** Odds against you, but not by much. Below them you'd likely lose. */
const LONG = 0.3;

/** The sergeants' verdict on a fight, in plain words and its colour: the same on every card, and on the map. */
export function verdict(chance: number): Verdict {
  if (chance >= SAFE) return { odds: 'win', words: 'You should win.' };
  if (chance >= FAIR) return { odds: 'close', words: 'The odds are on your side.' };
  if (chance >= LONG) return { odds: 'against', words: 'The odds are against you.' };
  return { odds: 'lose', words: 'You\u2019d likely lose.' };
}

/** How the army takes the odds, in its own words, under the verdict. */
export function oddsLine(chance: number): string {
  if (chance >= SAFE) return 'They look nervous.';
  if (chance >= FAIR) return 'It will be close.';
  if (chance >= LONG) return 'Your army looks at you. Then at them.';
  return 'Your army looks at you. Then at them. Then at you.';
}

/**
 * What the fight would likely cost, beside the verdict. The sergeants count the cost of the fights
 * they win, so when a defeat is likelier the line says that a defeat costs the whole army, and that
 * the cost it names is a win's (#171).
 */
export function likelyLossesLine(state: GameState, id: string): string {
  const expected = expectedLosses(state, id);
  if (!expected) return '';
  const { cost } = expected;
  const chance = winChance(state, id);
  if (chance === 0) return '*The sergeants can\u2019t find a way to win this, so you would lose your whole army.*';
  const win = cost ? `the sergeants expect to lose ${cost}` : 'the sergeants expect to bring everyone home';
  const odds = verdict(chance).odds;
  if (odds === 'lose') return `*Most likely you would lose your whole army. Even if you win, ${win}.*`;
  if (odds === 'against') return `*If you win, ${win}. If you lose, you lose your whole army.*`;
  return `*${win[0].toUpperCase()}${win.slice(1)}.*`;
}

/** The verdict with nobody to fight. */
const UNARMED: Verdict = { odds: 'lose', words: 'You have no troops to fight with.' };

/**
 * The verdict on fighting this enemy now, for its cards and its label on the map, or null where there
 * is no fight to be had: beaten already, or his gate barred while he's out.
 */
export function oddsOf(state: GameState, place: Location): Verdict | null {
  if (!place.enemy || place.done || riddenOut(state, place)) return null;
  return state.army.length ? verdict(winChance(state, place.id)) : UNARMED;
}

const TENTHS = ['not one', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** The odds as a scout puts them: a number, in tenths. */
export function scoutsLine(chance: number): string {
  const tenths = Math.round(chance * 10);
  if (tenths === 0) return '*Your scouts don\u2019t give you one chance in ten.*';
  if (tenths === 10) return '*Your scouts would bet their boots on you. They give you ten chances in ten.*';
  return `*Your scouts give you ${TENTHS[tenths]} ${tenths === 1 ? 'chance' : 'chances'} in ten.*`;
}

/** What a scout has seen in their baggage. */
function carriesLine(state: GameState, place: Location): string[] {
  if (!place.artifact || !heroStats(state).odds || place.done) return [];
  const a = ARTIFACTS[place.artifact];
  return [`*Your scouts have seen that they carry* ${artifactPhrase(place.artifact)}. ${a.note}`];
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
  if (!foe || place.done || riddenOut(state, place)) return false;
  const odds = winChance(state, place.id, 8);
  if (place.kind === 'hideout' && ((state.day > 50 && odds >= 0.5) || (state.day > 75 && odds >= 0.25))) return true;
  const sure = foe.tier === 'gate' || place.kind === 'hideout';
  return odds >= (place.kind === 'hideout' ? 0.85 : 0.9) && (!sure || winChance(state, place.id, 16) >= 0.95);
}

/** What the two ways to fight mean, under their buttons. */
export const FIGHT_NOTE = 'You command every stack yourself.';
export const SERGEANTS_NOTE = 'They fight it out for you, by the same rules, in a moment.';

/** An enemy on the map: fight it, let the sergeants fight it, or take one of its parleys. A villain's lair is barred while he's out. */
export function enemy(kind: 'patrol' | 'hideout'): PlaceKind {
  return {
    about: (state, place) => {
      const exact = countsExactly(state);
      const force = forceLine(place.enemy!.army, exact);
      const line = exact ? `Your scouts count ${force}.` : `You see ${force}.`;
      const e = place.enemy!;
      // Hunters say so, and say when they have your scent, so an ambush is never a surprise.
      const shadowed = heroStats(state).shadow;
      const coming = e.bold ? '*They are looking for you, and will fall on you wherever you camp near them, though never in a town.*' : '*They hunt anyone weaker who camps near their ground, though never in a town.*';
      const hunt = e.behaviour !== 'hunt' ? [] : asleep(state, place) ? ['*For now, they hold their ground.*'] : [shadowed ? '*They hunt anyone weaker, but your scouts are watching them, so they won\u2019t find your trail.*' : e.trailing ? '*They have your scent. Camp near them tonight and they\u2019ll fall on you at dawn.*' : coming];
      // While a villain is out, his lair's card says so instead of what it usually says.
      const away = riddenOut(state, place) ? [e.sortie!.barred[0]] : e.lines;
      // The verdict leads, so the odds are the first thing read; scouts who put a number on them say it from afar too.
      const odds = oddsOf(state, place);
      const scouts = odds && state.army.length && heroStats(state).odds ? [scoutsLine(winChance(state, place.id))] : [];
      return { title: place.name, ...faceOf(e.army), ...(odds ? { verdict: odds } : {}), lines: [...away, line, ...scouts, ...carriesLine(state, place), ...hunt], choices: [ride(place, 'Approach'), { label: 'Close', action: { type: 'close' } }] };
    },
    arrive(state, place) {
      const foe = place.enemy!;
      if (place.done) return say(state, place, note(place, words(place, 'done')));
      if (riddenOut(state, place)) return say(state, place, note(place, foe.sortie!.barred));
      if (state.army.length === 0) return say(state, place, { title: place.name, verdict: UNARMED, lines: [foe.threat, 'Recruit some troops first.'], choices: [...parleys(state, place), retreat] });
      const chance = winChance(state, place.id);
      const scouts = heroStats(state).odds ? [scoutsLine(chance)] : [];
      const yields = cowed(state, place, chance) ? [option(place, 'Demand their surrender', 'surrender')] : [];
      return say(state, place, {
        title: place.name,
        ...faceOf(foe.army),
        verdict: verdict(chance),
        lines: [foe.threat, oddsLine(chance), likelyLossesLine(state, place.id), ...purseLines(state, place.id), ...scouts, ...carriesLine(state, place), ...tameLine(state, place), ...grumbleLines(state, place)],
        choices: [{ ...option(place, foe.charge ?? 'Fight', 'fight'), detail: FIGHT_NOTE }, { ...option(place, 'Let the sergeants handle it', 'auto'), detail: SERGEANTS_NOTE }, ...yields, ...hireButton(state, place), ...tameButton(state, place), ...parleys(state, place), retreat],
      });
    },
    choose(state, place, choice) {
      // Nobody opens a villain's gate while he's out.
      if (riddenOut(state, place)) return null;
      const calm: GameState = state.ambush === place.id ? { ...state, ambush: undefined, ambushRest: undefined } : state;
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
      // A pack that would follow him, all of it, is worth the ride, even when a fight would be a gamble.
      const offer = tameOffer(state, place);
      return offer?.whole && offer.all ? place.enemy!.reward + 200 : null;
    },
  };
}
