import { MAP_SPELLS, type MapSpellId } from '../content/spells';
import { heroStats } from './hero';
import { revealDisc } from './map/fog';
import { forceLine } from './places/common';
import { close, show, type GameEvent, type GameState, type Result } from './state';

/** Casts a spell on the map, paid for from today's mana. */
export function castMapSpell(state: GameState, id: MapSpellId): Result | null {
  const spell = MAP_SPELLS[id];
  if (!heroStats(state).mapSpells.includes(id) || state.hero.mana < spell.mana) return null;
  const mana = state.hero.mana - spell.mana;
  let next: GameState = { ...state, hero: { ...state.hero, mana } };
  const events: GameEvent[] = [];
  const lines = [spell.note];
  const lift = (at: GameState['hero']['at'], radius: number) => {
    const seen = revealDisc(next.explored, next.world, at[0], at[1], radius);
    next = { ...next, explored: seen.bits };
    events.push({ type: 'reveal', at, radius });
  };
  const effect = spell.effect;
  switch (effect.kind) {
    case 'reveal':
      lift(state.hero.at, effect.radius);
      break;
    case 'movement':
      next = { ...next, movement: next.movement + effect.amount };
      break;
    case 'treasure': {
      const hidden = state.locations.filter((l) => !l.done && (l.kind === 'chest' || l.kind === 'gold' || l.kind === 'mine'));
      for (const l of hidden) lift(l.at, effect.radius);
      lines.push(hidden.length ? `The twig finds **${hidden.length}** ${hidden.length === 1 ? 'place' : 'places'} worth a look.` : 'The twig droops. There\u2019s nothing left to find.');
      break;
    }
    case 'scry': {
      const lair = state.locations.find((l) => l.kind === 'hideout' && !l.done);
      if (!lair?.enemy) return null;
      lift(lair.at, effect.radius);
      lines.push(`**${lair.name}**: ${forceLine(lair.enemy.army, true)}.`);
      break;
    }
    case 'recall': {
      const castle = state.locations.filter((l) => l.kind === 'castle').sort((a, b) => Math.hypot(a.at[0] - state.hero.at[0], a.at[1] - state.hero.at[1]) - Math.hypot(b.at[0] - state.hero.at[0], b.at[1] - state.hero.at[1]))[0];
      if (!castle) return null;
      const at: GameState['hero']['at'] = [castle.at[0], castle.at[1] + 14];
      next = { ...next, movement: 0, hero: { ...next.hero, at } };
      events.push({ type: 'moved', at, facing: next.hero.facing });
      lift(at, heroStats(next).sight);
      lines.push(`You stand before **${castle.name}**, a little dizzy.`);
      break;
    }
  }
  lines.push(`*${spell.mana} mana spent: ${mana} left for today\u2019s battles.*`);
  return { state: next, events: [...events, show({ title: spell.name, lines, choices: [close] }, next.hero.at)] };
}


export { canRead, circleNeeds, knowsSpell, learnSpell, readScrolls } from './hero';
