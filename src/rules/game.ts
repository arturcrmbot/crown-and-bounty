/** Pure game rules: no DOM, no timers. Every change returns a new state, and dice come from `seed`. */

export type Point = readonly [number, number];

export type Troop = 'peasants' | 'archers' | 'knights';
export type Army = Record<Troop, number>;

export const TROOPS: Record<Troop, { name: string; leadership: number; power: number; wage: number }> = {
  peasants: { name: 'Peasants', leadership: 1, power: 1, wage: 1 },
  archers: { name: 'Archers', leadership: 2, power: 3, wage: 3 },
  knights: { name: 'Knights', leadership: 5, power: 8, wage: 8 },
};

/** Weakest first: the order in which a battle's losses fall. */
const LOSS_ORDER: Troop[] = ['peasants', 'archers', 'knights'];

export const MOVEMENT_PER_DAY = 150;
export const PAYDAY_EVERY = 7;
export const COMMISSION = 1000;
export const LAST_DAY = 100;

export type LocationKind = 'castle' | 'tower' | 'mine' | 'village' | 'mill' | 'chest' | 'gold' | 'patrol' | 'hideout' | 'signpost';

export type Enemy = { lines: string[]; power: number; reward: number };

export type Location = {
  id: string;
  kind: LocationKind;
  name: string;
  at: Point;
  /** One-off places are used up; the mill and recruiters reopen on payday. */
  done: boolean;
  gold?: number;
  recruits?: { troop: Troop; count: number; price: number };
  enemy?: Enemy;
  /** A map point the visit reveals (the tower's journal points at the hideout). */
  reveals?: Point;
};

export type GameState = {
  day: number;
  gold: number;
  leadership: number;
  army: Army;
  movement: number;
  seed: number;
  locations: Location[];
  bounty: 'open' | 'paid';
  over?: 'won' | 'lost';
};

/** What the player can do from a card. `go` rides to a location and visits it on arrival. */
export type Action =
  | { type: 'go'; id: string }
  | { type: 'chest'; id: string; take: 'gold' | 'leadership' }
  | { type: 'recruit'; id: string }
  | { type: 'fight'; id: string }
  | { type: 'endDay' }
  | { type: 'restart' }
  | { type: 'close' };

export type Choice = { label: string; action: Action };

/** A parchment card: a title, a few lines (with **bold**), and choices. */
export type Card = { title: string; lines: string[]; choices: Choice[]; reveal?: Point };

export type Result = { state: GameState; card: Card };

const close: Choice = { label: 'Close', action: { type: 'close' } };
const again: Choice = { label: 'Ride again', action: { type: 'restart' } };

/** Gold amounts as written on a card: 2,000 not 2000. */
const coins = (n: number) => Math.round(n).toLocaleString('en-GB');

export function roman(n: number): string {
  const numerals: [number, string][] = [[100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [value, letters] of numerals) {
    while (n >= value) {
      out += letters;
      n -= value;
    }
  }
  return out;
}

export const armyPower = (army: Army) => LOSS_ORDER.reduce((sum, t) => sum + army[t] * TROOPS[t].power, 0);
export const leadershipUsed = (army: Army) => LOSS_ORDER.reduce((sum, t) => sum + army[t] * TROOPS[t].leadership, 0);
const wages = (army: Army) => LOSS_ORDER.reduce((sum, t) => sum + army[t] * TROOPS[t].wage, 0);

export function armyLine(army: Army): string {
  const parts = (['knights', 'archers', 'peasants'] as Troop[]).filter((t) => army[t] > 0).map((t) => `${army[t]} ${TROOPS[t].name}`);
  return parts.length ? parts.join(' · ') : 'No army at all';
}

/** mulberry32, one step: returns a number in [0, 1) and the next seed. */
export function roll(seed: number): [number, number] {
  const next = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(next ^ (next >>> 15), 1 | next);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

function update(state: GameState, id: string, change: Partial<Location>): GameState {
  return { ...state, locations: state.locations.map((l) => (l.id === id ? { ...l, ...change } : l)) };
}

export const locationById = (state: GameState, id: string) => {
  const found = state.locations.find((l) => l.id === id);
  if (!found) throw new Error(`No location ${id}`);
  return found;
};

/** Removes `amount` of fighting power from the army, weakest troops first. */
function takeLosses(army: Army, amount: number): { army: Army; lost: string[] } {
  const next = { ...army };
  const lost: string[] = [];
  let left = amount;
  for (const troop of LOSS_ORDER) {
    if (left <= 0) break;
    const dead = Math.min(next[troop], Math.ceil(left / TROOPS[troop].power));
    if (dead <= 0) continue;
    next[troop] -= dead;
    left -= dead * TROOPS[troop].power;
    lost.push(`**${dead} ${TROOPS[troop].name}**`);
  }
  return { army: next, lost };
}

/** The card for a place before the hero rides there. */
export function describe(state: GameState, id: string): Card {
  const place = locationById(state, id);
  const go = (label: string): Choice => ({ label, action: { type: 'go', id } });
  switch (place.kind) {
    case 'castle':
      return { title: place.name, lines: ['Your castle, flying the King\u2019s banner.', 'The steward is pretending to count spoons.'], choices: [go('Visit'), close] };
    case 'tower':
      return place.done
        ? { title: place.name, lines: ['Empty now, apart from some very offended crows.'], choices: [close] }
        : { title: place.name, lines: ['Abandoned for nearly a century.', '*Something has disturbed the crows recently.*'], choices: [go('Enter'), close] };
    case 'mine':
      return place.done
        ? { title: place.name, lines: ['The humming has stopped. The dwarf has asked you, twice, to leave.'], choices: [close] }
        : { title: place.name, lines: ['The rails lead into darkness.', 'Something down there is humming.'], choices: [go('Enter'), close] };
    case 'village':
      return { title: place.name, lines: ['Population 340. Friendly, if nosy.'], choices: [go('Visit'), close] };
    case 'mill':
      return { title: place.name, lines: ['The wheel turns. The miller waves a floury hand.'], choices: [go('Visit'), close] };
    case 'chest':
      return { title: place.name, lines: ['Heavy, and locked with a lock that isn\u2019t.'], choices: [go('Open'), close] };
    case 'gold':
      return { title: place.name, lines: ['Someone left in a hurry.'], choices: [go('Take'), close] };
    case 'patrol':
    case 'hideout':
      return { title: place.name, lines: place.enemy!.lines, choices: [go('Approach'), close] };
    case 'signpost':
      return {
        title: place.name,
        lines: [
          '**NORTH:** the Old Watchtower.',
          '**EAST:** Westmere, over the old bridge.',
          '**SOUTH-WEST:** Darkwood, and Baron Grimsby, who owes the Crown three years of taxes and one goose.',
        ],
        choices: [close],
      };
  }
}

/** What happens when the hero arrives. */
export function visit(state: GameState, id: string): Result {
  const place = locationById(state, id);
  switch (place.kind) {
    case 'chest': {
      if (place.done) return { state, card: { title: place.name, lines: ['Empty. You check twice anyway.'], choices: [close] } };
      const gold = place.gold ?? 0;
      return {
        state,
        card: {
          title: place.name,
          lines: [`You pry the lid off. Inside: **${coins(gold)} gold**.`, 'Keep it, or hand it out so the villagers sing your praises across the province?'],
          choices: [
            { label: 'Keep the gold', action: { type: 'chest', id, take: 'gold' } },
            { label: `Hand it out (+${gold / 20} leadership)`, action: { type: 'chest', id, take: 'leadership' } },
          ],
        },
      };
    }
    case 'gold': {
      if (place.done) return { state, card: { title: place.name, lines: ['Nothing left but footprints.'], choices: [close] } };
      const gold = place.gold ?? 0;
      return { state: update({ ...state, gold: state.gold + gold }, id, { done: true }), card: { title: place.name, lines: [`You pocket **${coins(gold)} gold**.`], choices: [close] } };
    }
    case 'tower': {
      if (place.done) return { state, card: describe(state, id) };
      const next = update({ ...state, leadership: state.leadership + 20 }, id, { done: true });
      return {
        state: next,
        card: {
          title: place.name,
          lines: [
            'The crows were guarding an old soldier\u2019s journal: *"Grimsby rides south-west, into Darkwood. He sleeps with the goose."*',
            'Your men find the tower\u2019s old banner and take heart: **+20 leadership**.',
          ],
          choices: [close],
          reveal: place.reveals,
        },
      };
    }
    case 'mine': {
      if (place.done) return { state, card: describe(state, id) };
      const gold = place.gold ?? 0;
      return {
        state: update({ ...state, gold: state.gold + gold }, id, { done: true }),
        card: { title: place.name, lines: [`A forgotten ore cart, still full: **${coins(gold)} gold**.`, 'The humming was a dwarf, who asks you to leave.'], choices: [close] },
      };
    }
    case 'mill': {
      if (place.done) return { state, card: { title: place.name, lines: ['"Next week, officer. Flour doesn\u2019t grow on trees."'], choices: [close] } };
      return {
        state: update({ ...state, movement: state.movement + 40 }, id, { done: true }),
        card: { title: place.name, lines: ['"Flour for the King\u2019s men!" Your troops eat well and march on.', '**+40 movement** today.'], choices: [close] },
      };
    }
    case 'castle':
    case 'village': {
      const offer = place.recruits;
      if (!offer || place.done || offer.count === 0) {
        return { state, card: { title: place.name, lines: ['"All out of volunteers, officer. Come back after payday."'], choices: [close] } };
      }
      const room = Math.floor((state.leadership - leadershipUsed(state.army)) / TROOPS[offer.troop].leadership);
      const count = Math.min(offer.count, room, Math.floor(state.gold / offer.price));
      const name = TROOPS[offer.troop].name;
      const lines = [`**${offer.count} ${name}** will join you for **${coins(offer.price)} gold** each.`];
      if (room < offer.count) lines.push(room > 0 ? `You can only lead ${room} more.` : 'You can\u2019t lead any more troops. Find some leadership first.');
      if (count <= 0) return { state, card: { title: place.name, lines, choices: [close] } };
      return {
        state,
        card: { title: place.name, lines, choices: [{ label: `Recruit ${count} (${coins(count * offer.price)} gold)`, action: { type: 'recruit', id } }, { label: 'Not today', action: { type: 'close' } }] },
      };
    }
    case 'patrol':
    case 'hideout': {
      if (place.done) return { state, card: { title: place.name, lines: ['Nobody here but a few goose feathers.'], choices: [close] } };
      const odds = armyPower(state.army) / place.enemy!.power;
      const hint = odds > 1.35 ? 'They look nervous.' : odds > 0.95 ? 'It will be close.' : 'Your army looks at you. Then at them. Then at you.';
      return {
        state,
        card: {
          title: place.name,
          lines: [...(place.kind === 'hideout' ? ['The Baron shouts from the palisade: *"I have the goose AND the walls!"*'] : ['They level their spears.']), hint],
          choices: [{ label: place.kind === 'hideout' ? 'Storm the stockade' : 'Fight', action: { type: 'fight', id } }, { label: 'Retreat', action: { type: 'close' } }],
        },
      };
    }
    case 'signpost':
      return { state, card: describe(state, id) };
  }
}

export function act(state: GameState, action: Action): Result | null {
  switch (action.type) {
    case 'chest': {
      const place = locationById(state, action.id);
      const gold = place.gold ?? 0;
      const opened = update(state, action.id, { done: true });
      return action.take === 'gold'
        ? { state: { ...opened, gold: state.gold + gold }, card: { title: place.name, lines: [`**+${coins(gold)} gold.** The villagers will never know.`], choices: [close] } }
        : { state: { ...opened, leadership: state.leadership + gold / 20 }, card: { title: place.name, lines: [`The villagers cheer. **+${gold / 20} leadership.**`, 'Somebody starts a song about you. It rhymes \u201cAldric\u201d with \u201cbald trick\u201d.'], choices: [close] } };
    }
    case 'recruit': {
      const place = locationById(state, action.id);
      const offer = place.recruits!;
      const room = Math.floor((state.leadership - leadershipUsed(state.army)) / TROOPS[offer.troop].leadership);
      const count = Math.min(offer.count, room, Math.floor(state.gold / offer.price));
      if (count <= 0) return null;
      const army = { ...state.army, [offer.troop]: state.army[offer.troop] + count };
      const next = update({ ...state, gold: state.gold - count * offer.price, army }, action.id, { recruits: { ...offer, count: offer.count - count } });
      return { state: next, card: { title: place.name, lines: [`**${count} ${TROOPS[offer.troop].name}** join your army.`], choices: [close] } };
    }
    case 'fight':
      return fight(state, action.id);
    case 'endDay':
      return endDay(state);
    default:
      return null;
  }
}

/** Auto-resolved for now: power against power, with a little luck either way. */
export function fight(state: GameState, id: string): Result {
  const place = locationById(state, id);
  const enemy = place.enemy!;
  const [luck, seed] = roll(state.seed);
  const ours = armyPower(state.army) * (0.85 + luck * 0.3);
  if (ours > enemy.power) {
    const { army, lost } = takeLosses(state.army, enemy.power * (enemy.power / ours) * 0.45);
    const lostLine = lost.length ? `You lost ${lost.join(' and ')}.` : 'Nobody on your side so much as stubbed a toe.';
    let next: GameState = update({ ...state, seed, army, gold: state.gold + enemy.reward }, id, { done: true });
    if (place.kind === 'hideout') {
      next = { ...next, bounty: 'paid', over: 'won' };
      return {
        state: next,
        card: {
          title: 'The bounty is paid!',
          lines: ['Baron Grimsby surrenders, still clutching the goose.', lostLine, `The Crown pays **${coins(enemy.reward)} gold**. The royal goose is going home.`, `*Commission complete on day ${roman(next.day)}.*`],
          choices: [again, close],
        },
      };
    }
    return { state: next, card: { title: 'Victory!', lines: [`${place.name} breaks and runs.`, lostLine, `You find **${coins(enemy.reward)} gold** on the road.`], choices: [close] } };
  }
  const { army, lost } = takeLosses(state.army, armyPower(state.army) * 0.25);
  return {
    state: { ...state, seed, army, movement: 0 },
    card: { title: 'Retreat!', lines: ['Your men fall back in good order, mostly.', lost.length ? `You lost ${lost.join(' and ')}.` : '', 'Recruit more troops and try again.'].filter(Boolean), choices: [close] },
  };
}

/** Next day: fresh legs. Every seventh day is payday: the King pays, troops take wages, places restock. */
export function endDay(state: GameState): Result {
  const day = state.day + 1;
  let next: GameState = { ...state, day, movement: MOVEMENT_PER_DAY };
  const lines: string[] = [];
  if ((day - 1) % PAYDAY_EVERY === 0) {
    const pay = wages(state.army);
    next = {
      ...next,
      gold: next.gold + COMMISSION - pay,
      locations: next.locations.map((l) => (l.kind === 'mill' ? { ...l, done: false } : l.recruits ? { ...l, recruits: { ...l.recruits, count: l.recruits.count + 10 } } : l)),
    };
    lines.push(`**Payday!** The King sends **${coins(COMMISSION)} gold**. Your troops take **${coins(pay)}** in wages.`, 'The mill has flour again, and there are fresh volunteers.');
  }
  if (day > LAST_DAY && state.bounty === 'open') {
    next = { ...next, over: 'lost' };
    lines.push('The King\u2019s patience has run out. So has the goose\u2019s.');
  }
  return {
    state: next,
    card: { title: `Day ${roman(day)}`, lines: lines.length ? lines : ['The sun comes up over the province. Your horse looks rested.'], choices: next.over ? [again] : [close] },
  };
}

export function describeHero(state: GameState): Card {
  return {
    title: 'Sir Aldric',
    lines: [
      '*Officer of the Crown*',
      `Day ${roman(state.day)} of ${LAST_DAY}`,
      armyLine(state.army),
      `Leadership **${leadershipUsed(state.army)} / ${state.leadership}**`,
      `**${Math.floor(state.movement)}** movement left today`,
    ],
    choices: [{ label: 'End the day', action: { type: 'endDay' } }, close],
  };
}

export const spendMovement = (state: GameState, cost: number): GameState => ({ ...state, movement: Math.max(0, state.movement - cost) });
