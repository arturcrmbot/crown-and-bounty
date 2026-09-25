/** The rules in one place: state, places, days, fights and the hero, plus `apply` for anything a card can do. */
import { endDay } from './days';
import { fight, startFight } from './fight';
import { equip, gearCard, learn } from './hero';
import { armouryCard, buy, openChest, recruit } from './places';
import { chooseBackground } from './scenario';
import { locationById, show, type Action, type GameState, type Result } from './state';

export * from './state';
export { armouryCard, buy, describe, describeHero, DISCOVERY_XP, openChest, priceOf, recruit, recruitable, visit } from './places';
export { endDay } from './days';
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
      return endDay(state);
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
    default:
      return null;
  }
}
