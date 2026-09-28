import { ARTIFACTS, type ArtifactId } from '../../content/artifacts';
import { troopPower } from '../../content/troops';
import { giveArtifact, heroStats } from '../hero';
import { addTroops, close, coins, joinLine, leadershipUsed, locationById, TROOPS, troops, update, type Card, type GameState, type Location, type Result } from '../state';
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
  return Math.max(0, Math.min(offer.count, room, Math.floor(state.gold / priceOf(state, offer.price))));
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
  const armoury = place.wares?.length ? [option(place, 'Visit the armoury', 'armoury')] : [];
  const leave = before.length ? close : { label: 'Not today', action: { type: 'close' as const } };
  if (!offer || place.done || offer.count === 0) {
    return { title: place.name, lines: [...before, '"All out of volunteers, officer. Come back after payday."'], choices: [...armoury, close] };
  }
  const count = recruitable(state, place.id);
  const room = Math.floor((heroStats(state).leadership - leadershipUsed(state.army)) / TROOPS[offer.troop].leadership);
  const each = priceOf(state, offer.price);
  const purse = Math.floor(state.gold / each);
  const lines = [...before, `**${troops(offer.troop, offer.count)}** will join you for **${coins(each)} gold** each.`];
  // Gear that puts honest recruits off (the Black Banner) says so, or the price is a mystery.
  const shunned = Object.values(state.hero.gear).find((id) => id && (ARTIFACTS[id].bonus.recruitPrice ?? 0) > 0);
  if (shunned) lines.push(`*They don\u2019t like the look of your ${ARTIFACTS[shunned].name.replace(/^The /, '')}: that\u2019s ${Math.round((ARTIFACTS[shunned].bonus.recruitPrice ?? 0) * 100)}% dearer.*`);
  // Say why fewer than are on offer can come: no room in the line, not enough leadership, or not enough gold.
  const slot = Boolean(addTroops(state.army, offer.troop, 1));
  if (!slot) lines.push('Five companies are all one officer can lead. Dismiss one (H) to make room.');
  else if (room < offer.count) lines.push(room > 0 ? `You can only lead ${room} more.` : 'You can\u2019t lead any more troops. Find some leadership first.');
  if (slot && room > 0 && purse < Math.min(offer.count, room)) lines.push(purse > 0 ? `Your purse runs to ${purse}.` : `You can\u2019t pay for even one.`);
  const free = count > 0 ? thrownIn(state, place, count) : 0;
  const hire = count > 0 ? option(place, `Recruit ${count}${free ? ` + ${free} free` : ''} (${coins(count * each)} gold)`, 'recruit') : option(place, 'Recruit', 'recruit', true);
  return { title: place.name, lines, choices: [hire, ...armoury, leave] };
}

/** Whether the hero wears or carries an artifact already. */
const owns = (state: GameState, id: ArtifactId) => Object.values(state.hero.gear).includes(id) || state.hero.pack.includes(id);

/** The armoury's wares: one button each, with its price and what it does, greyed when it's too dear. */
function armouryCard(state: GameState, place: Location, before: string[] = []): Card {
  const wares = (place.wares ?? []).filter((w) => !owns(state, w));
  return {
    title: `${place.name}: the armoury`,
    wide: true,
    lines: [...before, wares.length ? 'The armourer polishes something that was already clean.' : 'Nothing left but a very tired whetstone.'],
    choices: [
      ...wares.map((w) => {
        const price = ARTIFACTS[w].price ?? 0;
        const short = price - state.gold;
        return { ...option(place, `Buy ${ARTIFACTS[w].name} (${coins(price)} gold)`, `buy:${w}`, short > 0), detail: `${ARTIFACTS[w].note}${short > 0 ? ` You\u2019re ${coins(short)} gold short.` : ''}` };
      }),
      close,
    ],
  };
}

function buy(state: GameState, place: Location, artifact: ArtifactId): Result | null {
  const price = ARTIFACTS[artifact]?.price ?? 0;
  if (!place.wares?.includes(artifact) || owns(state, artifact) || state.gold < price) return null;
  const next = giveArtifact(update({ ...state, gold: state.gold - price }, place.id, { wares: place.wares.filter((w) => w !== artifact) }), artifact);
  const worn = next.hero.gear[ARTIFACTS[artifact].slot] === artifact;
  const where = worn ? 'you put it on straight away' : 'it goes in your pack, since you wear something there already (H to swap)';
  return say(next, place, armouryCard(next, locationById(next, place.id), [`**${ARTIFACTS[artifact].name}** is yours: ${where}.`]));
}

/** Castles and villages: troops to recruit, restocked every payday, and sometimes an armoury. */
export const dwelling: PlaceKind = {
  about: (_, place) => ({ title: place.name, lines: words(place, 'about'), choices: [ride(place, 'Visit'), close] }),
  arrive: (state, place) => found(state, place, recruitCard(state, place)),
  choose(state, place, choice) {
    if (choice === 'recruit') return recruit(state, place);
    if (choice === 'armoury') return say(state, place, armouryCard(state, place));
    if (choice.startsWith('buy:')) return buy(state, place, choice.slice(4) as ArtifactId);
    return null;
  },
  payday: (place) => (place.recruits ? { ...place, recruits: { ...place.recruits, count: place.recruits.count + RESTOCK } } : place),
  worth(state, place) {
    const n = recruitable(state, place.id);
    return n > 0 ? n * troopPower(place.recruits!.troop) * 3 : null;
  },
  bot(state, place) {
    let next = state;
    if (recruitable(next, place.id) > 0) next = recruit(next, place)?.state ?? next;
    for (const ware of locationById(next, place.id).wares ?? []) {
      if (next.gold >= (ARTIFACTS[ware].price ?? 0) + 600) next = buy(next, locationById(next, place.id), ware)?.state ?? next;
    }
    return next;
  },
};
