import { BACKGROUNDS } from '../content/backgrounds';
import { BOON_IDS, BOONS, COMMISSIONS, type Commission, type Happened } from '../content/campaign';
import { FRIENDS, type FriendId } from '../content/friends';
import { leads } from '../content/troops';
import { VILLAINS } from '../content/villains';
import { generateCommission } from './generate';
import { heroStats, VETERANS } from './hero';
import { beginCommission } from './scenario';
import { addTroops, armyLine, close, coins, leadershipUsed, listed, roll, roman, show, TROOPS, type Army, type BoonId, type Campaign, type Card, type Choice, type GameState, type Location, type Result } from './state';

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

/** The bounty on the villain, as his WANTED poster gives it: what the Crown pays for taking him at his lair. */
export const bountyOf = (state: Pick<GameState, 'locations'>) => state.locations.find((l) => l.kind === 'hideout')?.enemy?.reward ?? 0;
export const hasNextCommission = (state: GameState) => state.campaign.chapter + 1 < CAMPAIGN_LENGTH;

/** What a place says and offers, as opposed to what has happened to it: a save takes the newest. */
const WORDS = ['text', 'pages', 'artifact', 'reveals', 'gold'] as const;
const ENEMY_WORDS = ['lines', 'threat', 'flees', 'loot', 'tamed', 'parleys', 'spoils', 'taken', 'sortie', 'lastWords'] as const;
/** How a band moves, which comes with the captain who leads it. */
const CAPTAINS_WAYS = ['behaviour', 'range', 'sight', 'wakes', 'bold', 'pace'] as const;
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
  const gear = new Set([...Object.values(state.hero.gear), ...state.hero.pack]);
  const locations = state.locations.map((l) => {
    const now = province.find((p) => p.id === l.id);
    // An armoury stocks what it has been given since, unless he has it already (bought, or found).
    const stock = (now?.wares ?? []).filter((w) => !l.wares?.includes(w) && !gear.has(w));
    if (stock.length) {
      changed = true;
      l = { ...l, wares: [...(l.wares ?? []), ...stock] };
    }
    if (!now || l.done) return l;
    // A captain who has taken a band over since leads it now (Rook, the Baron's wolves), under his name, in his ways
    // and with his words, even if the hero has met the band before: who leads it isn't something that happened to it.
    const captains = l.kind === 'patrol' && l.enemy ? (now.enemy?.army ?? []).filter((s) => leads(s.troop) && !l.enemy!.army.some((x) => x.troop === s.troop)) : [];
    if (captains.length) {
      changed = true;
      const words = Object.fromEntries([...ENEMY_WORDS, ...CAPTAINS_WAYS].map((k) => [k, structuredClone(now.enemy![k])]));
      return { ...l, name: now.name, text: structuredClone(now.text), enemy: { ...l.enemy!, ...words, army: [...l.enemy!.army, ...structuredClone(captains)] } };
    }
    if (l.seen) return l;
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

/**
 * The army for the next commission, and where it comes from: the background's levy, then whoever
 * the companion taken at court brings along (Pike's lads), then as many veterans as leadership allows.
 */
function musterFor(state: GameState): { army: Army; kept: Army } {
  let army: Army = BACKGROUNDS[state.hero.background].army.map((s) => ({ ...s }));
  const { leadership, veterans: share } = heroStats(state);
  const join = (stacks: Army) => {
    const joined: Army = [];
    for (const s of stacks) {
      const count = Math.min(s.count, Math.floor((leadership - leadershipUsed(army)) / TROOPS[s.troop].leadership));
      const next = count > 0 ? addTroops(army, s.troop, count) : null;
      if (!next) continue;
      army = next;
      joined.push({ troop: s.troop, count });
    }
    return joined;
  };
  const chosen = state.campaign.court?.chosen;
  join(chosen && isFriend(chosen) ? (FRIENDS[chosen].brings ?? []) : []);
  const kept = join(veterans(state.army, share).sort((a, b) => TROOPS[b.troop].leadership - TROOPS[a.troop].leadership));
  return { army, kept };
}

/** The army for the next commission: the background's levy, a companion's men, then as many veterans as leadership allows. */
export const nextArmy = (state: GameState): Army => musterFor(state).army;

/** Whether a boon is a person who would ride with him, rather than one of the King's own. */
export const isFriend = (id: BoonId): id is FriendId => id in FRIENDS;

/** Whether the story flags stand as `when` says: `true` for any value at all, anything else exactly. */
export function happened(state: GameState, when: Happened): boolean {
  return Object.entries(when).every(([flag, value]) => (value === true ? Boolean(state.flags?.[flag]) : state.flags?.[flag] === value));
}

/** The King remembers at most this many things you did. */
const MEMORIES = 3;
/** At most this many companions are offered at one court, and always at least one of the King's own boons. */
const FRIEND_BOONS = 2;

/** What the King remembers of this commission, most telling first: up to three things, or his plain word if none. */
export function memoriesOf(state: GameState): string[] {
  const all = commissionOf(state).memories ?? [];
  const told = all.filter((m) => m.when && Object.keys(m.when).length && happened(state, m.when)).slice(0, MEMORIES);
  return (told.length ? told : all.filter((m) => !m.when)).map((m) => m.line);
}

/** People from this commission who would ride on with him: their flags stand, and they aren't with him already. */
export function friendsOf(state: GameState): FriendId[] {
  const riding = state.hero.friends ?? [];
  return (commissionOf(state).friends ?? []).filter((f) => !riding.includes(f.id) && happened(state, f.when)).map((f) => f.id);
}

/**
 * Different boons, drawn from the seed: three, or four for the King's favourite. Up to two of them
 * are people from the commission who would ride on with him, and the rest are the King's own.
 */
function drawBoons(state: GameState, seed: number, count: number): [BoonId[], number] {
  const picked: BoonId[] = [];
  const draw = <T extends BoonId>(pool: T[], upTo: number) => {
    for (let i = 0; i < upTo && pool.length; i++) {
      const [v, next] = roll(seed);
      seed = next;
      picked.push(pool.splice(Math.floor(v * pool.length), 1)[0]);
    }
  };
  draw(friendsOf(state), Math.min(FRIEND_BOONS, count - 1));
  draw([...BOON_IDS], count - picked.length);
  return [picked, seed];
}

/** After a won commission: to court, where the King pays, writes it in the record and offers boons. */
export function toCourt(state: GameState): Result | null {
  if (state.over !== 'won' || !hasNextCommission(state)) return null;
  if (state.campaign.court) return { state, events: [{ type: 'court' }] };
  const [boons, seed] = drawBoons(state, state.seed, 3 + heroStats(state).boons);
  const record = [...state.campaign.record, { chapter: state.campaign.chapter, days: state.day, level: state.hero.level }];
  const next: GameState = { ...state, seed, gold: state.gold + commissionOf(state).reward, campaign: { ...state.campaign, record, court: { boons } } };
  return { state: next, events: [{ type: 'court' }] };
}

/** A boon as its button: a companion with his face and what he'd do, or one of the King's own. */
function boonChoice(id: BoonId): Choice {
  const action = { type: 'boon' as const, id };
  if (isFriend(id)) return { label: FRIENDS[id].name, detail: FRIENDS[id].offer, portrait: FRIENDS[id].portrait, action };
  return { label: BOONS[id].name, detail: BOONS[id].note, action };
}

/** The King's welcome at court: his thanks, and what he has heard you did. The boons come after it. */
export function speechCard(state: GameState): Card {
  return {
    title: 'The King\u2019s Court',
    lines: [commissionOf(state).praise, ...memoriesOf(state)],
    choices: [{ label: 'Your Majesty is too kind.', action: { type: 'close' } }],
  };
}

/** What the court offers now: the King's gold and boons, then the next commission once a boon is taken. */
export function courtCard(state: GameState): Card {
  const court = state.campaign.court!;
  if (court.chosen) return briefingCard(state);
  const c = commissionOf(state);
  const done = state.campaign.record[state.campaign.record.length - 1];
  return {
    title: 'The King\u2019s Thanks',
    wide: true,
    lines: [`Commission ${roman(state.campaign.chapter + 1)} took **${done.days} ${done.days === 1 ? 'day' : 'days'}**. The King adds **${coins(c.reward)} gold**, and a boon of your choice:`],
    choices: court.boons.map(boonChoice),
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
  if (isFriend(id)) return { ...state, hero: { ...h, friends: [...(h.friends ?? []).filter((f) => f !== id), id] } };
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

/** "**Sergeant Pike** rides with you.": who rides with him, by name, or nothing. */
export function companyLine(state: GameState): string[] {
  const names = (state.hero.friends ?? []).map((id) => `**${FRIENDS[id].name}**`);
  if (!names.length) return [];
  return [`${listed(names)} ${names.length > 1 ? 'ride' : 'rides'} with you.`];
}

/** The next commission, read out at court, with who and what will ride out for it. */
export function briefingCard(state: GameState): Card {
  const chapter = state.campaign.chapter + 1;
  const c = commissionAt(state.campaign, chapter);
  const { army, kept } = musterFor(state);
  return {
    title: `Commission ${roman(chapter + 1)}: ${c.province.name.replace(/^the /, 'The ')}`,
    lines: [
      ...c.brief,
      ...companyLine(state),
      `Your troops go home to their farms${kept.length ? ', apart from a few veterans' : ''}. You ride out with **${armyLine(army)}**, and **${coins(state.gold)} gold**.`,
    ],
    choices: [{ label: 'Ride out', action: { type: 'nextCommission' } }],
  };
}

/** Leaves court for the next province, with the hero, his purse, his companions and his veterans. */
export function nextCommission(state: GameState): Result | null {
  const court = state.campaign.court;
  if (!court?.chosen || !hasNextCommission(state)) return null;
  const chapter = state.campaign.chapter + 1;
  const start = { hero: state.hero, gold: state.gold, leadership: state.leadership, army: nextArmy(state) };
  const next = beginCommission(commissionAt(state.campaign, chapter).province, roll(state.seed)[1], start, chapter, state.campaign.record, campaignSeed(state.campaign));
  // Whoever was taken at court says hello as the new province opens.
  const greeting = isFriend(court.chosen) ? [FRIENDS[court.chosen].arrival] : [];
  return { state: next, events: [{ type: 'commission' }, show(arrivalCard(next, greeting))] };
}

/** After a lost commission: the same one again, from how it began. */
export function retry(state: GameState): Result | null {
  if (state.over !== 'lost') return null;
  const { chapter, start, record } = state.campaign;
  const next = beginCommission(provinceOf(state), roll(state.seed)[1], start, chapter, record, campaignSeed(state.campaign));
  return { state: next, events: [{ type: 'commission' }, show(arrivalCard(next))] };
}

function arrivalCard(state: GameState, greeting: string[] = []): Card {
  const c = commissionOf(state);
  return {
    title: `Commission ${roman(state.campaign.chapter + 1)}: ${c.province.name.replace(/^the /, 'The ')}`,
    lines: [...c.arrival, ...greeting, `Day ${roman(state.day)}. ${c.villain} is somewhere out there.`],
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
