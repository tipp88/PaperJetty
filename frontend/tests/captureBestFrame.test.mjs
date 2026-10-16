import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { scaleFrameCorners } from '../src/utils/frameDetection.ts';

mock.module('../src/utils/frameDetection.ts', {
  namedExports: {
    detectFrameCorners: source => source.sample.corners,
    scaleFrameCorners,
  },
});
const { captureBestFrame } = await import('../src/utils/captureBestFrame.ts');

function setup({ missingCorners = false, blank = false, stalled = false, moving = false, frameStep = 0.1 } = {}) {
  const canvases = [];
  const callbacks = new Map();
  let sequence = 0;
  let encoded = 0;
  const amplitudes = [10, 20, 80, 30, 5, 10, 5];
  const video = {
    videoWidth: 640, videoHeight: 480, currentTime: 0, readyState: 4,
    requestVideoFrameCallback(cb) {
      const id = ++sequence;
      if (stalled) callbacks.set(id, setTimeout(() => {}, 10000));
      if (!stalled) callbacks.set(id, setTimeout(() => {
        callbacks.delete(id);
        video.currentTime += 0.1;
        const dx = moving ? id * 50 : id * frameStep;
        video.sample = {
          id, amplitude: blank ? 0 : amplitudes[Math.min(id - 1, 6)],
          corners: missingCorners ? null : {
            topLeft: { x: 80 + dx, y: 60 }, topRight: { x: 550 + dx, y: 60 },
            bottomRight: { x: 550 + dx, y: 420 }, bottomLeft: { x: 80 + dx, y: 420 }, confidence: 0.95,
          },
        };
        cb();
      }, 2));
      return id;
    },
    cancelVideoFrameCallback(id) {
      clearTimeout(callbacks.get(id));
      callbacks.delete(id);
    },
  };
  return { video, canvases, callbacks, get encoded() { return encoded; }, document: {
    createElement() {
      const canvas = { width: 0, height: 0, sample: null,
        getContext() {
          return {
            drawImage(source) { canvas.sample = source.sample; },
            getImageData() {
              const data = new Uint8ClampedArray(canvas.width * canvas.height * 4);
              for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
                const i = (y * canvas.width + x) * 4;
                const value = 150 + (x % 9 < 3 && y % 11 < 7 ? -canvas.sample.amplitude : canvas.sample.amplitude);
                data.fill(value, i, i + 3);
                data[i + 3] = 255;
              }
              return { data };
            },
          };
        },
        toDataURL(type, quality) {
          encoded++;
          return JSON.stringify({ id: canvas.sample.id, width: canvas.width, height: canvas.height, type, quality });
        },
      };
      canvases.push(canvas);
      return canvas;
    },
  } };
}

function fixture(t, options) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { value() {}, writable: true, configurable: true });
  const env = setup(options);
  globalThis.document = env.document;
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'document', original);
    else delete globalThis.document;
    for (const timer of env.callbacks.values()) clearTimeout(timer);
  });
  return env;
}

test('burst saves the sharpest suitable frame once with its own corners at native resolution', async t => {
  const env = fixture(t);
  const result = await captureBestFrame(env.video, { automatic: true, signal: new AbortController().signal });
  assert.deepEqual(JSON.parse(result.imageData), { id: 3, width: 640, height: 480, type: 'image/jpeg', quality: 0.99 });
  assert.equal(result.corners.topLeft.x, 80.3);
  assert.equal(env.encoded, 1);
  assert.ok(env.canvases.every(c => c.width === 0 && c.height === 0));
  assert.equal(env.callbacks.size, 0);
});

test('manual capture works without OpenCV/document detection and compares detail', async t => {
  const env = fixture(t, { missingCorners: true });
  const result = await captureBestFrame(env.video, { automatic: false, signal: new AbortController().signal });
  assert.equal(JSON.parse(result.imageData).id, 3);
  assert.equal(result.corners, null);
});

test('automatic capture also saves a stationary page with no measurable detail', async t => {
  const env = fixture(t, { blank: true });
  const result = await captureBestFrame(env.video, { automatic: true, signal: new AbortController().signal });
  assert.ok(result);
  assert.equal(env.encoded, 1);
});

test('automatic capture rejects a moving page throughout the burst', async t => {
  const env = fixture(t, { moving: true });
  assert.equal(await captureBestFrame(env.video, { automatic: true, signal: new AbortController().signal }), null);
  assert.equal(env.encoded, 0);
});

test('leaving the camera cancels a burst and releases buffers and callbacks', async t => {
  const env = fixture(t);
  const controller = new AbortController();
  const operation = captureBestFrame(env.video, { automatic: false, signal: controller.signal });
  const timer = setTimeout(() => controller.abort(), 180);
  t.after(() => clearTimeout(timer));
  assert.equal(await operation, null);
  assert.equal(env.encoded, 0);
  assert.equal(env.callbacks.size, 0);
  assert.ok(env.canvases.every(c => c.width === 0 && c.height === 0));
});

test('stalled camera times out without saving an image', async t => {
  const env = fixture(t, { stalled: true });
  assert.equal(await captureBestFrame(env.video, { automatic: true, signal: new AbortController().signal }), null);
  assert.equal(env.encoded, 0);
  assert.equal(env.callbacks.size, 0);
});

test('cancellation while waiting for a decoded frame removes the callback', async t => {
  const env = fixture(t, { stalled: true });
  const controller = new AbortController();
  const operation = captureBestFrame(env.video, { automatic: true, signal: controller.signal });
  const timer = setTimeout(() => controller.abort(), 20);
  t.after(() => clearTimeout(timer));
  assert.equal(await operation, null);
  assert.equal(env.callbacks.size, 0);
  assert.equal(env.encoded, 0);
});

test('fallback browsers cannot count a repeated frame as stationary', async t => {
  const env = fixture(t);
  // Seed one frame, then freeze currentTime with no frame callback API.
  await new Promise(resolve => env.video.requestVideoFrameCallback(resolve));
  delete env.video.requestVideoFrameCallback;
  assert.equal(await captureBestFrame(env.video, { automatic: true, signal: new AbortController().signal }), null);
  assert.equal(env.encoded, 0);
});


test('normal hand drift during the burst still selects the sharpest frame', async t => {
  const env = fixture(t, { frameStep: 10 });
  const result = await captureBestFrame(env.video, { automatic: true, signal: new AbortController().signal });
  assert.equal(JSON.parse(result.imageData).id, 3);
});

test('a stable preview allows a fresh frame when the camera delivers only one sample', async t => {
  const env = fixture(t);
  await new Promise(resolve => env.video.requestVideoFrameCallback(resolve));
  const referenceCorners = env.video.sample.corners;
  const requestFrame = env.video.requestVideoFrameCallback.bind(env.video);
  env.video.requestVideoFrameCallback = callback => requestFrame(() => {
    env.video.requestVideoFrameCallback = () => 999;
    callback();
  });
  const result = await captureBestFrame(env.video, {
    automatic: true, signal: new AbortController().signal, referenceCorners,
  });
  assert.equal(JSON.parse(result.imageData).id, 2);
  assert.equal(result.corners.topLeft.x, 80.2);
});

test('a stable preview does not allow a page that moves before the fresh frame', async t => {
  const env = fixture(t, { moving: true });
  await new Promise(resolve => env.video.requestVideoFrameCallback(resolve));
  const referenceCorners = env.video.sample.corners;
  assert.equal(await captureBestFrame(env.video, {
    automatic: true, signal: new AbortController().signal, referenceCorners,
  }), null);
});

test('frame processing longer than 250 ms does not disqualify a stationary page', async t => {
  const env = fixture(t);
  const realNow = performance.now.bind(performance);
  let offset = 0;
  t.mock.method(performance, 'now', () => realNow() + offset);
  const createElement = env.document.createElement;
  env.document.createElement = () => {
    const canvas = createElement();
    const getContext = canvas.getContext;
    canvas.getContext = () => {
      const ctx = getContext();
      const getImageData = ctx.getImageData;
      ctx.getImageData = () => {
        offset += 260;
        return getImageData();
      };
      return ctx;
    };
    return canvas;
  };
  const result = await captureBestFrame(env.video, { automatic: true, signal: new AbortController().signal });
  assert.ok(result);
  assert.equal(env.encoded, 1);
});
