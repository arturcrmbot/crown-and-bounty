import { BACKGROUNDS } from '../content/backgrounds';
import { addPlace, buildAdventureScene, type AdventureScene, type Hitbox } from '../render/adventureScene';
import { MAP_VIEW } from '../render/frame';
import { HOURGLASS, HOURGLASS_AT, paintHud } from '../render/hud';
import type { BattleState } from '../rules/battle/battle';
import { ambushCard, apply, describe, describeHero, finishFight, levelUpCard, locationById, visit, type Action, type Card, type GameEvent, type GameState, type Result } from '../rules/game';
import type { Point } from '../rules/map/geometry';
import { cellCentre, type MapModel } from '../rules/map/model';
import { planRoute, routeCosts, stepAlong } from '../rules/map/movement';
import { CardView } from '../ui/card';
import { play } from '../ui/sound';
import { HoverLabel } from '../ui/label';
import type { Display } from './display';
import type { Input } from './input';
import type { Screen } from './screen';
import { backgroundCard, endCard, storyCard } from './intro';
import { clearSave, saveGame } from './save';
import { Walks } from './walks';

/** Map pixels per second. */
const RIDE_SPEED = 95;
/** Map pixels per step of the trot cycle, so hooves don't slide. */
const STRIDE = 5;
const SCROLL_SPEED = 6;

/** Cuts the corners of a cell-by-cell route so the dots curve like the ride does. */
function curve(points: Point[]): Point[] {
  let out = points;
  for (let pass = 0; pass < 2 && out.length > 2; pass++) {
    const next: Point[] = [out[0]];
    for (let i = 0; i < out.length - 1; i++) {
      const [ax, ay] = out[i];
      const [bx, by] = out[i + 1];
      next.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
    }
    next.push(out[out.length - 1]);
    out = next;
  }
  return out;
}

/**
 * The adventure map: turns clicks into rules actions, animates the ride between the cells the
 * rules move the hero through, and shows whatever the rules' events say happened.
 */
export class AdventureController implements Screen {
  readonly name = 'adventure';
  state: GameState;
  readonly map: MapModel;
  readonly scene: AdventureScene;
  private readonly display: Display;
  private readonly cards: CardView;
  private readonly label = new HoverLabel();
  private route: number[] = [];
  /** Where the current ride is going, to find the way again when enemies move. */
  private target: Point | null = null;
  /** Enemy sprites walking their night's path. */
  private readonly walks = new Walks();
  private visiting: string | null = null;
  /** Where the hero is drawn; it chases his cell in the rules. */
  private readonly drawn: { x: number; y: number };
  private travelled = 0;
  private sinceDust = 0;
  private follow = false;
  private tiredShown = false;
  private cardAnchor: Point | null = null;
  private hudMovement = -1;
  private readonly speed: number;
  /** Called when the rules start a battle; the game switches screens. */
  onBattle: (() => void) | null = null;
  /** Called when the hero rides to court after a won commission. */
  onCourt: (() => void) | null = null;
  /** Called when a new commission begins (maybe in a new province), with the events still to show. */
  onCommission: ((state: GameState, rest: GameEvent[]) => void) | null = null;

  constructor(display: Display, map: MapModel, state: GameState, speed = 1) {
    this.display = display;
    this.map = map;
    this.state = state;
    this.speed = RIDE_SPEED * speed;
    this.scene = buildAdventureScene(map, state);
    this.cards = new CardView((action) => this.choose(action));
    this.drawn = { x: state.hero.at[0], y: state.hero.at[1] };
    const tower = state.locations.find((l) => l.kind === 'tower');
    if (tower) this.scene.view.effects.addFlock([tower.at[0], tower.at[1] - 84], 6, 1);
    for (const [i, home] of (map.province.flocks ?? []).entries()) this.scene.view.effects.addFlock(home, 5, 4 + i);
    this.scene.view.centreOn(state.hero.at[0] + 40, state.hero.at[1] - 70);
    this.repaintHud();
  }

  get view() {
    return this.scene.view;
  }

  render(tick: number): Uint8Array {
    return this.view.compose(tick).data;
  }

  get bitmap() {
    return this.view.screen;
  }

  placeCards() {
    this.placeCard();
  }

  /** Takes this screen's cards and labels off the page, when a new province replaces it. */
  dispose() {
    this.cards.dispose();
    this.label.dispose();
  }

  showCard(card: Card, at: Point | null) {
    this.cardAnchor = at;
    this.cards.show(card);
  }

  hideCard() {
    this.cards.hide();
  }

  // --- The rules --------------------------------------------------------------------------

  private run(result: Result | null) {
    if (!result) return;
    const gold = this.state.gold;
    this.state = result.state;
    if (this.state.gold > gold) play('coins');
    this.handle(result.events);
    saveGame(this.state);
  }

  /** Shows events that happened elsewhere, like the arrival card of a new commission. */
  play(events: GameEvent[]) {
    this.handle(events);
  }

  private handle(events: GameEvent[]) {
    for (const [i, e] of events.entries()) {
      switch (e.type) {
        case 'court':
          this.hideCard();
          this.onCourt?.();
          return;
        case 'commission':
          this.hideCard();
          this.onCommission?.(this.state, events.slice(i + 1));
          return;
        case 'card':
          this.showCard(e.card, e.place ? this.anchorOf(e.place) : e.at);
          break;
        case 'reveal':
          this.scene.fog.reveal(this.state.explored, e.at[0], e.at[1], e.radius);
          break;
        case 'added':
          addPlace(this.scene, locationById(this.state, e.id));
          break;
        case 'removed': {
          const object = this.scene.pickups.get(e.id);
          if (object) this.view.remove(object);
          this.scene.pickups.delete(e.id);
          break;
        }
        case 'day':
          this.tiredShown = false;
          play('day');
          break;
        case 'levelUp':
          play('levelUp');
          break;
        case 'battle':
          this.hideCard();
          this.onBattle?.();
          break;
        case 'moved':
          this.drawn.x = e.at[0];
          this.drawn.y = e.at[1];
          break;
        case 'enemyMoved':
          {
            const object = this.scene.pickups.get(e.id);
            if (object) this.walks.start(e.id, object, this.scene.hitboxes.find((b) => b.id === e.id), e.from, e.path);
          }
          // Somebody may be standing on the road now: find the way again.
          if (this.target) this.replan();
          break;
        case 'over':
          play(e.result === 'won' ? 'victory' : 'defeat');
          break;
      }
    }
    this.repaintHud();
  }

  private repaintHud() {
    this.hudMovement = Math.floor(this.state.movement);
    paintHud(this.view.frame, this.state);
  }

  /** Keeps the battle in the saved state as it goes. */
  updateBattle(battle: BattleState) {
    this.state = { ...this.state, battle };
    saveGame(this.state);
  }

  /** Back from the battlefield: the rules settle survivors and rewards, and the card says how it went. */
  finishBattle(battle: BattleState) {
    this.run(finishFight({ ...this.state, battle }));
    this.follow = true;
  }

  choose(action: Action) {
    switch (action.type) {
      case 'close':
        this.hideCard();
        return;
      case 'restart':
        clearSave();
        window.location.reload();
        return;
      case 'go': {
        this.hideCard();
        this.plan(locationById(this.state, action.id).at, action.id);
        return;
      }
      case 'background': {
        this.run(apply(this.state, action));
        this.showCard(storyCard(action.id), null);
        return;
      }
      default: {
        // Whatever the action shows replaces this card; if it shows nothing, the card is done.
        this.hideCard();
        this.run(apply(this.state, action));
      }
    }
  }

  /** Plots a route to `target`. With `visitId`, the hero visits that place when he gets there. */
  plan(target: Point, visitId: string | null) {
    const facing = visitId ? locationById(this.state, visitId) : null;
    const route = planRoute(this.state, this.map, target, Boolean(facing?.enemy && !facing.done));
    if (!route) {
      this.showCard({ title: 'No way through', lines: ['Not even a goat could get there from here.'], choices: [] }, target);
      return;
    }
    this.route = route;
    this.target = route.length ? target : null;
    this.visiting = visitId;
    this.follow = true;
    this.tiredShown = false;
    if (route.length === 0 && visitId) this.arrive();
  }

  /** Finds the way to the same place again, keeping what the hero means to do there. */
  private replan() {
    const facing = this.visiting ? locationById(this.state, this.visiting) : null;
    const route = this.target && planRoute(this.state, this.map, facing?.enemy && !facing.done ? facing.at : this.target, Boolean(facing?.enemy && !facing.done));
    if (route) this.route = route;
    else {
      this.route = [];
      this.visiting = null;
      this.target = null;
    }
  }

  private arrive() {
    const id = this.visiting!;
    this.visiting = null;
    this.target = null;
    this.run(visit(this.state, id));
  }

  // --- Each frame -------------------------------------------------------------------------

  /**
   * Choices that must be made wait on screen: the hero's background first, then any level-ups.
   * Once a commission is over, what comes next (court, or trying again) comes back if hidden.
   */
  private promptPending() {
    if (this.cards.isOpen) return;
    if (this.state.ambush) {
      const foe = locationById(this.state, this.state.ambush);
      return this.showCard(ambushCard(this.state), this.anchorOf(foe.id));
    }
    const card = this.state.over ? endCard(this.state) : this.state.opening ? backgroundCard() : levelUpCard(this.state);
    if (card) this.showCard(card, null);
  }

  update(dt: number, held: ReadonlySet<string>) {
    this.promptPending();
    this.walks.advance(dt);
    const dx = (held.has('arrowright') || held.has('d') ? 1 : 0) - (held.has('arrowleft') || held.has('a') ? 1 : 0);
    const dy = (held.has('arrowdown') || held.has('s') ? 1 : 0) - (held.has('arrowup') || held.has('w') ? 1 : 0);
    if (dx || dy) {
      this.follow = false;
      this.view.scrollTo(this.view.camera.x + dx * SCROLL_SPEED, this.view.camera.y + dy * SCROLL_SPEED);
    }
    this.ride(dt);
    const { hero } = this.scene;
    this.view.effects.update(dt, [this.drawn.x, this.drawn.y]);
    const walking = this.isRiding();
    const facing = this.state.hero.facing;
    hero.object.frames = walking ? (facing > 0 ? hero.walk : hero.walkLeft) : facing > 0 ? hero.idle : hero.idleLeft;
    hero.object.frame = walking ? Math.floor(this.travelled / STRIDE) : undefined;
    hero.object.x = this.drawn.x - hero.idle[0].width / 2;
    hero.object.y = this.drawn.y - hero.foot;
    this.view.route = this.route.length > 0 ? this.routeDots() : [];
    if (this.follow) {
      const tx = this.drawn.x - MAP_VIEW.width / 2;
      const ty = this.drawn.y - MAP_VIEW.height / 2 - 20;
      const k = Math.min(1, dt * 2.5);
      this.view.scrollTo(this.view.camera.x + (tx - this.view.camera.x) * k, this.view.camera.y + (ty - this.view.camera.y) * k);
      if (!walking && Math.hypot(tx - this.view.camera.x, ty - this.view.camera.y) < 2) this.follow = false;
    }
    if (Math.floor(this.state.movement) !== this.hudMovement) this.repaintHud();
  }

  /** Trotting only while the drawn hero is actually on the move, not while a tired route waits. */
  private isRiding() {
    const [x, y] = this.state.hero.at;
    return Math.hypot(x - this.drawn.x, y - this.drawn.y) > 0.5;
  }

  /** Moves the drawn hero towards his cell, and steps the rules on as soon as he gets close. */
  private ride(dt: number) {
    let budget = this.speed * dt;
    for (let guard = 0; guard < 64 && budget > 0; guard++) {
      const [tx, ty] = this.state.hero.at;
      const d = Math.hypot(tx - this.drawn.x, ty - this.drawn.y);
      if (d < 2.5 && this.route.length > 0) {
        const step = stepAlong(this.state, this.map, this.route);
        if (step) {
          this.state = step.state;
          this.route = this.route.slice(1);
          this.handle(step.events.filter((e) => e.type !== 'moved'));
          continue;
        }
        if (!this.tiredShown) {
          this.tiredShown = true;
          saveGame(this.state);
          this.showCard(
            { title: 'Your horse is spent', lines: ['End the day to rest. Red marks are for tomorrow.'], choices: [{ label: 'End the day', action: { type: 'endDay' } }] },
            [this.drawn.x, this.drawn.y - this.scene.hero.foot],
          );
        }
      }
      if (d === 0) break;
      const move = Math.min(d, budget);
      this.drawn.x += ((tx - this.drawn.x) / d) * move;
      this.drawn.y += ((ty - this.drawn.y) / d) * move;
      budget -= move;
      this.travelled += move;
      this.sinceDust += move;
      if (this.sinceDust > 7 && this.map.grid.cost[Math.floor(ty / 8) * this.map.width + Math.floor(tx / 8)] === 1) {
        this.sinceDust = 0;
        this.view.effects.dust(this.drawn.x - this.state.hero.facing * 12, this.drawn.y - 1, this.state.hero.facing);
      }
    }
    const [x, y] = this.state.hero.at;
    if (this.route.length === 0 && this.visiting && Math.hypot(x - this.drawn.x, y - this.drawn.y) < 0.5) {
      saveGame(this.state);
      this.arrive();
    }
  }

  /** Dots every 10 pixels along the road ahead, gold while today's movement lasts. */
  private routeDots() {
    const costs = routeCosts(this.state, this.map, this.route);
    const points = curve([[this.drawn.x, this.drawn.y], ...this.route.map((i) => cellCentre(this.map, i))]);
    const dots: { at: Point; today: boolean }[] = [];
    let carry = -14;
    for (let i = 1; i < points.length; i++) {
      const [ax, ay] = points[i - 1];
      const [bx, by] = points[i];
      const d = Math.hypot(bx - ax, by - ay);
      const cellIndex = Math.min(costs.length - 1, Math.floor(((i - 1) / (points.length - 1)) * costs.length));
      const today = costs[cellIndex] <= this.state.movement;
      for (let t = 10 - carry; t <= d; t += 10) dots.push({ at: [Math.round(ax + ((bx - ax) * t) / d), Math.round(ay + ((by - ay) * t) / d)], today });
      carry = (carry + d) % 10;
    }
    return dots;
  }

  /** Keeps the open card hanging above whatever it describes. */
  placeCard() {
    const a = this.cardAnchor;
    const point = a && this.display.toPage(MAP_VIEW.x + a[0] - this.view.camera.x, MAP_VIEW.y + a[1] - this.view.camera.y);
    this.cards.place(point, this.display.toPage(0, MAP_VIEW.y).y, this.display.toPage(0, MAP_VIEW.y + MAP_VIEW.height).y);
  }

  // --- Input ------------------------------------------------------------------------------

  /** The place (or the hero) under a map point, front-most first. */
  private under([x, y]: Point): { id: string; name: string; box?: Hitbox; fogged?: boolean } | null {
    const h = this.scene.hero.object;
    const width = this.scene.hero.idle[0].width;
    if (x >= h.x + 6 && x < h.x + width - 6 && y >= h.y + 4 && y < h.y + this.scene.hero.foot + 4) return { id: 'hero', name: BACKGROUNDS[this.state.hero.background].short };
    const gone = (id: string) => {
      const l = this.state.locations.find((p) => p.id === id);
      return !!l && l.done && (l.kind === 'chest' || l.kind === 'gold' || l.kind === 'patrol');
    };
    const hits = this.scene.hitboxes.filter((b) => x >= b.x0 && x < b.x1 && y >= b.y0 && y < b.y1 && !gone(b.id));
    if (hits.length === 0) return null;
    const box = hits.reduce((front, b) => (b.y1 > front.y1 ? b : front));
    const fogged = this.view.isFogged((box.x0 + box.x1) / 2, box.y1 - 4);
    return { id: box.id, name: fogged ? 'Unexplored' : locationById(this.state, box.id).name, box, fogged };
  }

  private anchorOf(id: string): Point {
    const box = this.scene.hitboxes.find((b) => b.id === id);
    if (!box) return locationById(this.state, id).at;
    return [(box.x0 + box.x1) / 2, box.y0 + 4];
  }

  /** A click on the map, in map pixels: the hero, a place, or open ground to ride to. */
  clickMap(point: Point) {
    if (this.state.over || this.state.opening || this.state.ambush) return;
    const thing = this.under(point);
    if (thing?.id === 'hero') {
      this.showCard(describeHero(this.state), [this.drawn.x, this.scene.hero.object.y + 6]);
    } else if (thing?.box && thing.fogged) {
      this.showCard(
        { title: 'Unexplored', lines: ['You cannot see what lies there.'], choices: [{ label: 'Ride there', action: { type: 'go', id: thing.id } }, { label: 'Close', action: { type: 'close' } }] },
        this.anchorOf(thing.id),
      );
    } else if (thing?.box) {
      this.showCard(describe(this.state, thing.id), this.anchorOf(thing.id));
    } else {
      this.hideCard();
      this.plan(point, null);
    }
  }

  /** Handlers for `Input`: screen pixels in. */
  readonly input = {
    click: (x: number, y: number) => {
      const onHourglass = x >= HOURGLASS_AT.x - 3 && x < HOURGLASS_AT.x + HOURGLASS.width + 3 && y >= HOURGLASS_AT.y - 3 && y < HOURGLASS_AT.y + HOURGLASS.height + 3;
      if (onHourglass && !this.state.opening && !this.state.over && !this.state.ambush) return this.choose({ type: 'endDay' });
      const point = this.view.toMap(x, y);
      if (point) this.clickMap(point);
    },
    hover: (x: number, y: number, clientX: number, clientY: number) => {
      const point = this.view.toMap(x, y);
      const thing = point ? this.under(point) : null;
      this.display.canvas.style.cursor = thing ? 'pointer' : 'default';
      if (thing) this.label.show(thing.name, clientX, clientY);
      else this.label.hide();
    },
    drag: (dx: number, dy: number) => {
      this.follow = false;
      this.view.scrollTo(this.view.camera.x - dx, this.view.camera.y - dy);
    },
    leave: () => this.label.hide(),
    key: (key: string) => {
      if (this.state.opening) return;
      if (key === 'e' && !this.state.over && !this.state.ambush) this.choose({ type: 'endDay' });
      else if (key === 'escape') this.hideCard();
      else if (key.startsWith('arrow') || 'wasd'.includes(key)) this.follow = false;
    },
  } satisfies ConstructorParameters<typeof Input>[1];

  /** Hooks for scripted play-throughs and checks. */
  debug() {
    return {
      click: (x: number, y: number) => this.clickMap([x, y]),
      choose: (label: string) => {
        const button = [...document.querySelectorAll<HTMLButtonElement>('.kc-card-wrap:not([hidden]) .kc-card button')].find((b) => b.textContent?.startsWith(label));
        button?.click();
        return Boolean(button);
      },
      state: () => this.state,
      idle: () => this.route.length === 0 || !stepAlong(this.state, this.map, this.route),
      status: () => ({
        riding: this.route.length > 0,
        visiting: this.visiting,
        movement: this.state.movement,
        tired: this.route.length > 0 && !stepAlong(this.state, this.map, this.route),
      }),
      centre: (id: string): Point => {
        const box = this.scene.hitboxes.find((b) => b.id === id)!;
        return [(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2 + 6];
      },
      hover: () => this.label.text,
      frameHash: () => {
        let h = 0x811c9dc5;
        for (const v of this.view.screen.data) h = Math.imul(h ^ v, 0x01000193);
        return (h >>> 0).toString(16);
      },
    };
  }
}
