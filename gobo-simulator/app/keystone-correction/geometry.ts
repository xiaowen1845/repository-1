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

  const ax = b.x - a.x + g * b.x;
  const bx = d.x - a.x + h * d.x;
  const ay = b.y - a.y + g * b.y;
  const by = d.y - a.y + h * d.y;

  return {
    toWall(x: number, y: number): Point {
      const w = g * x + h * y + 1;
      return { x: (ax * x + bx * y + a.x) / w, y: (ay * x + by * y + a.y) / w };
    },
    toProjector(x: number, y: number): Point {
      // Solve the two linear equations obtained by clearing the denominators.
      const m = ax - g * x, n = bx - h * x;
      const p = ay - g * y, q = by - h * y;
      const dx = x - a.x, dy = y - a.y;
      const det = m * q - n * p;
      return { x: (dx * q - n * dy) / det, y: (m * dy - dx * p) / det };
    },
  };
}

// For each edge, constrain the artwork corner nearest that edge.
export function fitArtwork(
  corners: Quad,
  aspect: number,
  center = corners.reduce((p, c) => ({ x: p.x + c.x / 4, y: p.y + c.y / 4 }), { x: 0, y: 0 }),
): Rectangle {
  const halfHeight = Math.min(...corners.map((a, i) => {
    const b = corners[(i + 1) % 4];
    return cross(a, b, center) / (Math.abs(b.y - a.y) * aspect + Math.abs(b.x - a.x));
  }));
  const halfWidth = halfHeight * aspect;
  return { left: center.x - halfWidth, top: center.y - halfHeight, width: 2 * halfWidth, height: 2 * halfHeight };
}

export type Installation = { x: number; y: number; z: number; widthRatio: number };
type Vector = readonly [number, number, number];
const IMAGE_CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const;

// Model a centered square image on a plane at z = 0, with the optical axis
// aimed at the origin. X points right and Y points up as seen facing the wall.
export function projectInstallation({ x, y, z, widthRatio }: Installation) {
  if (![x, y, z, widthRatio].every(Number.isFinite) || z <= 0 || widthRatio <= 0) return null;

  const horizontalDistance = Math.hypot(x, z);
  const distance = Math.hypot(horizontalDistance, y);
  const forward: Vector = [-x / distance, -y / distance, -z / distance];
  const right: Vector = [z / horizontalDistance, 0, -x / horizontalDistance];
  // Keep the image level by making its horizontal axis parallel to the wall.
  const up: Vector = [right[2] * -forward[1], horizontalDistance / distance, right[0] * forward[1]];
  const halfWidthRatio = widthRatio / 2;
  const footprint = IMAGE_CORNERS.flatMap(([column, row]) => {
    const u = column * halfWidthRatio;
    const v = -row * halfWidthRatio;
    const rayZ = forward[2] + u * right[2] + v * up[2];
    if (!(rayZ < -1e-8)) return [];
    const t = -z / rayZ;
    const wallX = x + t * (forward[0] + u * right[0] + v * up[0]);
    const wallY = y + t * (forward[1] + v * up[1]);
    return [{ x: wallX, y: -wallY }];
  });
  if (footprint.length !== 4) return null;

  const extent = Math.max(...footprint.map(p => Math.max(Math.abs(p.x), Math.abs(p.y))));
  if (!Number.isFinite(extent) || extent <= 0) return null;
  // Use a single scale for both axes and keep the aim point at the grid center.
  const scale = 0.45 / extent;
  const normalize = (index: number) => ({
    x: 0.5 + footprint[index].x * scale,
    y: 0.5 + footprint[index].y * scale,
  });
  const corners: Quad = [normalize(0), normalize(1), normalize(2), normalize(3)];
  if (!calibrate(corners)) return null;

  const xs = footprint.map(p => p.x);
  const ys = footprint.map(p => p.y);
  return {
    corners,
    distance,
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}
