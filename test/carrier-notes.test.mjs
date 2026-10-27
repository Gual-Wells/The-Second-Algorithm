import test from 'node:test';
import assert from 'node:assert/strict';
import { NotesJournal } from '../web/notes-journal.js';

function storage() {
  const entries = new Map();
  return { entries, get length() { return entries.size; }, key(index) { return [...entries.keys()][index] ?? null; },
    getItem(key) { return entries.get(key) ?? null; }, setItem(key, value) { entries.set(key, String(value)); },
    removeItem(key) { entries.delete(key); } };
}
const prefix = 'second-algorithm:owner-a:';
const collection = 'binary-search';
const journal = (store, client = 'one', namespace = prefix) => new NotesJournal(store, namespace, client);

test('late ACK from another tab cannot overwrite a different pending draft and reload discovers it', () => {
  const store = storage(), a = journal(store, 'a'), b = journal(store, 'b');
  a.draft(collection, { text: 'sent A', revision: 0 });
  b.draft(collection, { text: 'unsent B', revision: 0 });
  a.acknowledge(collection, { text: 'sent A', baseRevision: 0, revision: 1 });
  assert.deepEqual(journal(store, 'reload').load(collection), { text: 'unsent B', revision: 0, dirty: true });
  assert.deepEqual(b.list(collection).map(entry => entry.text), ['unsent B']);
});

test('typing while a save is pending retains the new text and rebase draft can be acknowledged separately', () => {
  const store = storage(), a = journal(store);
  a.draft(collection, { text: 'sent', revision: 0 });
  a.draft(collection, { text: 'newer input', revision: 0 });
  a.acknowledge(collection, { text: 'sent', baseRevision: 0, revision: 1 });
  assert.deepEqual(a.load(collection), { text: 'newer input', revision: 0, dirty: true });
  a.draft(collection, { text: 'newer input', revision: 1 });
  a.acknowledge(collection, { text: 'newer input', baseRevision: 1, revision: 2 });
  assert.deepEqual(a.load(collection), { text: 'newer input', revision: 2, dirty: false });
});

test('older acknowledgements never downgrade canonical revision or consume a newer base revision', () => {
  const store = storage(), a = journal(store);
  a.cache(collection, { text: 'server rev 8', revision: 8 });
  a.draft(collection, { text: 'same text', revision: 8 });
  a.acknowledge(collection, { text: 'same text', baseRevision: 0, revision: 1 });
  assert.equal(a.list(collection).length, 1);
  assert.equal(a.load(collection).revision, 8);
  a.discard(collection, a.list(collection)[0].key, 'same text');
  assert.deepEqual(a.load(collection), { text: 'server rev 8', revision: 8, dirty: false });
});

test('legacy dirty notes survive canonical cache updates and can be recovered after reload', () => {
  const store = storage(), a = journal(store);
  store.setItem(prefix + 'notes:' + collection, JSON.stringify({ text: 'legacy draft', revision: 3, dirty: true }));
  a.cache(collection, { text: 'remote value', revision: 4 });
  assert.deepEqual(a.load(collection), { text: 'legacy draft', revision: 3, dirty: true });
  a.acknowledge(collection, { text: 'legacy draft', baseRevision: 3, revision: 5 });
  assert.deepEqual(journal(store, 'new-page').load(collection), { text: 'legacy draft', revision: 5, dirty: false });
  assert.equal(JSON.parse(store.getItem(prefix + 'notes:' + collection)).text, 'legacy draft');
});

test('foreign recovered drafts are marked rather than deleted, preserving an interleaved writer', () => {
  const store = storage(), writer = journal(store, 'writer'), saver = journal(store, 'saver');
  writer.draft(collection, { text: 'saved snapshot', revision: 0 });
  const key = writer.list(collection)[0].key;
  const set = store.setItem.bind(store);
  let interleaved = false;
  store.setItem = (name, value) => {
    if (name.startsWith(prefix + 'notes-confirmed:') && !interleaved) {
      interleaved = true;
      writer.draft(collection, { text: 'concurrent new input', revision: 0 });
    }
    set(name, value);
  };
  saver.acknowledge(collection, { text: 'saved snapshot', baseRevision: 0, revision: 1 });
  assert.equal(interleaved, true);
  assert.equal(JSON.parse(store.getItem(key)).text, 'concurrent new input');
  assert.deepEqual(saver.load(collection), { text: 'concurrent new input', revision: 0, dirty: true });
});

test('explicit discard guards text and namespace, merging only identical snapshots', () => {
  const store = storage(), a = journal(store, 'a'), b = journal(store, 'b'), outsider = journal(store, 'x', 'other-owner:');
  a.draft(collection, { text: 'duplicate', revision: 2 });
  b.draft(collection, { text: 'duplicate', revision: 2 });
  outsider.draft(collection, { text: 'foreign', revision: 0 });
  assert.equal(a.list(collection).length, 1);
  const key = a.list(collection)[0].key;
  assert.equal(a.discard(collection, key, 'stale text'), false);
  assert.equal(a.discard(collection, outsider.list(collection)[0].key, 'foreign'), false);
  assert.equal(a.discard(collection, key, 'duplicate'), true);
  assert.deepEqual(b.list(collection), []);
  assert.equal(outsider.load(collection).text, 'foreign');
});

test('foreign discard marker cannot hide a concurrently changed draft', () => {
  const store = storage(), a = journal(store, 'a'), b = journal(store, 'b');
  b.draft(collection, { text: 'discard me', revision: 0 });
  const key = b.list(collection)[0].key, set = store.setItem.bind(store);
  store.setItem = (name, value) => {
    if (name.startsWith(prefix + 'notes-confirmed:')) b.draft(collection, { text: 'keep new input', revision: 0 });
    set(name, value);
  };
  assert.equal(a.discard(collection, key, 'discard me'), true);
  assert.equal(a.load(collection).text, 'keep new input');
});

test('an old marker cannot suppress a later fresh draft with the same text and base revision', () => {
  const store = storage(), writer = journal(store, 'writer'), saver = journal(store, 'saver');
  writer.draft(collection, { text: 'same text', revision: 0 });
  saver.acknowledge(collection, { text: 'same text', baseRevision: 0, revision: 1 });
  assert.equal(writer.list(collection).length, 0);
  writer.draft(collection, { text: 'same text', revision: 0 });
  assert.equal(writer.list(collection).length, 1);
  assert.equal(writer.load(collection).dirty, true);
});

test('one fixed draft slot per client and collection; newest draft wins with stable deduplication', () => {
  const store = storage(), a = journal(store, 'a'), b = journal(store, 'b');
  for (let i = 0; i < 30; i++) a.draft(collection, { text: 'draft ' + i, revision: 0 });
  assert.equal(store.length, 1);
  b.draft(collection, { text: 'other', revision: 0 });
  const key = b.list(collection).find(entry => entry.text === 'other').key;
  const value = JSON.parse(store.getItem(key)); value.updatedAt += 100;
  store.setItem(key, JSON.stringify(value));
  assert.equal(a.load(collection).text, 'other');
  assert.equal(a.list(collection).length, 2);
});

test('malformed records are ignored without deleting originals; owner and collection scopes stay separate', () => {
  const store = storage(), a = journal(store), b = journal(store, 'b', 'owner-b:');
  store.setItem(prefix + 'notes:' + collection, '{bad JSON');
  store.setItem(prefix + 'notes-draft:' + collection + ':bad', JSON.stringify({ text: 'invalid', revision: -1, dirty: true }));
  store.setItem(prefix + 'notes-cache:' + collection, JSON.stringify({ text: 123, revision: 8, dirty: false }));
  b.draft(collection, { text: 'other owner', revision: 0 });
  a.draft('other-collection', { text: 'other collection', revision: 0 });
  assert.deepEqual(a.load(collection), { text: '', revision: 0, dirty: false });
  assert.equal(store.getItem(prefix + 'notes:' + collection), '{bad JSON');
  assert.throws(() => a.draft('../foreign', { text: '', revision: 0 }), TypeError);
  assert.throws(() => a.cache(collection, { text: 'x'.repeat(20_001), revision: 1 }), TypeError);
});

test('storage failures propagate so callers cannot report a draft as safely saved', () => {
  const store = storage(), a = journal(store);
  store.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.throws(() => a.draft(collection, { text: 'unsaved', revision: 0 }), /QuotaExceededError/);
  assert.throws(() => a.cache(collection, { text: 'remote', revision: 1 }), /QuotaExceededError/);
});
