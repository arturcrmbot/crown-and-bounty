/** The rules in one place: state, places, days, fights and the hero, plus `apply` for anything a card can do. */
import { chooseBoon, nextCommission, retry, toCourt } from './campaign';
import { endDay } from './days';
import { fight, startFight } from './fight';
import { equip, gearCard, learn } from './hero';
import { parley } from './parley';
import { armouryCard, buy, dig, openChest, recruit } from './places';
import { chooseBackground } from './scenario';
import { locationById, show, type Action, type GameState, type Result } from './state';

export * from './state';
export { armouryCard, buy, describe, describeHero, DISCOVERY_XP, openChest, priceOf, recruit, recruitable, visit } from './places';
export { endDay } from './days';
export { briefingCard, CAMPAIGN_LENGTH, campaignLines, chooseBoon, commissionAt, commissionOf, courtCard, hasNextCommission, nextArmy, nextCommission, provinceOf, retry, toCourt, veterans, VETERANS } from './campaign';
export { beginCommission, chooseBackground, newGame } from './scenario';
export { battleXp, fight, finishFight, heroInBattle, lossesLine, startFight, winChance } from './fight';
export { equip, gainXp, gearCard, giveArtifact, heroStats, learn, levelFor, levelUpCard, LEVELS } from './hero';

/** Applies a card choice. `go`, `close`, `restart`, `spell` and `retreat` are for the screens, so they return null here. */
export function apply(state: GameState, action: Action): Result | null {
  switch (action.type) {
    case 'chest':
      return openChest(state, action.id, action.take);
    case 'recruit':
      return recruit(state, action.id);
    case 'fight':
      return startFight(state, action.id);
    case 'autofight':
      return fight(state, action.id);
    case 'endDay':
      // Once a commission is won or lost, no more days pass: the next step is court, or trying again.
      return state.over ? null : endDay(state);
    case 'learn':
      return learn(state, action.option);
    case 'equip':
      return equip(state, action.artifact);
    case 'gear':
      return { state, events: [show(gearCard(state))] };
    case 'armoury':
      return { state, events: [show(armouryCard(state, action.id), locationById(state, action.id).at, action.id)] };
    case 'buy':
      return buy(state, action.id, action.artifact);
    case 'background':
      return { state: chooseBackground(state, action.id), events: [] };
    case 'parley':
      return parley(state, action.id, action.parley);
    case 'dig':
      return dig(state, action.id);
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
