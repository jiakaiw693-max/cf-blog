const root = document.documentElement;
const themeButton = document.querySelector<HTMLButtonElement>('.theme-toggle');
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');

function updateThemeLabel() {
  const label = root.dataset.theme === 'dark' ? '切换为浅色模式' : '切换为深色模式';
  themeButton?.setAttribute('aria-label', label);
  themeButton?.setAttribute('title', label);
}
updateThemeLabel();
themeButton?.addEventListener('click', () => {
  root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('blog-theme', root.dataset.theme); } catch {}
  updateThemeLabel();
});
systemTheme.addEventListener('change', event => {
  let saved = null;
  try { saved = localStorage.getItem('blog-theme'); } catch {}
  if (saved !== 'light' && saved !== 'dark') {
    root.dataset.theme = event.matches ? 'dark' : 'light';
    updateThemeLabel();
  }
});

const menu = document.querySelector<HTMLButtonElement>('.menu-toggle');
const nav = document.querySelector<HTMLElement>('#site-nav');
function closeMenu() {
  menu?.setAttribute('aria-expanded', 'false');
  menu?.setAttribute('aria-label', '展开导航');
  nav?.classList.remove('is-open');
}
menu?.addEventListener('click', () => {
  const expanded = menu.getAttribute('aria-expanded') === 'true';
  menu.setAttribute('aria-expanded', String(!expanded));
  menu.setAttribute('aria-label', expanded ? '展开导航' : '收起导航');
  nav?.classList.toggle('is-open', !expanded);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menu?.getAttribute('aria-expanded') === 'true') {
    closeMenu(); menu.focus();
  }
});
document.addEventListener('click', event => {
  if (event.target instanceof Node && !nav?.contains(event.target) && !menu?.contains(event.target)) closeMenu();
});
window.matchMedia('(min-width: 761px)').addEventListener('change', closeMenu);

for (const pre of document.querySelectorAll<HTMLPreElement>('.prose pre')) {
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'copy-code'; button.textContent = '复制';
  button.setAttribute('aria-label', '复制代码');
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(pre.querySelector('code')?.textContent ?? '');
      button.textContent = '已复制';
    } catch { button.textContent = '请手动复制'; }
    window.setTimeout(() => { button.textContent = '复制'; }, 1800);
  });
  pre.append(button);
}
