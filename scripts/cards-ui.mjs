import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { startServer } from './lib/server.mjs';

const server = process.env.URL ? null : await startServer();
const base = process.env.URL ?? server.url;
const channel = process.env.CHANNEL ?? 'msedge';
const browser = await chromium.launch(channel === 'bundled' ? {} : { channel });
const out = process.env.OUT_DIR;
if (out) mkdirSync(out, { recursive: true });
const captures = [], checks = [], errors = [];
const profiles = [
  { name: 'desktop', width: 1280, height: 720, touch: false },
  { name: 'phone', width: 844, height: 390, touch: true },
  { name: 'compact', width: 667, height: 375, touch: true },
];
const check = (condition, message) => { assert.ok(condition, message); checks.push(message); console.log(`ok ${message}`); };
const press = (page, target, touch) => touch ? target.tap() : target.click();

async function inspect(page, profile, name, capture = false) {
  const measured = await page.evaluate(() => {
    const card = document.querySelector('.kc-card-wrap:not([hidden]) .kc-card');
    const box = card.getBoundingClientRect();
    const reading = card.querySelector('.kc-card-body');
    const controls = [...card.querySelectorAll('button, a.link')].flatMap(element => {
      const r = element.getBoundingClientRect();
      let left = Math.max(0, box.left, r.left), right = Math.min(innerWidth, box.right, r.right);
      let top = Math.max(0, box.top, r.top), bottom = Math.min(innerHeight, box.bottom, r.bottom);
      for (let parent = element.parentElement; parent && parent !== card; parent = parent.parentElement) {
        const style = getComputedStyle(parent), clip = parent.getBoundingClientRect();
        if (/(auto|scroll|hidden)/.test(style.overflowX)) { left = Math.max(left, clip.left); right = Math.min(right, clip.right); }
        if (/(auto|scroll|hidden)/.test(style.overflowY)) { top = Math.max(top, clip.top); bottom = Math.min(bottom, clip.bottom); }
      }
      if (right <= left || bottom <= top) return [];
      const hit = document.elementFromPoint((left + right) / 2, (top + bottom) / 2);
      if (!hit || !element.contains(hit)) return [];
      return [{ words: element.textContent.trim(), x: left, y: top, width: right - left, height: bottom - top, fullyVisible: right - left >= r.width - .5 && bottom - top >= r.height - .5 }];
    });
    const overlaps = [];
    for (let i = 0; i < controls.length; i++) for (let j = i + 1; j < controls.length; j++) {
      const a = controls[i], b = controls[j];
      if (Math.min(a.x + a.width, b.x + b.width) > Math.max(a.x, b.x) + .5 && Math.min(a.y + a.height, b.y + b.height) > Math.max(a.y, b.y) + .5) overlaps.push([a.words, b.words]);
    }
    const footer = card.querySelector('.kc-card-footer');
    const close = [...card.querySelectorAll('.choices button')].find(button => button.dataset.dismiss === 'true');
    return {
      bounds: { x: box.x, y: box.y, width: box.width, height: box.height },
      reading: { height: reading.clientHeight, content: reading.scrollHeight, overflow: reading.scrollHeight - reading.clientHeight, horizontal: reading.scrollWidth - reading.clientWidth },
      controls, overlaps,
      headingOutsideReading: Boolean(card.querySelector('.kc-card-heading')) && !reading.contains(card.querySelector('h3')),
      closeInFooter: !close || footer.contains(close),
      imageErrors: [...card.querySelectorAll('img')].filter(image => image.getClientRects().length && (!image.complete || !image.naturalWidth)).length,
    };
  });
  check(measured.headingOutsideReading, `${profile.name} ${name} keeps its heading outside the scrolling content`);
  check(measured.bounds.x >= 0 && measured.bounds.y >= 0 && measured.bounds.x + measured.bounds.width <= profile.width + .5 && measured.bounds.y + measured.bounds.height <= profile.height + .5, `${profile.name} ${name} stays inside the viewport`);
  check(measured.reading.horizontal <= 1, `${profile.name} ${name} has no sideways text overflow`);
  check(measured.reading.height >= Math.min(56, measured.reading.content), `${profile.name} ${name} leaves useful reading room`);
  check(measured.closeInFooter && measured.overlaps.length === 0, `${profile.name} ${name} keeps dismissal separate without overlapping controls`);
  if (profile.touch) check(measured.controls.filter(control => control.fullyVisible).every(control => control.width >= 43.5 && control.height >= 43.5), `${profile.name} ${name} has native finger-sized fully visible actions`);
  check(measured.imageErrors === 0, `${profile.name} ${name} has loaded portraits and figures`);
  if (out && capture) {
    const file = `${profile.name}-${name}.png`;
    await page.screenshot({ path: `${out}/${file}`, animations: 'disabled' });
    captures.push({ file, profile, url: page.url(), provenance: 'Rule-generated presentation fixtures use the real shared renderer. Journal, purchase and settings also run through the real UI. Battle losses are synthetic.', measured });
  }
  return measured;
}

try {
  for (const profile of profiles) {
    const context = await browser.newContext({ viewport: { width: profile.width, height: profile.height }, hasTouch: profile.touch, isMobile: profile.touch, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}?fresh=1&freeze=1&seed=1066&hero=wizard&gear=twinWand,crystalBall,oldBanner,brannocsLance,silverSignet,luckyHorseshoe&flags=tower:journal,pike:false,pikeHome:true,orders:true,poachers:spared&touch=${profile.touch ? 1 : 0}`);
    await page.waitForFunction(() => window.__ready);
    await page.evaluate(() => document.fonts.ready);
    const card = page.locator('.kc-card-wrap:not([hidden]) .kc-card');
    await page.keyboard.press('j');
    await inspect(page, profile, 'journal', true);
    const beforeJournal = await page.evaluate(() => JSON.stringify(window.__kc.state()));
    if (profile.touch) {
      check(await card.locator('.page').evaluate(page => {
        const body = page.closest('.kc-card-body').getBoundingClientRect();
        const cue = page.closest('.kc-card').querySelector('.kc-card-more');
        const reward = [...page.querySelectorAll('p')].find(line => line.textContent.startsWith('Reward:'));
        const bottom = getComputedStyle(cue).visibility === 'hidden' ? body.bottom : cue.getBoundingClientRect().top;
        return reward.getBoundingClientRect().bottom <= bottom;
      }), `${profile.name} the journal reward is readable before turning or scrolling`);
      await press(page, card.locator('.kc-journal-tabs [data-page="heard"]'), true);
      check(await card.locator('.heard').isVisible() && !await card.locator('.page').isVisible(), `${profile.name} journal switches pages without squeezing two reading columns`);
      check(await page.evaluate(() => JSON.stringify(window.__kc.state())) === beforeJournal, `${profile.name} turning a journal page changes no game state`);
      await card.locator('.kc-journal-tabs [data-page="heard"]').focus();
      await page.keyboard.press('ArrowLeft');
      check(await card.locator('.page').isVisible(), `${profile.name} journal page tabs support arrow keys`);
    }
    await page.keyboard.press('Escape');
    check(await page.locator('.kc-card-wrap:not([hidden])').count() === 0, `${profile.name} Escape dismisses the journal`);

    const fixtureState = await page.evaluate(() => window.__kc.state());
    const castle = await page.evaluate(() => {
      const [x, y] = window.__kc.centre('castle');
      window.__kc.view(x, y);
      return window.__kc.onPage(x, y).view;
    });
    if (profile.touch) await page.touchscreen.tap(castle.x, castle.y);
    else await page.mouse.click(castle.x, castle.y);
    await press(page, card.getByRole('button', { name: 'Visit', exact: true }), profile.touch);
    if (await card.locator('h3').textContent() === 'On the road') await press(page, card.getByRole('button', { name: 'Ride on', exact: true }), profile.touch);
    await page.evaluate(() => {
      for (let i = 0; i < 1000 && ![...document.querySelectorAll('.kc-card-wrap:not([hidden]) button')].some(button => button.textContent.startsWith('Visit the armoury')); i++) window.__kc.advance(.05);
    });
    await press(page, card.getByRole('button', { name: 'Visit the armoury', exact: true }), profile.touch);
    const purchaseGold = await page.evaluate(() => window.__kc.state().gold);
    const sword = card.getByRole('button', { name: /^Buy Sword of Aldmoor/ });
    check(await sword.locator('.price').textContent() === '(900 gold)', `${profile.name} the purchase keeps its exact quoted price`);
    await sword.focus();
    await press(page, sword, profile.touch);
    check(await page.evaluate(() => window.__kc.state().gold) === purchaseGold - 900, `${profile.name} a real purchase spends the displayed price exactly once`);
    check(await page.evaluate(() => window.__kc.state().hero.gear.weapon === 'swordOfAldmoor' || window.__kc.state().hero.pack.includes('swordOfAldmoor')), `${profile.name} the bought sword reaches the hero through the real rules`);
    check(await card.evaluate(element => element.contains(document.activeElement)), `${profile.name} a purchase retains keyboard focus inside the updated card`);
    await page.reload();
    await page.waitForFunction(() => window.__ready);

    await page.evaluate(async state => {
      const { CardView } = await import('/src/ui/card.ts');
      const rules = await import('/src/rules/game.ts');
      const intro = await import('/src/game/intro.ts');
      const cardIn = result => {
        const card = result?.events.find(event => event.type === 'card')?.card;
        if (!card) throw new Error('Expected an actual game card');
        return card;
      };
      const returned = rules.toCourt({ ...state, over: 'won', bounty: 'paid' });
      if (!returned) throw new Error('Expected the won commission to return to court');
      const court = { ...returned.state, campaign: { ...returned.state.campaign, court: { boons: ['fencing', 'library', 'warrant'] } } };
      window.__cardFixtures = {
        recruit: cardIn(rules.visit(state, 'castle')),
        shop: cardIn(rules.choose(state, 'castle', 'armoury')),
        'poor-shop': cardIn(rules.choose({ ...state, gold: 0 }, 'castle', 'armoury')),
        selling: cardIn(rules.choose(state, 'castle', 'spares')),
        empty: cardIn(rules.choose({ ...state, hero: { ...state.hero, pack: [] } }, 'castle', 'spares')),
        event: cardIn(rules.visit(state, 'tower')),
        enemy: cardIn(rules.visit(state, 'patrol')),
        wanted: intro.wantedCard(),
        king: intro.kingCard(),
        heroes: intro.backgroundCard(),
        briefing: intro.storyCard('wizard', true),
        boon: rules.courtCard(court),
        closing: rules.closingCard(court),
        help: intro.keysCard(),
        reward: { ...rules.bountyCard(court), battleResult: { player: [{ troop: 'archers', count: 2 }], enemy: [{ troop: 'swordsmen', count: 5 }], manaAvailable: 30, manaSpent: 10, sergeantsSpent: 4 } },
        confirmation: { title: 'Sound the retreat?', lines: ['Your men fall back to the map, and every company loses a quarter of its number on the way.', 'The enemy stays where it is.'], choices: [{ label: 'Retreat', action: { type: 'retreat' } }, { label: 'Stay and fight', action: { type: 'close' } }] },
      };
      window.__cardActions = [];
      window.__sharedCard = new CardView(action => window.__cardActions.push(action));
    }, fixtureState);
    const show = async (name, constrained = false) => {
      await page.evaluate(({ name, constrained }) => {
        window.__sharedCard.show(window.__cardFixtures[name]);
        window.__sharedCard.place(null, 0, innerHeight, undefined, constrained ? { left: innerWidth / 2, right: innerWidth - 16 } : undefined);
      }, { name, constrained });
      await page.waitForFunction(() => [...document.querySelectorAll('.kc-card-wrap:not([hidden]) img')].every(image => image.complete && image.naturalWidth));
      await card.evaluate(async element => {
        await Promise.all(element.getAnimations({ subtree: true }).filter(animation => animation.effect.getTiming().iterations !== Infinity).map(animation => animation.finished));
      });
    };
    for (const name of ['recruit', 'shop', 'selling', 'empty', 'event', 'enemy', 'wanted', 'king', 'heroes', 'briefing', 'boon', 'closing', 'help', 'reward', 'confirmation']) {
      await show(name);
      if (name === 'heroes') check(await card.evaluate(element => {
        element.classList.remove('unfold');
        void element.offsetWidth;
        element.classList.add('unfold');
        const animation = element.getAnimations().find(animation => animation.animationName === 'kc-unfold');
        if (!animation) throw new Error('Expected the card entrance animation');
        const button = element.querySelector('.choices button');
        animation.pause();
        animation.currentTime = 0;
        const before = button.getBoundingClientRect();
        animation.finish();
        const after = button.getBoundingClientRect();
        return Math.abs(before.x - after.x) < .5 && Math.abs(before.y - after.y) < .5 && Math.abs(before.width - after.width) < .5 && Math.abs(before.height - after.height) < .5;
      }), `${profile.name} choice targets stay stationary throughout the card entrance`);
      const measured = await inspect(page, profile, name, ['shop', 'enemy', 'heroes', 'help', 'reward'].includes(name));
      if (['shop', 'heroes'].includes(name)) {
        const fixed = await card.locator('.kc-card-heading').boundingBox();
        await card.locator('.kc-card-body').evaluate(element => { element.scrollTop = element.scrollHeight; });
        const after = await card.locator('.kc-card-heading').boundingBox();
        check(after.y === fixed.y, `${profile.name} ${name} scrolls without moving its heading`);
        await inspect(page, profile, `${name}-last`);
      }
      if (name === 'confirmation') {
        check(await card.locator('button.danger').count() === 1, `${profile.name} retreat is visibly different from the safe answer`);
        check(await card.locator('button[data-dismiss="true"]').evaluate(element => element === document.activeElement), `${profile.name} a destructive confirmation focuses its safe answer`);
      }
      if (name === 'enemy') check(await card.locator('.kc-card-footer button').evaluateAll(buttons => buttons.some(button => JSON.parse(button.dataset.action).choice === 'fight')), `${profile.name} the main combat decision stays visible beside Retreat`);
      if (name === 'closing') {
        check(await card.locator('a.link[target="_blank"][rel~="noopener"]').count() === 2, `${profile.name} closing links retain their destinations and new-tab safety`);
      }
      if (name === 'shop' && profile.touch) check(measured.reading.overflow > 0, `${profile.name} the shop scrolls its offers instead of burying Close`);
    }
    await show('heroes', true);
    const constrained = await inspect(page, profile, 'constrained-heroes');
    check(constrained.bounds.x >= profile.width / 2 - .5 && constrained.bounds.x + constrained.bounds.width <= profile.width - 16 + .5, `${profile.name} supplied scene sides constrain wide hero choices`);
    await show('poor-shop');
    const disabled = await card.locator('.choices button:disabled').count();
    check(disabled > 0 && await card.locator('.choices button:disabled small').count() === disabled, `${profile.name} unaffordable purchases keep their explanations`);
    await show('shop');
    await page.evaluate(() => window.__sharedCard.pressNumber(1));
    check((await page.evaluate(() => window.__cardActions)).at(-1)?.choice?.startsWith('buy:'), `${profile.name} number keys retain the original offer ordering`);
    await page.evaluate(() => window.__sharedCard.hide());

    const settingsOpener = page.locator(profile.touch ? '.kc-rail button[data-id="mix"]' : '.kc-mix');
    await settingsOpener.focus();
    await press(page, settingsOpener, profile.touch);
    await page.waitForSelector('.kc-mix-panel:not([hidden])');
    const settings = await page.locator('.kc-mix-panel').evaluate(panel => {
      const rect = panel.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, controls: [...panel.querySelectorAll('button,input,label')].filter(element => element.getClientRects().length).map(element => { const r = (element.type === 'checkbox' ? element.closest('label') : element).getBoundingClientRect(); return { width: r.width, height: r.height }; }) };
    });
    check(settings.x >= 0 && settings.y >= 0 && settings.x + settings.width <= profile.width && settings.y + settings.height <= profile.height, `${profile.name} settings stay in the viewport`);
    if (profile.touch) check(settings.controls.every(control => control.width >= 43.5 && control.height >= 43.5), `${profile.name} settings allocate native touch targets`);
    const music = page.locator('.kc-mix-panel input[type="range"]').first();
    await music.focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight');
    check(await music.inputValue() === '1' && await page.locator('.kc-mix-row output').first().textContent() === '1%', `${profile.name} native volume keys update the visible value`);
    if (out) {
      const file = `${profile.name}-settings.png`;
      await page.screenshot({ path: `${out}/${file}`, animations: 'disabled' });
      captures.push({ file, profile, url: page.url(), provenance: 'The real mix panel, opened through its shared rail API.', measured: settings });
    }
    await page.keyboard.press('Escape');
    check(await page.locator('.kc-mix-panel').isHidden(), `${profile.name} Escape closes settings`);
    check(await settingsOpener.evaluate(element => element === document.activeElement), `${profile.name} settings return keyboard focus to their visible opener`);
    await page.evaluate(() => window.__sharedCard.dispose());
    if (profile.name === 'compact') {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForSelector('.kc-turn', { state: 'visible' });
      check(await page.locator('.kc-turn').getAttribute('role') === 'dialog', 'the upright message remains an accessible orientation dialog');
      if (out) {
        await page.screenshot({ path: `${out}/upright.png`, animations: 'disabled' });
        captures.push({ file: 'upright.png', profile: { width: 375, height: 667, touch: true }, url: page.url(), provenance: 'The real orientation screen.' });
      }
    }
    await context.close();
  }
  check(errors.length === 0, 'shared card and settings tasks have no page errors');
} finally {
  if (out) writeFileSync(`${out}/report.json`, `${JSON.stringify({ base, checks, errors, captures }, null, 2)}\n`);
  await browser.close();
  await server?.close();
}
