/** Polylines on the map: smoothing and distances, shared by the logical map and the painter. */
export type Point = readonly [number, number];

/** Catmull-Rom curve through the control points. */
export function smooth(points: readonly Point[], steps = 10): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      const at = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
      out.push([at(p0[0], p1[0], p2[0], p3[0]), at(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

/** Distance from (x, y) to a polyline, the distance along it at the closest point, and the side. */
export function nearest(path: readonly Point[], x: number, y: number): { d: number; s: number; side: number } {
  let d = Infinity;
  let s = 0;
  let side = 0;
  let along = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, ay] = path[i];
    const [bx, by] = path[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const length = Math.hypot(dx, dy) || 1e-6;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (length * length)));
    const distance = Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
    if (distance < d) {
      d = distance;
      s = along + t * length;
      side = Math.sign(dx * (y - ay) - dy * (x - ax));
    }
    along += length;
  }
  return { d, s, side };
}

/** Height of a left-to-right line at x, or undefined outside it. */
export function lineAt(line: readonly Point[], x: number): number | undefined {
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, ay] = line[i];
    const [bx, by] = line[i + 1];
    if (x >= ax && x <= bx) return ay + ((x - ax) / (bx - ax)) * (by - ay);
  }
  return undefined;
}
