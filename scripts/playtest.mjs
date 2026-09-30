// Plays the opening of a commission through the real UI, like a player, and saves what it sees:
// numbered screenshots and the text of every card, in screenshots/playtest/. Look at them all.
//   node scripts/playtest.mjs                      (its own server)
//   URL=https://arturcrmbot.github.io/crown-and-bounty/ node scripts/playtest.mjs
//   BG="Hedge Wizard" SEED=7 node scripts/playtest.mjs
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { openPage, kc as hooks } from './lib/browser.mjs';
import { startServer } from './lib/server.mjs';

const out = 'screenshots/playtest';
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const server = process.env.URL ? null : await startServer();
const base = process.env.URL ?? server.url;
const background = process.env.BG ?? 'Knight of the Realm';
const { browser, page, errors } = await openPage();
const kc = hooks(page);
const journal = [];
let shot = 0;

/** A screenshot and the open card's text, under a short name. */
async function look(name) {
  await page.waitForTimeout(250);
  const file = `${String(++shot).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: `${out}/${file}` });
  const card = await kc.call(() => {
    // The hero screen, if it's open, else the card on screen.
    const sheet = document.querySelector('.kc-hero');
    if (sheet) {
      return {
        title: sheet.querySelector('h2')?.textContent ?? '',
        lines: [...sheet.querySelectorAll('.level, .when, .stat, .gauge, .learned .row, .totals div, .kc-hero-card')].map((el) => el.textContent.replace(/\s+/g, ' ').trim()),
        buttons: [...sheet.querySelectorAll('button.act')].map((b) => `${b.textContent}${b.disabled ? ' (greyed)' : ''}`),
      };
    }
    const wrap = document.querySelector('.kc-card-wrap:not([hidden])');
    if (!wrap) return null;
    return {
      title: wrap.querySelector('h3')?.textContent ?? '',
      lines: [...wrap.querySelectorAll('p')].map((p) => p.textContent),
      buttons: [...wrap.querySelectorAll('button')].map((b) => `${b.textContent}${b.disabled ? ' (greyed)' : ''}`),
    };
  });
  const s = await kc.call(() => {
    const st = window.__kc?.state?.();
    return st ? { day: st.day, gold: st.gold, army: st.army.map((a) => `${a.count} ${a.troop}`).join(', '), level: st.hero.level, xp: st.hero.xp, screen: window.__kc.screen() } : null;
  });
  journal.push({ file, card, state: s });
  console.log(`${file}  ${s ? `[${s.screen} day ${s.day} gold ${s.gold} L${s.level} | ${s.army}]` : ''}`);
  if (card) console.log(`   ${card.title} :: ${card.lines.join(' / ')} :: ${card.buttons.join(' | ')}`);
}

/** Clicks the first button on the open card (or the hero screen) whose label starts with `label`, like a player would. */
async function press(label) {
  const button = page.locator('.kc-card-wrap:not([hidden]) button, .kc-hero button.act', { hasText: label }).first();
  if (!(await button.count())) return false;
  await button.click();
  await page.waitForTimeout(120);
  return true;
}

/** Scrolls to a place, as a player would, and clicks it. */
async function clickPlace(id) {
  const [x, y] = await kc.centre(id);
  await kc.view(x, y);
  await page.waitForTimeout(60);
  await kc.click(x, y);
}

/** Rides to a place (ending days when tired) and takes `action` on arrival. */
async function go(id, action) {
  await clickPlace(id);
  if ((await kc.title()) === 'Unexplored') action = 'Ride there';
  if (!(await press(action))) return false;
  for (let guard = 0; guard < 20; guard++) {
    await page.waitForFunction(() => {
      const s = window.__kc.status();
      return (!s.riding && !s.visiting) || s.tired;
    }, null, { timeout: 60_000 });
    const s = await kc.status();
    if (!(s.riding && s.tired)) break;
    await kc.choose('End the day');
    await kc.choose('Close');
  }
  return true;
}

try {
  await page.goto(`${base}?fresh=1&speed=4&seed=${process.env.SEED ?? 1066}`);
  await kc.ready();
  await look('title');
  await kc.begin();
  await look('menu');
  await press('New campaign');
  await look('king');
  await press('At your service');
  await look('wanted');
  await press('I\u2019ll bring him in');
  await look('heroes');
  if (await press(background)) await look('story');
  await press('Ride out');
  await page.waitForTimeout(600);
  await look('banner');
  await page.waitForFunction(() => document.querySelector('.kc-card-wrap:not([hidden]) h3')?.textContent === 'Getting about', null, { timeout: 8000 }).catch(() => {});
  await look('getting-about');
  await press('Ride on');
  await page.waitForTimeout(600);
  await look('map');
  const hero = await kc.call(() => window.__kc.state().hero.at);
  await kc.click(hero[0], hero[1] - 6);
  await look('hero-screen');
  await press('Close');
  for (const [id, verb] of [['gold', 'Take'], ['chest', 'Open']]) {
    if (await go(id, verb)) await look(id);
    await press('Keep') || (await press('Close'));
  }
  await clickPlace('patrol');
  await look('patrol-card');
  await press('Close');
  if (await go('patrol', 'Approach')) {
    await look('patrol-threat');
    if (await press('Fight')) {
      await page.waitForTimeout(400);
      await look('battle-start');
      await kc.call(() => window.__kc.battle()?.auto());
      await page.waitForTimeout(2500);
      await look('battle-mid');
      await page.waitForFunction(() => window.__kc.screen() === 'adventure', null, { timeout: 90_000 });
      await look('battle-result');
      await press('Close');
      await look('after-battle');
    }
  }
  for (const [id, verb] of [['tower', 'Enter'], ['castle', 'Visit']]) {
    if (await go(id, verb)) await look(id);
    // The castle's armoury, and what the armourer would pay for anything in the pack.
    if (id === 'castle' && (await press('Visit the armoury'))) {
      await look('armoury');
      if (await press('Sell him your spares')) await look('spares');
    }
    await press('Close') || (await press('Not today'));
  }
} catch (error) {
  console.log(`STOPPED: ${error.message}`);
  await look('stopped');
} finally {
  writeFileSync(`${out}/journal.json`, JSON.stringify({ base, background, errors, journal }, null, 2));
  console.log(errors.length ? `PAGE ERRORS: ${errors.join(' | ')}` : 'no page errors');
  await browser.close();
  await server?.close();
}
