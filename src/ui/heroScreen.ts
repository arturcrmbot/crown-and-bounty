import { ARTIFACTS, slotAcceptsArtifact, slotsForArtifact, SLOTS, type ArtifactId, type Slot } from '../content/artifacts';
import type { MapSpellId } from '../content/spells';
import { outline } from '../render/bitmap';
import { artifactIcon, slotGhost, statIcon } from '../render/artifactIcons';
import { INK } from '../render/palette';
import { heroArtId, type ArtId } from '../render/units';
import { standingFigure } from '../render/battleSprites';
import { coins, heroSheet, heroStats, leaderSheet, leadershipUsed, SLOT_NAMES, stackSheet, wages, type Action, type GameState, type HeroSheet, type Note } from '../rules/game';
import { gearAt, previewGear, type GearPlace } from './heroGear';
import './heroScreen.css';
import { bitmapUrl, PARCHMENT_SHADOW } from './pixels';
import { play } from './sound';
import { touch } from './touch';

export const SHEET = { x: 24, y: 30, width: 912, height: 446 };
type Page = 'hero' | 'equipment' | 'army';
type Place = GearPlace | { kind: 'stack'; index: number } | { kind: 'hero' };
const PAGES: Page[] = ['hero', 'equipment', 'army'];
const PAGE_NAMES: Record<Page, string> = { hero: 'Hero', equipment: 'Equipment', army: 'Army' };
const PACK_ROW = 7;
const packSquares = (n: number) => Math.max(PACK_ROW * 2, Math.ceil((n + 1) / PACK_ROW) * PACK_ROW);
const keyOf = (p: Place) => p.kind === 'slot' ? `slot:${p.slot}` : p.kind === 'hero' ? 'hero' : `${p.kind}:${p.index}`;
function parse(key: string | undefined): Place | null {
  if (!key) return null;
  const [kind, value] = key.split(':');
  if (kind === 'slot') {
    const slot = SLOTS.find(s => s === value);
    return slot ? { kind, slot } : null;
  }
  if ((kind === 'pack' || kind === 'stack') && Number.isInteger(Number(value)) && Number(value) >= 0) return { kind, index: Number(value) };
  return kind === 'hero' ? { kind } : null;
}
const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const format = (text: string) => escape(text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>').replace(/\n/g, '<br>');
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
export const unitUrl = (id: ArtId, scale = 1) => cached(`u:${id}:${scale}`, () => bitmapUrl(outline(standingFigure(id, 'blue', scale), INK), PARCHMENT_SHADOW));

export type HeroScreenHooks = {
  act(action: Action): boolean;
  castMapSpell(spell: MapSpellId): void;
  endDay(): void;
  close(): void;
};

/** An officer's folio. Inspection is local; only an explicit command reaches the rules and save. */
export class HeroScreen {
  readonly root = document.createElement('div');
  private readonly frame: HTMLElement | null = touch() ? document.createElement('div') : null;
  private readonly body = document.createElement('div');
  private readonly tip = document.createElement('div');
  private readonly ghost = document.createElement('img');
  private state: GameState;
  private readonly hooks: HeroScreenHooks;
  private page: Page = 'hero';
  private selected: GearPlace | null = null;
  private target: Slot | undefined;
  private scale = 1;
  private held: Place | null = null;
  private press: { place: Place; x: number; y: number; image: string; wide: boolean } | null = null;
  private dragging = false;
  private over: string | null = null;
  private swallowClick = false;
  private lastClick: { key: string; at: number } | null = null;
  private quiet = false;
  private card: { kind: 'stack'; index: number } | { kind: 'hero' } | null = null;
  private confirming = false;
  private fresh = new Set<string>();
  private lastStats: number[] | null = null;
  private scroll = new Map<string, number>();
  private notice = '';
  private error = false;

  constructor(state: GameState, hooks: HeroScreenHooks, stack: number | null = null) {
    this.state = state;
    this.hooks = hooks;
    this.root.className = 'kc-hero';
    this.body.className = 'kc-hero-body';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-labelledby', 'kc-hero-title');
    this.tip.className = 'kc-hero-tip';
    this.tip.hidden = true;
    this.ghost.className = 'kc-hero-ghost';
    this.ghost.alt = '';
    this.ghost.hidden = true;
    this.root.append(this.body, this.tip, this.ghost);
    if (this.frame) {
      this.frame.className = 'kc-hero-frame';
      this.frame.append(this.root);
      this.frame.addEventListener('pointerdown', e => e.stopPropagation());
      document.body.append(this.frame);
    } else document.body.append(this.root);
    if (stack !== null && state.army[stack]) {
      this.page = 'army';
      this.card = { kind: 'stack', index: stack };
    }
    this.listen();
    this.render();
    play('page');
    this.focus(this.root.querySelector<HTMLElement>(`[data-tab="${this.page}"]`));
  }

  update(state: GameState) {
    this.state = state;
    if (this.card?.kind === 'stack' && !state.army[this.card.index]) this.card = state.army.length ? { kind: 'stack', index: state.army.length - 1 } : { kind: 'hero' };
    if (this.selected && !gearAt(state, this.selected)) this.selected = null;
    this.render();
  }

  get title() { return heroSheet(this.state).title; }

  place(x: number, y: number, scale: number) {
    if (this.frame) {
      this.scale = 1;
      return;
    }
    this.scale = scale;
    this.root.style.left = `${Math.round(x)}px`;
    this.root.style.top = `${Math.round(y)}px`;
    this.root.style.transform = `scale(${scale})`;
  }

  dispose() { (this.frame ?? this.root).remove(); }

  cancel(): boolean {
    if (this.dragging) this.endDrag();
    if (this.held) {
      this.held = null;
      this.notice = 'You put it back.';
      this.render();
      return true;
    }
    if (this.confirming) {
      this.confirming = false;
      this.render();
      this.focus(this.root.querySelector<HTMLElement>('[data-act="dismiss"]'));
      return true;
    }
    if (this.card) {
      this.closeCard();
      return true;
    }
    return false;
  }

  private render() {
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement.closest<HTMLElement>('[data-place],[data-act],[data-tab]') : null;
    const focusKey = focused && this.root.contains(focused) ? { place: focused.dataset.place, act: focused.dataset.act, tab: focused.dataset.tab } : null;
    for (const el of this.root.querySelectorAll<HTMLElement>('[data-scroll]')) if (el.getClientRects().length) this.scroll.set(el.dataset.scroll!, el.scrollTop);
    const sheet = heroSheet(this.state);
    const stats = sheet.stats.map(s => s.value).concat([sheet.mana.max, sheet.leadership.max, sheet.movement.max]);
    const changed = (i: number) => this.lastStats && this.lastStats[i] !== stats[i] ? stats[i] > this.lastStats[i] ? ' up' : ' down' : '';
    const panel = (page: Page, html: string) => `<div class="hero-page ${page}-panel" id="kc-page-${page}" role="tabpanel" aria-labelledby="kc-tab-${page}"${this.page === page ? '' : ' hidden'}>${html}</div>`;
    this.body.innerHTML = `${this.header(sheet)}
      <nav class="hero-tabs" role="tablist" aria-label="Character pages">${PAGES.map(page => `<button class="act tab" id="kc-tab-${page}" role="tab" aria-controls="kc-page-${page}" aria-selected="${this.page === page}" tabindex="${this.page === page ? 0 : -1}" data-tab="${page}">${PAGE_NAMES[page]}</button>`).join('')}</nav>
      ${this.resources(sheet)}
      ${panel('hero', this.who(sheet, changed))}
      ${panel('equipment', `${this.gear()}${this.gearCard()}`)}
      ${panel('army', `${this.army(sheet)}${this.cardHtml()}`)}
      ${this.footer(sheet)}`;
    this.lastStats = stats;
    this.root.dataset.page = this.page;
    this.root.classList.toggle('holding', Boolean(this.held));
    if (!this.held && !this.dragging) this.ghost.hidden = true;
    for (const el of this.root.querySelectorAll<HTMLElement>('[data-scroll]')) el.scrollTop = this.scroll.get(el.dataset.scroll!) ?? 0;
    if (focusKey) {
      const selector = focusKey.tab ? `[data-tab="${focusKey.tab}"]` : focusKey.place ? `[data-place="${focusKey.place}"]` : `[data-act="${focusKey.act}"]`;
      const el = [...this.root.querySelectorAll<HTMLElement>(selector)].find(el => el.getClientRects().length);
      if (el) this.focus(el);
    }
    this.fresh.clear();
  }

  private header(sheet: HeroSheet) {
    return `<header class="hero-header">
      <img class="header-figure" alt="" draggable="false" src="${unitUrl(heroArtId(sheet.background))}">
      <div class="identity"><h2 id="kc-hero-title">${escape(sheet.title)}</h2><p>${escape(sheet.level)} <span>${escape(sheet.day)}</span></p></div>
      <button class="act close" data-act="close" aria-label="Close the character screen">Close${touch() ? '' : ' (H)'}</button>
    </header>`;
  }

  private resources(sheet: HeroSheet) {
    const s = heroStats(this.state);
    const pay = Math.round(wages(this.state.army) * (1 + s.wages));
    return `<div class="hero-resources">
      <span class="resource" aria-label="${escape(sheet.mana.line)}"><span>Mana</span><b class="mana">${sheet.mana.left}/${sheet.mana.max}</b></span>
      <span class="resource" aria-label="${escape(sheet.movement.line)}"><span>Movement</span><b>${sheet.movement.left}/${sheet.movement.max}</b></span>
      <span class="resource${sheet.leadership.used > sheet.leadership.max ? ' too-many' : ''}" aria-label="${escape(sheet.leadership.line)}"><span>Leadership</span><b>${sheet.leadership.used}/${sheet.leadership.max}</b></span>
      <span class="resource"><span>Gold</span><b>${coins(this.state.gold)}</b></span>
      <span class="resource"><span>Wages</span><b>${coins(pay)}<small> a week</small></b></span>
    </div>`;
  }

  private who(sheet: HeroSheet, changed: (i: number) => string) {
    const notes = (title: string, rows: Note[], empty: string) => `<section class="learned"><h3>${title}</h3>${rows.length ? rows.map(n => `<div class="learned-row${n.trick ? ' trick' : ''}"><h4>${escape(n.name)}</h4><p>${format(n.note)}</p></div>`).join('') : `<p>${empty}</p>`}</section>`;
    return `<div class="hero-person">
      <div class="portrait-field"><img class="hero-figure" alt="${escape(sheet.title)}" draggable="false" src="${unitUrl(heroArtId(sheet.background), 2)}"></div>
      <div class="stats">${sheet.stats.map((s, i) => `<button class="stat${changed(i)}" data-act="note" data-tip="${escape(s.note)}"><img alt="" draggable="false" src="${statUrl(s.id)}"><b>${s.value}</b><span>${escape(s.name)}</span></button>`).join('')}</div>
      <button class="act" data-act="leader">How he fights</button>
    </div>
    <div class="hero-reading page-scroll" data-scroll="hero">
      <section class="progress"><h3>${escape(sheet.level)}</h3><div class="bar"><i style="width:${Math.round(sheet.xp.share * 100)}%"></i></div><p>${escape(sheet.xp.line)}</p><p class="map-pieces">${escape(sheet.pieces)}</p></section>
      ${notes(sheet.signature.name, [{ name: '', note: sheet.signature.note }], '')}
      ${notes('Skills', sheet.skills, 'A level brings a choice of a new skill.')}
      ${notes('Perks', sheet.perks, 'You have no perks yet.')}
      ${notes('Spells', sheet.spells, 'A teacher or a shrine can teach you a spell.')}
      ${notes('Riding with you', sheet.company, 'Nobody rides with you yet. The King can offer a friend at court.')}
      <section class="learned"><h3>On the road</h3><p>${escape(sheet.mana.line)}</p><p>${escape(sheet.movement.line)}</p><p>${escape(sheet.leadership.line)}</p><p>${escape(sheet.piecesNote)}</p></section>
    </div>`;
  }

  private placeClasses(place: Place, filled: boolean) {
    const key = keyOf(place);
    const selected = place.kind === 'slot' || place.kind === 'pack' ? this.selected && keyOf(this.selected) === key : this.card && keyOf(this.card) === key;
    return `${filled ? '' : ' empty'}${selected ? ' selected' : ''}${this.held && keyOf(this.held) === key ? ' held' : ''}${this.held && this.actionFor(this.held, place) ? ' can-drop' : ''}${this.fresh.has(key) ? ' fresh' : ''}`;
  }

  private gear() {
    const { gear, pack } = this.state.hero;
    const slots = SLOTS.map(slot => {
      const id = gear[slot];
      const place: GearPlace = { kind: 'slot', slot };
      return `<div class="worn"><span>${SLOT_NAMES[slot]}</span><button class="slot${this.placeClasses(place, Boolean(id))}" data-place="${keyOf(place)}" aria-label="${escape(`${SLOT_NAMES[slot]}: ${id ? ARTIFACTS[id].name : 'empty'}`)}" aria-pressed="${Boolean(this.selected && keyOf(this.selected) === keyOf(place))}"><img alt="" draggable="false" src="${id ? iconUrl(id) : ghostUrl(slot)}"${id ? '' : ' class="ghostly"'}></button></div>`;
    }).join('');
    const squares = Array.from({ length: packSquares(pack.length) }, (_, index) => {
      const id = pack[index];
      const place: GearPlace = { kind: 'pack', index };
      return `<button class="square${this.placeClasses(place, Boolean(id))}" data-place="${keyOf(place)}" aria-label="${escape(id ? `Pack: ${ARTIFACTS[id].name}` : 'Pack: empty square')}" aria-pressed="${Boolean(this.selected && keyOf(this.selected) === keyOf(place))}">${id ? `<img alt="" draggable="false" src="${iconUrl(id)}">` : ''}</button>`;
    }).join('');
    return `<div class="gear page-scroll" data-scroll="gear">
      <h3>Equipped</h3><div class="doll">${slots}</div>
      <div class="pack-heading"><h3>Pack</h3><span>${pack.length} ${pack.length === 1 ? 'find' : 'finds'}</span></div>
      <div class="pack">${squares}</div>
      <p class="guide">${touch() ? 'Tap a find to read it. Move lets you put it somewhere else.' : 'Click a find to read it. Drag to move it, or choose Move.'}</p>
    </div>`;
  }

  private gearCard() {
    if (!this.selected) return `<section class="kc-hero-card empty-inspector"><img class="inspector-hero" alt="" draggable="false" src="${unitUrl(heroArtId(this.state.hero.background), 2)}"><h3>Your equipment</h3><p>Select a find or a worn item to read what it does.</p><p>You can compare it here before changing anything.</p></section>`;
    const id = gearAt(this.state, this.selected);
    if (!id) {
      const slot = this.selected.kind === 'slot' ? this.selected.slot : null;
      return `<section class="kc-hero-card empty-inspector"><h3>${slot ? SLOT_NAMES[slot] : 'A free square'}</h3><p>${slot ? 'You wear nothing here. Select a find in the pack to compare it.' : 'You can move a find into this square.'}</p><div class="acts"><button class="act" data-act="gear-cancel">Back</button></div></section>`;
    }
    const artifact = ARTIFACTS[id];
    const preview = previewGear(this.state, this.selected, this.target);
    const targets = this.selected.kind === 'pack' ? slotsForArtifact(artifact.slot) : [];
    const target = preview?.target;
    const destination = targets.length > 1 ? `<label class="destination">Wear in<select data-act="target" aria-label="Choose the trinket to replace">${targets.map(slot => `<option value="${slot}"${slot === target ? ' selected' : ''}>${SLOT_NAMES[slot]}${this.state.hero.gear[slot] ? ` (${escape(ARTIFACTS[this.state.hero.gear[slot]!].name)})` : ' (empty)'}</option>`).join('')}</select></label>` : '';
    const current = preview?.current ? ARTIFACTS[preview.current] : null;
    const changes = preview?.rows.filter(row => row.change !== 'same') ?? [];
    const casts = preview?.rows.find(row => row.name === 'Spells each round');
    const numeric = changes.filter(row => row.name !== 'Spells each round' && Number.isFinite(Number(row.before.replace(/%$/, ''))) && Number.isFinite(Number(row.after.replace(/%$/, ''))));
    const rows = [...numeric, ...(casts ? [casts] : []), ...changes.filter(row => row.name !== 'Spells each round' && !numeric.includes(row))];
    const table = preview ? `<table class="comparison"><thead><tr><th>What changes</th><th>Now</th><th>${this.selected.kind === 'pack' ? 'With it' : 'Without it'}</th></tr></thead><tbody>${rows.map(row => `<tr class="${row.change}"><th>${escape(row.name)}</th><td>${escape(row.before)}</td><td>${escape(row.after)}</td></tr>`).join('')}</tbody></table>` : '';
    const source = this.selected.kind === 'pack' ? `${target ? `${SLOT_NAMES[target]} \u00b7 ` : ''}${current ? `Equipped now ${current.name}` : 'Nothing equipped here'}` : `Worn \u00b7 ${SLOT_NAMES[this.selected.slot]}`;
    return `<section class="kc-hero-card gear-card" aria-label="${escape(artifact.name)}">
      <div class="card-heading"><img class="object-pic" alt="" draggable="false" src="${iconUrl(id)}"><div><h3>${escape(artifact.name)}</h3><p>${escape(source)}</p></div></div>
      <div class="card-reading page-scroll" data-scroll="gear-detail">
        ${destination}
        ${this.selected.kind === 'slot' ? '<p class="preview-note">This is what taking it off would change.</p>' : ''}
        ${table}
        <p class="preview-note">Looking does not change your equipment.</p>
        <details class="item-notes"><summary>About this find</summary><p class="object-note">${format(artifact.note)}</p></details>
        ${this.selected.kind === 'pack' && current ? `<details class="item-notes"><summary>About ${escape(current.name)}</summary><p>${format(current.note)}</p></details>` : ''}
      </div>
      <div class="acts">${this.held ? `<p class="move-instruction">${escape(this.holdingHint(this.held))}</p><button class="act" data-act="move-cancel">Put it back</button>` : `<button class="act primary" data-act="gear-apply"${preview ? '' : ' disabled'}>${this.selected.kind === 'pack' ? 'Wear it' : 'Take it off'}</button><button class="act" data-act="pick-up">Move</button><button class="act" data-act="gear-cancel">Back</button>`}</div>
    </section>`;
  }

  private holdingHint(held: Place) {
    if (held.kind === 'stack') return 'Choose a place in the line. You can drag the company there too.';
    if (held.kind === 'hero') return '';
    const id = gearAt(this.state, held);
    if (!id) return '';
    return held.kind === 'pack' ? `Choose a ${SLOT_NAMES[ARTIFACTS[id].slot].toLowerCase()} slot or a pack square.` : 'Choose a pack square to take it off.';
  }

  private army(sheet: HeroSheet) {
    const leader: Place = { kind: 'hero' };
    const tiles = Array.from({ length: 5 }, (_, index) => {
      const stack = this.state.army[index];
      const place: Place = { kind: 'stack', index };
      const info = stackSheet(this.state, index);
      return `<button class="tile${this.placeClasses(place, Boolean(stack))}" data-place="${keyOf(place)}" aria-label="${escape(info?.title ?? 'An empty place in the line')}"${stack ? '' : ' tabindex="-1"'}>${stack && info ? `<img alt="" draggable="false" src="${unitUrl(stack.troop)}"><div><b>${escape(info.title)}</b><span>${escape(info.row.replace('In battle they stand ', '').replace(/\.$/, ''))}</span></div>` : '<span>An empty place in the line</span>'}</button>`;
    }).join('');
    return `<div class="army page-scroll" data-scroll="army-line">
      <button class="tile leader${this.placeClasses(leader, true)}" data-place="hero" aria-label="${escape(sheet.title)}"><img alt="" draggable="false" src="${unitUrl(heroArtId(sheet.background))}"><div><b>Aldric</b><span>He leads from behind the line.</span></div></button>
      <h3>Your companies <small>${this.state.army.length} of 5</small></h3>
      <div class="strip">${tiles}</div>
      <p class="guide">The first company stands in the middle. The next two stand above and below it.</p>
    </div>`;
  }

  private cardHtml() {
    if (!this.card) return `<section class="kc-hero-card empty-inspector"><h3>Your army</h3><p>Select a company to see its strength, wages and place in the battle line.</p><p>You can reorder the line without sending anyone home.</p></section>`;
    if (this.card.kind === 'hero') {
      const me = leaderSheet(this.state);
      return `<section class="kc-hero-card leader-card" aria-label="${escape(me.title)}">
        <div class="card-heading"><img class="unit-pic" alt="" draggable="false" src="${unitUrl(heroArtId(this.state.hero.background), 2)}"><div><h3>${escape(me.title)}</h3><p>${escape(me.note)}</p></div></div>
        <div class="card-reading page-scroll" data-scroll="army-detail"><dl>${this.statList(me.stats)}</dl>${this.traitList(me.traits)}${me.lines.map(line => `<p>${escape(line)}</p>`).join('')}</div>
        <div class="acts"><button class="act" data-act="card-close">Back</button></div>
      </section>`;
    }
    const info = stackSheet(this.state, this.card.index);
    if (!info) return '';
    const i = this.card.index;
    const multiplier = 1 + heroStats(this.state).wages;
    const company = this.state.army[i];
    const cost = Math.round(wages([company]) * multiplier);
    const leadership = leadershipUsed([company]);
    const pay = Math.round(wages(this.state.army) * multiplier);
    const after = Math.round(wages(this.state.army.filter((_, index) => index !== i)) * multiplier);
    const moves = `<button class="act" data-act="left"${i === 0 ? ' disabled' : ''}>Move left</button><button class="act" data-act="right"${i === this.state.army.length - 1 ? ' disabled' : ''}>Move right</button>`;
    return `<section class="kc-hero-card company-card${this.confirming ? ' confirming' : ''}" aria-label="${escape(info.title)}">
      <div class="card-heading"><img class="unit-pic" alt="" draggable="false" src="${unitUrl(info.troop, 2)}"><div><h3>${escape(info.title)}</h3><p class="formation">${escape(info.row)}</p></div></div>
      <div class="company-cost"><span>Leadership <b>${leadership || 'none'}</b></span><span>Wages <b>${cost ? `${coins(cost)} gold a week` : 'none'}</b></span></div>
      ${this.confirming ? `<div class="confirmation page-scroll" data-scroll="dismiss"><h4>Send the ${escape(info.title)} home for good?</h4><p>They leave your army and take no more wages. Your weekly wages would fall from ${coins(pay)} to ${coins(after)} gold.</p></div>` : `<div class="card-reading page-scroll" data-scroll="army-detail"><p class="company-note">${escape(info.note)}</p><dl>${this.statList(info.stats)}</dl>${this.traitList(info.traits)}<p>${escape(info.leadership)}</p><p>${escape(info.wages)}</p></div>`}
      <div class="acts">${this.confirming ? `<button class="act safe" data-act="dismiss-no">Keep them</button><button class="act danger" data-act="dismiss-yes">Dismiss them</button>` : this.held ? `<p class="move-instruction">${escape(this.holdingHint(this.held))}</p><button class="act" data-act="move-cancel">Put them back</button>` : `${moves}<button class="act" data-act="pick-up">Reorder</button><button class="act danger" data-act="dismiss"${info.canDismiss ? '' : ' disabled'} title="${info.canDismiss ? 'Send this company home' : 'Your last company stays with you'}">Dismiss\u2026</button><button class="act card-back" data-act="card-close">Back</button>`}</div>
    </section>`;
  }

  private statList(stats: { name: string; value: string; note: string }[]) {
    return stats.map(s => `<dt>${escape(s.name)}</dt><dd><b>${escape(s.value)}</b><span>${escape(s.note)}</span></dd>`).join('');
  }

  private traitList(traits: Note[]) {
    return traits.length ? `<ul class="traits">${traits.map(t => `<li${t.trick ? ' class="trick"' : ''}><b>${escape(t.name)}.</b> ${format(t.note)}</li>`).join('')}</ul>` : '';
  }

  private footer(sheet: HeroSheet) {
    return `<footer class="hero-footer"><div class="map-commands">${sheet.mapSpells.map(m => `<button class="act" data-act="spell:${m.spell}" title="${escape(m.note)}"${m.disabled ? ' disabled' : ''}>${escape(m.label)}</button>`).join('')}<button class="act" data-act="endDay">End the day${touch() ? '' : ' (E)'}</button></div><p class="notice${this.error ? ' error' : ''}" role="status" aria-live="polite">${escape(this.notice)}</p></footer>`;
  }

  private setPage(page: Page) {
    this.held = null;
    this.confirming = false;
    this.page = page;
    this.lastClick = null;
    this.notice = '';
    this.error = false;
    this.hideTip();
    if (page === 'equipment' && !this.selected) {
      const slot = SLOTS.find(slot => this.state.hero.gear[slot]) ?? 'weapon';
      this.selected = this.state.hero.pack.length ? { kind: 'pack', index: 0 } : { kind: 'slot', slot };
      this.target = undefined;
    }
    if (page === 'army' && !this.card) this.card = this.state.army.length ? { kind: 'stack', index: 0 } : { kind: 'hero' };
    this.render();
    this.focus(this.root.querySelector<HTMLElement>(`[data-tab="${page}"]`));
  }

  private actionFor(from: Place, to: Place): Action | null {
    const { pack, gear } = this.state.hero;
    if (from.kind === 'pack' && pack[from.index]) {
      if (to.kind === 'slot') return slotAcceptsArtifact(to.slot, ARTIFACTS[pack[from.index]].slot) ? { type: 'wear', from: from.index, slot: to.slot } : null;
      if (to.kind === 'pack' && to.index !== from.index && (to.index < pack.length || from.index < pack.length - 1)) return { type: 'movePack', from: from.index, to: to.index };
    }
    if (from.kind === 'slot' && gear[from.slot] && to.kind === 'pack') return { type: 'unequip', slot: from.slot, to: to.index };
    if (from.kind === 'stack' && this.state.army[from.index] && to.kind === 'stack' && to.index !== from.index && (to.index < this.state.army.length || from.index < this.state.army.length - 1)) return { type: 'moveStack', from: from.index, to: Math.min(to.index, this.state.army.length) };
    return null;
  }

  private has(place: Place) { return place.kind === 'hero' || (place.kind === 'stack' ? Boolean(this.state.army[place.index]) : Boolean(gearAt(this.state, place))); }

  private landing(action: Action): Place | null {
    switch (action.type) {
      case 'wear': return { kind: 'slot', slot: action.slot ?? slotsForArtifact(ARTIFACTS[this.state.hero.pack[action.from]].slot).find(slot => !this.state.hero.gear[slot]) ?? ARTIFACTS[this.state.hero.pack[action.from]].slot };
      case 'unequip': return { kind: 'pack', index: Math.min(action.to ?? this.state.hero.pack.length, this.state.hero.pack.length) };
      case 'movePack': return { kind: 'pack', index: Math.min(action.to, this.state.hero.pack.length - 1) };
      case 'moveStack': return { kind: 'stack', index: Math.min(action.to, this.state.army.length - 1) };
      default: return null;
    }
  }

  private perform(action: Action) {
    const landing = this.landing(action);
    const card = this.card, selected = this.selected;
    if (landing) this.fresh.add(keyOf(landing));
    if (landing?.kind === 'stack' && this.card?.kind === 'stack' && action.type === 'moveStack' && this.card.index === action.from) this.card = landing;
    if (landing?.kind === 'slot' || landing?.kind === 'pack') this.selected = landing;
    this.target = undefined;
    this.held = null;
    this.lastClick = null;
    this.error = false;
    this.notice = action.type === 'moveStack' ? 'Your company has moved in the line.' : action.type === 'movePack' ? 'You move the find in your pack.' : 'Your equipment has changed.';
    if (this.hooks.act(action)) {
      play(action.type === 'wear' || action.type === 'unequip' ? 'equip' : action.type === 'moveStack' ? 'march' : 'lift');
      const el = landing && this.root.querySelector<HTMLElement>(`[data-place="${keyOf(landing)}"]`);
      if (el) this.focus(el, false);
      return true;
    }
    this.card = card;
    this.selected = selected;
    this.fresh.clear();
    this.error = true;
    this.notice = 'That change could not be made. Select the item or company and try again.';
    this.render();
    return false;
  }

  private placeAt(x: number, y: number) {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-place]');
    const place = el && this.root.contains(el) ? parse(el.dataset.place) : null;
    return el && place ? { el, place } : null;
  }

  private toSheet(x: number, y: number): [number, number] {
    const rect = this.root.getBoundingClientRect();
    return [(x - rect.left) / this.scale, (y - rect.top) / this.scale];
  }

  private listen() {
    const root = this.root;
    root.addEventListener('pointerdown', e => {
      e.stopPropagation();
      if (e.button !== 0) return;
      const hit = this.placeAt(e.clientX, e.clientY);
      if (!hit || hit.place.kind === 'hero' || !this.has(hit.place)) return;
      this.press = { place: hit.place, x: e.clientX, y: e.clientY, image: hit.el.querySelector('img')?.src ?? '', wide: hit.place.kind === 'stack' };
    });
    root.addEventListener('pointermove', e => {
      if (!this.press) {
        this.followHeld(e);
        return this.hoverTip(e);
      }
      if (e.pointerType === 'touch' && !this.held && !this.dragging) return;
      if (!this.dragging && Math.hypot(e.clientX - this.press.x, e.clientY - this.press.y) < 5) return;
      if (!this.dragging) {
        root.setPointerCapture(e.pointerId);
        this.startDrag();
      }
      const [x, y] = this.toSheet(e.clientX, e.clientY);
      const size = this.press.wide ? 72 : 36;
      Object.assign(this.ghost.style, { left: `${Math.round(x - size / 2)}px`, top: `${Math.round(y - size / 2)}px`, width: `${size}px`, height: `${size}px` });
      const hit = this.placeAt(e.clientX, e.clientY);
      const key = hit && this.actionFor(this.press.place, hit.place) ? keyOf(hit.place) : null;
      if (key !== this.over) {
        root.querySelector('.over')?.classList.remove('over');
        if (key) root.querySelector(`[data-place="${key}"]`)?.classList.add('over');
        this.over = key;
      }
      const scroll = hit?.el.closest<HTMLElement>('[data-scroll]');
      if (scroll) {
        const rect = scroll.getBoundingClientRect();
        if (e.clientY < rect.top + 24) scroll.scrollTop -= 12;
        else if (e.clientY > rect.bottom - 24) scroll.scrollTop += 12;
      }
    });
    const release = (e: PointerEvent) => {
      if (root.hasPointerCapture(e.pointerId)) root.releasePointerCapture(e.pointerId);
      if (!this.press) return;
      const from = this.press.place, was = this.dragging;
      this.press = null;
      if (!was) return;
      this.swallowClick = true;
      setTimeout(() => { this.swallowClick = false; }, 0);
      const hit = e.type === 'pointerup' ? this.placeAt(e.clientX, e.clientY) : null;
      const action = hit ? this.actionFor(from, hit.place) : null;
      this.endDrag();
      if (action) this.perform(action);
      else this.render();
    };
    root.addEventListener('pointerup', release);
    root.addEventListener('pointercancel', release);
    root.addEventListener('pointerleave', () => { if (!this.press) this.hideTip(); });
    root.addEventListener('click', e => {
      e.stopPropagation();
      if (this.swallowClick || !(e.target instanceof HTMLElement)) return;
      const tab = e.target.closest<HTMLElement>('[data-tab]');
      const page = PAGES.find(page => page === tab?.dataset.tab);
      if (page) return this.setPage(page);
      const act = e.target.closest<HTMLButtonElement>('[data-act]');
      if (act && this.root.contains(act)) return this.clickAct(act.dataset.act!, act);
      const place = parse(e.target.closest<HTMLElement>('[data-place]')?.dataset.place);
      if (place) this.clickPlace(place);
    });
    root.addEventListener('change', e => {
      if (!(e.target instanceof HTMLSelectElement) || e.target.dataset.act !== 'target') return;
      const select = e.target;
      const slot = SLOTS.find(slot => slot === select.value);
      if (!slot || !this.selected || !previewGear(this.state, this.selected, slot)) return;
      this.target = slot;
      this.scroll.set('gear-detail', 0);
      this.render();
      this.focus(this.root.querySelector<HTMLElement>('[data-act="target"]'));
    });
    root.addEventListener('keydown', e => this.key(e));
    root.addEventListener('contextmenu', e => e.preventDefault());
    root.addEventListener('focusin', e => {
      if (this.quiet || !(e.target instanceof HTMLElement)) return this.hideTip();
      const el = e.target.closest<HTMLElement>('[data-tip]');
      if (el?.matches(':focus-visible')) this.showTip(el);
    });
    root.addEventListener('focusout', () => this.hideTip());
  }

  private followHeld(e: PointerEvent) {
    if (e.pointerType === 'touch') return;
    const img = this.held && this.root.querySelector<HTMLImageElement>(`[data-place="${keyOf(this.held)}"] img`);
    if (!img) { this.ghost.hidden = true; return; }
    const [x, y] = this.toSheet(e.clientX, e.clientY);
    this.ghost.src = img.src;
    Object.assign(this.ghost.style, { left: `${Math.round(x + 4)}px`, top: `${Math.round(y + 4)}px`, width: '36px', height: '36px' });
    this.ghost.hidden = false;
  }

  private startDrag() {
    const press = this.press!;
    this.dragging = true;
    this.held = null;
    if (press.place.kind === 'stack') this.card = press.place;
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
    for (const el of this.root.querySelectorAll('.can-drop,.lifted,.over')) el.classList.remove('can-drop', 'lifted', 'over');
  }

  private clickPlace(place: Place) {
    this.hideTip();
    if (this.held) {
      const action = this.actionFor(this.held, place);
      if (action) return this.perform(action);
      if (keyOf(this.held) === keyOf(place)) return this.cancel();
      this.error = true;
      this.notice = `It cannot go there. ${this.holdingHint(this.held)}`;
      this.render();
      return;
    }
    if (place.kind === 'hero' || place.kind === 'stack') {
      if (this.has(place)) this.openCard(place);
      return;
    }
    const now = performance.now();
    const double = !touch() && this.lastClick?.key === keyOf(place) && now - this.lastClick.at < 400;
    this.lastClick = double ? null : { key: keyOf(place), at: now };
    this.selected = place;
    this.target = undefined;
    this.scroll.set('gear-detail', 0);
    this.error = false;
    this.notice = '';
    if (double && this.has(place)) {
      const preview = previewGear(this.state, place);
      if (preview) return this.perform(preview.action);
    }
    this.render();
    play('click');
  }

  private clickAct(act: string, button: HTMLButtonElement) {
    if (button.disabled) return;
    if (act === 'note') return this.showTip(button);
    if (act === 'close') return this.hooks.close();
    if (act === 'endDay') return this.hooks.endDay();
    if (act.startsWith('spell:')) return this.hooks.castMapSpell(act.slice(6) as MapSpellId);
    if (act === 'leader') return this.openCard({ kind: 'hero' });
    if (act === 'gear-cancel') {
      const was = this.selected;
      this.selected = null; this.held = null; this.lastClick = null; this.render();
      if (was) this.focus(this.root.querySelector<HTMLElement>(`[data-place="${keyOf(was)}"]`));
      return;
    }
    if (act === 'move-cancel') {
      const was = this.held;
      this.held = null; this.error = false; this.notice = 'You put it back.'; this.render();
      if (was) this.focus(this.root.querySelector<HTMLElement>(`[data-place="${keyOf(was)}"]`));
      return;
    }
    if (act === 'gear-apply' && this.selected) {
      const preview = previewGear(this.state, this.selected, this.target);
      if (preview) this.perform(preview.action);
      return;
    }
    if (act === 'pick-up') {
      this.held = this.page === 'equipment' ? this.selected : this.card?.kind === 'stack' ? this.card : null;
      this.error = false;
      this.notice = this.held ? this.holdingHint(this.held) : '';
      this.render();
      if (this.held) this.focus(this.root.querySelector<HTMLElement>(`[data-place="${keyOf(this.held)}"]`));
      play('lift');
      return;
    }
    if (act === 'card-close') return this.closeCard();
    const index = this.card?.kind === 'stack' ? this.card.index : -1;
    if (act === 'left' || act === 'right') {
      this.perform({ type: 'moveStack', from: index, to: act === 'left' ? index - 1 : index + 1 });
      this.focus(this.root.querySelector<HTMLElement>(`[data-act="${act}"]:not(:disabled)`));
      return;
    }
    if (act === 'dismiss-no') {
      this.confirming = false;
      this.render();
      this.focus(this.root.querySelector<HTMLElement>('[data-act="dismiss"]'));
      return;
    }
    if (act === 'dismiss' && stackSheet(this.state, index)?.canDismiss) {
      this.held = null;
      this.confirming = true;
      this.scroll.set('dismiss', 0);
      this.render();
      this.focus(this.root.querySelector<HTMLElement>('[data-act="dismiss-no"]'));
      return;
    }
    if (act === 'dismiss-yes' && this.confirming) {
      this.confirming = false;
      this.notice = 'The company goes home.';
      if (this.hooks.act({ type: 'dismiss', index })) play('march');
      else { this.error = true; this.notice = 'The company could not be dismissed. Your last company stays with you.'; this.render(); }
      this.focus(this.root.querySelector<HTMLElement>(`[data-place="stack:${Math.max(0, Math.min(index, this.state.army.length - 1))}"]`));
    }
  }

  private openCard(place: { kind: 'hero' } | { kind: 'stack'; index: number }) {
    this.page = 'army';
    this.card = place;
    this.confirming = false;
    this.held = null;
    this.scroll.set('army-detail', 0);
    this.notice = '';
    this.error = false;
    this.render();
    this.focus(this.root.querySelector<HTMLElement>(`[data-place="${keyOf(place)}"]`));
    play('click');
  }

  private closeCard() {
    const was = this.card;
    this.card = null;
    this.confirming = false;
    this.held = null;
    this.render();
    if (was) this.focus(this.root.querySelector<HTMLElement>(`[data-place="${keyOf(was)}"]`));
  }

  private focusables() {
    return [...this.root.querySelectorAll<HTMLElement>('button:not(:disabled):not([tabindex="-1"]),select,summary')].filter(el => el.getClientRects().length > 0);
  }

  private key(e: KeyboardEvent) {
    if (!(e.target instanceof HTMLElement)) return;
    if (e.target instanceof HTMLSelectElement) { e.stopPropagation(); return; }
    if (e.key === 'Escape') {
      if (this.cancel()) { e.stopPropagation(); e.preventDefault(); }
      return;
    }
    if (e.key === 'Tab') {
      e.stopPropagation();
      const list = this.focusables();
      const next = e.shiftKey ? list[list.length - 1] : list[0];
      if (e.target === (e.shiftKey ? list[0] : list[list.length - 1])) { e.preventDefault(); this.focus(next); }
      return;
    }
    const tab = e.target.closest<HTMLElement>('[data-tab]');
    if (tab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
      e.preventDefault(); e.stopPropagation();
      const index = PAGES.indexOf(this.page);
      this.setPage(PAGES[e.key === 'Home' ? 0 : e.key === 'End' ? 2 : (index + (e.key === 'ArrowRight' ? 1 : 2)) % 3]);
      return;
    }
    const el = e.target.closest<HTMLElement>('[data-place]');
    const place = parse(el?.dataset.place);
    const arrow = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, [number, number]>)[e.key];
    if (arrow) {
      e.preventDefault(); e.stopPropagation();
      if (e.shiftKey && place && this.has(place) && (place.kind === 'stack' || place.kind === 'pack')) {
        const pack = this.root.querySelector('.pack');
        const columns = pack ? getComputedStyle(pack).gridTemplateColumns.split(' ').length : PACK_ROW;
        const step = place.kind === 'pack' ? arrow[0] + arrow[1] * columns : arrow[0] + arrow[1];
        const to = place.index + step;
        if (step && to >= 0) {
          const target: Place = { kind: place.kind, index: to };
          const action = this.actionFor(place, target);
          if (action) this.perform(action);
        }
        return;
      }
      this.moveFocus(el ?? e.target, arrow);
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && place?.kind === 'stack' && this.has(place)) {
      e.preventDefault(); e.stopPropagation();
      this.card = place;
      this.confirming = stackSheet(this.state, place.index)?.canDismiss ?? false;
      this.render();
      this.focus(this.root.querySelector<HTMLElement>(this.confirming ? '[data-act="dismiss-no"]' : '[data-act="card-close"]'));
      return;
    }
    if (e.key === ' ' || e.key === 'Enter') e.stopPropagation();
  }

  private moveFocus(from: HTMLElement, [dx, dy]: [number, number]) {
    const a = from.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best: HTMLElement | null = null, score = Infinity;
    for (const el of this.focusables()) {
      if (el === from || el.closest('.kc-hero-card') !== from.closest('.kc-hero-card')) continue;
      const b = el.getBoundingClientRect(), ex = b.left + b.width / 2 - ax, ey = b.top + b.height / 2 - ay;
      const along = ex * dx + ey * dy;
      if (along <= 2) continue;
      const s = along + Math.abs(ex * dy - ey * dx) * 2.5;
      if (s < score) { best = el; score = s; }
    }
    this.focus(best, false);
  }

  private hoverTip(e: PointerEvent) {
    const el = e.target instanceof HTMLElement ? e.target.closest<HTMLElement>('[data-tip]') : null;
    if (el?.dataset.tip) this.showTip(el);
    else this.hideTip();
  }

  private showTip(el: HTMLElement) {
    const text = el.dataset.tip;
    if (!text || this.dragging) return this.hideTip();
    this.tip.innerHTML = format(text);
    const rect = this.root.getBoundingClientRect();
    const left = Math.max(4, -rect.left / this.scale + 4);
    const right = Math.min(this.root.offsetWidth - 4, (window.innerWidth - rect.left) / this.scale - 4);
    const top = Math.max(4, -rect.top / this.scale + 4);
    const bottom = Math.min(this.root.offsetHeight - 4, (window.innerHeight - rect.top) / this.scale - 4);
    this.tip.style.maxWidth = `${Math.max(80, Math.min(300, right - left))}px`;
    this.tip.style.maxHeight = `${Math.max(40, bottom - top)}px`;
    this.tip.hidden = false;
    const r = el.getBoundingClientRect(), [x0, y0] = this.toSheet(r.left, r.top), [x1, y1] = this.toSheet(r.right, r.bottom);
    const w = this.tip.offsetWidth, h = this.tip.offsetHeight;
    const x = Math.max(left, Math.min(right - w, (x0 + x1 - w) / 2));
    const preferred = y0 - h - 6 >= top ? y0 - h - 6 : y1 + 6;
    this.tip.style.left = `${Math.round(x)}px`;
    this.tip.style.top = `${Math.round(Math.max(top, Math.min(bottom - h, preferred)))}px`;
  }

  private hideTip() { this.tip.hidden = true; }
  private focus(el: HTMLElement | null | undefined, quiet = true) {
    if (!el) return;
    this.quiet = quiet;
    el.focus({ preventScroll: true });
    if (!quiet) el.scrollIntoView({ block: 'nearest' });
    this.quiet = false;
  }

  describe() {
    const preview = this.selected ? previewGear(this.state, this.selected, this.target) : null;
    return {
      title: this.title, page: this.page,
      slots: Object.fromEntries(SLOTS.map(slot => [slot, this.state.hero.gear[slot] ?? null])),
      pack: [...this.state.hero.pack],
      army: this.state.army.map(s => `${s.count} ${s.troop}`),
      held: this.held ? keyOf(this.held) : null,
      selected: this.selected ? keyOf(this.selected) : null,
      card: this.card ? keyOf(this.card) : null,
      comparison: preview ? { target: preview.target, current: preview.current, candidate: preview.candidate, rows: preview.rows } : null,
      text: this.root.innerText,
    };
  }
}
