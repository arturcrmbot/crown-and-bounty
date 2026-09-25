// Plays the whole Aldmoor commission through the real UI, fast, and fails loudly: npm run e2e
import { openPage, kc as hooks } from './lib/browser.mjs';
import { startServer } from './lib/server.mjs';

const server = await startServer();
const { browser, page, errors } = await openPage();
const kc = hooks(page);
let failed = false;
const check = (ok, message) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${message}`);
  if (!ok) failed = true;
};

/** Level-ups wait for a choice whenever no other card is open: take the first thing offered. */
async function settle() {
  await page.waitForTimeout(50);
  while ((await kc.title())?.startsWith('Level')) {
    const label = await kc.call(() => document.querySelector('.kc-card-wrap:not([hidden]) button').textContent);
    await kc.choose(label);
    learned.push(label);
  }
}
const learned = [];

/** Closes the card, then deals with any level-up it was hiding. */
async function close() {
  await kc.choose('Close');
  await settle();
}

/** Clicks a place, takes its action, and keeps riding (ending days when tired) until the hero gets there. */
async function go(id, action) {
  await settle();
  const [x, y] = await kc.centre(id);
  await kc.click(x, y);
  if ((await kc.title()) === 'Unexplored') action = 'Ride there';
  if (!(await kc.choose(action))) throw new Error(`${id}: no "${action}" on "${await kc.title()}": ${await kc.lines()}`);
  for (;;) {
    await page.waitForFunction(() => {
      const s = window.__kc.status();
      return (!s.riding && !s.visiting) || s.tired;
    }, null, { timeout: 60_000 });
    const s = await kc.status();
    if (!(s.riding && s.tired)) break;
    await kc.choose('End the day');
    await close();
  }
  return kc.title();
}

try {
  await page.goto(`${server.url}?fresh=1&speed=8&seed=1066`);
  await kc.ready();
  check((await kc.title()) === 'Who were you, before the King found you?', 'the first card asks who the hero was');
  check(await kc.choose('Knight of the Realm'), 'the knight can be chosen');
  check((await kc.title()) === 'The King\u2019s Commission', 'then the commission is read out');
  const start = await kc.state();
  check(start.hero.background === 'knight' && start.army[0].troop === 'knights', 'the knight rides out with his knights');
  await kc.choose('Ride out');

  check((await go('chest', 'Open')) === 'Treasure Chest', 'the chest opens on arrival');
  const lead = (await kc.state()).leadership;
  await kc.choose('Hand it out');
  check((await kc.state()).leadership === lead + 25, 'handing out the chest gives leadership');
  await close();

  const gold = (await kc.state()).gold;
  await go('gold', 'Take');
  check((await kc.state()).gold === gold + 250, 'the gold pile pays 250');
  await close();

  const before = await kc.state();
  await page.goto(`${server.url}?speed=8`);
  await kc.ready();
  check((await kc.title()) === 'Welcome back', 'a reload offers to carry on');
  await kc.choose('Ride on');
  const after = await kc.state();
  check(after.gold === before.gold && after.day === before.day, 'the save keeps gold and day');
  check(after.locations.find((l) => l.id === 'chest').done && String(after.hero.at) === String(before.hero.at), 'the save keeps the opened chest and where the hero stands');

  await go('patrol', 'Approach');
  await kc.choose('Fight');
  await page.waitForTimeout(200);
  check((await kc.call(() => window.__kc.screen())) === 'battle', 'fighting the patrol opens the battlefield');
  // Wait for our first turn, then move the acting stack by clicking a hex it can reach.
  await page.waitForFunction(() => {
    const b = window.__kc.battle();
    const s = b.battle();
    const f = s.fighters.find((x) => x.id === s.order[0]);
    return !b.busy() && f.side === 'player';
  }, null, { timeout: 20_000 });
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
  check((await kc.title()) === 'Victory!', 'the patrol is beaten on the battlefield');
  await close();
  check(learned.length > 0 && (await kc.state()).hero.level >= 2, `the patrol's experience brings a level-up (${learned.join(', ')})`);

  const tower = await go('tower', 'Enter');
  check(tower === 'Old Watchtower', 'the fogged watchtower can be reached and entered');
  const tops = await kc.state();
  check(tops.hero.gear.banner === 'oldBanner' || tops.hero.pack.includes('oldBanner'), 'the watchtower holds the Old Tower Banner');
  await close();
  await go('mine', 'Enter');
  await close();
  await go('castle', 'Visit');
  check(await kc.choose('Recruit'), 'the castle offers knights');
  await close();
  await go('village', 'Visit');
  check(await kc.choose('Recruit'), 'Westmere offers peasants');
  await close();
  await go('wolves', 'Approach');
  await kc.choose('Let the sergeants');
  check((await kc.title()) === 'Victory!', 'the sergeants beat the wolves');
  await close();

  // Storm the hideout when the sergeants like the odds; otherwise wait for payday and recruit.
  let result = null;
  for (let attempt = 1; attempt <= 6 && result !== 'The bounty is paid!'; attempt++) {
    await go('hideout', 'Approach');
    const odds = await kc.lines();
    if (odds.includes('nervous') || attempt >= 5) {
      await kc.choose('Let the sergeants');
      result = await kc.title();
      if (result === 'The bounty is paid!') break;
    }
    if (result === 'Retreat!' || result === 'Defeat') await close();
    else await kc.choose('Retreat');
    result = null;
    do {
      await settle();
      await page.keyboard.press('e');
      await page.waitForTimeout(40);
      await close();
    } while ((await kc.state()).day % 7 !== 1);
    for (const [place, verb] of [['castle', 'Visit'], ['village', 'Visit']]) {
      await go(place, verb);
      await kc.choose('Recruit');
      await close();
    }
  }
  const final = await kc.state();
  check(final.over === 'won' && final.bounty === 'paid', `the commission is won on day ${final.day}`);
  check(final.hero.level >= 3, `Sir Aldric grew to level ${final.hero.level} (${learned.join(', ')})`);

  // To court: level-ups from the last battle, the King's thanks and a boon, then the next commission.
  const screen = () => kc.call(() => window.__kc.screen());
  const first = () => kc.call(() => document.querySelector('.kc-card-wrap:not([hidden]) button')?.textContent ?? null);
  check(await kc.choose('Ride to the King'), 'the bounty card sends Sir Aldric to court');
  await page.waitForTimeout(100);
  check((await screen()) === 'court', 'the throne room opens');
  while ((await kc.title())?.startsWith('Level')) {
    learned.push(await first());
    await kc.choose(await first());
  }
  check((await kc.title()) === 'The King\u2019s Court', 'the King receives him');
  const atCourt = await kc.state();
  check(atCourt.gold === final.gold + 1500 && atCourt.campaign.court.boons.length === 3, 'the King adds 1,500 gold and offers three boons');
  await page.goto(`${server.url}?speed=8`);
  await kc.ready();
  check((await screen()) === 'court' && (await kc.title()) === 'The King\u2019s Court', 'a reload at court comes back to court');
  const boon = await first();
  await kc.choose(boon);
  check((await kc.title())?.startsWith('Commission II'), `after ${boon}, the next commission is read out`);
  await kc.choose('Ride out');
  await page.waitForTimeout(150);
  const fen = await kc.state();
  check((await screen()) === 'adventure' && fen.campaign.chapter === 1 && fen.day === 1, 'Sir Aldric rides into the Fenmarch on day I');
  check(fen.hero.level === atCourt.hero.level && JSON.stringify(fen.hero.gear) === JSON.stringify(atCourt.hero.gear), 'he keeps his level and his gear');
  check((await kc.title())?.startsWith('Commission II'), 'the Fenmarch greets him');
  await close();

  await go('village', 'Visit');
  check(await kc.choose('Recruit'), 'Eelby offers archers');
  await close();
  await go('goblins', 'Approach');
  await kc.choose('Let the sergeants');
  check((await kc.title()) === 'Victory!', 'the sergeants beat the bog goblins');
  await close();
  const midFen = await kc.state();

  await page.goto(`${server.url}?speed=8`);
  await kc.ready();
  check((await kc.title()) === 'Welcome back' && (await kc.lines()).includes('Commission II'), 'a reload in the Fenmarch carries on there');
  const resumed = await kc.state();
  check(resumed.campaign.chapter === 1 && resumed.gold === midFen.gold && resumed.locations.find((l) => l.id === 'goblins').done, 'the save keeps the province, gold and the beaten goblins');
  await kc.choose('Start a new campaign');
  await page.waitForTimeout(300);
  await kc.ready();
  check((await kc.title()) === 'Who were you, before the King found you?', 'a new campaign starts from the opening card');
  check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
} catch (error) {
  check(false, String(error));
} finally {
  await browser.close();
  await server.close();
}
process.exit(failed ? 1 : 0);
