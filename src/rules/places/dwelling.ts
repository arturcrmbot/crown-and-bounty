import { ARTIFACTS, type ArtifactId } from '../../content/artifacts';
import { troopPower } from '../../content/troops';
import { giveArtifact, heroStats } from '../hero';
import { addTroops, close, coins, joinLine, leadershipUsed, locationById, TROOPS, troops, update, type Card, type GameState, type Location, type Result } from '../state';
import { found, option, priceOf, ride, say, words } from './common';
import type { PlaceKind } from './kind';

/** How many of a recruiter's troops the hero can take now: capped by the offer, leadership and gold. */
export function recruitable(state: GameState, id: string): number {
  const offer = locationById(state, id).recruits;
  if (!offer) return 0;
  if (!addTroops(state.army, offer.troop, 1)) return 0;
  const room = Math.floor((heroStats(state).leadership - leadershipUsed(state.army)) / TROOPS[offer.troop].leadership);
  return Math.max(0, Math.min(offer.count, room, Math.floor(state.gold / priceOf(state, offer.price))));
}

function recruit(state: GameState, place: Location): Result | null {
  const offer = place.recruits;
  const count = recruitable(state, place.id);
  const army = offer && count > 0 ? addTroops(state.army, offer.troop, count) : null;
  if (!offer || !army) return null;
  const next = update({ ...state, gold: state.gold - count * priceOf(state, offer.price), army }, place.id, { recruits: { ...offer, count: offer.count - count } });
  return say(next, place, { title: place.name, lines: [joinLine(offer.troop, count)], choices: [close] });
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
  arrive(state, place) {
    const offer = place.recruits;
    const armoury = place.wares?.length ? [option(place, 'Visit the armoury', 'armoury')] : [];
    if (!offer || place.done || offer.count === 0) {
      return found(state, place, { title: place.name, lines: ['"All out of volunteers, officer. Come back after payday."'], choices: [...armoury, close] });
    }
    const count = recruitable(state, place.id);
    const room = Math.floor((heroStats(state).leadership - leadershipUsed(state.army)) / TROOPS[offer.troop].leadership);
    const each = priceOf(state, offer.price);
    const purse = Math.floor(state.gold / each);
    const lines = [`**${troops(offer.troop, offer.count)}** will join you for **${coins(each)} gold** each.`];
    // Say why fewer than are on offer can come: no room in the line, not enough leadership, or not enough gold.
    if (!addTroops(state.army, offer.troop, 1)) lines.push('Five companies are all one officer can lead. Dismiss one (H) to make room.');
    else if (room < offer.count) lines.push(room > 0 ? `You can only lead ${room} more.` : 'You can\u2019t lead any more troops. Find some leadership first.');
    if (addTroops(state.army, offer.troop, 1) && room > 0 && purse < Math.min(offer.count, room)) lines.push(purse > 0 ? `Your purse runs to ${purse}.` : `You can\u2019t pay for even one.`);
    const hire = count > 0 ? option(place, `Recruit ${count} (${coins(count * each)} gold)`, 'recruit') : option(place, 'Recruit', 'recruit', true);
    return found(state, place, { title: place.name, lines, choices: [hire, ...armoury, { label: 'Not today', action: { type: 'close' } }] });
  },
  choose(state, place, choice) {
    if (choice === 'recruit') return recruit(state, place);
    if (choice === 'armoury') return say(state, place, armouryCard(state, place));
    if (choice.startsWith('buy:')) return buy(state, place, choice.slice(4) as ArtifactId);
    return null;
  },
  payday: (place) => (place.recruits ? { ...place, recruits: { ...place.recruits, count: place.recruits.count + 10 } } : place),
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
