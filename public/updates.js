import { UPDATE_SOURCE, readUpdateFeed, formatUpdateTime, updateFeedIsStale } from './updates-data.js';
import { renderUpdateCards } from './updates-render.js';

const root = document.querySelector('[data-updates]');
const list = root?.querySelector('[data-updates-list]');
const status = root?.querySelector('[data-updates-status]');
const metadata = root?.querySelector('[data-updates-meta]');
const refresh = root?.querySelector('[data-updates-refresh]');
const username = root?.dataset.username;

if (list && status && metadata && refresh && /^[a-z0-9_]{1,15}$/i.test(username || '')) {
  const storageKey = `bitdrift-updates:${username}`;
  const buttonLabel = refresh.querySelector('span');
  let current;
  let signature = '';
  let state = 'snapshot';
  let busy = false;
  let active = true;
  let hovered = false;
  let lastAttempt = 0;
  let timer;
  let controller;
  let generation = 0;

  function apply(feed, nextState) {
    const nextSignature = JSON.stringify(feed.items);
    if (signature !== nextSignature) {
      list.innerHTML = renderUpdateCards(feed);
      signature = nextSignature;
    }
    current = feed;
    state = nextState;
    root.dataset.state = nextState;
    metadata.textContent = `来源检查 ${formatUpdateTime(feed.sourceCheckedAt)} · 本站取得 ${formatUpdateTime(feed.fetchedAt)} · 北京时间`;
    showStatus();
  }
  function showStatus() {
    if (!current) {
      status.textContent = '暂时无法获取记录，可稍后重试或打开原站。';
      return;
    }
    const stale = updateFeedIsStale(current);
    if (state === 'stale' || stale) status.textContent = '来源暂不可用或数据已过期，保留已取得的记录。';
    else if (state === 'snapshot' || state === 'saved') status.textContent = '显示已保存的公开记录，尚未确认本轮更新。';
    else status.textContent = `${current.items.length} 条公开记录 · 每十分钟检查更新`;
  }
  function remember(feed) {
    try { localStorage.setItem(storageKey, JSON.stringify(feed)); } catch { /* 存储被阻止时仍可显示和刷新。 */ }
  }
  function idle() {
    return active && !document.hidden && !busy && !hovered && window.scrollY < 100 && !list.contains(document.activeElement);
  }
  function schedule(delay = Math.max(1000, UPDATE_SOURCE.interval - (Date.now() - lastAttempt))) {
    clearTimeout(timer);
    if (!active || document.hidden) return;
    timer = setTimeout(() => {
      if (idle()) update();
      else schedule(60000);
    }, delay);
  }
  async function update() {
    if (!active || document.hidden || busy) return;
    const request = ++generation;
    const operation = new AbortController();
    controller = operation;
    const timeout = setTimeout(() => operation.abort(), 12000);
    busy = true;
    lastAttempt = Date.now();
    clearTimeout(timer);
    refresh.disabled = true;
    buttonLabel.textContent = '检查中';
    root.setAttribute('aria-busy', 'true');
    status.textContent = '正在检查公开来源，已显示的记录仍可阅读…';
    try {
      const response = await fetch('/api/updates', {
        headers: { Accept: 'application/json' }, credentials: 'omit', cache: 'no-store', redirect: 'error', signal: operation.signal
      });
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Updates endpoint unavailable');
      const payload = await response.json();
      if (request !== generation || !active) return;
      if (payload.version !== 1 || !['live', 'cache', 'stale', 'snapshot'].includes(payload.state)) throw new Error('Invalid updates response');
      const feed = readUpdateFeed(payload.data, username);
      // 旧缓存或随部署保存的记录不能覆盖浏览器里较新的来源数据。
      if (current && Date.parse(feed.sourceCheckedAt) < Date.parse(current.sourceCheckedAt)) {
        state = 'stale';
        root.dataset.state = state;
        showStatus();
      } else {
        apply(feed, payload.state);
        remember(feed);
      }
    } catch {
      if (request !== generation || !active) return;
      state = 'stale';
      root.dataset.state = state;
      showStatus();
    } finally {
      clearTimeout(timeout);
      if (request === generation && active) {
        controller = null;
        busy = false;
        refresh.disabled = false;
        buttonLabel.textContent = '检查更新';
        root.setAttribute('aria-busy', 'false');
        schedule();
      }
    }
  }

  try { current = readUpdateFeed(JSON.parse(document.querySelector('#updates-data')?.textContent || 'null'), username); } catch {}
  try {
    const saved = readUpdateFeed(JSON.parse(localStorage.getItem(storageKey) || 'null'), username);
    if (!current || Date.parse(saved.sourceCheckedAt) > Date.parse(current.sourceCheckedAt)) { current = saved; state = 'saved'; }
  } catch {}
  if (current) apply(current, state);
  else showStatus();
  refresh.hidden = false;
  refresh.addEventListener('click', () => update());
  root.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') hovered = true; });
  root.addEventListener('pointerleave', () => { hovered = false; });
  document.addEventListener('visibilitychange', () => {
    clearTimeout(timer);
    if (!active || document.hidden) return;
    showStatus();
    if (Date.now() - lastAttempt >= UPDATE_SOURCE.interval && idle()) update();
    else schedule();
  });
  window.addEventListener('pagehide', () => {
    active = false;
    generation++;
    controller?.abort();
    controller = null;
    clearTimeout(timer);
    busy = false;
    hovered = false;
    refresh.disabled = false;
    buttonLabel.textContent = '检查更新';
    root.setAttribute('aria-busy', 'false');
  });
  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    active = true;
    showStatus();
    if (Date.now() - lastAttempt >= UPDATE_SOURCE.interval && idle()) update();
    else schedule();
  });
  if (!document.hidden) update();
}
