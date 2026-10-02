import { MAP_SPELLS, type MapSpellId } from '../content/spells';
import { heroStats } from './hero';
import { look } from './map/sight';
import type { GameState, Result } from './state';

/**
 * Casts a spell on the map (Far Sight lifts the fog far around the hero), paid for from today's mana.
 * No card covers it (#226): the mist rolls back in plain sight with a gust, and the mana it cost
 * rises off him as spent gold does.
 */
export function castMapSpell(state: GameState, id: MapSpellId): Result | null {
  const spell = MAP_SPELLS[id];
  if (!heroStats(state).mapSpells.includes(id) || state.hero.mana < spell.mana) return null;
  const [x, y] = state.hero.at;
  const seen = look(state, [x, y], spell.radius).state;
  const mana = state.hero.mana - spell.mana;
  return {
    state: { ...seen, hero: { ...seen.hero, mana } },
    events: [{ type: 'reveal', at: state.hero.at, radius: spell.radius }],
  };
}
