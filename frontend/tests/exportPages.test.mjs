import test from 'node:test';
import assert from 'node:assert/strict';
import { exportPages } from '../src/utils/exportPages.ts';

test('export preserves mixed page rotations and image order without mutating pages', () => {
  const pages = [90, 0, 270, 180].map((rotation, index) =>
    Object.freeze({ processedImage: `image-${index}`, rotation }));
  const result = exportPages(pages);
  assert.deepEqual(result, {
    images: ['image-0', 'image-1', 'image-2', 'image-3'],
    rotations: [90, 0, 270, 180],
  });
  assert.deepEqual(exportPages(pages), result, 'retry must not apply a second rotation');
});

test('legacy pages without rotation export unrotated', () => {
  assert.deepEqual(exportPages([{ processedImage: 'old-page' }]), {
    images: ['old-page'], rotations: [0],
  });
});
