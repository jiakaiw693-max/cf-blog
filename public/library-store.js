export const LIBRARY_KEY = 'bitdrift-library';
export const RECENT_LIMIT = 24;
const MAX_TIMESTAMP = 8_640_000_000_000_000;

const emptyState = () => ({ version: 1, saved: [], recent: [] });
const cloneState = state => ({ version: 1, saved: [...state.saved], recent: state.recent.map(entry => ({ ...entry })) });

export function normalizeLibraryState(raw, knownIds) {
  const known = knownIds instanceof Set ? knownIds : new Set(knownIds);
  let value;
  try { value = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return emptyState(); }
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 1) return emptyState();
  const state = emptyState();
  const savedSeen = new Set();
  if (Array.isArray(value.saved)) for (const id of value.saved) {
    if (typeof id !== 'string' || !known.has(id) || savedSeen.has(id)) continue;
    savedSeen.add(id);
    state.saved.push(id);
  }
  const recentSeen = new Set();
  if (Array.isArray(value.recent)) for (const entry of value.recent) {
    if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || !known.has(entry.id) || recentSeen.has(entry.id)) continue;
    if (!Number.isSafeInteger(entry.at) || entry.at <= 0 || entry.at > MAX_TIMESTAMP) continue;
    recentSeen.add(entry.id);
    state.recent.push({ id: entry.id, at: entry.at });
    if (state.recent.length === RECENT_LIMIT) break;
  }
  return state;
}

export function searchTerms(query = '') {
  return String(query).normalize('NFKC').trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean);
}

export function matchesSearch(text, terms) {
  const value = String(text || '').normalize('NFKC').toLocaleLowerCase();
  return terms.every(term => value.includes(term));
}

const discoverySorts = new Set(['default', 'newest', 'oldest', 'title']);
export function readDiscoveryQuery(search, { kind, categories }) {
  const params = new URLSearchParams(search);
  const category = params.get('category') || 'all';
  const sort = params.get('sort') || 'default';
  return {
    category: categories.includes(category) ? category : 'all',
    q: (params.get('q') || '').slice(0, 100),
    sort: kind === 'note' && discoverySorts.has(sort) ? sort : 'default',
    savedOnly: kind === 'site' && params.get('saved') === '1'
  };
}

export function discoveryLocation(href, state, kind) {
  const url = new URL(href);
  const params = url.searchParams;
  for (const key of ['category', 'q', 'sort', 'saved']) params.delete(key);
  if (state.category && state.category !== 'all') params.set('category', state.category);
  const q = String(state.q || '').trim().slice(0, 100);
  if (q) params.set('q', q);
  if (kind === 'note' && discoverySorts.has(state.sort) && state.sort !== 'default') params.set('sort', state.sort);
  if (kind === 'site' && state.savedOnly) params.set('saved', '1');
  return `${url.pathname}${url.search}${url.hash}`;
}

export function createLibraryStore({ knownIds, storage = null, eventTarget = null, now = () => Date.now(), key = LIBRARY_KEY }) {
  const known = new Set([...knownIds].filter(id => typeof id === 'string' && id.length > 0));
  const subscribers = new Set();
  let state = emptyState();
  let persistent = Boolean(storage);
  if (storage) {
    try { state = normalizeLibraryState(storage.getItem(key), known); } catch { persistent = false; }
  }
  const notify = () => subscribers.forEach(subscriber => subscriber(cloneState(state)));
  function persist() {
    if (!persistent) return;
    try { storage.setItem(key, JSON.stringify(state)); } catch { persistent = false; }
  }
  function apply(next, write = true) {
    if (JSON.stringify(next) === JSON.stringify(state)) return false;
    state = next;
    if (write) persist();
    notify();
    return true;
  }
  function onStorage(event) {
    if ((event.key !== key && event.key !== null) || (event.storageArea && event.storageArea !== storage)) return;
    apply(normalizeLibraryState(event.key === null ? null : event.newValue, known), false);
  }
  eventTarget?.addEventListener('storage', onStorage);
  return {
    get persistent() { return persistent; },
    getState() { return cloneState(state); },
    isSaved(id) { return state.saved.includes(id); },
    toggleSaved(id) {
      if (!known.has(id)) return false;
      const saved = !state.saved.includes(id);
      apply({ ...state, saved: saved ? [id, ...state.saved] : state.saved.filter(entry => entry !== id) });
      return saved;
    },
    visit(id) {
      if (!known.has(id)) return false;
      const time = Number(now());
      const at = Number.isSafeInteger(time) && time > 0 && time <= MAX_TIMESTAMP ? time : Date.now();
      return apply({ ...state, recent: [{ id, at }, ...state.recent.filter(entry => entry.id !== id)].slice(0, RECENT_LIMIT) });
    },
    clearRecent() { return apply({ ...state, recent: [] }); },
    subscribe(subscriber) { subscribers.add(subscriber); return () => subscribers.delete(subscriber); },
    refresh() {
      if (!persistent) return false;
      try { return apply(normalizeLibraryState(storage.getItem(key), known), false); }
      catch { persistent = false; notify(); return false; }
    },
    dispose() { eventTarget?.removeEventListener('storage', onStorage); subscribers.clear(); }
  };
}
