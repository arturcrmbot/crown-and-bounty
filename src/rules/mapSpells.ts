import { MAP_SPELLS, type MapSpellId } from '../content/spells';
import { heroStats } from './hero';
import { look } from './map/sight';
import { close, show, type GameState, type Result } from './state';

/** Casts a spell on the map (Far Sight lifts the fog far around the hero), paid for from today's mana. */
export function castMapSpell(state: GameState, id: MapSpellId): Result | null {
  const spell = MAP_SPELLS[id];
  if (!heroStats(state).mapSpells.includes(id) || state.hero.mana < spell.mana) return null;
  const [x, y] = state.hero.at;
  const seen = look(state, [x, y], spell.radius).state;
  const mana = state.hero.mana - spell.mana;
  return {
    state: { ...seen, hero: { ...seen.hero, mana } },
    events: [{ type: 'reveal', at: state.hero.at, radius: spell.radius }, show({ title: spell.name, lines: [spell.note, `*You spend ${spell.mana} mana, and have ${mana} left for today\u2019s battles.*`], choices: [close] }, state.hero.at)],
  };
}
