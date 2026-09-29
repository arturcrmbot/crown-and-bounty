import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../content/aldmoor';
import { FENMARCH } from '../content/fenmarch';
import type { Province } from '../content/types';
import { commissionAt } from '../rules/campaign';
import type { Location } from '../rules/game';
import { revealDisc } from '../rules/map/fog';
import type { Point } from '../rules/map/geometry';
import { buildMap } from '../rules/map/model';
import { newGame } from '../rules/scenario';
import { Bitmap } from './bitmap';
import { FogMask } from './fog';
import { MINIMAP, SCREEN } from './frame';
import { marksOf, Minimap, MINIMAP_COLOURS as C, type Fog } from './minimap';
import { FOG_LUT, GOLD, INK, PLUM } from './palette';
import { TerrainPainter } from './terrain';

const CLEAR: Fog = { isFogged: () => false };
const GENERATED = [2, 3, 4].map((chapter) => commissionAt({ seed: 1066 }, chapter).province);

function minimapOf(province: Province, fog: Fog = CLEAR) {
  const map = buildMap(province);
  return new Minimap(map, new TerrainPainter(map), fog, MINIMAP);
}

/** Its button, in its top right corner. */
const BUTTON = 15;

/** The minimap painted and laid onto a blank screen, with the hero and the view tucked into its top left corner. */
function painted(minimap: Minimap, locations: readonly Location[] = []) {
  const screen = new Bitmap(SCREEN.width, SCREEN.height);
  // A new list of places, so it paints even if it painted the same a moment ago.
  minimap.paint([...locations], [0, 0], { x: 0, y: 0, width: 1, height: 1 });
  minimap.draw(screen);
  const at = (x: number, y: number) => screen.get(MINIMAP.x + Math.floor(x * minimap.scale), MINIMAP.y + Math.floor(y * minimap.scale));
  /** Every pixel of the minimap, but the corner under the hero and the view, and the one under its button. */
  const pixels = () => {
    const out: number[] = [];
    for (let y = 0; y < minimap.height; y++) for (let x = 0; x < minimap.width; x++) if ((x > 4 || y > 4) && (x < minimap.width - BUTTON || y >= BUTTON)) out.push(screen.get(MINIMAP.x + x, MINIMAP.y + y));
    return out;
  };
  /** How many pixels within `r` map pixels of a point are one of `colours`. */
  const around = ([cx, cy]: Point, r: number, colours: readonly number[]) => {
    let n = 0;
    for (let y = cy - r; y <= cy + r; y += 1 / minimap.scale) for (let x = cx - r; x <= cx + r; x += 1 / minimap.scale) if (colours.includes(at(x, y))) n++;
    return n;
  };
  return { screen, at, pixels, around };
}

const count = (pixels: number[], colours: readonly number[]) => pixels.filter((p) => colours.includes(p)).length;
const woods = [...C.pine, ...C.oak, ...C.willow];

describe('the minimap', () => {
  it('fits every province into the corner: Aldmoor at a pixel for every 20 paces, the smaller ones at four pixels a tile', () => {
    const aldmoor = minimapOf(ALDMOOR);
    expect([aldmoor.width, aldmoor.height, aldmoor.scale]).toEqual([160, 120, 1 / 20]);
    for (const province of [FENMARCH, ...GENERATED]) {
      const m = minimapOf(province);
      expect([m.width, m.height, m.scale * 32], province.id).toEqual([160, 120, 4]);
    }
  });

  it('paints Aldmoor in its regions\u2019 colours: the river, the roads, the crossings, Darkwood\u2019s pines, the chase\u2019s oaks, the heather and the crags', () => {
    const { at, pixels, around } = painted(minimapOf(ALDMOOR));
    expect(at(1632, 1200)).toBe(C.river);
    expect(at(1456, 2080)).toBe(C.river);
    const all = pixels();
    expect(count(all, [C.road])).toBeGreaterThan(300);
    expect(count(all, [C.bridge])).toBeGreaterThan(0);
    expect(count(all, [C.ford])).toBeGreaterThan(0);
    expect(count(all, C.mountain)).toBeGreaterThan(100);
    expect(around([560, 2130], 160, C.pine)).toBeGreaterThan(around([560, 2130], 160, C.oak) * 5);
    expect(around([2700, 2190], 160, C.oak)).toBeGreaterThan(around([2700, 2190], 160, C.pine));
    expect(around([800, 900], 240, PLUM)).toBeGreaterThan(20);
  });

  it('paints the Fenmarch\u2019s pools, and every generated province with its river, roads and woods', () => {
    expect(count(painted(minimapOf(FENMARCH)).pixels(), [C.pool])).toBeGreaterThan(500);
    for (const province of GENERATED) {
      const all = painted(minimapOf(province)).pixels();
      expect(count(all, [C.river]), province.id).toBeGreaterThan(50);
      expect(count(all, [C.road]), province.id).toBeGreaterThan(50);
      expect(count(all, woods), province.id).toBeGreaterThan(200);
    }
  });

  it('lays the fog wherever the hero hasn\u2019t been: the land in the fog\u2019s colours, and no roads', () => {
    const state = newGame(1066);
    const fog = new FogMask(ALDMOOR.width, ALDMOOR.height, state.explored);
    const clear = painted(minimapOf(ALDMOOR)).pixels();
    const misty = painted(minimapOf(ALDMOOR, fog)).pixels();
    let fogged = 0;
    for (let i = 0; i < clear.length; i++) {
      if (misty[i] === clear[i]) continue;
      fogged++;
      // Under the fog a road is only the land it runs over, and a bridge the water under it.
      if (clear[i] !== C.road && clear[i] !== C.bridge) expect(misty[i]).toBe(FOG_LUT[clear[i]]);
    }
    expect(fogged).toBeGreaterThan(clear.length * 0.8);
    expect(count(misty, [C.road])).toBeLessThan(count(clear, [C.road]) * 0.2);
    // Round the start, where he has been, the land is as clear as it is.
    const { around } = painted(minimapOf(ALDMOOR, fog));
    expect(around(ALDMOOR.hero, 40, [C.road])).toBeGreaterThan(0);
  });

  it('lifts the fog where the hero has just seen, and only there', () => {
    const state = newGame(1066);
    const fog = new FogMask(ALDMOOR.width, ALDMOOR.height, state.explored);
    const minimap = minimapOf(ALDMOOR, fog);
    const far: Point = [1632, 1200];
    const before = painted(minimap).pixels();
    expect(painted(minimap).at(...far)).toBe(FOG_LUT[C.river]);
    const seen = revealDisc(state.explored, state.world, far[0], far[1], 120).bits;
    fog.reveal(seen, far[0], far[1], 120);
    minimap.refog({ at: far, radius: 120 });
    const after = painted(minimap);
    expect(after.at(...far)).toBe(C.river);
    // Round what he saw, and nothing further off: 120 paces each way is 6 of its pixels.
    const changed = after.pixels().filter((p, i) => p !== before[i]).length;
    expect(changed).toBeGreaterThan(60);
    expect(changed).toBeLessThan(450);
  });

  it('marks the places found and the enemies in sight, and nothing under the fog', () => {
    const state = newGame(1066);
    const fog = new FogMask(ALDMOOR.width, ALDMOOR.height, state.explored);
    const marks = marksOf(state.locations, fog);
    expect(marks.length).toBeGreaterThan(0);
    for (const m of marks) expect(fog.isFogged(m.at[0], m.at[1] - 2), m.id).toBe(false);
    for (const l of state.locations) if (!fog.isFogged(l.at[0], l.at[1] - 2)) expect(marks.map((m) => m.id), l.id).toContain(l.id);
    expect(marks.map((m) => m.id)).not.toContain('hideout');
    // With the mist lifted: the King's castle, the villain's lair, the bands on the roads, and the treasure.
    const kinds = Object.fromEntries(marksOf(state.locations, CLEAR).map((m) => [m.id, m.kind]));
    expect(kinds).toMatchObject({ castle: 'town', village: 'town', hideout: 'villain', patrol: 'foe', wolves: 'foe', chest: 'treasure', gold: 'treasure' });
    // What's used up and gone from the map is gone from the minimap; a used place turns grey.
    const used = state.locations.map((l) => (l.id === 'chest' || l.id === 'tower' || l.id === 'patrol' ? { ...l, done: true } : l));
    const after = Object.fromEntries(marksOf(used, CLEAR).map((m) => [m.id, m.kind]));
    expect(after.chest).toBeUndefined();
    expect(after.patrol).toBeUndefined();
    expect(after.tower).toBe('spent');
    // When he rides out, the villain is marked where he rides, and his lair as his men's.
    const lair = state.locations.find((l) => l.id === 'hideout')!;
    const band: Location = { id: 'grimsbyRides', kind: 'patrol', name: 'Baron Grimsby', at: [2000, 1300], done: false, enemy: { ...lair.enemy!, lair: 'hideout' } };
    const riding = Object.fromEntries(marksOf([...state.locations, band], CLEAR).map((m) => [m.id, m.kind]));
    expect(riding).toMatchObject({ grimsbyRides: 'villain', hideout: 'foe' });
    // A band that moved out of the hero's sight isn't marked, however clear the land it's on: nobody knows where it is.
    const lost = state.locations.map((l) => (l.id === 'wolves' || l.id === 'poachers' ? { ...l, enemy: { ...l.enemy!, unseen: true } } : l));
    const known = marksOf(lost, CLEAR).map((m) => m.id);
    expect(known).not.toContain('wolves');
    expect(known).not.toContain('poachers');
    expect(known).toContain('patrol');
  });

  it('shows the marks, the hero on top of them and the view\u2019s frame, and paints again only when one of them moves', () => {
    const state = newGame(1066);
    const minimap = minimapOf(ALDMOOR);
    const screen = new Bitmap(SCREEN.width, SCREEN.height);
    const pixel = ([x, y]: Point) => screen.get(MINIMAP.x + Math.floor(x * minimap.scale), MINIMAP.y + Math.floor(y * minimap.scale));
    const castle = state.locations.find((l) => l.id === 'castle')!;
    const view = { x: 1200, y: 800, width: 928, height: 464 };
    expect(minimap.paint(state.locations, state.hero.at, view)).toBe(true);
    minimap.draw(screen);
    expect(pixel([castle.at[0], castle.at[1] - 4])).toBe(C.town);
    expect(pixel(state.hero.at)).toBe(C.heart);
    expect(pixel([state.hero.at[0] + 24, state.hero.at[1]])).toBe(C.hero);
    for (const corner of [[1200, 800], [2110, 800], [1200, 1250], [2110, 1250]] as Point[]) expect(pixel(corner)).toBe(C.view);
    expect(minimap.paint(state.locations, state.hero.at, view)).toBe(false);
    // Riding a pace or two is still the same pixel; a tile further on is not.
    const [hx, hy] = state.hero.at;
    const pace = Math.floor(hx * minimap.scale) === Math.floor((hx - 3) * minimap.scale) ? -3 : 3;
    expect(minimap.paint(state.locations, [hx + pace, hy], view)).toBe(false);
    expect(minimap.paint(state.locations, [hx - 32, hy], view)).toBe(true);
    expect(minimap.paint(state.locations, [hx - 32, hy], { ...view, x: 1300 })).toBe(true);
    expect(minimap.paint([...state.locations], [hx - 32, hy], { ...view, x: 1300 })).toBe(true);
    minimap.refog();
    expect(minimap.paint(state.locations, [hx - 32, hy], { ...view, x: 1300 })).toBe(true);
  });

  it('turns a press on it into a point of the map, and keeps a drag that runs off it on the map', () => {
    const minimap = minimapOf(ALDMOOR);
    expect(minimap.contains(MINIMAP.x, MINIMAP.y)).toBe(true);
    expect(minimap.contains(MINIMAP.x + 160, MINIMAP.y + 60)).toBe(false);
    expect(minimap.contains(MINIMAP.x - 1, MINIMAP.y + 10)).toBe(false);
    expect(minimap.toMap(MINIMAP.x + 80, MINIMAP.y + 60)).toEqual([1610, 1210]);
    expect(minimap.toMap(MINIMAP.x, MINIMAP.y)).toEqual([10, 10]);
    const [x, y] = minimap.toMap(MINIMAP.x - 60, MINIMAP.y + 400);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThan(16);
    expect(y).toBeLessThanOrEqual(ALDMOOR.height);
    expect(y).toBeGreaterThan(ALDMOOR.height - 16);
  });

  it('lies over the view in its moulding, with its button in the corner, and folds away into the button alone', () => {
    const state = newGame(1066);
    const minimap = minimapOf(ALDMOOR);
    const corner = { x: MINIMAP.x + MINIMAP.width - 8, y: MINIMAP.y + 7 };
    minimap.paint(state.locations, state.hero.at, { x: 0, y: 0, width: 928, height: 464 });
    const out = new Bitmap(SCREEN.width, SCREEN.height);
    minimap.draw(out);
    // Ink just outside it, then gold; the land inside; the button's ink edge in its corner.
    expect(out.get(MINIMAP.x - 1, MINIMAP.y + 60)).toBe(INK);
    expect(GOLD).toContain(out.get(MINIMAP.x - 3, MINIMAP.y + 60));
    expect(out.get(MINIMAP.x + 40, MINIMAP.y + 60)).not.toBe(0);
    expect(out.get(MINIMAP.x + MINIMAP.width - BUTTON, MINIMAP.y + 7)).toBe(INK);
    expect(minimap.onButton(corner.x, corner.y)).toBe(true);
    expect(minimap.contains(corner.x, corner.y)).toBe(false);
    expect(minimap.onButton(MINIMAP.x + 40, MINIMAP.y + 60)).toBe(false);
    // Folded away: only the button in its own moulding, and the map shows through where the minimap was.
    minimap.shown = false;
    const folded = new Bitmap(SCREEN.width, SCREEN.height);
    minimap.draw(folded);
    expect(folded.get(MINIMAP.x + 40, MINIMAP.y + 60)).toBe(0);
    expect(folded.get(MINIMAP.x + MINIMAP.width - BUTTON - 1, MINIMAP.y + 7)).toBe(INK);
    expect(GOLD).toContain(folded.get(MINIMAP.x + MINIMAP.width - BUTTON - 3, MINIMAP.y + 7));
    expect(folded.get(corner.x, corner.y)).not.toBe(0);
    expect(minimap.contains(MINIMAP.x + 40, MINIMAP.y + 60)).toBe(false);
    expect(minimap.onButton(corner.x, corner.y)).toBe(true);
    // The button lights up under the pointer.
    minimap.lit = true;
    const lit = new Bitmap(SCREEN.width, SCREEN.height);
    minimap.draw(lit);
    expect(lit.get(MINIMAP.x + MINIMAP.width - BUTTON + 1, MINIMAP.y + 7)).not.toBe(folded.get(MINIMAP.x + MINIMAP.width - BUTTON + 1, MINIMAP.y + 7));
  });

  it('only reads the rules state, never changes it', () => {
    const state = newGame(1066);
    const before = JSON.stringify(state);
    const frozen = deepFreeze(structuredClone(state));
    const fog = new FogMask(ALDMOOR.width, ALDMOOR.height, frozen.explored);
    const minimap = minimapOf(ALDMOOR, fog);
    minimap.paint(frozen.locations, frozen.hero.at, { x: 0, y: 0, width: 928, height: 464 });
    minimap.draw(new Bitmap(SCREEN.width, SCREEN.height));
    minimap.markAt(MINIMAP.x + 10, MINIMAP.y + 10);
    expect(JSON.stringify(frozen)).toBe(before);
  });

  it('is worked out once in a blink, and costs next to nothing to paint again', () => {
    const map = buildMap(ALDMOOR);
    const painter = new TerrainPainter(map);
    const start = performance.now();
    const minimap = new Minimap(map, painter, CLEAR, MINIMAP);
    expect(performance.now() - start).toBeLessThan(1000);
    const state = newGame(1066);
    const screen = new Bitmap(SCREEN.width, SCREEN.height);
    const again = performance.now();
    for (let i = 0; i < 200; i++) {
      minimap.paint(state.locations, [100 + i * 16, 1000], { x: i * 16, y: 800, width: 928, height: 464 });
      minimap.draw(screen);
    }
    expect((performance.now() - again) / 200).toBeLessThan(2);
  });
});

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}
