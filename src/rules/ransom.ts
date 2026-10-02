import { leads, TROOPS } from '../content/troops';
import { capital, coins, listed, type Captive, type GameState, type Location, type Stack } from './state';

/**
 * Enemy captains are worth taking (#258), as King's Bounty's villains were: each has the Crown's price
 * on his head, 100 gold a level (Artur, 2 Oct). Taken, he's marched back to the castle in irons, and
 * the steward pays his price when Aldric next rides in. Anyone still in the cells when the villain
 * falls is paid for by the King at court.
 */
export const PRICE_A_LEVEL = 100;

/** The captains leading a band: its leaders with a level. Not a villain, at his walls or out of them, who is the bounty. */
export const captainsOf = (place: Location): Stack[] =>
  place.kind === 'hideout' || !place.enemy || place.enemy.lair ? [] : place.enemy.army.filter((s) => s.count > 0 && s.level && leads(s.troop));

/** The Crown's price on a captain's head. */
export const priceOf = (captain: { level?: number }) => (captain.level ?? 0) * PRICE_A_LEVEL;

/** All the gold on a band's captains. */
export const bandPrice = (place: Location) => captainsOf(place).reduce((sum, s) => sum + priceOf(s), 0);

const castleOf = (state: GameState) => state.locations.find((l) => l.kind === 'castle');
const nameOf = (c: { troop: Stack['troop'] }) => `**${TROOPS[c.troop].one}**`;

/** The price on a band's captain, for its cards, while he's still at large. */
export function priceLines(state: GameState, place: Location): string[] {
  if (place.done) return [];
  const castle = castleOf(state);
  return captainsOf(place).map((s) => `There is a price of **${coins(priceOf(s))} gold** on ${TROOPS[s.troop].one}\u2019s head, and the steward pays it at ${castle?.name ?? 'your castle'}.`);
}

/** A band beaten, hired or tamed whole: its captains go back to the castle in irons, to be paid for there. */
export function jail(state: GameState, place: Location): { state: GameState; lines: string[] } {
  const held = state.captives ?? [];
  const taken = captainsOf(place).filter((s) => !held.some((c) => c.place === place.id && c.troop === s.troop));
  if (!taken.length) return { state, lines: [] };
  const captives: Captive[] = [...held, ...taken.map((s) => ({ place: place.id, troop: s.troop, level: s.level! }))];
  const price = taken.reduce((sum, s) => sum + priceOf(s), 0);
  const them = taken.length > 1 ? 'them' : 'him';
  const castle = castleOf(state)?.name ?? 'your castle';
  return {
    state: { ...state, captives },
    lines: [`Your men march ${listed(taken.map(nameOf))} back to ${castle} in irons. The steward will pay you the Crown\u2019s price of **${coins(price)} gold** for ${them} when you next ride in.`],
  };
}

/** Captains in the cells whose price hasn't been paid yet. */
export const unpaid = (state: GameState) => (state.captives ?? []).filter((c) => !c.paid);

/** At his castle, the steward pays the Crown's price for everyone in the cells. */
export function ransom(state: GameState): { state: GameState; lines: string[] } {
  const owed = unpaid(state);
  if (!owed.length) return { state, lines: [] };
  const gold = owed.reduce((sum, c) => sum + priceOf(c), 0);
  const captives = (state.captives ?? []).map((c) => (c.paid ? c : { ...c, paid: 'castle' as const }));
  const many = owed.length > 1;
  return {
    state: { ...state, gold: state.gold + gold, captives },
    lines: [`${capital(listed(owed.map(nameOf)))} ${many ? 'are' : 'is'} safe in the castle\u2019s cells, and the steward pays you the Crown\u2019s price on ${many ? 'their heads' : 'his head'}. You get **${coins(gold)} gold**.`],
  };
}

/** At court, the King pays for whoever is still in the cells. */
export function ransomAtCourt(state: GameState): GameState {
  const owed = unpaid(state);
  if (!owed.length) return state;
  const gold = owed.reduce((sum, c) => sum + priceOf(c), 0);
  return { ...state, gold: state.gold + gold, captives: (state.captives ?? []).map((c) => (c.paid ? c : { ...c, paid: 'court' as const })) };
}

/** What the King paid at court for captains still in the cells. */
export const paidAtCourt = (state: GameState) => (state.captives ?? []).filter((c) => c.paid === 'court').reduce((sum, c) => sum + priceOf(c), 0);

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const counted = (n: number) => WORDS[n] ?? coins(n);

/** What the King's gaoler has told him at court: how many of the villain's captains Aldric sent him. */
export function gaolerLine(state: GameState, villain: string): string[] {
  const n = state.captives?.length ?? 0;
  if (!n) return [];
  const all = state.locations.filter((l) => captainsOf(l).length).length;
  const whom = n >= all && n > 1 ? `every one of ${villain}\u2019s ${counted(n)} captains` : `${counted(n)} of ${villain}\u2019s captains`;
  const joke = n >= 3 ? ' He has had to borrow chairs from the kitchen.' : '';
  return [`"My gaoler tells me you sent him ${whom}.${joke}"`];
}
