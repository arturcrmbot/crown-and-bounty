import { ARTIFACTS, type ArtifactId } from '../content/artifacts';
import { BACKGROUNDS } from '../content/backgrounds';
import { PERKS, RANKS, SKILLS, type SkillId } from '../content/skills';
import { winChance } from './fight';
import { CAMPAIGN_LENGTH, campaignLines } from './campaign';
import { parleyChoices } from './parley';
import { foundNote, gainXp, giveArtifact, heroStats, LEVELS } from './hero';
import { revealDisc } from './map/fog';
import {
  addTroops, again, armyLine, close, coins, LAST_DAY, leadershipUsed, locationById, roman, show, TROOPS, troops, update,
  type Army, type Card, type Choice, type GameEvent, type GameState, type Location, type PlaceText, type Result,
} from './state';

/** Experience for finding a place for the first time. */
export const DISCOVERY_XP = 40;

/** Gold from treasure, with the hero's knack for finding it. */
const loot = (state: GameState, gold: number) => Math.round(gold * (1 + heroStats(state).loot));
/** A recruit's price after the hero's charm. */
export const priceOf = (state: GameState, base: number) => Math.max(1, Math.round(base * (1 + heroStats(state).recruitPrice)));

/** The usual words for each kind of place, for provinces that don't give their own. */
const USUAL: Record<Location['kind'], PlaceText> = {
  castle: { about: ['A royal castle.', 'Troops to recruit, and an armoury.'] },
  tower: { about: ['An old tower, long empty.'], done: ['Empty now.'], visit: ['Someone left a note here, long ago.'] },
  mine: { about: ['Something down there is humming.'], done: ['Nothing left but echoes.'], visit: ['A forgotten stash: **{gold} gold**.'] },
  village: { about: ['Friendly, if nosy.'] },
  mill: { about: ['The miller waves.'], done: ['"Next week, officer."'], visit: ['Your troops eat well and march on.'] },
  chest: { about: ['Heavy, and locked with a lock that isn\u2019t.'] },
  gold: { about: ['Someone left in a hurry.'] },
  patrol: { done: ['Nobody here now.'] },
  hideout: { done: ['Nobody here now.'] },
  signpost: { about: ['The arms point every way at once.'] },
  dig: { about: ['The map says here. Your horse is not convinced.'] },
};

/** A place's words: the province's own if it has them, else the usual ones for its kind. */
const words = (place: Location, part: keyof PlaceText): string[] => place.text?.[part] ?? USUAL[place.kind][part] ?? [];

/** "**20 Swordsmen** and **12 Crossbowmen**": what an enemy has, for its card. */
export function forceLine(army: Army): string {
  const parts = army.filter((s) => s.count > 0).map((s) => (TROOPS[s.troop].leadership >= 99 ? `**${TROOPS[s.troop].one}**` : `**${troops(s.troop, s.count)}**`));
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : (parts[0] ?? 'nobody');
}

/** The card for a place before the hero rides there. */
export function describe(state: GameState, id: string): Card {
  const place = locationById(state, id);
  const go = (label: string): Choice => ({ label, action: { type: 'go', id } });
  switch (place.kind) {
    case 'castle':
    case 'village':
    case 'chest':
    case 'gold':
      return { title: place.name, lines: words(place, 'about'), choices: [go({ castle: 'Visit', village: 'Visit', chest: 'Open', gold: 'Take' }[place.kind]), close] };
    case 'tower':
    case 'mine':
    case 'mill':
      if (place.done) return { title: place.name, lines: words(place, 'done'), choices: [close] };
      return { title: place.name, lines: words(place, 'about'), choices: [go(place.kind === 'mill' ? 'Visit' : 'Enter'), close] };
    case 'patrol':
    case 'hideout':
      return { title: place.name, lines: [...place.enemy!.lines, `About ${forceLine(place.enemy!.army)}.`], choices: [go('Approach'), close] };
    case 'signpost':
      return { title: place.name, lines: words(place, 'about'), choices: [close] };
    case 'dig':
      return { title: place.name, lines: words(place, 'about'), choices: [go('Ride there'), close] };
  }
}

/**
 * The first visit to a place: experience for finding it, and whatever it keeps for a hero.
 * Returns the state, the level-up events, and a line for the card.
 */
function discover(state: GameState, id: string): { state: GameState; events: GameEvent[]; lines: string[] } {
  const place = locationById(state, id);
  if (place.seen) return { state, events: [], lines: [] };
  let next = update(state, id, { seen: true });
  const lines: string[] = [];
  if (place.artifact) {
    next = giveArtifact(next, place.artifact);
    lines.push(`You find **${ARTIFACTS[place.artifact].name}**. ${foundNote(next, place.artifact)}`);
  }
  const xp = gainXp(next, DISCOVERY_XP);
  return { state: xp.state, events: xp.events, lines };
}

/** What happens when the hero arrives. */
export function visit(state: GameState, id: string): Result {
  const place = locationById(state, id);
  const say = (next: GameState, card: Card, ...extra: GameEvent[]): Result => ({ state: next, events: [...extra, show(card, place.at, place.id)] });
  /** Adds the first-visit rewards to a card. */
  const found = (next: GameState, card: Card, ...extra: GameEvent[]): Result => {
    const d = discover(next, id);
    return say(d.state, { ...card, lines: [...card.lines, ...d.lines] }, ...extra, ...d.events);
  };
  switch (place.kind) {
    case 'chest': {
      if (place.done) return say(state, { title: place.name, lines: ['Empty. You check twice anyway.'], choices: [close] });
      const gold = loot(state, place.gold ?? 0);
      return say(state, {
        title: place.name,
        lines: [`You pry the lid off. Inside: **${coins(gold)} gold**.`, 'Keep it, or hand it out so the villagers sing your praises across the province?'],
        choices: [
          { label: 'Keep the gold', action: { type: 'chest', id, take: 'gold' } },
          { label: `Hand it out (+${Math.round(gold / 20)} leadership)`, action: { type: 'chest', id, take: 'leadership' } },
        ],
      });
    }
    case 'gold': {
      if (place.done) return say(state, { title: place.name, lines: ['Nothing left but footprints.'], choices: [close] });
      const gold = loot(state, place.gold ?? 0);
      return say(update({ ...state, gold: state.gold + gold }, id, { done: true }), { title: place.name, lines: [`You pocket **${coins(gold)} gold**.`], choices: [close] }, { type: 'removed', id });
    }
    case 'tower': {
      if (place.done) return say(state, describe(state, id));
      const next = update(state, id, { done: true });
      const card: Card = { title: place.name, lines: words(place, 'visit'), choices: [close] };
      if (!place.reveals) return found(next, card);
      const [rx, ry] = place.reveals;
      const seen = { ...next, explored: revealDisc(next.explored, next.world, rx, ry, 90).bits };
      return found(seen, card, { type: 'reveal', at: place.reveals, radius: 90 });
    }
    case 'mine': {
      if (place.done) return say(state, describe(state, id));
      const gold = loot(state, place.gold ?? 0);
      return found(update({ ...state, gold: state.gold + gold }, id, { done: true }), {
        title: place.name,
        lines: words(place, 'visit').map((line) => line.replace('{gold}', coins(gold))),
        choices: [close],
      });
    }
    case 'mill': {
      if (place.done) return say(state, { title: place.name, lines: words(place, 'done'), choices: [close] });
      return found(update({ ...state, movement: state.movement + 40 }, id, { done: true }), {
        title: place.name,
        lines: [...words(place, 'visit'), '**+40 movement** today.'],
        choices: [close],
      });
    }
    case 'castle':
    case 'village': {
      const offer = place.recruits;
      const armoury: Choice[] = place.wares?.length ? [{ label: 'Visit the armoury', action: { type: 'armoury', id } }] : [];
      if (!offer || place.done || offer.count === 0) {
        return found(state, { title: place.name, lines: ['"All out of volunteers, officer. Come back after payday."'], choices: [...armoury, close] });
      }
      const count = recruitable(state, id);
      const room = Math.floor((heroStats(state).leadership - leadershipUsed(state.army)) / TROOPS[offer.troop].leadership);
      const each = priceOf(state, offer.price);
      const lines = [`**${troops(offer.troop, offer.count)}** will join you for **${coins(each)} gold** each.`];
      if (room < offer.count) lines.push(room > 0 ? `You can only lead ${room} more.` : 'You can\u2019t lead any more troops. Find some leadership first.');
      const hire: Choice[] = count > 0 ? [{ label: `Recruit ${count} (${coins(count * each)} gold)`, action: { type: 'recruit', id } }] : [];
      return found(state, { title: place.name, lines, choices: [...hire, ...armoury, { label: 'Not today', action: { type: 'close' } }] });
    }
    case 'patrol':
    case 'hideout': {
      if (place.done) return say(state, { title: place.name, lines: words(place, 'done'), choices: [close] });
      if (state.army.length === 0) return say(state, { title: place.name, lines: [place.enemy!.threat, 'You have no troops to fight with. Recruit some first.'], choices: [...parleyChoices(state, id), { label: 'Retreat', action: { type: 'close' } }] });
      const chance = winChance(state, id);
      const hint = chance >= 0.9 ? 'They look nervous.' : chance >= 0.55 ? 'It will be close.' : 'Your army looks at you. Then at them. Then at you.';
      return say(state, {
        title: place.name,
        lines: [place.enemy!.threat, hint],
        choices: [
          { label: place.enemy!.charge ?? 'Fight', action: { type: 'fight', id } },
          { label: 'Let the sergeants handle it', action: { type: 'autofight', id } },
          ...parleyChoices(state, id),
          { label: 'Retreat', action: { type: 'close' } },
        ],
      });
    }
    case 'signpost':
      return found(state, describe(state, id));
    case 'dig':
      return say(state, { title: place.name, lines: ['Five torn pieces of map, and one very large X.', 'Your men look at the shovel, then at you.'], choices: [{ label: 'Dig here', action: { type: 'dig', id } }, close] });
  }
}

/** Digs up the lost sceptre: the end of the campaign. */
export function dig(state: GameState, id: string): Result | null {
  const place = locationById(state, id);
  if (place.kind !== 'dig' || place.done || state.over) return null;
  const next: GameState = { ...update(state, id, { done: true }), over: 'won' };
  const hero = BACKGROUNDS[state.hero.background].short;
  return {
    state: next,
    events: [
      { type: 'over', result: 'won' },
      show(
        {
          title: 'The Sceptre of Order!',
          lines: [
            'Three feet down, the shovel rings on iron. Inside the box, wrapped for some reason in a goose-feather quilt: the Sceptre of Order, lost since the old King\u2019s day.',
            `King Osric weeps openly. *"Five commissions, and the Sceptre besides! ${hero}, you shall have a castle of your own."*`,
            ...campaignLines(next),
          ],
          choices: [again],
          wide: true,
        },
        place.at,
        place.id,
      ),
    ],
  };
}

/** How many of a recruiter's troops the hero can take now: capped by the offer, leadership and gold. */
export function recruitable(state: GameState, id: string): number {
  const offer = locationById(state, id).recruits;
  if (!offer) return 0;
  if (!addTroops(state.army, offer.troop, 1)) return 0;
  const room = Math.floor((heroStats(state).leadership - leadershipUsed(state.army)) / TROOPS[offer.troop].leadership);
  return Math.max(0, Math.min(offer.count, room, Math.floor(state.gold / priceOf(state, offer.price))));
}

export function openChest(state: GameState, id: string, take: 'gold' | 'leadership'): Result {
  const place = locationById(state, id);
  const gold = loot(state, place.gold ?? 0);
  const opened = update(state, id, { done: true });
  const removed = { type: 'removed', id } as const;
  return take === 'gold'
    ? { state: { ...opened, gold: state.gold + gold }, events: [removed, show({ title: place.name, lines: [`**+${coins(gold)} gold.** The villagers will never know.`], choices: [close] }, place.at, place.id)] }
    : {
        state: { ...opened, leadership: state.leadership + Math.round(gold / 20) },
        events: [removed, show({ title: place.name, lines: [`The villagers cheer. **+${Math.round(gold / 20)} leadership.**`, 'Somebody starts a song about you. It rhymes \u201cAldric\u201d with \u201cbald trick\u201d.'], choices: [close] }, place.at, place.id)],
      };
}

export function recruit(state: GameState, id: string): Result | null {
  const place = locationById(state, id);
  const offer = place.recruits!;
  const count = recruitable(state, id);
  const army = count > 0 ? addTroops(state.army, offer.troop, count) : null;
  if (!army) return null;
  const next = update({ ...state, gold: state.gold - count * priceOf(state, offer.price), army }, id, { recruits: { ...offer, count: offer.count - count } });
  return { state: next, events: [show({ title: place.name, lines: [`**${troops(offer.troop, count)}** join your army.`], choices: [close] }, place.at, place.id)] };
}

/** Whether the hero wears or carries an artifact already. */
const owns = (state: GameState, id: ArtifactId) => Object.values(state.hero.gear).includes(id) || state.hero.pack.includes(id);

/** The armoury's wares, with what you can afford. */
export function armouryCard(state: GameState, id: string): Card {
  const place = locationById(state, id);
  const wares = (place.wares ?? []).filter((w) => !owns(state, w));
  return {
    title: `${place.name}: the armoury`,
    lines: wares.length
      ? ['The armourer polishes something that was already clean.', ...wares.map((w) => `**${ARTIFACTS[w].name}** (${coins(ARTIFACTS[w].price ?? 0)} gold): ${ARTIFACTS[w].note}`)]
      : ['Nothing left but a very tired whetstone.'],
    choices: [...wares.filter((w) => state.gold >= (ARTIFACTS[w].price ?? 0)).map((w) => ({ label: `Buy ${ARTIFACTS[w].name}`, action: { type: 'buy' as const, id, artifact: w } })), close],
  };
}

export function buy(state: GameState, id: string, artifact: (typeof ARTIFACTS)[keyof typeof ARTIFACTS]['id']): Result | null {
  const place = locationById(state, id);
  const price = ARTIFACTS[artifact].price ?? 0;
  if (!place.wares?.includes(artifact) || owns(state, artifact) || state.gold < price) return null;
  const next = giveArtifact(update({ ...state, gold: state.gold - price }, id, { wares: place.wares.filter((w) => w !== artifact) }), artifact);
  return { state: next, events: [show({ ...armouryCard(next, id), lines: [`**${ARTIFACTS[artifact].name}** is yours.`, ...armouryCard(next, id).lines] }, place.at, place.id)] };
}

export function describeHero(state: GameState): Card {
  const h = state.hero;
  const s = heroStats(state);
  const b = BACKGROUNDS[h.background];
  const next = LEVELS[h.level + 1];
  const skills = (Object.entries(h.skills) as [SkillId, number][]).map(([id, rank]) => `${RANKS[rank - 1]} ${SKILLS[id].name}`);
  const perks = [b.signature.name, ...h.perks.map((p) => PERKS[p].name)];
  return {
    title: b.title,
    lines: [
      `*Level ${roman(h.level)}* \u00b7 ${next ? `${h.xp} / ${next} experience` : `${h.xp} experience`} \u00b7 Day ${roman(state.day)} of ${LAST_DAY}`,
      `**Attack ${s.attack}, Defence ${s.defence}, Spell power ${s.spellPower}, Knowledge ${s.knowledge}** (mana ${h.mana}/${s.maxMana})`,
      armyLine(state.army),
      `Leadership **${leadershipUsed(state.army)} / ${s.leadership}** \u00b7 **${Math.floor(state.movement)}** movement left today`,
      skills.length ? `Skills: ${skills.join(', ')}` : 'Skills: none yet',
      `Perks: ${perks.join(', ')}`,
      `Pieces of the old map: **${state.campaign.record.length + (state.bounty === 'paid' ? 1 : 0)} of ${CAMPAIGN_LENGTH}**`,
    ],
    choices: [{ label: 'Equipment', action: { type: 'gear' } }, { label: 'End the day', action: { type: 'endDay' } }, close],
  };
}
