import { BACKGROUNDS } from '../content/backgrounds';
import { SKILLS } from '../content/skills';
import { bountyPaid } from './fight';
import { ARTIFACTS } from '../content/artifacts';
import { foundNote, gainXp, giveArtifact, heroStats } from './hero';
import { close, coins, countOf, locationById, show, troops, update, VANISHES, type Choice, type GameEvent, type GameState, type Needs, type Result } from './state';

/** Whether the hero is the right sort, knows enough, and can spare what it costs. */
export function meets(state: GameState, needs: Needs): boolean {
  if (needs.background && state.hero.background !== needs.background) return false;
  if (needs.skill && !state.hero.skills[needs.skill]) return false;
  if (needs.spellPower && heroStats(state).spellPower < needs.spellPower) return false;
  if (needs.gold && state.gold < needs.gold) return false;
  if (needs.troop && countOf(state.army, needs.troop) < (needs.count ?? 1)) return false;
  // Nobody pays a toll with his whole army.
  if (needs.troop && state.army.reduce((n, s) => n + s.count, 0) <= (needs.count ?? 1)) return false;
  return true;
}

/** "(Courtier)", "(400 gold)", "(Hedge Wizard, spell power 6)": what an option asks, for its button. */
export function needsLabel(needs: Needs): string {
  const parts = [
    needs.background && BACKGROUNDS[needs.background].name,
    needs.skill && SKILLS[needs.skill].name,
    needs.spellPower && `spell power ${needs.spellPower}`,
    needs.gold && `${coins(needs.gold)} gold`,
    needs.troop && troops(needs.troop, needs.count ?? 1),
  ].filter(Boolean);
  return parts.length ? ` (${parts.join(', ')})` : '';
}

/** The buttons for an enemy's parleys: the ones the hero can't take show greyed out, as a hint. */
export function parleyChoices(state: GameState, id: string): Choice[] {
  const place = locationById(state, id);
  return (place.enemy?.parleys ?? []).map((p) => ({
    label: `${p.label}${needsLabel(p.needs)}`,
    action: { type: 'parley' as const, id, parley: p.id },
    ...(meets(state, p.needs) ? {} : { disabled: true }),
  }));
}

/** Takes a parley: pays what it costs, and they let you pass, or it counts as beating them. */
export function parley(state: GameState, id: string, parleyId: string): Result | null {
  const place = locationById(state, id);
  const p = place.enemy?.parleys?.find((x) => x.id === parleyId);
  if (!p || place.done || !meets(state, p.needs)) return null;
  const { gold = 0, troop, count = 1 } = p.needs;
  const army = troop ? state.army.map((s) => (s.troop === troop ? { ...s, count: s.count - count } : s)).filter((s) => s.count > 0) : state.army;
  let next = update({ ...state, gold: state.gold - gold + (p.outcome === 'win' ? (p.reward ?? 0) : 0), army }, id, { done: true });
  const events: GameEvent[] = VANISHES.has(place.kind) ? [{ type: 'removed', id }] : [];
  const lines = [...p.lines];
  // Beating them by other means still turns up whatever they were keeping.
  if (p.outcome === 'win' && place.artifact) {
    next = giveArtifact(next, place.artifact);
    lines.push(`Among the spoils: **${ARTIFACTS[place.artifact].name}**. ${foundNote(next, place.artifact)}`);
  }
  if (p.xp) {
    const grown = gainXp(next, p.xp);
    next = grown.state;
    events.push(...grown.events);
    lines.push(`**+${p.xp} experience.**`);
  }
  if (p.outcome === 'win' && place.kind === 'hideout') {
    const paid = bountyPaid(next, id, lines.slice(0, p.lines.length), p.reward ?? 0, lines.slice(p.lines.length));
    return { state: paid.state, events: [...events, ...paid.events] };
  }
  if (p.outcome === 'win' && p.reward) lines.push(`**+${coins(p.reward)} gold.**`);
  return { state: next, events: [...events, show({ title: place.name, lines, choices: [close] }, place.at, place.id)] };
}
