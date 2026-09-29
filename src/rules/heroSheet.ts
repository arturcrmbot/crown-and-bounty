import { ARTIFACTS, type Slot } from '../content/artifacts';
import { BACKGROUNDS, type BackgroundId, type Bonus } from '../content/backgrounds';
import { PERKS, RANKS, SKILLS, skillNote, type SkillId } from '../content/skills';
import { MAP_SPELLS, SPELLS, type MapSpellId } from '../content/spells';
import { ABILITIES, abilitiesOf, TROOPS, troops, type TroopId } from '../content/troops';
import { createBattle, statsOf } from './battle/battle';
import { rowOf } from './battle/hex';
import { CAMPAIGN_LENGTH, commissionOf } from './campaign';
import type { PortraitId } from '../content/portraits';
import { heroFighter, heroInBattle } from './fight';
import { countsExactly, forceLine } from './places/common';
import { heroStats, LEVELS, type StatId } from './hero';
import { close, COMMISSION, coins, LAST_DAY, leadershipUsed, locationById, PAYDAY_EVERY, roman, wages, type Card, type GameState } from './state';

/** How mana comes back, in a few words: at dawn, and for some heroes as they ride. */
export function manaBack(state: GameState): string {
  const rate = heroStats(state).manaRate;
  return rate > 0 ? `a point back every ${Math.round(1 / rate)} movement ridden, and full at dawn` : 'full again at dawn';
}

/** Mana left, the most he can hold, and how it comes back: "Mana 12/30 · full again at dawn". */
export function manaNote(state: GameState): string {
  const s = heroStats(state);
  const mana = state.hero.mana;
  if (s.maxMana <= 0) return 'No mana: every point of knowledge holds 10';
  if (mana >= s.maxMana) return `Mana ${mana}/${s.maxMana} · ${s.manaRate > 0 ? `full: ${manaBack(state)}` : 'it fills up again every dawn'}`;
  return `Mana ${mana}/${s.maxMana} · ${manaBack(state)}`;
}

/** The spellbook's mana line: none comes back in battle. `max` is missing from a battle saved before it was kept. */
export function manaInBattle(mana: number, max?: number): string {
  return max === undefined ? `**${mana}** mana: none comes back in battle.` : `Mana **${mana}/${max}**: none comes back in battle, but it\u2019s full again at dawn.`;
}

/** The next payday: once a week, from day VIII (VIII, XV, XXII...). */
export const nextPayday = (state: GameState) => state.day + PAYDAY_EVERY - ((state.day - 1) % PAYDAY_EVERY);

/** What the King sends and the troops take on the next payday, as things stand. */
export function paydayOf(state: GameState): { day: number; pay: number; wages: number } {
  const s = heroStats(state);
  return { day: nextPayday(state), pay: COMMISSION + s.payday, wages: Math.round(wages(state.army) * (1 + s.wages)) };
}

/** Something on the map's bottom bar, for what it says under the pointer. */
export type BarItem =
  | { kind: 'gold' }
  | { kind: 'stack'; index: number }
  | { kind: 'bounty' }
  | { kind: 'movement' }
  | { kind: 'mana' }
  | { kind: 'day' }
  | { kind: 'hourglass' };

/** The bottom bar's hover labels, like HoMM2's status line: what each number means, and what a click does. */
export function barNote(state: GameState, item: BarItem): string {
  switch (item.kind) {
    case 'gold': {
      const p = paydayOf(state);
      return `${coins(state.gold)} gold · payday on day ${roman(p.day)}: the King sends ${coins(p.pay)}, wages take ${coins(p.wages)}`;
    }
    case 'stack': {
      const stack = state.army[item.index];
      if (!stack) return 'Your army';
      return `${troops(stack.troop, stack.count)} · ${coins(stack.count * TROOPS[stack.troop].wage)} gold in wages a week · click to see your army`;
    }
    case 'bounty': {
      const villain = commissionOf(state).villain;
      if (state.bounty === 'paid') return `The bounty on ${villain} is paid`;
      return `Wanted: ${villain}, by day ${LAST_DAY} · ${LAST_DAY - state.day} days left · click for the poster`;
    }
    case 'movement':
      return `${Math.floor(state.movement)} movement left today, of ${heroStats(state).movement} · E ends the day`;
    case 'mana':
      return `${manaNote(state)} · click for the hero (H)`;
    case 'day':
      return `Day ${roman(state.day)} of ${LAST_DAY} · payday once a week, next on day ${roman(nextPayday(state))}`;
    case 'hourglass':
      return 'End the day (E)';
  }
}

/** How far away a place is, for the label under the pointer: "today", "tomorrow", "in 3 days". */
export const whenThere = (days: number) => (days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`);

/** Faces for the villains' posters, by the name the commission gives. */
const VILLAIN_FACES: [string, PortraitId][] = [['Grimsby', 'grimsby'], ['Mirrow', 'mirrow'], ['Bramble', 'bramble']];

/** The WANTED poster again, from the bar: who, why, the reward, and the days left. */
export function bountyCard(state: GameState): Card {
  const c = commissionOf(state);
  const face = VILLAIN_FACES.find(([name]) => c.villain.includes(name))?.[1];
  const pieces = state.campaign.record.length + (state.bounty === 'paid' ? 1 : 0);
  const left = LAST_DAY - state.day;
  return {
    title: state.bounty === 'paid' ? 'CAUGHT' : 'WANTED',
    poster: true,
    ...(face ? { portrait: face } : {}),
    lines: [
      `**${c.villain}** of ${c.province.name.replace(/^the /, 'the ')}`,
      ...c.brief,
      state.bounty === 'paid' ? 'The bounty is paid.' : `Reward: **${coins(c.reward)} gold**. By day ${LAST_DAY}: **${left} day${left === 1 ? '' : 's'}** left.`,
      `*Pieces of the old map: ${pieces} of ${CAMPAIGN_LENGTH}.*`,
    ],
    choices: [close],
  };
}

/** What the map's hover label says about a place: its name, and what's there at a glance. */
export function placeNote(state: GameState, id: string): string {
  const place = locationById(state, id);
  if (place.enemy && !place.done) {
    const force = forceLine(place.enemy.army, countsExactly(state)).replace(/\*\*/g, '');
    return `${place.name}: ${force}${place.enemy.trailing ? ' \u00b7 on your trail!' : ''}`;
  }
  const offer = place.recruits;
  if (offer && !place.done && offer.count > 0) return `${place.name}: ${troops(offer.troop, offer.count)} to recruit`;
  return place.name;
}

// --- The hero screen ---------------------------------------------------------------------

/** A named thing with a note, for the hero screen's chips and hover labels. */
export type Note = { name: string; note: string; trick?: boolean };

/** Everything the hero screen shows about him, in the game's voice. The screen only lays it out. */
export type HeroSheet = {
  title: string;
  /** Who he was: his portrait, and his figure on the field. */
  background: BackgroundId;
  level: string;
  /** How far through this level he is (0 to 1), and the words for it. */
  xp: { share: number; line: string };
  stats: { id: StatId; name: string; value: number; note: string }[];
  /** `back` is how it comes back, in a few words for under the gauge. */
  mana: { left: number; max: number; line: string; back: string };
  movement: { left: number; max: number; line: string };
  leadership: { used: number; max: number; line: string };
  signature: Note;
  skills: Note[];
  perks: Note[];
  spells: Note[];
  mapSpells: { spell: MapSpellId; label: string; note: string; disabled: boolean }[];
  pieces: string;
  piecesNote: string;
  day: string;
};

export const SLOT_NAMES: Record<Slot, string> = { weapon: 'Weapon', armour: 'Armour', helm: 'Helm', banner: 'Banner', trinket: 'Trinket', trinket2: 'Trinket II', trinket3: 'Trinket III' };

export function heroSheet(state: GameState): HeroSheet {
  const h = state.hero;
  const s = heroStats(state);
  const b = BACKGROUNDS[h.background];
  const [from, to] = [LEVELS[h.level] ?? 0, LEVELS[h.level + 1]];
  const bolt = SPELLS.bolt.effect.kind === 'damage' ? SPELLS.bolt.effect.perPower * s.spellPower : 0;
  const stat = (id: StatId, name: string, what: string) => {
    const extra = s[id] - h[id];
    const own = extra ? ` (${h[id]} his own, ${extra > 0 ? '+' : '\u2212'}${Math.abs(extra)} from skills and gear)` : '';
    return { id, name, value: s[id], note: `${name} ${s[id]}${own}: ${what}` };
  };
  const used = leadershipUsed(state.army);
  const discount = s.manaDiscount;
  return {
    title: b.title,
    background: h.background,
    level: `Level ${roman(h.level)}`,
    xp: to
      ? { share: Math.max(0, Math.min(1, (h.xp - from) / (to - from))), line: `${coins(h.xp)} / ${coins(to)} experience: ${coins(to - h.xp)} more for level ${roman(h.level + 1)}. Fights and new places bring it.` }
      : { share: 1, line: `${coins(h.xp)} experience: as seasoned as they come` },
    stats: [
      stat('attack', 'Attack', 'added to his own attack in battle, and to every stack\u2019s.'),
      stat('defence', 'Defence', 'added to his own defence in battle, and to every stack\u2019s.'),
      stat('spellPower', 'Spell power', `the harder his spells hit: a Lightning Bolt does ${bolt} damage.`),
      stat('knowledge', 'Knowledge', `10 mana a point, ${s.maxMana} in all, full again every dawn.`),
    ],
    mana: { left: h.mana, max: s.maxMana, line: manaNote(state), back: s.manaRate > 0 ? 'back as you ride' : h.mana < s.maxMana ? 'full again at dawn' : 'refills every dawn' },
    movement: { left: Math.floor(state.movement), max: s.movement, line: `${Math.floor(state.movement)} of ${s.movement} movement left today \u00b7 E ends the day` },
    leadership: {
      used,
      max: s.leadership,
      line:
        used > s.leadership
          ? `Leadership ${used}/${s.leadership}: more than he can lead, so nobody new will join until there's room`
          : `Leadership ${used}/${s.leadership}: every troop needs some, and no more will join past it`,
    },
    signature: { name: b.signature.name, note: b.signature.note, trick: true },
    skills: (Object.entries(h.skills) as [SkillId, number][]).filter(([, rank]) => rank > 0).map(([id, rank]) => ({ name: `${RANKS[Math.min(rank, RANKS.length) - 1]} ${SKILLS[id].name}`, note: skillNote(id, rank) })),
    perks: h.perks.map((id) => ({ name: PERKS[id].name, note: PERKS[id].note, ...(PERKS[id].trick ? { trick: true } : {}) })),
    spells: h.spells.map((id) => ({ name: SPELLS[id].name, note: `${Math.max(1, SPELLS[id].mana - discount)} mana: ${SPELLS[id].note}` })),
    mapSpells: s.mapSpells.map((id) => ({ spell: id, label: `Cast ${MAP_SPELLS[id].name} (${MAP_SPELLS[id].mana} mana)`, note: MAP_SPELLS[id].note, disabled: h.mana < MAP_SPELLS[id].mana })),
    pieces: `Pieces of the old map: ${state.campaign.record.length + (state.bounty === 'paid' ? 1 : 0)} of ${CAMPAIGN_LENGTH}`,
    piecesNote: 'Every bounty brings a torn piece of an old map. With the last one, an X shows where the Sceptre of Order lies.',
    day: `Day ${roman(state.day)} of ${LAST_DAY}`,
  };
}

/** What the hero brings to every battle beyond his numbers: his tricks, and what his skills add. */
export function leaderTraits(state: GameState): Note[] {
  const s = heroStats(state);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const names = (ids: TroopId[]) => {
    const all = [...new Set(ids)].map((id) => TROOPS[id].name);
    return all.length > 1 ? `${all.slice(0, -1).join(', ')} and ${all[all.length - 1]}` : (all[0] ?? '');
  };
  const out: Note[] = [];
  if (s.casts > 1) out.push({ name: `${s.casts} spells a round`, note: 'He casts again before the round is out.', trick: true });
  if (s.manaDiscount) out.push({ name: 'Hedge magic', note: `Every spell costs ${s.manaDiscount} less mana.` });
  const chargers = s.charge.filter((t) => !TROOPS[t].hero);
  if (chargers.length) out.push({ name: 'Charge', note: `His ${names(chargers)} charge: after a run-up of 3 hexes, started clear of the enemy, they hit a quarter harder, and nobody strikes back.`, trick: true });
  if (s.volley) out.push({ name: 'First volley', note: 'His shooters loose a free volley before every battle, except at a villain\u2019s walls.', trick: true });
  if (s.melee) out.push({ name: 'Offence', note: `+${pct(s.melee)} damage in melee, for every stack.` });
  if (s.ranged) out.push({ name: 'Archery', note: `+${pct(s.ranged)} damage with every shot.` });
  if (s.armour) out.push({ name: 'Armour', note: `His troops take ${pct(s.armour)} less damage.` });
  if (s.luck) out.push({ name: 'Luck', note: `${pct(s.luck)} chance a blow lands lucky: twice as hard.` });
  if (s.morale) out.push({ name: 'Morale', note: `${pct(s.morale)} chance a stack's spirits win it another turn before the round moves on.` });
  if (s.slows.length) out.push({ name: 'Slowed from the start', note: `${names(s.slows)} start every battle slowed.` });
  return out;
}

/** Where the hero's skills, perks, gear and background come from, by name, for saying what adds what. */
function namedBonuses(state: GameState): { name: string; bonus: Bonus }[] {
  const h = state.hero;
  const sig = BACKGROUNDS[h.background].signature;
  const out = [{ name: sig.name, bonus: sig.bonus }];
  for (const [id, rank] of Object.entries(h.skills) as [SkillId, number][]) {
    if (rank > 0) out.push({ name: `${RANKS[Math.min(rank, RANKS.length) - 1]} ${SKILLS[id].name}`, bonus: SKILLS[id].ranks[Math.min(rank, RANKS.length) - 1].bonus });
  }
  for (const id of h.perks) out.push({ name: PERKS[id].name, bonus: PERKS[id].bonus });
  for (const id of Object.values(h.gear)) if (id) out.push({ name: ARTIFACTS[id].name, bonus: ARTIFACTS[id].bonus });
  return out;
}

/** Everything a stack's card says: its numbers as they'd fight, what the hero adds, and what it costs. */
export type StackSheet = {
  troop: TroopId;
  title: string;
  note: string;
  stats: { name: string; value: string; note: string }[];
  traits: Note[];
  leadership: string;
  wages: string;
  /** Where it stands when a battle begins. */
  row: string;
  canDismiss: boolean;
};

/** A battle row as words: the stacks line up centre first, then above and below. */
const ROW_WORDS = ['at the top', 'near the top', 'above the middle', 'just above the middle', 'in the middle', 'just below the middle', 'below the middle', 'near the bottom', 'at the bottom'].map((w) => `${w} of the line`);

/** What the hero's own presence adds to the stacks beside him in battle (Lord Aldric's rally). */
const rallies = (state: GameState) => (TROOPS[heroFighter(state).troop].abilities ?? []).flatMap((a) => (ABILITIES[a].aura ? [ABILITIES[a].aura!] : []));

export function stackSheet(state: GameState, index: number): StackSheet | null {
  const stack = state.army[index];
  if (!stack) return null;
  const t = TROOPS[stack.troop];
  const s = heroStats(state);
  const who = BACKGROUNDS[state.hero.background].short;
  // The numbers the battle itself would use: without the hero on the field, whose rally depends on who stands beside him.
  const b = createBattle({ place: 'sheet', seed: 1, player: state.army, enemy: [], hero: { ...heroInBattle(state), unit: undefined }, obstacles: 0 });
  const mine = b.fighters.filter((f) => f.side === 'player' && f.troop === stack.troop);
  const f = mine.length === 1 ? mine[0] : b.fighters.filter((x) => x.side === 'player')[index];
  const { attack, defence } = f ? statsOf(b, f) : { attack: t.attack, defence: t.defence };
  const shots = f?.shots ?? t.shots ?? 0;
  const from = (total: number, own: number) => (total === own ? 'their own' : `${own} their own, ${total > own ? '+' : '\u2212'}${Math.abs(total - own)} from ${who}`);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const traits: Note[] = abilitiesOf(stack.troop).map((a) => ({ name: a.name, note: a.note }));
  const chargedBy: string[] = [];
  const volleyBy: string[] = [];
  if (t.shots) traits.push({ name: 'Shooter', note: 'Shoots from anywhere, unless an enemy stands beside it. In melee it hits at half strength.' });
  for (const { name, bonus } of namedBonuses(state)) {
    const own = bonus.troops?.[stack.troop];
    const parts = [own?.attack && `+${own.attack} attack`, own?.defence && `+${own.defence} defence`, own?.shots && t.shots && `+${own.shots} shots`].filter(Boolean);
    if (parts.length) traits.push({ name, note: `${parts.join(', ')}.` });
    if (bonus.charge?.includes(stack.troop)) chargedBy.push(name);
    if (bonus.volley && t.shots) volleyBy.push(name);
    if (bonus.melee) traits.push({ name, note: `+${pct(bonus.melee)} damage in melee.` });
    if (bonus.ranged && t.shots) traits.push({ name, note: `+${pct(bonus.ranged)} damage with their shots.` });
    if (bonus.armour) traits.push({ name, note: `They take ${pct(bonus.armour)} less damage.` });
    if (bonus.luck) traits.push({ name, note: `${pct(bonus.luck)} chance a blow lands lucky: twice as hard.` });
    if (bonus.morale) traits.push({ name, note: `${pct(bonus.morale)} chance they go again before the round moves on.` });
  }
  // One charge, however many things teach it.
  if (chargedBy.length) traits.push({ name: `Charge (${chargedBy.join(', ')})`, note: 'After a run-up of 3 hexes, started clear of the enemy, they hit a quarter harder, and nobody strikes back.', trick: true });
  if (volleyBy.length) traits.push({ name: `First volley (${volleyBy.join(', ')})`, note: 'A free volley before every battle, except at a villain\u2019s walls.', trick: true });
  for (const aura of rallies(state)) traits.push({ name: 'Rallied', note: `Beside ${who} they fight with +${aura.attack} attack and +${aura.defence} defence.` });
  const wage = Math.round(stack.count * t.wage * (1 + s.wages));
  const row = f ? ROW_WORDS[rowOf(f.at)] : ROW_WORDS[4];
  return {
    troop: stack.troop,
    title: troops(stack.troop, stack.count),
    note: t.note,
    stats: [
      { name: 'Attack', value: String(attack), note: from(attack, t.attack) },
      { name: 'Defence', value: String(defence), note: from(defence, t.defence) },
      { name: 'Damage', value: t.damage[0] === t.damage[1] ? `${t.damage[0]}` : `${t.damage[0]}\u2013${t.damage[1]}`, note: 'each troop, each blow' },
      { name: 'Health', value: String(t.hp), note: 'each troop' },
      { name: 'Speed', value: String(t.speed), note: 'hexes a turn' },
      ...(t.shots ? [{ name: 'Shots', value: String(shots), note: from(shots, t.shots) }] : []),
    ],
    traits,
    leadership: `Leadership: ${t.leadership} each, ${coins(stack.count * t.leadership)} in all (${leadershipUsed(state.army)} of ${s.leadership} in use)`,
    wages: t.wage ? `Wages: ${coins(wage)} gold every payday` : 'Wages: none. They work for the fun of it.',
    row: `In battle they stand ${row}.`,
    canDismiss: state.army.length > 1,
  };
}

/** Who charges when the hero does: "He charges", or "He and his Knights charge". */
function chargeLine(state: GameState): string {
  const others = [...new Set(heroStats(state).charge.filter((t) => !TROOPS[t].hero))].map((t) => TROOPS[t].name);
  const list = others.length > 1 ? `${others.slice(0, -1).join(', ')} and ${others[others.length - 1]}` : others[0];
  return list ? `He and his ${list} charge` : 'He charges';
}

/** The hero's own card, laid out like a stack's: how he fights, what he brings the army, and what happens if he falls. */
export type LeaderSheet = { troop: TroopId; title: string; note: string; stats: StackSheet['stats']; traits: Note[]; lines: string[] };

export function leaderSheet(state: GameState): LeaderSheet {
  const me = heroFighter(state);
  const t = TROOPS[me.troop];
  const s = heroStats(state);
  const who = BACKGROUNDS[state.hero.background].short;
  const grow = t.hero;
  const signed = (n: number) => `${n < 0 ? '\u2212' : '+'}${Math.abs(n)}`;
  const from = (total: number, own: number, what: string) => (total === own ? 'as a fighter' : `${own} as a fighter, ${signed(total - own)} from his ${what}`);
  const growth = [grow && `+${grow.perLevel.damage} a level`, grow?.perPower && `+${grow.perPower} per spell power`].filter(Boolean).join(', ');
  const lends = [s.attack && `${signed(s.attack)} attack`, s.defence && `${signed(s.defence)} defence`].filter(Boolean).join(', ');
  const spells = state.hero.spells.length;
  const traits: Note[] = [
    { name: 'Leads', note: lends ? `Every stack fights with ${lends}.` : 'His stacks fight on their own numbers, for now.' },
    {
      name: 'Spells',
      note: spells
        ? `${s.casts === 1 ? 'One' : s.casts} a round from the ${spells} in his book, but only while he stands. Mana ${state.hero.mana}/${s.maxMana}: none comes back in battle.`
        : 'None in his book yet: a teacher or a shrine could help.',
    },
    ...(me.charges ? [{ name: 'Charge', note: `${chargeLine(state)}: after a run-up of 3 hexes, started clear of the enemy, a quarter harder, and nobody strikes back.`, trick: true }] : []),
    ...(me.shots ? [{ name: 'Shooter', note: 'Shoots from anywhere, unless an enemy stands beside him. In melee he hits at half strength.' }] : []),
    ...me.abilities.map((a) => ({ name: a.name, note: a.note })),
    // How many spells a round is said above, and who charges too.
    ...leaderTraits(state).filter((n) => !n.name.endsWith('spells a round') && !(me.charges && n.name === 'Charge')),
  ];
  // Where he takes the field: in the line with his army.
  const b = createBattle({ place: 'sheet', seed: 1, player: state.army, enemy: [], hero: heroInBattle(state), obstacles: 0 });
  const at = b.fighters.find((f) => f.hero)?.at;
  return {
    troop: me.troop,
    title: BACKGROUNDS[state.hero.background].title,
    note: t.note,
    stats: [
      { name: 'Attack', value: String(me.attack), note: from(me.attack, t.attack, 'Attack') },
      { name: 'Defence', value: String(me.defence), note: from(me.defence, t.defence, 'Defence') },
      { name: 'Damage', value: me.damage[0] === me.damage[1] ? `${me.damage[0]}` : `${me.damage[0]}\u2013${me.damage[1]}`, note: `each blow${growth ? `: ${growth}` : ''}` },
      { name: 'Health', value: String(me.hp), note: grow ? `+${grow.perLevel.hp} a level` : '' },
      { name: 'Speed', value: String(me.speed), note: 'hexes a turn' },
      ...(me.shots ? [{ name: 'Shots', value: String(me.shots), note: 'a battle' }] : []),
    ],
    traits,
    lines: [
      `In battle ${who} stands ${at === undefined ? ROW_WORDS[4] : ROW_WORDS[rowOf(at)]}.`,
      `If he falls, he\u2019s carried from the field, not killed: the battle goes on without him or his spells, and he goes no further that day.`,
    ],
  };
}
