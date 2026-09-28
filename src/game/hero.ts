import type { MapSpellId } from '../content/spells';
import type { Action } from '../rules/game';
import { HeroScreen } from '../ui/heroScreen';
import type { AdventureController } from './adventure';
import type { Display } from './display';
import type { Screen } from './screen';

/**
 * The hero screen, open over the map: the map stands still underneath, and every change goes
 * through the map's rules, so it's saved as it's made. H, Escape or Close shuts it.
 */
export class HeroController implements Screen {
  readonly name = 'hero';
  private readonly display: Display;
  private readonly adventure: AdventureController;
  readonly sheet: HeroScreen;
  private readonly onClose: () => void;

  constructor(display: Display, adventure: AdventureController, onClose: () => void, focus: 'army' | null = null) {
    this.display = display;
    this.adventure = adventure;
    this.onClose = onClose;
    this.sheet = new HeroScreen(
      adventure.state,
      {
        act: (action: Action) => {
          const done = adventure.act(action);
          if (done) this.sheet.update(adventure.state);
          return done;
        },
        castMapSpell: (spell: MapSpellId) => this.closeThen({ type: 'mapSpell', spell }),
        endDay: () => this.closeThen({ type: 'endDay' }),
        close: () => this.close(),
      },
      focus,
    );
    this.placeCards();
  }

  get music() {
    return this.adventure.music;
  }

  get ambience() {
    return this.adventure.ambience;
  }

  get bitmap() {
    return this.adventure.bitmap;
  }

  /** Time stands still on the map while the hero looks himself over. */
  update() {}

  render(tick: number): Uint8Array {
    return this.adventure.render(tick);
  }

  placeCards() {
    this.sheet.place((x, y) => this.display.toPage(x, y), this.display.scale);
  }

  close() {
    this.onClose();
  }

  /** Shuts the sheet, then does something on the map: casting Far Sight, or ending the day. */
  private closeThen(action: Action) {
    this.close();
    this.adventure.choose(action);
  }

  dispose() {
    this.sheet.dispose();
  }

  readonly input = {
    // A click on the map around the sheet shuts it; on the bar, the hourglass still ends the day.
    click: (x: number, y: number) => {
      const bar = this.adventure.barAt(x, y);
      if (bar === 'hourglass') this.closeThen({ type: 'endDay' });
      else if (!bar) this.close();
    },
    hover: () => {},
    drag: () => {},
    leave: () => {},
    key: (key: string) => {
      if (key === 'h' || key === 'escape') {
        if (key === 'escape' && this.sheet.cancel()) return;
        this.close();
      } else if (key === 'e') this.closeThen({ type: 'endDay' });
    },
  };
}
