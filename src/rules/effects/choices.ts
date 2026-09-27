/**
 * Choices written as content. A choice says what it needs (who the hero is, what he knows, what has
 * happened) and what it costs (gold, troops, mana), and lists what it does as data. This is the
 * one place that turns those words into state, so quests, shrines, parleys and events need no code.
 */
import { beat } from '../fight';
import { close, locationById, show, type Card, type Choice, type ContentChoice, type GameState, type Location, type Page, type Result } from '../state';
import { applyEffects, meets, needsLabel, pay } from './core';

export { applyEffects, meets, needsLabel } from './core';

/** A content choice as a button: greyed out, with what it needs, when the hero can't take it. */
export function choiceButton(state: GameState, place: Location, choice: ContentChoice, key: string): Choice {
  return {
    label: `${choice.label}${needsLabel(choice.needs)}`,
    action: { type: 'choose', id: place.id, choice: key },
    ...(meets(state, choice.needs) ? {} : { disabled: true }),
  };
}

/** The first of a place's content pages that holds now. */
export const firstPage = (state: GameState, place: Location): Page | undefined => place.pages?.find((p) => !p.answer && meets(state, p.when));

/** A content page as a card. */
export function pageCard(state: GameState, place: Location, page: Page, before: string[] = []): Card {
  const choices = page.choices.map((c) => choiceButton(state, place, c, `${page.id}/${c.id}`));
  return { title: page.title ?? place.name, lines: [...before, ...page.lines], choices: choices.length ? choices : [close] };
}

/** Takes a content choice: checks and pays for it, does what it says, and shows what comes next. */
export function takeChoice(state: GameState, place: Location, choice: ContentChoice): Result | null {
  if (place.done && !place.pages?.length) return null;
  if (!meets(state, choice.needs)) return null;
  const effects = choice.effects ?? {};
  const paid = pay(state, choice.needs);
  if (effects.win) {
    const { gold: reward = 0, xp = 0, win: _, done: __, ...rest } = effects;
    const done = applyEffects(paid, place, rest);
    const won = beat(done.state, place.id, { title: place.name, lines: [...(choice.lines ?? []), ...done.lines], reward, xp, sayGold: true });
    return { state: won.state, events: [...done.events, ...won.events] };
  }
  const done = applyEffects(paid, place, effects);
  const after = locationById(done.state, place.id);
  const lines = [...(choice.lines ?? []), ...done.lines];
  const page = effects.page ? after.pages?.find((p) => p.id === effects.page) : undefined;
  const card = page ? pageCard(done.state, after, page, lines) : { title: place.name, lines, choices: [close] };
  return { state: done.state, events: [...done.events, show(card, place.at, place.id)] };
}
