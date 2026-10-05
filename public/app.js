const html = document.documentElement;
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.main-nav');
const themeToggle = document.querySelector('.theme-toggle');
const themeMenu = document.querySelector('.theme-menu');
const themeChoices = [...document.querySelectorAll('[data-theme-choice]')];
const themeStatus = document.querySelector('.theme-status');
const themeNames = { light: '浅色', dark: '深色', system: '跟随系统' };
function closeTheme(returnFocus = false) {
  if (!themeMenu || !themeToggle) return;
  themeMenu.hidden = true;
  themeToggle.setAttribute('aria-expanded', 'false');
  if (returnFocus) themeToggle.focus();
}
function syncTheme(announce = false) {
  const preference = window.bitdriftTheme?.preference || 'system';
  const resolved = document.documentElement.dataset.theme;
  themeChoices.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.themeChoice === preference)));
  const description = preference === 'system' ? `跟随系统，当前为${themeNames[resolved]}` : themeNames[preference];
  if (themeToggle) themeToggle.title = `外观设置：${description}`;
  if (announce && themeStatus) themeStatus.textContent = `外观已设为${description}。`;
}
themeToggle?.addEventListener('click', () => {
  if (!themeMenu) return;
  const open = themeMenu.hidden;
  closeNav();
  window.dispatchEvent(new CustomEvent('bitdrift:panelopen'));
  themeMenu.hidden = !open;
  themeToggle.setAttribute('aria-expanded', String(open));
  if (open) themeChoices.find(button => button.getAttribute('aria-pressed') === 'true')?.focus();
});
themeChoices.forEach(button => button.addEventListener('click', () => {
  window.bitdriftTheme?.set(button.dataset.themeChoice);
  closeTheme(true);
}));
window.addEventListener('bitdrift:themechange', () => syncTheme(true));
document.addEventListener('click', event => {
  if (!event.target.closest('.theme-control')) closeTheme();
});
document.querySelector('.theme-control')?.addEventListener('focusout', event => {
  if (!event.currentTarget.contains(event.relatedTarget)) closeTheme();
});
syncTheme();
function closeNav() {
  if (!toggle || !nav) return;
  toggle.setAttribute('aria-expanded','false');
  toggle.setAttribute('aria-label','打开导航');
  nav.classList.remove('is-open');
}
toggle?.addEventListener('click', () => {
  closeTheme();
  window.dispatchEvent(new CustomEvent('bitdrift:panelopen'));
  const opened = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded',String(opened));
  toggle.setAttribute('aria-label',opened ? '关闭导航' : '打开导航');
  nav?.classList.toggle('is-open',opened);
});
document.addEventListener('click', event => { if (!event.target.closest('.main-nav, .menu-toggle')) closeNav(); });
nav?.addEventListener('focusout', event => { if (!nav.contains(event.relatedTarget) && event.relatedTarget !== toggle) closeNav(); });
nav?.querySelectorAll('a').forEach(link => link.addEventListener('click',closeNav));
document.addEventListener('keydown',event => {
  if (event.key === 'Escape' && themeMenu && !themeMenu.hidden) { event.preventDefault(); closeTheme(true); return; }
  if (event.key === 'Escape' && toggle?.getAttribute('aria-expanded') === 'true') { event.preventDefault(); closeNav(); toggle.focus(); }
});
matchMedia('(min-width: 961px)').addEventListener('change',closeNav);
document.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click',async () => {
  const kind = button.dataset.copyKind;
  const status = document.querySelector(kind === 'email' ? '.email-status' : '.account-status');
  try {
    await navigator.clipboard.writeText(button.dataset.copy);
    if (status) status.textContent = kind === 'email' ? `邮箱已复制：${button.dataset.copy}` : '账号名已复制。打开小红书搜索即可。';
    window.dispatchEvent(new CustomEvent('bitdrift:copied', { detail: { button } }));
  } catch { if (status) status.textContent = `请选中复制：${button.dataset.copy}`; }
}));

window.addEventListener('bitdrift:results', () => scheduleFrame());

const revealElements = [...document.querySelectorAll('[data-reveal]')];
let revealObserver;
if (!motionPreference.matches && 'IntersectionObserver' in window) {
  html.classList.add('motion-ready');
  revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.remove('reveal-pending'); revealObserver.unobserve(entry.target); }
  }),{threshold:0,rootMargin:'0px 0px -35px 0px'});
  revealElements.forEach(element => {
    if (element.getBoundingClientRect().top >= innerHeight - 35) { element.classList.add('reveal-pending'); revealObserver.observe(element); }
  });
}
const navLinks = [...document.querySelectorAll('[data-section]')];
if ('IntersectionObserver' in window && document.querySelector('.home-page')) {
  const sectionObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    navLinks.forEach(link => {
      const current = link.dataset.section === entry.target.id;
      link.classList.toggle('is-current',current);
      if (current) link.setAttribute('aria-current','location'); else link.removeAttribute('aria-current');
    });
  }),{rootMargin:'-18% 0px -60% 0px',threshold:0});
  document.querySelectorAll('main>section[id]').forEach(section => sectionObserver.observe(section));
}

const motionButton = document.querySelector('.motion-toggle');
const hero = document.querySelector('.hero');
const art = document.querySelector('[data-tilt]');
const progress = document.querySelector('.scroll-progress');
let paused = motionPreference.matches;
let frame = 0;
let pointerX = innerWidth / 2;
let pointerY = innerHeight / 3;
let hoverCard = null;
let cardRect = null;
let magnetic = null;
let magneticRect = null;
let artRect = null;
let artHovered = false;
const visualMotion = () => !paused && !motionPreference.matches && finePointer.matches;
function renderFrame() {
  frame = 0;
  if (document.hidden) return;
  const height = document.documentElement.scrollHeight - innerHeight;
  if (progress) progress.style.transform = `scaleX(${height > 0 ? Math.min(1,Math.max(0,scrollY / height)) : 0})`;
  if (!visualMotion()) return;
  html.style.setProperty('--pointer-x',`${pointerX}px`);
  html.style.setProperty('--pointer-y',`${pointerY}px`);
  if (art && hero) {
    art.style.setProperty('--parallax-y',`${Math.min(30,scrollY * .065)}px`);
    if (artHovered && artRect) {
      art.style.setProperty('--tilt-x',`${-(pointerY - artRect.top - artRect.height / 2) / artRect.height * 9}deg`);
      art.style.setProperty('--tilt-y',`${(pointerX - artRect.left - artRect.width / 2) / artRect.width * 10}deg`);
    }
  }
  if (hoverCard && cardRect) { hoverCard.style.setProperty('--card-x',`${pointerX - cardRect.left}px`); hoverCard.style.setProperty('--card-y',`${pointerY - cardRect.top}px`); }
  if (magnetic && magneticRect) { magnetic.style.setProperty('--magnetic-x',`${(pointerX - magneticRect.left - magneticRect.width / 2) * .1}px`); magnetic.style.setProperty('--magnetic-y',`${(pointerY - magneticRect.top - magneticRect.height / 2) * .15}px`); }
}
function scheduleFrame() { if (!frame && !document.hidden) frame = requestAnimationFrame(renderFrame); }
function refreshRects() {
  if (hoverCard) cardRect = hoverCard.getBoundingClientRect();
  if (magnetic) magneticRect = magnetic.getBoundingClientRect();
  if (artHovered && art) artRect = art.getBoundingClientRect();
  scheduleFrame();
}
addEventListener('scroll',refreshRects,{passive:true});
addEventListener('resize',refreshRects,{passive:true});
addEventListener('pointermove',event => { if (!visualMotion()) return; pointerX = event.clientX; pointerY = event.clientY; scheduleFrame(); },{passive:true});
document.querySelectorAll('.hover-surface').forEach(card => {
  card.addEventListener('pointerenter',() => { if (visualMotion()) { hoverCard = card; cardRect = card.getBoundingClientRect(); } });
  card.addEventListener('pointerleave',() => { if (hoverCard === card) { hoverCard = null; cardRect = null; } });
});
document.querySelectorAll('[data-magnetic]').forEach(button => {
  button.addEventListener('pointerenter',() => { if (visualMotion()) { magnetic = button; magneticRect = button.getBoundingClientRect(); } });
  button.addEventListener('pointerleave',() => { button.style.removeProperty('--magnetic-x'); button.style.removeProperty('--magnetic-y'); if (magnetic === button) { magnetic = null; magneticRect = null; } });
});
art?.addEventListener('pointerenter',() => { if (visualMotion()) { artHovered = true; artRect = art.getBoundingClientRect(); } });
art?.addEventListener('pointerleave',() => { artHovered = false; art?.style.removeProperty('--tilt-x'); art?.style.removeProperty('--tilt-y'); });
function resetTransforms() {
  art?.style.removeProperty('--tilt-x'); art?.style.removeProperty('--tilt-y'); art?.style.removeProperty('--parallax-y');
  document.querySelectorAll('[data-magnetic]').forEach(button => { button.style.removeProperty('--magnetic-x'); button.style.removeProperty('--magnetic-y'); });
}
function updateMotion() {
  const disabled = paused || motionPreference.matches;
  html.classList.toggle('motion-paused',disabled);
  if (motionButton) {
    motionButton.setAttribute('aria-pressed',String(disabled));
    motionButton.setAttribute('aria-label',disabled ? '恢复动态效果' : '暂停动态效果');
    motionButton.querySelector('.motion-label').textContent = disabled ? '恢复动态' : '暂停动态';
    motionButton.querySelector('.motion-icon').textContent = disabled ? '▷' : 'Ⅱ';
    motionButton.disabled = motionPreference.matches;
    if (motionPreference.matches) { motionButton.setAttribute('aria-label','已根据系统设置减弱动态效果'); motionButton.querySelector('.motion-label').textContent = '静态模式'; }
  }
  if (disabled) { revealObserver?.disconnect(); revealElements.forEach(element => element.classList.remove('reveal-pending')); resetTransforms(); }
  scheduleFrame();
}
motionButton?.addEventListener('click',() => { paused = !paused; updateMotion(); });
motionPreference.addEventListener('change',() => { paused = motionPreference.matches; updateMotion(); });
finePointer.addEventListener('change',() => { if (!finePointer.matches) resetTransforms(); });
document.addEventListener('visibilitychange',() => {
  html.classList.toggle('page-hidden',document.hidden);
  if (document.hidden && frame) { cancelAnimationFrame(frame); frame = 0; }
  if (!document.hidden) scheduleFrame();
});
updateMotion();
