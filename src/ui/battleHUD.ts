import { abilitiesOf, TROOPS, type TroopId } from '../content/troops';
import { SPELLS, STATUSES, type SpellId } from '../content/spells';
import { castsLeft, isLeader, luckOf, moraleOf, speedOf, statsOf, unitOf, type BattleState, type Fighter } from '../rules/battle/battle';
import { capital, roman } from '../rules/state';
import { upcomingFighters } from '../render/battleOrder';
import { standingFigure } from '../render/battleSprites';
import type { BattleView } from '../render/battleScreen';
import { MAP_VIEW, SCREEN } from '../render/frame';
import type { Display } from '../game/display';
import type { SideButton } from '../game/screen';
import { bitmapUrl } from './pixels';
import { play } from './sound';
import { touch } from './touch';
import { uiScale } from './scale';
import './battleHUD.css';

const pictures = new Map<string, string>();
function picture(troop: TroopId, side: Fighter['side']) {
  const key = `${troop}/${side}`;
  let url = pictures.get(key);
  if (!url) {
    url = bitmapUrl(standingFigure(troop, side === 'player' ? 'blue' : 'red', .5));
    pictures.set(key, url);
  }
  return url;
}

function nameOf(f: Fighter, count = f.count) {
  const troop = unitOf(f);
  return troop.name === troop.one
    ? `${capital(troop.name)}${f.level ? `, level ${roman(f.level)}` : ''}`
    : `${count} ${capital(count === 1 ? troop.one : troop.name)}`;
}

function moodsOf(b: BattleState, f: Fighter) {
  const share = (value: number) => `${value > 0 ? '+' : '\u2212'}${Math.round(Math.abs(value) * 100)}%`;
  const [luck, morale] = [luckOf(b, f), moraleOf(b, f)];
  return [
    ...f.status.map(id => STATUSES[id].name),
    f.defending ? 'Defending' : '',
    f.waited ? 'Waited' : '',
    Math.round(luck * 100) ? `Luck ${share(luck)}` : '',
    Math.round(morale * 100) ? `Morale ${share(morale)}` : '',
  ].filter(Boolean);
}

/** The field keeps its painted scale; its information keeps a readable page-pixel size. */
export class BattleHUD {
  private readonly el = document.createElement('div');
  private readonly header = document.createElement('div');
  private readonly phase = document.createElement('div');
  private readonly turns = document.createElement('ol');
  private readonly deck = document.createElement('div');
  private readonly identity = document.createElement('div');
  private readonly resources = document.createElement('div');
  private readonly commands = document.createElement('div');
  private readonly message = document.createElement('p');
  private buttons: SideButton[] = [];
  private shown = '';
  private queued = '';
  private commanded = '';
  private phased = '';
  private placed = '';

  constructor(private readonly press: (button: SideButton) => void) {
    this.el.className = 'kc-battle';
    this.header.className = 'kc-battle-header';
    this.phase.className = 'kc-battle-phase';
    this.turns.className = 'kc-battle-turns';
    this.turns.setAttribute('aria-label', 'Current and next turns');
    this.deck.className = 'kc-battle-deck';
    this.deck.setAttribute('aria-label', 'Battle information and commands');
    this.identity.className = 'kc-battle-identity';
    this.identity.setAttribute('aria-live', 'polite');
    this.resources.className = 'kc-battle-resources';
    this.commands.className = 'kc-battle-commands';
    this.message.className = 'kc-battle-message';
    const main = document.createElement('div');
    main.className = 'kc-battle-main';
    main.append(this.identity, this.resources, this.commands);
    this.header.append(this.phase, this.turns);
    this.deck.append(main, this.message);
    this.el.append(this.header, this.deck);
    document.body.append(this.el);
    this.commands.addEventListener('pointerdown', event => event.stopPropagation());
    this.commands.addEventListener('click', event => {
      event.stopPropagation();
      const element = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-id]');
      const button = element && this.buttons.find(b => b.id === element.dataset.id);
      if (!button?.enabled) return;
      play('click');
      this.press(button);
    });
    const keys: Record<string, string> = { spells: 'S', wait: 'W', defend: 'D', auto: 'A', retreat: 'R' };
    for (const id of Object.keys(keys)) {
      const button = document.createElement('button');
      button.dataset.id = id;
      const label = document.createElement('span');
      const key = document.createElement('kbd');
      key.textContent = keys[id];
      button.append(label, key);
      this.commands.append(button);
    }
  }

  place(b: BattleState, view: BattleView, buttons: SideButton[], display: Display, covered: boolean) {
    this.buttons = buttons;
    const active = b.fighters.find(f => f.id === view.active);
    const inspected = b.fighters.find(f => f.id === view.inspect && f.count > 0);
    const auto = Boolean(buttons.find(button => button.id === 'auto')?.on);
    const aiming = view.targeting ? SPELLS[view.targeting as SpellId] : null;
    const mine = buttons.some(button => button.id === 'defend' && button.enabled);
    const phase = auto ? 'Auto' : aiming ? aiming.name : active?.side === 'enemy' ? 'Enemy turn' : mine ? 'Your turn' : 'In motion';
    this.header.dataset.side = active?.side ?? 'player';
    const phased = `${phase}/${b.round}`;
    if (phased !== this.phased) {
      this.phased = phased;
      this.phase.replaceChildren(
        Object.assign(document.createElement('b'), { textContent: phase }),
        Object.assign(document.createElement('span'), { textContent: `Round ${roman(b.round)}` }),
      );
    }
    const count = active ? view.counts.get(active.id) ?? active.count : 0;
    const hp = active ? view.health.get(active.id) ?? active.hp : 0;
    const shown = JSON.stringify([active?.id, count, hp, active?.status, active?.shots, active?.waited, active?.defending, inspected, b.hero, b.enemyHelp]);
    if (shown !== this.shown) {
      this.shown = shown;
      this.identity.replaceChildren();
      if (active) {
        const figure = Object.assign(document.createElement('img'), { src: picture(active.troop, active.side), alt: '' });
        const words = document.createElement('div');
        words.append(Object.assign(document.createElement('h2'), { className: 'kc-battle-active', textContent: nameOf(active, count) }));
        const stats = document.createElement('p');
        stats.className = 'kc-battle-stats';
        const unit = unitOf(active);
        const numbers = statsOf(b, active);
        const stat = (text: string, extra = false) => Object.assign(document.createElement('span'), { textContent: text, className: extra ? 'extra' : '' });
        stats.append(stat(`Attack ${numbers.attack}`));
        if (!isLeader(active)) stats.append(stat(`Defence ${numbers.defence}`), stat(`Health ${hp}/${unit.hp}`));
        if (!isLeader(active) || active.shots || abilitiesOf(active.troop).some(ability => ability.rides)) stats.append(stat(`Damage ${unit.damage[0]}-${unit.damage[1]}`, true));
        stats.append(stat(`Speed ${speedOf(active)}`));
        if (TROOPS[active.troop].shots) stats.append(stat(`Shots ${active.shots}`));
        words.append(stats);
        this.identity.append(figure, words);
      }
      this.resources.replaceChildren(
        Object.assign(document.createElement('b'), { textContent: `Mana ${b.hero.mana}${b.hero.maxMana !== undefined ? `/${b.hero.maxMana}` : ''}` }),
        Object.assign(document.createElement('span'), { textContent: `Casts ${Math.max(0, castsLeft(b))} this round` }),
        ...(active && abilitiesOf(active.troop).some(ability => ability.bard) ? [Object.assign(document.createElement('span'), { textContent: `Gold ${b.hero.gold ?? 0}` })] : []),
      );
      this.resources.classList.toggle('bard', Boolean(active && abilitiesOf(active.troop).some(ability => ability.bard)));
    }
    const width = MAP_VIEW.width * display.scale;
    const limit = touch() ? width < 600 ? 3 : 4 : 6;
    const next = b.result ? [] : upcomingFighters(b, limit);
    if (active && next[0]?.id !== active.id && !b.result) next.unshift(active);
    const shownNext = next.slice(0, limit);
    const queued = JSON.stringify([shownNext.map(f => [f.id, view.counts.get(f.id) ?? f.count]), view.active]);
    if (queued !== this.queued) {
      this.queued = queued;
      this.turns.replaceChildren(...shownNext.map(f => {
        const item = document.createElement('li');
        item.dataset.fighter = String(f.id);
        item.dataset.side = f.side;
        item.classList.toggle('active', f.id === view.active);
        const count = view.counts.get(f.id) ?? f.count;
        const words = `${f.id === view.active ? 'Now. ' : ''}${f.side === 'player' ? 'Your' : 'Their'} ${nameOf(f, count)}`;
        item.title = words;
        item.setAttribute('aria-label', words);
        const figure = Object.assign(document.createElement('img'), { src: picture(f.troop, f.side), alt: '' });
        item.append(figure, Object.assign(document.createElement('b'), { textContent: isLeader(f) ? '' : String(count) }));
        return item;
      }));
    }
    const commanded = JSON.stringify([buttons.map(button => [button.id, button.label, button.enabled, button.on]), covered]);
    if (commanded !== this.commanded) {
      this.commanded = commanded;
      for (const element of this.commands.querySelectorAll<HTMLButtonElement>('button')) {
        const button = buttons.find(button => button.id === element.dataset.id)!;
        element.disabled = !button.enabled || covered;
        element.querySelector('span')!.textContent = button.label;
        const key = element.querySelector('kbd')!;
        key.textContent = button.id === 'spells' && aiming ? 'Esc' : { spells: 'S', wait: 'W', defend: 'D', auto: 'A', retreat: 'R' }[button.id]!;
        element.setAttribute('aria-keyshortcuts', key.textContent);
        if (button.on !== undefined) element.setAttribute('aria-pressed', String(button.on));
        element.title = `${button.label} (${key.textContent})`;
      }
    }
    let message = view.log;
    if (aiming) message = `Cast ${aiming.name}. ${touch() ? 'Tap' : 'Click'} ${aiming.on === 'enemy' ? 'an enemy' : 'one of your companies'}${touch() ? ', then tap again' : ''}. Cancel puts the spell away.`;
    else if (inspected && inspected.id !== active?.id) {
      const unit = unitOf(inspected);
      const numbers = statsOf(b, inspected);
      message = `${inspected.side === 'player' ? 'Your' : 'Their'} ${nameOf(inspected)}. ${isLeader(inspected) ? inspected.book ? `Mana ${inspected.book.mana}.` : 'Leads from behind the line.' : `Health ${inspected.hp}/${unit.hp}. Defence ${numbers.defence}.`}`;
      const moods = moodsOf(b, inspected);
      if (moods.length) message += ` ${moods.join(', ')}.`;
    } else if (active) {
      const moods = moodsOf(b, active);
      if (moods.length) message = `${moods.join(', ')}. ${TROOPS[active.troop].shots && !active.shots ? 'No arrows left.' : ''}`.trim();
    }
    this.message.textContent = message;
    this.message.title = message;
    const s = uiScale();
    const left = display.toPage(MAP_VIEW.x, 0).x;
    const headerTop = display.toPage(0, MAP_VIEW.y + 5).y;
    const bottom = touch() ? window.innerHeight - 2 : display.toPage(0, SCREEN.height - 6).y;
    const placed = JSON.stringify([left, width, headerTop, bottom, s, touch()]);
    if (placed !== this.placed) {
      this.placed = placed;
      this.el.style.setProperty('--battle-scale', String(s));
      this.el.classList.toggle('compact', width < 600);
      const headerWidth = touch() ? width < 600 ? 310 : 390 : 540 * s;
      Object.assign(this.header.style, { left: `${left + width / 2}px`, top: `${headerTop}px`, width: `${Math.min(width - 20, headerWidth) / s}px` });
      Object.assign(this.deck.style, { left: `${left}px`, top: `${bottom}px`, width: `${width / s}px` });
    }
  }

  dispose() {
    this.el.remove();
  }
}
