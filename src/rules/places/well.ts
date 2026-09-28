import { heroStats } from '../hero';
import { close, update, type GameState, type Location } from '../state';
import { found, note, ride, words } from './common';
import type { PlaceKind } from './kind';

/** The flag that says on which day the hero last drank from this well. */
const drankKey = (place: Location) => `drank:${place.id}`;
const drankToday = (state: GameState, place: Location) => state.flags?.[drankKey(place)] === state.day;

/**
 * A holy well: a drink and his mana is full again, once a day. It is how a caster gets a second
 * battle's worth of spells before sunset, if he plans his ride round it.
 */
export const well: PlaceKind = {
  about: (state, place) => ({
    title: place.name,
    lines: [...words(place, 'about'), drankToday(state, place) ? '*You drank here today. Tomorrow.*' : '*Drink, and your mana is full again: once a day.*'],
    choices: [ride(place, 'Drink'), close],
  }),
  arrive(state, place) {
    const max = heroStats(state).maxMana;
    if (drankToday(state, place)) return found(state, place, note(place, ['The water tastes of nothing much. *The well has given what it can today: come back tomorrow.*']));
    if (max <= 0) return found(state, place, note(place, ['Cold, clear and very good water. It does nothing for you, since you have no mana to fill.']));
    if (state.hero.mana >= max) return found(state, place, note(place, ['Cold and clear. Your mana is full already: save it for a day you need it.']));
    const gained = max - state.hero.mana;
    const drunk = update({ ...state, hero: { ...state.hero, mana: max }, flags: { ...state.flags, [drankKey(place)]: state.day } }, place.id, { seen: true });
    return found(drunk, place, note(place, [...words(place, 'visit'), `**+${gained} mana.** Full again: ${max} of ${max}.`]));
  },
  worth(state, place) {
    const missing = heroStats(state).maxMana - state.hero.mana;
    return missing > 10 && !drankToday(state, place) ? missing * 3 : null;
  },
};
