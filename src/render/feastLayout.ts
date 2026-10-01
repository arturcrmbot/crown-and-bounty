import type { BackgroundId } from '../content/backgrounds';
import { troopPower, type TroopId } from '../content/troops';
import type { Army } from '../rules/state';
import { FEAST_PIECES, type FeastPieceName, type PieceName } from './mapPieces';

/**
 * Who sits where at the payday feast (#191), in the view's pixels (928 by 464, the map view's size): the fire and its
 * roast, Aldric in his background's own figure, one of his troops for each of his biggest stacks, and the camp round
 * them. The left third of the view stays quiet, because the payday card stands there.
 */

/** Where the fire stands (the foot of its stones), and where its light comes from. */
export const FEAST_FIRE = { x: 600, y: 362 } as const;
export const FEAST_FLAME = { x: 600, y: 318 } as const;
/** Where the sky meets the trees, and the moon. */
export const FEAST_HORIZON = 214;
export const FEAST_MOON = { x: 810, y: 112 } as const;
/** How many of his stacks sit at the feast, the biggest first. */
export const FEAST_STACKS = 3;

/**
 * Something at the feast, standing with its feet at `x, y`: a feast piece, a map piece (a log pile, a tuft), or a troop
 * with no feast figure of its own, which comes in its battle figure. `flip` turns it to face the other way (every
 * piece faces right as drawn), and `dances` jigs.
 */
export type FeastSpot =
  | { feast: FeastPieceName; x: number; y: number; flip?: boolean; dances?: boolean }
  | { map: PieceName; x: number; y: number }
  | { battle: TroopId; x: number; y: number; flip?: boolean };

const HERO_SPOT: Record<BackgroundId, { x: number; y: number }> = {
  knight: { x: 528, y: 334 },
  wizard: { x: 524, y: 330 },
  ranger: { x: 520, y: 336 },
  courtier: { x: 524, y: 340 },
};
const HERO_PIECE: Record<BackgroundId, FeastPieceName> = { knight: 'heroKnight', wizard: 'heroWizard', ranger: 'heroRanger', courtier: 'heroCourtier' };
/** Where his stacks sit, biggest first: in front of the fire on the left, across it on the right, and dancing in front. */
const SLOTS = [
  { x: 500, y: 396, flip: false },
  { x: 694, y: 388, flip: true },
  { x: 750, y: 432, flip: false },
] as const;

/** Whether a troop has a figure of its own at the feast. */
export const feasts = (troop: TroopId): troop is TroopId & FeastPieceName => (FEAST_PIECES as readonly string[]).includes(troop);

/** His stacks at the feast: the biggest, by what each is worth in a fight. */
export function feastStacks(army: Army): TroopId[] {
  return [...army]
    .filter((s) => s.count > 0)
    .sort((a, b) => troopPower(b.troop) * b.count - troopPower(a.troop) * a.count)
    .slice(0, FEAST_STACKS)
    .map((s) => s.troop);
}

/** Everything at the feast for a hero and his army, back to front. */
export function feastLayout(background: BackgroundId, army: Army): FeastSpot[] {
  const spots: FeastSpot[] = [
    { feast: 'tent', x: 160, y: 270, flip: true },
    { feast: 'tent', x: 270, y: 292 },
    { feast: 'tent', x: 372, y: 284, flip: true },
    { feast: 'banner', x: 446, y: 312 },
    { feast: 'barrel', x: 712, y: 326 },
    { feast: 'fire', x: FEAST_FIRE.x, y: FEAST_FIRE.y },
    { feast: 'chest', x: 570, y: 428 },
    { feast: 'food', x: 650, y: 438 },
    { map: 'logs', x: 470, y: 410 },
    { map: 'logPile', x: 790, y: 404 },
    { map: 'decor24', x: 900, y: 440 },
    { map: 'decor18', x: 420, y: 448 },
    { map: 'decor5', x: 360, y: 400 },
    { map: 'decor15', x: 860, y: 372 },
    { map: 'decor3', x: 330, y: 360 },
  ];
  const stacks = feastStacks(army);
  // The Knight's white horse, and the knights' bay, graze at the edge of the light.
  if (background === 'knight') spots.push({ feast: 'horseWhite', x: 806, y: 306, flip: true });
  if (army.some((s) => s.troop === 'knights' && s.count > 0)) spots.push({ feast: 'horseBrown', x: 872, y: 290 });
  spots.push({ feast: HERO_PIECE[background], ...HERO_SPOT[background] });
  stacks.forEach((troop, i) => {
    const { x, y, flip } = SLOTS[i];
    spots.push(feasts(troop) ? { feast: troop, x, y, flip, dances: troop === 'peasants' } : { battle: troop, x, y, flip });
  });
  return spots.sort((a, b) => a.y - b.y);
}
