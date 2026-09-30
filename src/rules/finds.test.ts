import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../content/aldmoor';
import { FINDS } from '../content/aldmoorFinds';
import type { BackgroundId } from '../content/backgrounds';
import { isBeast } from '../content/troops';
import { FENMARCH } from '../content/fenmarch';
import type { Province } from '../content/types';
import { withNewPlaces } from './campaign';
import { apply, commissionAt, describe as fromAfar, heroStats, leadershipUsed, locationById, payday, update, visit, wages, type Card, type GameState, type Location, type Result } from './game';
import { beat } from './fight';
import { CELL } from './map/model';
import { gridSize, isExplored as seenBit } from './map/fog';
import { mapOf } from './map/maps';
import { daysAway, planRoute } from './map/movement';
import { hireOffer } from './places/enemy';
import { beginCommission, newGame } from './scenario';

const fresh = (background: BackgroundId = 'knight'): GameState => ({ ...newGame(1066, ALDMOOR, background), opening: undefined });
const fen = (background: BackgroundId = 'knight'): GameState => beginCommission(FENMARCH, 1, newGame(1066, ALDMOOR, background).campaign.start, 1, []);
const choose = (state: GameState, id: string, choice: string) => apply(state, { type: 'choose', id, choice });
const take = (state: GameState, id: string, choice: string) => {
  const result = choose(state, id, choice);
  expect(result, `${id} ${choice}`).not.toBeNull();
  return result!.state;
};
const cardOf = (result: Result): Card => {
  const e = result.events.find((x) => x.type === 'card');
  if (!e || e.type !== 'card') throw new Error('no card');
  return e.card;
};
const labels = (state: GameState, id: string) => cardOf(visit(state, id)).choices.map((c) => `${c.label}${c.disabled ? ' [off]' : ''}`);
const has = (state: GameState, artifact: string) => Object.values(state.hero.gear).concat(state.hero.pack).includes(artifact as never);
const count = (army: GameState['army'], troop: string) => army.find((s) => s.troop === troop)?.count ?? 0;
/** Whether the mist has lifted over a map point. */
const isExplored = (state: GameState, [x, y]: readonly [number, number]) => seenBit(state.explored, Math.floor(y / CELL) * gridSize(state.world).width + Math.floor(x / CELL));

describe('Aldmoor\u2019s finds', () => {
  it('asks before wearing the highwaymen\u2019s Black Banner', () => {
    const result = beat(fresh(), 'highwaymen', { title: 'Victory!', lines: [], reward: 0, xp: 0 });
    expect(result.state.hero.gear.banner).toBeUndefined();
    expect(result.state.hero.pack).toContain('blackBanner');
    expect(cardOf(result).choices.map((c) => c.label)).toEqual(['Wear it', 'Keep it in your pack']);
    expect(apply(result.state, cardOf(result).choices[0].action)!.state.hero.gear.banner).toBe('blackBanner');
  });

  it('asks before wearing a drawback artifact found at a place', () => {
    const start = fresh();
    const state = {
      ...start,
      locations: start.locations.map((l) => l.id === 'tower' ? { ...l, pages: undefined, artifact: 'blackBanner' as const, seen: false, done: false } : l),
    };
    const found = visit(state, 'tower');
    expect(found.state.hero.gear.banner).toBeUndefined();
    expect(found.state.hero.pack).toContain('blackBanner');
    expect(cardOf(found).choices.map((c) => c.label)).toEqual(['Wear it', 'Keep it in your pack']);
    expect(apply(found.state, cardOf(found).choices[0].action)!.state.hero.gear.banner).toBe('blackBanner');
  });

  it('the watchtower\u2019s crows let you take the banner or the journal, and the journal brings Sergeant Pike home', () => {
    const banner = take(fresh(), 'tower', 'top/banner');
    expect(banner.hero.gear.banner).toBe('oldBanner');
    expect(labels(banner, 'patrol')).toContain('Give Sergeant Pike his father\u2019s journal [off]');
    const journal = take(fresh(), 'tower', 'top/journal');
    expect(has(journal, 'oldBanner')).toBe(false);
    expect(labels(journal, 'patrol')).toContain('Give Sergeant Pike his father\u2019s journal');
    const home = choose(journal, 'patrol', 'parley/pike')!;
    expect(locationById(home.state, 'patrol').done).toBe(true);
    // The whole patrol goes home with him, so none of it waits behind Grimsby's walls.
    expect(locationById(home.state, 'hideout').enemy!.army).toEqual(locationById(journal, 'hideout').enemy!.army);
    expect(locationById(home.state, 'deserters').recruits).toEqual({ troop: 'swordsmen', count: 20, price: 60 });
    expect(home.state.hero.xp).toBe(journal.hero.xp + 300);
  });

  it('the old mine\u2019s dwarf gives up his cart, or his helmet and the old delving behind the wolves', () => {
    const start = fresh();
    const cart = take(start, 'mine', 'cart/take');
    expect(cart.gold).toBe(start.gold + 400);
    expect(locationById(cart, 'mine').done).toBe(true);
    // A treasure hunter finds half as much again.
    const hunter = { ...start, hero: { ...start.hero, perks: ['treasureHunter' as const] } };
    expect(take(hunter, 'mine', 'cart/take').gold).toBe(start.gold + 600);
    const friend = take(start, 'mine', 'cart/help');
    expect(friend.hero.gear.helm).toBe('dwarvenHelm');
    expect(friend.gold).toBe(start.gold);
    expect(labels(friend, 'mine')).toContain('Ride the old delving south');
    // The delving's far end stays bricked up until the dwarf opens it, and says so from afar too.
    expect(labels(start, 'delving')).toEqual(['Close']);
    expect(labels(friend, 'delving')).toContain('Ride the old delving north');
    expect(fromAfar(start, 'delving').lines.join(' ')).toContain('bricked it up');
    expect(fromAfar(friend, 'delving').lines.join(' ')).not.toContain('bricked');
    expect(fromAfar(friend, 'delving').lines.join(' ')).toContain('The bricks are down');
    // From the mine, the stockade is days away the long way round; the delving comes up a morning's ride from it.
    const map = mapOf(start);
    const hideout = locationById(start, 'hideout').at;
    const atMine: GameState = { ...friend, movement: 150, hero: { ...friend.hero, at: locationById(friend, 'mine').at } };
    expect(daysAway(atMine, map, hideout, true)).toBeGreaterThanOrEqual(2);
    const through = choose(friend, 'mine', 'delving/south')!;
    expect(through.events.some((e) => e.type === 'moved')).toBe(true);
    expect(through.state.movement).toBe(0);
    expect(daysAway({ ...through.state, movement: 150 }, map, hideout, true)).toBe(0);
    const back = take({ ...through.state, movement: 150 }, 'delving', 'open/north');
    const mine = locationById(back, 'mine').at;
    expect(Math.hypot(back.hero.at[0] - mine[0], back.hero.at[1] - mine[1])).toBeLessThan(80);
    expect(choose(cart, 'mine', 'delving/south')).toBeNull();
    // "Not today" has nothing to say, so it just closes the card at either end.
    for (const [id, key] of [['mine', 'delving/stay'], ['delving', 'open/stay']] as const) {
      const stay = choose(friend, id, key)!;
      expect(stay.state.hero.at).toEqual(friend.hero.at);
      expect(stay.events.some((e) => e.type === 'card')).toBe(false);
    }
  });

  it('the mill gives flour every week, and the miller\u2019s loaf or his mum\u2019s fair-wind charm once', () => {
    const start = fresh();
    const first = visit(start, 'mill');
    expect(first.state.movement).toBe(start.movement + 40);
    expect(cardOf(first).choices.map((c) => c.label)).toEqual(['Take the Everlasting Loaf', 'Learn the fair-wind charm']);
    const charm = take(first.state, 'mill', 'miller/wind');
    expect(charm.hero.spells).toContain('haste');
    expect(has(charm, 'millersLoaf')).toBe(false);
    expect(choose(charm, 'mill', 'miller/loaf')).toBeNull();
    expect(cardOf(visit(charm, 'mill')).choices.map((c) => c.label)).toEqual(['Close']);
    // A wizard knows the charm already, so only the loaf is his to take.
    expect(labels(fresh('wizard'), 'mill')).toContain('Learn the fair-wind charm [off]');
  });

  it('St Aldhelm answers a prayer for the goose at Grimsby\u2019s walls, or lends his crown', () => {
    const prayed = take(fresh(), 'shrine', 'start/pray');
    expect(labels(fresh(), 'hideout')).toContain('Whistle St Aldhelm\u2019s hymn [off]');
    const before = locationById(prayed, 'hideout').enemy!.army;
    const whistled = choose(prayed, 'hideout', 'parley/goose')!;
    const after = locationById(whistled.state, 'hideout').enemy!.army;
    expect(count(after, 'crossbowmen')).toBe(count(before, 'crossbowmen') - Math.round(count(before, 'crossbowmen') * 0.5));
    expect(count(after, 'swordsmen')).toBe(count(before, 'swordsmen'));
    expect(count(after, 'baron')).toBe(1);
    expect(cardOf(whistled).lines.some((l) => l.includes('slip away'))).toBe(true);
    // Once is all the goose will do, and the button goes.
    expect(labels(whistled.state, 'hideout').some((l) => l.startsWith('Whistle'))).toBe(false);
    expect(choose(whistled.state, 'hideout', 'parley/goose')).toBeNull();
    const crowned = take(fresh(), 'shrine', 'start/crown');
    expect(heroStats(crowned).tames).toBe(true);
    expect(crowned.flags?.goose).toBeUndefined();
  });
});

describe('the old King\u2019s hunt hall', () => {
  const at = (state: GameState, id: string, dx = -30, dy = 20): GameState => {
    const [x, y] = locationById(state, id).at;
    return { ...state, movement: 150, hero: { ...state.hero, at: [x + dx, y + dy] } };
  };

  it('stays shut, and its card says nothing of why: not even a greyed-out button', () => {
    const shut = visit(fresh(), 'hall');
    expect(cardOf(shut).choices.map((c) => c.label)).toEqual(['Close']);
    expect(cardOf(shut).lines.join(' ')).not.toMatch(/key|lodge|Nan|bear/i);
    expect(locationById(shut.state, 'hall').seen).toBe(true);
    expect(choose(shut.state, 'hall', 'door/open')).toBeNull();
    expect(choose(shut.state, 'hall', 'recruit')).toBeNull();
  });

  it('Old Nan knows where the old King kept its key, once you have seen it, and shows you the way', () => {
    const start = fresh();
    // Before the hall, she has nothing to be asked about, and the question can't be forced.
    const asks = (state: GameState) => labels(state, 'nan').some((l) => l.includes('hunt hall'));
    expect(asks(start)).toBe(false);
    expect(choose(start, 'nan', 'door/hall')).toBeNull();
    const seen = visit(start, 'hall').state;
    expect(labels(seen, 'nan')).toContain('Ask her about the old King\u2019s hunt hall');
    const told = choose(seen, 'nan', 'door/hall')!;
    expect(cardOf(told).lines.join(' ')).toMatch(/lodge in the chase/);
    expect(told.events.some((e) => e.type === 'reveal')).toBe(true);
    const lodge = locationById(told.state, 'lodge').at;
    expect(isExplored(told.state, lodge)).toBe(true);
    expect(isExplored(seen, lodge)).toBe(false);
    // Asked once, the question goes.
    expect(asks(told.state)).toBe(false);
    // She knows the Baron's lullaby too: sung first, her other page asks the same question.
    const sung = take(seen, 'nan', 'door/baron');
    expect(labels(sung, 'nan')).toContain('Ask her about the old King\u2019s hunt hall');
    expect(asks(take(sung, 'nan', 'hearth/hall'))).toBe(false);
  });

  it('bears hold the only way to the lodge: beat them, tame them, or go round through the woods as a ranger', () => {
    const map = mapOf(fresh());
    const lodge = locationById(fresh(), 'lodge').at;
    const knight = at(fresh(), 'nan');
    expect(planRoute(knight, map, lodge)).toBeNull();
    expect(planRoute(update(knight, 'bears', { done: true }), map, lodge)).not.toBeNull();
    expect(planRoute(at(fresh('ranger'), 'nan'), map, lodge)).not.toBeNull();
    // They're Wesnoth's bears: beasts a ranger can win over, when he has room to lead them.
    const bears = locationById(fresh(), 'bears').enemy!;
    expect(bears.army.every((s) => isBeast(s.troop))).toBe(true);
    expect(labels(fresh(), 'bears').some((l) => l.startsWith('Tame them'))).toBe(true);
    const roomy = { ...fresh('ranger'), leadership: 400 };
    const tamed = choose(roomy, 'bears', 'tame')!;
    expect(count(tamed.state.army, 'bears')).toBe(count(bears.army, 'bears'));
    expect(locationById(tamed.state, 'bears').done).toBe(true);
  });

  it('the lodge gives up the key, and the key opens the hall to the old King\u2019s huntsmen, who ask for nothing', () => {
    const start = fresh();
    const keyed = take(start, 'lodge', 'nail/key');
    expect(keyed.flags?.huntKey).toBe(true);
    expect(labels(keyed, 'lodge')).toEqual(['Close']);
    // With the key, the hall opens; the huntsmen come back to it and wait there for him.
    expect(labels(keyed, 'hall')).toEqual(['Open the hall']);
    const opened = choose(keyed, 'hall', 'door/open')!;
    expect(opened.events.some((e) => e.type === 'changed' && e.id === 'hall')).toBe(true);
    // From afar, the hall says it's open once it is.
    expect(fromAfar(keyed, 'hall').lines.join(' ')).toMatch(/nobody has opened/);
    expect(fromAfar(opened.state, 'hall').lines.join(' ')).toMatch(/smoke from the chimney/);
    expect(cardOf(opened).choices.map((c) => c.label)).toEqual([`Recruit 12 (free)`, 'Close']);
    expect(cardOf(opened).lines.join(' ')).toMatch(/Rook/);
    const hall = locationById(opened.state, 'hall');
    expect(hall.recruits).toEqual({ troop: 'huntsmen', count: 12, price: 0, restock: 0 });
    const joined = choose(opened.state, 'hall', 'recruit')!.state;
    expect(count(joined.army, 'huntsmen')).toBe(12);
    expect(joined.gold).toBe(opened.state.gold);
    // They draw no wages, and they aren't beasts: no ranger could tame them, no payday brings more.
    expect(wages(joined.army)).toBe(wages(start.army));
    expect(isBeast('huntsmen')).toBe(false);
    expect(payday(locationById(joined, 'hall')).recruits!.count).toBe(0);
    expect(cardOf(visit(joined, 'hall')).lines.join(' ')).toMatch(/every one of the old King\u2019s huntsmen has gone with you/);
  });

  it('keeps the huntsmen waiting at the hall for a hero with no room to lead them yet', () => {
    const keyed = take(fresh(), 'lodge', 'nail/key');
    const full = { ...keyed, leadership: leadershipUsed(keyed.army) + 9 };
    const opened = take(full, 'hall', 'door/open');
    const some = choose(opened, 'hall', 'recruit')!.state;
    expect(count(some.army, 'huntsmen')).toBe(3);
    expect(locationById(some, 'hall').recruits!.count).toBe(9);
    const grown = choose({ ...some, leadership: some.leadership + 30 }, 'hall', 'recruit')!.state;
    expect(count(grown.army, 'huntsmen')).toBe(12);
  });
});

describe('the old King\u2019s falconer on the heath', () => {
  it('is worth the ride over the river: a clue, and his last hawk', () => {
    const start = fresh();
    // Out on the south-west heath, west of the river: the long way round from the start, but a road to the door.
    const [x, y] = locationById(start, 'falconer').at;
    expect(x).toBeLessThan(800);
    expect(y).toBeGreaterThan(900);
    const map = mapOf(start);
    // A day's ride from the heath road by the old watchtower.
    const fromHeath: GameState = { ...start, movement: 150, hero: { ...start.hero, at: [1100, 900] } };
    expect(daysAway(fromHeath, map, [x, y])).toBeLessThanOrEqual(1);
    const card = cardOf(visit(start, 'falconer'));
    expect(card.lines.join(' ')).toMatch(/it was warm/);
    // No greyed-out button: before the hall is open, going home to it isn't on offer at all.
    expect(card.choices.map((c) => `${c.label}${c.disabled ? ' [off]' : ''}`)).toEqual(['Take Meg with you', 'Ride on']);
    expect(choose(start, 'falconer', 'meg/home')).toBeNull();
    const meg = take(start, 'falconer', 'meg/meg');
    expect(has(meg, 'oldKingsHawk')).toBe(true);
    expect(heroStats(meg).counts).toBe(true);
    expect(heroStats(meg).sight).toBeGreaterThan(heroStats(start).sight);
    expect(labels(meg, 'falconer')).toEqual(['Close']);
    expect(choose(meg, 'falconer', 'meg/meg')).toBeNull();
    // From afar, the block outside the bothy is empty once Meg has gone with him.
    expect(fromAfar(start, 'falconer').lines.join(' ')).toMatch(/a hawk on a block/);
    expect(fromAfar(meg, 'falconer').lines.join(' ')).toMatch(/an empty block/);
  });

  it('comes home to the hunt hall with his lads, once the huntsmen are back there', () => {
    const keyed = take(fresh(), 'lodge', 'nail/key');
    const open = take(keyed, 'hall', 'door/open');
    expect(labels(open, 'falconer')).toEqual(['Take Meg with you', 'Ask him to come home to the hunt hall', 'Ride on']);
    const waiting = locationById(open, 'hall').recruits!.count;
    const home = choose(open, 'falconer', 'meg/home')!;
    expect(locationById(home.state, 'hall').recruits!.count).toBe(waiting + 4);
    expect(cardOf(home).lines.join(' ')).toMatch(/Rook/);
    // He took Meg with him: the bothy is shut up.
    expect(has(home.state, 'oldKingsHawk')).toBe(false);
    expect(cardOf(visit(home.state, 'falconer')).lines.join(' ')).toMatch(/shut up/);
    expect(choose(home.state, 'falconer', 'meg/meg')).toBeNull();
    // From afar, the bothy is shut up and the hall has its hawk.
    expect(fromAfar(home.state, 'falconer').lines.join(' ')).toMatch(/gone home to the hunt hall/);
    expect(fromAfar(home.state, 'hall').lines.join(' ')).toMatch(/a hawk sits on the antlers/);
  });
});

describe('the Fenmarch\u2019s finds', () => {
  it('Brother Anselm spares his staff, a thunderbolt, or a letter to his big sister, the witch', () => {
    expect(take(fen(), 'abbey', 'anselm/staff').hero.gear.weapon).toBe('abbotsStaff');
    expect(take(fen(), 'abbey', 'anselm/bolt').hero.spells).toContain('bolt');
    expect(labels(fen('wizard'), 'abbey')).toContain('Learn the thunderbolt prayer [off]');
    const letter = take(fen(), 'abbey', 'anselm/letter');
    expect(has(letter, 'abbotsStaff')).toBe(false);
    const before = locationById(letter, 'hideout').enemy!.army;
    const read = take(letter, 'hideout', 'parley/letter');
    const after = locationById(read, 'hideout').enemy!.army;
    expect(count(after, 'goblins')).toBe(count(before, 'goblins') - Math.round(count(before, 'goblins') / 2));
    expect(count(after, 'trolls')).toBe(count(before, 'trolls'));
  });

  it('the sinking peat hut saves the wages, the boots, or the punt that slips past the troll', () => {
    const start = fen();
    expect(take(start, 'peathut', 'hut/wages').gold).toBe(start.gold + 500);
    expect(take(start, 'peathut', 'hut/boots').hero.gear.trinket).toBe('eelskinBoots');
    const punt = take(start, 'peathut', 'hut/punt');
    const map = mapOf(start);
    const hideout = locationById(start, 'hideout').at;
    expect(planRoute(punt, map, hideout, true)).toBeNull();
    const south = take(punt, 'peathut', 'punt/south');
    expect(planRoute(south, map, hideout, true)).not.toBeNull();
    const north = take({ ...south, movement: 150 }, 'landing', 'punt/north');
    const hut = locationById(north, 'peathut').at;
    expect(Math.hypot(north.hero.at[0] - hut[0], north.hero.at[1] - hut[1])).toBeLessThan(80);
    expect(planRoute(north, map, locationById(north, 'village').at)).not.toBeNull();
    expect(labels(start, 'landing')).toEqual(['Close']);
  });

  it('the windmill\u2019s miller gives a goblin\u2019s charm or his sons', () => {
    const roomy = { ...fen(), leadership: 300 };
    const sons = take(visit(roomy, 'windmill').state, 'windmill', 'miller/sons');
    expect(count(sons.army, 'archers')).toBe(count(roomy.army, 'archers') + 12);
    expect(choose(sons, 'windmill', 'miller/charm')).toBeNull();
    expect(has(take(roomy, 'windmill', 'miller/charm'), 'goblinCharm')).toBe(true);
  });
});

describe('generated provinces\u2019 finds', () => {
  const province = (seed: number, chapter: number) => commissionAt(newGame(seed).campaign, chapter).province;
  const start = (seed: number, chapter: number, gold = 5000) => {
    const g = newGame(seed);
    return { ...beginCommission(province(seed, chapter), 3, g.campaign.start, chapter, [], g.campaign.seed), gold };
  };

  it('the tower\u2019s note gives the villain away, and comes back at the hideout; or it teaches a charm', () => {
    for (const chapter of [2, 3, 4]) {
      const s = start(1066, chapter);
      const hideout = s.locations.find((l) => l.kind === 'hideout')!;
      const parley = hideout.enemy!.parleys!.find((p) => p.id === 'weakness')!;
      expect(labels(s, hideout.id).some((l) => l.startsWith(parley.label) && l.endsWith('[off]'))).toBe(true);
      expect(choose(s, hideout.id, 'parley/weakness')).toBeNull();
      const noted = take(s, 'tower', 'watch/note');
      const before = locationById(noted, hideout.id).enemy!.army;
      const used = take(noted, hideout.id, 'parley/weakness');
      const troop = parley.effects!.desert!.troop!;
      expect(count(locationById(used, hideout.id).enemy!.army, troop), `${chapter}`).toBeLessThan(count(before, troop));
      expect(used.gold).toBe(noted.gold - (parley.needs?.gold ?? 0));
      const charm = s.locations.find((l) => l.id === 'tower')!.pages![0].choices.find((c) => c.id === 'charm')!;
      const known = { ...s, hero: { ...s.hero, spells: s.hero.spells.filter((x) => x !== charm.effects!.spell) } };
      expect(take(known, 'tower', 'watch/charm').hero.spells).toContain(charm.effects!.spell);
    }
  }, 30_000);

  it('the mine\u2019s gold, or a relic deeper down; the mill\u2019s sons, or a charm', () => {
    for (const chapter of [2, 3, 4]) {
      const s = start(7, chapter);
      const deep = s.locations.find((l) => l.id === 'mine')!.pages![0].choices.find((c) => c.id === 'deep')!;
      const relic = deep.effects!.artifact!;
      expect(relic).not.toBe(s.locations.find((l) => l.id === 'guardian')!.artifact);
      expect(has(take(s, 'mine', 'stash/deep'), relic)).toBe(true);
      expect(take(s, 'mine', 'stash/gold').gold).toBeGreaterThan(s.gold);
      // A hero who has the relic already only sees the gold.
      const owner = { ...s, hero: { ...s.hero, pack: [...s.hero.pack, relic] } };
      expect(choose(owner, 'mine', 'stash/deep')).toBeNull();
      const roomy = { ...s, leadership: 1000 };
      const sons = take(roomy, 'mill', 'miller/sons');
      expect(count(sons.army, 'archers')).toBeGreaterThan(count(roomy.army, 'archers'));
      expect(choose(sons, 'mill', 'miller/charm')).toBeNull();
    }
  }, 30_000);
});

describe('one-off finds', () => {
  const provinces: Province[] = [ALDMOOR, FENMARCH, ...[2, 3, 4].map((c) => commissionAt(newGame(1066).campaign, c).province)];

  it('offer each choice once: whatever a choice does, it sets the flag its page waits on', () => {
    for (const p of provinces) {
      for (const l of p.locations) {
        for (const page of l.pages ?? []) {
          const flag = page.when?.notFlag;
          const doers = page.choices.filter((c) => c.effects && Object.keys(c.effects).some((k) => k !== 'travel'));
          // A question a victory asks (the grain cart's) waits on a flag its spoils set, and any answer spends it.
          if (page.answer && page.when?.flag && !flag) {
            for (const c of page.choices) expect(c.effects?.flags?.[page.when.flag], `${p.id} ${l.id}/${page.id}/${c.id}`).toBe(false);
            continue;
          }
          if (!doers.length || l.kind === 'event' && !flag) continue;
          expect(flag, `${p.id} ${l.id}/${page.id}`).toBeTruthy();
          for (const c of doers) expect(c.effects!.flags?.[flag!], `${p.id} ${l.id}/${page.id}/${c.id}`).toBeTruthy();
        }
      }
    }
  });

  it('are no longer the flat bonus of old: no find gives a stat for good', () => {
    for (const p of provinces) for (const l of p.locations) for (const page of l.pages ?? []) for (const c of page.choices) expect(c.effects?.stats, `${p.id} ${l.id}/${c.id}`).toBeUndefined();
  });
});

describe('Aldmoor\u2019s small finds along the rides (#124)', () => {
  it('a lost pack or the Baron\u2019s hamper says what the gold was in, and is gone once taken', () => {
    const start = fresh();
    const hamper = visit(start, 'hamper');
    expect(hamper.state.gold).toBe(start.gold + 100);
    expect(cardOf(hamper).lines.join(' ')).toMatch(/\*\*100 gold\*\*.*More pie/);
    expect(locationById(hamper.state, 'hamper').done).toBe(true);
    expect(hamper.events.some((e) => e.type === 'removed' && e.id === 'hamper')).toBe(true);
    // A pile with nothing to say is still just scooped up.
    const pile = visit(start, 'gold');
    expect(pile.events.some((e) => e.type === 'card')).toBe(false);
    expect(pile.state.gold).toBe(start.gold + 250);
  });

  it('Old Tam thanks you for his ewes, however you get them back from the rustlers', () => {
    const start = { ...fresh(), gold: 500 };
    expect(labels(start, 'shepherd')).toEqual(['Close']);
    expect(cardOf(visit(start, 'shepherd')).lines.join(' ')).toMatch(/Rustlers/);
    const beaten = beat(start, 'rustlers', { title: 'Victory!', lines: [], reward: 90, xp: 0 }).state;
    const bought = take(start, 'rustlers', 'parley/buy');
    expect(bought.gold).toBe(start.gold - 80);
    // A courtier talks them round instead, so he's never offered them for hire, and the ewes still go home.
    const courtier = fresh('courtier');
    expect(hireOffer(courtier, locationById(courtier, 'rustlers'))).toBeNull();
    const shamed = take(courtier, 'rustlers', 'parley/shame');
    for (const back of [beaten, bought, shamed]) {
      expect(labels(back, 'shepherd')).toEqual(['Shake his hand']);
      const thanked = take(back, 'shepherd', 'home/thanks');
      expect(thanked.hero.xp).toBe(back.hero.xp + 60);
      expect(labels(thanked, 'shepherd')).toEqual(['Close']);
      expect(choose(thanked, 'shepherd', 'home/thanks')).toBeNull();
    }
  });

  it('the Baron\u2019s tax collectors can be fought, paid off, or audited by a courtier, who can\u2019t hire them', () => {
    const knight = { ...fresh(), gold: 500 };
    expect(labels(knight, 'collectors')).toContain('Pay what they say you owe (100 gold)');
    expect(labels(knight, 'collectors')).toContain('Ask to see their sums (Courtier) [off]');
    expect(locationById(take(knight, 'collectors', 'parley/pay'), 'collectors').done).toBe(true);
    const courtier = fresh('courtier');
    expect(hireOffer(courtier, locationById(courtier, 'collectors'))).toBeNull();
    const audited = take(courtier, 'collectors', 'parley/audit');
    expect(locationById(audited, 'collectors').done).toBe(true);
    expect(audited.hero.xp).toBe(courtier.hero.xp + 60);
  });

  it('honey, a smoked eel and St Hubert\u2019s blessing each give a longer day, once', () => {
    for (const [id, choice, more] of [['skeps', 'honey/honey', 40], ['eelcatcher', 'net/eel', 30], ['hubert', 'apple/pray', 30]] as const) {
      const start = { ...fresh(), movement: 50, gold: 100 };
      const taken = take(start, id, choice);
      expect(taken.movement, id).toBe(50 + more);
      expect(labels(taken, id), id).toEqual(['Close']);
      expect(choose(taken, id, choice), id).toBeNull();
    }
  });

  it('the Grey Wethers show half the heath from the top', () => {
    const start = fresh();
    const tower = locationById(start, 'tower').at;
    expect(isExplored(start, tower)).toBe(false);
    const climbed = take(start, 'stones', 'ring/climb');
    expect(isExplored(climbed, tower)).toBe(true);
    expect(labels(climbed, 'stones')).toEqual(['Close']);
  });

  it('the rest are words worth the ride: gossip, a signpost\u2019s joke, a scrap of the Baron\u2019s orders', () => {
    const start = fresh();
    for (const id of ['diggersCamp', 'picketsCamp', 'hayrick', 'goosePond', 'charcoal', 'crossroads', 'tollboard']) {
      const card = cardOf(visit(start, id));
      expect(card.lines.join(' ').length, id).toBeGreaterThan(60);
      expect(card.choices.map((c) => c.label), id).toEqual(['Close']);
    }
    expect(cardOf(visit(start, 'diggersCamp')).lines.join(' ')).toMatch(/G\."/);
    expect(cardOf(visit(start, 'picketsCamp')).lines.join(' ')).toMatch(/G\."/);
  });

  it('reach a save made before them, and nothing else changes', () => {
    const s = fresh();
    const ids = new Set(FINDS.map((f) => f.id));
    const old: GameState = JSON.parse(JSON.stringify({ ...s, locations: s.locations.filter((l) => !ids.has(l.id)) }));
    const loaded = withNewPlaces(old);
    expect(loaded.locations.map((l) => l.id).sort()).toEqual(s.locations.map((l) => l.id).sort());
    expect(loaded.locations.filter((l) => !ids.has(l.id))).toEqual(old.locations);
  });
});

describe('old saves', () => {
  /** The watchtower, mine and wolves as a save from before this change has them. */
  const oldAldmoor = (): GameState => {
    const s = fresh();
    const locations: Location[] = s.locations
      .filter((l) => l.id !== 'delving')
      .map((l) => {
        if (l.id === 'tower') return { ...l, pages: undefined, reveals: locationById(s, 'hideout').at, artifact: 'oldBanner', text: { about: ['Abandoned.'], visit: ['A journal.'] } };
        if (l.id === 'mill') return { ...l, pages: undefined, artifact: 'millersLoaf', seen: true, done: true };
        if (l.id === 'wolves') return { ...l, at: [260, 704], enemy: { ...l.enemy!, tamed: undefined, army: [{ troop: 'wolves', count: 90 }], parleys: [{ id: 'trail', label: 'Lead the pack off the path', needs: { background: 'ranger' }, effects: { done: true } }] } };
        return l;
      });
    return JSON.parse(JSON.stringify({ ...s, locations }));
  };

  it('load with the new choices at places not yet visited, and keep what has happened', () => {
    const loaded = withNewPlaces(oldAldmoor());
    const tower = locationById(loaded, 'tower');
    expect(tower.pages?.[0].id).toBe('top');
    expect(tower.artifact).toBeUndefined();
    expect(tower.reveals).toBeUndefined();
    // A mill already visited keeps its old self: its loaf was given long ago.
    expect(locationById(loaded, 'mill').pages).toBeUndefined();
    const wolves = locationById(loaded, 'wolves');
    expect(wolves.at).toEqual([260, 704]);
    // As many wolves as there were, and Rook the Huntsman, who has taken them over since, in his ways.
    expect(wolves.enemy!.army).toEqual([{ troop: 'wolves', count: 90 }, { troop: 'rook', count: 1 }]);
    expect(wolves.name).toBe('Rook\u2019s Wolves');
    expect(wolves.enemy!.behaviour).toBe('hunt');
    expect(wolves.enemy!.wakes?.day).toBe(8);
    expect(wolves.enemy!.parleys!.map((p) => p.id)).toEqual(['venison']);
    expect(wolves.enemy!.tamed).toBeTruthy();
    expect(loaded.locations.some((l) => l.id === 'delving')).toBe(true);
    expect(labels(loaded, 'tower')).toContain('Take the journal');
    expect(JSON.parse(JSON.stringify(loaded))).toEqual(loaded);
  });

  it('say what places he has seen say now, and keep what they offered him', () => {
    // The delving seen while it was still bricked up, in a save from before it could say it was open.
    const s = fresh();
    const seen = { ...s, locations: s.locations.map((l) => (l.id === 'delving' ? { ...l, seen: true, text: { about: ['An old mine mouth.', '*Bricked up.*'] }, pages: [] } : l)) };
    const loaded = withNewPlaces(JSON.parse(JSON.stringify(seen)) as GameState);
    const delving = locationById(loaded, 'delving');
    expect(delving.text).toEqual(locationById(s, 'delving').text);
    expect(delving.pages).toEqual([]);
    expect(delving.seen).toBe(true);
    const opened = { ...loaded, flags: { ...loaded.flags, delving: true } };
    expect(fromAfar(opened, 'delving').lines.join(' ')).toContain('The bricks are down');
    expect(withNewPlaces(loaded)).toBe(loaded);
    // So do the hunt hall and the falconer's bothy, seen before they could say Old Wat had gone home.
    const old = { ...s, locations: s.locations.map((l) => (l.id === 'hall' || l.id === 'falconer' ? { ...l, seen: true, text: { about: [l.text!.about![0]] } } : l)) };
    const home = { ...withNewPlaces(JSON.parse(JSON.stringify(old)) as GameState), flags: { huntsmen: true, falconer: 'home', watHome: true } };
    expect(fromAfar(home, 'hall').lines.join(' ')).toMatch(/a hawk sits on the antlers/);
    expect(fromAfar(home, 'falconer').lines.join(' ')).toMatch(/gone home to the hunt hall/);
  });

  it('and a save that is up to date comes back as it was', () => {
    const s = fresh();
    expect(withNewPlaces(s)).toBe(s);
    const f = fen();
    expect(withNewPlaces(f)).toBe(f);
  });
});

describe('wells', () => {
  it('fill his mana once a day, in both provinces', () => {
    const thirsty = { ...fresh('wizard'), hero: { ...fresh('wizard').hero, mana: 4 } };
    const map = mapOf(thirsty);
    expect(planRoute(thirsty, map, locationById(thirsty, 'well').at)).not.toBeNull();
    const drunk = visit(thirsty, 'well').state;
    expect(drunk.hero.mana).toBe(heroStats(thirsty).maxMana);
    // Waits for tomorrow: a second drink the same day does nothing more.
    const again = visit({ ...drunk, hero: { ...drunk.hero, mana: 4 } }, 'well').state;
    expect(again.hero.mana).toBe(4);
    // The Fenmarch has its own.
    const fenThirsty = { ...fen('wizard'), hero: { ...fen('wizard').hero, mana: 4 } };
    expect(visit(fenThirsty, 'well').state.hero.mana).toBe(heroStats(fenThirsty).maxMana);
  });

  it('waits for a day he needs it: full mana already drinks nothing', () => {
    const full = fresh('wizard');
    expect(full.hero.mana).toBe(heroStats(full).maxMana);
    expect(visit(full, 'well').state.flags?.['drank:well']).toBeUndefined();
  });
});

describe('Aldmoor, bigger', () => {
  const home = (s: GameState): GameState => ({ ...s, flags: { ...s.flags, pikeHome: true }, movement: 150 });

  it('Mrs Pike waits for her boy, and thanks you once Pike is home: a horseshoe, or a word round Westmere', () => {
    const start = fresh();
    expect(cardOf(visit(start, 'mrsPike')).choices.map((c) => c.label)).toEqual(['Close']);
    expect(cardOf(visit(start, 'mrsPike')).lines.join(' ')).toContain('My boy');
    const gone = { ...start, flags: { patrolGone: true } };
    expect(cardOf(visit(gone, 'mrsPike')).lines.join(' ')).toContain('Darkwood');
    const shoe = take(home(start), 'mrsPike', 'home/horseshoe');
    expect(shoe.hero.gear.trinket === 'luckyHorseshoe' || shoe.hero.pack.includes('luckyHorseshoe')).toBe(true);
    const word = take(home(start), 'mrsPike', 'home/word');
    expect(word.leadership).toBe(start.leadership + 20);
    expect(cardOf(visit(word, 'mrsPike')).choices.map((c) => c.label)).toEqual(['Close']);
  });

  it('sends Pike home to Westmere when he reads his father\u2019s journal', () => {
    const start = { ...fresh(), flags: { pike: true } };
    const read = take(start, 'patrol', 'parley/pike');
    expect(read.flags?.pikeHome).toBe(true);
    const camp = locationById(read, 'deserters');
    expect(Math.hypot(camp.at[0] - locationById(read, 'village').at[0], camp.at[1] - locationById(read, 'village').at[1])).toBeLessThan(200);
  });

  it('has Grimsby\u2019s men digging on the heath: raiding them sets the flag Grimsby answers to', () => {
    const start = fresh();
    const dig = locationById(start, 'diggings');
    expect(dig.enemy?.tier).toBe('band');
    const raided = beat(start, 'diggings', { title: 'Victory!', lines: [], reward: dig.enemy!.reward, xp: 0 }).state;
    expect(raided.flags?.dig).toBe('raided');
  });
});
