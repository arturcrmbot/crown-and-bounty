import type { Location } from '../rules/game';
import type { Point } from '../rules/map/geometry';

/** A decorative object that belongs to a place: clicking it counts as clicking the place. */
export type Decor = { sprite: 'hut'; at: Point; place: string; seed: number };

/** Everything that defines a hand-made province: its land, its places and where the hero starts. */
export type Province = {
  id: string;
  name: string;
  /** Map size in pixels. */
  width: number;
  height: number;
  /** River control points, north to south. */
  river: Point[];
  /** A south-facing rock step, left to right, and its face height in pixels. */
  cliff: { line: Point[]; height: number } | null;
  paths: Point[][];
  /** Forest masses as ellipses: centre x, centre y, radius x, radius y. */
  forests: [number, number, number, number][];
  /** Rock outcrops: x, foot y, width, height. */
  crags: [number, number, number, number][];
  /** Lone trees placed on purpose: x, y, pine or not. */
  trees: [number, number, boolean][];
  /** Boulders placed on purpose: x, y, size. */
  rocks: [number, number, number][];
  decor: Decor[];
  hero: Point;
  /** Land the hero has seen at the start: along trails, and discs (x, y, radius). */
  explored: { trails: Point[][]; trailRadius: number; discs: [number, number, number][] };
  locations: Location[];
};
