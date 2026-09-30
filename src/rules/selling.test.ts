import { describe, expect, it } from 'vitest';
import { ALDMOOR } from '../content/aldmoor';
import { ARTIFACTS, type ArtifactId } from '../content/artifacts';
import { apply, locationById, update, visit, type Card, type ContentChoice, type GameState, type Location, type Result } from './game';
import { giveArtifact, salePrice, sell, UNPRICED_SALE, unequip, wantedAt } from './hero';
import { newGame } from './scenario';

const knight = (): GameState => ({ ...newGame(1066, ALDMOOR, 'knight'), opening: undefined });
/** A knight carrying these in his pack, none of them worn. */
const packing = (ids: ArtifactId[], base = knight()): GameState => ({ ...base, hero: { ...base.hero, pack: [...base.hero.pack, ...ids] } });
const cardOf = (result: Result | null): Card => {
  const e = result?.events.find((x) => x.type === 'card');
  if (!e || e.type !== 'card') throw new Error('no card');
  return e.card;
};
const labels = (card: Card) => card.choices.map((c) => c.label);
const atCastle = (state: GameState, choice: string) => apply(state, { type: 'choose', id: 'castle', choice });
const button = (card: Card, label: string) => card.choices.find((c) => c.label === label);

/** A smith in the woods who only talks to a hero carrying the Old Tower Banner. */
const smithy = (asks: Partial<ContentChoice> = {}): Location => ({
  id: 'smithy',
  kind: 'event',
  name: 'The Old Smithy',
  at: [400, 400],
  done: false,
  pages: [
    {
      id: 'start',
      when: { notFlag: 'smith' },
      lines: ['A smith who knew your banner\u2019s last bearer.'],
      choices: [{ id: 'show', label: 'Show him the banner', needs: { artifact: 'oldBanner' }, effects: { gold: 100, flags: { smith: true } }, ...asks }],
    },
  ],
});
const withSmithy = (state: GameState, place = smithy()): GameState => ({ ...state, locations: [...state.locations, place] });

describe('what the armoury pays', () => {
  it('half the price, and 400 gold for gear with no price: relics, villains\u2019 things, finds', () => {
    expect(salePrice('swordOfAldmoor')).toBe(450);
    expect(salePrice('luckyHorseshoe')).toBe(200);
    expect(salePrice('harrowgateMail')).toBe(800);
    expect(salePrice('headsmansAxe')).toBe(550);
    for (const id of ['poachersHorn', 'hawthornCrown', 'grimsbysHat', 'witchsHat', 'bramblesLadle', 'blackBanner', 'oldBanner'] as const) expect(salePrice(id), id).toBe(UNPRICED_SALE);
    expect(UNPRICED_SALE).toBe(400);
    for (const a of Object.values(ARTIFACTS)) expect(salePrice(a.id), a.id).toBe(a.price ? a.price / 2 : 400);
  });
});

describe('selling spares at the castle armoury', () => {
  it('offers to buy everything in the pack, with the price on each button and a word from the armourer', () => {
    const state = packing(['oldBanner', 'astrolabe']);
    const armoury = cardOf(atCastle(state, 'armoury'));
    expect(labels(armoury).slice(-2)).toEqual(['Sell him your spares', 'Close']);
    const spares = cardOf(atCastle(state, 'spares'));
    expect(spares.title).toBe(armoury.title);
    expect(spares.lines).toEqual(['He eyes your pack. "Half what it cost new, officer. Four hundred if I can\u2019t put a price on it."']);
    expect(labels(spares)).toEqual(['Sell The Old Tower Banner (400 gold)', 'Sell Brass Astrolabe (700 gold)', 'Back to his wares', 'Close']);
    expect(spares.choices.map((c) => c.action)).toEqual([...['sell:oldBanner', 'sell:astrolabe', 'armoury'].map((choice) => ({ type: 'choose', id: 'castle', choice })), { type: 'close' }]);
    expect(spares.choices.every((c) => !c.disabled)).toBe(true);
  });

  it('only buys what is in the pack: worn gear comes off first', () => {
    const worn = giveArtifact(knight(), 'luckyHorseshoe');
    expect(worn.hero.gear.trinket).toBe('luckyHorseshoe');
    expect(labels(cardOf(atCastle(worn, 'armoury')))).not.toContain('Sell him your spares');
    expect(cardOf(atCastle(worn, 'spares')).lines).toEqual(['Your pack is empty. He looks almost disappointed.']);
    expect(atCastle(worn, 'sell:luckyHorseshoe')).toBeNull();
    const off = unequip(worn, 'trinket')!.state;
    expect(labels(cardOf(atCastle(off, 'spares')))[0]).toBe('Sell Lucky Horseshoe (200 gold)');
    expect(atCastle(knight(), 'sell:oldBanner')).toBeNull();
  });

  it('pays up and says so: gear with a price goes back on his wall at full price, the rest is gone', () => {
    const start = packing(['astrolabe', 'oldBanner']);
    const sold = atCastle(start, 'sell:astrolabe')!;
    expect(sold.state.gold).toBe(start.gold + 700);
    expect(sold.state.hero.pack).toEqual(['oldBanner']);
    const card = cardOf(sold);
    expect(card.lines[0]).toBe('The **Brass Astrolabe** is his, for **700 gold**. He hangs it back on the wall, at full price.');
    expect(labels(card)).toEqual(['Sell The Old Tower Banner (400 gold)', 'Back to his wares', 'Close']);
    expect(locationById(sold.state, 'castle').wares).toContain('astrolabe');
    expect(labels(cardOf(atCastle(sold.state, 'armoury')))).toContain('Buy Brass Astrolabe (1,400 gold)');

    const banner = atCastle(sold.state, 'sell:oldBanner')!;
    expect(banner.state.gold).toBe(start.gold + 1100);
    expect(banner.state.hero.pack).toEqual([]);
    expect(cardOf(banner).lines).toEqual(['The **Old Tower Banner** is his, for **400 gold**. He wraps it in sacking and asks no questions.', 'Your pack is empty. He looks almost disappointed.']);
    expect(locationById(banner.state, 'castle').wares).not.toContain('oldBanner');
    expect(atCastle(banner.state, 'sell:oldBanner')).toBeNull();
  });

  it('buys back what he sold, without hanging it up twice', () => {
    const rich = { ...knight(), gold: 5000 };
    const bought = atCastle(rich, 'buy:swordOfAldmoor')!.state;
    const off = unequip(bought, 'weapon')!.state;
    const sold = atCastle(off, 'sell:swordOfAldmoor')!.state;
    expect(sold.gold).toBe(5000 - 900 + 450);
    expect(locationById(sold, 'castle').wares!.filter((w) => w === 'swordOfAldmoor')).toHaveLength(1);
    const again = atCastle(sold, 'buy:swordOfAldmoor')!.state;
    expect(again.hero.gear.weapon).toBe('swordOfAldmoor');
    expect(locationById(again, 'castle').wares).not.toContain('swordOfAldmoor');
  });

  it('won\u2019t buy gear a choice still needs, and says where it\u2019s wanted', () => {
    const state = withSmithy(packing(['oldBanner', 'astrolabe']));
    expect(wantedAt(state, 'oldBanner')?.name).toBe('The Old Smithy');
    expect(wantedAt(state, 'astrolabe')).toBeUndefined();
    const spares = cardOf(atCastle(state, 'spares'));
    expect(button(spares, 'Sell The Old Tower Banner (400 gold)')).toMatchObject({ disabled: true, detail: 'You can\u2019t sell it, because you\u2019ll need it at The Old Smithy.' });
    const astrolabe = button(spares, 'Sell Brass Astrolabe (700 gold)')!;
    expect(astrolabe.action).toEqual({ type: 'choose', id: 'castle', choice: 'sell:astrolabe' });
    expect(astrolabe.disabled).toBeUndefined();
    expect(atCastle(state, 'sell:oldBanner')).toBeNull();
    expect(sell(state, 'oldBanner')).toBeNull();
    // Once the smith has seen it, the page is closed and the banner is just a spare.
    const shown = apply(state, { type: 'choose', id: 'smithy', choice: 'start/show' })!.state;
    expect(wantedAt(shown, 'oldBanner')).toBeUndefined();
    expect(atCastle(shown, 'sell:oldBanner')!.state.gold).toBe(shown.gold + 400);
  });

  it('counts a page that only shows to a hero carrying it, and a parley with a band still standing', () => {
    const plain = smithy({ needs: undefined });
    const page = withSmithy(packing(['oldBanner']), { ...plain, pages: [{ ...plain.pages![0], when: { artifact: 'oldBanner', notFlag: 'smith' } }] });
    expect(wantedAt(page, 'oldBanner')?.id).toBe('smithy');
    expect(wantedAt(withSmithy(packing(['oldBanner']), plain), 'oldBanner')).toBeUndefined();
    const talk: ContentChoice = { id: 'banner', label: 'Show them the banner', needs: { artifact: 'oldBanner' }, effects: { done: true } };
    const base = packing(['oldBanner']);
    const patrol = locationById(base, 'patrol');
    const parley = update(base, 'patrol', { enemy: { ...patrol.enemy!, parleys: [...(patrol.enemy!.parleys ?? []), talk] } });
    expect(wantedAt(parley, 'oldBanner')?.name).toBe(patrol.name);
    expect(wantedAt(update(parley, 'patrol', { done: true }), 'oldBanner')).toBeUndefined();
    // A parley whose flag is spent (the goose already called) asks for nothing any more.
    const spent = update(base, 'patrol', { enemy: { ...patrol.enemy!, parleys: [{ ...talk, needs: { artifact: 'oldBanner', flag: 'goose' } }] } });
    expect(wantedAt(spent, 'oldBanner')).toBeDefined();
    expect(wantedAt({ ...spent, flags: { goose: false } }, 'oldBanner')).toBeUndefined();
  });

  it('keeps the armoury open while there\u2019s anything to buy or sell', () => {
    const soldOut = update(knight(), 'castle', { wares: [] });
    expect(labels(cardOf(visit(soldOut, 'castle')))).not.toContain('Visit the armoury');
    const carrying = packing(['oldBanner'], soldOut);
    expect(labels(cardOf(visit(carrying, 'castle')))).toContain('Visit the armoury');
    const armoury = cardOf(atCastle(carrying, 'armoury'));
    expect(armoury.lines).toEqual(['There is nothing left but a very tired whetstone.']);
    expect(labels(armoury)).toEqual(['Sell him your spares', 'Close']);
    // A village has no armoury, and buys nothing.
    expect(labels(cardOf(visit(carrying, 'village')))).not.toContain('Visit the armoury');
    expect(apply(carrying, { type: 'choose', id: 'village', choice: 'spares' })).toBeNull();
    expect(apply(carrying, { type: 'choose', id: 'village', choice: 'sell:oldBanner' })).toBeNull();
  });

  it('sells one of a pair, and nothing else changes', () => {
    const pair = packing(['oldBanner', 'astrolabe', 'oldBanner']);
    const once = sell(pair, 'oldBanner')!;
    expect(once.events).toEqual([]);
    expect(once.state.hero.pack).toEqual(['astrolabe', 'oldBanner']);
    expect(once.state.gold).toBe(pair.gold + 400);
    expect({ ...once.state, gold: pair.gold, hero: { ...once.state.hero, pack: pair.hero.pack } }).toEqual(pair);
  });
});
