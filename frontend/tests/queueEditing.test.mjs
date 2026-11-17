import test from 'node:test';
import assert from 'node:assert/strict';
import { finishDocument, reopenDocument } from '../src/utils/queueEditing.ts';

const makeDocument = (id, status = 'queued') => ({
  id, title: `Invoice ${id}`, tags: ['invoice'], timestamp: 123,
  pages: [{ id: `${id}-page`, processedImage: 'image', rotation: 0 }], status,
});
const initial = () => ({ pages: [], queue: [makeDocument('a'), makeDocument('b')], activeDocument: null });

test('edit, rotate and save retains identity and metadata without duplicates', () => {
  const state = initial();
  const editing = reopenDocument(state, 'a');
  assert.deepEqual(editing.queue.map(d => d.id), ['b']);
  editing.pages = editing.pages.map(p => ({ ...p, rotation: 90 }));
  const saved = finishDocument(editing);
  const result = saved.queue.find(d => d.id === 'a');
  assert.equal(result.pages[0].rotation, 90);
  assert.equal(result.title, 'Invoice a');
  assert.deepEqual(result.tags, ['invoice']);
  assert.equal(result.timestamp, 123);
  assert.equal(result.status, 'queued');
  assert.equal(saved.queue.length, 2);
  assert.deepEqual(saved.pages, []);
  assert.equal(saved.activeDocument, null);
  assert.equal(state.queue[0].pages[0].rotation, 0);
});

test('opening a queue document preserves an unfinished scan as a separate queue entry', () => {
  const state = { ...initial(), pages: [{ id: 'unfinished', rotation: 270 }] };
  const editing = reopenDocument(state, 'a');
  assert.equal(editing.queue.length, 2);
  assert.deepEqual(editing.queue[1].pages, state.pages);
  assert.equal(editing.queue[1].status, 'queued');
  assert.deepEqual(editing.pages, state.queue[0].pages);
});

test('switching documents saves previous edits and survives a persisted state round trip', () => {
  const editing = reopenDocument(initial(), 'a');
  editing.pages = [{ ...editing.pages[0], rotation: 180 }];
  const restored = JSON.parse(JSON.stringify(editing));
  const next = reopenDocument(restored, 'b');
  assert.equal(next.activeDocument.id, 'b');
  assert.equal(next.queue[0].id, 'a');
  assert.equal(next.queue[0].pages[0].rotation, 180);
  assert.equal(next.queue[0].title, 'Invoice a');
});

test('saving preserves added, removed and reordered pages', () => {
  const editing = reopenDocument(initial(), 'a');
  editing.pages = [{ id: 'new-page', rotation: 0 }, { id: 'replacement', rotation: 90 }];
  const saved = finishDocument(editing);
  assert.deepEqual(saved.queue.at(-1).pages.map(p => p.id), ['new-page', 'replacement']);
});

test('failed uploads become queued without stale progress or errors', () => {
  const document = { ...makeDocument('failed', 'failed'), progress: 70, error: 'Network' };
  const editing = reopenDocument({ ...initial(), queue: [document] }, 'failed');
  const result = finishDocument(editing).queue[0];
  assert.equal(result.status, 'queued');
  assert.equal(result.error, undefined);
  assert.equal(result.progress, undefined);
});

test('uploading, completed and missing documents cannot be reopened', () => {
  for (const status of ['uploading', 'completed', 'draft']) {
    assert.equal(reopenDocument({ ...initial(), queue: [makeDocument('a', status)] }, 'a'), null);
  }
  assert.equal(reopenDocument(initial(), 'missing'), null);
  assert.equal(finishDocument(initial()), null);
});
