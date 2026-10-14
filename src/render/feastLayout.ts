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
export const FEAST_FIRE = { x: 652, y: 354 } as const;
export const FEAST_FLAME = { x: 652, y: 298 } as const;
/** Where the sky meets the trees, and the moon. */
export const FEAST_HORIZON = 176;
export const FEAST_MOON = { x: 816, y: 74 } as const;
/** How many of his stacks sit at the feast, the biggest first. */
export const FEAST_STACKS = 3;

/**
 * Something at the feast, standing with its feet at `x, y`: a feast piece, a map piece (a log pile, a tuft), or a troop
 * with no feast figure of its own, which comes in its battle figure. `flip` turns it to face the other way (every
 * piece faces right as drawn), and `dances` jigs.
 */
export type FeastSpot = (
  | { feast: FeastPieceName; x: number; y: number; flip?: boolean; dances?: boolean }
  | { map: PieceName; x: number; y: number }
  | { battle: TroopId; x: number; y: number; flip?: boolean }
) & { scale?: number };

const HERO_SPOT: Record<BackgroundId, { x: number; y: number }> = {
  knight: { x: 574, y: 326 },
  wizard: { x: 570, y: 322 },
  ranger: { x: 568, y: 328 },
  courtier: { x: 570, y: 330 },
};
const HERO_PIECE: Record<BackgroundId, FeastPieceName> = { knight: 'heroKnight', wizard: 'heroWizard', ranger: 'heroRanger', courtier: 'heroCourtier' };
/** Where his stacks sit, biggest first: in front of the fire on the left, across it on the right, and dancing in front. */
const SLOTS = [
  { x: 558, y: 418, flip: false },
  { x: 754, y: 394, flip: true },
  { x: 848, y: 426, flip: true },
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
export function feastLayout(background: BackgroundId, army: Army, touching = false): FeastSpot[] {
  const shift = touching ? 64 : 0;
  const spots: FeastSpot[] = [
    { feast: 'tent', x: 120, y: 230, flip: true },
    { feast: 'tent', x: 278, y: 242 },
    { feast: 'tent', x: 462, y: 244, flip: true, scale: 1.2 },
    { feast: 'banner', x: 472 + shift, y: 290, scale: 1.2 },
    { feast: 'barrel', x: 774 + shift / 2, y: 298, scale: 1.2 },
    { feast: 'fire', x: FEAST_FIRE.x + shift, y: FEAST_FIRE.y, scale: 1.3 },
    { feast: 'chest', x: 656 + shift, y: 434, scale: 1.2 },
    { feast: 'food', x: 742 + shift / 2, y: 444, scale: 1.2 },
    { map: 'logs', x: 512 + shift, y: 432 },
    { map: 'logPile', x: 898, y: 352 },
    { map: 'decor24', x: 908, y: 442 },
    { map: 'decor18', x: 424, y: 448 },
    { map: 'decor5', x: 364, y: 394 },
    { map: 'decor15', x: 864, y: 374 },
    { map: 'decor3', x: 338, y: 346 },
  ];
  const stacks = feastStacks(army);
  // The Knight's white horse, and the knights' bay, graze at the edge of the light.
  if (background === 'knight') spots.push({ feast: 'horseWhite', x: 780, y: 232, flip: true });
  if (army.some((s) => s.troop === 'knights' && s.count > 0)) spots.push({ feast: 'horseBrown', x: 874, y: 252 });
  const hero = HERO_SPOT[background];
  spots.push({ feast: HERO_PIECE[background], x: hero.x + shift, y: hero.y, scale: 1.55 });
  stacks.forEach((troop, i) => {
    const slot = SLOTS[i];
    const x = slot.x + (i === 0 ? shift : i === 1 ? shift / 2 : 0);
    const { y, flip } = slot;
    spots.push(feasts(troop) ? { feast: troop, x, y, flip, scale: 1.3, dances: troop === 'peasants' } : { battle: troop, x, y, flip, scale: 1.3 });
  });
  return spots.sort((a, b) => a.y - b.y);
}
