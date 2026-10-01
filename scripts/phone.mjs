// Plays Commission I on a phone by touch alone, and screenshots every screen: npm run phone
// Every press is a finger's: a tap (or a drag, or a long press) at a real point on the page. The
// game's hooks (window.__kc) are only its eyes: where things are, and what the state is.
// Screenshots go in screenshots/phone/<device>/; exit code 1 on failure.
//   DEVICE="Pixel 7 landscape" npm run phone   (default: iPhone 13 landscape)
//   ENGINE=webkit npm run phone                 (Safari's engine: npx playwright install webkit)
//   QUICK=1 npm run phone                       (the opening, the rails, a fight by hand and the hero screen)
import { mkdirSync, rmSync } from 'node:fs';
import { chromium, devices, webkit } from 'playwright';
import { startServer } from './lib/server.mjs';

const deviceName = process.env.DEVICE ?? 'iPhone 13 landscape';
const device = devices[deviceName];
if (!device) throw new Error(`No such device: ${deviceName}`);
const engine = process.env.ENGINE ?? 'chromium';
const quick = process.env.QUICK === '1';
const out = `screenshots/phone/${deviceName.replace(/\s+/g, '-')}`;
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const server = await startServer();
const channel = process.env.CHANNEL ?? 'msedge';
const browser = engine === 'webkit' ? await webkit.launch() : await chromium.launch(channel === 'bundled' ? {} : { channel });
const { defaultBrowserType: _, ...emulated } = device;
const context = await browser.newContext(emulated);
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errors.push(m.text()));
// Drags and long presses need the touch events underneath a tap: Chromium's, through its protocol.
const cdp = engine === 'webkit' ? null : await context.newCDPSession(page);
const landscape = { ...device.viewport };
const portrait = { width: Math.min(landscape.width, landscape.height), height: Math.max(landscape.width, landscape.height) };

let failed = false;
const check = (ok, message) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${message}`);
  if (!ok) failed = true;
};
const call = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
const screen = () => call(() => window.__kc.screen());
const title = () => call(() => document.querySelector('.kc-card-wrap:not([hidden]) h3')?.textContent ?? null);
const lines = () => call(() => [...document.querySelectorAll('.kc-card-wrap:not([hidden]) p')].map((p) => p.textContent).join(' / '));
const state = () => call(() => window.__kc.state());
const status = () => call(() => window.__kc.status());
let shot = 0;
const look = async (name) => {
  await wait(250);
  await page.screenshot({ path: `${out}/${String(++shot).padStart(2, '0')}-${name}.png` });
};

/** Every button a finger pressed, and how big it was: a phone needs about 40 CSS pixels to hit. */
const pressed = [];
async function tap(x, y) {
  await page.touchscreen.tap(Math.round(x), Math.round(y));
  await wait(90);
}
async function tapBox(box, what) {
  pressed.push({ what, width: box.width, height: box.height });
  await tap(box.x + box.width / 2, box.y + box.height / 2);
}

/**
 * Taps the first button that can be pressed on the card (or the hero screen) whose words start with
 * `label`, once it's on show: a new screen's cards wait for its picture to come in.
 */
async function press(label, timeout = 3000) {
  const found = await page
    .waitForFunction(
      (l) => {
        if (document.body.classList.contains('kc-veiled')) return null;
        const buttons = [...document.querySelectorAll('.kc-card-wrap:not([hidden]) .kc-card button, .kc-hero button.act')];
        const button = buttons.find((b) => !b.disabled && b.textContent.startsWith(l));
        if (!button) return null;
        // Scrolled to, as a finger would, if the hero screen has it out of sight.
        button.scrollIntoView({ block: 'nearest' });
        const r = button.getBoundingClientRect();
        // Wait for a new card to finish unfolding, so the finger lands where the button is.
        const card = button.closest('.kc-card');
        if (card?.getAnimations().some((a) => a.playState === 'running')) return null;
        return r.width && r.height ? { x: r.x, y: r.y, width: r.width, height: r.height, words: button.textContent } : null;
      },
      label,
      { timeout, polling: 50 },
    )
    .then((h) => h.jsonValue(), () => null);
  if (!found) return false;
  await tapBox(found, `card: ${found.words.slice(0, 30)}`);
  await wait(60);
  return true;
}

/** Taps a button on the rails, by its name ("End day", "Hero"). */
async function rail(name) {
  const button = page.locator(`.kc-rail:not([hidden]) button[aria-label="${name}"]`);
  if (!(await button.count()) || (await button.isDisabled())) return false;
  await tapBox(await button.boundingBox(), `rail: ${name}`);
  await wait(60);
  return true;
}

/** A finger's drag across the page, and a long press (Chromium only: WebKit here has only taps). */
const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y]) => ({ x: Math.round(x), y: Math.round(y) })) });
async function drag([x0, y0], [x1, y1], steps = 10) {
  await touch('touchStart', [[x0, y0]]);
  for (let i = 1; i <= steps; i++) {
    await touch('touchMove', [[x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps]]);
    await wait(16);
  }
  await touch('touchEnd', []);
  await wait(120);
}
async function hold([x, y], ms = 900) {
  await touch('touchStart', [[x, y]]);
  await wait(ms);
  await touch('touchEnd', []);
  await wait(120);
}

/** Taps a point of the map as a finger would: tapping the minimap there first, to bring it into view. */
async function tapMap([x, y]) {
  let at = await call(([px, py]) => window.__kc.onPage(px, py), [x, y]);
  if (!at.minimap) {
    await rail('Map');
    at = await call(([px, py]) => window.__kc.onPage(px, py), [x, y]);
  }
  // Onto the minimap: a press there looks at that spot, which puts it in the middle of the view.
  await tap(at.minimap.x, at.minimap.y);
  at = await call(([px, py]) => window.__kc.onPage(px, py), [x, y]);
  await tap(at.view.x, at.view.y);
}

/** Level-ups wait for a choice whenever no other card is open: take the first thing offered. */
const learned = [];
async function settle() {
  await wait(400);
  while ((await title())?.startsWith('Level')) {
    const first = await call(() => document.querySelector('.kc-card-wrap:not([hidden]) button').textContent);
    await press(first);
    learned.push(first);
  }
}
/** Who fell on the camp, when, and how it went. */
const ambushes = [];
/** The paydays that opened the feast (#191). */
const feasts = [];
/** Closes the card, then deals with any level-up it was hiding. An enemy falling on the camp at dawn is left to the sergeants. */
async function close() {
  // Payday's card opens at the feast by the fire, once its picture is in.
  if ((await screen()) === 'feast') {
    await page.waitForFunction(() => document.querySelector('.kc-card-wrap:not([hidden]) .kc-card button'), null, { timeout: 5000 }).catch(() => {});
    if (!feasts.length) await look('payday-feast');
    feasts.push((await state()).day);
  }
  if ((await title())?.startsWith('An ambush')) {
    const who = (await lines()).match(/At first light, (.+?) fall on your camp/)?.[1];
    const id = (await state()).ambush;
    await press('Let the sergeants');
    ambushes.push({ who, id, day: (await state()).day, title: await title(), lines: await lines() });
    console.log(`     ${who} fell on the camp on day ${ambushes.at(-1).day}: ${ambushes.at(-1).title}`);
  }
  // Whatever puts this card away: Close; Not today, where nothing was hired; a find with a drawback
  // kept in the pack, as the play-through does.
  const buttons = await call(() => [...document.querySelectorAll('.kc-card-wrap:not([hidden]) button:not(:disabled)')].map((b) => b.textContent));
  const away = ['Close', 'Not today', 'Keep it in your pack', 'Ride on'].find((l) => buttons.some((b) => b.startsWith(l)));
  if (away) await press(away);
  await settle();
}

/** Ends the day with the button at the side, saying yes if it asks. */
let asked = 0;
async function endDay() {
  const day = (await state()).day;
  await rail('End day');
  if ((await title()) === 'End the day?') {
    asked++;
    await press('End the day');
  }
  await page.waitForFunction((d) => window.__kc.state().day > d, day, { timeout: 10_000 }).catch(() => {});
  await wait(300);
}

/** A band that moved in the night out of his sight: ride towards where it roams until it's back in sight. */
async function sight(id) {
  const lost = () => call((i) => Boolean(window.__kc.state().locations.find((l) => l.id === i)?.enemy?.unseen), id);
  if (!(await lost())) return;
  for (let day = 0; day < 8 && (await lost()); day++) {
    await settle();
    if (await title()) await close();
    const at = (await state()).locations.find((l) => l.id === id).at;
    await tapMap(at);
    await page.waitForFunction((i) => {
      const s = window.__kc.status();
      return !window.__kc.state().locations.find((l) => l.id === i)?.enemy?.unseen || (!s.riding && !s.visiting) || s.tired;
    }, id, { timeout: 60_000 });
    if (!(await lost())) break;
    if ((await status()).tired) {
      await press('End the day');
      await close();
    }
  }
  // He stops by tapping himself.
  if ((await status()).riding) {
    const hero = (await state()).hero.at;
    const at = await call(([px, py]) => window.__kc.onPage(px, py - 14), hero);
    await tap(at.view.x, at.view.y);
    if ((await screen()) === 'hero') await press('Close');
  }
  check(!(await lost()), `${id}, out of sight since it moved, is back on the map once he rides near`);
}

/** Taps a place, then the card's action, and rides on (ending days when tired) until the hero gets there. */
async function go(id, action) {
  await settle();
  // A card left open may lie over the place: a finger can't tap through it, so it goes first.
  if (await title()) await close();
  await sight(id);
  const [x, y] = await call((i) => window.__kc.centre(i), id);
  const name = (await state()).locations.find((l) => l.id === id).name;
  // If the hero stands in front of the place he takes the tap, as he should, and a place drawn in
  // front of it takes it too (Westmere, over the camp by the crossroads): put that away, and tap
  // another corner of the place, as a player would.
  for (const [dx, dy] of [[0, 0], [0, -14], [-16, -8], [16, -8], [-16, 6], [16, 6], [0, 14]]) {
    await tapMap([x + dx, y + dy]);
    if ((await screen()) === 'hero') {
      await press('Close');
      continue;
    }
    const t = await title();
    if (t === name || t === 'Unexplored' || !t) break;
    await press('Close');
  }
  if ((await title()) === 'Unexplored') action = 'Ride there';
  // Ridden up to them already (looking for them, say): their card offers the fight itself.
  const facing = await call(() => [...document.querySelectorAll('.kc-card-wrap:not([hidden]) button')].some((b) => b.textContent.startsWith('Let the sergeants')));
  if (action === 'Approach' && facing) return title();
  if (!(await press(action))) throw new Error(`${id}: no "${action}" on "${await title()}": ${await lines()}`);
  for (let nights = 0; ; nights++) {
    if (nights > 12) throw new Error(`${id}: still on the road after ${nights} nights (day ${(await state()).day})`);
    await page.waitForFunction(() => {
      const s = window.__kc.status();
      return (!s.riding && !s.visiting) || s.tired;
    }, null, { timeout: 60_000 });
    const s = await status();
    if (!(s.riding && s.tired)) break;
    // The card that offers to end the day comes once a day: if it's gone, the rail ends it.
    if (!(await press('End the day'))) await endDay();
    await close();
  }
  return title();
}

/** Takes on an enemy as a patient player would: if the sergeants don't like the odds yet, wait for payday, recruit (archers at the Butts first), and come back. */
async function beatWhenReady(id, tries = 6) {
  for (let attempt = 1; attempt <= tries; attempt++) {
    const now = await state();
    if (now.over) throw new Error(`the commission is ${now.over} on day ${now.day}, going for ${id}`);
    if (now.locations.find((l) => l.id === id)?.done) return ambushes.some((a) => a.id === id && a.title === 'Victory!') ? 'Victory!' : 'done';
    await go(id, 'Approach');
    const then = await state();
    console.log(`     ${id}, try ${attempt} on day ${then.day} at level ${then.hero.level}, ${then.gold} gold, with ${then.army.map((s) => `${s.count} ${s.troop}`).join(', ')}: ${(await lines()).split(' / ').find((l) => /nervous|look|win|lose|odds|chance/i.test(l)) ?? ''}`);
    // "They look nervous", or "It will be close" with the odds on his side: waiting only lets them grow.
    if (/nervous|It will be close/.test(await lines()) || attempt === tries) {
      await press('Let the sergeants');
      const t = await title();
      if (t === 'Victory!' || t?.endsWith('is taken!')) return t;
      await close();
    } else await press('Retreat');
    do {
      await settle();
      await endDay();
      await close();
    } while ((await state()).day % 7 !== 1);
    for (const [place, verb] of [['butts', 'Visit'], ['castle', 'Visit'], ['village', 'Visit'], ['deserters', 'Visit']]) {
      if (!(await state()).locations.some((l) => l.id === place)) continue;
      await go(place, verb);
      await press('Recruit');
      await close();
    }
  }
  return title();
}

try {
  await page.goto(`${server.url}?fresh=1&speed=8&seed=1066`);
  await page.waitForFunction(() => window.__ready === true);

  // Held upright, the game asks for the phone sideways, and waits.
  await page.setViewportSize(portrait);
  await wait(300);
  const upright = await call(() => ({ card: getComputedStyle(document.querySelector('.kc-turn')).display !== 'none', rails: [...document.querySelectorAll('.kc-rail')].every((r) => r.hidden) }));
  const still = await call(async () => {
    const before = window.__kc.frameHash();
    await new Promise((r) => setTimeout(r, 400));
    return before === window.__kc.frameHash();
  });
  check(upright.card && upright.rails && still, 'held upright, the phone shows the turn-sideways card, and the game waits behind it');
  await look('portrait-turn-sideways');
  await page.setViewportSize(landscape);
  await wait(300);
  check(!(await call(() => getComputedStyle(document.querySelector('.kc-turn')).display !== 'none')), 'turned sideways, the game comes back');

  check((await screen()) === 'title', 'the game opens on the title');
  await look('title');
  const canvas = await page.locator('canvas').boundingBox();
  await tap(canvas.x + canvas.width / 2, canvas.y + canvas.height * 0.4);
  await page.waitForFunction(() => document.querySelector('.kc-card-wrap:not([hidden])'), null, { timeout: 5000 }).catch(() => {});
  check((await lines())?.includes('goose'), 'a tap opens the menu');
  const railed = await call(() => [...document.querySelectorAll('.kc-rail:not([hidden]) button')].map((b) => b.getAttribute('aria-label')));
  check(railed.includes('Sound') && (railed.includes('Full screen') || railed.length === 1), `the rails have Sound and Full screen from the start (${railed.join(', ')})`);
  await look('menu');
  check(await press('New campaign'), 'New campaign, tapped');
  check((await screen()) === 'prologue' && (await title()) === 'King Osric', 'the King explains the trouble');
  await look('king');
  // A card too tall for a phone scrolls its words under a finger.
  const long = await call(() => {
    const body = document.querySelector('.kc-card-wrap:not([hidden]) .kc-card-body');
    return body && body.scrollHeight > body.clientHeight + 2 ? body.getBoundingClientRect().toJSON() : null;
  });
  if (long && cdp) {
    // A finger on the words, clear of "more" at their foot.
    await drag([long.x + long.width / 2, long.y + long.height * 0.6], [long.x + long.width / 2, long.y + 10]);
    const read = await call(() => document.querySelector('.kc-card-wrap:not([hidden]) .kc-card-body').scrollTop);
    check(read > 20, `the King's words scroll under a finger (${Math.round(read)}px down)`);
  }
  await press('At your service');
  check((await title()) === 'WANTED', 'then comes the poster for the first villain');
  await look('wanted');
  await press('I\u2019ll bring him in');
  check((await title()) === 'Who were you, before the King found you?', 'then the King asks who the hero was');
  await look('heroes');
  check(await press('Knight of the Realm'), 'the knight, tapped');
  await look('story');
  await press('Ride out');
  check((await screen()) === 'adventure' && !(await state()).opening, 'then he is on the map');
  const told = await page.waitForFunction(() => document.querySelector('.kc-card-wrap:not([hidden]) h3')?.textContent === 'Getting about', null, { timeout: 8000 }).then(() => true, () => false);
  await look('getting-about');
  check(told && (await lines()).includes('Tap anything to see what it is, and tap it again to ride there.') && (await press('Ride on')), 'the first time the map opens, a card says how to get about by touch');
  await wait(300);
  await look('map');

  // The rails: everything a key does on the map.
  const sizes = await call(() => [...document.querySelectorAll('.kc-rail:not([hidden]) button')].map((b) => ({ name: b.getAttribute('aria-label'), ...b.getBoundingClientRect().toJSON() })));
  const names = sizes.map((s) => s.name);
  check(['Map', 'Journal', 'Hero', 'End day', 'Sound'].every((n) => names.includes(n)), `buttons down the sides for the map: ${names.join(', ')}`);
  const small = sizes.filter((s) => s.width < 40 || s.height < 40);
  check(small.length === 0, `each is at least 40 by 40 (the smallest ${Math.round(Math.min(...sizes.map((s) => s.width)))} by ${Math.round(Math.min(...sizes.map((s) => s.height)))})`);
  const picture = await page.locator('canvas').boundingBox();
  check(sizes.every((s) => s.x + s.width <= picture.x + 1 || s.x >= picture.x + picture.width - 1), 'and none of them covers the picture');

  // Tap to look, tap again to go; hold to see what's there and how far.
  const cam = () => call(() => window.__kc.camera());
  if (cdp) {
    const mid = [picture.x + picture.width * 0.45, picture.y + picture.height * 0.55];
    const before = await cam();
    await drag(mid, [mid[0] + 140, mid[1] + 60]);
    const after = await cam();
    check(after.x < before.x - 100 && after.y < before.y - 40, `a finger drags the map along (${Math.round(before.x - after.x)}, ${Math.round(before.y - after.y)})`);
    check((await status()).riding === false && (await title()) === null, 'and a drag never rides');
    await hold(mid);
    const said = await call(() => window.__kc.hover());
    check(/Ride here|day|Unexplored|No way/.test(said ?? ''), `a long press says what's there, and how far (${said})`);
    await look('long-press');
    check((await status()).riding === false, 'and never rides either');
  }
  // The day's numbers on the bar say what they are when tapped.
  const gold = await call(() => window.__kc.barOnPage('gold'));
  await tap(gold.x, gold.y);
  const goldSays = await call(() => window.__kc.hover());
  check(/gold/i.test(goldSays ?? ''), `a tap on the gold says what it is (${goldSays})`);
  await look('bar-note');
  await rail('Map');
  check((await call(() => window.__kc.minimap())) === false, 'Map folds the little map away');
  await rail('Map');
  check((await call(() => window.__kc.minimap())) === true, 'and brings it back');
  await rail('Journal');
  check((await title()) === 'Journal', 'Journal opens the journal');
  await look('journal');
  await rail('Journal');
  check((await title()) === null, 'and puts it away');
  await rail('Hero');
  check((await screen()) === 'hero', 'Hero opens the hero screen');
  await look('hero');
  await press('Close');
  check((await screen()) === 'adventure', 'and Close shuts it');
  await rail('Sound');
  check(await call(() => document.querySelector('.kc-rail button[aria-label="Muted"]') !== null), 'Sound mutes');
  await rail('Muted');
  check(await call(() => document.querySelector('.kc-rail button[aria-label="Sound"]') !== null), 'and unmutes');
  if (await rail('Full screen')) {
    await wait(400);
    const full = await call(() => Boolean(document.fullscreenElement ?? document.webkitFullscreenElement));
    const t = await title();
    check(full || t === 'Full screen', full ? 'Full screen fills the screen' : 'where it can\u2019t, Full screen says how: from the Home Screen');
    await look('full-screen');
    if (full) await rail('Exit full');
    else await press('Close');
    await wait(300);
  }

  // A first ride: a place, tapped, says what it is; its action goes there.
  check((await go('chest', 'Open')) === 'Treasure Chest', 'the chest, tapped and opened on arrival');
  await look('chest');
  await press('Hand it out');
  await close();
  await go('gold', 'Take');
  await close();

  // The highwaymen are the long way round, by the ford: a fight by hand, by touch.
  await go('highwaymen', 'Approach');
  await look('fight-card');
  const DIAG = async (tag) => console.log(`DIAG ${tag}`, JSON.stringify(await call(() => ({ screen: window.__kc.screen(), title: document.querySelector('.kc-card-wrap:not([hidden]) h3')?.textContent ?? null, buttons: [...document.querySelectorAll('.kc-card-wrap:not([hidden]) .kc-card button')].map((b) => { const r = b.getBoundingClientRect(); return `${b.textContent.slice(0, 20)}@${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)}x${Math.round(r.height)}`; }), battle: Boolean(window.__kc.state().battle), hw: window.__kc.state().locations.find((l) => l.id === 'highwaymen')?.done, card: document.querySelector('.kc-card-wrap:not([hidden]) .kc-card')?.getAnimations().map((a) => a.playState).join(), gold: window.__kc.state().gold, at: window.__kc.state().hero.at }))));
  await DIAG('before');
  await press('Fight');
  console.log('DIAG tapped', JSON.stringify(pressed.at(-1)));
  await DIAG('after');
  await wait(1500);
  await DIAG('later');
  await page.waitForFunction(() => window.__kc.screen() === 'battle', null, { timeout: 10_000 });
  await wait(600);
  const battleRails = await call(() => [...document.querySelectorAll('.kc-rail:not([hidden]) button')].map((b) => b.getAttribute('aria-label')));
  check(['Spells', 'Wait', 'Defend', 'Retreat'].every((n) => battleRails.includes(n)) && (battleRails.includes('Auto') || battleRails.includes('Finish')), `buttons down the sides for the battle: ${battleRails.join(', ')}`);
  for (let guard = 0; guard < 10; guard++) {
    await page.waitForFunction(() => {
      const b = window.__kc.battle();
      const s = b.battle();
      const f = s.fighters.find((x) => x.id === s.order[0]);
      return !b.busy() && f.side === 'player';
    }, null, { timeout: 20_000 });
    // Aldric leads from behind the line: on his turns, he defends.
    const leader = await call(() => {
      const b = window.__kc.battle();
      const s = b.battle();
      return Boolean(s.fighters.find((x) => x.id === s.order[0]).hero && b.moves().length === 0);
    });
    if (!leader) break;
    await rail('Defend');
    await wait(400);
  }
  await look('battle');
  // A first tap on an enemy says who they are; a first tap on a hex, what a second would do.
  const foe = await call(() => {
    const s = window.__kc.battle().battle();
    const f = s.fighters.find((x) => x.side === 'enemy' && x.count > 0 && x.at >= 0);
    return f ? window.__kc.battle().hexOnPage(f.at) : null;
  });
  if (foe) {
    await tap(foe.x, foe.y);
    const told = await call(() => window.__kc.battle().label());
    check(Boolean(told), `a tap on their stack says who they are (${told})`);
    await look('battle-foe');
  }
  const plan = await call(() => {
    const b = window.__kc.battle();
    const s = b.battle();
    const f = s.fighters.find((x) => x.id === s.order[0]);
    const target = b.moves().sort((x, y) => (y % 11) - (x % 11))[0];
    return { id: f.id, target, at: b.hexOnPage(target) };
  });
  await tap(plan.at.x, plan.at.y);
  const first = await call(() => ({ label: window.__kc.battle().label(), battle: window.__kc.battle().battle() }));
  check(first.battle.fighters.find((f) => f.id === plan.id).at !== plan.target && /tap again/i.test(first.label ?? ''), `a first tap on a hex shows what a second would do (${first.label})`);
  await look('battle-first-tap');
  await tap(plan.at.x, plan.at.y);
  await page.waitForFunction(() => !window.__kc.battle().busy(), null, { timeout: 10_000 }).catch(() => {});
  const moved = await call(() => window.__kc.battle().battle());
  check(moved.fighters.find((f) => f.id === plan.id).at === plan.target, 'and the second tap moves the stack there');
  (await rail('Auto')) || (await rail('Finish'));
  await page.waitForFunction(() => window.__kc.screen() === 'adventure', null, { timeout: 60_000 });
  check((await title()) === 'Victory!', 'Auto hands the fight to the sergeants, and they win it');
  await look('victory');
  await close();

  const tower = await go('tower', 'Enter');
  check(tower === 'Old Watchtower', 'the watchtower, reached and entered');
  await press('Take the banner');
  await close();

  // The hero screen by touch: tap an artifact to pick it up, tap where it goes.
  await rail('Hero');
  const sheet = () => call(() => window.__kc.hero());
  const tapPlace = async (place) => {
    const square = page.locator(`.kc-hero [data-place="${place}"]`);
    await square.scrollIntoViewIfNeeded();
    await tapBox(await square.boundingBox(), `hero: ${place}`);
    await wait(80);
  };
  const tapAct = async (act) => {
    const button = page.locator(`.kc-hero [data-act="${act}"]`).first();
    await button.scrollIntoViewIfNeeded();
    await tapBox(await button.boundingBox(), `hero: ${act}`);
    await wait(80);
  };
  let looked = await sheet();
  if (looked.slots.banner !== 'oldBanner') {
    await tapPlace(`pack:${looked.pack.indexOf('oldBanner')}`);
    await tapPlace('slot:banner');
  }
  const free = (await sheet()).pack.length;
  await tapPlace('slot:banner');
  const tip = await call(() => {
    const t = document.querySelector('.kc-hero-tip');
    return t && !t.hidden ? t.textContent : null;
  });
  check((await sheet()).held === 'slot:banner' && Boolean(tip), `a tap picks the banner up, and says what it is (${tip?.slice(0, 40)}...)`);
  await look('hero-holding');
  await tapPlace(`pack:${free}`);
  looked = await sheet();
  check(looked.slots.banner === null && looked.pack[free] === 'oldBanner', 'a tap on a pack square takes it off');
  await tapPlace(`pack:${free}`);
  await tapPlace('slot:banner');
  looked = await sheet();
  check(looked.slots.banner === 'oldBanner' && (await state()).hero.gear.banner === 'oldBanner', 'tapped, then its slot tapped, it goes back on');
  const line = looked.army;
  await tapPlace('stack:1');
  await look('hero-stack');
  await tapAct('left');
  check(JSON.stringify((await sheet()).army) === JSON.stringify([line[1], line[0], ...line.slice(2)]), 'a stack, tapped, moves along the line from its card');
  await tapAct('right');
  await tapAct('card-close');
  if (cdp) {
    await page.locator('.kc-hero [data-place="stack:0"]').scrollIntoViewIfNeeded();
    const a = await page.locator('.kc-hero [data-place="stack:1"]').boundingBox();
    const b = await page.locator('.kc-hero [data-place="stack:0"]').boundingBox();
    await drag([a.x + a.width / 2, a.y + a.height / 2], [b.x + b.width / 2, b.y + b.height / 2], 12);
    check(JSON.stringify((await sheet()).army) === JSON.stringify([line[1], line[0], ...line.slice(2)]), 'and a finger drags one onto another to swap them');
    await drag([b.x + b.width / 2, b.y + b.height / 2], [a.x + a.width / 2, a.y + a.height / 2], 12);
  }
  await press('Close');
  check((await screen()) === 'adventure' && JSON.stringify((await state()).army.map((s) => `${s.count} ${s.troop}`)) === JSON.stringify(line), 'Close shuts it, the army as it was');

  if (!quick) {
    await go('mine', 'Enter');
    check(await press('Take the cart'), 'the dwarf gives up his ore cart');
    await close();
    await go('boars', 'Approach');
    await press('Let the sergeants');
    check((await title()) === 'Victory!', 'the sergeants see off the boars');
    await close();
    await go('castle', 'Visit');
    await look('castle');
    check(await press('Recruit'), 'the castle recruits knights');
    await look('recruit');
    // The armourer buys the spare he carries (the highwaymen's Black Banner), as the play-through does: gold for the weeks ahead.
    const [spare] = (await state()).hero.pack;
    if (spare) {
      const purse = (await state()).gold;
      check((await press('Visit the armoury')) && (await press('Sell him your spares')) && (await press('Sell ')) && (await state()).gold > purse, `the armourer buys his spare (${spare})`);
    }
    await close();
    await go('poachers', 'Approach');
    await press('Let the sergeants');
    await close();
    await go('village', 'Visit');
    check(await press('Recruit'), 'Westmere offers peasants');
    await close();
    check((await beatWhenReady('patrol')) === 'Victory!', 'once explored, the sergeants beat the patrol');
    await close();
    // Grimsby rides out once his patrol is beaten, and falls on the camp.
    for (let night = 0; night < 8 && !ambushes.some((a) => a.who === 'Grimsby and his Guard'); night++) {
      await settle();
      await endDay();
      await close();
    }
    if (!ambushes.some((a) => a.who === 'Grimsby and his Guard')) console.log('     Grimsby never rode out: his stockade will be the harder for it');
    check(asked > 0, `End day asks first while he could ride on (asked ${asked} times)`);
    if ((await state()).locations.some((l) => l.id === 'deserters')) {
      await go('deserters', 'Visit');
      await press('Recruit');
      await close();
    }
    check((await beatWhenReady('wolves')) === 'Victory!', 'the sergeants beat the wolves');
    await close();
    await beatWhenReady('hideout', 8);
    const final = await state();
    check(final.over === 'won' && final.bounty === 'paid', `Baron Grimsby is beaten on day ${final.day}, by touch alone`);
    check(feasts.length > 0, `payday opens the feast by the fire, and its card's Close takes him back to the map (on day ${feasts.join(', ') || 'none'})`);
    check((await title()) === 'Baron Grimsby is taken!', 'and has the last word');
    await look('grimsby-taken');
    check((await press('Claim the bounty')) && (await title()) === 'WANTED', 'his poster comes back, paid in full');
    await look('bounty-paid');
    check(await press('Ride to the King'), 'the poster sends Sir Aldric to court');
    await page.waitForFunction(() => window.__kc.screen() === 'court', null, { timeout: 10_000 }).catch(() => {});
    await wait(400);
    while ((await title())?.startsWith('Level')) {
      const first = await call(() => document.querySelector('.kc-card-wrap:not([hidden]) button').textContent);
      await press(first);
    }
    check((await screen()) === 'court' && (await title()) === 'The King\u2019s Court', 'the King receives him');
    await look('court');
    check((await press('Your Majesty')) && (await title()) === 'The King\u2019s Thanks', 'and offers his boons');
    await look('boons');
    const boon = await call(() => document.querySelector('.kc-card-wrap:not([hidden]) button').textContent);
    await press(boon);
    // The public game stops after Commission I (#146): more are coming, and Artur's LinkedIn.
    await page.waitForFunction(() => document.querySelector('.kc-card-wrap:not([hidden]) h3')?.textContent === 'Commission I is complete', null, { timeout: 5000 }).catch(() => {});
    check((await title()) === 'Commission I is complete' && (await lines()).includes('More commissions are coming'), `after ${boon}, the court says Commission I is complete, and more are coming`);
    await look('closing');
    const linkedIn = 'https://www.linkedin.com/in/arturzielinski/';
    const links = await call(() =>
      [...document.querySelectorAll('.kc-card-wrap:not([hidden]) .kc-card .choices a')].map((a) => {
        const r = a.getBoundingClientRect();
        return { label: a.querySelector('.words').firstChild.textContent, href: a.href, target: a.target, rel: a.rel, box: { x: r.x, y: r.y, width: r.width, height: r.height } };
      }),
    );
    check(links.map((l) => l.label).join(' / ') === 'Follow me on LinkedIn / Tell me what you thought' && links.every((l) => l.href === linkedIn && l.target === '_blank' && l.rel === 'noopener'), 'with Artur\u2019s LinkedIn, to follow him and to tell him what you thought');
    // LinkedIn answers here, not over the network.
    await context.route('https://www.linkedin.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: 'LinkedIn' }));
    if (links[0]) {
      const [tab] = await Promise.all([context.waitForEvent('page', { timeout: 5000 }).catch(() => null), tapBox(links[0].box, 'card: Follow me on LinkedIn')]);
      await tab?.waitForLoadState();
      check(tab?.url() === linkedIn && (await screen()) === 'court', 'a tap on it opens LinkedIn in a new tab, and the game waits at court');
      await tab?.close();
    }
    check(await press('Return to the title screen'), 'the way on is back to the title');
    await page.waitForFunction(() => window.__kc.screen() === 'title', null, { timeout: 10_000 }).catch(() => {});
    check((await screen()) === 'title', 'and the title comes back');
    await look('title-after');
  }

  const cards = pressed.filter((p) => p.what.startsWith('card') || p.what.startsWith('rail'));
  const tiny = cards.filter((p) => p.height < 40 || p.width < 40);
  check(tiny.length === 0, `every card and rail button tapped was at least 40 by 40 (${cards.length} taps${tiny.length ? `; too small: ${[...new Set(tiny.map((t) => `${t.what} ${Math.round(t.width)}x${Math.round(t.height)}`))].join(', ')}` : ''})`);
  const squares = pressed.filter((p) => p.what.startsWith('hero'));
  if (squares.length) console.log(`     hero screen: the smallest square tapped was ${Math.round(Math.min(...squares.map((p) => p.width)))} by ${Math.round(Math.min(...squares.map((p) => p.height)))}`);
  if (ambushes.length) console.log(`     ambushed: ${ambushes.map((a) => `${a.who} on day ${a.day} (${a.title})`).join(', ')}`);
  check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
} catch (error) {
  check(false, String(error));
  await page.screenshot({ path: `${out}/failed.png` }).catch(() => {});
  const seen = await call(() => {
    const s = window.__kc.state();
    return { screen: window.__kc.screen(), status: window.__kc.status(), day: s?.day, ambush: s?.ambush, opening: s?.opening, over: s?.over, hover: window.__kc.hover(), camera: window.__kc.camera() };
  }).catch(() => null);
  console.log(`     then: ${JSON.stringify(seen)}`);
} finally {
  await browser.close();
  await server.close();
}
console.log(`${deviceName} (${engine}): screenshots in ${out}/`);
process.exit(failed ? 1 : 0);
