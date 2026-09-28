import { BACKGROUNDS } from '../content/backgrounds';
import { BOON_IDS, BOONS, COMMISSIONS, type Commission } from '../content/campaign';
import { VILLAINS } from '../content/villains';
import { generateCommission } from './generate';
import { heroStats, VETERANS } from './hero';
import { beginCommission } from './scenario';
import { addTroops, armyLine, close, coins, leadershipUsed, roll, roman, show, TROOPS, type Army, type BoonId, type Campaign, type Card, type GameState, type Location, type Result } from './state';

/** Commissions in a campaign: the hand-made ones, then provinces generated for this campaign. */
export const CAMPAIGN_LENGTH = 5;

const generated = new Map<string, Commission>();

/** The campaign's seed, with the one old saves had without knowing it. */
export const campaignSeed = (campaign: Pick<Campaign, 'seed'>) => campaign.seed ?? 1066;

/** The commission for a chapter: hand-made, or generated from the campaign's seed (once, then kept). */
export function commissionAt(campaign: Pick<Campaign, 'seed'>, chapter: number): Commission {
  if (chapter < COMMISSIONS.length) return COMMISSIONS[chapter];
  const seed = (campaignSeed(campaign) * 31 + chapter * 977) >>> 0;
  const key = `${seed}/${chapter}`;
  let c = generated.get(key);
  if (!c) {
    c = generateCommission(seed, VILLAINS[(chapter - COMMISSIONS.length) % VILLAINS.length], chapter);
    generated.set(key, c);
  }
  return c;
}

export const commissionOf = (state: GameState) => commissionAt(state.campaign, state.campaign.chapter);
export const provinceOf = (state: GameState) => commissionOf(state).province;
export const hasNextCommission = (state: GameState) => state.campaign.chapter + 1 < CAMPAIGN_LENGTH;

/** What a place says and offers, as opposed to what has happened to it: a save takes the newest. */
const WORDS = ['text', 'pages', 'artifact', 'reveals', 'gold'] as const;
const ENEMY_WORDS = ['lines', 'threat', 'flees', 'loot', 'tamed', 'parleys', 'spoils'] as const;
const pick = <T extends object>(from: T | undefined, keys: readonly (keyof T)[]) => JSON.stringify(keys.map((k) => from?.[k] ?? null));

/**
 * Brings a saved commission up to date with its province. Places added since join it (Aldmoor's
 * archery butts); places never leave `locations`, so a missing one is newer than the save. Places
 * the hero hasn't used up yet take the province's newest words and choices (the tower's banner or
 * journal), keeping everything that has happened to them: where they stand, how many they are.
 * An enemy keeps the artifact it was carrying.
 */
export function withNewPlaces(state: GameState): GameState {
  const province = provinceOf(state).locations;
  const known = new Set(state.locations.map((l) => l.id));
  const added = province.filter((l) => !known.has(l.id));
  let changed = added.length > 0;
  const locations = state.locations.map((l) => {
    const now = province.find((p) => p.id === l.id);
    if (!now || l.done || l.seen) return l;
    let next: Location = l;
    if (!l.enemy && pick(l, WORDS) !== pick(now, WORDS)) next = { ...next, ...Object.fromEntries(WORDS.map((k) => [k, structuredClone(now[k])])) };
    if (l.enemy && now.enemy && pick(l.enemy, ENEMY_WORDS) !== pick(now.enemy, ENEMY_WORDS)) {
      next = { ...next, text: structuredClone(now.text), enemy: { ...l.enemy, ...Object.fromEntries(ENEMY_WORDS.map((k) => [k, structuredClone(now.enemy![k])])) } };
    }
    if (next !== l) changed = true;
    return next;
  });
  return changed ? { ...state, locations: [...locations, ...structuredClone(added)] } : state;
}

/** The share of every stack that stays on between commissions, before the hero's skills. */
export { VETERANS };

export function veterans(army: Army, share = VETERANS): Army {
  return army.map((s) => ({ troop: s.troop, count: Math.floor(s.count * share) })).filter((s) => s.count > 0);
}

/** The army for the next commission: the background's levy, then as many veterans as leadership allows. */
export function nextArmy(state: GameState): Army {
  let army: Army = BACKGROUNDS[state.hero.background].army.map((s) => ({ ...s }));
  const { leadership, veterans: share } = heroStats(state);
  for (const v of veterans(state.army, share).sort((a, b) => TROOPS[b.troop].leadership - TROOPS[a.troop].leadership)) {
    const count = Math.min(v.count, Math.floor((leadership - leadershipUsed(army)) / TROOPS[v.troop].leadership));
    const joined = count > 0 ? addTroops(army, v.troop, count) : null;
    if (joined) army = joined;
  }
  return army;
}

/** Three different boons, drawn from the seed. */
function drawBoons(seed: number): [BoonId[], number] {
  const pool = [...BOON_IDS];
  const picked: BoonId[] = [];
  for (let i = 0; i < 3; i++) {
    const [v, next] = roll(seed);
    seed = next;
    picked.push(pool.splice(Math.floor(v * pool.length), 1)[0]);
  }
  return [picked, seed];
}

/** After a won commission: to court, where the King pays, writes it in the record and offers boons. */
export function toCourt(state: GameState): Result | null {
  if (state.over !== 'won' || !hasNextCommission(state)) return null;
  if (state.campaign.court) return { state, events: [{ type: 'court' }] };
  const [boons, seed] = drawBoons(state.seed);
  const record = [...state.campaign.record, { chapter: state.campaign.chapter, days: state.day, level: state.hero.level }];
  const next: GameState = { ...state, seed, gold: state.gold + commissionOf(state).reward, campaign: { ...state.campaign, record, court: { boons } } };
  return { state: next, events: [{ type: 'court' }] };
}

/** What the court shows now: the King's thanks and his boons, then the next commission once a boon is taken. */
export function courtCard(state: GameState): Card {
  const court = state.campaign.court!;
  if (court.chosen) return briefingCard(state);
  const c = commissionOf(state);
  const done = state.campaign.record[state.campaign.record.length - 1];
  return {
    title: 'The King\u2019s Court',
    lines: [
      c.praise,
      `Commission ${roman(state.campaign.chapter + 1)} took **${done.days} ${done.days === 1 ? 'day' : 'days'}**. The King adds **${coins(c.reward)} gold**, and a boon of your choice:`,
      ...court.boons.map((b) => `**${BOONS[b].name}.** ${BOONS[b].note}`),
    ],
    choices: court.boons.map((b) => ({ label: BOONS[b].name, action: { type: 'boon' as const, id: b } })),
  };
}

export function chooseBoon(state: GameState, id: BoonId): Result | null {
  const court = state.campaign.court;
  if (!court || court.chosen || !court.boons.includes(id)) return null;
  const granted = grant(state, id);
  const next: GameState = { ...granted, campaign: { ...granted.campaign, court: { ...court, chosen: id } } };
  return { state: next, events: [show(briefingCard(next))] };
}

function grant(state: GameState, id: BoonId): GameState {
  const h = state.hero;
  switch (id) {
    case 'fencing':
      return { ...state, hero: { ...h, attack: h.attack + 1 } };
    case 'armourer':
      return { ...state, hero: { ...h, defence: h.defence + 1 } };
    case 'library':
      return { ...state, hero: { ...h, spellPower: h.spellPower + 1 } };
    case 'astronomer':
      return { ...state, hero: { ...h, knowledge: h.knowledge + 1 } };
    case 'warrant':
      return { ...state, leadership: state.leadership + 40 };
    case 'purse':
      return { ...state, gold: state.gold + 1500 };
  }
}

/** The next commission, read out at court, with the army that will ride out for it. */
export function briefingCard(state: GameState): Card {
  const chapter = state.campaign.chapter + 1;
  const c = commissionAt(state.campaign, chapter);
  const kept = nextArmy(state).filter((s) => !BACKGROUNDS[state.hero.background].army.some((l) => l.troop === s.troop && l.count === s.count));
  return {
    title: `Commission ${roman(chapter + 1)}: ${c.province.name.replace(/^the /, 'The ')}`,
    lines: [
      ...c.brief,
      `Your troops go home to their farms${kept.length ? ', apart from a few veterans' : ''}. You ride out with **${armyLine(nextArmy(state))}**, and **${coins(state.gold)} gold**.`,
    ],
    choices: [{ label: 'Ride out', action: { type: 'nextCommission' } }],
  };
}

/** Leaves court for the next province, with the hero, his purse and his veterans. */
export function nextCommission(state: GameState): Result | null {
  if (!state.campaign.court?.chosen || !hasNextCommission(state)) return null;
  const chapter = state.campaign.chapter + 1;
  const start = { hero: state.hero, gold: state.gold, leadership: state.leadership, army: nextArmy(state) };
  const next = beginCommission(commissionAt(state.campaign, chapter).province, roll(state.seed)[1], start, chapter, state.campaign.record, campaignSeed(state.campaign));
  return { state: next, events: [{ type: 'commission' }, show(arrivalCard(next))] };
}

/** After a lost commission: the same one again, from how it began. */
export function retry(state: GameState): Result | null {
  if (state.over !== 'lost') return null;
  const { chapter, start, record } = state.campaign;
  const next = beginCommission(provinceOf(state), roll(state.seed)[1], start, chapter, record, campaignSeed(state.campaign));
  return { state: next, events: [{ type: 'commission' }, show(arrivalCard(next))] };
}

function arrivalCard(state: GameState): Card {
  const c = commissionOf(state);
  return {
    title: `Commission ${roman(state.campaign.chapter + 1)}: ${c.province.name.replace(/^the /, 'The ')}`,
    lines: [...c.arrival, `Day ${roman(state.day)}. ${c.villain} is somewhere out there.`],
    choices: [close],
  };
}

/** The last lines of the final bounty card: every commission, and how long it took. */
export function campaignLines(state: GameState): string[] {
  const record = [...state.campaign.record, { chapter: state.campaign.chapter, days: state.day, level: state.hero.level }];
  return [
    '**The campaign is complete!**',
    ...record.map((r) => `Commission ${roman(r.chapter + 1)}, ${commissionAt(state.campaign, r.chapter).province.name}: ${r.days} ${r.days === 1 ? 'day' : 'days'}.`),
  ];
}
