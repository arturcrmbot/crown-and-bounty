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
  await kc.choose('Let the sergeants');
  check((await kc.title()) === 'Victory!', 'the sergeants beat the wolves');
  await kc.choose('Close');

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
    await kc.choose(result === 'Retreat!' || result === 'Defeat' ? 'Close' : 'Retreat');
    result = null;
    do {
      await page.keyboard.press('e');
      await page.waitForTimeout(40);
      await kc.choose('Close');
    } while ((await kc.state()).day % 7 !== 1);
    for (const [place, verb] of [['castle', 'Visit'], ['village', 'Visit']]) {
      await go(place, verb);
      await kc.choose('Recruit');
      await kc.choose('Close');
    }
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
