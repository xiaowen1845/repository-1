import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findProjector, recommendProjector, toMeters, PROJECTORS } from '../lib/projector-rules.ts';
const input = (extra = {}) => ({distanceM:6,diameterM:3,environment:'indoor',light:'dark',...extra});
test('baseline and illumination thresholds', () => {
  assert.equal(findProjector(input()).projector.wattage,50);
  assert.equal(findProjector(input({light:'slightly-dark'})).projector.wattage,100);
  assert.equal(findProjector(input({light:'bright'})).projector.wattage,100);
});
test('an independently entered equivalent ft value gives the same recommendation', () => {
  assert.equal(findProjector(input({distanceM:toMeters(6/0.3048,'ft'),diameterM:toMeters(3/0.3048,'ft')})).projector.id,'indoor-50w');
});
test('indoor-only models are excluded outdoors', () => {
  assert.equal(findProjector(input({environment:'outdoor',distanceM:2,diameterM:1})).projector.id,'outdoor-60w');
});
test('0.3 lens is restricted to high-power models; 0.8 to supported outdoor models', () => {
  assert.ok(PROJECTORS.filter(p=>p.lenses.includes(.3)).every(p=>p.id.startsWith('high-')));
  assert.equal(findProjector(input({distanceM:2,diameterM:.6,lens:.3})).projector.id,'high-160w');
  assert.equal(findProjector(input({distanceM:2,diameterM:1.6,lens:.8})).projector.id,'outdoor-80w');
});
test('small error improvements within the same grade do not force a large power upgrade', () => {
  const result = findProjector(input({distanceM:2,diameterM:.659}));
  assert.equal(result.projector.id,'indoor-35w');
  assert.equal(result.grade,'Good Match');
});
test('suggested distance is revalidated and updates the required model', () => {
  const { result, suggestion } = recommendProjector(input({diameterM:3.4}));
  assert.equal(result.projector.wattage,50);
  assert.equal(suggestion.distanceM,6.8);
  assert.equal(suggestion.match.projector.wattage,100);
});
test('very poor matches, unsupported distances and oversized images request review', () => {
  for (const extra of [{diameterM:.1},{distanceM:31,diameterM:15.5},{diameterM:7}]) assert.equal(findProjector(input(extra)).kind,'manual');
});
test('invalid or missing inputs return no stale recommendation', () => {
  for (const value of [0,-1,NaN,Infinity]) assert.equal(findProjector(input({distanceM:value})).kind,'invalid');
  assert.equal(findProjector(input({diameterM:0})).kind,'invalid');
});
test('15 percent is inclusive; greater errors are not definite recommendations', () => {
  assert.equal(findProjector(input({distanceM:2,diameterM:1/1.15,lens:.5})).kind,'match');
  assert.equal(findProjector(input({distanceM:2,diameterM:1/1.151,lens:.5})).kind,'manual');
});

test('automatic selection matches the target diameter and respects a fixed-lens override', () => {
  const auto = findProjector(input({distanceM:2,diameterM:1.6,light:'dark'}));
  assert.equal(auto.projector.id,'outdoor-80w');
  assert.equal(auto.lens,.8);
  assert.equal(auto.actualM,1.6);
  assert.equal(findProjector(input({distanceM:2,diameterM:1.6,lens:.5})).kind,'manual');
  assert.equal(findProjector(input({distanceM:2,diameterM:.6})).projector.id,'high-160w');
});
test('editing real setup inputs changes the product without carrying over a previous match', () => {
  assert.equal(findProjector(input({distanceM:2,diameterM:1,light:'dark'})).projector.id,'indoor-35w');
  assert.equal(findProjector(input({distanceM:2,diameterM:1,light:'bright'})).projector.id,'indoor-50w');
  assert.equal(findProjector(input({distanceM:2,diameterM:1,environment:'outdoor'})).projector.id,'outdoor-60w');
  for (const diameterM of [0,-1,NaN,Infinity]) assert.equal(findProjector(input({diameterM})).kind,'invalid');
});
