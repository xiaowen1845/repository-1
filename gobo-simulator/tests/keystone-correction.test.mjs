import assert from "node:assert/strict";
import { test } from "node:test";
import { calibrate, convertDistance, fitArtwork, normalizeFootprint, projectInstallation } from "../app/keystone-correction/geometry.ts";
import { renderArtwork } from "../app/keystone-correction/render.ts";

const square = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
const trapezoid = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.8, y: 1 }, { x: 0.2, y: 1 }];

test("calibration maps the four projector corners and preserves projective geometry", () => {
  const { toWall } = calibrate(trapezoid);
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
  renderArtwork(context, source, toWall, target);
  return output;
}

test("square calibration preserves square artwork including transparent pixels", () => {
  const data = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 255, 0, 0, 0, 0]);
  assert.deepEqual(render(2, 2, { width: 2, height: 2, data },
    calibrate(square).toWall, fitArtwork(square, 1)), data);
});

test("a narrowing wall footprint requires a widening correction on the projector", () => {
  const size = 101;
  const data = new Uint8ClampedArray([255, 255, 255, 255]);
  const output = render(size, size, { width: 1, height: 1, data }, calibrate(trapezoid).toWall, fitArtwork(trapezoid, 1));
  const opaquePixels = row => output.filter((alpha, i) =>
    i >= row * size * 4 && i < (row + 1) * size * 4 && i % 4 === 3 && alpha === 255).length;
  assert.ok(opaquePixels(20) > 0);
  assert.ok(opaquePixels(70) > opaquePixels(20));
  assert.equal(output[3], 0);
});

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

test("a perpendicular installation uses the Simulator's width-to-distance lens convention", () => {
  const projection = projectInstallation({ x: 0, y: 0, z: 4, widthRatio: 0.5 });
  close(projection.distance, 4);
  close(projection.width, 2);
  close(projection.height, 2);
  close(projection.corners[0].x, 0.05);
  close(projection.corners[0].y, 0.05);
});

test("combined installation offsets preserve the optical aim point", () => {
  const { corners, distance } = projectInstallation({ x: 1, y: 2, z: 4, widthRatio: 0.5 });
  close(distance, Math.sqrt(21));
  const aim = calibrate(corners).toWall(0.5, 0.5);
  close(aim.x, 0.5);
  close(aim.y, 0.5);
  const target = fitArtwork(corners, 1.5, aim);
  close(target.left + target.width / 2, aim.x);
  close(target.top + target.height / 2, aim.y);
});

test("a projector to the right makes the far side of the footprint taller, and vice versa", () => {
  const right = projectInstallation({ x: 2, y: 0, z: 4, widthRatio: 0.5 }).corners;
  const left = projectInstallation({ x: -2, y: 0, z: 4, widthRatio: 0.5 }).corners;
  assert.ok(right[3].y - right[0].y > right[2].y - right[1].y);
  close(right[0].x + left[1].x, 1);
  close(right[0].y, left[1].y);
});

test("a projector above the aim point makes the bottom of the footprint wider", () => {
  const { corners } = projectInstallation({ x: 0, y: 2, z: 4, widthRatio: 0.5 });
  assert.ok(corners[2].x - corners[3].x > corners[1].x - corners[0].x);
});

test("invalid or grazing installations produce no footprint", () => {
  for (const installation of [
    { x: 0, y: 0, z: 0, widthRatio: 0.5 },
    { x: 0, y: 0, z: 4, widthRatio: 0 },
    { x: NaN, y: 0, z: 4, widthRatio: 0.5 },
    { x: 4, y: 0, z: 1, widthRatio: 0.5 },
  ]) assert.equal(projectInstallation(installation), null);
});

test("the wall preview maps measured corners and interior pixels back to projector coordinates", () => {
  const { toWall, toProjector } = calibrate(trapezoid);
  for (const { x, y } of [...square, { x: 0.24, y: 0.81 }]) {
    const wall = toWall(x, y);
    const source = toProjector(wall.x, wall.y);
    close(source.x, x);
    close(source.y, y);
  }
});

test("the uncorrected wall preview tapers while the corrected preview stays rectangular", () => {
  const size = 100;
  const source = { width: 1, height: 1, data: new Uint8ClampedArray([255, 255, 255, 255]) };
  const before = render(size, size, source, calibrate(trapezoid).toProjector, fitArtwork(square, 1));
  const after = render(size, size, source, (x, y) => ({ x, y }), fitArtwork(trapezoid, 1));
  const opaqueWidth = (pixels, row) =>
    pixels.slice(row * size * 4, (row + 1) * size * 4).filter((value, i) => i % 4 === 3 && value === 255).length;

  assert.ok(opaqueWidth(before, 25) > opaqueWidth(before, 75));
  assert.ok(opaqueWidth(after, 25) > 0);
  assert.equal(opaqueWidth(after, 25), opaqueWidth(after, 75));
});

test("measured calibration centers the upright artwork on the projected center cross", () => {
  const center = calibrate(trapezoid).toWall(0.5, 0.5);
  const target = fitArtwork(trapezoid, 1, center);
  close(target.left + target.width / 2, 0.5);
  close(target.top + target.height / 2, 0.625);
  assert.ok(target.top + target.height <= 1);
});

test("metres and inches preserve signed offsets and the projected footprint", () => {
  assert.equal(convertDistance(1, "in", "m"), 0.0254);
  close(convertDistance(-0.6, "m", "in"), -23.62204724409449);
  const metres = { x: -0.6, y: 0.4, z: 3, widthRatio: 0.5 };
  const roundTrip = value => convertDistance(convertDistance(value, "m", "in"), "in", "m");
  const original = projectInstallation(metres);
  const converted = projectInstallation({
    x: roundTrip(metres.x), y: roundTrip(metres.y), z: roundTrip(metres.z), widthRatio: metres.widthRatio,
  });
  close(converted.width, original.width);
  close(converted.height, original.height);
  close(converted.distance, original.distance);
});

test("measured offsets share one origin and one scale in metres or inches", () => {
  const points = [{ x: -0.66, y: 0.55 }, { x: 0.54, y: 0.45 }, { x: 0.54, y: -0.45 }, { x: -0.66, y: -0.55 }];
  const corners = normalizeFootprint(points);
  const inches = normalizeFootprint(points.map(({ x, y }) =>
    ({ x: convertDistance(x, "m", "in"), y: convertDistance(y, "m", "in") })));
  assert.ok(corners[0].x < 0.5 && corners[0].y < 0.5);
  corners.forEach(({ x, y }, i) => {
    close(x, inches[i].x);
    close(y, inches[i].y);
  });
  const center = calibrate(corners).toWall(0.5, 0.5);
  close(center.x, 0.5);
  close(center.y, 0.5);
});

test("measured offsets reject crossed corners and an origin outside the projection", () => {
  assert.equal(normalizeFootprint([square[0], square[2], square[1], square[3]]), null);
  assert.equal(normalizeFootprint([{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 1 }, { x: 1, y: 1 }]), null);
});
