import type { Card, GameState, Location, Result } from '../state';

/**
 * What a kind of place does. Everything about one kind lives in one module: its cards, what a visit
 * does, its own choices, payday, and how much the bot wants it. Content (`place.pages`, parleys)
 * works for every kind on top of this.
 */
export type PlaceKind = {
  /** The card before the hero rides there. */
  about(state: GameState, place: Location): Card;
  /** What happens on arrival, and the card that shows it. */
  arrive(state: GameState, place: Location): Result;
  /** One of this kind's own choices, by id. */
  choose?(state: GameState, place: Location, choice: string): Result | null;
  /** Its own card with what just happened on top, after a choice written as content that leads to no page of its own. */
  card?(state: GameState, place: Location, before: string[]): Card;
  /** Payday: reopen, or restock. */
  payday?(place: Location): Location;
  /** How much the bot wants to ride there now, or null if not at all. */
  worth(state: GameState, place: Location): number | null;
  /** What the bot does once it's there. */
  bot?(state: GameState, place: Location): GameState;
};
