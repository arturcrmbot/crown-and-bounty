/** The rules in one place: state, places, days, fights and the hero, plus `apply` for anything a card can do. */
import { chooseBoon, nextCommission, retry, toCourt } from './campaign';
import { dismiss, moveStack } from './army';
import { endDay } from './days';
import { equip, learn, movePack, unequip, wear } from './hero';
import { castMapSpell } from './mapSpells';
import { choose } from './places';
import { chooseBackground } from './scenario';
import type { Action, GameState, Result } from './state';

export * from './state';
export { choose, describe, DISCOVERY_XP, forceLine, payday, PLACE_KINDS, priceOf, recruitable, visit, type PlaceKind } from './places';
export { barNote, bountyCard, heroSheet, journalCard, leaderSheet, leaderTraits, manaNote, mapPieces, placeNote, SLOT_NAMES, stackSheet, whenThere, type BarItem, type HeroSheet, type LeaderSheet, type Note, type StackSheet } from './heroSheet';
export { meets, needsLabel } from './effects';
export { ambushCard, endDay } from './days';
export { bountyOf, briefingCard, CAMPAIGN_LENGTH, campaignLines, chooseBoon, commissionAt, commissionOf, companyLine, courtCard, friendsOf, happened, hasNextCommission, heardOf, memoriesOf, nextArmy, nextCommission, provinceOf, retry, speechCard, toCourt, veterans, VETERANS } from './campaign';
export { beginCommission, chooseBackground, newGame } from './scenario';
export { battleXp, fight, finishFight, heroFighter, heroInBattle, lossesLine, manaLine, startFight, winChance, type HeroFighter } from './fight';
export { equip, gainXp, giveArtifact, heroStats, learn, levelFor, levelUpCard, LEVELS, movePack, unequip, wear } from './hero';
export { dismiss, moveStack } from './army';

/** Applies a card choice. `go`, `close`, `restart`, `spell` and `retreat` are for the screens, so they return null here. */
export function apply(state: GameState, action: Action): Result | null {
  switch (action.type) {
    case 'choose':
      return choose(state, action.id, action.choice);
    case 'endDay':
      // Once a commission is won or lost, no more days pass: the next step is court, or trying again.
      return state.over ? null : endDay(state);
    case 'learn':
      return learn(state, action.option);
    case 'equip':
      return equip(state, action.artifact);
    case 'wear':
      return wear(state, action.from, action.slot);
    case 'unequip':
      return unequip(state, action.slot, action.to);
    case 'movePack':
      return movePack(state, action.from, action.to);
    case 'moveStack':
      return moveStack(state, action.from, action.to);
    case 'dismiss':
      return dismiss(state, action.index);
    case 'mapSpell':
      return castMapSpell(state, action.spell);
    case 'background':
      return { state: chooseBackground(state, action.id), events: [] };
    case 'hint':
      return { state: { ...state, flags: { ...state.flags, [`hint:${action.id}`]: true } }, events: [] };
    case 'court':
      return toCourt(state);
    case 'boon':
      return chooseBoon(state, action.id);
    case 'nextCommission':
      return nextCommission(state);
    case 'retry':
      return retry(state);
    default:
      return null;
  }
}
