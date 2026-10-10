// 仅动态页加载 X 官方组件；不请求付费 API，也不保存第三方账号数据。
const feed = document.querySelector('[data-x-feed]');
const host = feed?.querySelector('[data-x-host]');
const placeholder = feed?.querySelector('[data-x-placeholder]');
const status = feed?.querySelector('[data-x-status]');
const refresh = feed?.querySelector('[data-x-refresh]');
const username = feed?.dataset.xUsername;

if (host && placeholder && status && refresh && /^[a-z0-9_]{1,15}$/i.test(username || '')) {
  const interval = 5 * 60 * 1000;
  let widgetsPromise;
  let generation = 0;
  let currentStage;
  let pendingStage;
  let currentTheme;
  let busy = false;
  let active = true;
  let hovered = false;
  let lastAttempt = 0;
  let reloadTimer;
  let cancelRender;
  const theme = () => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  const api = () => window.twttr?.widgets?.createTimeline ? window.twttr.widgets : null;

  function loadWidgets() {
    if (api()) return Promise.resolve(api());
    if (widgetsPromise) return widgetsPromise;
    widgetsPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://platform.twitter.com/widgets.js';
      script.async = true;
      let finished = false;
      const timeout = setTimeout(() => finish(new Error('X component timed out')), 18000);
      function finish(error) {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        script.onload = script.onerror = null;
        if (error) {
          script.remove();
          reject(error);
        } else {
          resolve(api());
        }
      }
      script.onload = () => {
        if (api()) finish();
        else if (window.twttr?.ready) window.twttr.ready(() => api() ? finish() : finish(new Error('X component unavailable')));
        else finish(new Error('X component unavailable'));
      };
      script.onerror = () => finish(new Error('X component unavailable'));
      document.head.append(script);
    }).catch(error => {
      widgetsPromise = null;
      throw error;
    });
    return widgetsPromise;
  }

  // 自动刷新只发生在页顶空闲时，避免打断正在阅读或操作时间线的人。
  function canReload() {
    return active && !document.hidden && !busy && !hovered && window.scrollY < 80 && !host.contains(document.activeElement);
  }
  function scheduleReload(delay = Math.max(1000, interval - (Date.now() - lastAttempt))) {
    clearTimeout(reloadTimer);
    if (!active || document.hidden) return;
    reloadTimer = setTimeout(() => {
      if (canReload()) render();
      else scheduleReload(60000);
    }, delay);
  }

  async function render() {
    if (!active || document.hidden) return;
    cancelRender?.();
    pendingStage?.remove();
    const request = ++generation;
    const requestedTheme = theme();
    const stage = document.createElement('div');
    stage.className = 'updates-stage';
    stage.dataset.pending = '';
    stage.setAttribute('aria-hidden', 'true');
    stage.inert = true;
    host.append(stage);
    pendingStage = stage;
    busy = true;
    lastAttempt = Date.now();
    clearTimeout(reloadTimer);
    refresh.disabled = true;
    refresh.querySelector('span').textContent = '加载中';
    host.setAttribute('aria-busy', 'true');
    feed.dataset.state = 'loading';
    status.textContent = currentStage ? '正在重新载入时间线…' : '正在加载 X 时间线…';
    let deadline;
    const cancelled = new Promise((_, reject) => {
      cancelRender = () => reject(new Error('X render superseded'));
      deadline = setTimeout(() => reject(new Error('X timeline timed out')), 30000);
    });
    try {
      const result = await Promise.race([
        loadWidgets().then(widgets => {
          if (request !== generation || !active) throw new Error('X render superseded');
          return widgets.createTimeline({ sourceType: 'profile', screenName: username }, stage, {
            theme: requestedTheme, height: 640, dnt: true, lang: 'zh-cn'
          });
        }),
        cancelled
      ]);
      if (request !== generation || !active) return;
      if (!result || result.tagName !== 'IFRAME') throw new Error('X timeline unavailable');
      result.title = `@${username} 的 X 时间线`;
      currentStage?.remove();
      currentStage = stage;
      currentTheme = requestedTheme;
      delete stage.dataset.pending;
      stage.removeAttribute('aria-hidden');
      stage.inert = false;
      placeholder.hidden = true;
      feed.dataset.state = 'ready';
      const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      status.textContent = `最近载入 ${time} · 内容由 X 提供`;
    } catch {
      stage.remove();
      if (request !== generation || !active) return;
      feed.dataset.state = currentStage ? 'ready' : 'error';
      status.textContent = currentStage
        ? '刷新暂时不可用，仍显示上次载入的时间线。'
        : '时间线暂时未能加载，可重试或打开 X 查看。';
    } finally {
      clearTimeout(deadline);
      if (request === generation && active) {
        cancelRender = null;
        pendingStage = null;
        busy = false;
        refresh.disabled = false;
        refresh.querySelector('span').textContent = '刷新动态';
        host.setAttribute('aria-busy', 'false');
        scheduleReload();
      }
    }
  }

  refresh.hidden = false;
  refresh.addEventListener('click', () => render());
  feed.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') hovered = true; });
  feed.addEventListener('pointerleave', () => { hovered = false; });
  window.addEventListener('bitdrift:themechange', () => {
    if (currentTheme !== theme() || busy) render();
  });
  document.addEventListener('visibilitychange', () => {
    clearTimeout(reloadTimer);
    if (!active || document.hidden) return;
    if (currentTheme !== theme() || (Date.now() - lastAttempt >= interval && canReload())) render();
    else scheduleReload();
  });
  window.addEventListener('pagehide', () => {
    active = false;
    generation++;
    clearTimeout(reloadTimer);
    cancelRender?.();
    cancelRender = null;
    pendingStage?.remove();
    pendingStage = null;
    busy = false;
    hovered = false;
    refresh.disabled = false;
    refresh.querySelector('span').textContent = '刷新动态';
    host.setAttribute('aria-busy', 'false');
  });
  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    active = true;
    if (!currentStage || currentTheme !== theme()) render();
    else scheduleReload();
  });
  if (!document.hidden) render();
}
