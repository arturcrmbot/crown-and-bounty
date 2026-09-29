/**
 * Choices written as content. A choice says what it needs (who the hero is, what he knows, what has
 * happened) and what it costs (gold, troops, mana), and lists what it does as data. This is the
 * one place that turns those words into state, so quests, shrines, parleys and events need no code.
 */
import { ARTIFACTS } from '../../content/artifacts';
import { troopPower } from '../../content/troops';
import { beat } from '../fight';
import { artifactChoices, heroStats, knowsTrick } from '../hero';
import { close, leadershipUsed, locationById, show, TROOPS, type Card, type Choice, type ContentChoice, type GameState, type Location, type Page, type Result } from '../state';
import { applyEffects, meets, needsLabel, owns, pay } from './core';

export { applyEffects, meets, needsLabel, owns } from './core';

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

/** A content page as a card. Choices whose `when` doesn't hold aren't there. */
export function pageCard(state: GameState, place: Location, page: Page, before: string[] = []): Card {
  const choices = page.choices.filter((c) => meets(state, c.when)).map((c) => choiceButton(state, place, c, `${page.id}/${c.id}`));
  return { title: page.title ?? place.name, lines: [...before, ...page.lines], choices: choices.length ? choices : [close] };
}

/**
 * Takes a content choice: checks and pays for it, does what it says, and shows what comes next: the
 * page it leads to, or `then` (the place's own card, with what was said on top), or just the words.
 */
export function takeChoice(state: GameState, place: Location, choice: ContentChoice, then?: (state: GameState, place: Location, before: string[]) => Card): Result | null {
  if (place.done && !place.pages?.length) return null;
  if (!meets(state, choice.when) || !meets(state, choice.needs)) return null;
  const effects = choice.effects ?? {};
  const paid = pay(state, choice.needs);
  if (effects.win) {
    const { gold: reward = 0, xp = 0, win: _, done: __, ...rest } = effects;
    const done = applyEffects(paid, place, rest);
    const won = beat(done.state, place.id, { title: place.name, lines: [...(choice.lines ?? []), ...done.lines], reward, xp, sayGold: true, choices: rest.artifact ? artifactChoices(done.state, rest.artifact) : [] });
    return { state: won.state, events: [...done.events, ...won.events] };
  }
  const done = applyEffects(paid, place, effects);
  const after = locationById(done.state, place.id);
  const lines = [...(choice.lines ?? []), ...done.lines];
  const page = effects.page ? after.pages?.find((p) => p.id === effects.page) : undefined;
  // A choice with nothing to say, like "Not today", just closes the card.
  if (!page && !lines.length) return { state: done.state, events: done.events };
  const card = page ? pageCard(done.state, after, page, lines) : then ? then(done.state, after, lines) : { title: place.name, lines, choices: [close] };
  // Wear it or keep it: the decision replaces the way out.
  const decisions = effects.artifact ? artifactChoices(done.state, effects.artifact) : [];
  if (decisions.length) card.choices = [...decisions, ...card.choices.filter((c) => c.action.type !== 'close')];
  return { state: done.state, events: [...done.events, show(card, place.at, place.id)] };
}

/** The parts of a bonus that are a trick rather than a number. */
const TRICKS = new Set(['charge', 'volley', 'forestWalk', 'casts', 'mapSpells', 'bribes', 'hires', 'tames', 'slows']);

/**
 * A rough worth of a content choice, for the bot: gold as it is, gear, spells and troops by rule of
 * thumb, less what it costs. Story (flags, secrets, shortcuts) is worth little to a bot that never
 * takes a parley.
 */
export function choiceWorth(state: GameState, choice: ContentChoice): number {
  const e = choice.effects;
  if (!e) return 0;
  const s = heroStats(state);
  let worth = (e.gold ?? 0) + (e.treasure ?? 0) * (1 + s.loot) + (e.leadership ?? 0) * 12 + (e.movement ?? 0) + (e.mana ?? 0) * 2 + (e.xp ?? 0) * 0.5;
  worth += Object.values(e.stats ?? {}).reduce((sum, n) => sum + (n ?? 0), 0) * 150;
  if (e.artifact && !owns(state, e.artifact)) {
    const bonus = ARTIFACTS[e.artifact].bonus;
    // A relic whose trick he has already is worth only its numbers, if it has any.
    worth += !knowsTrick(state, bonus) ? 400 : Object.keys(bonus).some((k) => !TRICKS.has(k)) ? 150 : 0;
  }
  if (e.spell && !state.hero.spells.includes(e.spell)) worth += 400;
  let room = s.leadership - leadershipUsed(state.army);
  for (const stack of e.troops ?? []) {
    const count = Math.max(0, Math.min(stack.count, Math.floor(room / TROOPS[stack.troop].leadership)));
    room -= count * TROOPS[stack.troop].leadership;
    worth += count * troopPower(stack.troop) * 3;
  }
  // Troops waiting at a place are worth nearly what troops who join are: it's only a ride.
  if (e.recruits?.troop && !e.recruits.at) {
    const count = Math.max(0, Math.min(e.recruits.count, Math.floor(room / TROOPS[e.recruits.troop].leadership)));
    worth += count * troopPower(e.recruits.troop) * (e.recruits.price ? 1 : 3);
  }
  if (e.reveal) worth += 20;
  if (e.flags) worth += 20;
  return worth - (choice.needs?.gold ?? 0) - (choice.needs?.mana ?? 0) * 2;
}

/** The choice a bot takes on the page that holds now: the one it can take that is worth most, if any is worth anything. */
export function bestChoice(state: GameState, place: Location): { choice: ContentChoice; worth: number } | null {
  let best: { choice: ContentChoice; worth: number } | null = null;
  for (const choice of firstPage(state, place)?.choices ?? []) {
    if (!choice.effects || !meets(state, choice.when) || !meets(state, choice.needs)) continue;
    const worth = choiceWorth(state, choice);
    if (worth > 0 && (!best || worth > best.worth)) best = { choice, worth };
  }
  return best;
}
