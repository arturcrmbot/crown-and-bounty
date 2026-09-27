/**
 * What content choices ask and do, as data turned into state: the conditions and costs (`Needs`)
 * and everything a choice or a victory can bring (`Effects`). Nothing here knows about places'
 * kinds or fights, so the fight rules can use it too.
 */
import { ARTIFACTS } from '../../content/artifacts';
import { BACKGROUNDS } from '../../content/backgrounds';
import { SKILLS } from '../../content/skills';
import { SPELLS } from '../../content/spells';
import { foundNote, gainXp, giveArtifact, heroStats } from '../hero';
import { revealDisc } from '../map/fog';
import { addTroops, coins, countOf, leadershipUsed, TROOPS, troops, update, VANISHES, type Effects, type GameEvent, type GameState, type Location, type Needs } from '../state';

const STAT_WORDS = { attack: 'attack', defence: 'defence', spellPower: 'spell power', knowledge: 'knowledge' } as const;

/** Whether the hero is the right sort, knows enough, carries the right thing, and can spare what it costs. */
export function meets(state: GameState, needs: Needs | undefined): boolean {
  if (!needs) return true;
  const hero = state.hero;
  if (needs.background && hero.background !== needs.background) return false;
  if (needs.skill && !hero.skills[needs.skill]) return false;
  if (needs.spellPower && heroStats(state).spellPower < needs.spellPower) return false;
  if (needs.level && hero.level < needs.level) return false;
  if (needs.artifact && !Object.values(hero.gear).includes(needs.artifact) && !hero.pack.includes(needs.artifact)) return false;
  if (needs.flag && !state.flags?.[needs.flag]) return false;
  if (needs.notFlag && state.flags?.[needs.notFlag]) return false;
  if (needs.gold && state.gold < needs.gold) return false;
  if (needs.mana && hero.mana < needs.mana) return false;
  if (needs.troop && countOf(state.army, needs.troop) < (needs.count ?? 1)) return false;
  // Nobody pays with his whole army.
  if (needs.troop && state.army.reduce((n, s) => n + s.count, 0) <= (needs.count ?? 1)) return false;
  return true;
}

/** "(Courtier)", "(400 gold)", "(Hedge Wizard, spell power 7)": what a choice asks, for its button. */
export function needsLabel(needs: Needs | undefined): string {
  if (!needs) return '';
  const parts = [
    needs.background && BACKGROUNDS[needs.background].name,
    needs.skill && SKILLS[needs.skill].name,
    needs.spellPower && `spell power ${needs.spellPower}`,
    needs.level && `level ${needs.level}`,
    needs.artifact && ARTIFACTS[needs.artifact].name,
    needs.gold && `${coins(needs.gold)} gold`,
    needs.mana && `${needs.mana} mana`,
    needs.troop && troops(needs.troop, needs.count ?? 1),
  ].filter(Boolean);
  return parts.length ? ` (${parts.join(', ')})` : '';
}

/** Takes what a choice costs: gold, mana and troops. */
export function pay(state: GameState, needs: Needs | undefined): GameState {
  if (!needs) return state;
  const { gold = 0, mana = 0, troop, count = 1 } = needs;
  const army = troop ? state.army.map((s) => (s.troop === troop ? { ...s, count: s.count - count } : s)).filter((s) => s.count > 0) : state.army;
  return { ...state, gold: state.gold - gold, army, hero: { ...state.hero, mana: state.hero.mana - mana } };
}

/** Everything in `effects` except winning, which belongs to the fight rules. Returns lines for the card. */
export function applyEffects(state: GameState, place: Location, effects: Effects): { state: GameState; events: GameEvent[]; lines: string[] } {
  let next = state;
  const events: GameEvent[] = [];
  const lines: string[] = [];
  if (effects.gold) {
    next = { ...next, gold: next.gold + effects.gold };
    lines.push(`**${effects.gold > 0 ? '+' : ''}${coins(effects.gold)} gold.**`);
  }
  if (effects.leadership) {
    next = { ...next, leadership: next.leadership + effects.leadership };
    lines.push(`**+${effects.leadership} leadership.**`);
  }
  if (effects.movement) {
    next = { ...next, movement: next.movement + effects.movement };
    lines.push(`**+${effects.movement} movement** today.`);
  }
  if (effects.mana) next = { ...next, hero: { ...next.hero, mana: Math.min(heroStats(next).maxMana, next.hero.mana + effects.mana) } };
  for (const [stat, amount] of Object.entries(effects.stats ?? {}) as [keyof typeof STAT_WORDS, number][]) {
    next = { ...next, hero: { ...next.hero, [stat]: next.hero[stat] + amount } };
    lines.push(`**+${amount} ${STAT_WORDS[stat]}**, for good.`);
  }
  if (effects.artifact) {
    next = giveArtifact(next, effects.artifact);
    lines.push(`You get **${ARTIFACTS[effects.artifact].name}**. ${foundNote(next, effects.artifact)}`);
  }
  if (effects.spell) {
    const known = next.hero.spells.includes(effects.spell);
    if (!known) next = { ...next, hero: { ...next.hero, spells: [...next.hero.spells, effects.spell] } };
    lines.push(known ? `You know **${SPELLS[effects.spell].name}** already.` : `You learn **${SPELLS[effects.spell].name}**: ${SPELLS[effects.spell].note}`);
  }
  for (const stack of effects.troops ?? []) {
    const room = Math.floor((heroStats(next).leadership - leadershipUsed(next.army)) / TROOPS[stack.troop].leadership);
    const count = Math.min(stack.count, room);
    const army = count > 0 ? addTroops(next.army, stack.troop, count) : null;
    if (army) next = { ...next, army };
    lines.push(army ? `**${troops(stack.troop, count)}** join your army.` : `**${TROOPS[stack.troop].name}** would join you, but you can\u2019t lead any more.`);
  }
  if (effects.flags) next = { ...next, flags: { ...next.flags, ...effects.flags } };
  if (effects.reveal) {
    const { at, radius } = effects.reveal;
    next = { ...next, explored: revealDisc(next.explored, next.world, at[0], at[1], radius).bits };
    events.push({ type: 'reveal', at, radius });
  }
  if (effects.xp) {
    const grown = gainXp(next, effects.xp);
    next = grown.state;
    events.push(...grown.events);
    lines.push(`**+${effects.xp} experience.**`);
  }
  if (effects.place && !next.locations.some((l) => l.id === effects.place!.id)) {
    next = { ...next, locations: [...next.locations, effects.place] };
    events.push({ type: 'added', id: effects.place.id });
  }
  if (effects.done) {
    next = update(next, place.id, { done: true });
    if (VANISHES.has(place.kind)) events.push({ type: 'removed', id: place.id });
  }
  return { state: next, events, lines };
}

