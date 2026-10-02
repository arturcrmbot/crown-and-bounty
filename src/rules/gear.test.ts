import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../content/aldmoor';
import { ARTIFACTS, piecesOf, SETS, type ArtifactId } from '../content/artifacts';
import type { BackgroundId } from '../content/backgrounds';
import { FENMARCH } from '../content/fenmarch';
import { createBattle, spellCost } from './battle/battle';
import { withNewPlaces } from './campaign';
import { afterVictory } from './fight';
import { apply, commissionAt, heroInBattle, heroStats, locationById, priceOf, visit, type Card, type GameState, type Result } from './game';
import { equip, foundNote, giveArtifact, setLine, unequip, wornLine, wornSets } from './hero';
import { mapOf } from './map/maps';
import { Terrain } from './map/model';
import { costsFor } from './map/movement';
import { beginCommission, newGame } from './scenario';

const fresh = (background: BackgroundId = 'knight'): GameState => ({ ...newGame(1066, ALDMOOR, background), opening: undefined });
const wearing = (ids: ArtifactId[], base = fresh()) => ids.reduce((s, id) => {
  const given = giveArtifact(s, id);
  return Object.values(given.hero.gear).includes(id) ? given : equip(given, id)!.state;
}, base);
const cardOf = (result: Result): Card => {
  const e = result.events.find((x) => x.type === 'card');
  if (!e || e.type !== 'card') throw new Error('no card');
  return e.card;
};
const statusOf = (s: GameState, troop: 'swordsmen' | 'crossbowmen' | 'goblins' | 'trolls') =>
  createBattle({ place: 'x', seed: 1, player: s.army, enemy: [{ troop, count: 10 }], hero: heroInBattle(s), obstacles: 0 }).fighters.find((f) => f.side === 'enemy')!.status;

describe('what he does with a find he wears', () => {
  it('takes it up, puts it on, flies it or keeps it about him, by its kind, and never puts on a loaf (#217)', () => {
    const found = (id: ArtifactId) => foundNote(giveArtifact(fresh('ranger'), id), id);
    expect(found('millersLoaf')).toMatch(/^You keep it about you\. Nobody marches/);
    expect(found('oldBanner')).toMatch(/^Your army marches under it now\./);
    expect(found('oldKingsHawk')).toMatch(/^She rides on your wrist\./);
    expect(found('carvingKnife')).toMatch(/^You take it up\./);
    expect(found('breastplate')).toMatch(/^You put it on\./);
    expect(found('dwarvenHelm')).toMatch(/^You put it on\./);
    // Only what goes on his body is put on.
    for (const a of Object.values(ARTIFACTS)) {
      if (a.slot !== 'armour' && a.slot !== 'helm') expect(wornLine(a.id), a.id).not.toBe('You put it on.');
    }
  });
});

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
    expect(setLine(one, 'carvingKnife')).toBe('*You are wearing 1 of the 3.*');
    // Each piece says what the set does, and the set gives its name once it is complete.
    expect(ARTIFACTS.carvingKnife.note).toContain('Wear it with his feather and hat, and his men start every battle slowed.');
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
    expect(cardOf(visit(flagged, 'castle')).lines).toContain('*They don\u2019t like the look of your Black Banner, so they charge 10% more.*');
    expect(cardOf(visit(fresh(), 'castle')).lines.some((l) => l.includes('charge 10% more'))).toBe(false);
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
    const shod = giveArtifact(fed, 'luckyHorseshoe');
    expect(unequip(shod, 'trinket')!.state.movement).toBe(shod.movement - 20);
  });
});

describe('gear that holds a spell', () => {
  it('lets him cast it in battle while he has it', () => {
    const base = fresh();
    const armed = { ...base, hero: { ...base.hero, gear: { weapon: 'swordOfAldmoor' as const } } };
    expect(heroInBattle(armed).spells).toEqual(base.hero.spells);
    const held = { ...ARTIFACTS.swordOfAldmoor, bonus: { ...ARTIFACTS.swordOfAldmoor.bonus, spells: ['bolt' as const] } };
    const original = ARTIFACTS.swordOfAldmoor;
    ARTIFACTS.swordOfAldmoor = held;
    try {
      expect(heroInBattle(armed).spells).toEqual([...base.hero.spells, 'bolt']);
      expect(armed.hero.spells).not.toContain('bolt');
    } finally {
      ARTIFACTS.swordOfAldmoor = original;
    }
  });
});

describe('after a won battle', () => {
  it('mana comes back and the fallen get up, for a hero whose gear says so', () => {
    const base = { ...fresh('wizard'), hero: { ...fresh('wizard').hero, mana: 2 } };
    const before = [{ troop: 'knights' as const, count: 10 }, { troop: 'archers' as const, count: 20 }];
    const after = { ...base, army: [{ troop: 'knights' as const, count: 6 }] };
    const held = { ...ARTIFACTS.swordOfAldmoor, bonus: { manaBack: 0.5, mend: 0.25 } };
    const original = ARTIFACTS.swordOfAldmoor;
    ARTIFACTS.swordOfAldmoor = held;
    try {
      const worn = { ...after, hero: { ...after.hero, gear: { weapon: 'swordOfAldmoor' as const } } };
      const r = afterVictory(worn, before);
      expect(r.state.hero.mana).toBe(2 + Math.round(heroStats(worn).maxMana * 0.5));
      expect(r.state.army).toEqual([{ troop: 'knights', count: 7 }, { troop: 'archers', count: 5 }]);
      expect(r.lines).toEqual([`As the dust settles, **${Math.round(heroStats(worn).maxMana * 0.5)} mana** comes back to you.`, '**1 Knight** and **5 Archers** get back on their feet.']);
    } finally {
      ARTIFACTS.swordOfAldmoor = original;
    }
    expect(afterVictory(after, before)).toEqual({ state: after, lines: [] });
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
    // The highwaymen are the climb's fourth ring: an army that could take them.
    const fight = apply({ ...fresh(), army: [{ troop: 'knights', count: 60 }, { troop: 'archers', count: 60 }] }, { type: 'choose', id: 'highwaymen', choice: 'auto' })!;
    expect(cardOf(fight).choices.map((c) => c.label)).toContain('Wear the Black Banner');
    const beaten = apply(fight.state, { type: 'equip', artifact: 'blackBanner' })!.state;
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
