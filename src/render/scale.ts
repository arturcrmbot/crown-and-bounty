/**
 * The scale bible, in code, so every sprite agrees. Troops are Battle for Wesnoth's units, whose
 * people stand about 43 px tall in their 72 px frames.
 * - In battle they are drawn at `BATTLE_UNIT`: a person about 65 px tall, most of two hex rows as
 *   in HoMM2. Goblins come out about 45 px, trolls 80, mounted knights 105 with the lance.
 * - On the map, one creature stands for a whole stack at `MAP_UNIT`: a person about 39 px on 32 px
 *   tiles, brightened a touch (`MAP_LIFT`) and inked round, as HoMM2's map creatures are bright.
 * - The hero rides at `MAP_HERO`, Wesnoth's own size (about 64 px on his horse, the pennant in our
 *   blue): the easiest thing to find on the map.
 * - Each unit keeps the size Wesnoth gave it next to a person, on the map and in battle alike, but
 *   the villains stand a quarter taller (`VILLAIN`), so the one you came for reads at a glance.
 */
import type { ArtId } from './units';

export const TILE = 32;
export const BATTLE_UNIT = 1.5;
export const MAP_UNIT = 0.9;
export const MAP_HERO = 1;
export const MAP_LIFT = 1;
export const VILLAIN = 1.25;
const VILLAINS: ReadonlySet<ArtId> = new Set(['baron', 'witch', 'bramble']);

export type Size = 'battle' | 'map';
/** The scale a unit is drawn at. */
export const unitScale = (size: Size, id: ArtId) => (VILLAINS.has(id) ? VILLAIN : 1) * (size === 'battle' ? BATTLE_UNIT : id === 'hero' ? MAP_HERO : MAP_UNIT);
/** How much brighter and more vivid units are drawn at each size (see `brighten` in wesnoth.ts). */
export const unitLift = (size: Size) => (size === 'battle' ? 0 : MAP_LIFT);
