import { ARTIFACTS, type ArtifactId } from '../content/artifacts';
import { SPELLS } from '../content/spells';
import { troops } from '../content/troops';
import { roman, type GameState } from '../rules/state';

export type GainKind = 'gold' | 'troops' | 'leadership' | 'movement' | 'mana' | 'spell' | 'gear' | 'level' | 'experience';
/** Something the hero just gained (or gold he spent), in the words that rise off him on the map. */
export type Gain = { kind: GainKind; amount: number; text: string; artifact?: ArtifactId };

const sign = (n: number) => (n > 0 ? '+' : '\u2212');
const owned = (state: GameState): ArtifactId[] => [...Object.values(state.hero.gear), ...state.hero.pack].filter((id): id is ArtifactId => Boolean(id));

/**
 * What changed for the hero between two states, in the order it rises off him: gold, troops,
 * leadership, movement, mana, spells, gear, then his level or his experience. Movement and mana
 * count only within a day, so a new day's riding and the mana that comes back at dawn say nothing.
 */
export function gainsOf(before: GameState, after: GameState): Gain[] {
  const gains: Gain[] = [];
  const gold = after.gold - before.gold;
  if (gold) gains.push({ kind: 'gold', amount: gold, text: `${sign(gold)}${Math.abs(gold).toLocaleString('en-GB')} gold` });
  if (!before.battle) {
    for (const stack of after.army) {
      const had = before.army.find((s) => s.troop === stack.troop)?.count ?? 0;
      if (stack.count > had) gains.push({ kind: 'troops', amount: stack.count - had, text: `+${troops(stack.troop, stack.count - had)}` });
    }
  }
  if (after.leadership > before.leadership) gains.push({ kind: 'leadership', amount: after.leadership - before.leadership, text: `+${after.leadership - before.leadership} leadership` });
  const sameDay = after.day === before.day;
  if (sameDay && after.movement > before.movement) {
    const movement = Math.round(after.movement - before.movement);
    if (movement > 0) gains.push({ kind: 'movement', amount: movement, text: `+${movement} movement` });
  }
  if (sameDay && after.hero.mana > before.hero.mana) gains.push({ kind: 'mana', amount: after.hero.mana - before.hero.mana, text: `+${after.hero.mana - before.hero.mana} mana` });
  for (const spell of after.hero.spells) if (!before.hero.spells.includes(spell)) gains.push({ kind: 'spell', amount: 1, text: `New spell: ${SPELLS[spell].name}` });
  const had = owned(before);
  for (const id of owned(after)) {
    const i = had.indexOf(id);
    if (i >= 0) had.splice(i, 1);
    else gains.push({ kind: 'gear', amount: 1, text: ARTIFACTS[id].name, artifact: id });
  }
  if (after.hero.level > before.hero.level) gains.push({ kind: 'level', amount: after.hero.level - before.hero.level, text: `Level ${roman(after.hero.level)}!` });
  else if (after.hero.xp > before.hero.xp) gains.push({ kind: 'experience', amount: after.hero.xp - before.hero.xp, text: `+${after.hero.xp - before.hero.xp} experience` });
  return gains;
}
