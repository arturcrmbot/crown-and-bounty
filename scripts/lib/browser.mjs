import { chromium } from 'playwright';

/** A 960 x 540 page on headless Edge, with page errors printed. */
export async function openPage() {
  const browser = await chromium.launch({ channel: process.env.CHANNEL ?? 'msedge' });
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
    title: () => call(() => document.querySelector('.kc-card-wrap:not([hidden]) h3')?.textContent ?? null),
    lines: () => call(() => [...document.querySelectorAll('.kc-card-wrap:not([hidden]) p')].map((p) => p.textContent).join(' / ')),
    choose: async (label) => {
      const ok = await call((l) => window.__kc.choose(l), label);
      await page.waitForTimeout(60);
      return ok;
    },
    state: () => call(() => window.__kc.state()),
    status: () => call(() => window.__kc.status()),
    centre: (id) => call((i) => window.__kc.centre(i), id),
    click: (x, y) => call(([cx, cy]) => window.__kc.click(cx, cy), [x, y]),
    frameHash: () => call(() => window.__kc.frameHash()),
  };
}
