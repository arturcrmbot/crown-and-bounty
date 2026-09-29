import { ARTIFACTS, slotAcceptsArtifact, slotsForArtifact, SLOTS, type ArtifactId, type Slot } from '../content/artifacts';
import type { MapSpellId } from '../content/spells';
import { outline } from '../render/bitmap';
import { artifactIcon, slotGhost, statIcon } from '../render/artifactIcons';
import { INK } from '../render/palette';
import { portraitOf } from '../render/portraits';
import { ART, heroArtId, type ArtId } from '../render/units';
import { unitBitmap } from '../render/wesnoth';
import { coins, heroSheet, heroStats, leaderSheet, leadershipUsed, SLOT_NAMES, stackSheet, wages, type Action, type GameState, type HeroSheet } from '../rules/game';
import './heroScreen.css';
import { bitmapUrl, PARCHMENT_SHADOW } from './pixels';
import { play } from './sound';

/** Size of the sheet in screen pixels: it covers the map, and scales with the page as the canvas does. */
export const SHEET = { x: 24, y: 30, width: 912, height: 446 };

/** Somewhere on the sheet a thing can sit: a worn slot, a pack square, an army slot, or the hero himself. */
type Place = { kind: 'slot'; slot: Slot } | { kind: 'pack'; index: number } | { kind: 'stack'; index: number } | { kind: 'hero' };

const keyOf = (p: Place) => (p.kind === 'slot' ? `slot:${p.slot}` : p.kind === 'hero' ? 'hero' : `${p.kind}:${p.index}`);
function parse(key: string | undefined): Place | null {
  if (!key) return null;
  const [kind, value] = key.split(':');
  if (kind === 'slot') return { kind, slot: value as Slot };
  if (kind === 'pack' || kind === 'stack') return { kind, index: Number(value) };
  return kind === 'hero' ? { kind } : null;
}

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const format = (text: string) => escape(text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>').replace(/\n/g, '<br>');

/** Pictures for the page, drawn once through the palette. */
const urls = new Map<string, string>();
const cached = (key: string, make: () => string) => {
  let url = urls.get(key);
  if (!url) {
    url = make();
    urls.set(key, url);
  }
  return url;
};
const iconUrl = (id: ArtifactId) => cached(`a:${id}`, () => bitmapUrl(artifactIcon(id)));
const ghostUrl = (slot: Slot) => cached(`g:${slot}`, () => bitmapUrl(slotGhost(slot)));
const statUrl = (id: 'attack' | 'defence' | 'spellPower' | 'knowledge') => cached(`s:${id}`, () => bitmapUrl(statIcon(id)));
const faceUrl = (id: HeroSheet['background']) => cached(`p:${id}`, () => bitmapUrl(portraitOf(id)));
/** A unit as Wesnoth drew it, standing, in our blue: at its own size in the army strip, twice that on its card. */
export const unitUrl = (id: ArtId, scale = 1) => cached(`u:${id}:${scale}`, () => bitmapUrl(outline(unitBitmap(ART[id].stand, 'blue', scale), INK), PARCHMENT_SHADOW));

/** The pack always shows at least two rows of seven, and a free square after the last artifact. */
const PACK_ROW = 7;
const packSquares = (n: number) => Math.max(PACK_ROW * 2, Math.ceil((n + 1) / PACK_ROW) * PACK_ROW);

export type HeroScreenHooks = {
  /** Gear and army changes: the rules apply them and the sheet stays open. */
  act(action: Action): boolean;
  castMapSpell(spell: MapSpellId): void;
  endDay(): void;
  close(): void;
};

/**
 * The hero screen, HoMM2 style, on parchment over the map: who he is and what he knows, a paper doll
 * with his five slots and the pack below, and his army. Artifacts and stacks move by drag and drop,
 * by click (pick up, put down) and by keyboard (arrows, Enter, Shift+arrows, Delete).
 */
export class HeroScreen {
  readonly root = document.createElement('div');
  private readonly body = document.createElement('div');
  private readonly tip = document.createElement('div');
  private readonly ghost = document.createElement('img');
  private state: GameState;
  private readonly hooks: HeroScreenHooks;
  private scale = 1;
  /** Picked up by a click or Enter, waiting to be put down. */
  private held: Place | null = null;
  /** A press on something that may turn into a drag. */
  private press: { place: Place; x: number; y: number; image: string; wide: boolean } | null = null;
  private dragging = false;
  private over: string | null = null;
  private swallowClick = false;
  private lastClick: { key: string; at: number } | null = null;
  private quiet = false;
  /** The card open over the sheet: a stack's, or the hero's own. */
  private card: Place | null = null;
  private confirming = false;
  /** Places that just changed, to glow once. */
  private fresh = new Set<string>();
  private lastStats: number[] | null = null;

  /** `stack` opens that stack's card straight away, as a click on its count in the bar does. */
  constructor(state: GameState, hooks: HeroScreenHooks, stack: number | null = null) {
    this.state = state;
    this.hooks = hooks;
    this.root.className = 'kc-hero';
    this.body.className = 'kc-hero-body';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.tip.className = 'kc-hero-tip';
    this.tip.hidden = true;
    this.ghost.className = 'kc-hero-ghost';
    this.ghost.alt = '';
    this.ghost.hidden = true;
    this.root.append(this.body, this.tip, this.ghost);
    document.body.append(this.root);
    this.listen();
    this.render();
    play('page');
    const shown = stack !== null && state.army[stack] ? stack : null;
    if (shown !== null) this.openCard({ kind: 'stack', index: shown });
    this.focus(this.root.querySelector<HTMLElement>(shown !== null ? `[data-place="stack:${shown}"]` : '[data-act="close"]'));
  }

  /** Shows the state after a change, keeping focus where it was. */
  update(state: GameState) {
    this.state = state;
    if (this.card?.kind === 'stack' && !state.army[this.card.index]) this.card = null;
    this.render();
  }

  get title() {
    return heroSheet(this.state).title;
  }

  /** Over the map, at the canvas's scale. */
  place(toPage: (x: number, y: number) => { x: number; y: number }, scale: number) {
    const { x, y } = toPage(SHEET.x, SHEET.y);
    this.scale = scale;
    this.root.style.left = `${Math.round(x)}px`;
    this.root.style.top = `${Math.round(y)}px`;
    this.root.style.transform = `scale(${scale})`;
  }

  dispose() {
    this.root.remove();
  }

  /** Escape puts back what's held, then closes a card; true if it did either. */
  cancel(): boolean {
    if (this.dragging) this.endDrag();
    if (this.held) {
      this.held = null;
      this.render();
      return true;
    }
    if (this.card) {
      this.closeCard();
      return true;
    }
    return false;
  }

  // --- Drawing ----------------------------------------------------------------------------

  private render() {
    const focused = (document.activeElement as HTMLElement | null)?.closest?.('[data-place],[data-act]') as HTMLElement | null;
    const focusKey = focused && this.root.contains(focused) ? (focused.dataset.place ? `place:${focused.dataset.place}` : `act:${focused.dataset.act}`) : null;
    const sheet = heroSheet(this.state);
    const stats = sheet.stats.map((s) => s.value).concat([sheet.mana.max, sheet.leadership.max, sheet.movement.max]);
    const changed = (i: number) => (this.lastStats && this.lastStats[i] !== stats[i] ? (stats[i] > this.lastStats[i] ? ' up' : ' down') : '');
    this.body.innerHTML = `${this.who(sheet, changed)}${this.gear()}${this.army(sheet)}${this.footer(sheet)}${this.cardHtml()}`;
    this.lastStats = stats;
    this.root.classList.toggle('holding', Boolean(this.held));
    if (!this.held && !this.dragging) this.ghost.hidden = true;
    this.root.setAttribute('aria-label', sheet.title);
    if (focusKey) {
      const [kind, key] = [focusKey.slice(0, focusKey.indexOf(':')), focusKey.slice(focusKey.indexOf(':') + 1)];
      this.focus(this.root.querySelector<HTMLElement>(kind === 'place' ? `[data-place="${key}"]` : `[data-act="${key}"]`));
    }
    this.fresh.clear();
  }

  private who(sheet: HeroSheet, changed: (i: number) => string): string {
    const bar = (kind: string, share: number) => `<span class="bar ${kind}"><i style="width:${Math.round(Math.max(0, Math.min(1, share)) * 100)}%"></i></span>`;
    const stat = (s: HeroSheet['stats'][number], i: number) =>
      `<div class="stat${changed(i)}" data-tip="${escape(s.note)}"><img alt="" draggable="false" src="${statUrl(s.id)}"><b>${s.value}</b><span>${escape(s.name)}</span></div>`;
    const chips = (notes: HeroSheet['skills'], none: string) =>
      notes.length ? notes.map((n) => `<span class="chip${n.trick ? ' trick' : ''}" data-tip="${escape(`**${n.name}**\n${n.note}`)}">${escape(n.name)}</span>`).join('') : `<i class="none">${none}</i>`;
    const { mana, movement, leadership } = sheet;
    return `<section class="who">
      <div class="top">
        <img class="face" alt="" draggable="false" src="${faceUrl(sheet.background)}">
        <div class="name">
          <h2>${escape(sheet.title)}</h2>
          <div class="level" data-tip="${escape(sheet.xp.line)}"><b>${sheet.level}</b>${bar('xp', sheet.xp.share)}<small>${escape(sheet.xp.line)}</small></div>
          <div class="when" data-tip="${escape(sheet.piecesNote)}">${escape(sheet.day)} \u00b7 ${escape(sheet.pieces)}</div>
          ${sheet.company.length ? `<div class="company"><small>Riding with him:</small>${chips(sheet.company, '')}</div>` : ''}
        </div>
      </div>
      <div class="stats">${sheet.stats.map(stat).join('')}</div>
      <div class="gauges">
        <div class="gauge${changed(4)}" data-tip="${escape(mana.line)}"><span class="label"><b>Mana</b><small>${mana.max ? escape(mana.back) : ''}</small><span>${mana.left}/${mana.max}</span></span>${bar('mana', mana.max ? mana.left / mana.max : 0)}</div>
        <div class="gauge${changed(6)}" data-tip="${escape(movement.line)}"><span class="label"><b>Movement</b><small>today</small><span>${movement.left}/${movement.max}</span></span>${bar('move', movement.max ? movement.left / movement.max : 0)}</div>
        <div class="gauge${changed(5)}${leadership.used > leadership.max ? ' too-many' : ''}" data-tip="${escape(leadership.line)}"><span class="label"><b>Leadership</b><small>in use</small><span>${leadership.used}/${leadership.max}</span></span>${bar('lead', leadership.max ? leadership.used / leadership.max : 0)}</div>
      </div>
      <div class="learned">
        <div class="row"><h4>Signature</h4>${chips([sheet.signature], '')}</div>
        <div class="row"><h4>Skills</h4>${chips(sheet.skills, 'none yet: a level brings a choice')}</div>
        <div class="row"><h4>Perks</h4>${chips(sheet.perks, 'none yet')}</div>
        <div class="row"><h4>Spells</h4>${chips(sheet.spells, 'none: a teacher or a shrine could help')}</div>
      </div>
    </section>`;
  }

  private gear(): string {
    const { gear, pack } = this.state.hero;
    const classes = (place: Place, filled: boolean) => {
      const key = keyOf(place);
      const held = this.held && keyOf(this.held) === key ? ' held' : '';
      const drop = this.held && this.actionFor(this.held, place) ? ' can-drop' : '';
      return `${filled ? '' : ' empty'}${held}${drop}${this.fresh.has(key) ? ' fresh' : ''}`;
    };
    const slots = SLOTS.map((slot) => {
      const id = gear[slot];
      const place: Place = { kind: 'slot', slot };
      const spare = pack.find((p) => slotAcceptsArtifact(slot, ARTIFACTS[p].slot));
      const empty = spare
        ? `**${SLOT_NAMES[slot]}**: nothing on.\n*Drag the ${ARTIFACTS[spare].name} here from the pack, or double-click it there.*`
        : `**${SLOT_NAMES[slot]}**: nothing yet.\n*Artifacts turn up in chests and old places, as spoils, and in castle armouries.*`;
      const tip = id ? `**${ARTIFACTS[id].name}** \u00b7 ${SLOT_NAMES[slot]}\n${ARTIFACTS[id].note}\n*Drag it to the pack, or click to pick it up. Double-click takes it off.*` : empty;
      const img = id ? `<img alt="" draggable="false" src="${iconUrl(id)}">` : `<img class="ghostly" alt="" draggable="false" src="${ghostUrl(slot)}">`;
      return `<button class="slot ${slot}${classes(place, Boolean(id))}" data-place="${keyOf(place)}" data-tip="${escape(tip)}" aria-label="${escape(id ? `${SLOT_NAMES[slot]}: ${ARTIFACTS[id].name}` : `${SLOT_NAMES[slot]}: empty`)}">${img}</button>`;
    }).join('');
    const squares = Array.from({ length: packSquares(pack.length) }, (_, index) => {
      const id = pack[index];
      const place: Place = { kind: 'pack', index };
      const tip = id ? `**${ARTIFACTS[id].name}** \u00b7 ${SLOT_NAMES[ARTIFACTS[id].slot]}\n${ARTIFACTS[id].note}\n*Drag it to its slot to wear it, or click to pick it up. Double-click wears it.*` : '';
      return `<button class="square${classes(place, Boolean(id))}" data-place="${keyOf(place)}"${tip ? ` data-tip="${escape(tip)}"` : ''} aria-label="${escape(id ? `Pack: ${ARTIFACTS[id].name}` : 'Pack: empty square')}">${id ? `<img alt="" draggable="false" src="${iconUrl(id)}">` : ''}</button>`;
    }).join('');
    const hint = this.held ? this.holdingHint(this.held) : pack.length ? 'drag to wear, or click, then click where' : 'finds go here when their slot is taken';
    return `<section class="gear">
      <h3>Equipment</h3>
      <div class="doll"><img class="figure" alt="" draggable="false" src="${unitUrl(heroArtId(this.state.hero.background), 2)}">${slots}</div>
      <p class="caption"><b>Pack</b> <small>${escape(hint)}</small></p>
      <div class="pack">${squares}</div>
    </section>`;
  }

  private holdingHint(held: Place): string {
    const { gear, pack } = this.state.hero;
    const id = held.kind === 'slot' ? gear[held.slot] : held.kind === 'pack' ? pack[held.index] : undefined;
    if (!id) return '';
    return held.kind === 'pack' ? `${ARTIFACTS[id].name}: click its slot, or a square \u00b7 Esc` : `${ARTIFACTS[id].name}: click a square to take it off \u00b7 Esc`;
  }

  private army(sheet: HeroSheet): string {
    const { army } = this.state;
    const s = heroStats(this.state);
    const tiles = Array.from({ length: 5 }, (_, index) => {
      const stack = army[index];
      const place: Place = { kind: 'stack', index };
      if (!stack) {
        const tip = '**An empty place in the line.**\n*Recruit at castles and villages, or win a band over: up to five companies.*';
        return `<button class="tile empty" data-place="${keyOf(place)}" data-tip="${escape(tip)}" aria-label="An empty place in the line" tabindex="-1"></button>`;
      }
      const info = stackSheet(this.state, index)!;
      const open = this.card && keyOf(this.card) === keyOf(place) ? ' open' : '';
      const tip = `**${info.title}**\n${info.row}\n*Click for their card. Drag them along the line.*`;
      return `<button class="tile${open}${this.fresh.has(keyOf(place)) ? ' fresh' : ''}" data-place="${keyOf(place)}" data-tip="${escape(tip)}" aria-label="${escape(info.title)}"><img alt="" draggable="false" src="${unitUrl(stack.troop)}"><span class="count">${stack.count}</span></button>`;
    }).join('');
    const pay = Math.round(wages(army) * (1 + s.wages));
    const leaderTip = `**${sheet.title}**\nHe leads from behind the line, where nothing can reach him: every stack adds his attack and defence to its own, and he casts from there.\n*Click for his numbers.*`;
    const open = this.card?.kind === 'hero' ? ' open' : '';
    return `<section class="army">
      <h3>Army <small>drag to reorder: the first stands in the middle of the battle line, the rest above and below</small></h3>
      <div class="strip">
        <button class="tile leader${open}" data-place="hero" data-tip="${escape(leaderTip)}" aria-label="${escape(sheet.title)}"><img alt="" draggable="false" src="${unitUrl(heroArtId(this.state.hero.background))}"><span class="count">Leader</span></button>
        <span class="sep"></span>
        ${tiles}
        <div class="totals">
          <div data-tip="${escape(sheet.leadership.line)}"><b>Leadership</b> ${leadershipUsed(army)} / ${s.leadership}</div>
          <div data-tip="Paid once a week, from day VIII, with the King\u2019s money"><b>Wages</b> ${coins(pay)} gold a week</div>
          <div><b>Stacks</b> ${army.length} of 5</div>
        </div>
      </div>
    </section>`;
  }

  private footer(sheet: HeroSheet): string {
    const spells = sheet.mapSpells.map((m) => `<button class="act" data-act="spell:${m.spell}" data-tip="${escape(m.note)}"${m.disabled ? ' disabled' : ''}>${escape(m.label)}</button>`).join('');
    return `<footer>
      ${spells}
      <button class="act" data-act="endDay" data-tip="Rest: fresh legs, and a quarter of your mana, at dawn">End the day (E)</button>
      <span class="spacer"></span>
      <button class="act" data-act="close">Close (H)</button>
    </footer>`;
  }

  private cardHtml(): string {
    if (!this.card) return '';
    if (this.card.kind === 'hero') {
      // His own card, laid out like his stacks': how he fights, what he brings them, and what happens if he falls.
      const me = leaderSheet(this.state);
      return `<div class="kc-hero-card leader-card" role="dialog" aria-label="${escape(me.title)}">
        <img class="pic" alt="" draggable="false" src="${unitUrl(heroArtId(this.state.hero.background), 2)}">
        <div class="head"><h3>${escape(me.title)}</h3><p><i>${escape(me.note)}</i></p></div>
        <dl>${this.statList(me.stats)}</dl>
        ${this.traitList(me.traits)}
        <p class="cost">${me.lines.map(escape).join('<br>')}</p>
        <div class="acts"><span class="spacer"></span><button class="act" data-act="card-close">Close</button></div>
      </div>`;
    }
    if (this.card.kind !== 'stack') return '';
    const info = stackSheet(this.state, this.card.index);
    if (!info) return '';
    const i = this.card.index;
    const last = this.state.army.length - 1;
    const stats = this.statList(info.stats);

    const acts = this.confirming
      ? `<span class="ask">Send the ${escape(info.title)} home for good?</span><button class="act" data-act="dismiss-yes">Dismiss them</button><button class="act" data-act="dismiss-no">Keep them</button>`
      : `<button class="act" data-act="left"${i === 0 ? ' disabled' : ''}>\u25C0 Move left</button><button class="act" data-act="right"${i >= last ? ' disabled' : ''}>Move right \u25B6</button><button class="act" data-act="dismiss"${info.canDismiss ? '' : ' disabled'} data-tip="${info.canDismiss ? 'They go home, and take no more wages' : 'Your last company stays with you'}">Dismiss\u2026</button><span class="spacer"></span><button class="act" data-act="card-close">Close</button>`;
    return `<div class="kc-hero-card" role="dialog" aria-label="${escape(info.title)}">
      <img class="pic" alt="" draggable="false" src="${unitUrl(info.troop, 2)}">
      <div class="head"><h3>${escape(info.title)}</h3><p><i>${escape(info.note)}</i></p></div>
      <dl>${stats}</dl>
      ${this.traitList(info.traits)}
      <p class="cost">${escape(info.leadership)}<br>${escape(info.wages)}<br>${escape(info.row)}</p>
      <div class="acts">${acts}</div>
    </div>`;
  }

  private statList(stats: { name: string; value: string; note: string }[]): string {
    return stats.map((s) => `<dt>${escape(s.name)}</dt><dd><b>${escape(s.value)}</b> <small>${escape(s.note)}</small></dd>`).join('');
  }

  private traitList(traits: { name: string; note: string; trick?: boolean }[]): string {
    const items = traits.map((t) => `<li${t.trick ? ' class="trick"' : ''}><b>${escape(t.name)}.</b> ${escape(t.note)}</li>`).join('');
    return items ? `<ul class="traits">${items}</ul>` : '';
  }

  // --- What moves where -------------------------------------------------------------------

  /** The rules action for putting what's at `from` down at `to`, or null if it can't go there. */
  private actionFor(from: Place, to: Place): Action | null {
    const { pack, gear } = this.state.hero;
    if (from.kind === 'pack' && pack[from.index]) {
      if (to.kind === 'slot') return slotAcceptsArtifact(to.slot, ARTIFACTS[pack[from.index]].slot) ? { type: 'wear', from: from.index, slot: to.slot } : null;
      if (to.kind === 'pack' && to.index !== from.index && (to.index < pack.length || from.index < pack.length - 1)) return { type: 'movePack', from: from.index, to: to.index };
    }
    if (from.kind === 'slot' && gear[from.slot] && to.kind === 'pack') return { type: 'unequip', slot: from.slot, to: to.index };
    if (from.kind === 'stack' && this.state.army[from.index] && to.kind === 'stack' && to.index !== from.index && (to.index < this.state.army.length || from.index < this.state.army.length - 1)) {
      return { type: 'moveStack', from: from.index, to: Math.min(to.index, this.state.army.length) };
    }
    return null;
  }

  private has(place: Place): boolean {
    if (place.kind === 'slot') return Boolean(this.state.hero.gear[place.slot]);
    if (place.kind === 'pack') return Boolean(this.state.hero.pack[place.index]);
    if (place.kind === 'stack') return Boolean(this.state.army[place.index]);
    return true;
  }

  /** Where an artifact or stack ends up after an action, to glow and keep focus. */
  private landing(action: Action): Place | null {
    switch (action.type) {
      case 'wear':
        return { kind: 'slot', slot: action.slot ?? slotsForArtifact(ARTIFACTS[this.state.hero.pack[action.from]].slot).find((slot) => !this.state.hero.gear[slot]) ?? ARTIFACTS[this.state.hero.pack[action.from]].slot };
      case 'unequip':
        return { kind: 'pack', index: Math.min(action.to ?? this.state.hero.pack.length, this.state.hero.pack.length) };
      case 'movePack':
        return { kind: 'pack', index: Math.min(action.to, this.state.hero.pack.length - 1) };
      case 'moveStack':
        return { kind: 'stack', index: Math.min(action.to, this.state.army.length - 1) };
      default:
        return null;
    }
  }

  /** Asks the rules; the sheet redraws from the new state (once) if they agree, and false if not. */
  private perform(action: Action): boolean {
    const landing = this.landing(action);
    const card = this.card;
    if (landing) this.fresh.add(keyOf(landing));
    if (landing && card?.kind === 'stack' && action.type === 'moveStack' && card.index === action.from) this.card = landing;
    if (this.hooks.act(action)) {
      play(action.type === 'wear' || action.type === 'unequip' ? 'equip' : action.type === 'moveStack' ? 'march' : 'lift');
      return true;
    }
    this.card = card;
    this.fresh.clear();
    return false;
  }

  // --- Input ------------------------------------------------------------------------------

  private placeAt(clientX: number, clientY: number): { el: HTMLElement; place: Place } | null {
    const el = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-place]');
    const place = el && this.root.contains(el) ? parse(el.dataset.place) : null;
    return el && place ? { el, place } : null;
  }

  private toSheet(clientX: number, clientY: number): [number, number] {
    const rect = this.root.getBoundingClientRect();
    return [(clientX - rect.left) / this.scale, (clientY - rect.top) / this.scale];
  }

  private listen() {
    const root = this.root;
    root.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (e.button !== 0) return;
      const hit = this.placeAt(e.clientX, e.clientY);
      if (!hit || hit.place.kind === 'hero' || !this.has(hit.place)) return;
      const img = hit.el.querySelector('img');
      this.press = { place: hit.place, x: e.clientX, y: e.clientY, image: img?.src ?? '', wide: hit.place.kind === 'stack' };
    });
    root.addEventListener('pointermove', (e) => {
      if (!this.press) {
        this.followHeld(e);
        return this.hoverTip(e);
      }
      if (!this.dragging && Math.hypot(e.clientX - this.press.x, e.clientY - this.press.y) < 5) return;
      if (!this.dragging) {
        root.setPointerCapture(e.pointerId);
        this.startDrag();
      }
      const [x, y] = this.toSheet(e.clientX, e.clientY);
      const size = this.press.wide ? 72 : 32;
      Object.assign(this.ghost.style, { left: `${Math.round(x - size / 2)}px`, top: `${Math.round(y - size / 2)}px`, width: `${size}px`, height: `${size}px` });
      const hit = this.placeAt(e.clientX, e.clientY);
      const key = hit && this.actionFor(this.press.place, hit.place) ? keyOf(hit.place) : null;
      if (key !== this.over) {
        root.querySelector('.over')?.classList.remove('over');
        if (key) root.querySelector(`[data-place="${key}"]`)?.classList.add('over');
        this.over = key;
      }
    });
    const release = (e: PointerEvent) => {
      if (root.hasPointerCapture(e.pointerId)) root.releasePointerCapture(e.pointerId);
      if (!this.press) return;
      const from = this.press.place;
      const was = this.dragging;
      this.press = null;
      if (!was) return;
      this.swallowClick = true;
      setTimeout(() => (this.swallowClick = false), 0);
      const hit = e.type === 'pointerup' ? this.placeAt(e.clientX, e.clientY) : null;
      const action = hit ? this.actionFor(from, hit.place) : null;
      this.endDrag();
      if (!action || !this.perform(action)) this.render();
    };
    root.addEventListener('pointerup', release);
    root.addEventListener('pointercancel', release);
    root.addEventListener('pointerleave', () => !this.press && this.hideTip());
    root.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.swallowClick) return;
      const target = e.target as HTMLElement;
      const act = target.closest<HTMLElement>('[data-act]');
      if (act && this.root.contains(act)) return this.clickAct(act.dataset.act!, act as HTMLButtonElement);
      const hit = target.closest<HTMLElement>('[data-place]');
      const place = hit ? parse(hit.dataset.place) : null;
      // A tap on a chip, a stat or a gauge shows its note, for touch screens and for anyone who clicks.
      const noted = !place && target.closest<HTMLElement>('[data-tip]');
      if (noted && this.root.contains(noted)) return this.showTip(noted);
      if (place) this.clickPlace(place);
      else if (this.card && !target.closest('.kc-hero-card')) this.closeCard();
      else if (this.held) this.cancel();
    });
    root.addEventListener('keydown', (e) => this.key(e));
    // A right-click is the game's, not the browser's menu.
    root.addEventListener('contextmenu', (e) => e.preventDefault());
    root.addEventListener('focusin', (e) => {
      if (this.quiet) return this.hideTip();
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
      if (el && el.matches(':focus-visible')) this.showTip(el);
      else this.hideTip();
    });
    root.addEventListener('focusout', () => this.hideTip());
  }

  /** What's held by a click rides along under the pointer, as in HoMM2 and Diablo. */
  private followHeld(e: PointerEvent) {
    const img = this.held && this.root.querySelector<HTMLImageElement>(`[data-place="${keyOf(this.held)}"] img`);
    if (!img) {
      this.ghost.hidden = true;
      return;
    }
    const [x, y] = this.toSheet(e.clientX, e.clientY);
    if (this.ghost.src !== img.src) this.ghost.src = img.src;
    Object.assign(this.ghost.style, { left: `${Math.round(x + 4)}px`, top: `${Math.round(y + 4)}px`, width: '32px', height: '32px' });
    this.ghost.hidden = false;
  }

  private startDrag() {
    const press = this.press!;
    this.dragging = true;
    this.held = null;
    if (press.place.kind === 'stack') this.card = null;
    this.hideTip();
    this.render();
    this.root.classList.add('dragging');
    this.root.querySelector(`[data-place="${keyOf(press.place)}"]`)?.classList.add('lifted');
    for (const el of this.root.querySelectorAll<HTMLElement>('[data-place]')) {
      const place = parse(el.dataset.place);
      if (place && this.actionFor(press.place, place)) el.classList.add('can-drop');
    }
    this.ghost.src = press.image;
    this.ghost.hidden = false;
  }

  private endDrag() {
    this.dragging = false;
    this.press = null;
    this.over = null;
    this.ghost.hidden = true;
    this.root.classList.remove('dragging');
    for (const el of this.root.querySelectorAll('.can-drop, .lifted, .over')) el.classList.remove('can-drop', 'lifted', 'over');
  }

  private clickPlace(place: Place) {
    this.hideTip();
    // A second click on the same artifact soon after the first wears it, or takes it off. (The sheet
    // redraws between the two, so the browser's own double-click can't be trusted to notice.)
    const now = performance.now();
    const double = this.lastClick?.key === keyOf(place) && now - this.lastClick.at < 400;
    this.lastClick = double ? null : { key: keyOf(place), at: now };
    if (double && (place.kind === 'pack' || place.kind === 'slot') && this.has(place)) {
      this.held = null;
      const action: Action = place.kind === 'pack' ? { type: 'wear', from: place.index } : { type: 'unequip', slot: place.slot };
      if (!this.perform(action)) this.render();
      return;
    }
    if (place.kind === 'hero') return this.card?.kind === 'hero' ? this.closeCard() : this.openCard(place);
    if (place.kind === 'stack') {
      if (!this.has(place)) return;
      return this.card && keyOf(this.card) === keyOf(place) ? this.closeCard() : this.openCard(place);
    }
    // Artifacts: pick up, then put down.
    if (this.held) {
      const held = this.held;
      const action = this.actionFor(held, place);
      this.held = null;
      if (action && this.perform(action)) return;
      if (!action && keyOf(held) !== keyOf(place) && this.has(place)) this.held = place;
      return this.render();
    }
    if (this.has(place)) {
      this.held = place;
      play('lift');
      this.render();
    }
  }

  private clickAct(act: string, button: HTMLButtonElement) {
    if (button.disabled) return;
    const index = this.card?.kind === 'stack' ? this.card.index : -1;
    if (act === 'close') return this.hooks.close();
    if (act === 'endDay') return this.hooks.endDay();
    if (act.startsWith('spell:')) return this.hooks.castMapSpell(act.slice(6) as MapSpellId);
    if (act === 'card-close' || act === 'dismiss-no') {
      if (act === 'dismiss-no') {
        this.confirming = false;
        return this.render();
      }
      return this.closeCard();
    }
    if (act === 'left' || act === 'right') {
      if (!this.perform({ type: 'moveStack', from: index, to: act === 'left' ? index - 1 : index + 1 })) this.render();
      this.focus(this.root.querySelector<HTMLElement>(`[data-act="${act}"]:not(:disabled)`));
      return;
    }
    if (act === 'dismiss') {
      this.confirming = true;
      this.render();
      this.focus(this.root.querySelector<HTMLElement>('[data-act="dismiss-no"]'));
      return;
    }
    if (act === 'dismiss-yes') {
      this.confirming = false;
      const card = this.card;
      this.card = null;
      if (this.hooks.act({ type: 'dismiss', index })) play('march');
      else {
        this.card = card;
        this.render();
      }
      this.focus(this.root.querySelector<HTMLElement>(`[data-place="stack:${Math.max(0, Math.min(index, this.state.army.length - 1))}"]`));
    }
  }

  private openCard(place: Place) {
    this.card = place;
    this.confirming = false;
    play('click');
    this.render();
  }

  private closeCard() {
    const was = this.card;
    this.card = null;
    this.confirming = false;
    this.render();
    if (was) this.focus(this.root.querySelector<HTMLElement>(`[data-place="${keyOf(was)}"]`));
  }

  /** Arrows move between squares; Shift+arrows move what's there; Delete dismisses a stack. */
  private key(e: KeyboardEvent) {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-place]');
    const place = el ? parse(el.dataset.place) : null;
    if (e.key === 'Escape') {
      if (this.cancel()) {
        e.stopPropagation();
        e.preventDefault();
      }
      return;
    }
    const arrow = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, [number, number]>)[e.key];
    if (arrow) {
      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey && place && this.has(place) && (place.kind === 'stack' || place.kind === 'pack')) {
        const step = place.kind === 'pack' ? arrow[0] + arrow[1] * PACK_ROW : arrow[0];
        const to = place.index + step;
        if (step && to >= 0) {
          const action = place.kind === 'stack' ? ({ type: 'moveStack', from: place.index, to } as const) : ({ type: 'movePack', from: place.index, to } as const);
          if (this.actionFor(place, { kind: place.kind, index: to } as Place)) {
            if (!this.perform(action)) this.render();
            this.focus(this.root.querySelector<HTMLElement>(`[data-place="${place.kind}:${Math.min(to, (place.kind === 'stack' ? this.state.army.length : this.state.hero.pack.length) - 1)}"]`));
          }
        }
        return;
      }
      this.moveFocus(el ?? (e.target as HTMLElement), arrow);
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && place?.kind === 'stack' && this.has(place)) {
      e.preventDefault();
      e.stopPropagation();
      this.card = place;
      this.confirming = stackSheet(this.state, place.index)?.canDismiss ?? false;
      this.render();
      this.focus(this.root.querySelector<HTMLElement>(this.confirming ? '[data-act="dismiss-no"]' : '[data-act="card-close"]'));
      return;
    }
    // Letters are the screen's hotkeys (H closes, E ends the day): they go on up to the game.
    if (e.key === ' ' || e.key === 'Enter') e.stopPropagation();
  }

  /** Moves focus to the nearest square in the arrow's direction, as the eye would. */
  private moveFocus(from: HTMLElement, [dx, dy]: [number, number]) {
    const a = from.getBoundingClientRect();
    const [ax, ay] = [a.left + a.width / 2, a.top + a.height / 2];
    let best: HTMLElement | null = null;
    let score = Infinity;
    for (const el of this.root.querySelectorAll<HTMLElement>('[data-place]:not([tabindex="-1"]), [data-act]:not(:disabled)')) {
      if (el === from || el.closest('.kc-hero-card') !== from.closest('.kc-hero-card')) continue;
      const b = el.getBoundingClientRect();
      const [ex, ey] = [b.left + b.width / 2 - ax, b.top + b.height / 2 - ay];
      const along = ex * dx + ey * dy;
      if (along <= 2) continue;
      const across = Math.abs(ex * dy - ey * dx);
      const s = along + across * 2.5;
      if (s < score) [best, score] = [el, s];
    }
    this.focus(best, false);
  }

  private hoverTip(e: PointerEvent) {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
    if (el && this.root.contains(el) && el.dataset.tip) this.showTip(el);
    else this.hideTip();
  }

  /** The note for whatever is under the pointer (or focused), just above it, kept on the sheet. */
  private showTip(el: HTMLElement) {
    const text = el.dataset.tip;
    if (!text || this.dragging) return this.hideTip();
    if (this.tip.dataset.for !== text) {
      this.tip.innerHTML = format(text);
      this.tip.dataset.for = text;
    }
    this.tip.hidden = false;
    const r = el.getBoundingClientRect();
    const [x0, y0] = this.toSheet(r.left, r.top);
    const [x1, y1] = this.toSheet(r.right, r.bottom);
    const { offsetWidth: w, offsetHeight: h } = this.tip;
    const x = Math.max(4, Math.min(SHEET.width - w - 4, (x0 + x1) / 2 - w / 2));
    const y = y0 - h - 6 >= 2 ? y0 - h - 6 : y1 + 6;
    this.tip.style.left = `${Math.round(x)}px`;
    this.tip.style.top = `${Math.round(Math.min(SHEET.height - h - 2, y))}px`;
  }

  private hideTip() {
    this.tip.hidden = true;
  }

  /** Moves focus without scrolling the page. Focus the sheet moves itself brings up no note. */
  private focus(el: HTMLElement | null, quiet = true) {
    if (!el) return;
    this.quiet = quiet;
    el.focus({ preventScroll: true });
    this.quiet = false;
  }

  /** For scripts: what the sheet shows, in words. */
  describe() {
    return {
      title: this.title,
      slots: Object.fromEntries(SLOTS.map((s) => [s, this.state.hero.gear[s] ?? null])),
      pack: [...this.state.hero.pack],
      army: this.state.army.map((s) => `${s.count} ${s.troop}`),
      held: this.held ? keyOf(this.held) : null,
      card: this.card ? keyOf(this.card) : null,
      text: this.root.innerText,
    };
  }
}
