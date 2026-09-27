import { CourtScreen } from '../render/courtScreen';
import { MAP_VIEW } from '../render/frame';
import { apply, courtCard, levelUpCard, roman, type Action, type GameEvent, type GameState } from '../rules/game';
import { CardView } from '../ui/card';
import type { Display } from './display';
import { NO_INPUT, type Screen } from './screen';

/**
 * The King's court between commissions: the throne room, with the cards on top. Any level-ups
 * still waiting come first, then the King's thanks and boons, then the next commission's briefing.
 */
export class CourtController implements Screen {
  readonly name = 'court';
  readonly music = 'court' as const;
  readonly ambience = 'fire' as const;
  readonly input = NO_INPUT;
  state: GameState;
  private readonly display: Display;
  private readonly screen = new CourtScreen();
  private readonly cards: CardView;
  private readonly hooks: { onChange: (state: GameState) => void; onDone: (state: GameState, rest: GameEvent[]) => void };
  private time = 0;

  constructor(display: Display, state: GameState, hooks: CourtController['hooks']) {
    this.display = display;
    this.state = state;
    this.hooks = hooks;
    this.screen.caption = `The King\u2019s Court \u00b7 Commission ${roman(state.campaign.chapter + 1)} complete`;
    this.cards = new CardView((action) => this.choose(action));
    this.showNext();
  }

  private showNext() {
    this.cards.show(levelUpCard(this.state) ?? courtCard(this.state));
  }

  choose(action: Action) {
    const result = apply(this.state, action);
    if (!result) return;
    this.state = result.state;
    this.hooks.onChange(this.state);
    const onward = result.events.findIndex((e) => e.type === 'commission');
    if (onward >= 0) {
      this.hooks.onDone(this.state, result.events.slice(onward + 1));
      return;
    }
    const card = result.events.find((e) => e.type === 'card');
    if (card?.type === 'card') this.cards.show(card.card);
    else this.showNext();
  }

  update(dt: number, _held?: ReadonlySet<string>) {
    this.time += dt;
  }

  render(_tick?: number): Uint8Array {
    return this.screen.draw(this.time).data;
  }

  get bitmap() {
    return this.screen.screen;
  }

  placeCards() {
    this.placeCard();
  }

  get screenBitmap() {
    return this.screen.screen;
  }

  /** Cards hang to the right of the throne, so the King stays in view. */
  placeCard() {
    const bottom = this.display.toPage(0, MAP_VIEW.y + MAP_VIEW.height).y;
    this.cards.place(this.display.toPage(MAP_VIEW.x + MAP_VIEW.width * 0.8, MAP_VIEW.y + MAP_VIEW.height - 8), this.display.toPage(0, MAP_VIEW.y).y, bottom);
  }

  dispose() {
    this.cards.dispose();
  }
}
