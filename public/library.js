import { createLibraryStore, discoveryLocation, matchesSearch, readDiscoveryQuery, searchTerms } from './library-store.js';

function readCatalogue() {
  let value;
  try { value = JSON.parse(document.querySelector('#library-data')?.textContent || '[]'); } catch { return []; }
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.filter(item => {
    if (!item || !['note', 'site'].includes(item.kind) || typeof item.id !== 'string' || seen.has(item.id)) return false;
    if (typeof item.name !== 'string' || !item.name.trim() || typeof item.href !== 'string') return false;
    try {
      const url = new URL(item.href, 'https://bitdrift.invalid');
      if (item.external ? url.protocol !== 'https:' : !item.href.startsWith('/') || url.origin !== 'https://bitdrift.invalid') return false;
    } catch { return false; }
    seen.add(item.id);
    return true;
  });
}

const catalogue = readCatalogue();
const items = new Map(catalogue.map(item => [item.id, item]));
let libraryStorage;
try { libraryStorage = window.localStorage; } catch { libraryStorage = null; }
const store = createLibraryStore({ knownIds: items.keys(), storage: libraryStorage, eventTarget: window });
const library = document.querySelector('#library');
const compactLibrary = Boolean(library?.classList.contains('home-library'));
const configuredLimit = Number(library?.dataset.libraryLimit);
const libraryLimit = compactLibrary ? Math.min(4, Number.isInteger(configuredLimit) && configuredLimit > 0 ? configuredLimit : 4) : Infinity;
const grid = library?.querySelector('.library-grid');
const libraryStatus = library?.querySelector('.library-status');
const libraryEmpty = library?.querySelector('.library-empty');
const views = [...document.querySelectorAll('[data-library-view]')];
const clearRecent = document.querySelector('.library-clear-recent');
const directoryCards = [...document.querySelectorAll('.site-card[data-item-id]')];
const directoryFilters = [...document.querySelectorAll('[data-filter]')];
const directorySearch = document.querySelector('#directory-search');
const directorySaved = document.querySelector('[data-directory-saved]');
const directoryStatus = document.querySelector('#directory-status');
const directoryEmpty = document.querySelector('.directory-empty');
const noteCards = [...document.querySelectorAll('.note-row[data-item-id]')];
const noteFilters = [...document.querySelectorAll('[data-note-filter]')];
const notesSearch = document.querySelector('#notes-search');
const notesClear = document.querySelector('.notes-clear');
const notesSort = document.querySelector('#notes-sort');
const notesList = document.querySelector('.notes-list');
const notesCount = document.querySelector('.notes-count');
const notesEmpty = document.querySelector('.notes-empty');
const listingKind = document.body.classList.contains('listing-page') ? directorySearch ? 'site' : notesSearch ? 'note' : null : null;
const titleCollator = new Intl.Collator('zh-Hans', { numeric: true, sensitivity: 'base' });
let activeView = views.find(button => button.getAttribute('aria-pressed') === 'true')?.dataset.libraryView || 'saved';
let directoryCategory = directoryFilters.find(button => button.getAttribute('aria-pressed') === 'true')?.dataset.filter || 'all';
let noteCategory = noteFilters.find(button => button.getAttribute('aria-pressed') === 'true')?.dataset.noteFilter || 'all';
let savedOnly = directorySaved?.getAttribute('aria-pressed') === 'true';
let feedback = '';
let recordingOpen = false;
let openUpdateTimer = 0;
let librarySignature = null;
let restoringPage = false;

function resultsChanged() { window.dispatchEvent(new CustomEvent('bitdrift:results')); }
function syncSaveButtons() {
  document.querySelectorAll('[data-save-item]').forEach(button => {
    const item = items.get(button.dataset.saveItem);
    if (!item) return;
    const saved = store.isSaved(item.id);
    button.setAttribute('aria-pressed', String(saved));
    button.setAttribute('aria-label', `${saved ? '取消收藏' : '收藏'}${item.name}`);
    const label = button.querySelector('[data-save-label]');
    if (label) label.textContent = saved ? '已收藏' : '收藏';
    const icon = button.querySelector('[data-save-icon]');
    if (icon) icon.textContent = saved ? '★' : '☆';
  });
  document.querySelectorAll('.library-count').forEach(count => { count.textContent = String(store.getState().saved.length); });
}
function focusAfterHide(cards, previous, fallback) {
  if (restoringPage) return;
  const focusedCard = cards.find(card => card.contains(previous));
  if (!focusedCard?.hidden) return;
  const index = cards.indexOf(focusedCard);
  const candidate = cards.slice(index + 1).find(card => !card.hidden) || cards.slice(0, index).reverse().find(card => !card.hidden);
  (candidate?.querySelector('[data-save-item]') || candidate?.querySelector('a') || fallback)?.focus({ preventScroll: true });
}
function updateDirectory() {
  const focused = document.activeElement;
  const terms = searchTerms(directorySearch?.value || '');
  let count = 0;
  directoryCards.forEach(card => {
    const item = items.get(card.dataset.itemId);
    const matchesCategory = directoryCategory === 'all' || card.dataset.category === directoryCategory;
    const visible = matchesCategory && (!savedOnly || store.isSaved(card.dataset.itemId)) && matchesSearch(card.dataset.search || item?.search || '', terms);
    card.hidden = !visible;
    if (visible) count++;
  });
  if (directoryStatus) directoryStatus.textContent = `${count} 个网站${savedOnly ? ' · 仅看收藏' : ''}`;
  if (directoryEmpty) directoryEmpty.hidden = count > 0;
  directorySaved?.setAttribute('aria-pressed', String(savedOnly));
  focusAfterHide(directoryCards, focused, directorySaved || directorySearch);
  resultsChanged();
}
function updateNotes() {
  const terms = searchTerms(notesSearch?.value || '');
  let count = 0;
  noteCards.forEach(card => {
    const item = items.get(card.dataset.itemId);
    card.hidden = !(noteCategory === 'all' || card.dataset.noteCategory === noteCategory) || !matchesSearch(card.dataset.search || item?.search || '', terms);
    if (!card.hidden) count++;
  });
  const order = notesSort?.value || 'default';
  const ordered = noteCards.map((card, index) => ({ card, index }));
  ordered.sort((a, b) => {
    if (order === 'newest' || order === 'oldest') {
      const dateOrder = (a.card.dataset.date || '').localeCompare(b.card.dataset.date || '');
      return (order === 'newest' ? -dateOrder : dateOrder) || a.index - b.index;
    }
    if (order === 'title') return titleCollator.compare(items.get(a.card.dataset.itemId)?.name || '', items.get(b.card.dataset.itemId)?.name || '') || a.index - b.index;
    return a.index - b.index;
  });
  if (notesList && ordered.some((entry, index) => notesList.children[index] !== entry.card)) {
    const focused = document.activeElement;
    for (const entry of ordered) notesList.append(entry.card);
    if (!restoringPage && notesList.contains(focused)) focused.focus({ preventScroll: true });
  }
  if (notesCount) notesCount.textContent = `${count} 篇手记`;
  if (notesEmpty) notesEmpty.hidden = count > 0;
  if (notesClear) notesClear.hidden = !notesSearch?.value;
  resultsChanged();
}
function syncCategories(buttons, category, key) {
  buttons.forEach(button => {
    const current = button.dataset[key] === category;
    button.setAttribute('aria-pressed', String(current));
    button.classList.toggle('is-active', current);
  });
}
function listingState() {
  return listingKind === 'site'
    ? { category: directoryCategory, q: directorySearch.value, savedOnly, sort: 'default' }
    : { category: noteCategory, q: notesSearch?.value || '', sort: notesSort?.value || 'default', savedOnly: false };
}
function writeListingQuery() {
  if (!listingKind) return;
  const next = discoveryLocation(window.location.href, listingState(), listingKind);
  if (next === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
  try { window.history.replaceState(window.history.state, '', next); } catch { /* 筛选在本页继续生效。 */ }
}
function restoreListingQuery(render = true) {
  if (!listingKind) return;
  const categories = (listingKind === 'site' ? directoryFilters : noteFilters).map(button => listingKind === 'site' ? button.dataset.filter : button.dataset.noteFilter);
  const next = readDiscoveryQuery(window.location.search, { kind: listingKind, categories });
  const changed = JSON.stringify(next) !== JSON.stringify(listingState());
  if (listingKind === 'site') {
    directoryCategory = next.category;
    savedOnly = next.savedOnly;
    if (directorySearch.value !== next.q) directorySearch.value = next.q;
    syncCategories(directoryFilters, directoryCategory, 'filter');
    const clear = document.querySelector('.directory-clear');
    if (clear) clear.hidden = !next.q;
    directorySaved?.setAttribute('aria-pressed', String(savedOnly));
    if (render && changed) updateDirectory();
  } else {
    noteCategory = next.category;
    if (notesSearch.value !== next.q) notesSearch.value = next.q;
    if (notesSort && notesSort.value !== next.sort) notesSort.value = next.sort;
    syncCategories(noteFilters, noteCategory, 'noteFilter');
    if (notesClear) notesClear.hidden = !next.q;
    if (render && changed) updateNotes();
  }
}
function saveButton(item) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'save-button';
  button.dataset.saveItem = item.id;
  const icon = document.createElement('span');
  icon.dataset.saveIcon = '';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '☆';
  const label = document.createElement('span');
  label.dataset.saveLabel = '';
  label.textContent = '收藏';
  button.append(icon, label);
  return button;
}
function libraryCard(item, openedAt) {
  const card = document.createElement('article');
  card.className = 'library-item';
  card.dataset.itemId = item.id;
  const main = document.createElement('div');
  main.className = 'library-item-main';
  const kind = document.createElement('p');
  kind.className = 'library-item-kind mono';
  kind.textContent = `${item.kind === 'site' ? '网站' : '手记'} / ${item.category || '探索'}`;
  const title = document.createElement('h3');
  const link = document.createElement('a');
  link.className = 'library-item-title';
  link.textContent = item.name;
  link.href = item.href;
  link.dataset.visitItem = item.id;
  if (item.external) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
  title.append(link);
  const description = document.createElement('p');
  description.className = 'library-item-description';
  description.textContent = item.description || '';
  main.append(kind, title, description);
  const meta = document.createElement('div');
  meta.className = 'library-item-meta';
  if (openedAt) {
    const date = document.createElement('time');
    date.dateTime = new Date(openedAt).toISOString();
    date.textContent = `最近打开 ${new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(openedAt)}`;
    meta.append(date);
  } else {
    const destination = document.createElement('span');
    destination.textContent = item.external ? '打开网站 ↗' : '阅读手记 →';
    meta.append(destination);
  }
  meta.append(saveButton(item));
  card.append(main, meta);
  return card;
}
function renderLibrary() {
  const state = store.getState();
  const focused = document.activeElement;
  const focusedId = grid?.contains(focused) ? focused.closest('[data-item-id]')?.dataset.itemId : null;
  const focusedSave = focused?.matches('[data-save-item]');
  const previousIndex = focusedId ? [...grid.children].findIndex(card => card.dataset.itemId === focusedId) : -1;
  const entries = !compactLibrary && activeView === 'recent' ? state.recent : state.saved.map(id => ({ id }));
  const visible = entries.filter(entry => items.has(entry.id)).filter(entry => activeView === 'sites' ? items.get(entry.id).kind === 'site' : activeView === 'notes' ? items.get(entry.id).kind === 'note' : true).slice(0, libraryLimit);
  const signature = JSON.stringify(visible);
  const replaced = grid && signature !== librarySignature;
  if (replaced) grid.replaceChildren(...visible.map(entry => libraryCard(items.get(entry.id), entry.at)));
  librarySignature = signature;
  views.forEach(button => {
    const current = button.dataset.libraryView === activeView;
    button.setAttribute('aria-pressed', String(current));
    button.classList.toggle('is-active', current);
  });
  if (clearRecent) clearRecent.hidden = state.recent.length === 0 || activeView !== 'recent';
  if (libraryEmpty) {
    libraryEmpty.hidden = compactLibrary || visible.length > 0;
    libraryEmpty.textContent = activeView === 'recent' ? '打开一篇手记或一个网站后，会在这里留下入口。' : activeView === 'sites' ? '还没有收藏网站。在网站卡片上点“收藏”，下次可以直接打开。' : activeView === 'notes' ? '还没有收藏手记。把想继续读的文章留在这里。' : '点击手记或网站旁的“收藏”，把常用入口留在这里。';
  }
  if (libraryStatus) {
    const summary = compactLibrary ? visible.length ? '最近收藏的入口' : '' : activeView === 'recent' ? `${visible.length} 条最近打开记录` : `${visible.length} 项收藏`;
    libraryStatus.textContent = `${feedback ? `${feedback} ` : ''}${summary}${store.persistent ? '' : ' · 收藏和最近打开记录仅在本页保留'}`;
  }
  syncSaveButtons();
  if (focusedId && replaced && !restoringPage) {
    const same = [...grid.children].find(card => card.dataset.itemId === focusedId);
    const next = same || grid.children[Math.min(previousIndex, grid.children.length - 1)];
    const fallback = views.find(button => button.dataset.libraryView === activeView) || [...document.querySelectorAll('a[href="/library/"]')].find(link => !library.contains(link));
    (next?.querySelector(focusedSave ? '[data-save-item]' : 'a') || fallback)?.focus({ preventScroll: true });
  }
  resultsChanged();
}
function updateAll() { renderLibrary(); updateDirectory(); }
store.subscribe(() => {
  if (!recordingOpen) { updateAll(); return; }
  if (!openUpdateTimer) openUpdateTimer = setTimeout(() => { openUpdateTimer = 0; updateAll(); }, 0);
});

views.forEach(button => button.addEventListener('click', () => {
  activeView = button.dataset.libraryView;
  feedback = '';
  renderLibrary();
}));
clearRecent?.addEventListener('click', () => {
  feedback = '最近打开记录已清空。';
  if (!store.clearRecent()) renderLibrary();
  views.find(button => button.dataset.libraryView === 'recent')?.focus({ preventScroll: true });
});
directoryFilters.forEach(button => button.addEventListener('click', () => {
  directoryCategory = button.dataset.filter;
  syncCategories(directoryFilters, directoryCategory, 'filter');
  updateDirectory();
  writeListingQuery();
}));
directorySearch?.addEventListener('input', () => { updateDirectory(); writeListingQuery(); });
directorySaved?.addEventListener('click', () => { savedOnly = !savedOnly; updateDirectory(); writeListingQuery(); });
noteFilters.forEach(button => button.addEventListener('click', () => {
  noteCategory = button.dataset.noteFilter;
  syncCategories(noteFilters, noteCategory, 'noteFilter');
  updateNotes();
  writeListingQuery();
}));
notesSearch?.addEventListener('input', () => { updateNotes(); writeListingQuery(); });
notesClear?.addEventListener('click', () => {
  notesSearch.value = '';
  notesSearch.dispatchEvent(new Event('input', { bubbles: true }));
  notesSearch.focus();
});
notesSort?.addEventListener('change', () => { updateNotes(); writeListingQuery(); });
document.addEventListener('click', event => {
  const button = event.target instanceof Element ? event.target.closest('[data-save-item]') : null;
  if (!button || !items.has(button.dataset.saveItem)) return;
  const item = items.get(button.dataset.saveItem);
  feedback = `已${store.isSaved(item.id) ? '取消收藏' : '收藏'}「${item.name}」。`;
  store.toggleSaved(item.id);
});
function recordOpen(event) {
  if (event.defaultPrevented || (event.type === 'auxclick' && event.button !== 1)) return;
  const link = event.target instanceof Element ? event.target.closest('a[data-visit-item]') : null;
  if (!link || !items.has(link.dataset.visitItem)) return;
  feedback = '';
  recordingOpen = true;
  try { store.visit(link.dataset.visitItem); } finally { recordingOpen = false; }
}
document.addEventListener('click', recordOpen);
document.addEventListener('auxclick', recordOpen);
window.addEventListener('pageshow', () => {
  restoringPage = true;
  try { store.refresh(); restoreListingQuery(); } finally { restoringPage = false; }
});
window.addEventListener('popstate', () => {
  restoringPage = true;
  try { restoreListingQuery(); } finally { restoringPage = false; }
});
restoreListingQuery(false);
renderLibrary();
updateDirectory();
updateNotes();
if (catalogue.length) document.documentElement.classList.add('library-ready');
