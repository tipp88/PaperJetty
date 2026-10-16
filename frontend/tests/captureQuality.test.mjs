import test from 'node:test';
import assert from 'node:assert/strict';
import { TemporalFilter } from '../src/utils/temporalFilter.ts';
import { cornerMotion, documentSharpness, preferCaptureFrame } from '../src/utils/captureQuality.ts';
import { scaleFrameCorners } from '../src/utils/frameDetection.ts';

const corners = (x = 0, scale = 1) => ({
  topLeft: { x: (100 + x) * scale, y: 100 * scale },
  topRight: { x: (1100 + x) * scale, y: 100 * scale },
  bottomRight: { x: (1100 + x) * scale, y: 1600 * scale },
  bottomLeft: { x: (100 + x) * scale, y: 1600 * scale }, confidence: 0.95,
});

test('translation is not stable even when document area never changes', () => {
  const filter = new TemporalFilter(5);
  for (const x of [0, 150, 300, 450, 600]) filter.update(corners(x));
  assert.equal(filter.isStable(), false);
  assert.equal(filter.getStability(), 0);
});

test('minor hand jitter is accepted at different resolutions', () => {
  for (const scale of [0.25, 1, 2]) {
    const filter = new TemporalFilter(5);
    for (const x of [0, 2, -2, 3, 0]) filter.update(corners(x, scale));
    assert.equal(filter.isStable(), true);
    assert.ok(filter.getStability() >= 0.6);
  }
  assert.equal(cornerMotion(corners(), corners(10)), cornerMotion(corners(0, 2), corners(10, 2)));
});

test('slow accumulated drift and rotation invalidate stability', () => {
  const filter = new TemporalFilter(5);
  for (const x of [0, 10, 20, 30, 40]) filter.update(corners(x));
  assert.equal(filter.isStable(), false);
  filter.reset();
  for (let i = 0; i < 4; i++) filter.update(corners());
  const rotated = corners();
  rotated.topLeft.x += 80;
  rotated.topRight.y += 80;
  filter.update(rotated);
  assert.equal(filter.isStable(), false);
});

test('lost detection immediately blocks capture and recovery needs fresh history', () => {
  const filter = new TemporalFilter(5);
  for (let i = 0; i < 5; i++) filter.update(corners());
  assert.equal(filter.isStable(), true);
  assert.ok(filter.update(null), 'overlay may retain its previous position');
  assert.equal(filter.isStable(), false);
  filter.update(corners());
  assert.equal(filter.isStable(), false);
  for (let i = 0; i < 3; i++) filter.update(corners());
  assert.equal(filter.isStable(), true);
});

function pixels(width, height, value) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = (y * width + x) * 4;
    data.fill(value(x, y), offset, offset + 3);
    data[offset + 3] = 255;
  }
  return data;
}

test('sharp text-like strokes score higher than blurred versions', () => {
  const w = 120, h = 160;
  const stroke = (x, y) => x % 13 < 3 && y % 17 < 9 ? 30 : 230;
  const sharp = pixels(w, h, stroke);
  const blurred = pixels(w, h, (x, y) => {
    let sum = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) sum += stroke(x + dx, y + dy);
    return sum / 25;
  });
  const sharpScore = documentSharpness(sharp, w, h, null);
  const blurredScore = documentSharpness(blurred, w, h, null);
  assert.ok(sharpScore > blurredScore * 3, `${sharpScore} vs ${blurredScore}`);
  assert.equal(documentSharpness(pixels(w, h, () => 230), w, h, null), 0);
});

test('sharp page border and textured background cannot qualify a blank page', () => {
  const w = 160, h = 160;
  const page = { topLeft: { x: 30, y: 30 }, topRight: { x: 130, y: 30 }, bottomRight: { x: 130, y: 130 }, bottomLeft: { x: 30, y: 130 }, confidence: 1 };
  const data = pixels(w, h, (x, y) => x > 30 && x < 130 && y > 30 && y < 130 ? 230 : (x + y) % 3 * 100);
  assert.equal(documentSharpness(data, w, h, page), 0);
});

test('selection rejects moving/blank/missing pages automatically but allows manual fallback', () => {
  const good = { corners: corners(), sharpness: 100, motion: 0.002, width: 2000, height: 2200 };
  const blurry = { ...good, sharpness: 0.2 };
  const moving = { ...good, sharpness: 150, motion: 0.2 };
  const unknown = { ...good, corners: null };
  for (const frame of [blurry, moving, unknown]) {
    assert.equal(preferCaptureFrame(frame, null, true), false);
    assert.equal(preferCaptureFrame(frame, null, false), true);
    assert.equal(preferCaptureFrame(frame, good, false), false);
  }
  assert.equal(preferCaptureFrame(good, blurry, false), true);
  assert.equal(preferCaptureFrame({ ...good, sharpness: 200 }, good, true), true);
  assert.equal(preferCaptureFrame({ ...good, corners: corners(-200) }, null, true), false);
});

test('corner scaling keeps native capture coordinates, including rounded analysis sizes', () => {
  const page = corners();
  const scaled = scaleFrameCorners(page, 0.125, 0.126);
  const restored = scaleFrameCorners(scaled, 8, 1 / 0.126);
  for (const key of ['topLeft', 'topRight', 'bottomRight', 'bottomLeft']) {
    assert.ok(Math.abs(restored[key].x - page[key].x) < 1e-9);
    assert.ok(Math.abs(restored[key].y - page[key].y) < 1e-9);
  }
});
