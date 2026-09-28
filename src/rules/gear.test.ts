import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../content/aldmoor';
import { ARTIFACTS, piecesOf, SETS, type ArtifactId } from '../content/artifacts';
import type { BackgroundId } from '../content/backgrounds';
import { FENMARCH } from '../content/fenmarch';
import { createBattle, spellCost } from './battle/battle';
import { withNewPlaces } from './campaign';
import { apply, commissionAt, heroInBattle, heroStats, locationById, priceOf, visit, type Card, type GameState, type Result } from './game';
import { equip, giveArtifact, setLine, unequip, wornSets } from './hero';
import { mapOf } from './map/maps';
import { Terrain } from './map/model';
import { costsFor } from './map/movement';
import { beginCommission, newGame } from './scenario';

const fresh = (background: BackgroundId = 'knight'): GameState => ({ ...newGame(1066, ALDMOOR, background), opening: undefined });
const wearing = (ids: ArtifactId[], base = fresh()) => ids.reduce((s, id) => (s.hero.gear[ARTIFACTS[id].slot] ? equip(giveArtifact(s, id), id)!.state : giveArtifact(s, id)), base);
const cardOf = (result: Result): Card => {
  const e = result.events.find((x) => x.type === 'card');
  if (!e || e.type !== 'card') throw new Error('no card');
  return e.card;
};
const statusOf = (s: GameState, troop: 'swordsmen' | 'crossbowmen' | 'goblins' | 'trolls') =>
  createBattle({ place: 'x', seed: 1, player: s.army, enemy: [{ troop, count: 10 }], hero: heroInBattle(s), obstacles: 0 }).fighters.find((f) => f.side === 'enemy')!.status;

describe('sets', () => {
  it('Grimsby\u2019s Regalia: with all three worn, his men start every battle slowed', () => {
    expect(piecesOf('regalia')).toEqual(['carvingKnife', 'goldenFeather', 'grimsbysHat']);
    const two = wearing(['carvingKnife', 'goldenFeather']);
    expect(wornSets(two)).toEqual([]);
    expect(statusOf(two, 'swordsmen')).toEqual([]);
    const all = wearing(['carvingKnife', 'goldenFeather', 'grimsbysHat']);
    expect(wornSets(all)).toEqual(['regalia']);
    expect(statusOf(all, 'swordsmen')).toContain('slowed');
    expect(statusOf(all, 'crossbowmen')).toContain('slowed');
    // In the pack, a piece doesn't count.
    expect(wornSets(unequip(all, 'helm')!.state)).toEqual([]);
  });

  it('The Fenmarch Finery: goblins and trolls slowed, and cheaper riding off the road', () => {
    const all = wearing(['eelskinBoots', 'trollhide', 'fenBanner']);
    expect(wornSets(all)).toEqual(['finery']);
    expect(statusOf(all, 'goblins')).toContain('slowed');
    expect(statusOf(all, 'trolls')).toContain('slowed');
    const map = mapOf(all);
    expect(costsFor(all, map)[map.terrain.findIndex((t) => t === Terrain.Grass)]).toBe(1.5);
  });

  it('say how far along a set is, and when it is complete', () => {
    const one = wearing(['carvingKnife']);
    expect(setLine(one, 'carvingKnife')).toContain('One of Grimsby\u2019s Regalia (1 of 3 worn)');
    expect(setLine(wearing(['carvingKnife', 'goldenFeather', 'grimsbysHat']), 'grimsbysHat')).toContain('Grimsby\u2019s Regalia is complete!');
    expect(setLine(one, 'swordOfAldmoor')).toBe('');
    for (const set of Object.values(SETS)) expect(piecesOf(set.id).length).toBeGreaterThanOrEqual(3);
  });
});

describe('gear with a price', () => {
  it('trades one number for another', () => {
    const base = heroStats(fresh());
    const axe = heroStats(wearing(['headsmansAxe']));
    expect([axe.attack - base.attack, axe.defence - base.defence]).toEqual([4, -2]);
    const plate = heroStats(wearing(['kingsPlate']));
    expect([plate.defence - base.defence, plate.movement - base.movement]).toEqual([5, -40]);
    const habit = heroStats(wearing(['friarsHabit']));
    expect([habit.knowledge - base.knowledge, habit.defence - base.defence]).toEqual([2, -1]);
  });

  it('Aunt Bramble\u2019s Ladle: more power, dearer spells', () => {
    const wizard = fresh('wizard');
    const ladled = wearing(['bramblesLadle'], wizard);
    expect(heroStats(ladled).spellPower).toBe(heroStats(wizard).spellPower + 3);
    const battle = (s: GameState) => createBattle({ place: 'x', seed: 1, player: s.army, enemy: [{ troop: 'wolves', count: 5 }], hero: heroInBattle(s), obstacles: 0 });
    expect(spellCost(battle(ladled), 'bolt')).toBe(spellCost(battle(wizard), 'bolt') + 1);
  });

  it('the Black Banner: weak bands surrender, but recruits cost a tenth more', () => {
    const flagged = wearing(['blackBanner']);
    expect(heroStats(flagged).cows).toBe(true);
    expect(priceOf(flagged, 100)).toBe(110);
  });

  it('heavy plate slows today\u2019s ride as soon as it goes on, and taking it off gives nothing back', () => {
    const s = giveArtifact(wearing(['breastplate']), 'kingsPlate');
    const fed = { ...s, movement: s.movement + 40 };
    const plated = equip(fed, 'kingsPlate')!.state;
    expect(plated.movement).toBe(fed.movement - 40);
    expect(equip(plated, 'breastplate')!.state.movement).toBe(plated.movement);
    // Gear that doesn't slow him leaves the mill's flour alone.
    const armed = giveArtifact(giveArtifact(fed, 'swordOfAldmoor'), 'headsmansAxe');
    expect(equip(armed, 'headsmansAxe')!.state.movement).toBe(fed.movement);
    // Taking off his boots does slow him.
    const shod = giveArtifact(giveArtifact(fed, 'luckyHorseshoe'), 'wizardsButton');
    expect(equip(shod, 'wizardsButton')!.state.movement).toBe(shod.movement - 20);
  });
});

describe('gear that changes how you ride, count and collect', () => {
  it('the Surveyor\u2019s Chain, the Spyglass, the Ledger, the Drum and the Pilgrim\u2019s Hat', () => {
    expect(heroStats(wearing(['surveyorsChain'])).offRoad).toBe(0.25);
    expect(heroStats(wearing(['spyglass'])).odds).toBe(true);
    let ledger = wearing(['stewardsLedger']);
    const before = heroStats(ledger).payday;
    ledger = visit(visit(ledger, 'village').state, 'castle').state;
    expect(heroStats(ledger).payday).toBe(before + 120);
    expect(heroStats(wearing(['recruitingDrum'])).volunteers).toBe(15);
    expect(heroStats(wearing(['pilgrimsHat'])).manaRate).toBeCloseTo(1 / 20);
  });
});

describe('where the gear is', () => {
  it('in Aldmoor: the chain in the chest, the banner with the highwaymen, a hat at the shrine, a spyglass in the armoury', () => {
    const chest = apply(fresh(), { type: 'choose', id: 'chest', choice: 'keep' })!;
    expect(chest.state.hero.gear.trinket).toBe('surveyorsChain');
    const beaten = apply(fresh(), { type: 'choose', id: 'highwaymen', choice: 'auto' })!.state;
    expect(beaten.hero.gear.banner).toBe('blackBanner');
    const shrine = cardOf(visit(fresh(), 'shrine'));
    expect(shrine.choices.map((c) => c.label)).toContain('Take the pilgrim\u2019s hat');
    const hatted = apply(fresh(), { type: 'choose', id: 'shrine', choice: 'start/hat' })!.state;
    expect(hatted.hero.gear.helm).toBe('pilgrimsHat');
    expect(apply(hatted, { type: 'choose', id: 'shrine', choice: 'start/crown' })).toBeNull();
    expect(locationById(fresh(), 'castle').wares).toContain('spyglass');
  });

  it('in the Fenmarch: a drum and a ledger for sale, and Mother Mirrow\u2019s hat in her hut', () => {
    const fen = beginCommission(FENMARCH, 1066, fresh().campaign.start, 1, []);
    expect(locationById(fen, 'keep').wares).toEqual(expect.arrayContaining(['recruitingDrum', 'stewardsLedger']));
    expect(locationById(fen, 'hideout').artifact).toBe('witchsHat');
  });

  it('in generated provinces: the villains\u2019 own things, and two specials in every armoury', () => {
    const campaign = fresh().campaign;
    const hideout = (chapter: number) => commissionAt(campaign, chapter).province.locations.find((l) => l.kind === 'hideout')!;
    expect(hideout(2).artifact).toBe('grimsbysHat');
    expect(hideout(3).artifact).toBe('bramblesLadle');
    const specials = ['headsmansAxe', 'kingsPlate', 'friarsHabit', 'stewardsLedger', 'recruitingDrum', 'spyglass'];
    for (const chapter of [2, 3, 4]) {
      const castle = commissionAt(campaign, chapter).province.locations.find((l) => l.kind === 'castle')!;
      expect(castle.wares!.filter((w) => specials.includes(w))).toHaveLength(2);
    }
  });

  it('a saved armoury stocks what it sells now, unless he has it already', () => {
    const played = { ...fresh(), locations: fresh().locations.map((l) => (l.id === 'castle' ? { ...l, seen: true, wares: l.wares!.filter((w) => w !== 'spyglass' && w !== 'swordOfAldmoor') } : l)) };
    const owner = giveArtifact(played, 'swordOfAldmoor');
    const loaded = withNewPlaces(JSON.parse(JSON.stringify(owner)));
    const wares = locationById(loaded, 'castle').wares!;
    expect(wares).toContain('spyglass');
    expect(wares).not.toContain('swordOfAldmoor');
  });
});
