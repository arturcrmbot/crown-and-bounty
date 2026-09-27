import type { TroopId } from '../content/troops';

/**
 * The scale bible, in code, so every sprite agrees:
 * - The map's tiles are 32 px. A mounted hero stands about 57 px tall, a person on foot about 34.
 * - In battle a person stands about 60 px tall.
 * - Each creature has one size relative to a person, and that size holds on the map and in battle.
 * Figures are drawn 44 units tall at scale 1, so the scales below make those heights.
 */
export const TILE = 32;
export const MAP_PERSON = 0.78;
export const BATTLE_PERSON = 1.36;

/** Each troop's size next to a person. */
export const SIZE: Record<TroopId, number> = {
  peasants: 0.95,
  archers: 0.97,
  knights: 1.06,
  swordsmen: 1,
  crossbowmen: 0.97,
  wolves: 1,
  baron: 1.25,
  goblins: 0.76,
  trolls: 1.42,
  witch: 1.1,
  bramble: 1.2,
};

export const battleScale = (troop: TroopId) => BATTLE_PERSON * SIZE[troop];
export const mapScale = (troop: TroopId) => MAP_PERSON * SIZE[troop];
