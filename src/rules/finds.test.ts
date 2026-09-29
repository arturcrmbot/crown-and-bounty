import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../content/aldmoor';
import type { BackgroundId } from '../content/backgrounds';
import { FENMARCH } from '../content/fenmarch';
import type { Province } from '../content/types';
import { withNewPlaces } from './campaign';
import { apply, commissionAt, heroStats, locationById, visit, type Card, type GameState, type Location, type Result } from './game';
import { beat } from './fight';
import { mapOf } from './map/maps';
import { planRoute } from './map/movement';
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
    // The delving's far end stays bricked up until the dwarf opens it.
    expect(labels(start, 'delving')).toEqual(['Close']);
    expect(labels(friend, 'delving')).toContain('Ride the old delving north');
    const map = mapOf(start);
    const hideout = locationById(start, 'hideout').at;
    expect(planRoute(friend, map, hideout, true)).toBeNull();
    const through = choose(friend, 'mine', 'delving/south')!;
    expect(through.events.some((e) => e.type === 'moved')).toBe(true);
    expect(through.state.movement).toBe(0);
    expect(planRoute(through.state, map, hideout, true)).not.toBeNull();
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
    expect(wolves.enemy!.army).toEqual([{ troop: 'wolves', count: 90 }]);
    expect(wolves.enemy!.parleys!.map((p) => p.id)).toEqual(['venison']);
    expect(wolves.enemy!.tamed).toBeTruthy();
    expect(loaded.locations.some((l) => l.id === 'delving')).toBe(true);
    expect(labels(loaded, 'tower')).toContain('Take the journal');
    expect(JSON.parse(JSON.stringify(loaded))).toEqual(loaded);
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
