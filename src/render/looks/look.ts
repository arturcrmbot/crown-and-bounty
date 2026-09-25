export interface Look {
  readonly id: 'a' | 'b';
  readonly label: string;
  /** Applies this look's renderer and light settings. Called when the look becomes active. */
  activate(): void;
  /** Canvas size in device pixels. */
  setSize(width: number, height: number): void;
  render(): void;
  /** One line of look-specific help for the HUD. */
  hint(): string;
}
