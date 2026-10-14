// Focused battle tasks at actual desktop and landscape-phone sizes, not a campaign play-through.
// Run with node scripts/battle-ui.mjs. URL reuses an owned server; OUT_DIR keeps evidence outside Git.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { startServer } from './lib/server.mjs';

const out = process.env.OUT_DIR ?? 'screenshots/battle-ui';
mkdirSync(out, { recursive: true });
const server = process.env.URL ? null : await startServer();
const base = process.env.URL ?? server.url;
const channel = process.env.CHANNEL ?? 'msedge';
const browser = await chromium.launch(channel === 'bundled' ? {} : { channel });
const profiles = [
  { name: 'desktop', width: 1280, height: 720, touch: false },
  { name: 'phone', width: 844, height: 390, touch: true },
  { name: 'compact', width: 667, height: 375, touch: true },
];
const captures = [], checks = [], errors = [];
const check = (condition, message) => {
  assert.ok(condition, message);
  checks.push(message);
  console.log(`ok ${message}`);
};
const battle = page => page.evaluate(() => window.__kc.battle()?.battle());
const current = b => b.fighters.find(f => f.id === b.order[0]);
const command = (page, profile, id) => page.locator(`${profile.touch ? '.kc-rail' : '.kc-battle-commands'} button[data-id="${id}"]`);
const frame = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
const press = async (locator, profile) => {
  if (profile.touch) await locator.tap();
  else await locator.click();
  await frame(locator.page());
};
const advance = async (page, seconds = .01) => {
  await page.evaluate(dt => window.__kc.advance(dt), seconds);
  await frame(page);
};

async function readyTurn(page) {
  await page.evaluate(() => {
    for (let i = 0; i < 200; i++) {
      const hook = window.__kc.battle();
      if (!hook || (!hook.busy() && hook.battle().fighters.find(f => f.id === hook.battle().order[0])?.side === 'player')) break;
      window.__kc.advance(.1);
    }
  });
  await frame(page);
  const b = await battle(page);
  check(!b || current(b)?.side === 'player', 'A bounded animation advance reaches a manual turn');
}

async function open(context, profile, query = '') {
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  const url = new URL(base);
  url.search = `freeze=1&fresh=1&battle=patrol&hero=wizard&army=knights:10,archers:30,peasants:40&spells=fireball&seed=1066&touch=${profile.touch ? 1 : 0}`;
  for (const [key, value] of new URLSearchParams(query)) url.searchParams.set(key, value);
  await page.goto(url.href);
  await page.waitForFunction(() => window.__ready);
  await page.evaluate(() => document.fonts.ready);
  return page;
}

async function point(page, profile, hex, commit = false) {
  const at = await page.evaluate(h => window.__kc.battle().hexOnPage(h), hex);
  if (profile.touch) {
    await page.touchscreen.tap(at.x, at.y);
    if (commit) await page.touchscreen.tap(at.x, at.y);
  } else {
    await page.mouse.move(at.x, at.y);
    if (commit) await page.mouse.click(at.x, at.y);
  }
  await frame(page);
}

async function shot(page, profile, name) {
  const file = `${profile.name}-${name}.png`;
  await page.screenshot({ path: `${out}/${file}` });
  const measured = await page.evaluate(() => {
    const rect = element => {
      const r = element.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    };
    const visible = element => element.getClientRects().length && !element.closest('[hidden]');
    const controls = [...document.querySelectorAll('.kc-battle button,.kc-rail button')].filter(visible).map(element => {
      const r = rect(element);
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { id: element.dataset.id, ...r, hit: top === element || element.contains(top), disabled: element.disabled };
    });
    const overlaps = [];
    for (let i = 0; i < controls.length; i++) for (let j = i + 1; j < controls.length; j++) {
      const a = controls[i], b = controls[j];
      if (Math.min(a.right, b.right) - Math.max(a.x, b.x) > .5 && Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > .5) overlaps.push([a.id, b.id]);
    }
    const deck = document.querySelector('.kc-battle-deck');
    const tag = document.querySelector('.kc-tag:not([hidden])');
    const images = [...document.querySelectorAll('.kc-battle img')].filter(visible);
    return {
      viewport: { width: innerWidth, height: innerHeight },
      deck: deck && rect(deck), controls, overlaps,
      imageErrors: images.filter(image => !image.complete || !image.naturalWidth).length,
      title: document.querySelector('.kc-battle-active')?.textContent,
      text: deck?.textContent, tag: tag ? { ...rect(tag), text: tag.textContent } : null,
      queue: [...document.querySelectorAll('.kc-battle-turns [data-fighter]')].map(element => Number(element.dataset.fighter)),
    };
  });
  captures.push({ file, profile, url: page.url(), battle: await battle(page), measured });
  check(measured.deck && measured.deck.x >= 0 && measured.deck.right <= profile.width && measured.deck.bottom <= profile.height, `${profile.name} ${name} keeps the information deck in the viewport`);
  check(!measured.overlaps.length && measured.controls.every(c => c.hit), `${profile.name} ${name} has separate unobstructed command regions`);
  check(!measured.imageErrors, `${profile.name} ${name} uses loaded painted figures`);
  if (profile.touch) {
    check(measured.controls.every(c => c.width >= 43.5 && c.height >= 43.5), `${profile.name} ${name} has actual finger-sized targets`);
    check(!await page.locator('.kc-battle-commands button:visible').count(), `${profile.name} does not duplicate the rail commands`);
  }
  return measured;
}

async function clearOfTarget(page, profile, hex) {
  const measured = await page.evaluate(h => {
    const tag = document.querySelector('.kc-tag:not([hidden])').getBoundingClientRect();
    const at = window.__kc.battle().hexOnPage(h);
    const scale = document.querySelector('canvas').getBoundingClientRect().width / 960;
    const target = { left: at.x - 30 * scale, right: at.x + 30 * scale, top: at.y - 84 * scale, bottom: at.y + 22 * scale };
    return {
      fits: tag.left >= 0 && tag.right <= innerWidth && tag.top >= 0 && tag.bottom <= innerHeight,
      clear: tag.right <= target.left - 4 || tag.left >= target.right + 4 || tag.bottom <= target.top - 4 || tag.top >= target.bottom + 4,
    };
  }, hex);
  check(measured.fits && measured.clear, `${profile.name} the forecast stays in view and clear of the primary target`);
}

async function clearBadges(page, profile) {
  const hidden = await page.evaluate(() => {
    const hook = window.__kc.battle();
    const canvas = document.querySelector('canvas');
    const scale = canvas.getBoundingClientRect().width / 960;
    const size = document.documentElement.classList.contains('kc-touch') ? Math.max(14, Math.ceil(11 / scale)) : 12;
    const context = document.createElement('canvas').getContext('2d');
    context.font = `bold ${size}px "Bounty Serif"`;
    const panels = [...document.querySelectorAll('.kc-battle-header,.kc-battle-deck')].map(panel => panel.getBoundingClientRect());
    return hook.battle().fighters.filter(f => f.count > 0 && f.at >= 0).flatMap(f => {
      const at = hook.hexOnPage(f.at);
      const width = (Math.ceil(context.measureText(String(f.count)).width) + 10) * scale;
      const x = at.x + (f.side === 'player' ? 14 : -14) * scale - width / 2;
      const y = at.y + 8 * scale;
      const height = (size + 4) * scale;
      return panels.some(p => Math.min(x + width, p.right) > Math.max(x, p.left) && Math.min(y + height, p.bottom) > Math.max(y, p.top)) ? [f.id] : [];
    });
  });
  check(!hidden.length, `${profile.name} all five companies keep their count badges clear of the HUD (${hidden.join(',')})`);
}

try {
  for (const profile of profiles) {
    const context = await browser.newContext({ viewport: { width: profile.width, height: profile.height }, hasTouch: profile.touch, isMobile: profile.touch, deviceScaleFactor: 1 });
    try {
      let page = await open(context, profile);
      check(await page.locator('.kc-battle').count() === 1, `${profile.name} has a native-size battle information and command hierarchy`);
      const initial = await battle(page);
      const opening = await shot(page, profile, 'opening');
      check(opening.title.includes('10 Knights') && opening.queue[0] === initial.order[0], `${profile.name} shows the acting company and the real turn queue`);
      const crowded = await open(context, profile, '&hero=knight&army=knights:120,archers:1234,swordsmen:345,pikemen:456,peasants:789&enemy=knights:120,archers:1234,swordsmen:345,pikemen:456,peasants:789,sergeant:1:5');
      await readyTurn(crowded);
      await shot(crowded, profile, 'five-companies');
      await clearBadges(crowded, profile);
      await crowded.close();

      const move = await page.evaluate(() => window.__kc.battle().moves()[0]);
      const beforeMove = JSON.stringify(await battle(page));
      if (profile.touch) {
        await point(page, profile, move);
        check(JSON.stringify(await battle(page)) === beforeMove && await page.locator('.kc-tag').innerText().then(text => text.includes('Tap again')), `${profile.name} previews a move without committing it`);
        await point(page, profile, move);
      } else await point(page, profile, move, true);
      await readyTurn(page);
      check((await battle(page)).fighters.find(f => f.id === current(initial).id).at === move, `${profile.name} commits the displayed move once`);
      await page.close();

      page = await open(context, profile);
      await press(command(page, profile, 'wait'), profile);
      await readyTurn(page);
      const ranged = await battle(page);
      check(current(ranged).troop === 'archers' && ranged.order.at(-1) === initial.order[0], `${profile.name} Wait moves the company to the end of the queue`);
      const target = ranged.fighters.find(f => f.side === 'enemy' && f.at >= 0);
      await point(page, profile, target.at);
      const rangedAim = await shot(page, profile, 'shot-forecast');
      check(rangedAim.title.includes('30 Archers') && rangedAim.tag.text.includes('Shoot'), `${profile.name} a shot forecast preserves the attacker's identity`);
      await clearOfTarget(page, profile, target.at);
      if (profile.touch) check(JSON.stringify(await battle(page)) === JSON.stringify(ranged), `${profile.name} first target tap spends no shots and changes no seed`);
      await point(page, profile, target.at, !profile.touch);
      await readyTurn(page);
      check((await battle(page)).fighters.find(f => f.id === current(ranged).id).shots === current(ranged).shots - 1, `${profile.name} the shot spends exactly one arrow`);
      await page.close();

      page = await open(context, profile);
      await press(command(page, profile, 'spells'), profile);
      await page.locator('.kc-card-wrap:not([hidden]) .kc-card').evaluate(async element => {
        await Promise.all(element.getAnimations().map(animation => animation.finished));
      });
      const whileReading = JSON.stringify(await battle(page));
      const blockedMove = await page.evaluate(() => {
        const hook = window.__kc.battle();
        return hook.moves().find(hex => {
          const at = hook.hexOnPage(hex);
          return document.elementFromPoint(at.x, at.y)?.tagName === 'CANVAS';
        });
      });
      if (blockedMove !== undefined) {
        await point(page, profile, blockedMove, true);
        check(JSON.stringify(await battle(page)) === whileReading, `${profile.name} an open spellbook does not accept orders through the exposed field`);
      } else check(await command(page, profile, 'wait').isDisabled(), `${profile.name} the spellbook covers the available moves and disables battle orders`);
      const fireball = page.locator('.kc-card-wrap:not([hidden]) button').filter({ hasText: /^Cast Fireball/ });
      const cost = Number((await fireball.innerText()).match(/\((\d+) mana/)[1]);
      await press(fireball, profile);
      await command(page, profile, 'spells').filter({ hasText: 'Cancel' }).waitFor();
      check((await command(page, profile, 'spells').innerText()).includes('Cancel'), `${profile.name} spell targeting has a visible Cancel command`);
      await press(command(page, profile, 'spells'), profile);
      await command(page, profile, 'spells').filter({ hasText: 'Spells' }).waitFor();
      check((await command(page, profile, 'spells').innerText()).includes('Spells'), `${profile.name} Cancel returns to ordinary battle controls`);
      await press(command(page, profile, 'spells'), profile);
      await press(fireball, profile);
      const casting = await battle(page);
      const victim = casting.fighters.find(f => f.side === 'enemy' && f.at >= 0);
      const friendly = casting.fighters.find(f => f.side === 'player' && f.at >= 0 && f.id !== casting.order[0]);
      await point(page, profile, friendly.at, true);
      check(JSON.stringify(await battle(page)) === JSON.stringify(casting) && await page.evaluate(() => window.__kc.battle().pointer()) === 'no', `${profile.name} an enemy spell rejects a friendly target without spending mana`);
      await point(page, profile, victim.at);
      const spellAim = await shot(page, profile, 'spell-forecast');
      check(spellAim.tag.text.includes('Cast Fireball') && spellAim.text.includes(`Mana ${casting.hero.mana}`), `${profile.name} the selected spell and real mana remain legible`);
      await clearOfTarget(page, profile, victim.at);
      check(JSON.stringify(await battle(page)) === JSON.stringify(casting), `${profile.name} pointing at a spell target is non-mutating`);
      await point(page, profile, victim.at, !profile.touch);
      await readyTurn(page);
      check((await battle(page)).hero.mana === casting.hero.mana - cost, `${profile.name} the displayed spell cost is spent exactly once`);
      await page.close();

      page = await open(context, profile);
      // Synthetic exhausted resources, applied before Wait creates the next immutable rules state.
      await page.evaluate(() => {
        const b = window.__kc.battle().battle();
        b.hero.mana = 0;
        const archers = b.fighters.find(f => f.side === 'player' && f.troop === 'archers');
        archers.shots = 0;
        archers.status.push('slowed');
      });
      await press(command(page, profile, 'wait'), profile);
      await readyTurn(page);
      const exhausted = await shot(page, profile, 'exhausted-status');
      check(exhausted.text.includes('Mana 0') && exhausted.text.includes('Shots 0') && exhausted.text.includes('Slowed'), `${profile.name} exhausted mana, arrows and statuses are explicit`);
      await press(command(page, profile, 'spells'), profile);
      const unaffordable = page.locator('.kc-card-wrap:not([hidden]) button').filter({ hasText: /^Cast Fireball/ });
      check(await unaffordable.isDisabled() && (await unaffordable.innerText()).includes('short'), `${profile.name} unaffordable spells show the precise shortage`);
      await page.keyboard.press('Escape');
      await page.evaluate(() => { const b = window.__kc.battle().battle(); b.fighters.find(f => f.id === b.order[0]).waited = true; });
      await advance(page);
      check(await command(page, profile, 'wait').isDisabled(), `${profile.name} an already-waited company cannot accidentally Defend through Wait`);
      await press(command(page, profile, 'defend'), profile);
      await readyTurn(page);
      check((await battle(page)).fighters.find(f => f.troop === 'archers' && f.side === 'player').defending, `${profile.name} Defend remains a real manual command`);
      await page.close();

      page = await open(context, profile, '&army=knights:10&enemy=wolves:8');
      await readyTurn(page);
      const melee = await page.evaluate(() => window.__kc.battle().melee()[0]);
      check(Boolean(melee), `${profile.name} the representative advancing wolves are within melee reach`);
      const closeFight = await battle(page);
      const closeTarget = closeFight.fighters.find(f => f.id === melee.target);
      await point(page, profile, closeTarget.at);
      const meleeAim = await shot(page, profile, 'melee-forecast');
      check(/Attack|Charge/.test(meleeAim.tag.text), `${profile.name} a manual melee attack has a real forecast`);
      await point(page, profile, closeTarget.at, !profile.touch);
      await readyTurn(page);
      const afterMelee = await battle(page);
      if (afterMelee) check(afterMelee.fighters.find(f => f.id === melee.target).count < closeTarget.count, `${profile.name} the selected melee blow reaches its target`);
      else check(new RegExp(`\\b${closeTarget.count}\\b.*wolves`, 'i').test(await page.locator('.battle-result-side').last().innerText()), `${profile.name} the displayed lethal melee blow accounts for every wolf in the result`);
      await page.close();

      page = await open(context, profile);
      await press(command(page, profile, 'retreat'), profile);
      check(await page.getByRole('heading', { name: 'Sound the retreat?' }).count() === 1, `${profile.name} Retreat still asks before losing men`);
      await press(page.locator('.kc-card-wrap:not([hidden]) button').filter({ hasText: 'Stay and fight' }), profile);
      check(JSON.stringify(await battle(page)) === JSON.stringify(initial), `${profile.name} declining Retreat changes no battle state`);
      await press(command(page, profile, 'auto'), profile);
      await page.waitForFunction(() => document.querySelector('.kc-battle-commands button[data-id="auto"]')?.getAttribute('aria-pressed') === 'true');
      check(await page.evaluate(() => window.__kc.battle().isAuto()), `${profile.name} Auto hands command to the sergeants`);
      check(await command(page, profile, 'wait').isDisabled(), `${profile.name} manual orders are visibly disabled during Auto`);
      await shot(page, profile, 'auto');
      await press(command(page, profile, 'auto'), profile);
      check(!await page.evaluate(() => window.__kc.battle().isAuto()), `${profile.name} Auto returns manual command`);
      const beforeRetreat = await battle(page);
      await press(command(page, profile, 'retreat'), profile);
      await press(page.locator('.kc-card-wrap:not([hidden]) button').filter({ hasText: /^Retreat$/ }), profile);
      await readyTurn(page);
      const afterRetreat = await page.evaluate(() => window.__kc.state());
      check(beforeRetreat.fighters.filter(f => f.side === 'player' && f.at >= 0).every(f => afterRetreat.army.find(stack => stack.troop === f.troop)?.count === f.count - Math.ceil(f.count / 4)), `${profile.name} a confirmed Retreat applies the existing quarter-company cost`);
      check(!await page.locator('.kc-battle').count() && await page.locator('.battle-result').count() === 1, `${profile.name} Retreat leaves the battle interface for its existing result`);
      await page.close();

      page = await open(context, profile, '&hero=courtier');
      for (let i = 0; i < 4 && current(await battle(page)).troop !== 'heroCourtier'; i++) {
        await press(command(page, profile, 'wait'), profile);
        await readyTurn(page);
      }
      check((await command(page, profile, 'defend').innerText()).includes('Sing'), `${profile.name} the Courtier's bard command stays correctly named`);
      await press(command(page, profile, 'defend'), profile);
      check(await page.locator('.kc-card-wrap:not([hidden]) button').count() > 1, `${profile.name} Sing opens the existing songs`);
      await page.close();

      page = await context.newPage();
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(`${base}?freeze=1&fresh=1&battle=patrol&hero=wizard&army=knights:30&enemy=peasants:3&touch=${profile.touch ? 1 : 0}`);
      await page.waitForFunction(() => window.__ready);
      await press(command(page, profile, 'auto'), profile);
      await page.evaluate(() => { for (let i = 0; i < 1200 && window.__kc.battle(); i++) window.__kc.advance(.1); });
      check(!await page.evaluate(() => window.__kc.battle()) && !await page.locator('.kc-battle').count(), `${profile.name} a gentle Auto victory disposes its battle UI`);
      check(await page.locator('.battle-result').count() === 1, `${profile.name} the existing result panel remains reachable`);
      await page.screenshot({ path: `${out}/${profile.name}-result.png` });
      await press(page.locator('.kc-card-wrap:not([hidden]) button').first(), profile);
      check(await page.evaluate(() => window.__kc.screen()) === 'adventure', `${profile.name} the result returns to the map`);
      await page.close();
    } finally { await context.close(); }
  }
  check(!errors.length, `No battle page errors (${errors.join(' | ')})`);
} finally {
  writeFileSync(`${out}/report.json`, JSON.stringify({ checks, errors, captures }, null, 2));
  await browser.close();
  await server?.close();
}
