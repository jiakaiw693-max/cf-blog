import assert from 'node:assert/strict';
import { createReadingStore, readingRatio, readingScrollTarget, sanitizeReadingRecords } from '../public/reader.js';

const now = 1791190000000;
const ids = new Set(['note:alpha', 'note:beta', 'note:gamma']);
let clock = now;
const values = new Map();
const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
let checks = 0;
function check(name, action) { action(); checks++; }

check('Malformed and unlisted records are discarded', () => {
  const records = sanitizeReadingRecords({
    'note:alpha': { ratio: .52, updatedAt: now },
    'note:beta': { ratio: '0.9', updatedAt: now },
    'note:gamma': { ratio: Infinity, updatedAt: now },
    'note:unknown': { ratio: .4, updatedAt: now }
  }, ids, now);
  assert.deepEqual(Object.keys(records), ['note:alpha']);
});
check('Out-of-range timestamps and progress are discarded', () => {
  assert.equal(Object.keys(sanitizeReadingRecords({ 'note:alpha': { ratio: 1.4, updatedAt: now }, 'note:beta': { ratio: .4, updatedAt: now + 86400001 }, 'note:gamma': { ratio: .4, updatedAt: -1 } }, ids, now)).length, 0);
});
check('Array records are discarded', () => assert.equal(Object.keys(sanitizeReadingRecords([{ ratio: .5, updatedAt: now }], ids, now)).length, 0));
check('Latest unfinished note uses the last real reading change', () => {
  const store = createReadingStore(storage, ids, () => clock);
  assert.equal(store.save('note:alpha', .5), true);
  clock++;
  store.save('note:beta', .3);
  clock++;
  assert.equal(store.save('note:gamma', 0), false);
  assert.equal(store.latest().id, 'note:beta');
  assert.equal(store.save('note:alpha', .5), false);
  assert.equal(store.latest().id, 'note:beta');
});
check('Completed articles stay complete until reset', () => {
  const store = createReadingStore(storage, ids, () => clock);
  store.save('note:beta', .999);
  assert.equal(store.get('note:beta').ratio, 1);
  assert.equal(store.save('note:beta', .3), false);
  assert.equal(store.latest().id, 'note:alpha');
  store.reset('note:beta');
  assert.equal(store.get('note:beta'), null);
  assert.equal(store.save('note:beta', .3), true);
});
check('Denied storage retains position in memory', () => {
  const denied = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  const store = createReadingStore(denied, ids, () => now);
  assert.equal(store.save('note:alpha', .45), true);
  assert.equal(store.latest().ratio, .45);
  store.reset('note:alpha');
  assert.equal(store.latest(), null);
});
check('Invalid stored JSON falls back to an empty store', () => {
  assert.equal(createReadingStore({ getItem: () => '{bad', setItem() {} }, ids, () => now).latest(), null);
});
check('Storage reload responds to another tab clearing history', () => {
  const store = createReadingStore(storage, ids, () => clock);
  values.delete('bitdrift-reading');
  store.reload();
  assert.equal(store.latest(), null);
});
check('History contains at most 200 known records', () => {
  const known = new Set(Array.from({ length: 300 }, (_, index) => `note:note-${index}`));
  const incoming = Object.fromEntries([...known].map((id, index) => [id, { ratio: .5, updatedAt: now - index }]));
  const clean = sanitizeReadingRecords(incoming, known, now);
  assert.equal(Object.keys(clean).length, 200);
  assert.ok(clean['note:note-0']);
  assert.equal(clean['note:note-299'], undefined);
});
check('Tall article starts at 0 and completes when the body bottom is visible', () => {
  const geometry = { top: 700, bottom: 2500, viewportHeight: 900, offset: 110 };
  assert.equal(readingRatio({ ...geometry, scrollY: 0 }), 0);
  assert.equal(readingRatio({ ...geometry, scrollY: 590 }), 0);
  assert.equal(readingRatio({ ...geometry, scrollY: 1628 }), 1);
  assert.equal(readingRatio({ ...geometry, scrollY: 4000 }), 1);
});
check('Resume targets invert reading progress after layout changes', () => {
  for (const geometry of [{ top: 700, bottom: 2500, viewportHeight: 900 }, { top: 500, bottom: 900, viewportHeight: 568 }]) {
    const target = readingScrollTarget(geometry, .62);
    assert.ok(Math.abs(readingRatio({ ...geometry, scrollY: target }) - .62) < .00001);
  }
});
check('Short article completes when its entire body is visible', () => {
  assert.equal(readingRatio({ top: 100, bottom: 450, viewportHeight: 900, scrollY: 0 }), 1);
  assert.equal(readingRatio({ top: 1000, bottom: 1300, viewportHeight: 900, scrollY: 428 }), 1);
});
check('Invalid geometry yields a safe starting position', () => {
  assert.equal(readingRatio({ top: NaN, bottom: 900, viewportHeight: 568, scrollY: 0 }), 0);
  assert.equal(readingScrollTarget({ top: 700, bottom: 300, viewportHeight: 568 }, .5), 0);
});

console.log(`Reading history and progress checks passed: ${checks}.`);
