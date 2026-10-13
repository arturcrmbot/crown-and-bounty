// Focused character-screen tasks, not another campaign play-through.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { startServer } from './lib/server.mjs';

const out = process.env.OUT_DIR ?? 'screenshots/hero-ui';
mkdirSync(out, { recursive: true });
const server = process.env.URL ? null : await startServer();
const base = process.env.URL ?? server.url;
const channel = process.env.CHANNEL ?? 'msedge';
const browser = await chromium.launch(channel === 'bundled' ? {} : { channel });
const gear = 'twinWand,crystalBall,greenwoodCloak,oldBanner,poachersHorn,brannocsLance,silverSignet,luckyHorseshoe,wizardsButton,goldenFeather,astrolabe,millersLoaf';
const profiles = [
  { name: 'desktop', width: 1280, height: 720, touch: false },
  { name: 'phone', width: 844, height: 390, touch: true },
  { name: 'compact', width: 667, height: 375, touch: true },
];
const errors = [], captures = [], checks = [];
const touchPages = new WeakSet();
const check = (condition, message) => { assert.ok(condition, message); checks.push(message); console.log(`ok ${message}`); };
const state = page => page.evaluate(() => window.__kc.state());
const sheet = page => page.evaluate(() => window.__kc.hero());
const press = (page, locator) => touchPages.has(page) ? locator.tap() : locator.click();
const tab = (page, name) => press(page, page.locator(`.kc-hero [data-tab="${name}"]`));
const act = (page, name) => press(page, page.locator(`.kc-hero [data-act="${name}"]:visible`));
const place = (page, name) => press(page, page.locator(`.kc-hero [data-place="${name}"]`));

async function open(context, profile, background = 'wizard', frozen = true) {
  const page = await context.newPage();
  if (profile.touch) touchPages.add(page);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}?fresh=1${frozen ? '&freeze=1' : ''}&seed=1066&hero=${background}&gear=${gear}&army=knights:8,archers:22,peasants:40&touch=${profile.touch ? 1 : 0}`);
  await page.waitForFunction(() => window.__ready);
  if (profile.touch) await page.locator('.kc-rail button[data-id="hero"]').tap();
  else await page.keyboard.press('h');
  await page.waitForSelector('.kc-hero');
  await page.evaluate(() => document.fonts.ready);
  return page;
}

async function shot(page, profile, name) {
  await page.mouse.move(1, 1);
  await page.waitForTimeout(80);
  const file = `${profile.name}-${name}.png`;
  await page.screenshot({ path: `${out}/${file}` });
  const measured = await page.evaluate(() => {
    const root = document.querySelector('.kc-hero');
    const rect = root.getBoundingClientRect();
    const bounds = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    const controls = [...root.querySelectorAll('button,select')].flatMap(element => {
      const r = element.getBoundingClientRect();
      if (!r.width || !r.height) return [];
      const center = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      if (!center || (center !== element && !element.contains(center))) return [];
      if (r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth) return [];
      return [{ key: element.dataset.place ?? element.dataset.act ?? element.dataset.tab, words: element.textContent.trim(), x: r.x, y: r.y, width: r.width, height: r.height }];
    });
    const overlaps = [];
    for (let i = 0; i < controls.length; i++) for (let j = i + 1; j < controls.length; j++) {
      const a = controls[i], b = controls[j];
      const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      if (w > .5 && h > .5) overlaps.push([a.key, b.key, w, h]);
    }
    const imageErrors = [...root.querySelectorAll('img')].filter(image => image.getClientRects().length && (!image.complete || !image.naturalWidth)).length;
    const close = root.querySelector('[data-act="close"]').getBoundingClientRect();
    const reading = [...root.querySelectorAll('.card-reading')].filter(element => element.getClientRects().length).map(element => element.clientHeight);
    return { bounds, controls, overlaps, imageErrors, close: { top: close.top, bottom: close.bottom, width: close.width, height: close.height }, reading, page: window.__kc.hero().page };
  });
  captures.push({ file, profile, url: page.url(), state: await state(page), measured });
  check(measured.overlaps.length === 0, `${profile.name} ${name} has no overlapping visible command regions`);
  check(measured.imageErrors === 0, `${profile.name} ${name} has loaded figures and icons`);
  check(measured.close.top >= 0 && measured.close.bottom <= profile.height, `${profile.name} ${name} keeps Close in view`);
  if (profile.touch) check(measured.controls.every(c => c.height >= 43.5 && c.width >= 43.5), `${profile.name} ${name} has finger-sized visible controls`);
}

async function drag(page, from, to, touch) {
  const box = async key => {
    const locator = page.locator(`.kc-hero [data-place="${key}"]`);
    await locator.scrollIntoViewIfNeeded();
    const r = await locator.boundingBox();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  };
  const a = await box(from), b = await box(to);
  if (touch) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
    for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + (b.x - a.x) * i / 10, y: a.y + (b.y - a.y) * i / 10 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  } else {
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 10 });
    await page.mouse.up();
  }
}

try {
  for (const profile of profiles) {
    const context = await browser.newContext({ viewport: { width: profile.width, height: profile.height }, hasTouch: profile.touch, isMobile: profile.touch, deviceScaleFactor: 1 });
    const page = await open(context, profile);
    await shot(page, profile, 'hero');
    await tab(page, 'equipment');
    const before = JSON.stringify(await state(page));
    await place(page, 'pack:0');
    check(JSON.stringify(await state(page)) === before && (await sheet(page)).held === null, `${profile.name} first inspection changes neither gear, seed nor pickup state`);
    check((await sheet(page)).comparison.rows.find(r => r.name === 'Spells each round').after === '2', `${profile.name} the Wizard keeps his second cast when comparing the Lance`);
    await shot(page, profile, 'equipment');
    await place(page, 'pack:1');
    for (const slot of ['trinket', 'trinket2', 'trinket3']) {
      await page.locator('.kc-hero [data-act="target"]').selectOption(slot);
      check((await sheet(page)).comparison.target === slot && JSON.stringify(await state(page)) === before, `${profile.name} ${slot} can be compared without applying`);
    }
    await act(page, 'gear-cancel');
    await place(page, 'pack:0');
    await act(page, 'gear-apply');
    check((await state(page)).hero.gear.weapon === 'brannocsLance' && (await state(page)).hero.pack[0] === 'twinWand', `${profile.name} Wear explicitly swaps with the equipped weapon`);
    await shot(page, profile, 'equipped');
    await act(page, 'gear-apply');
    let current = await state(page);
    check(!current.hero.gear.weapon && current.hero.pack.includes('brannocsLance'), `${profile.name} Take it off explicitly returns the weapon to the pack`);
    const lance = current.hero.pack.indexOf('brannocsLance');
    await place(page, `pack:${lance}`);
    await act(page, 'pick-up');
    const held = JSON.stringify(await state(page));
    await place(page, 'slot:trinket');
    check(JSON.stringify(await state(page)) === held && (await sheet(page)).held === `pack:${lance}`, `${profile.name} an incompatible destination is refused without losing the held item`);
    await act(page, 'move-cancel');
    await act(page, 'gear-apply');
    check((await state(page)).hero.gear.weapon === 'brannocsLance', `${profile.name} cancelling Move does not prevent a later explicit wear`);
    current = await state(page);
    await place(page, 'pack:0');
    await act(page, 'pick-up');
    await place(page, 'pack:1');
    check((await state(page)).hero.pack[1] === current.hero.pack[0], `${profile.name} Move then destination reorders the pack`);
    await place(page, 'pack:0');
    if (profile.touch) await act(page, 'pick-up');
    const packBefore = [...(await state(page)).hero.pack];
    await drag(page, 'pack:0', 'pack:1', profile.touch);
    check((await state(page)).hero.pack[1] === packBefore[0], `${profile.name} intentional dragging reorders the pack`);

    await tab(page, 'army');
    await place(page, 'stack:1');
    await shot(page, profile, 'army');
    const armyBefore = [...(await state(page)).army];
    await act(page, 'left');
    check((await state(page)).army[0].troop === armyBefore[1].troop, `${profile.name} a company can be reordered without dragging`);
    await act(page, 'right');
    await place(page, 'stack:1');
    await page.locator('.kc-hero [data-place="stack:1"]').focus();
    await page.keyboard.press('Shift+ArrowUp');
    check((await state(page)).army[0].troop === armyBefore[1].troop, `${profile.name} Shift and Up reorder the vertical company list`);
    await page.keyboard.press('Shift+ArrowDown');
    check((await state(page)).army[1].troop === armyBefore[1].troop, `${profile.name} Shift and Down restore its order`);
    await place(page, 'stack:1');
    if (profile.touch) await act(page, 'pick-up');
    await drag(page, 'stack:1', 'stack:0', profile.touch);
    check((await state(page)).army[0].troop === armyBefore[1].troop, `${profile.name} a company can also be dragged`);
    await act(page, 'dismiss');
    check(await page.locator('.kc-hero [data-act="dismiss-no"]').evaluate(el => el === document.activeElement), `${profile.name} dismissal focuses the safe answer`);
    await shot(page, profile, 'dismiss');
    const beforeCancel = JSON.stringify(await state(page));
    await act(page, 'dismiss-no');
    check(JSON.stringify(await state(page)) === beforeCancel, `${profile.name} Keep them cancels without a state change`);
    await act(page, 'dismiss');
    await act(page, 'dismiss-yes');
    check((await state(page)).army.length === 2, `${profile.name} confirmed dismissal removes only the selected company`);
    await act(page, 'dismiss');
    await act(page, 'dismiss-yes');
    check((await state(page)).army.length === 1 && await page.locator('.kc-hero [data-act="dismiss"]').isDisabled(), `${profile.name} the final company cannot be dismissed`);
    await place(page, 'hero');
    await shot(page, profile, 'leader');
    await tab(page, 'hero');
    await page.locator('.kc-hero [data-tab="hero"]').focus();
    await page.keyboard.press('ArrowRight');
    check((await sheet(page)).page === 'equipment', `${profile.name} arrow keys navigate the folio tabs`);
    await tab(page, 'army');
    await place(page, 'stack:0');
    await page.keyboard.press('Escape');
    check((await sheet(page)).card === null, `${profile.name} Escape first puts the company inspector away`);
    await page.keyboard.press('Escape');
    check(await page.evaluate(() => window.__kc.screen()) === 'adventure', `${profile.name} Escape then closes the folio`);
    if (profile.touch) await page.locator('.kc-rail button[data-id="hero"]').tap();
    else await page.keyboard.press('h');
    const mana = (await state(page)).hero.mana;
    await act(page, 'spell:farsight');
    check((await state(page)).hero.mana === mana - 10 && await page.evaluate(() => window.__kc.screen()) === 'adventure', `${profile.name} Far Sight closes the folio and spends mana through the rules`);
    if (profile.touch) await page.locator('.kc-rail button[data-id="hero"]').tap();
    else await page.keyboard.press('h');
    const day = (await state(page)).day;
    await act(page, 'endDay');
    check((await state(page)).day === day + 1, `${profile.name} End the day remains a real game action`);
    await page.close();

    for (const background of ['knight', 'ranger', 'courtier']) {
      const p = await open(context, profile, background);
      await shot(p, profile, background);
      await tab(p, 'equipment');
      check((await sheet(p)).comparison.rows.some(row => row.name === 'Spells each round'), `${profile.name} ${background} uses its own actual comparison`);
      await act(p, 'close');
      check(await p.evaluate(() => window.__kc.screen()) === 'adventure', `${profile.name} ${background} has a working persistent Close`);
      await p.close();
    }
    await context.close();
  }
  check(errors.length === 0, 'the focused character-screen tasks have no page errors');
} finally {
  writeFileSync(`${out}/report.json`, JSON.stringify({ source: 'Actual character UI, frozen seeded task fixtures, not a campaign play-through', checks, errors, captures }, null, 2));
  await browser.close();
  if (server) await server.close();
}
