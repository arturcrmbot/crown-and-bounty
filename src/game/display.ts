/** The canvas: an indexed frame goes in, whole-pixel-scaled RGB comes out. */
export class Display {
  readonly canvas = document.createElement('canvas');
  scale = 1;
  private readonly context: CanvasRenderingContext2D;
  private readonly image: ImageData;
  private readonly pixels: Uint32Array;

  constructor(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
    document.body.append(this.canvas);
    this.context = this.canvas.getContext('2d')!;
    this.image = this.context.createImageData(width, height);
    this.pixels = new Uint32Array(this.image.data.buffer);
    window.addEventListener('resize', () => this.fit());
    this.fit();
  }

  /** Whole-pixel scaling when the window allows it, so every art pixel stays square. */
  private fit() {
    const ratio = Math.min(window.innerWidth / this.canvas.width, window.innerHeight / this.canvas.height);
    this.scale = ratio >= 1 ? Math.floor(ratio) : ratio;
    this.canvas.style.width = `${this.canvas.width * this.scale}px`;
    this.canvas.style.height = `${this.canvas.height * this.scale}px`;
  }

  present(indexed: Uint8Array, palette: Uint32Array) {
    const { pixels } = this;
    for (let i = 0; i < indexed.length; i++) pixels[i] = palette[indexed[i]];
    this.context.putImageData(this.image, 0, 0);
  }

  /** Page coordinates to screen pixels. */
  toScreen(clientX: number, clientY: number): [number, number] {
    const rect = this.canvas.getBoundingClientRect();
    return [(clientX - rect.left) / this.scale, (clientY - rect.top) / this.scale];
  }

  /** Screen pixels to page coordinates. */
  toPage(x: number, y: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: rect.left + x * this.scale, y: rect.top + y * this.scale };
  }
}
