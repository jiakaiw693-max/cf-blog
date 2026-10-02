const root = document.documentElement;
const fontButton = document.querySelector<HTMLButtonElement>('.font-toggle');
function refreshFontButton() {
  const large = root.dataset.fontSize === 'large';
  fontButton?.setAttribute('aria-pressed', String(large));
  fontButton?.setAttribute('aria-label', large ? '恢复正常正文字号' : '放大正文字号');
}
refreshFontButton();
function syncFontPreference() {
  try { root.dataset.fontSize = localStorage.getItem('blog-font-size') === 'large' ? 'large' : 'normal'; } catch {}
  refreshFontButton();
}
fontButton?.addEventListener('click', () => {
  root.dataset.fontSize = root.dataset.fontSize === 'large' ? 'normal' : 'large';
  try { localStorage.setItem('blog-font-size', root.dataset.fontSize); } catch {}
  refreshFontButton();
});
window.addEventListener('storage', event => {
  if (event.key === 'blog-font-size' || event.key === null) {
    syncFontPreference();
  }
});
window.addEventListener('pageshow', syncFontPreference);

const body = document.querySelector<HTMLElement>('[data-reading-body]');
const progress = document.querySelector<HTMLElement>('.reading-progress');
const progressFill = progress?.querySelector<HTMLElement>('span');
const percentage = document.querySelector('.toc-percent');
const details = document.querySelector<HTMLDetailsElement>('.toc-details');
const desktop = window.matchMedia('(min-width: 981px)');
if (details) { details.open = desktop.matches; desktop.addEventListener('change', event => { details.open = event.matches; }); }
const tocLinks = [...document.querySelectorAll<HTMLAnchorElement>('.toc a')].map(link => {
  let id = ''; try { id = decodeURIComponent(link.hash.slice(1)); } catch {}
  return { link, heading: document.getElementById(id) };
}).filter(item => item.heading);
if (body && progress) {
  let frame = 0;
  function update() {
    frame = 0;
    if (!body || !progress) return;
    const bounds = body.getBoundingClientRect();
    const start = bounds.top + scrollY - 120;
    const end = bounds.bottom + scrollY - innerHeight + 80;
    const value = Math.round(Math.max(0, Math.min(1, (scrollY - start) / Math.max(1, end - start))) * 100);
    progress.setAttribute('aria-valuenow', String(value));
    if (progressFill) progressFill.style.transform = `scaleX(${value / 100})`;
    if (percentage) percentage.textContent = `${value}%`;
    let active = tocLinks[0];
    for (const item of tocLinks) if ((item.heading?.getBoundingClientRect().top ?? Infinity) <= 170) active = item;
    for (const item of tocLinks) {
      if (item === active) item.link.setAttribute('aria-current', 'location');
      else item.link.removeAttribute('aria-current');
    }
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(body);
  update();
}
export {};
