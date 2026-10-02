import './reading-list';
import './reader';
import { showToast } from './toast';
const root = document.documentElement;
const themeButton = document.querySelector<HTMLButtonElement>('.theme-toggle');
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
function updateThemeLabel() {
  const label = root.dataset.theme === 'dark' ? '切换为浅色模式' : '切换为深色模式';
  themeButton?.setAttribute('aria-label', label); themeButton?.setAttribute('title', label);
}
updateThemeLabel();
themeButton?.addEventListener('click', () => {
  root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('blog-theme', root.dataset.theme); } catch {}
  updateThemeLabel();
});
function syncTheme() {
  let saved = null; try { saved = localStorage.getItem('blog-theme'); } catch {}
  root.dataset.theme = saved === 'light' || saved === 'dark' ? saved : systemTheme.matches ? 'dark' : 'light';
  updateThemeLabel();
}
systemTheme.addEventListener('change', syncTheme);
window.addEventListener('storage', event => { if (event.key === 'blog-theme' || event.key === null) syncTheme(); });
window.addEventListener('pageshow', syncTheme);
const menu = document.querySelector<HTMLButtonElement>('.menu-toggle');
const nav = document.querySelector<HTMLElement>('#site-nav');
function closeMenu() {
  menu?.setAttribute('aria-expanded', 'false'); menu?.setAttribute('aria-label', '展开导航'); nav?.classList.remove('is-open');
}
menu?.addEventListener('click', event => {
  const expanded = menu.getAttribute('aria-expanded') === 'true';
  menu.setAttribute('aria-expanded', String(!expanded)); menu.setAttribute('aria-label', expanded ? '展开导航' : '收起导航'); nav?.classList.toggle('is-open', !expanded);
  if (!expanded && event.detail === 0) nav?.querySelector<HTMLAnchorElement>('a')?.focus();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menu?.getAttribute('aria-expanded') === 'true') { closeMenu(); menu.focus(); }
  if (event.isComposing || event.repeat || event.altKey) return;
  const editing = event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable="true"]');
  const shortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
  if (shortcut || (!editing && !event.ctrlKey && !event.metaKey && event.key === '/')) {
    event.preventDefault();
    const search = document.querySelector<HTMLInputElement>('#search-input');
    if (search) search.focus(); else location.assign('/search/#search-input');
  }
});
document.addEventListener('click', event => {
  if (event.target instanceof Node && !nav?.contains(event.target) && !menu?.contains(event.target)) closeMenu();
});
window.matchMedia('(min-width: 761px)').addEventListener('change', closeMenu);
async function copyText(text: string, success: string) {
  try { await navigator.clipboard.writeText(text); showToast(success); return true; }
  catch { showToast('复制未成功，请手动选择内容复制。'); return false; }
}
for (const pre of document.querySelectorAll<HTMLPreElement>('.prose pre')) {
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'copy-code'; button.textContent = '复制'; button.setAttribute('aria-label', '复制代码');
  let timer = 0;
  button.addEventListener('click', async () => {
    button.disabled = true;
    const success = await copyText(pre.querySelector('code')?.textContent ?? '', '代码已复制');
    button.disabled = false; button.textContent = success ? '已复制' : '请手动复制';
    window.clearTimeout(timer); timer = window.setTimeout(() => { button.textContent = '复制'; }, 1800);
  });
  pre.append(button);
}
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-copy-path],[data-copy-link]')) {
  button.addEventListener('click', async () => {
    const value = button.dataset.copyPath ? new URL(button.dataset.copyPath, location.origin).href : new URL(location.pathname, location.origin).href;
    button.disabled = true; await copyText(value, button.dataset.copyPath ? '订阅地址已复制' : '文章链接已复制'); button.disabled = false;
  });
}
const topButton = document.querySelector<HTMLButtonElement>('.back-to-top');
let topFrame = 0;
function updateTopButton() { topFrame = 0; if (topButton) topButton.hidden = scrollY < 500; }
addEventListener('scroll', () => { if (!topFrame) topFrame = requestAnimationFrame(updateTopButton); }, { passive: true });
topButton?.addEventListener('click', () => { scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); });
updateTopButton();
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
if (!reduce.matches && 'IntersectionObserver' in window) {
  root.dataset.motion = 'ready';
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) { entry.target.classList.add('is-revealed'); observer.unobserve(entry.target); }
  }, { threshold: 0.05 });
  for (const element of document.querySelectorAll('[data-reveal]')) observer.observe(element);
  reduce.addEventListener('change', event => { if (event.matches) { delete root.dataset.motion; observer.disconnect(); } });
}
