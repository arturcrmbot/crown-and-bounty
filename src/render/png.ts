/** A decoded image: RGBA bytes, row by row. */
export type Rgba = { width: number; height: number; data: Uint8Array };

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Decodes a PNG to its exact stored colours. Browsers would apply the files' gamma and colour
 * chunks when drawing them, which shifts the team-colour pixels off the values they are matched by.
 * Handles 8-bit grey, RGB, grey-alpha and RGBA, and 1- to 8-bit palettes (not 16 bits or interlacing).
 */
export async function decodePng(file: Uint8Array): Promise<Rgba> {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  let width = 0;
  let height = 0;
  let depth = 8;
  let type = 6;
  let palette: Uint8Array = new Uint8Array(0);
  let alpha: Uint8Array = new Uint8Array(0);
  const parts: Uint8Array[] = [];
  for (let at = 8; at < file.length; ) {
    const length = view.getUint32(at);
    const kind = String.fromCharCode(...file.subarray(at + 4, at + 8));
    const body = file.subarray(at + 8, at + 8 + length);
    if (kind === 'IHDR') {
      width = view.getUint32(at + 8);
      height = view.getUint32(at + 12);
      [depth, type] = [body[8], body[9]];
      if (depth === 16 || body[12] !== 0) throw new Error('16-bit and interlaced PNGs are not supported');
    } else if (kind === 'PLTE') palette = body;
    else if (kind === 'tRNS') alpha = body;
    else if (kind === 'IDAT') parts.push(body);
    else if (kind === 'IEND') break;
    at += 12 + length;
  }
  const packed = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  parts.reduce((n, p) => (packed.set(p, n), n + p.length), 0);
  const raw = await inflate(packed);

  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type] ?? 4;
  const bpp = Math.max(1, (channels * depth) >> 3);
  const stride = Math.ceil((width * channels * depth) / 8);
  const rows = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const row = rows.subarray(y * stride, (y + 1) * stride);
    const up = y > 0 ? rows.subarray((y - 1) * stride, y * stride) : new Uint8Array(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? row[i - bpp] : 0;
      const b = up[i];
      const c = i >= bpp ? up[i - bpp] : 0;
      let v = src[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      row[i] = v;
    }
  }

  const data = new Uint8Array(width * height * 4);
  const sample = (y: number, i: number) => {
    if (depth === 8) return rows[y * stride + i];
    const bit = i * depth;
    return (rows[y * stride + (bit >> 3)] >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const s = x * channels;
      if (type === 3) {
        const p = sample(y, x);
        data.set([palette[p * 3], palette[p * 3 + 1], palette[p * 3 + 2], p < alpha.length ? alpha[p] : 255], o);
      } else if (type === 0 || type === 4) {
        const g = depth === 8 ? sample(y, s) : Math.round((sample(y, s) * 255) / ((1 << depth) - 1));
        data.set([g, g, g, type === 4 ? sample(y, s + 1) : 255], o);
      } else data.set([sample(y, s), sample(y, s + 1), sample(y, s + 2), type === 6 ? sample(y, s + 3) : 255], o);
    }
  }
  return { width, height, data };
}
