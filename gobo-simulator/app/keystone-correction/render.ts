import type { Point, Rectangle } from "./geometry";

export const OUTPUT_SIZE = 1024;

function sample(source: ImageData, x: number, y: number, output: Uint8ClampedArray, offset: number) {
  const { width, height, data } = source;
  const sx = Math.max(0, Math.min(width - 1, x * width - 0.5));
  const sy = Math.max(0, Math.min(height - 1, y * height - 0.5));
  const left = Math.floor(sx), top = Math.floor(sy);
  const right = Math.min(left + 1, width - 1), bottom = Math.min(top + 1, height - 1);
  const fx = sx - left, fy = sy - top;
  const tl = (top * width + left) * 4, tr = (top * width + right) * 4;
  const bl = (bottom * width + left) * 4, br = (bottom * width + right) * 4;
  // Weight colors by opacity so transparent edges don't acquire dark fringes.
  const a = (1 - fx) * (1 - fy) * data[tl + 3];
  const b = fx * (1 - fy) * data[tr + 3];
  const c = (1 - fx) * fy * data[bl + 3];
  const d = fx * fy * data[br + 3];
  const alpha = a + b + c + d;
  if (!alpha) return;

  for (let channel = 0; channel < 3; channel++) {
    output[offset + channel] = (
      data[tl + channel] * a + data[tr + channel] * b +
      data[bl + channel] * c + data[br + channel] * d
    ) / alpha;
  }
  output[offset + 3] = alpha;
}

export function renderArtwork(
  context: CanvasRenderingContext2D,
  artwork: ImageData,
  mapToReference: (x: number, y: number) => Point,
  target: Rectangle,
) {
  const { width, height } = context.canvas;
  const output = context.createImageData(width, height);
  // Map each output pixel into the artwork's reference frame. Pixels outside
  // the artwork rectangle stay transparent.
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      const point = mapToReference((column + 0.5) / width, (row + 0.5) / height);
      const x = (point.x - target.left) / target.width;
      const y = (point.y - target.top) / target.height;
      if (x >= 0 && x < 1 && y >= 0 && y < 1) {
        sample(artwork, x, y, output.data, (row * width + column) * 4);
      }
    }
  }
  context.putImageData(output, 0, 0);
}

export function downloadPng(canvas: HTMLCanvasElement, filename: string) {
  return new Promise<void>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Could not create PNG."));
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      resolve();
    }, "image/png");
  });
}
