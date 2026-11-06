export type Point = { x: number; y: number };
export type Quad = readonly [Point, Point, Point, Point];
export type Rectangle = { left: number; top: number; width: number; height: number };

const cross = (a: Point, b: Point, c: Point) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

// Maps the square calibration image into the measured footprint on the wall.
export function calibrate(corners: Quad) {
  if (corners.some(({ x, y }) => !Number.isFinite(x) || !Number.isFinite(y) ||
    x < 0 || x > 1 || y < 0 || y > 1)) return null;

  // In screen coordinates, ordered TL, TR, BR, BL corners turn clockwise.
  if (corners.some((p, i) => cross(p, corners[(i + 1) % 4], corners[(i + 2) % 4]) <= 0.0001)) {
    return null;
  }

  const [a, b, c, d] = corners;
  const dx1 = b.x - c.x, dx2 = d.x - c.x, dx3 = a.x - b.x + c.x - d.x;
  const dy1 = b.y - c.y, dy2 = d.y - c.y, dy3 = a.y - b.y + c.y - d.y;
  const determinant = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / determinant;
  const h = (dx1 * dy3 - dx3 * dy1) / determinant;

  return (x: number, y: number): Point => {
    const w = g * x + h * y + 1;
    return {
      x: ((b.x - a.x + g * b.x) * x + (d.x - a.x + h * d.x) * y + a.x) / w,
      y: ((b.y - a.y + g * b.y) * x + (d.y - a.y + h * d.y) * y + a.y) / w,
    };
  };
}

// Fit an upright, aspect-preserving rectangle about the mean of the four
// corners. For each edge, constrain the rectangle corner nearest that edge.
export function fitArtwork(corners: Quad, aspect: number): Rectangle {
  const center = corners.reduce((p, c) => ({ x: p.x + c.x / 4, y: p.y + c.y / 4 }), { x: 0, y: 0 });
  const halfHeight = Math.min(...corners.map((a, i) => {
    const b = corners[(i + 1) % 4];
    return cross(a, b, center) / (Math.abs(b.y - a.y) * aspect + Math.abs(b.x - a.x));
  }));
  const halfWidth = halfHeight * aspect;
  return { left: center.x - halfWidth, top: center.y - halfHeight, width: 2 * halfWidth, height: 2 * halfHeight };
}
