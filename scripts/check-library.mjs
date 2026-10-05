import assert from 'node:assert/strict';
import { createLibraryStore, discoveryLocation, LIBRARY_KEY, matchesSearch, normalizeLibraryState, readDiscoveryQuery, RECENT_LIMIT, searchTerms } from '../public/library-store.js';

const known = new Set(['note:ai', 'note:usb-c', 'site:https://example.com/']);
let checks = 0;
const test = (name, run) => { run(); checks++; console.log(`✓ ${name}`); };
function memoryStorage(initial = null) {
  let value = initial;
  return { getItem: () => value, setItem: (_key, next) => { value = next; }, value: () => value };
}

test('损坏 JSON 与未知版本恢复为空目录', () => {
  for (const raw of [null, '', '{broken', 'null', '[]', '42', '{"version":2,"saved":["note:ai"]}']) {
    assert.deepEqual(normalizeLibraryState(raw, known), { version: 1, saved: [], recent: [] });
  }
});
test('收藏只接受已知 ID，移除重复项和无效字段', () => {
  const state = normalizeLibraryState({ version: 1, saved: ['note:ai', 'unknown', 'note:ai', 5, null, 'note:usb-c'], recent: 'invalid' }, known);
  assert.deepEqual(state.saved, ['note:ai', 'note:usb-c']);
  assert.deepEqual(state.recent, []);
});
test('最近打开记录校验时间并按原顺序去重', () => {
  const state = normalizeLibraryState({ version: 1, recent: [null, { id: 'unknown', at: 3 }, { id: 'note:ai', at: -1 }, { id: 'note:ai', at: 0 }, { id: 'note:ai', at: Infinity }, { id: 'note:ai', at: Number.MAX_SAFE_INTEGER }, { id: 'note:ai', at: 9 }, { id: 'note:ai', at: 8 }, { id: 'note:usb-c', at: 7 }] }, known);
  assert.deepEqual(state.recent, [{ id: 'note:ai', at: 9 }, { id: 'note:usb-c', at: 7 }]);
});
test('收藏切换实际写入存储，并保留最近打开记录', () => {
  const storage = memoryStorage();
  const store = createLibraryStore({ knownIds: known, storage, now: () => 100 });
  store.visit('note:usb-c');
  assert.equal(store.toggleSaved('note:ai'), true);
  assert.equal(store.isSaved('note:ai'), true);
  assert.deepEqual(JSON.parse(storage.value()).saved, ['note:ai']);
  assert.equal(store.toggleSaved('note:ai'), false);
  assert.deepEqual(store.getState().recent, [{ id: 'note:usb-c', at: 100 }]);
});
test('未知 ID 不会新增收藏或打开记录', () => {
  const store = createLibraryStore({ knownIds: known });
  assert.equal(store.toggleSaved('unknown'), false);
  assert.equal(store.visit('unknown'), false);
  assert.deepEqual(store.getState(), { version: 1, saved: [], recent: [] });
});
test('收藏动作不新增打开记录', () => {
  const store = createLibraryStore({ knownIds: known });
  store.toggleSaved('note:ai');
  store.toggleSaved('note:usb-c');
  assert.deepEqual(store.getState().saved, ['note:usb-c', 'note:ai']);
  assert.deepEqual(store.getState().recent, []);
});
test('重复打开移到首位，记录上限为 24 条', () => {
  const ids = Array.from({ length: 32 }, (_, index) => `note:${index}`);
  let time = 1;
  const store = createLibraryStore({ knownIds: ids, now: () => time++ });
  ids.forEach(id => store.visit(id));
  assert.equal(store.getState().recent.length, RECENT_LIMIT);
  assert.deepEqual(store.getState().recent.map(entry => entry.id), ids.slice(-24).reverse());
  store.visit('note:10');
  assert.equal(store.getState().recent[0].id, 'note:10');
  assert.equal(store.getState().recent.filter(entry => entry.id === 'note:10').length, 1);
});
test('重新读取超长记录时同样限制为 24 条', () => {
  const ids = Array.from({ length: 32 }, (_, index) => `note:${index}`);
  const state = normalizeLibraryState({ version: 1, recent: ids.map((id, index) => ({ id, at: index + 1 })) }, ids);
  assert.equal(state.recent.length, RECENT_LIMIT);
});
test('读取被阻止时收藏仍在内存中可用', () => {
  const storage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  const store = createLibraryStore({ knownIds: known, storage, now: () => 5 });
  assert.equal(store.persistent, false);
  store.toggleSaved('note:ai');
  store.visit('note:usb-c');
  assert.equal(store.isSaved('note:ai'), true);
  assert.equal(store.getState().recent[0].id, 'note:usb-c');
});
test('写入失败保留内存状态，之后继续操作', () => {
  const storage = { getItem: () => null, setItem() { throw new Error('quota'); } };
  const store = createLibraryStore({ knownIds: known, storage });
  assert.equal(store.persistent, true);
  store.toggleSaved('note:ai');
  assert.equal(store.persistent, false);
  assert.equal(store.isSaved('note:ai'), true);
  store.toggleSaved('note:usb-c');
  assert.deepEqual(store.getState().saved, ['note:usb-c', 'note:ai']);
});
test('返回值和订阅快照的修改不会污染内部状态', () => {
  const store = createLibraryStore({ knownIds: known, now: () => 10 });
  store.subscribe(state => { state.saved.push('unknown'); state.recent[0].id = 'unknown'; });
  store.visit('note:ai');
  const snapshot = store.getState();
  snapshot.recent[0].at = -10;
  snapshot.saved.push('unknown');
  assert.deepEqual(store.getState().recent, [{ id: 'note:ai', at: 10 }]);
  assert.deepEqual(store.getState().saved, []);
});
test('清空最近打开记录保留收藏并通知订阅者', () => {
  const store = createLibraryStore({ knownIds: known });
  store.toggleSaved('note:ai');
  store.visit('note:usb-c');
  let notifications = 0;
  const unsubscribe = store.subscribe(() => notifications++);
  assert.equal(store.clearRecent(), true);
  assert.equal(notifications, 1);
  assert.deepEqual(store.getState().saved, ['note:ai']);
  assert.deepEqual(store.getState().recent, []);
  assert.equal(store.clearRecent(), false);
  unsubscribe();
  store.visit('note:ai');
  assert.equal(notifications, 1);
});
test('同浏览器标签页通过 storage 事件同步，其他存储键保持独立', () => {
  const target = new EventTarget();
  const storage = memoryStorage();
  const store = createLibraryStore({ knownIds: known, storage, eventTarget: target });
  function emit(key, newValue) {
    const event = new Event('storage');
    Object.defineProperties(event, { key: { value: key }, newValue: { value: newValue }, storageArea: { value: storage } });
    target.dispatchEvent(event);
  }
  const next = JSON.stringify({ version: 1, saved: ['note:usb-c', 'unknown'], recent: [{ id: 'note:ai', at: 15 }] });
  emit('bitdrift-radio', next);
  assert.equal(store.isSaved('note:usb-c'), false);
  emit(LIBRARY_KEY, next);
  assert.equal(store.isSaved('note:usb-c'), true);
  assert.equal(storage.value(), null);
  emit(null, null);
  assert.deepEqual(store.getState().saved, []);
  store.dispose();
  emit(LIBRARY_KEY, next);
  assert.equal(store.isSaved('note:usb-c'), false);
});
test('恢复页面时读取最新存储', () => {
  const storage = memoryStorage();
  const store = createLibraryStore({ knownIds: known, storage });
  storage.setItem(LIBRARY_KEY, JSON.stringify({ version: 1, saved: ['note:ai'], recent: [] }));
  assert.equal(store.refresh(), true);
  assert.equal(store.isSaved('note:ai'), true);
});
test('搜索统一大小写、全角字符，并组合所有词', () => {
  const terms = searchTerms(' ＡＩ   实践 ');
  assert.deepEqual(terms, ['ai', '实践']);
  assert.equal(matchesSearch('AI 工具与实践', terms), true);
  assert.equal(matchesSearch('AI 硬件', terms), false);
  assert.equal(matchesSearch('任意内容', searchTerms('   ')), true);
});
test('手记筛选链接恢复分类、搜索和已知排序', () => {
  const state = readDiscoveryQuery('?category=AI&q=%E5%B7%A5%E5%85%B7&sort=oldest&saved=1', { kind: 'note', categories: ['all', 'AI', '硬件'] });
  assert.deepEqual(state, { category: 'AI', q: '工具', sort: 'oldest', savedOnly: false });
});
test('网站筛选链接只接受已知分类和 saved=1', () => {
  const state = readDiscoveryQuery('?category=unknown&sort=title&saved=true&q=GitHub', { kind: 'site', categories: ['all', '开发工具'] });
  assert.deepEqual(state, { category: 'all', q: 'GitHub', sort: 'default', savedOnly: false });
  assert.equal(readDiscoveryQuery('?saved=1', { kind: 'site', categories: ['all'] }).savedOnly, true);
});
test('损坏排序值回退，长搜索词限制为 100 个字符', () => {
  const state = readDiscoveryQuery(`?sort=invalid&q=${'a'.repeat(500)}`, { kind: 'note', categories: ['all'] });
  assert.equal(state.sort, 'default');
  assert.equal(state.q.length, 100);
});
test('更新筛选地址保留页面路径、片段和其他参数', () => {
  const href = discoveryLocation('https://example.com/directory/?source=share&sort=title#directory', { category: '开发工具', q: ' MDN ', savedOnly: true }, 'site');
  const url = new URL(href, 'https://example.com');
  assert.equal(url.pathname, '/directory/');
  assert.equal(url.hash, '#directory');
  assert.equal(url.searchParams.get('source'), 'share');
  assert.equal(url.searchParams.get('category'), '开发工具');
  assert.equal(url.searchParams.get('q'), 'MDN');
  assert.equal(url.searchParams.get('saved'), '1');
  assert.equal(url.searchParams.has('sort'), false);
});
test('默认筛选地址省略默认值并完整往返恢复', () => {
  const href = discoveryLocation('https://example.com/notes/?category=AI&q=tools&sort=title&saved=1#notes', { category: 'all', q: '', sort: 'default', savedOnly: false }, 'note');
  assert.equal(href, '/notes/#notes');
  const selected = { category: '硬件', q: 'USB C', sort: 'newest', savedOnly: false };
  const queryHref = discoveryLocation('https://example.com/notes/', selected, 'note');
  assert.deepEqual(readDiscoveryQuery(new URL(queryHref, 'https://example.com').search, { kind: 'note', categories: ['all', '硬件'] }), selected);
});

console.log(`收藏与最近打开记录检查通过：${checks} 项。`);
