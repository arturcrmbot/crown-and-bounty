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

/** Clicks a place, takes its action, and keeps riding (ending days when tired) until the hero gets there. */
async function go(id, action) {
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
    await kc.choose('Close');
  }
  return kc.title();
}

try {
  await page.goto(`${server.url}?fresh=1&speed=8`);
  await kc.ready();
  check((await kc.title()) === 'The King\u2019s Commission', 'the intro card greets you');
  await kc.choose('Ride out');

  check((await go('chest', 'Open')) === 'Treasure Chest', 'the chest opens on arrival');
  const lead = (await kc.state()).leadership;
  await kc.choose('Hand it out');
  check((await kc.state()).leadership === lead + 25, 'handing out the chest gives leadership');
  await kc.choose('Close');

  const gold = (await kc.state()).gold;
  await go('gold', 'Take');
  check((await kc.state()).gold === gold + 250, 'the gold pile pays 250');
  await kc.choose('Close');

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
  check((await kc.title()) === 'Victory!', 'the patrol is beaten');
  await kc.choose('Close');

  const tower = await go('tower', 'Enter');
  check(tower === 'Old Watchtower', 'the fogged watchtower can be reached and entered');
  await kc.choose('Close');
  await go('mine', 'Enter');
  await kc.choose('Close');
  await go('castle', 'Visit');
  check(await kc.choose('Recruit'), 'the castle offers knights');
  await kc.choose('Close');
  await go('village', 'Visit');
  check(await kc.choose('Recruit'), 'Westmere offers peasants');
  await kc.choose('Close');
  await go('wolves', 'Approach');
  await kc.choose('Fight');
  check((await kc.title()) === 'Victory!', 'the wolves are beaten');
  await kc.choose('Close');

  let result = null;
  for (let attempt = 1; attempt <= 3 && result !== 'The bounty is paid!'; attempt++) {
    await go('hideout', 'Approach');
    await kc.choose('Storm the stockade');
    result = await kc.title();
    if (result === 'The bounty is paid!') break;
    await kc.choose('Close');
    while ((await kc.state()).day % 7 !== 1) await page.keyboard.press('e');
    await kc.choose('Close');
    await go('castle', 'Visit');
    await kc.choose('Recruit');
    await kc.choose('Close');
  }
  const final = await kc.state();
  check(final.over === 'won' && final.bounty === 'paid', `the commission is won on day ${final.day}`);

  await page.goto(`${server.url}?speed=8`);
  await kc.ready();
  check((await kc.title()) === 'The King\u2019s Commission', 'a finished commission starts afresh on reload');
  check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
} catch (error) {
  check(false, String(error));
} finally {
  await browser.close();
  await server.close();
}
process.exit(failed ? 1 : 0);
