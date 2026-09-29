import { ARTIFACTS, type ArtifactId } from '../../content/artifacts';
import { troopPower } from '../../content/troops';
import { dismiss, grumbleLine } from '../army';
import { artifactChoices, giveArtifact, heroStats, salePrice, sell, slotTaken, wantedAt } from '../hero';
import { bestChoice, firstPage, pageCard, takeChoice } from '../effects';
import { addTroops, close, coins, joinLine, leadershipUsed, locationById, TROOPS, troops, update, type Card, type Choice, type GameState, type Location, type Result } from '../state';
import { found, option, priceOf, ride, say, words } from './common';
import type { PlaceKind } from './kind';

/** Volunteers every castle and village finds on payday. */
export const RESTOCK = 10;

/** How many of a recruiter's troops the hero can take now: capped by the offer, leadership and gold. */
export function recruitable(state: GameState, id: string): number {
  const offer = locationById(state, id).recruits;
  if (!offer) return 0;
  if (!addTroops(state.army, offer.troop, 1)) return 0;
  const room = Math.floor((heroStats(state).leadership - leadershipUsed(state.army)) / TROOPS[offer.troop].leadership);
  const each = priceOf(state, offer.price);
  return Math.max(0, Math.min(offer.count, room, each ? Math.floor(state.gold / each) : offer.count));
}

/** Recruits a quartermaster talks them into throwing in with `count`, on top of the offer: as many as he can lead. */
function thrownIn(state: GameState, place: Location, count: number): number {
  const offer = place.recruits!;
  const room = Math.floor((heroStats(state).leadership - leadershipUsed(state.army)) / TROOPS[offer.troop].leadership) - count;
  return Math.max(0, Math.min(Math.floor(count * heroStats(state).freeRecruits), room));
}

function recruit(state: GameState, place: Location): Result | null {
  const offer = place.recruits;
  const count = recruitable(state, place.id);
  if (!offer || count <= 0) return null;
  const free = thrownIn(state, place, count);
  const army = addTroops(state.army, offer.troop, count + free);
  if (!army) return null;
  const next = update({ ...state, gold: state.gold - count * priceOf(state, offer.price), army }, place.id, { recruits: { ...offer, count: offer.count - count } });
  const extra = free > 0 ? [`Your quartermaster talks them into throwing in **${free} more**, free.`] : [];
  // The place's card again, with who joined on top: the armoury is still a click away.
  return say(next, place, recruitCard(next, locationById(next, place.id), [joinLine(offer.troop, count), ...extra]));
}

/**
 * A castle's or village's card: who will join and for what, why fewer can come than are on offer,
 * and the armoury. `before` says what just happened here, and then the way out is Close.
 */
function recruitCard(state: GameState, place: Location, before: string[] = []): Card {
  const offer = place.recruits;
  // An armoury stays open while it has wares to sell or he has spares it could buy.
  const armoury = place.wares && (place.wares.length || state.hero.pack.length) ? [option(place, 'Visit the armoury', 'armoury')] : [];
  const leave = before.length ? close : { label: 'Not today', action: { type: 'close' as const } };
  if (!offer || place.done || offer.count === 0) {
    // A place with its own words for when everyone has gone says so; the rest restock on payday.
    return { title: place.name, lines: [...before, ...(place.text?.done ?? ['"All out of volunteers, officer. Come back after payday."'])], choices: [...armoury, close] };
  }
  const count = recruitable(state, place.id);
  const room = Math.floor((heroStats(state).leadership - leadershipUsed(state.army)) / TROOPS[offer.troop].leadership);
  const each = priceOf(state, offer.price);
  const purse = each ? Math.floor(state.gold / each) : offer.count;
  const lines = [...before, each ? `**${troops(offer.troop, offer.count)}** will join you for **${coins(each)} gold** each.` : `**${troops(offer.troop, offer.count)}** will join you, and ask for nothing.`];
  // Companies that won't march happily beside them say so before they join, not after.
  const grumble = grumbleLine(state.army, [offer.troop]);
  if (grumble) lines.push(grumble);
  // Gear that puts honest recruits off (the Black Banner) says so, or the price is a mystery.
  const shunned = each && Object.values(state.hero.gear).find((id) => id && (ARTIFACTS[id].bonus.recruitPrice ?? 0) > 0);
  if (shunned) lines.push(`*They don\u2019t like the look of your ${ARTIFACTS[shunned].name.replace(/^The /, '')}: that\u2019s ${Math.round((ARTIFACTS[shunned].bonus.recruitPrice ?? 0) * 100)}% dearer.*`);
  // Say why fewer than are on offer can come: no room in the line, not enough leadership, or not enough gold.
  const slot = Boolean(addTroops(state.army, offer.troop, 1));
  if (!slot) lines.push('Five companies are all one officer can lead. Dismiss one (H) to make room.');
  else if (room < offer.count) lines.push(room > 0 ? `You can only lead ${room} more.` : 'You can\u2019t lead any more troops. Find some leadership first.');
  if (slot && room > 0 && purse < Math.min(offer.count, room)) lines.push(purse > 0 ? `Your purse runs to ${purse}.` : `You can\u2019t pay for even one.`);
  const free = count > 0 ? thrownIn(state, place, count) : 0;
  const price = each ? `${coins(count * each)} gold` : 'free';
  const hire = count > 0 ? option(place, `Recruit ${count}${free ? ` + ${free} free` : ''} (${price})`, 'recruit') : option(place, 'Recruit', 'recruit', true);
  return { title: place.name, lines, choices: [hire, ...armoury, leave] };
}

/** Whether the hero wears or carries an artifact already. */
const owns = (state: GameState, id: ArtifactId) => Object.values(state.hero.gear).includes(id) || state.hero.pack.includes(id);

/** What the armourer says to a hero with something in his pack. */
const HAGGLE = 'He eyes your pack. "Half what it cost new, officer. Four hundred if I can\u2019t put a price on it."';

/**
 * The armoury's wares: one button each, with its price and what it does, greyed when it's too dear.
 * A hero with anything in his pack can offer the armourer his spares.
 */
function armouryCard(state: GameState, place: Location, before: string[] = [], decisions: Choice[] = []): Card {
  const wares = (place.wares ?? []).filter((w) => !owns(state, w));
  return {
    title: `${place.name}: the armoury`,
    wide: true,
    lines: [...before, wares.length ? 'The armourer polishes something that was already clean.' : 'Nothing left but a very tired whetstone.'],
    choices: [
      ...decisions,
      ...wares.map((w) => {
        const price = ARTIFACTS[w].price ?? 0;
        const short = price - state.gold;
        return { ...option(place, `Buy ${ARTIFACTS[w].name} (${coins(price)} gold)`, `buy:${w}`, short > 0), detail: `${ARTIFACTS[w].note}${short > 0 ? ` You\u2019re ${coins(short)} gold short.` : ''}` };
      }),
      ...(state.hero.pack.length ? [option(place, 'Sell him your spares', 'spares')] : []),
      ...(decisions.length ? [] : [close]),
    ],
  };
}

/**
 * The armourer's offer for everything in the pack, what he'd pay on each button: greyed, saying
 * where, for gear a choice still needs. One line each, so a full pack still fits on the card.
 */
function sparesCard(state: GameState, place: Location, before: string[] = []): Card {
  const spares = state.hero.pack;
  return {
    title: `${place.name}: the armoury`,
    wide: true,
    lines: [...before, spares.length ? HAGGLE : 'Your pack is empty. He looks almost disappointed.'],
    choices: [...spares.map((id) => sellButton(state, place, id)), option(place, 'Back to his wares', 'armoury'), close],
  };
}

function sellButton(state: GameState, place: Location, id: ArtifactId): Choice {
  const wanted = wantedAt(state, id);
  const button = option(place, `Sell ${ARTIFACTS[id].name} (${coins(salePrice(id))} gold)`, `sell:${id}`, Boolean(wanted));
  return wanted ? { ...button, detail: `Not for sale: you\u2019ll need it at ${wanted.name}.` } : button;
}

/** The armourer buys a spare. Gear with a price goes back on his wall at full price; the rest he keeps. */
function sellTo(state: GameState, place: Location, id: ArtifactId): Result | null {
  const sold = place.wares ? sell(state, id) : null;
  if (!sold) return null;
  const priced = Boolean(ARTIFACTS[id].price);
  const wares = place.wares ?? [];
  const next = priced && !wares.includes(id) ? update(sold.state, place.id, { wares: [...wares, id] }) : sold.state;
  const line = `**${ARTIFACTS[id].name}** is his, for **${coins(salePrice(id))} gold**. ${priced ? 'He hangs it back on the wall, at full price.' : 'He wraps it in sacking and asks no questions.'}`;
  return say(next, place, sparesCard(next, locationById(next, place.id), [line]));
}

function buy(state: GameState, place: Location, artifact: ArtifactId): Result | null {
  const price = ARTIFACTS[artifact]?.price ?? 0;
  if (!place.wares?.includes(artifact) || owns(state, artifact) || state.gold < price) return null;
  const next = giveArtifact(update({ ...state, gold: state.gold - price }, place.id, { wares: place.wares.filter((w) => w !== artifact) }), artifact);
  const worn = Object.values(next.hero.gear).includes(artifact);
  const where = ARTIFACTS[artifact].drawback ? 'you keep it in your pack until you choose whether to wear it' : worn ? 'you put it on straight away' : `it goes in your pack, since ${slotTaken(artifact)} (H to swap)`;
  return say(next, place, armouryCard(next, locationById(next, place.id), [`**${ARTIFACTS[artifact].name}** is yours: ${where}.`], artifactChoices(next, artifact)));
}

/**
 * For the bot: when all five companies are taken and this place offers something much better than
 * the weakest of them, which company it sends home to make room, and how many then join.
 */
function makeRoom(state: GameState, place: Location): { index: number; count: number; loss: number } | null {
  const offer = place.recruits;
  if (!offer || offer.count === 0 || state.army.length < 2 || addTroops(state.army, offer.troop, 1)) return null;
  const worth = (i: number) => state.army[i].count * troopPower(state.army[i].troop);
  const index = state.army.reduce((weakest, _, i) => (worth(i) < worth(weakest) ? i : weakest), 0);
  const count = recruitable(dismiss(state, index)?.state ?? state, place.id);
  return count > 0 && count * troopPower(offer.troop) > worth(index) * 1.5 ? { index, count, loss: worth(index) } : null;
}

/**
 * Castles and villages: troops to recruit, restocked every payday, and sometimes an armoury. A page
 * written as content comes first while one holds (the old King's hunt hall, locked).
 */
export const dwelling: PlaceKind = {
  about: (_, place) => ({ title: place.name, lines: words(place, 'about'), choices: [ride(place, 'Visit'), close] }),
  arrive: (state, place) => {
    const page = firstPage(state, place);
    return found(state, place, page ? pageCard(state, place, page) : recruitCard(state, place));
  },
  card: (state, place, before) => recruitCard(state, place, before),
  choose(state, place, choice) {
    if (choice === 'recruit') return recruit(state, place);
    if (choice === 'armoury') return say(state, place, armouryCard(state, place));
    if (choice === 'spares') return place.wares ? say(state, place, sparesCard(state, place)) : null;
    if (choice.startsWith('buy:')) return buy(state, place, choice.slice(4) as ArtifactId);
    if (choice.startsWith('sell:')) return sellTo(state, place, choice.slice(5) as ArtifactId);
    return null;
  },
  payday: (place) => (place.recruits ? { ...place, recruits: { ...place.recruits, count: place.recruits.count + (place.recruits.restock ?? RESTOCK) } } : place),
  worth(state, place) {
    const content = bestChoice(state, place)?.worth;
    if (content) return content;
    const n = recruitable(state, place.id);
    if (n > 0) return n * troopPower(place.recruits!.troop) * 3;
    const room = makeRoom(state, place);
    return room ? (room.count * troopPower(place.recruits!.troop) - room.loss) * 3 : null;
  },
  bot(state, place) {
    const best = bestChoice(state, place);
    let next = best ? (takeChoice(state, place, best.choice)?.state ?? state) : state;
    place = locationById(next, place.id);
    // A line full of weaker companies sends the weakest home to make room.
    const room = recruitable(next, place.id) > 0 ? null : makeRoom(next, place);
    if (room) next = dismiss(next, room.index)?.state ?? next;
    if (recruitable(next, place.id) > 0) next = recruit(next, place)?.state ?? next;
    for (const ware of locationById(next, place.id).wares ?? []) {
      if (next.gold >= (ARTIFACTS[ware].price ?? 0) + 600) next = buy(next, locationById(next, place.id), ware)?.state ?? next;
    }
    return next;
  },
};
