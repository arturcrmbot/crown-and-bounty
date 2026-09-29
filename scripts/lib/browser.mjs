import { chromium } from 'playwright';

/** A 960 x 540 page on headless Edge (CHANNEL=bundled: Playwright's own Chromium, as in CI), with page errors printed. */
export async function openPage() {
  const channel = process.env.CHANNEL ?? 'msedge';
  const browser = await chromium.launch(channel === 'bundled' ? {} : { channel });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errors.push(m.text()));
  return { browser, page, errors };
}

/** Helpers over the game's debug hooks (window.__kc). */
export function kc(page) {
  const call = (fn, arg) => page.evaluate(fn, arg);
  return {
    call,
    ready: () => page.waitForFunction(() => window.__ready === true),
    /** Clicks the title's "Click anywhere to begin", which starts the sound and opens the menu. */
    begin: async () => {
      await page.mouse.click(480, 360);
      // The menu comes up on the click; on a busy machine that can take a moment.
      await page.waitForFunction(() => document.querySelector('.kc-card-wrap:not([hidden])'), null, { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(80);
    },
    title: () => call(() => document.querySelector('.kc-card-wrap:not([hidden]) h3')?.textContent ?? null),
    lines: () => call(() => [...document.querySelectorAll('.kc-card-wrap:not([hidden]) p')].map((p) => p.textContent).join(' / ')),
    /** Presses the card's button starting with `label`, waiting a moment for it: a new screen's cards wait for its transition. */
    choose: async (label, wait = 3000) => {
      const ok = await page.waitForFunction((l) => window.__kc.choose(l), label, { timeout: wait, polling: 50 }).then(() => true, () => false);
      await page.waitForTimeout(60);
      return ok;
    },
    state: () => call(() => window.__kc.state()),
    status: () => call(() => window.__kc.status()),
    centre: (id) => call((i) => window.__kc.centre(i), id),
    /** Scrolls the map to a point first, as a player would before clicking something far off. */
    view: (x, y) => call(([vx, vy]) => window.__kc.view(vx, vy), [x, y]),
    click: (x, y) => call(([cx, cy]) => window.__kc.click(cx, cy), [x, y]),
    frameHash: () => call(() => window.__kc.frameHash()),
  };
}
