import type { PortraitId } from '../content/portraits';
import { troops, type TroopId } from '../content/troops';
import { outline } from '../render/bitmap';
import { INK } from '../render/palette';
import { portraitOf } from '../render/portraits';
import { ART } from '../render/units';
import { unitBitmap } from '../render/wesnoth';
import { manaLine, type Action, type Army, type Card, type Heard } from '../rules/game';
import './card.css';
import { bitmapUrl, PARCHMENT_SHADOW } from './pixels';
import { uiRoom, uiScale } from './scale';
import { play } from './sound';
import { touch } from './touch';

type ScreenPoint = { x: number; y: number };
/** A card's padding and border, top and bottom (CSS pixels): `max-height` doesn't count them. */
const CHROME = 30;
/** The space above a card's buttons (`.choices` margin). */
const CHOICES_GAP = 9;
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
/** A box on the page (page pixels) that a card with nowhere in particular to be should keep clear of. */
export type Keepout = { x0: number; y0: number; x1: number; y1: number };

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const format = (text: string) => escape(text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>');

/** A button's or a link's words: its label (with an arrow, for a link that opens a new tab), and the smaller line under it. */
function wordsOf(label: string, detail?: string, out = false): HTMLSpanElement {
  const words = document.createElement('span');
  words.className = 'words';
  words.textContent = label;
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
    url = bitmapUrl(outline(unitBitmap(ART[id].stand, team, 0.5), INK), PARCHMENT_SHADOW);
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

/** The journal's right-hand page: each thing heard in its own words, who said it, and a tick once it has paid off. */
function heardMarkup(heard: Heard[]): string {
  const items = heard.map((h) => `<li${h.done ? ' class="done"' : ''}><span class="words">\u201c${format(h.words)}\u201d</span><small>${escape(h.who)}</small></li>`).join('');
  const list = heard.length ? `<ul>${items}</ul>` : '<p class="none">You have heard nothing yet. What you hear on the road goes down here.</p>';
  return `<section class="heard"><h4>Things heard</h4>${list}</section>`;
}

/**
 * The parchment's sounds: it crackles open as a card unfolds, and folds away as it goes. A card put
 * away only to be replaced by the next at once just unfolds: the fold waits a moment to see.
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
  private readonly wrap = document.createElement('div');
  private readonly card = document.createElement('div');
  /** The card's words (face, title, lines): they scroll when the card is too tall, and the buttons stay put. */
  private readonly body = document.createElement('div');
  /** "more ▾" at the foot of the words while some are out of sight below them; a click turns the page. */
  private readonly more = document.createElement('div');
  private onChoice: (action: Action) => void;
  private title: string | null = null;
  private scale = 1;
  private tallest = '';
  private roomWidth = '';
  private bar = '';
  /** The window's height and the scale the buttons were last laid out for, one column or two. */
  private laidOut = '';

  constructor(onChoice: (action: Action) => void) {
    this.onChoice = onChoice;
    this.wrap.className = 'kc-card-wrap';
    this.card.className = 'kc-card';
    this.body.className = 'kc-card-body';
    this.more.className = 'kc-card-more';
    this.more.innerHTML = '<span>more \u25be</span>';
    this.more.setAttribute('aria-hidden', 'true');
    this.card.append(this.body, this.more);
    this.wrap.append(this.card);
    this.wrap.hidden = true;
    document.body.append(this.wrap);
    this.card.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.body.addEventListener('scroll', () => this.scrolled(), { passive: true });
    this.more.addEventListener('click', (e) => {
      e.stopPropagation();
      this.body.scrollBy({ top: Math.max(40, this.body.clientHeight - 60), behavior: 'smooth' });
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
    const face = card.portrait ? `<img class="portrait" alt="" src="${portraitImage(card.portrait)}">` : '';
    const title = card.title ? `<h3>${escape(card.title)}</h3>` : '';
    // The odds of a fight come first, under the title, in their colour.
    const verdict = card.verdict ? `<p class="kc-odds ${card.verdict.odds}">${escape(card.verdict.words)}</p>` : '';
    const battle = card.battleResult ? battleResultMarkup(card.battleResult) : '';
    const lines = card.lines.map((l) => `<p>${format(l)}</p>`);
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
      this.body.innerHTML = `<div class="page">${title}${pinned}${words}</div>${heardMarkup(card.journal.heard)}`;
    } else this.body.innerHTML = card.poster ? `${title}<div class="mugshot">${face}${stamp}</div>${words}${inset}` : `${face}${title}${verdict}${words}${inset}`;
    if (fresh && card.stamp && !card.journal) setTimeout(() => play('stamp'), STAMP_LANDS);
    this.card.querySelector('.choices')?.remove();
    if (card.choices.length || card.links?.length) {
      const choices = document.createElement('div');
      choices.className = card.tiles ? 'choices tiles' : 'choices';
      // Links off the game come first, and open in a new tab, so the game stays where it was.
      for (const link of card.links ?? []) {
        const a = document.createElement('a');
        a.className = 'link';
        a.href = link.href;
        a.target = '_blank';
        a.rel = 'noopener';
        a.append(wordsOf(link.label, link.detail, true));
        a.addEventListener('click', () => play('click'));
        choices.append(a);
      }
      for (const choice of card.choices) {
        const button = document.createElement('button');
        // The label and the line under it go together, beside a face if there is one.
        button.append(wordsOf(choice.label, choice.detail));
        if (choice.portrait) {
          button.classList.add('with-portrait');
          const face = document.createElement('img');
          face.alt = '';
          face.src = portraitImage(choice.portrait);
          button.prepend(face);
        }
        button.disabled = Boolean(choice.disabled);
        button.addEventListener('click', (e) => {
          e.stopPropagation();
          play(choice.action.type === 'choose' && choice.action.choice === 'dig' ? 'dig' : 'click');
          this.onChoice(choice.action);
        });
        choices.append(button);
      }
      this.card.append(choices);
    }
    this.wrap.hidden = false;
    this.laidOut = '';
    this.layOut();
    // A new card opens at its top. Only a card on the page can be scrolled: a hidden one would come
    // back scrolled as far as the last one was.
    if (fresh) this.body.scrollTop = this.card.scrollTop = 0;
    this.scrolled();
  }

  /**
   * Played by touch, a card with many buttons puts them two to a row (a wider card) if in one column
   * they'd leave less than a title and the odds of its words in sight, even with the whole window.
   */
  private layOut() {
    const s = uiScale();
    const key = `${window.innerHeight}|${s}`;
    if (key === this.laidOut) return;
    this.laidOut = key;
    this.card.classList.remove('two-up');
    const choices = this.card.querySelector<HTMLElement>('.choices:not(.tiles)');
    if (!touch() || !choices || choices.querySelectorAll('button, a.link').length < TWO_UP) return;
    const needs = CHROME + choices.offsetHeight + CHOICES_GAP + Math.min(this.body.scrollHeight, WORDS_ON_TOUCH);
    this.card.classList.toggle('two-up', needs * s > window.innerHeight - 16);
  }

  hide() {
    if (!this.wrap.hidden) folds();
    this.wrap.hidden = true;
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
    const button = this.card.querySelectorAll<HTMLButtonElement | HTMLAnchorElement>('.choices button, .choices a.link')[n - 1];
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
    if (this.wrap.hidden || this.card.contains(document.activeElement)) return false;
    const buttons = [...this.card.querySelectorAll<HTMLElement>('.choices button:not(:disabled), .choices a.link')];
    if (buttons.length !== 1) return false;
    buttons[0].click();
    return true;
  }

  /** Takes the card off the page for good, when its screen goes away. */
  dispose() {
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
    // Played by touch, a card keeps between the rails, and no wider than the room there (touch.css).
    const room = uiRoom();
    const roomWidth = `${Math.floor((room.right - room.left) / s)}px`;
    if (roomWidth !== this.roomWidth) {
      this.roomWidth = roomWidth;
      this.card.style.setProperty('--room', roomWidth);
    }
    this.layOut();
    // A tall card fits the map area, its words scrolling above its buttons. Only if the buttons
    // (and a few lines of words) can't fit there does it take the whole window, over the bar.
    const choices = this.card.querySelector<HTMLElement>('.choices');
    const needs = CHROME + (choices ? choices.offsetHeight + CHOICES_GAP : 0) + Math.min(this.body.scrollHeight, SOME_WORDS);
    if (needs * s > bottom - top - 16) [top, bottom] = [0, window.innerHeight];
    const tallest = `${Math.max(0, Math.floor((bottom - top - 16) / s) - CHROME)}px`;
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
