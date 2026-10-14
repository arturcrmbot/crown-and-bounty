import type { PortraitId } from '../content/portraits';
import { ARTIFACTS, type ArtifactId } from '../content/artifacts';
import { troops, type TroopId } from '../content/troops';
import { artifactIcon } from '../render/artifactIcons';
import { outline } from '../render/bitmap';
import { INK } from '../render/palette';
import { portraitOf } from '../render/portraits';
import { standingFigure } from '../render/battleSprites';
import { manaLine, type Action, type Army, type Card, type Found, type Heard } from '../rules/game';
import './card.css';
import { bitmapUrl, PARCHMENT_SHADOW } from './pixels';
import { uiRoom, uiScale } from './scale';
import { play } from './sound';
import { touch } from './touch';

type ScreenPoint = { x: number; y: number };
/** The card's border, top and bottom. Its heading and footer are measured separately. */
const CHROME = 4;
/** How much of a card's words should show above its buttons before it may cover the bar. */
const SOME_WORDS = 72;
/** Played by touch, how much of a card's words should show above its buttons: its title and the odds of a fight. */
const WORDS_ON_TOUCH = 96;
/**
 * Played by touch, a card with this many buttons or more puts them two to a row when one column
 * would leave too little of its words in sight: a phone on its side is wide and short.
 */
const TWO_UP = 3;
/** When a poster's stamp lands, after the card has unfolded (the `kc-stamp` animation in card.css), in ms. */
const STAMP_LANDS = 470;
let cardNumber = 0;
/** A box on the page (page pixels) that a card with nowhere in particular to be should keep clear of. */
export type Keepout = { x0: number; y0: number; x1: number; y1: number };

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const format = (text: string) => escape(text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>');

/** A button's or a link's words: its label (with an arrow, for a link that opens a new tab), and the smaller line under it. */
function wordsOf(label: string, detail?: string, out = false): HTMLSpanElement {
  const words = document.createElement('span');
  words.className = 'words';
  const priced = label.match(/^(.*) (\([^)]*(?:gold|mana|free|leadership)[^)]*\))$/);
  words.textContent = priced ? `${priced[1]} ` : label;
  if (priced) {
    const price = document.createElement('span');
    price.className = 'price';
    price.textContent = priced[2];
    words.append(price);
  }
  if (out) {
    const arrow = document.createElement('span');
    arrow.className = 'out';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '\u2197';
    words.append(arrow);
  }
  if (detail) {
    const small = document.createElement('small');
    small.innerHTML = format(detail);
    words.append(small);
  }
  return words;
}

/** A portrait as an image for the page, drawn once through the game's palette. */
const images = new Map<PortraitId, string>();
function portraitImage(id: PortraitId): string {
  let url = images.get(id);
  if (!url) {
    url = bitmapUrl(portraitOf(id));
    images.set(id, url);
  }
  return url;
}

const fallenImages = new Map<string, string>();
function fallenImage(id: TroopId, team: 'blue' | 'red'): string {
  const key = `${id}:${team}`;
  let url = fallenImages.get(key);
  if (!url) {
    url = bitmapUrl(outline(standingFigure(id, team, 0.5), INK), PARCHMENT_SHADOW);
    fallenImages.set(key, url);
  }
  return url;
}

function battleResultMarkup(card: NonNullable<Card['battleResult']>): string {
  const side = (name: string, army: Army, team: 'blue' | 'red') => `
    <section class="battle-result-side">
      <h4>${name}</h4>
      ${army.length ? army.map((stack) => `<div class="battle-result-unit"><img alt="" src="${fallenImage(stack.troop, team)}"><span>${escape(troops(stack.troop, stack.count))}</span></div>`).join('') : '<p class="battle-result-none">Nobody fell.</p>'}
    </section>`;
  return `<div class="battle-result">${side('Your fallen', card.player, 'blue')}${side('Their fallen', card.enemy, 'red')}</div><p class="battle-result-mana">${escape(manaLine(card))}</p>`;
}

/**
 * The journal's right-hand page: each thing heard in its own words, who said it, and a tick once it
 * has paid off. Under them, the tally of things found in the province (#192).
 */
function heardMarkup(heard: Heard[], found: Found[] = []): string {
  const items = heard.map((h) => `<li${h.done ? ' class="done"' : ''}><span class="heard-status" role="img" aria-label="${h.done ? 'Resolved' : 'Unresolved'}"></span><span class="words">\u201c${format(h.words)}\u201d</span><small>${escape(h.who)}</small></li>`).join('');
  const list = heard.length ? `<ul>${items}</ul>` : '<p class="none">You have heard nothing yet. What you hear on the road goes down here.</p>';
  const tally = found.length ? `<h4 class="found">Things found</h4><ul class="found">${found.map((f) => `<li><span>${escape(f.what)}</span><i></i><b>${f.got} of ${f.of}</b></li>`).join('')}</ul>` : '';
  return `<section class="heard"><h4>Things heard</h4>${list}${tally}</section>`;
}

/**
 * The card's sounds: a soft pat as it unfolds, and another as it's put away. A card put away only
 * to be replaced by the next at once just unfolds: the fold waits a moment to see.
 */
let folding: ReturnType<typeof setTimeout> | null = null;
function unfolds() {
  if (folding) clearTimeout(folding);
  folding = null;
  play('unfold');
}
function folds() {
  if (folding) return;
  folding = setTimeout(() => {
    folding = null;
    play('fold');
  }, 0);
}

/** The one parchment card on screen. It sits above whatever it describes and follows it around. */
export class CardView {
  private readonly id = `kc-card-${++cardNumber}`;
  private readonly wrap = document.createElement('div');
  private readonly card = document.createElement('div');
  private readonly heading = document.createElement('div');
  private readonly tabs = document.createElement('div');
  private readonly reading = document.createElement('div');
  private readonly footer = document.createElement('div');
  /** Words and dense offers scroll, while the heading and the way out stay put. */
  private readonly body = document.createElement('div');
  /** A passive scroll hint, never an undersized or overlapping touch command. */
  private readonly more = document.createElement('div');
  private onChoice: (action: Action) => void;
  private title: string | null = null;
  private scale = 1;
  private tallest = '';
  private roomWidth = '';
  private bar = '';
  /** The window's height and the scale the buttons were last laid out for, one column or two. */
  private laidOut = '';
  private journalPage: 'commission' | 'heard' = 'commission';
  private opener: HTMLElement | null = null;

  constructor(onChoice: (action: Action) => void) {
    this.onChoice = onChoice;
    this.wrap.className = 'kc-card-wrap';
    this.card.className = 'kc-card';
    this.card.setAttribute('role', 'dialog');
    this.heading.className = 'kc-card-heading';
    this.tabs.className = 'kc-journal-tabs';
    this.tabs.setAttribute('role', 'tablist');
    this.tabs.setAttribute('aria-label', 'Journal pages');
    this.tabs.hidden = true;
    this.tabs.innerHTML = `<button role="tab" data-page="commission" aria-controls="${this.id}-commission">The commission</button><button role="tab" data-page="heard" aria-controls="${this.id}-heard">Things heard</button>`;
    this.reading.className = 'kc-card-reading';
    this.body.className = 'kc-card-body';
    this.body.tabIndex = 0;
    this.body.setAttribute('aria-label', 'Card contents');
    this.footer.className = 'choices kc-card-footer';
    this.more.className = 'kc-card-more';
    this.more.innerHTML = '<span>more \u25be</span>';
    this.more.setAttribute('aria-hidden', 'true');
    this.reading.append(this.body, this.more);
    this.card.append(this.heading, this.tabs, this.reading, this.footer);
    this.wrap.append(this.card);
    this.wrap.hidden = true;
    document.body.append(this.wrap);
    this.card.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.body.addEventListener('scroll', () => this.scrolled(), { passive: true });
    this.tabs.addEventListener('click', (e) => {
      const button = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-page]');
      if (!button) return;
      this.journalPage = button.dataset.page === 'heard' ? 'heard' : 'commission';
      this.showJournal();
      this.body.scrollTop = 0;
      this.scrolled();
      play('click');
    });
    this.tabs.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      const next = this.tabs.querySelector<HTMLButtonElement>(`[data-page="${e.key === 'Home' || e.key === 'ArrowLeft' ? 'commission' : 'heard'}"]`)!;
      next.click();
      next.focus({ preventScroll: true });
    });
    this.card.addEventListener('keydown', (e) => {
      if (['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) e.stopPropagation();
      else if (this.key(e.key.toLowerCase())) {
        e.preventDefault();
        e.stopPropagation();
      } else if ((e.key === 'Enter' || e.key === ' ') && (e.target as HTMLElement).closest('button, a')) e.stopPropagation();
    });
    // The wheel turns the words from anywhere on the card: over "more", or over the buttons.
    this.card.addEventListener(
      'wheel',
      (e) => {
        const b = this.body;
        if (b.contains(e.target as Node) || b.scrollHeight <= b.clientHeight || this.card.scrollHeight > this.card.clientHeight) return;
        e.preventDefault();
        b.scrollTop += e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? b.clientHeight : 1);
      },
      { passive: false },
    );
  }

  private showJournal() {
    const journal = this.card.classList.contains('journal');
    this.tabs.hidden = !journal || !touch();
    if (!journal) return;
    for (const button of this.tabs.querySelectorAll<HTMLButtonElement>('button')) {
      const selected = button.dataset.page === this.journalPage;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    }
    const page = this.body.querySelector<HTMLElement>('.page')!;
    const heard = this.body.querySelector<HTMLElement>('.heard')!;
    page.id = `${this.id}-commission`;
    heard.id = `${this.id}-heard`;
    page.hidden = touch() && this.journalPage !== 'commission';
    heard.hidden = touch() && this.journalPage !== 'heard';
  }

  get isOpen() {
    return !this.wrap.hidden;
  }

  /** Whether some of the words are out of sight: that edge fades, and "more" points on down. */
  private scrolled() {
    const b = this.body;
    const hidden = b.scrollHeight - b.clientHeight;
    this.card.classList.toggle('more-above', hidden > 2 && b.scrollTop > 2);
    this.card.classList.toggle('more-below', hidden > 2 && b.scrollTop < hidden - 2);
    // The fade leaves the scrollbar alone, if it takes any room.
    const bar = `${b.offsetWidth - b.clientWidth}px`;
    if (bar !== this.bar) {
      this.bar = bar;
      b.style.setProperty('--bar', bar);
    }
  }

  show(card: Card) {
    // A new card unfolds like a letter; the same card shown again just updates.
    const fresh = this.wrap.hidden || this.title !== card.title;
    const scroll = fresh ? 0 : this.body.scrollTop;
    const focused = this.card.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.action : undefined;
    if (fresh && !this.wrap.contains(document.activeElement)) this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (fresh) {
      this.card.classList.remove('unfold');
      void this.card.offsetWidth;
      this.card.classList.add('unfold');
      unfolds();
    }
    this.title = card.title;
    this.card.classList.toggle('wide', Boolean(card.wide));
    this.card.classList.toggle('poster', Boolean(card.poster));
    this.card.classList.toggle('tiled', Boolean(card.tiles));
    this.card.classList.toggle('journal', Boolean(card.journal));
    this.card.setAttribute('aria-label', card.title || 'Crown & Bounty');
    const face = card.portrait ? `<img class="portrait" alt="" src="${portraitImage(card.portrait)}">` : '';
    const title = card.title ? `<h3>${escape(card.title)}</h3>` : '';
    this.heading.innerHTML = `${card.poster || card.journal ? '' : face}${title}`;
    this.heading.hidden = !this.heading.innerHTML;
    // The odds of a fight come first, under the title, in their colour.
    const verdict = card.verdict ? `<p class="kc-odds ${card.verdict.odds}">${escape(card.verdict.words)}</p>` : '';
    const battle = card.battleResult ? battleResultMarkup(card.battleResult) : '';
    const lines = card.lines.map((l) => `<p${/^\*\*[^*]+\.\*\*/.test(l) ? ' class="instruction"' : ''}>${format(l)}</p>`);
    // A poster's stamp lands across the face; its inset (what came home) closes it, with its line.
    const stamp = card.stamp ? `<span class="stamp">${escape(card.stamp)}</span>` : '';
    const inset = card.inset ? `<div class="inset"><img alt="" src="${portraitImage(card.inset.portrait)}"><p>${format(card.inset.line)}</p></div>` : '';
    // The fallen come first, or after as many lines as the rules say. Beside a face they'd leave a
    // gap under the title, so there they come after all the words, unless the rules say otherwise.
    const at = Math.min(lines.length, card.battleResult?.after ?? (face ? lines.length : 0));
    const words = [...lines.slice(0, at), battle, ...lines.slice(at)].join('');
    if (card.journal) {
      // Two pages: the commission, with its poster pinned in (stamped long since, so it doesn't land again), and what's been heard.
      const pinned = `<div class="pinned"><b>WANTED</b><div class="mugshot">${face}${stamp}</div></div>`;
      this.body.innerHTML = `<section class="page"><h4>The commission</h4>${pinned}${words}</section>${heardMarkup(card.journal.heard, card.journal.found)}`;
    } else this.body.innerHTML = card.poster ? `<div class="poster-summary"><div class="mugshot">${face}${stamp}</div><div class="poster-copy">${words}</div></div>${inset}` : `${verdict}${words}${inset}`;
    if (fresh) this.journalPage = 'commission';
    this.showJournal();
    if (fresh && card.stamp && !card.journal) setTimeout(() => play('stamp'), STAMP_LANDS);
    this.footer.replaceChildren();
    const dense = Boolean(card.tiles || card.links?.length || card.choices.length >= 5 || card.choices.some((c) => c.action.type === 'choose' && /^(buy|sell):/.test(c.action.choice)) || card.choices.filter((c) => c.detail).length >= 3);
    if (card.choices.length || card.links?.length) {
      const options = document.createElement('div');
      options.className = card.tiles ? 'choices kc-card-options tiles' : 'choices kc-card-options';
      const inFooter = (action: Action) => action.type === 'close' || action.type === 'title' || (action.type === 'choose' && (['armoury', 'spares'].includes(action.choice) || Boolean(card.verdict && ['fight', 'auto'].includes(action.choice))));
      // Links off the game come first, and open in a new tab, so the game stays where it was.
      for (const [i, link] of (card.links ?? []).entries()) {
        const a = document.createElement('a');
        a.className = 'link';
        a.href = link.href;
        a.target = '_blank';
        a.rel = 'noopener';
        a.dataset.choice = String(i + 1);
        a.dataset.action = link.href;
        a.append(wordsOf(link.label, link.detail, true));
        a.addEventListener('click', () => play('click'));
        options.append(a);
      }
      for (const [i, choice] of card.choices.entries()) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.choice = String((card.links?.length ?? 0) + i + 1);
        button.dataset.action = JSON.stringify(choice.action);
        button.dataset.dismiss = String(choice.action.type === 'close');
        const danger = ['retreat', 'dismiss', 'restart'].includes(choice.action.type) || (choice.action.type === 'choose' && ['fight', 'auto'].includes(choice.action.choice));
        button.classList.toggle('danger', danger);
        button.classList.toggle('primary', !dense && !danger && i === 0 && card.choices.length > 1 && choice.action.type !== 'close');
        button.classList.toggle('dismiss', choice.action.type === 'close' && card.choices.length > 1);
        // The label and the line under it go together, beside a face if there is one.
        button.append(wordsOf(choice.label, choice.detail));
        if (choice.portrait) {
          button.classList.add('with-portrait');
          const face = document.createElement('img');
          face.alt = '';
          face.src = portraitImage(choice.portrait);
          button.prepend(face);
        } else if (choice.action.type === 'choose' && /^(buy|sell):/.test(choice.action.choice)) {
          const id = choice.action.choice.split(':')[1];
          if (id in ARTIFACTS) {
            const image = document.createElement('img');
            image.alt = '';
            image.src = bitmapUrl(artifactIcon(id as ArtifactId));
            button.classList.add('with-picture');
            button.prepend(image);
          }
        }
        button.disabled = Boolean(choice.disabled);
        button.addEventListener('click', (e) => {
          e.stopPropagation();
          play(choice.action.type === 'choose' && choice.action.choice === 'dig' ? 'dig' : 'click');
          this.onChoice(choice.action);
        });
        (dense && !inFooter(choice.action) ? options : this.footer).append(button);
      }
      if (options.childElementCount) this.body.append(options);
    }
    this.footer.hidden = !this.footer.childElementCount;
    this.wrap.hidden = false;
    this.laidOut = '';
    this.layOut();
    // A new card opens at its top. Only a card on the page can be scrolled: a hidden one would come
    // back scrolled as far as the last one was.
    this.body.scrollTop = scroll;
    if (fresh) {
      const confirmation = card.choices.some((c) => ['retreat', 'dismiss'].includes(c.action.type) || (c.action.type === 'restart' && card.choices.length > 1));
      const focus = confirmation ? this.footer.querySelector<HTMLElement>('[data-dismiss="true"]') : this.body;
      (focus ?? this.body).focus({ preventScroll: true });
    } else if (focused) {
      [...this.card.querySelectorAll<HTMLElement>('[data-action]')].find((el) => el.dataset.action === focused)?.focus({ preventScroll: true });
    }
    this.scrolled();
  }

  /**
   * Played by touch, a card with many buttons puts them two to a row (a wider card) if in one column
   * they'd leave less than a title and the odds of its words in sight, even with the whole window.
   */
  private layOut() {
    const s = uiScale();
    const key = `${window.innerWidth}|${window.innerHeight}|${s}|${this.roomWidth}|${touch()}`;
    if (key === this.laidOut) return;
    this.laidOut = key;
    this.showJournal();
    this.card.classList.remove('two-up');
    const choices = this.footer;
    if (!touch() || !choices || choices.querySelectorAll('button, a.link').length < TWO_UP) return;
    const needs = CHROME + this.heading.offsetHeight + this.tabs.offsetHeight + choices.offsetHeight + Math.min(this.body.scrollHeight, WORDS_ON_TOUCH);
    this.card.classList.toggle('two-up', needs * s > window.innerHeight - 16);
  }

  hide() {
    if (!this.wrap.hidden) folds();
    const focused = this.wrap.contains(document.activeElement);
    this.wrap.hidden = true;
    if (focused && this.opener?.isConnected) this.opener.focus({ preventScroll: true });
  }

  /** A key on a card: Enter or Space presses its only button, a number key that button. True if one was pressed. */
  key(key: string): boolean {
    if (key === 'enter' || key === ' ') return this.pressOnly();
    if (key.length === 1 && key >= '1' && key <= '9') return this.pressNumber(Number(key));
    return false;
  }

  /** A number key presses that button (or opens that link) of the card, counting from 1, if it can be pressed. */
  pressNumber(n: number): boolean {
    if (this.wrap.hidden) return false;
    const button = this.card.querySelector<HTMLButtonElement | HTMLAnchorElement>(`.choices [data-choice="${n}"]`);
    if (!button || (button instanceof HTMLButtonElement && button.disabled)) return false;
    button.click();
    return true;
  }

  /**
   * Enter or Space on a card with one thing to do ("Close", "Ride out") does it; a card with a real
   * choice (a link to follow counts) waits for one. A focused button answers the key itself. True if
   * a button was pressed.
   */
  pressOnly(): boolean {
    if (this.wrap.hidden || (this.card.contains(document.activeElement) && document.activeElement?.matches('button, a'))) return false;
    const buttons = [...this.card.querySelectorAll<HTMLElement>('.choices button:not(:disabled), .choices a.link')];
    if (buttons.length !== 1) return false;
    buttons[0].click();
    return true;
  }

  /** Takes the card off the page for good, when its screen goes away. */
  dispose() {
    this.hide();
    this.wrap.remove();
  }

  /**
   * Puts the card's bottom edge just above `point` (page pixels), kept between `top` and `bottom`.
   * With no room above, it goes below or beside `keepout` (what the card is about), so it never
   * covers it. With no point, the card sits in the middle, or beside `keepout` (the hero) if the
   * middle would cover him. It keeps between `sides` (the map's view, clear of the panel beside it)
   * unless it would only fit there by covering `keepout`. Cards grow with the canvas, as the pixel
   * art does.
   */
  place(point: ScreenPoint | null, top: number, bottom: number, keepout?: Keepout, sides?: { left: number; right: number }) {
    if (this.wrap.hidden) return;
    const s = uiScale();
    if (s !== this.scale) {
      this.scale = s;
      this.wrap.style.transform = s === 1 ? '' : `scale(${s})`;
    }
    // Supplied scene sides constrain wide cards too, without shrinking their native touch controls.
    const room = uiRoom();
    const left = sides ? Math.max(room.left, sides.left) : room.left;
    const right = sides ? Math.min(room.right, sides.right) : room.right;
    const roomWidth = `${Math.floor(Math.max(0, right - left) / s)}px`;
    if (roomWidth !== this.roomWidth) {
      this.roomWidth = roomWidth;
      this.card.style.setProperty('--room', roomWidth);
    }
    this.layOut();
    // A tall card fits the map area, its words scrolling above its buttons. Only if the buttons
    // (and a few lines of words) can't fit there does it take the whole window, over the bar.
    const firstOffer = this.body.querySelector<HTMLElement>('.kc-card-options > :first-child');
    let words = SOME_WORDS;
    if (touch()) words = firstOffer ? firstOffer.offsetTop + firstOffer.offsetHeight + this.more.offsetHeight : this.card.classList.contains('journal') ? 160 : SOME_WORDS;
    const needs = CHROME + this.heading.offsetHeight + this.tabs.offsetHeight + this.footer.offsetHeight + Math.min(this.body.scrollHeight, words);
    if (needs * s > bottom - top - 16) [top, bottom] = [0, window.innerHeight];
    const tallest = `${Math.max(0, Math.floor((bottom - top - 16) / s))}px`;
    if (tallest !== this.tallest) {
      this.tallest = tallest;
      this.card.style.maxHeight = tallest;
    }
    const [w, h] = [this.wrap.offsetWidth * s, this.wrap.offsetHeight * s];
    const [minY, maxY] = [top + 8, Math.max(top + 8, bottom - h - 8)];
    const clampY = (y: number) => Math.min(maxY, Math.max(minY, y));
    const k = keepout;
    const covers = (x: number, y: number) => Boolean(k && x < k.x1 && x + w > k.x0 && y < k.y1 && y + h > k.y0);
    /** Where the card goes if it keeps between `minX` and `maxX`. */
    const spot = (minX: number, maxX: number) => {
      let x = Math.min(maxX - w, Math.max(minX, (point ? point.x : (minX + maxX) / 2) - w / 2));
      let y = top;
      /** Beside `k`, on the side with more room, level with it; false if neither side has room. */
      const beside = () => {
        if (!k) return false;
        const [left, right] = [k.x0 - 14 - w, k.x1 + 14];
        const leftFits = left >= minX;
        const rightFits = right + w <= maxX;
        if (!leftFits && !rightFits) return false;
        x = leftFits && (!rightFits || k.x0 - minX > maxX - k.x1) ? left : right;
        y = clampY((k.y0 + k.y1 - h) / 2);
        return true;
      };
      if (!point) {
        y = clampY((top + bottom - h) / 2);
        if (covers(x, y) && !beside()) {
          if (k!.y0 - h - 10 >= minY) y = k!.y0 - h - 10;
          else if (k!.y1 + 10 <= maxY) y = k!.y1 + 10;
        }
      } else {
        const above = point.y - h - 10;
        if (above >= minY) y = above;
        else if (k && k.y1 + 10 <= maxY) y = k.y1 + 10;
        else if (!beside()) y = clampY(point.y + 30);
      }
      // Never outside the window, even when what it's about is out of sight.
      return { x: Math.max(minX, Math.min(maxX - w, x)), y: clampY(y) };
    };
    const wide = () => spot(room.left + 8, room.right - 8);
    let at = sides && w + 16 <= sides.right - sides.left ? spot(sides.left + 8, sides.right - 8) : wide();
    if (sides && covers(at.x, at.y)) {
      const across = wide();
      if (!covers(across.x, across.y)) at = across;
    }
    this.wrap.style.left = `${Math.round(at.x)}px`;
    this.wrap.style.top = `${Math.round(at.y)}px`;
    this.scrolled();
  }
}
