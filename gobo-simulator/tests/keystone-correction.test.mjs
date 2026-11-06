import assert from "node:assert/strict";
import { test } from "node:test";
import { calibrate, fitArtwork } from "../app/keystone-correction/geometry.ts";
import { renderCorrection } from "../app/keystone-correction/render.ts";

const square = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
const trapezoid = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.8, y: 1 }, { x: 0.2, y: 1 }];

test("calibration maps the four projector corners and preserves projective geometry", () => {
  const toWall = calibrate(trapezoid);
  square.forEach(({ x, y }, i) => {
    const mapped = toWall(x, y);
    assert.ok(Math.abs(mapped.x - trapezoid[i].x) < 1e-12);
    assert.ok(Math.abs(mapped.y - trapezoid[i].y) < 1e-12);
  });
  assert.ok(Math.abs(toWall(0.5, 0.5).y - 0.625) < 1e-12);
});

test("calibration rejects crossed, concave and collapsed outlines", () => {
  assert.equal(calibrate([square[0], square[2], square[1], square[3]]), null);
  assert.equal(calibrate([square[0], square[1], { x: 0.25, y: 0.25 }, square[3]]), null);
  assert.equal(calibrate([square[0], square[1], square[2], square[2]]), null);
});

test("the target preserves the artwork aspect and fits the measured outline", () => {
  const { left, top, width, height } = fitArtwork(trapezoid, 1.5);
  assert.ok(Math.abs(width / height - 1.5) < 1e-12);
  for (const y of [top, top + height]) {
    assert.ok(left >= 0.2 * y - 1e-12);
    assert.ok(left + width <= 1 - 0.2 * y + 1e-12);
  }
});

function render(width, height, source, toWall, target) {
  let output;
  const context = {
    canvas: { width, height },
    createImageData: () => ({ data: new Uint8ClampedArray(width * height * 4) }),
    putImageData: ({ data }) => { output = data; },
  };
  renderCorrection(context, source, toWall, target);
  return output;
}

test("square calibration preserves square artwork including transparent pixels", () => {
  const data = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 255, 0, 0, 0, 0]);
  assert.deepEqual(render(2, 2, { width: 2, height: 2, data },
    calibrate(square), fitArtwork(square, 1)), data);
});

test("a narrowing wall footprint requires a widening correction on the projector", () => {
  const size = 101;
  const data = new Uint8ClampedArray([255, 255, 255, 255]);
  const output = render(size, size, { width: 1, height: 1, data }, calibrate(trapezoid), fitArtwork(trapezoid, 1));
  const opaquePixels = row => output.filter((alpha, i) =>
    i >= row * size * 4 && i < (row + 1) * size * 4 && i % 4 === 3 && alpha === 255).length;
  assert.ok(opaquePixels(20) > 0);
  assert.ok(opaquePixels(70) > opaquePixels(20));
  assert.equal(output[3], 0);
});
