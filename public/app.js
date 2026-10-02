const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.main-nav');
function closeNav() {
  if (!toggle || !nav) return;
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', '打开导航');
  nav.classList.remove('is-open');
}
toggle?.addEventListener('click', () => {
  const opened = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded', String(opened));
  toggle.setAttribute('aria-label', opened ? '关闭导航' : '打开导航');
  nav?.classList.toggle('is-open', opened);
});
nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', closeNav));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && toggle?.getAttribute('aria-expanded') === 'true') {
    closeNav();
    toggle.focus();
  }
});
document.querySelector('.copy-account')?.addEventListener('click', async event => {
  const button = event.currentTarget;
  const status = document.querySelector('.copy-status');
  try {
    await navigator.clipboard.writeText(button.dataset.copy);
    status.textContent = '已复制。打开小红书，搜索这个账号名即可。';
  } catch {
    status.textContent = `请长按或选中复制账号名：${button.dataset.copy}`;
  }
});
