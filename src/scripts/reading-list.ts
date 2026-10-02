import { showToast } from './toast';
const key = 'cf-blog:bookmarks:v1';
let knownIds = new Set<string>();
try {
  const data: unknown = JSON.parse(document.querySelector('#public-post-ids')?.textContent ?? '[]');
  if (Array.isArray(data)) knownIds = new Set(data.filter((id): id is string => typeof id === 'string'));
} catch {}

function readSaved(): Set<string> {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return new Set(Array.isArray(data) ? data.slice(0, 500).filter((id): id is string => typeof id === 'string' && knownIds.has(id)) : []);
  } catch { return new Set(); }
}
function writeSaved(ids: Set<string>) {
  try { localStorage.setItem(key, JSON.stringify([...ids].slice(0, 500))); return true; }
  catch { showToast('当前浏览器无法保存收藏，请检查存储设置。'); return false; }
}
function refresh() {
  const ids = readSaved();
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-save-post]')) {
    const saved = ids.has(button.dataset.savePost ?? '');
    button.setAttribute('aria-pressed', String(saved));
    button.setAttribute('aria-label', `${saved ? '取消收藏' : '收藏'}：${button.dataset.postTitle ?? '文章'}`);
    button.title = saved ? '取消收藏' : '收藏到稍后读';
    const label = button.querySelector('.save-label');
    if (label) label.textContent = saved ? '已收藏' : '稍后读';
  }
  for (const badge of document.querySelectorAll<HTMLElement>('[data-saved-count]')) {
    badge.textContent = String(ids.size); badge.hidden = ids.size === 0;
  }
  document.querySelector('.saved-link')?.setAttribute('aria-label', `稍后读，${ids.size} 篇收藏`);
  if (document.querySelector('[data-reading-list]')) {
    for (const item of document.querySelectorAll<HTMLElement>('[data-saved-id]')) item.hidden = !ids.has(item.dataset.savedId ?? '');
    const empty = document.querySelector<HTMLElement>('[data-saved-empty]');
    if (empty) empty.hidden = ids.size > 0;
    const clear = document.querySelector<HTMLButtonElement>('#clear-saved');
    if (clear) clear.hidden = ids.size === 0;
    const status = document.querySelector('#saved-status');
    if (status) status.textContent = ids.size ? `已收藏 ${ids.size} 篇文章` : '还没有收藏文章';
  }
}
refresh();
document.addEventListener('click', event => {
  const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-save-post]') : null;
  const id = button?.dataset.savePost;
  if (!id || !knownIds.has(id)) return;
  const ids = readSaved(), wasSaved = ids.has(id);
  if (wasSaved) ids.delete(id);
  else {
    if (ids.size >= 500) { showToast('最多收藏 500 篇文章，先整理一下收藏吧。'); return; }
    ids.add(id);
  }
  if (writeSaved(ids)) { refresh(); showToast(wasSaved ? '已从稍后读移除' : '已收藏，留给稍后慢慢读。'); }
});
document.querySelector('#clear-saved')?.addEventListener('click', () => {
  if (writeSaved(new Set())) { refresh(); showToast('收藏已清空'); }
});
window.addEventListener('storage', event => { if (event.key === key || event.key === null) refresh(); });
window.addEventListener('pageshow', refresh);
