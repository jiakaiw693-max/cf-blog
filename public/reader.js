const READING_KEY = 'bitdrift-reading';
const PREFERENCE_KEY = 'bitdrift-reader';
const MAX_RECORDS = 200;

const clamp = value => Math.min(1, Math.max(0, value));

export function sanitizeReadingRecords(value, knownIds, now = Date.now()) {
  const records = Object.create(null);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return records;
  for (const [id, record] of Object.entries(value)) {
    if (!knownIds.has(id) || !record || typeof record !== 'object' || Array.isArray(record)) continue;
    if (typeof record.ratio !== 'number' || !Number.isFinite(record.ratio) || record.ratio <= 0 || record.ratio > 1) continue;
    if (typeof record.updatedAt !== 'number' || !Number.isFinite(record.updatedAt) || record.updatedAt <= 0 || record.updatedAt > now + 86400000) continue;
    records[id] = { ratio: record.ratio >= .995 ? 1 : Math.round(record.ratio * 10000) / 10000, updatedAt: record.updatedAt };
  }
  return Object.fromEntries(Object.entries(records).sort((a, b) => b[1].updatedAt - a[1].updatedAt).slice(0, MAX_RECORDS));
}

export function createReadingStore(storage, knownIds, now = Date.now) {
  let records = Object.create(null);
  function reload() {
    try {
      const raw = storage?.getItem(READING_KEY);
      if (raw !== undefined) records = sanitizeReadingRecords(raw ? JSON.parse(raw) : null, knownIds, now());
    } catch { /* Reading remains available when storage is unavailable. */ }
  }
  function persist() {
    try { storage?.setItem(READING_KEY, JSON.stringify(records)); } catch { /* Keep the current position in memory. */ }
  }
  reload();
  return {
    reload,
    get(id) { return Object.hasOwn(records, id) ? { ...records[id] } : null; },
    latest() {
      return Object.entries(records).filter(([, item]) => item.ratio >= .05 && item.ratio < 1)
        .sort((a, b) => b[1].updatedAt - a[1].updatedAt).map(([id, item]) => ({ id, ...item }))[0] || null;
    },
    save(id, ratio) {
      if (!knownIds.has(id) || typeof ratio !== 'number' || !Number.isFinite(ratio) || ratio < .01 || ratio > 1) return false;
      if (records[id]?.ratio === 1 && ratio < 1) return false;
      const value = ratio >= .995 ? 1 : Math.round(ratio * 10000) / 10000;
      if (records[id]?.ratio === value) return false;
      records[id] = { ratio: value, updatedAt: now() };
      records = sanitizeReadingRecords(records, knownIds, now());
      persist();
      return true;
    },
    reset(id) {
      if (!Object.hasOwn(records, id)) return;
      delete records[id];
      persist();
    }
  };
}

export function readingRange({ top, bottom, viewportHeight, offset = 110 }) {
  if (![top, bottom, viewportHeight, offset].every(Number.isFinite) || bottom <= top || viewportHeight <= 0) return null;
  const start = Math.max(0, top - offset);
  const end = Math.max(0, bottom - viewportHeight + 28);
  if (end > start) return { start, end };
  return { start: top - viewportHeight + 28, end: bottom - viewportHeight + 28 };
}

export function readingRatio(geometry) {
  const range = readingRange(geometry);
  if (!range || !Number.isFinite(geometry.scrollY)) return 0;
  return clamp((geometry.scrollY - range.start) / (range.end - range.start));
}

export function readingScrollTarget(geometry, ratio) {
  const range = readingRange(geometry);
  if (!range || !Number.isFinite(ratio)) return 0;
  return Math.max(0, range.start + clamp(ratio) * (range.end - range.start));
}

function safeStorage() {
  try { return window.localStorage; } catch { return null; }
}

export function readReaderSize(storage, current = 'normal') {
  if (!storage) return current;
  try {
    return JSON.parse(storage.getItem(PREFERENCE_KEY) || '{}')?.size === 'large' ? 'large' : 'normal';
  } catch { return current; }
}

function catalogueFromPage() {
  try {
    const data = JSON.parse(document.querySelector('#library-data')?.textContent || '[]');
    if (!Array.isArray(data)) return [];
    return data.filter(item => item?.kind === 'note' && typeof item.id === 'string' && /^note:[a-z0-9-]+$/.test(item.id)
      && typeof item.name === 'string' && item.name.length > 0 && item.name.length <= 200
      && item.href === `/notes/${item.id.slice(5)}/`).slice(0, MAX_RECORDS);
  } catch { return []; }
}

function initializeReader() {
  const catalogue = catalogueFromPage();
  const notes = new Map(catalogue.map(item => [item.id, item]));
  const storage = safeStorage();
  const store = createReadingStore(storage, new Set(notes.keys()));
  const html = document.documentElement;
  let size = readReaderSize(storage);
  let sizePreferencePersistent = Boolean(storage);
  html.dataset.readerSize = size;

  const continueContainer = document.querySelector('[data-continue-reading]');
  let continueSignature = null;
  function renderContinue() {
    if (!continueContainer) return;
    const latest = store.latest();
    const note = latest && notes.get(latest.id);
    const signature = note ? `${note.id}:${latest.ratio}` : 'empty';
    if (signature === continueSignature) return;
    continueSignature = signature;
    continueContainer.hidden = !note;
    continueContainer.replaceChildren();
    if (!note) {
      window.dispatchEvent(new CustomEvent('bitdrift:readingchange', { detail: { visible: false } }));
      return;
    }
    const label = document.createElement('span');
    label.className = 'mono continue-label';
    label.textContent = '上次读到这里';
    const link = document.createElement('a');
    link.className = 'continue-title';
    link.dataset.visitItem = note.id;
    link.href = note.href;
    link.textContent = note.name;
    const copy = document.createElement('div');
    const detail = document.createElement('p');
    detail.className = 'continue-meta';
    detail.textContent = `上次读到 ${Math.round(latest.ratio * 100)}%`;
    copy.append(label, link, detail);
    const arrow = document.createElement('a');
    arrow.className = 'text-link';
    arrow.dataset.visitItem = note.id;
    arrow.href = note.href;
    arrow.textContent = '继续阅读 →';
    arrow.setAttribute('aria-label', `继续阅读：${note.name}`);
    continueContainer.append(copy, arrow);
    window.dispatchEvent(new CustomEvent('bitdrift:readingchange', { detail: { visible: true, id: note.id, ratio: latest.ratio } }));
  }
  renderContinue();
  window.addEventListener('pageshow', () => { store.reload(); renderContinue(); });
  window.addEventListener('storage', event => {
    if (event.key === READING_KEY || event.key === null) { store.reload(); renderContinue(); }
  });

  const page = document.querySelector('main.article-page[data-reading-id]');
  const article = page?.querySelector('article.article-content');
  const body = article?.querySelector('.article-body');
  const id = page?.dataset.readingId;
  if (!body || !notes.has(id)) return;
  html.classList.add('reader-ready');

  const toolbar = page.querySelector('.reader-toolbar');
  const settingsToggle = toolbar?.querySelector('.reader-settings-toggle');
  const settings = toolbar?.querySelector('.reader-settings');
  const settingsClose = settings?.querySelector('.reader-settings-close');
  const settingsResetButtons = [...(settings?.querySelectorAll('[data-reader-reset]') || [])];
  const focusButton = toolbar?.querySelector('[data-reader-focus]');
  const sizeButtons = [...(toolbar?.querySelectorAll('[data-reader-size]') || [])];
  const progress = page.querySelector('.reader-progress');
  const percent = page.querySelector('.reader-percent');
  const resumeBanner = page.querySelector('.reader-resume');
  const prior = store.get(id);
  let resumeRatio = prior?.ratio || 0;
  let readerIntent = false;
  let dirty = false;
  let frame = 0;
  let lastWrite = 0;
  let lastRatio = prior?.ratio || 0;
  let displayedPercent = -1;

  const toc = [...article.querySelectorAll('.article-toc a[href^="#"]')].map(link => {
    let target;
    try { target = document.getElementById(decodeURIComponent(link.hash.slice(1))); } catch { return null; }
    return target && body.contains(target) ? { link, target } : null;
  }).filter(Boolean);

  function isSectionHash() {
    try {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      return Boolean(location.hash && target && body.contains(target));
    } catch { return false; }
  }
  if (resumeBanner) {
    resumeBanner.hidden = resumeRatio < .05 || resumeRatio >= 1 || isSectionHash();
    const message = resumeBanner.querySelector('.reader-resume-message');
    if (message && !resumeBanner.hidden) message.textContent = `上次读到 ${Math.round(resumeRatio * 100)}%，可以从这里继续。`;
  }

  function geometry() {
    const bounds = body.getBoundingClientRect();
    const toolbarTop = toolbar ? Number.parseFloat(getComputedStyle(toolbar).top) || 0 : 0;
    const toolbarBottom = toolbarTop + (toolbar?.getBoundingClientRect().height || 0);
    return {
      top: bounds.top + window.scrollY,
      bottom: bounds.bottom + window.scrollY,
      viewportHeight: window.innerHeight,
      scrollY: window.scrollY,
      offset: Math.max(110, toolbarBottom + 22)
    };
  }
  function savePosition(ratio, force = false) {
    if (!readerIntent || !dirty) return;
    const now = Date.now();
    if (!force && ratio < .995 && (now - lastWrite < 1500 || Math.abs(ratio - lastRatio) < .02)) return;
    if (store.save(id, ratio)) {
      lastWrite = now;
      lastRatio = ratio;
      syncResetButtons();
      window.dispatchEvent(new CustomEvent('bitdrift:readingchange', { detail: { id, ratio } }));
    }
    dirty = false;
  }
  function update() {
    frame = 0;
    if (document.hidden) return;
    const bounds = geometry();
    html.style.setProperty('--reader-scroll-offset', `${Math.ceil(bounds.offset)}px`);
    const ratio = readingRatio(bounds);
    const value = ratio >= .995 ? 100 : Math.min(99, Math.round(ratio * 100));
    if (displayedPercent !== value) {
      displayedPercent = value;
      if (percent) percent.textContent = `${value}%`;
      if (progress) {
        progress.setAttribute('aria-valuenow', String(value));
        progress.setAttribute('aria-valuetext', `阅读进度 ${value}%`);
        progress.style.setProperty('--reading-progress', `${value}%`);
        const filler = progress.querySelector('span');
        if (filler) filler.style.transform = `scaleX(${ratio})`;
      }
    }
    const line = Math.max(130, (toolbar?.getBoundingClientRect().bottom || 0) + 28);
    let current = toc[0];
    for (const item of toc) { if (item.target.getBoundingClientRect().top <= line) current = item; }
    toc.forEach(item => {
      if (item === current) item.link.setAttribute('aria-current', 'location');
      else item.link.removeAttribute('aria-current');
    });
    savePosition(ratio);
  }
  function schedule() {
    if (!frame && !document.hidden) frame = requestAnimationFrame(update);
  }
  function flush() {
    if (frame) { cancelAnimationFrame(frame); frame = 0; }
    savePosition(readingRatio(geometry()), true);
  }
  function markIntent() { readerIntent = true; }
  window.addEventListener('wheel', markIntent, { passive: true });
  window.addEventListener('touchmove', markIntent, { passive: true });
  document.addEventListener('pointerdown', event => {
    if (event.clientX >= document.documentElement.clientWidth - 20) markIntent();
  }, { passive: true });
  document.addEventListener('keydown', event => {
    if (!['PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'Home', 'End', ' '].includes(event.key)) return;
    if (event.target.closest('input,textarea,select,[contenteditable="true"],dialog[open]') || event.ctrlKey || event.metaKey || event.altKey) return;
    markIntent();
  });
  window.addEventListener('scroll', () => { dirty = readerIntent; schedule(); }, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('pagehide', () => { closeSettings(); flush(); });
  window.addEventListener('pageshow', () => { refreshSize(); syncResetButtons(); schedule(); });
  window.addEventListener('storage', event => {
    if (event.storageArea && event.storageArea !== storage) return;
    if (event.key === PREFERENCE_KEY || event.key === null) refreshSize();
    if (event.key === READING_KEY || event.key === null) syncResetButtons();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); else schedule(); });
  window.addEventListener('hashchange', () => {
    if (isSectionHash()) { markIntent(); dirty = true; if (resumeBanner) resumeBanner.hidden = true; }
    schedule();
  });
  toc.forEach(({ link }) => link.addEventListener('click', () => {
    markIntent();
    dirty = true;
    if (resumeBanner) resumeBanner.hidden = true;
  }));

  function syncSize() {
    html.dataset.readerSize = size;
    sizeButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.readerSize === size)));
  }
  function refreshSize() {
    if (!sizePreferencePersistent) return;
    const next = readReaderSize(storage, size);
    if (next !== size) preservePosition(() => { size = next; syncSize(); });
  }
  function syncResetButtons() {
    const hasRecord = (store.get(id)?.ratio || 0) > 0;
    settingsResetButtons.forEach(button => { button.hidden = !hasRecord; });
  }
  function preservePosition(change) {
    const ratio = readingRatio(geometry());
    const previousScroll = window.scrollY;
    change();
    window.scrollTo({ top: ratio > 0 ? readingScrollTarget(geometry(), ratio) : previousScroll, behavior: 'instant' });
    schedule();
  }
  function closeSettings(returnFocus = false) {
    if (!settings || !settingsToggle) return;
    settings.hidden = true;
    settingsToggle.setAttribute('aria-expanded', 'false');
    if (returnFocus) settingsToggle.focus({ preventScroll: true });
  }
  function setFocus(focus) {
    preservePosition(() => {
      closeSettings();
      document.body.classList.toggle('reading-focus', focus);
      focusButton?.setAttribute('aria-pressed', String(focus));
      if (focusButton) focusButton.textContent = focus ? '退出专注' : '专注阅读';
      if (settingsToggle) {
        settingsToggle.textContent = focus ? '退出专注' : '阅读设置';
        settingsToggle.setAttribute('aria-label', focus ? '退出专注阅读' : '阅读设置');
      }
    });
    settingsToggle?.focus({ preventScroll: true });
  }
  settingsToggle?.addEventListener('click', () => {
    settingsToggle.focus({ preventScroll: true });
    if (document.body.classList.contains('reading-focus')) { setFocus(false); return; }
    if (!settings) return;
    if (!settings.hidden) { closeSettings(true); return; }
    window.dispatchEvent(new CustomEvent('bitdrift:panelopen', { detail: { source: 'reader' } }));
    settings.hidden = false;
    settingsToggle.setAttribute('aria-expanded', 'true');
    (sizeButtons.find(button => button.getAttribute('aria-pressed') === 'true') || focusButton || settingsClose)?.focus({ preventScroll: true });
  });
  settingsClose?.addEventListener('click', () => closeSettings(true));
  settings?.addEventListener('focusout', event => {
    if (!settings.contains(event.relatedTarget) && event.relatedTarget !== settingsToggle) closeSettings();
  });
  document.addEventListener('pointerdown', event => {
    if (settings && !settings.hidden && !settings.contains(event.target) && !settingsToggle?.contains(event.target)) closeSettings();
  }, { passive: true });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && settings && !settings.hidden) {
      event.preventDefault();
      closeSettings(true);
    }
  });
  window.addEventListener('bitdrift:panelopen', event => {
    if (event.detail?.source !== 'reader') closeSettings();
  });
  syncSize();
  syncResetButtons();
  sizeButtons.forEach(button => button.addEventListener('click', () => {
    if (!['normal', 'large'].includes(button.dataset.readerSize) || button.dataset.readerSize === size) return;
    preservePosition(() => { size = button.dataset.readerSize; syncSize(); });
    try { storage?.setItem(PREFERENCE_KEY, JSON.stringify({ size })); }
    catch { sizePreferencePersistent = false; }
  }));
  focusButton?.addEventListener('click', () => setFocus(!document.body.classList.contains('reading-focus')));
  resumeBanner?.querySelector('[data-reader-resume]')?.addEventListener('click', () => {
    resumeBanner.hidden = true;
    markIntent();
    dirty = true;
    window.scrollTo({ top: readingScrollTarget(geometry(), resumeRatio), behavior: 'instant' });
    (settingsToggle || focusButton)?.focus({ preventScroll: true });
    schedule();
  });
  page.querySelectorAll('[data-reader-reset]').forEach(button => button.addEventListener('click', () => {
    if (resumeBanner) resumeBanner.hidden = true;
    store.reset(id);
    syncResetButtons();
    closeSettings();
    window.dispatchEvent(new CustomEvent('bitdrift:readingchange', { detail: { id, ratio: 0 } }));
    resumeRatio = 0;
    lastRatio = 0;
    lastWrite = 0;
    readerIntent = false;
    dirty = false;
    window.scrollTo({ top: 0, behavior: 'instant' });
    (settingsToggle || focusButton)?.focus({ preventScroll: true });
    schedule();
  }));
  if (isSectionHash()) { readerIntent = true; dirty = true; }
  update();
}

if (typeof document !== 'undefined') initializeReader();
