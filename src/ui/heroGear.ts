import { ARTIFACTS, slotsForArtifact, type ArtifactId, type Slot } from '../content/artifacts';
import { MAP_SPELLS, SPELLS, STATUSES } from '../content/spells';
import { TROOPS } from '../content/troops';
import { heroStats, unequip, wages, wear, type Action, type GameState } from '../rules/game';
import type { HeroStats } from '../rules/hero';

export type GearPlace = { kind: 'slot'; slot: Slot } | { kind: 'pack'; index: number };
export type GearRow = { name: string; before: string; after: string; change: 'same' | 'up' | 'down' | 'changed' };
export type GearPreview = {
  action: Extract<Action, { type: 'wear' | 'unequip' }>;
  current: ArtifactId | undefined;
  candidate: ArtifactId | undefined;
  target: Slot;
  before: HeroStats;
  after: HeroStats;
  state: GameState;
  rows: GearRow[];
};

export const gearAt = (state: GameState, place: GearPlace) => place.kind === 'slot' ? state.hero.gear[place.slot] : state.hero.pack[place.index];

type NumberKey = { [K in keyof HeroStats]: HeroStats[K] extends number ? K : never }[keyof HeroStats];
const numbers: { key: NumberKey; name: string; percent?: boolean; lower?: boolean; always?: boolean }[] = [
  { key: 'attack', name: 'Attack', always: true },
  { key: 'defence', name: 'Defence', always: true },
  { key: 'spellPower', name: 'Spell power', always: true },
  { key: 'knowledge', name: 'Knowledge', always: true },
  { key: 'casts', name: 'Spells each round', always: true },
  { key: 'maxMana', name: 'Mana capacity' },
  { key: 'leadership', name: 'Leadership' },
  { key: 'movement', name: 'Movement each day' },
  { key: 'sight', name: 'Sight' },
  { key: 'manaDiscount', name: 'Mana saved each spell' },
  { key: 'payday', name: 'Extra gold each payday' },
  { key: 'melee', name: 'Melee damage bonus', percent: true },
  { key: 'ranged', name: 'Shot damage bonus', percent: true },
  { key: 'armour', name: 'Damage prevented', percent: true },
  { key: 'loot', name: 'Treasure gold bonus', percent: true },
  { key: 'recruitPrice', name: 'Recruit price change', percent: true, lower: true },
  { key: 'bribes', name: 'Bribe discount', percent: true },
  { key: 'offRoad', name: 'Off-road discount', percent: true },
  { key: 'luck', name: 'Luck', percent: true },
  { key: 'morale', name: 'Morale', percent: true },
  { key: 'volunteers', name: 'Volunteers each payday' },
  { key: 'restock', name: 'Extra recruits each payday', percent: true },
  { key: 'rents', name: 'Rent each payday' },
  { key: 'interest', name: 'Interest each payday' },
  { key: 'freeRecruits', name: 'Free recruits', percent: true },
  { key: 'carry', name: 'Movement carried over', percent: true },
  { key: 'smells', name: 'Treasure sight' },
  { key: 'spellDamage', name: 'Spell damage bonus', percent: true },
  { key: 'burstPower', name: 'Burst damage each power' },
  { key: 'shooterMelee', name: 'Shooter melee strength', percent: true },
  { key: 'manaBack', name: 'Mana returned after battle', percent: true },
  { key: 'mend', name: 'Fallen returned after battle', percent: true },
  { key: 'veterans', name: 'Extra veterans', percent: true },
  { key: 'choices', name: 'Extra level choices' },
  { key: 'boons', name: 'Extra court choices' },
];

type BoolKey = { [K in keyof HeroStats]: HeroStats[K] extends boolean ? K : never }[keyof HeroStats];
const tricks: { key: BoolKey; name: string }[] = [
  { key: 'volley', name: 'First volley' },
  { key: 'forestWalk', name: 'Hide in woodland' },
  { key: 'hires', name: 'Hire small bands' },
  { key: 'hiresGates', name: 'Hire gatekeepers' },
  { key: 'tames', name: 'Tame beasts' },
  { key: 'beastMaster', name: 'The Ranger\'s taming' },
  { key: 'counts', name: 'Count enemy troops' },
  { key: 'odds', name: 'Exact battle odds' },
  { key: 'shadow', name: 'Shadow every band' },
  { key: 'cows', name: 'Demand surrender' },
  { key: 'massBlessings', name: 'Bless the whole army' },
];

const numberChange = (before: number, after: number, lower = false): GearRow['change'] => before === after ? 'same' : (after > before) !== lower ? 'up' : 'down';
const list = (names: string[]) => [...new Set(names)].join(', ') || 'None';

/** Run the existing gear rules on a prospective state, never dispatching or saving it. */
export function previewGear(state: GameState, place: GearPlace, target?: Slot): GearPreview | null {
  const id = gearAt(state, place);
  if (!id) return null;
  const choices = slotsForArtifact(ARTIFACTS[id].slot);
  const slot = place.kind === 'slot' ? place.slot : target ?? choices.find(s => !state.hero.gear[s]) ?? choices[0];
  if (!choices.includes(slot)) return null;
  const action: GearPreview['action'] = place.kind === 'pack' ? { type: 'wear', from: place.index, slot } : { type: 'unequip', slot };
  const result = place.kind === 'pack' ? wear(state, place.index, slot) : unequip(state, slot);
  if (!result) return null;
  const [before, after] = [heroStats(state), heroStats(result.state)];
  const rows: GearRow[] = [];
  for (const field of numbers) {
    const a = before[field.key], b = after[field.key];
    if (a === b && !field.always) continue;
    const show = (value: number) => field.percent ? `${Math.round(value * 100)}%` : String(value);
    rows.push({ name: field.name, before: show(a), after: show(b), change: numberChange(a, b, field.lower) });
  }
  const exact = (name: string, a: number, b: number, lower = false) => {
    if (a !== b) rows.push({ name, before: String(a), after: String(b), change: numberChange(a, b, lower) });
  };
  exact('Mana left', state.hero.mana, result.state.hero.mana);
  exact('Movement left today', Math.floor(state.movement), Math.floor(result.state.movement));
  exact('Wages each payday', Math.round(wages(state.army) * (1 + before.wages)), Math.round(wages(state.army) * (1 + after.wages)), true);
  for (const field of tricks) {
    const a = before[field.key], b = after[field.key];
    if (a !== b) rows.push({ name: field.name, before: a ? 'Yes' : 'No', after: b ? 'Yes' : 'No', change: b ? 'up' : 'down' });
  }
  const words = (name: string, a: string, b: string) => {
    if (a !== b) rows.push({ name, before: a, after: b, change: 'changed' });
  };
  words('Troops that charge', list(before.charge.map(id => TROOPS[id].name)), list(after.charge.map(id => TROOPS[id].name)));
  words('Enemies start slowed', list(before.slows.map(id => TROOPS[id].name)), list(after.slows.map(id => TROOPS[id].name)));
  words('Map spells', list(before.mapSpells.map(id => MAP_SPELLS[id].name)), list(after.mapSpells.map(id => MAP_SPELLS[id].name)));
  words('Battle spells', list(before.spells.map(id => SPELLS[id].name)), list(after.spells.map(id => SPELLS[id].name)));
  words('Mana while riding', before.manaRate ? `1 per ${Math.round(1 / before.manaRate)} movement` : 'None', after.manaRate ? `1 per ${Math.round(1 / after.manaRate)} movement` : 'None');
  for (const troop of Object.values(TROOPS)) {
    const a = before.troops[troop.id], b = after.troops[troop.id];
    exact(`${troop.name} attack bonus`, a?.attack ?? 0, b?.attack ?? 0);
    exact(`${troop.name} defence bonus`, a?.defence ?? 0, b?.defence ?? 0);
    exact(`${troop.name} extra shots`, a?.shots ?? 0, b?.shots ?? 0);
    words(`${troop.name} wards`, list((before.wards[troop.id] ?? []).map(id => STATUSES[id].name)), list((after.wards[troop.id] ?? []).map(id => STATUSES[id].name)));
  }
  words('Free spell charges', list(before.charges.map(c => `${SPELLS[c.spell].name} (${c.uses})`)), list(after.charges.map(c => `${SPELLS[c.spell].name} (${c.uses})`)));
  return {
    action, current: state.hero.gear[slot], candidate: place.kind === 'pack' ? id : undefined,
    target: slot, before, after, state: result.state, rows,
  };
}
