// Plays the whole Aldmoor commission through the real UI, fast, and fails loudly: npm run e2e
import { openPage, kc as hooks } from './lib/browser.mjs';
import { startServer } from './lib/server.mjs';

const server = await startServer();
const { browser, page, errors } = await openPage();
const kc = hooks(page);
// With no site code, the visitor counter (#157) loads nothing and sends nothing.
const counted = [];
page.on('request', (request) => /goatcounter\.com|zgo\.at/.test(request.url()) && counted.push(request.url()));
const screen = () => kc.call(() => window.__kc.screen());
let failed = false;
const check = (ok, message) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${message}`);
  if (!ok) failed = true;
};

/** Continue waits for the unit art to load before it leaves the title: wait for it to go. */
const offTitle = () => page.waitForFunction(() => window.__kc.screen() !== 'title', null, { timeout: 15_000 }).catch(() => {});

/** Level-ups wait for a choice whenever no other card is open: take the first thing offered. */
async function settle() {
  // Gains rise off the hero before a level-up card comes up.
  await page.waitForTimeout(400);
  while ((await kc.title())?.startsWith('Level')) {
    const label = await kc.call(() => document.querySelector('.kc-card-wrap:not([hidden]) button').textContent);
    await kc.choose(label);
    learned.push(label);
  }
}
const learned = [];

/** Closes the card, then deals with any level-up it was hiding. An enemy that falls on the camp at dawn is left to the sergeants. */
async function close() {
  // Payday's card opens at the feast by the fire (#191), once its picture is in.
  if ((await screen()) === 'feast') feasts.push((await kc.state()).day);
  if ((await kc.title())?.startsWith('An ambush')) {
    const who = (await kc.lines()).match(/At first light, (.+?) fall on your camp/)?.[1];
    const id = (await kc.state()).ambush;
    await kc.choose('Let the sergeants');
    ambushes.push({ who, id, day: (await kc.state()).day, title: await kc.title(), lines: await kc.lines() });
  }
  await kc.choose('Close');
  await settle();
}
/** Who fell on the camp, when, and how it went. */
const ambushes = [];
/** The paydays that opened the feast. */
const feasts = [];

/**
 * Takes on an enemy the way a patient player would: ride up, and if the sergeants don't like the
 * odds yet, wait for payday, recruit, and come back. Returns the title of the card that follows.
 */
async function beatWhenReady(id, tries = 6, ready = (lines) => lines.includes('nervous')) {
  for (let attempt = 1; attempt <= tries; attempt++) {
    // A hunter may have fallen on the camp at dawn and been seen off by the sergeants already.
    if ((await kc.state()).locations.find((l) => l.id === id)?.done) return ambushes.some((a) => a.id === id && a.title === 'Victory!') ? 'Victory!' : 'done';
    await go(id, 'Approach');
    if (ready(await kc.lines()) || attempt === tries) {
      await kc.choose('Let the sergeants');
      const title = await kc.title();
      if (title === 'Victory!' || title?.endsWith('is taken!')) return title;
      await close();
    } else await kc.choose('Retreat');
    do {
      await settle();
      await page.keyboard.press('e');
      await page.waitForTimeout(40);
      await close();
    } while ((await kc.state()).day % 7 !== 1);
    for (const [place, verb] of [['castle', 'Visit'], ['village', 'Visit'], ['deserters', 'Visit']]) {
      if (!(await kc.state()).locations.some((l) => l.id === place)) continue;
      await go(place, verb);
      await kc.choose('Recruit');
      await close();
    }
  }
  return kc.title();
}

/**
 * A band that moved in the night where he couldn't see it is off the map until he sees it again
 * (#125): ride towards where it roams, as a player who'd seen it there would, and rein in once it's in sight.
 */
async function sight(id) {
  const lost = () => kc.call((i) => Boolean(window.__kc.state().locations.find((l) => l.id === i)?.enemy?.unseen), id);
  if (!(await lost())) return;
  for (let day = 0; day < 8 && (await lost()); day++) {
    await settle();
    if (await kc.title()) await close();
    const [x, y] = (await kc.state()).locations.find((l) => l.id === id).at;
    await kc.view(x, y);
    await kc.click(x, y);
    await page.waitForFunction((i) => {
      const s = window.__kc.status();
      return !window.__kc.state().locations.find((l) => l.id === i)?.enemy?.unseen || (!s.riding && !s.visiting) || s.tired;
    }, id, { timeout: 60_000 });
    if (!(await lost())) break;
    if ((await kc.status()).tired) {
      // The tired card comes once a ride: on the evenings after it, E ends the day.
    if (!(await kc.choose('End the day'))) await page.keyboard.press('e');
      await close();
    }
  }
  if ((await kc.status()).riding) await page.keyboard.press('Escape');
  check(!(await lost()), `${id}, out of sight since it moved, is back on the map once he rides near`);
}

/** Clicks a place, takes its action, and keeps riding (ending days when tired) until the hero gets there. */
async function go(id, action) {
  await settle();
  await sight(id);
  const [x, y] = await kc.centre(id);
  // If the hero stands in front of the place he takes the click, as he should: close his screen
  // and click another corner of the place, as a player would.
  for (const [dx, dy] of [[0, 0], [0, -14], [-16, -8], [16, -8], [-16, 6], [16, 6]]) {
    await kc.click(x + dx, y + dy);
    if ((await screen()) !== 'hero') break;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(60);
  }
  if ((await kc.title()) === 'Unexplored') action = 'Ride there';
  // Already on his way there (looking for them, say), the click rides on with no card.
  const riding = (await kc.status()).visiting === id;
  // Ridden up to them already: their card offers the fight itself.
  if (action === 'Approach' && !riding) {
    const offers = await page
      .waitForFunction(() => [...document.querySelectorAll('.kc-card-wrap:not([hidden]) button')].map((b) => b.textContent).find((t) => t.startsWith('Approach') || t.startsWith('Let the sergeants')), null, { timeout: 3000, polling: 50 })
      .then((h) => h.jsonValue(), () => '');
    if (offers.startsWith('Let the sergeants')) return kc.title();
  }
  if (!riding && !(await kc.choose(action))) throw new Error(`${id}: no "${action}" on "${await kc.title()}": ${await kc.lines()}`);
  for (;;) {
    await page.waitForFunction(() => {
      const s = window.__kc.status();
      return (!s.riding && !s.visiting) || s.tired;
    }, null, { timeout: 60_000 });
    const s = await kc.status();
    if (!(s.riding && s.tired)) break;
    // The tired card comes once a ride: on the evenings after it, E ends the day.
    if (!(await kc.choose('End the day'))) await page.keyboard.press('e');
    await close();
  }
  return kc.title();
}

try {
  await page.goto(`${server.url}?fresh=1&speed=8&seed=1066`);
  await kc.ready();
  check((await screen()) === 'title' && (await kc.title()) === null, 'the game opens on the title, waiting for a click');
  await kc.begin();
  check((await kc.lines())?.includes('goose'), 'a click opens the menu');
  check(!(await kc.choose('Continue')) && (await kc.choose('New campaign')), 'with no save, the title only offers a new campaign');
  check((await screen()) === 'prologue' && (await kc.title()) === 'King Osric', 'the King explains the trouble');
  await kc.choose('At your service');
  check((await kc.title()) === 'WANTED' && (await kc.lines()).includes('Baron Grimsby'), 'then comes the poster for the first villain');
  await kc.choose('I\u2019ll bring him in');
  check((await kc.title()) === 'Who were you, before the King found you?', 'then the King asks who the hero was');
  check(await kc.choose('Knight of the Realm'), 'the knight can be chosen');
  const start = await kc.state();
  check(start.hero.background === 'knight' && start.army[0].troop === 'knights', 'the knight rides out with his knights');
  await kc.choose('Ride out');
  check((await screen()) === 'adventure' && !(await kc.state()).opening, 'then he is on the map, his choice made');
  const told = await page.waitForFunction(() => document.querySelector('.kc-card-wrap:not([hidden]) h3')?.textContent === 'Getting about', null, { timeout: 8000 }).then(() => true, () => false);
  check(told && (await kc.lines()).includes('click it again to ride there') && (await kc.choose('Ride on')), 'the first time the map opens, a card says how to get about');
  const edge = await kc.state();
  check(edge.hero.at[0] > edge.world.width - 200 && edge.hero.facing === -1, 'he starts at the east edge of Aldmoor, on the King\u2019s road, looking into the land');

  // The minimap over the view's top right corner: a click looks there, a drag steers the view, Space brings it back to him.
  const camera = () => kc.call(() => window.__kc.camera());
  await page.waitForTimeout(200);
  await page.mouse.click(779, 148);
  const far = await camera();
  check(far.x === 0 && far.y > 1800 && String((await kc.state()).hero.at) === String(edge.hero.at), `a click on the minimap\u2019s corner looks at Darkwood, across the province (${Math.round(far.x)}, ${Math.round(far.y)}), and he stays put`);
  await page.mouse.move(779, 148);
  await page.mouse.down();
  await page.mouse.move(850, 98, { steps: 8 });
  await page.mouse.up();
  const steered = await camera();
  check(Math.abs(steered.x - 1146) < 20 && Math.abs(steered.y - 978) < 20, `a drag on the minimap steers the view to the middle of Aldmoor (${Math.round(steered.x)}, ${Math.round(steered.y)})`);
  await page.keyboard.press(' ');
  // The view follows him up to the map's edge (the view is 928 by 464).
  const home = await page.waitForFunction(({ at, world }) => {
    const c = window.__kc.camera();
    const near = (v, target, most) => Math.abs(v - Math.max(0, Math.min(most, target))) < 30;
    return near(c.x, at[0] - 464, world.width - 928) && near(c.y, at[1] - 252, world.height - 464);
  }, { at: edge.hero.at, world: edge.world }, { timeout: 10_000 }).then(() => true, () => false);
  check(home, 'and Space brings the view back to him');
  // Tab folds it away, and the map shows where it was; a click on the button left in the corner brings it back.
  const kept = () => kc.call(() => localStorage.getItem('kings-commission/minimap'));
  await page.keyboard.press('Tab');
  await page.mouse.move(850, 98);
  await page.waitForTimeout(80);
  const underneath = await kc.call(() => window.__kc.hover());
  check((await kc.call(() => window.__kc.minimap())) === false && (await kept()) === 'folded' && !underneath?.includes('look there'), `Tab folds the minimap away, and the map shows where it was (${underneath ?? 'no label'})`);
  await page.mouse.move(922, 45);
  await page.waitForTimeout(80);
  check((await kc.call(() => window.__kc.hover()))?.includes('Unfold the map'), 'the button left in its corner says it brings the map back');
  await page.mouse.click(922, 45);
  check((await kc.call(() => window.__kc.minimap())) === true && (await kept()) === 'out', 'and a click on it does');
  await page.mouse.move(2, 2);
  // The journal: J, the book on the bar, or the bounty's name on it.
  await page.keyboard.press('j');
  const journal = () => kc.call(() => document.querySelector('.kc-card-wrap:not([hidden]) .kc-card.journal .heard')?.textContent ?? null);
  check((await kc.title()) === 'Journal' && (await kc.lines()).includes('Baron Grimsby, wanted for three years') && (await journal())?.includes('heard nothing yet'), 'J opens the journal: the poster pinned in, and a page for things heard');
  await page.keyboard.press('j');
  check((await kc.title()) === null, 'and J puts it away');
  await page.mouse.click(901, 512);
  check((await kc.title()) === 'Journal', 'the book on the bar opens it too');
  await page.keyboard.press('Escape');
  await page.mouse.click(540, 512);
  check((await kc.title()) === 'Journal', 'and so does the bounty\u2019s name on the bar');
  await page.keyboard.press('Escape');
  await page.mouse.move(2, 2);
  const heard = () => kc.call(() => window.__kc.sound().effects);

  check((await go('chest', 'Open')) === 'Treasure Chest', 'the chest opens on arrival');
  const lead = (await kc.state()).leadership;
  await kc.choose('Hand it out');
  check((await kc.state()).leadership === lead + 25, 'handing out the chest gives leadership');
  await close();
  await page.waitForTimeout(50);
  check((await heard()).filter((e) => e === 'unfold').length >= 5 && (await heard()).includes('fold'), 'each card unfolds with a crackle of parchment, and folds away when closed');

  const gold = (await kc.state()).gold;
  await go('gold', 'Take');
  check((await kc.state()).gold === gold + 250, 'the gold pile pays 250');
  await close();

  // A card too long for its room says so ("more", and a fade), and turns its words from anywhere on
  // it; the next card opens at its top, however far down the last one was read (#114, #117). The
  // game's own cards, in the page, on letters longer than any in Aldmoor.
  const letter = (title) => ({ title, lines: Array.from({ length: 30 }, (_, i) => `${i + 1}. The King\u2019s officer will kindly read to the end of this letter.`), choices: [{ label: 'Read on', action: { type: 'close' } }] });
  const reading = () => kc.call(() => {
    const card = document.querySelector('.kc-card-wrap.kc-test .kc-card');
    const body = card.querySelector('.kc-card-body');
    return { top: body.scrollTop, cardTop: card.scrollTop, hidden: body.scrollHeight - body.clientHeight, above: card.classList.contains('more-above'), below: card.classList.contains('more-below'), cue: getComputedStyle(card.querySelector('.kc-card-more')).visibility, title: card.querySelector('h3').textContent };
  });
  await kc.call(async (first) => {
    const { CardView } = await import('/src/ui/card.ts');
    const view = new CardView(() => {});
    document.querySelector('.kc-card-wrap:last-child').classList.add('kc-test');
    view.show(first);
    view.place(null, 32, 480);
    window.__cardTest = view;
  }, letter('A long letter'));
  await page.waitForTimeout(250);
  const unread = await reading();
  check(unread.hidden > 0 && unread.top === 0 && unread.below && !unread.above && unread.cue === 'visible', `a card too long for its room shows there\u2019s more (${unread.hidden}px out of sight)`);
  const veiled = await kc.call(() => {
    document.body.classList.add('kc-veiled');
    const seen = getComputedStyle(document.querySelector('.kc-test .kc-card-more span')).visibility;
    document.body.classList.remove('kc-veiled');
    return seen;
  });
  check(veiled === 'hidden', 'and its "more" waits out of sight with it while a screen changes');
  const readOn = await page.locator('.kc-test button', { hasText: 'Read on' }).boundingBox();
  await page.mouse.move(readOn.x + readOn.width / 2, readOn.y + readOn.height / 2);
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(250);
  const wheeled = await reading();
  check(wheeled.top >= 150 && wheeled.above, `the wheel over its buttons turns its words (down ${Math.round(wheeled.top)}px)`);
  await page.locator('.kc-test .kc-card-more span').click();
  await page.waitForTimeout(600);
  const paged = await reading();
  check(paged.top > wheeled.top, `and "more" turns the page (down ${Math.round(paged.top)}px)`);
  await page.mouse.wheel(0, 5000);
  await page.waitForTimeout(400);
  const read = await reading();
  check(read.top >= read.hidden - 2 && !read.below && read.cue === 'hidden', 'read to the end, it stops saying there\u2019s more');
  // As a choice does: this card goes, and whatever it leads to comes up in its place.
  await kc.call((next) => {
    window.__cardTest.hide();
    window.__cardTest.show(next);
  }, letter('Another long letter'));
  const next = await reading();
  check(next.title === 'Another long letter' && next.top === 0 && next.cardTop === 0 && !next.above && next.below, `the next card opens at its top (${next.top}px down)`);
  await kc.call(() => {
    window.__cardTest.dispose();
    delete window.__cardTest;
  });

  const before = await kc.state();
  await page.goto(`${server.url}?speed=8`);
  await kc.ready();
  await kc.begin();
  check((await kc.lines()) !== null && (await kc.choose('Continue')), 'a reload offers to carry on from the title');
  await offTitle();
  const after = await kc.state();
  check(after.gold === before.gold && after.day === before.day, 'the save keeps gold and day');
  check(after.locations.find((l) => l.id === 'chest').done && String(after.hero.at) === String(before.hero.at), 'the save keeps the opened chest and where the hero stands');

  // The patrol is a gate: too strong for a fresh army, and its card says so before anything else (#154).
  await go('patrol', 'Approach');
  const gate = await kc.lines();
  check(gate.includes('looks at you') && /^(The odds are against you|You\u2019d likely lose)\./.test(gate), `the patrol is too strong at first, and its card leads with the odds (${gate.split(' / ')[0]})`);
  await kc.choose('Retreat');

  // The first ring of the climb (#239): cutpurses working the King's road by the castle, the first fight, by hand.
  await go('cutpurses', 'Approach');
  await kc.choose('Fight');
  await page.waitForTimeout(200);
  check((await kc.call(() => window.__kc.screen())) === 'battle', 'fighting the cutpurses opens the battlefield');
  // Wait for the first turn of one of our stacks, then move it by clicking a hex it can reach. Sir
  // Aldric leads from behind the line and never walks the field: on his turns, he waits.
  for (let guard = 0; guard < 10; guard++) {
    await page.waitForFunction(() => {
      const b = window.__kc.battle();
      const s = b.battle();
      const f = s.fighters.find((x) => x.id === s.order[0]);
      return !b.busy() && f.side === 'player';
    }, null, { timeout: 20_000 });
    const leader = await kc.call(() => {
      const b = window.__kc.battle();
      const s = b.battle();
      return s.fighters.find((x) => x.id === s.order[0]).hero && b.moves().length === 0 && b.act({ type: 'defend' });
    });
    if (!leader) break;
  }
  const moved = await kc.call(() => {
    const b = window.__kc.battle();
    const s = b.battle();
    const f = s.fighters.find((x) => x.id === s.order[0]);
    const target = b.moves().sort((x, y) => (y % 11) - (x % 11))[0];
    const action = b.intent(target);
    return action && action.type === 'move' ? { id: f.id, target, ok: b.act(action) } : null;
  });
  const field = await kc.call(() => window.__kc.battle().battle());
  check(!!moved && field.fighters.find((f) => f.id === moved.id).at === moved.target, 'a stack moves where you point it');
  await kc.call(() => window.__kc.battle().auto());
  await page.waitForFunction(() => window.__kc.screen() === 'adventure', null, { timeout: 60_000 });
  check((await kc.title()) === 'Victory!', 'the cutpurses are beaten on the battlefield');
  const din = await heard();
  check(din.includes('feet:hooves') && din.some((e) => e === 'blow:lance' || e === 'blow:blade') && din.includes('dies:man'), 'the battle sounds like who fought it: the knights\u2019 hooves and steel, and the cutpurses crying out as they fall');
  await close();
  // What he picked up on the bridge road goes in the journal, in its own words, still to be used.
  await page.keyboard.press('j');
  const written = await kc.call(() => [...document.querySelectorAll('.kc-card-wrap:not([hidden]) .heard li')].map((li) => `${li.className === 'done' ? '[x]' : '[ ]'} ${li.textContent}`));
  check(written.some((l) => l.startsWith('[ ]') && l.includes('Dear Mum')), `young Pike\u2019s letter goes in the journal, as it was written (${written.join(' / ')})`);
  await close();

  // The patrol holds the bridge, so the watchtower on the heath is the long way round, by the ford.
  const beforeFord = await kc.state();
  const tower = await go('tower', 'Enter');
  check((await kc.state()).day >= beforeFord.day + 2, `the far side of the river is days away by the ford (day ${(await kc.state()).day})`);
  check(tower === 'Old Watchtower', 'the fogged watchtower can be reached and entered');
  check((await kc.lines()).includes('take one') && (await kc.choose('Take the banner')), 'the crows let him take the banner or the journal');
  const tops = await kc.state();
  check(tops.hero.gear.banner === 'oldBanner' || tops.hero.pack.includes('oldBanner'), 'he takes the Old Tower Banner');
  await close();

  // The hero screen: H opens it; artifacts and stacks move by drag and drop, through the rules.
  await page.keyboard.press('h');
  await page.waitForTimeout(100);
  const sheet = () => kc.call(() => window.__kc.hero());
  check((await screen()) === 'hero' && (await sheet())?.title === 'Sir Aldric, Knight of the Realm', 'H opens the hero screen');
  const dragTo = async (from, to) => {
    const at = async (place) => {
      const b = await page.locator(`.kc-hero [data-place="${place}"]`).boundingBox();
      return [b.x + b.width / 2, b.y + b.height / 2];
    };
    const [[x0, y0], [x1, y1]] = [await at(from), await at(to)];
    await page.mouse.move(x0, y0);
    await page.mouse.down();
    await page.mouse.move(x0 + 8, y0 + 8, { steps: 2 });
    await page.mouse.move(x1, y1, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(80);
  };
  if ((await sheet()).slots.banner !== 'oldBanner') await dragTo(`pack:${(await sheet()).pack.indexOf('oldBanner')}`, 'slot:banner');
  // Into the first empty square: the highwaymen's black banner may be in the pack already.
  const free = (await sheet()).pack.length;
  await dragTo('slot:banner', `pack:${free}`);
  let looked = await sheet();
  check(looked.slots.banner === null && looked.pack[free] === 'oldBanner', 'the banner comes off, dragged into the pack');
  await dragTo(`pack:${free}`, 'slot:banner');
  looked = await sheet();
  check(looked.slots.banner === 'oldBanner' && (await kc.state()).hero.gear.banner === 'oldBanner', 'and goes back on, dragged to its slot');
  const line = looked.army;
  await dragTo('stack:1', 'stack:0');
  check(JSON.stringify((await sheet()).army) === JSON.stringify([line[1], line[0], ...line.slice(2)]), 'a stack dragged onto another swaps places with it in the line');
  await dragTo('stack:1', 'stack:0');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(60);
  check((await screen()) === 'adventure' && JSON.stringify((await kc.state()).army.map((a) => `${a.count} ${a.troop}`)) === JSON.stringify(line), 'Escape closes it, with the army as it was');
  await go('mine', 'Enter');
  check(await kc.choose('Take the cart'), 'the dwarf gives up his ore cart');
  await close();
  check(learned.length > 0 && (await kc.state()).hero.level >= 2, `a first fight and some finds bring a level-up (${learned.join(', ')})`);
  await go('castle', 'Visit');
  check(await kc.choose('Recruit'), 'the castle offers knights');
  await close();
  await go('boars', 'Approach');
  await kc.choose('Let the sergeants');
  check((await kc.title()) === 'Victory!', 'the sergeants see off the boars at the edge of the King\u2019s chase');
  await close();
  await go('poachers', 'Approach');
  await kc.choose('Let the sergeants');
  await close();
  await go('village', 'Visit');
  check(await kc.choose('Recruit'), 'Westmere offers peasants');
  await close();

  // Explored and grown: back to the patrol, the wolves, and Grimsby, each when the sergeants like the odds.
  // Not at the cost of half his army, with the Baron and his guard to meet next.
  check((await beatWhenReady('patrol', 6, (lines) => lines.includes('nervous') && !/lose (about half|most)/.test(lines))) === 'Victory!', 'once explored, the sergeants beat the patrol');
  await close();
  // Taking his patrol off the bridge hurts Grimsby: he rides out with his guard to meet the hero, and
  // falls on his camp. Beaten in the open, he flees home to his stockade, and his guard straggles in after him.
  const byGrimsby = () => ambushes.find((a) => a.who === 'Grimsby and his Guard');
  for (let night = 0; night < 8 && !byGrimsby(); night++) {
    await settle();
    const day = (await kc.state()).day;
    await page.keyboard.press('e');
    await page.waitForFunction((d) => window.__kc.state().day > d, day, { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(400);
    await close();
  }
  const met = byGrimsby();
  const now = await kc.state();
  const band = now.locations.find((l) => l.id === 'grimsby');
  const why = band ? `his band ${band.done ? 'went home' : `is at ${band.at.map(Math.round)}`}` : 'he never rode out';
  check(Boolean(met), `Grimsby rides out once his patrol is beaten, and falls on the camp${met ? ` on day ${met.day}` : `: he never came (${why}; Aldric at ${now.hero.at.map(Math.round)})`}`);
  if (met) {
    check(met.title === 'Victory!' && met.lines.includes('Baron Grimsby flees home'), `beaten in the open, Grimsby flees home to his stockade (${met.title})`);
    const stockade = (await kc.state()).locations.find((l) => l.id === 'hideout');
    const swordsmen = stockade.enemy.army.find((s) => s.troop === 'swordsmen')?.count ?? 0;
    const atFirst = start.locations.find((l) => l.id === 'hideout').enemy.army.find((s) => s.troop === 'swordsmen').count;
    check(!stockade.enemy.humbled && stockade.enemy.army.some((s) => s.troop === 'baron') && swordsmen >= atFirst, `and his guard straggles home after him (${swordsmen} swordsmen behind his walls)`);
  }
  check((await kc.state()).locations.some((l) => l.id === 'deserters'), 'deserters make camp by the crossroads');
  await go('deserters', 'Visit');
  check(await kc.choose('Recruit'), 'the deserters\u2019 camp offers swordsmen');
  await close();
  // The highwaymen on the heath road, the climb's fourth ring, once the sergeants like the odds.
  check((await beatWhenReady('highwaymen')) === 'Victory!', 'the sergeants beat the highwaymen on the heath road');
  // Their Black Banner has a drawback, so it waits in the pack, kept rather than worn.
  if (await kc.choose('Keep it in your pack')) await settle();
  else await close();
  await page.keyboard.press('j');
  const orders = await kc.call(() => [...document.querySelectorAll('.kc-card-wrap:not([hidden]) .heard li')].map((li) => li.textContent));
  check(orders.some((l) => l.includes('All patrols back to the stockade')), 'what they carried goes in the journal too: the Baron\u2019s letter, as it was written');
  await close();
  // The armoury buys spares: the highwaymen's Black Banner waits in the pack, kept rather than worn.
  await go('castle', 'Visit');
  const [spare] = (await kc.state()).hero.pack;
  check(Boolean(spare) && (await kc.choose('Visit the armoury')) && (await kc.choose('Sell him your spares')), `the armourer offers to buy his spares (${spare})`);
  const purse = (await kc.state()).gold;
  const offer = await kc.call(() => [...document.querySelectorAll('.kc-card-wrap:not([hidden]) button:not(:disabled)')].map((b) => b.textContent).find((t) => t.startsWith('Sell ')) ?? '');
  const [, paid = ''] = offer.match(/\(([\d,]+) gold\)$/) ?? [];
  check(Boolean(paid) && (await kc.choose(offer)), `with the price on its button: ${offer}`);
  const sold = await kc.state();
  check(sold.gold === purse + Number(paid.replace(/,/g, '')) && !sold.hero.pack.includes(spare) && (await kc.lines()).includes(`is his, for ${paid} gold`), `and pays ${paid} gold for it`);
  await close();
  check((await beatWhenReady('wolves')) === 'Victory!', 'the sergeants beat the wolves');
  await close();
  // The plain player takes Grimsby late: on main he did it on his eighth weekly try (day 69), so he gets a few more (#238).
  await beatWhenReady('hideout', 12);
  const final = await kc.state();
  check(final.over === 'won' && final.bounty === 'paid', `the commission is won on day ${final.day}`);
  check(final.hero.level >= 3, `Sir Aldric grew to level ${final.hero.level} (${learned.join(', ')})`);
  check(feasts.length > 0 && feasts.every((day) => day % 7 === 1), `payday opens the feast by the fire, and closes back to the map (on day ${feasts.join(', ') || 'none'})`);

  // To court: level-ups from the last battle, the King's thanks and a boon, then word that more commissions are coming.
  const first = () => kc.call(() => document.querySelector('.kc-card-wrap:not([hidden]) button')?.textContent ?? null);
  check((await kc.title()) === 'Baron Grimsby is taken!' && (await kc.lines()).includes('your horse'), 'Grimsby is taken, and has the last word');
  const taken = await kc.call(() => {
    const card = document.querySelector('.kc-card-wrap:not([hidden]) .kc-card');
    const body = card.querySelector('.kc-card-body');
    const [fallen, room] = [body.querySelector('.battle-result')?.getBoundingClientRect(), body.getBoundingClientRect()];
    return { fallen: Boolean(fallen) && fallen.top >= room.top && fallen.bottom <= room.bottom, after: fallen ? Math.round(fallen.top - room.top) : null, long: body.scrollHeight > body.clientHeight + 2, more: card.classList.contains('more-below') };
  });
  check(taken.fallen && taken.more === taken.long, `his card has the fallen in sight, near its top (${taken.after}px down)${taken.long ? ', and says there\u2019s more below' : ''}`);
  check((await kc.choose('Claim the bounty')) && (await kc.title()) === 'WANTED' && (await kc.lines()).includes('paid in full'), 'his poster comes back, paid in full');
  check(await kc.choose('Ride to the King'), 'the poster sends Sir Aldric to court');
  await page.waitForTimeout(100);
  check((await screen()) === 'court', 'the throne room opens');
  while ((await kc.title())?.startsWith('Level')) {
    learned.push(await first());
    await kc.choose(await first());
  }
  check((await kc.title()) === 'The King\u2019s Court', 'the King receives him');
  const speech = await kc.lines();
  check(speech.includes('ore cart') && speech.includes('old Pike\u2019s banner'), 'and remembers what he did: the dwarf\u2019s cart, and the watchtower\u2019s banner');
  const atCourt = await kc.state();
  check(atCourt.gold === final.gold + 1500 && atCourt.campaign.court.boons.length === 3, 'the King adds 1,500 gold and offers three boons');
  await page.goto(`${server.url}?speed=8`);
  await kc.ready();
  await kc.begin();
  await kc.choose('Continue');
  // Continue waits for the unit art, and the court's card for the change of scene: give them a moment.
  await page.waitForFunction(() => window.__kc.screen() === 'court' && document.querySelector('.kc-card-wrap:not([hidden]) h3')?.textContent === 'The King\u2019s Court', null, { timeout: 15_000 }).catch(() => {});
  check((await screen()) === 'court' && (await kc.title()) === 'The King\u2019s Court', 'a reload at court comes back to court');
  check((await kc.choose('Your Majesty')) && (await kc.title()) === 'The King\u2019s Thanks', 'after his welcome, the King offers his boons');
  const boon = await first();
  await kc.choose(boon);

  // The public game stops after Commission I (#146): more are coming, and Artur's LinkedIn, to follow for them and to say what you thought.
  const linkedIn = 'https://www.linkedin.com/in/arturzielinski/';
  const closing = await kc.call(() => {
    const card = document.querySelector('.kc-card-wrap:not([hidden]) .kc-card');
    return {
      links: [...card.querySelectorAll('.choices a')].map((a) => ({ label: a.querySelector('.words').firstChild.textContent, href: a.href, target: a.target, rel: a.rel })),
      buttons: [...card.querySelectorAll('.choices button')].map((b) => b.textContent),
    };
  });
  check((await kc.title()) === 'Commission I is complete' && (await kc.lines()).includes('More commissions are coming'), `after ${boon}, the court says Commission I is complete, and more are coming`);
  check(closing.links.map((l) => l.label).join(' / ') === 'Follow me on LinkedIn / Tell me what you thought' && closing.links.every((l) => l.href === linkedIn && l.target === '_blank' && l.rel === 'noopener'), 'with Artur\u2019s LinkedIn, to follow him for the next ones and to tell him what you thought');
  // LinkedIn answers here, not over the network.
  await page.context().route('https://www.linkedin.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: 'LinkedIn' }));
  const [tab] = await Promise.all([page.context().waitForEvent('page'), page.locator('.kc-card-wrap:not([hidden]) .choices a').first().click()]);
  await tab.waitForLoadState();
  check(tab.url() === linkedIn && (await tab.evaluate(() => window.opener === null)) && (await screen()) === 'court', 'following him opens LinkedIn in a new tab, and the game waits at court');
  await tab.close();
  check(closing.buttons.join(' / ') === 'Return to the title screen' && (await kc.choose('Return to the title screen')), 'the way on is back to the title');
  await page.waitForFunction(() => window.__kc.screen() === 'title' && document.querySelector('.kc-card-wrap:not([hidden]) button'), null, { timeout: 10_000 }).catch(() => {});
  const menu = await kc.call(() => [...document.querySelectorAll('.kc-card-wrap:not([hidden]) button')].map((b) => b.textContent).join(' / '));
  check((await screen()) === 'title' && menu.includes('Commission I is complete'), `where the menu is open, and carries on at court (${menu})`);
  await kc.choose('Continue');
  await page.waitForFunction(() => window.__kc.screen() === 'court' && document.querySelector('.kc-card-wrap:not([hidden]) h3')?.textContent === 'Commission I is complete', null, { timeout: 15_000 }).catch(() => {});
  check((await screen()) === 'court' && (await kc.title()) === 'Commission I is complete', 'Continue goes back to court, and the same last card');

  // The debug routes still ride on past it: ?chapter=2 has the bot ride Commission I and its court, and hands over the Fenmarch.
  await page.goto(`${server.url}?chapter=2&fresh=1&speed=8&seed=1066`);
  await kc.ready();
  await page.waitForFunction(() => window.__kc.screen() === 'adventure', null, { timeout: 180_000 }).catch(() => {});
  const fen = await kc.state();
  check((await screen()) === 'adventure' && fen?.campaign.chapter === 1 && fen.day === 1 && fen.campaign.record.length === 1, '?chapter=2: the bot rides Commission I and its court, and Sir Aldric rides into the Fenmarch on day I');
  check((await kc.title()) === 'Commission II: your turn' && (await kc.choose('Ride out')), 'with a card saying what he carries');
  await settle();

  await go('village', 'Visit');
  check(await kc.choose('Recruit'), 'Eelby offers archers');
  await close();
  await go('goblins', 'Approach');
  // A hero this strong may talk them into surrendering before any fight.
  if ((await kc.title()) !== 'They surrender!') await kc.choose('Let the sergeants');
  const goblins = await kc.title();
  check(goblins === 'Victory!' || goblins === 'They surrender!', `the bog goblins are seen off (${goblins})`);
  await close();
  const midFen = await kc.state();

  await page.goto(`${server.url}?speed=8`);
  await kc.ready();
  await kc.begin();
  const buttons = await kc.call(() => [...document.querySelectorAll('.kc-card-wrap:not([hidden]) button')].map((b) => b.textContent).join(' / '));
  check(buttons.includes('Commission II') && (await kc.choose('Continue')), 'a reload in the Fenmarch offers to carry on there');
  await offTitle();
  const resumed = await kc.state();
  check(resumed.campaign.chapter === 1 && resumed.gold === midFen.gold && resumed.locations.find((l) => l.id === 'goblins').done, 'the save keeps the province, gold and the beaten goblins');
  await page.goto(`${server.url}?speed=8`);
  await kc.ready();
  await kc.begin();
  await kc.choose('New campaign');
  check((await kc.title()) === 'King Osric' && (await kc.state()).campaign.chapter === 0, 'a new campaign starts over with the King');
  if (ambushes.length) console.log(`     ambushed: ${ambushes.map((a) => `${a.who} on day ${a.day} (${a.title})`).join(', ')}`);
  check(counted.length === 0, `the visitor counter sends nothing without a site code${counted.length ? `: ${counted.join(' | ')}` : ''}`);
  check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
} catch (error) {
  check(false, String(error));
} finally {
  await browser.close();
  await server.close();
}
process.exit(failed ? 1 : 0);
