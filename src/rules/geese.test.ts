import { describe, expect, it } from 'vitest';
import { ALDMOOR, landOf, LANDS, type Land } from '../content/aldmoor';
import { GEESE } from '../content/aldmoorGeese';
import { gainsOf } from '../game/gains';
import { heardOf, withNewPlaces } from './campaign';
import { apply, DISCOVERY_XP, geeseHome, locationById, spent, visit, type Card, type GameState, type Result } from './game';
import { foundOf } from './heroSheet';
import { buildMap, CELL } from './map/model';
import { newGame } from './scenario';

const fresh = (): GameState => ({ ...newGame(1066, ALDMOOR, 'knight'), opening: undefined });
const cardOf = (result: Result): Card => {
  const e = result.events.find((x) => x.type === 'card');
  if (!e || e.type !== 'card') throw new Error('no card');
  return e.card;
};
const tally = (state: GameState, what: string) => foundOf(state).find((f) => f.what === what);

describe('the lost geese (#192)', () => {
  it('go home to the goose pond when he finds them, one by one, and the pond shows them there', () => {
    const start = fresh();
    const first = visit(start, 'gooseReeds');
    expect(first.state.locations.find((l) => l.id === 'gooseReeds')?.done).toBe(true);
    expect(first.events).toContainEqual({ type: 'removed', id: 'gooseReeds' });
    expect(first.events).toContainEqual({ type: 'changed', id: 'goosePond' });
    expect(cardOf(first).lines.at(-1)).toBe(`That makes 1 of the ${GEESE.length} lost geese home.`);
    // A goose is a place found, worth its experience.
    expect(first.state.hero.xp).toBe(start.hero.xp + DISCOVERY_XP);
    expect(geeseHome(first.state)).toBe(1);
    expect(gainsOf(start, first.state)[0]).toMatchObject({ kind: 'goose', text: `Goose 1 of ${GEESE.length}` });
    expect(tally(first.state, 'Lost geese sent home')).toEqual({ what: 'Lost geese sent home', got: 1, of: GEESE.length });
    // Ridden up to again, she's gone.
    expect(cardOf(visit(first.state, 'gooseReeds')).lines).toEqual(['There is nothing here now but a feather.']);
    // And the map has nothing left there to click, as it has nothing left of a purse picked up.
    expect(spent(locationById(start, 'gooseReeds'))).toBe(false);
    expect(spent(locationById(first.state, 'gooseReeds'))).toBe(true);
    expect(spent(locationById(visit(start, 'purseKingsRoad').state, 'purseKingsRoad'))).toBe(true);
    // A place he can still go back to stays there to click.
    expect(spent({ kind: 'tower', done: true })).toBe(false);
  });

  it('all home, the goose-girl gives him her lucky feather, and the King hears of it', () => {
    let s = fresh();
    expect(cardOf(visit(s, 'goosePond')).choices.map((c) => c.label)).not.toContain('Take her lucky feather');
    // She asks for them on the first visit, and the journal remembers it.
    s = visit(s, 'goosePond').state;
    expect(heardOf(s).some((h) => h.who === 'the goose-girl at the pond' && !h.done)).toBe(true);
    for (const g of GEESE) s = visit(s, g.id).state;
    expect(s.flags?.geese).toBe(true);
    const thanks = cardOf(visit(s, 'goosePond'));
    expect(thanks.choices.map((c) => c.label)).toContain('Take her lucky feather');
    const took = apply(s, { type: 'choose', id: 'goosePond', choice: 'thanks/feather' })!;
    expect([...Object.values(took.state.hero.gear), ...took.state.hero.pack]).toContain('luckyFeather');
    expect(heardOf(took.state).find((h) => h.who === 'the goose-girl at the pond')?.done).toBe(true);
    // Her thanks come once.
    expect(cardOf(visit(took.state, 'goosePond')).choices.map((c) => c.label)).not.toContain('Take her lucky feather');
  });

  it('are hidden all over Aldmoor, each where a rider can get to her', () => {
    expect(GEESE).toHaveLength(7);
    for (const land of Object.keys(LANDS) as Land[]) expect(GEESE.filter((g) => landOf(g.at) === land).length, LANDS[land]).toBeGreaterThanOrEqual(1);
    const map = buildMap(ALDMOOR);
    const passable = (x: number, y: number) => map.grid.cost[Math.floor(y / CELL) * map.width + Math.floor(x / CELL)] < Infinity;
    for (const g of GEESE) {
      expect(passable(g.at[0], g.at[1]), g.id).toBe(true);
      for (const other of ALDMOOR.locations) if (other !== g && other.kind !== 'pickup') expect(Math.hypot(other.at[0] - g.at[0], other.at[1] - g.at[1]), `${g.id} and ${other.id}`).toBeGreaterThan(30);
    }
  });

  it('reach a saved game from before them', () => {
    const played = fresh();
    const old = { ...played, locations: played.locations.filter((l) => l.kind !== 'goose') };
    const loaded = withNewPlaces(JSON.parse(JSON.stringify(old)));
    expect(loaded.locations.filter((l) => l.kind === 'goose')).toHaveLength(GEESE.length);
  });
});

describe('Aldmoor\u2019s lookouts (#192)', () => {
  const LOOKOUTS = ['stones', 'beacon', 'lonePine', 'huntStand', 'cairn'];

  it('each lifts the mist round it once climbed, and the journal counts them', () => {
    // The spiders' webs run up the lone pine (#239): they're seen to first.
    let s: GameState = { ...fresh(), locations: fresh().locations.map((l) => (l.id === 'spiders' ? { ...l, done: true } : l)) };
    expect(tally(s, 'Lookouts climbed')).toEqual({ what: 'Lookouts climbed', got: 0, of: LOOKOUTS.length });
    for (const id of LOOKOUTS.slice(1)) {
      const place = ALDMOOR.locations.find((l) => l.id === id)!;
      const climb = cardOf(visit(s, id)).choices[0];
      expect(climb.action.type).toBe('choose');
      const result = apply(s, climb.action)!;
      expect(result.events).toContainEqual(expect.objectContaining({ type: 'reveal', at: place.at }));
      s = result.state;
    }
    expect(tally(s, 'Lookouts climbed')?.got).toBe(LOOKOUTS.length - 1);
  });

  it('stand in each land that had none, well clear of everything else', () => {
    for (const id of LOOKOUTS.slice(1)) {
      const place = ALDMOOR.locations.find((l) => l.id === id)!;
      for (const other of ALDMOOR.locations) if (other !== place) expect(Math.hypot(other.at[0] - place.at[0], other.at[1] - place.at[1]), `${id} and ${other.id}`).toBeGreaterThan(120);
    }
  });
});
