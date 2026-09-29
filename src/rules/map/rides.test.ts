import { describe, expect, it } from 'vitest';
import { ALDMOOR, LANDS, landOf, type Land } from '../../content/aldmoor';
import { FINDS } from '../../content/aldmoorFinds';
import { MOVEMENT_PER_DAY } from '../state';
import { buildMap, CELL } from './model';
import { nearestPassable, reachFrom } from './pathfinding';
import { measureRides, type Gap } from './rides';

const rides = measureRides(buildMap(ALDMOOR), ALDMOOR.locations.filter((l) => !l.done));
/** The longest ride between two things through a gap, in days: from the last thing to it, and on to the next. */
const days = (gap: Gap) => (2 * gap.cost) / MOVEMENT_PER_DAY;
const lands = Object.keys(LANDS) as Land[];

describe('Aldmoor\u2019s rides (#124): something worth stopping for is never far', () => {
  it('in every land, no ride between things is a day long', () => {
    for (const land of lands) {
      const gap = rides.gap((at) => landOf(at) === land);
      expect(gap, land).not.toBeNull();
      expect(days(gap!), `${LANDS[land]}, at ${gap!.at} near ${gap!.nearest}`).toBeLessThan(1);
    }
  });

  it('along the roads, there is something about every half day', () => {
    const gap = rides.gap((_, road) => road)!;
    expect(days(gap), `at ${gap.at} near ${gap.nearest}`).toBeLessThanOrEqual(0.6);
  });

  it('every land has small finds of its own, and none of them stands on another place', () => {
    for (const land of lands) expect(FINDS.filter((f) => landOf(f.at) === land).length, LANDS[land]).toBeGreaterThanOrEqual(2);
    for (const find of FINDS) {
      for (const other of ALDMOOR.locations) {
        if (other !== find) expect(Math.hypot(other.at[0] - find.at[0], other.at[1] - find.at[1]), `${find.id} and ${other.id}`).toBeGreaterThan(90);
      }
    }
  });

  it('between two things alone, the longest ride is the ride from one to the other', () => {
    const map = buildMap(ALDMOOR);
    const cell = ([x, y]: readonly number[]) => nearestPassable(map.grid, { x: Math.floor(x / CELL), y: Math.floor(y / CELL) }, 16)!;
    // Over the ford, the long way round from the castle to the old mine.
    const [castle, mine] = [ALDMOOR.locations.find((l) => l.id === 'castle')!.at, ALDMOOR.locations.find((l) => l.id === 'mine')!.at];
    const [from, to] = [cell(castle), cell(mine)];
    const ride = reachFrom(map.grid, from).g[to.y * map.width + to.x];
    const gap = measureRides(map, [{ id: 'castle', at: castle }, { id: 'mine', at: mine }]).gap(() => true)!;
    expect(ride).toBeGreaterThan(MOVEMENT_PER_DAY);
    expect(2 * gap.cost).toBeGreaterThan(ride - 3);
    expect(2 * gap.cost).toBeLessThanOrEqual(ride);
  });
});
