import { MAP_VIEW } from '../render/frame';
import { TitleScreen } from '../render/titleScreen';
import type { Action, GameState } from '../rules/game';
import { CardView } from '../ui/card';
import type { Display } from './display';
import { titleCard } from './intro';
import { NO_INPUT, type Screen } from './screen';

/** The painted title, with the name, the title tune and a menu: carry on, or begin a new campaign. */
export class TitleController implements Screen {
  readonly name = 'title';
  readonly music = 'title' as const;
  readonly ambience = 'heath' as const;
  private readonly display: Display;
  private readonly screen = new TitleScreen();
  private readonly cards: CardView;
  private readonly hooks: { onNew: () => void; onContinue: () => void };
  private readonly resume: GameState | null;
  private time = 0;

  constructor(display: Display, resume: GameState | null, hooks: TitleController['hooks']) {
    this.display = display;
    this.resume = resume;
    this.hooks = hooks;
    this.cards = new CardView((action) => this.choose(action));
    this.cards.show(titleCard(resume));
  }

  private choose(action: Action) {
    if (action.type === 'close' && this.resume) this.hooks.onContinue();
    else if (action.type === 'restart') this.hooks.onNew();
  }

  /** Enter picks the first choice: carry on if there is a save, a new campaign if not. */
  readonly input = { ...NO_INPUT, key: (key: string) => key === 'enter' && this.choose(this.resume ? { type: 'close' } : { type: 'restart' }) };

  update(dt: number) {
    this.time += dt;
  }

  render(): Uint8Array {
    return this.screen.draw(this.time).data;
  }

  get bitmap() {
    return this.screen.screen;
  }

  /** The menu stands on the fields at the lower left, clear of the castle and the rider. */
  placeCards() {
    const top = this.display.toPage(0, MAP_VIEW.y).y;
    const bottom = this.display.toPage(0, MAP_VIEW.y + MAP_VIEW.height).y;
    this.cards.place(this.display.toPage(MAP_VIEW.x + 196, MAP_VIEW.y + MAP_VIEW.height - 18), top, bottom);
  }

  dispose() {
    this.cards.dispose();
  }
}
