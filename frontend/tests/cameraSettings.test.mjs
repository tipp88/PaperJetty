import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cameraErrorMessage, configureContinuousCamera, readCameraCapabilities } from '../src/utils/cameraSettings.ts';

function camera(capabilities, { reject = () => false } = {}) {
  let constraints = {
    width: { ideal: 4096 }, height: { ideal: 2160 },
    facingMode: 'environment', advanced: [{ zoom: 1 }],
  };
  const requests = [];
  return {
    readyState: 'live', requests,
    getCapabilities: () => capabilities,
    getConstraints: () => structuredClone(constraints),
    async applyConstraints(next) {
      requests.push(next);
      if (reject(next)) throw new Error('Driver rejected optional mode');
      constraints = structuredClone(next);
    },
  };
}
const signal = () => new AbortController().signal;

test('requests only supported continuous camera modes and retains resolution and earlier controls', async () => {
  const track = camera({
    focusMode: ['manual', 'continuous'], exposureMode: ['continuous'], whiteBalanceMode: ['continuous'],
  });
  await configureContinuousCamera(track, signal());
  assert.equal(track.requests.length, 3);
  assert.deepEqual(track.getConstraints(), {
    width: { ideal: 4096 }, height: { ideal: 2160 }, facingMode: 'environment',
    advanced: [{ zoom: 1 }, { focusMode: 'continuous' }, { exposureMode: 'continuous' }, { whiteBalanceMode: 'continuous' }],
  });
});

test('rejected autofocus does not prevent exposure or white balance configuration', async () => {
  const track = camera({ focusMode: ['continuous'], exposureMode: ['continuous'], whiteBalanceMode: ['continuous'] }, {
    reject: next => next.advanced.some(value => value.focusMode),
  });
  await configureContinuousCamera(track, signal());
  assert.equal(track.requests.length, 3);
  assert.deepEqual(track.getConstraints().advanced, [
    { zoom: 1 }, { exposureMode: 'continuous' }, { whiteBalanceMode: 'continuous' },
  ]);
});

test('absent, unsupported and malformed capability values keep camera defaults', async () => {
  for (const capabilities of [{}, { focusMode: ['manual'], exposureMode: [], whiteBalanceMode: 'continuous' }]) {
    const track = camera(capabilities);
    await configureContinuousCamera(track, signal());
    assert.equal(track.requests.length, 0);
  }
});

test('missing or throwing capability API is harmless', async () => {
  for (const getCapabilities of [undefined, () => { throw new Error('Unavailable'); }]) {
    const track = camera({});
    track.getCapabilities = getCapabilities;
    assert.deepEqual(readCameraCapabilities(track), {});
    await configureContinuousCamera(track, signal());
    assert.equal(track.requests.length, 0);
  }
});

test('a browser failing to expose current constraints cannot fail camera startup', async () => {
  const track = camera({ focusMode: ['continuous'] });
  track.getConstraints = () => { throw new Error('Unsupported'); };
  await assert.doesNotReject(configureContinuousCamera(track, signal()));
  assert.equal(track.requests.length, 0);
});

test('stop/unmount during pending configuration prevents further track mutations', async () => {
  const track = camera({ focusMode: ['continuous'], exposureMode: ['continuous'], whiteBalanceMode: ['continuous'] });
  const controller = new AbortController();
  let finish;
  track.applyConstraints = async next => {
    track.requests.push(next);
    await new Promise(resolve => { finish = resolve; });
  };
  const pending = configureContinuousCamera(track, controller.signal);
  assert.equal(track.requests.length, 1);
  controller.abort();
  finish();
  await pending;
  assert.equal(track.requests.length, 1);
});

test('ended and already cancelled tracks are never configured', async () => {
  const ended = camera({ focusMode: ['continuous'] });
  ended.readyState = 'ended';
  await configureContinuousCamera(ended, signal());
  assert.equal(ended.requests.length, 0);
  const cancelled = camera({ focusMode: ['continuous'] });
  const controller = new AbortController();
  controller.abort();
  await configureContinuousCamera(cancelled, controller.signal);
  assert.equal(cancelled.requests.length, 0);
});

test('permission and hardware failures remain actionable errors', () => {
  assert.match(cameraErrorMessage({ name: 'NotAllowedError' }), /permission denied/);
  assert.match(cameraErrorMessage({ name: 'NotFoundError' }), /No camera/);
  assert.match(cameraErrorMessage({ name: 'NotReadableError' }), /Close other apps/);
  assert.match(cameraErrorMessage({ name: 'SecurityError' }), /HTTPS/);
  assert.match(cameraErrorMessage({ name: 'OverconstrainedError' }), /settings/);
  assert.match(cameraErrorMessage(null), /Failed to access camera/);
});
