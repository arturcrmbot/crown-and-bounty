/**
 * What content choices ask and do, as data turned into state: the conditions and costs (`Needs`)
 * and everything a choice or a victory can bring (`Effects`). Nothing here knows about places'
 * kinds or fights, so the fight rules can use it too.
 */
import { ARTIFACTS, artifactPhrase, type ArtifactId } from '../../content/artifacts';
import { BACKGROUNDS } from '../../content/backgrounds';
import { SKILLS } from '../../content/skills';
import { SPELLS } from '../../content/spells';
import { foundNote, gainXp, giveArtifact, heroStats } from '../hero';
import { look } from '../map/sight';
import { addTroops, coins, countOf, fits, joinLine, leadershipUsed, listed, locationById, MAX_STACKS, TROOPS, troops, update, VANISHES, type Choice, type ContentChoice, type Effects, type GameEvent, type GameState, type Location, type Needs } from '../state';

const STAT_WORDS = { attack: 'attack', defence: 'defence', spellPower: 'spell power', knowledge: 'knowledge' } as const;

/** Whether the hero wears or carries an artifact. */
export const owns = (state: GameState, id: ArtifactId) => Object.values(state.hero.gear).includes(id) || state.hero.pack.includes(id);

/** Whether the hero is the right sort, knows enough, carries the right thing, and can spare what it costs. */
export function meets(state: GameState, needs: Needs | undefined): boolean {
  if (!needs) return true;
  const hero = state.hero;
  if (needs.background && hero.background !== needs.background) return false;
  if (needs.skill && !hero.skills[needs.skill]) return false;
  if (needs.spellPower && heroStats(state).spellPower < needs.spellPower) return false;
  if (needs.level && hero.level < needs.level) return false;
  if (needs.artifact && !owns(state, needs.artifact)) return false;
  if (needs.notArtifact && owns(state, needs.notArtifact)) return false;
  if (needs.flag && !state.flags?.[needs.flag]) return false;
  if (needs.notFlag && state.flags?.[needs.notFlag]) return false;
  if (needs.seen && !state.locations.find((l) => l.id === needs.seen)?.seen) return false;
  if (needs.gold && state.gold < needs.gold) return false;
  if (needs.mana && hero.mana < needs.mana) return false;
  if (needs.troop && countOf(state.army, needs.troop) < (needs.count ?? 1)) return false;
  if (needs.notSpell && hero.spells.includes(needs.notSpell)) return false;
  // Nobody pays with his whole army.
  if (needs.troop && state.army.reduce((n, s) => n + s.count, 0) <= (needs.count ?? 1)) return false;
  return true;
}

/** "(Courtier)", "(400 gold)", "(Hedge Wizard, spell power 7)": what a choice he can take asks, for its button. */
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

/**
 * What a greyed button says the hero lacks, and never what he has: a Courtier knows he's one. The
 * wrong sort of hero hears only that, as nothing else would help him. A story need not met yet (a
 * flag, a place not seen, a spell he knows already) says the choice's quiet `hint`, if it has one.
 */
export function lacksLabel(state: GameState, needs: Needs | undefined, hint?: string): string {
  if (!needs) return '';
  if (needs.background && state.hero.background !== needs.background) return ` (${BACKGROUNDS[needs.background].name})`;
  const short = (part: Needs) => !meets(state, part);
  const { flag, notFlag, seen, notArtifact, notSpell } = needs;
  const parts = [
    needs.skill && short({ skill: needs.skill }) && SKILLS[needs.skill].name,
    needs.spellPower && short({ spellPower: needs.spellPower }) && `spell power ${needs.spellPower}`,
    needs.level && short({ level: needs.level }) && `level ${needs.level}`,
    needs.artifact && short({ artifact: needs.artifact }) && ARTIFACTS[needs.artifact].name,
    needs.gold && short({ gold: needs.gold }) && `${coins(needs.gold)} gold`,
    needs.mana && short({ mana: needs.mana }) && `${needs.mana} mana`,
    needs.troop && short({ troop: needs.troop, count: needs.count }) && troops(needs.troop, needs.count ?? 1),
    hint && short({ flag, notFlag, seen, notArtifact, notSpell }) && hint,
    // A spell he knows already, with no hint to say otherwise.
    !hint && notSpell && short({ notSpell }) && 'you know it',
  ].filter(Boolean);
  return parts.length ? ` (${parts.join(', ')})` : '';
}

/** A content choice as a button: greyed out, with what he lacks, when the hero can't take it. */
export function choiceButton(state: GameState, place: Location, choice: ContentChoice, key: string): Choice {
  const can = meets(state, choice.needs);
  return {
    label: `${choice.label}${can ? needsLabel(choice.needs) : lacksLabel(state, choice.needs, choice.hint)}`,
    action: { type: 'choose', id: place.id, choice: key },
    ...(can ? {} : { disabled: true }),
  };
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
    lines.push(effects.gold > 0 ? `You get **${coins(effects.gold)} gold**.` : `You pay **${coins(-effects.gold)} gold**.`);
  }
  if (effects.treasure) {
    const gold = Math.round(effects.treasure * (1 + heroStats(next).loot));
    next = { ...next, gold: next.gold + gold };
    lines.push(`You get **${coins(gold)} gold**.`);
  }
  if (effects.leadership) {
    next = { ...next, leadership: next.leadership + effects.leadership };
    lines.push(`You gain **${effects.leadership} leadership**.`);
  }
  if (effects.movement) {
    next = { ...next, movement: next.movement + effects.movement };
    lines.push(`You gain **${effects.movement} movement** today.`);
  }
  if (effects.mana) next = { ...next, hero: { ...next.hero, mana: Math.min(heroStats(next).maxMana, next.hero.mana + effects.mana) } };
  if (effects.rations) {
    next = { ...next, rations: Math.max(0, (next.rations ?? 0) + effects.rations) };
    if (effects.rations > 0) lines.push(`**${effects.rations === 1 ? 'A week\u2019s' : `${effects.rations} weeks\u2019`} rations** go in your baggage, so come payday your troops eat instead of drawing their wages.`);
  }
  for (const [stat, amount] of Object.entries(effects.stats ?? {}) as [keyof typeof STAT_WORDS, number][]) {
    next = { ...next, hero: { ...next.hero, [stat]: next.hero[stat] + amount } };
    lines.push(`Your ${STAT_WORDS[stat]} rises by **${amount}** for good.`);
  }
  if (effects.artifact) {
    next = giveArtifact(next, effects.artifact);
    lines.push(`You get ${artifactPhrase(effects.artifact)}. ${foundNote(next, effects.artifact)}`);
  }
  if (effects.spell) {
    const known = next.hero.spells.includes(effects.spell);
    if (!known) next = { ...next, hero: { ...next.hero, spells: [...next.hero.spells, effects.spell] } };
    lines.push(known ? `You know **${SPELLS[effects.spell].name}** already.` : `You learn **${SPELLS[effects.spell].name}**. ${SPELLS[effects.spell].note}`);
  }
  for (const stack of effects.troops ?? []) {
    const room = fits(heroStats(next).leadership - leadershipUsed(next.army), stack.troop);
    const count = Math.min(stack.count, room);
    const army = count > 0 ? addTroops(next.army, stack.troop, count) : null;
    if (army) next = { ...next, army };
    lines.push(army ? joinLine(stack.troop, count) : `**${TROOPS[stack.troop].name}** would join you, but you can\u2019t lead any more.`);
  }
  if (effects.flags) next = { ...next, flags: { ...next.flags, ...effects.flags } };
  if (effects.reinforce && place.enemy) {
    const joined = next.locations.find((l) => l.id === effects.reinforce!.id);
    if (joined?.enemy && !joined.done) {
      let army = joined.enemy.army;
      for (const stack of place.enemy.army) {
        const count = Math.round(stack.count * effects.reinforce.share);
        if (count <= 0) continue;
        const had = army.some((s) => s.troop === stack.troop);
        if (had) army = army.map((s) => (s.troop === stack.troop ? { ...s, count: s.count + count } : s));
        else if (army.length < MAX_STACKS) army = [...army, { troop: stack.troop, count }];
      }
      next = update(next, joined.id, { enemy: { ...joined.enemy, army } });
      lines.push(`**${joined.name}** grows stronger.`);
    }
  }
  if (effects.desert && place.enemy) {
    const { troop, share } = effects.desert;
    const foe = locationById(next, place.id).enemy!;
    const gone: string[] = [];
    let slipped = 0;
    const army = foe.army
      .map((s) => {
        if ((troop && s.troop !== troop) || TROOPS[s.troop].leadership >= 99) return s;
        const lost = Math.round(s.count * share);
        if (lost > 0) gone.push(`**${troops(s.troop, lost)}**`);
        slipped += Math.max(0, lost);
        return { ...s, count: s.count - lost };
      })
      .filter((s) => s.count > 0);
    next = update(next, place.id, { enemy: { ...foe, army } });
    if (gone.length) lines.push(`${listed(gone)} ${slipped === 1 ? 'slips' : 'slip'} away from ${place.name}.`);
  }
  if (effects.reveal) {
    const { at, radius } = effects.reveal;
    next = look(next, at, radius).state;
    events.push({ type: 'reveal', at, radius });
  }
  if (effects.travel) {
    const at = effects.travel;
    const sight = heroStats(next).sight;
    next = look({ ...next, movement: 0, hero: { ...next.hero, at } }, at, sight).state;
    events.push({ type: 'moved', at, facing: next.hero.facing }, { type: 'reveal', at, radius: sight });
  }
  if (effects.xp) {
    const grown = gainXp(next, effects.xp);
    next = grown.state;
    events.push(...grown.events);
    lines.push(`You gain **${coins(effects.xp)} experience**.`);
  }
  if (effects.recruits) {
    const { at = place.id, troop, count, price = 0, restock } = effects.recruits;
    const where = next.locations.find((l) => l.id === at);
    const had = where?.recruits;
    const recruits = had && (!troop || troop === had.troop) ? { ...had, count: had.count + count } : troop ? { troop, count, price, ...(restock === undefined ? {} : { restock }) } : null;
    if (where && recruits) {
      next = update(next, at, { recruits });
      events.push({ type: 'changed', id: at });
      // This place's own card says who waits here; another place's is a ride away.
      if (at !== place.id) lines.push(`**${where.name}** has **${count} more ${TROOPS[recruits.troop][count === 1 ? 'one' : 'name']}** to recruit.`);
    }
  }
  if (effects.place && !next.locations.some((l) => l.id === effects.place!.id)) {
    next = { ...next, locations: [...next.locations, effects.place] };
    events.push({ type: 'added', id: effects.place.id });
  }
  if (effects.done) {
    next = update(next, place.id, { done: true });
    // A pile vanishes; anything else used up is drawn anew, as a chest opened and empty.
    events.push({ type: VANISHES.has(place.kind) ? 'removed' : 'changed', id: place.id });
  }
  return { state: next, events, lines };
}

