import { capital, roman } from '../rules/state';
import { unitOf, type BattleState } from '../rules/battle/battle';
import type { BattleView } from '../render/battleScreen';
import { MAP_VIEW, SCREEN } from '../render/frame';
import type { Display } from '../game/display';
import type { SideButton } from '../game/screen';
import { play } from './sound';
import { touch } from './touch';
import { uiScale } from './scale';
import './battleHUD.css';

/** The current company and available orders leave the painted field to itself. */
export class BattleHUD {
  private readonly el = document.createElement('div');
  private readonly deck = document.createElement('div');
  private readonly identity = document.createElement('h2');
  private readonly commands = document.createElement('div');
  private buttons: SideButton[] = [];
  private commanded = '';
  private placed = '';

  constructor(private readonly press: (button: SideButton) => void) {
    this.el.className = 'kc-battle';
    this.deck.className = 'kc-battle-deck';
    this.deck.setAttribute('aria-label', 'Battle commands');
    this.identity.className = 'kc-battle-active';
    this.identity.setAttribute('aria-live', 'polite');
    this.commands.className = 'kc-battle-commands';
    this.deck.append(this.identity, this.commands);
    this.el.append(this.deck);
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
    for (const id of ['spells', 'wait', 'defend', 'auto', 'retreat']) {
      const button = document.createElement('button');
      button.dataset.id = id;
      this.commands.append(button);
    }
  }

  place(b: BattleState, view: BattleView, buttons: SideButton[], display: Display, covered: boolean) {
    this.buttons = buttons;
    const active = b.fighters.find(f => f.id === view.active);
    if (active) {
      const troop = unitOf(active);
      const count = view.counts.get(active.id) ?? active.count;
      const name = troop.name === troop.one
        ? `${capital(troop.name)}${active.level ? `, level ${roman(active.level)}` : ''}`
        : `${count} ${capital(count === 1 ? troop.one : troop.name)}`;
      if (this.identity.textContent !== name) this.identity.textContent = name;
      this.identity.dataset.side = active.side;
    }
    const commanded = JSON.stringify([buttons.map(button => [button.id, button.label, button.enabled, button.on]), covered]);
    if (commanded !== this.commanded) {
      this.commanded = commanded;
      for (const element of this.commands.querySelectorAll<HTMLButtonElement>('button')) {
        const button = buttons.find(button => button.id === element.dataset.id)!;
        element.disabled = !button.enabled || covered;
        element.hidden = element.disabled;
        element.textContent = button.label;
        const key = button.id === 'spells' && view.targeting ? 'Escape' : { spells: 'S', wait: 'W', defend: 'D', auto: 'A', retreat: 'R' }[button.id]!;
        element.setAttribute('aria-keyshortcuts', key);
        element.title = `${button.label} (${key})`;
        if (button.on !== undefined) element.setAttribute('aria-pressed', String(button.on));
      }
    }
    const scale = uiScale();
    const left = display.toPage(MAP_VIEW.x, 0).x;
    const width = MAP_VIEW.width * display.scale;
    const bottom = touch() ? window.innerHeight : display.toPage(0, SCREEN.height - 6).y;
    const placed = JSON.stringify([left, width, bottom, scale, touch()]);
    if (placed !== this.placed) {
      this.placed = placed;
      this.el.style.setProperty('--battle-scale', String(scale));
      Object.assign(this.deck.style, { left: `${left}px`, top: `${bottom}px`, width: `${width / scale}px` });
    }
  }

  dispose() {
    this.el.remove();
  }
}
