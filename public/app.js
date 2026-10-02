const html = document.documentElement;
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.main-nav');
function closeNav() {
  if (!toggle || !nav) return;
  toggle.setAttribute('aria-expanded','false');
  toggle.setAttribute('aria-label','打开导航');
  nav.classList.remove('is-open');
}
toggle?.addEventListener('click', () => {
  const opened = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded',String(opened));
  toggle.setAttribute('aria-label',opened ? '关闭导航' : '打开导航');
  nav?.classList.toggle('is-open',opened);
});
nav?.querySelectorAll('a').forEach(link => link.addEventListener('click',closeNav));
document.addEventListener('keydown',event => {
  if (event.key === 'Escape' && toggle?.getAttribute('aria-expanded') === 'true') { closeNav(); toggle.focus(); }
});
matchMedia('(min-width: 681px)').addEventListener('change',closeNav);
document.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click',async () => {
  const kind = button.dataset.copyKind;
  const status = document.querySelector(kind === 'email' ? '.email-status' : '.account-status');
  try {
    await navigator.clipboard.writeText(button.dataset.copy);
    if (status) status.textContent = kind === 'email' ? `邮箱已复制：${button.dataset.copy}` : '账号名已复制。打开小红书搜索即可。';
  } catch { if (status) status.textContent = `请选中复制：${button.dataset.copy}`; }
}));

// 分类与搜索共同生效，初始 HTML 保留完整目录。
const filters = [...document.querySelectorAll('[data-filter]')];
const cards = [...document.querySelectorAll('.site-card')];
const search = document.querySelector('#directory-search');
const resultStatus = document.querySelector('#directory-status');
const empty = document.querySelector('.directory-empty');
let activeCategory = 'all';
function updateDirectory() {
  const query = (search?.value || '').trim().toLowerCase();
  let count = 0;
  cards.forEach(card => {
    const visible = (activeCategory === 'all' || card.dataset.category === activeCategory) && card.dataset.search.includes(query);
    card.hidden = !visible;
    if (visible) count++;
  });
  if (resultStatus) resultStatus.textContent = `${count} 个网站`;
  if (empty) empty.hidden = count > 0;
  scheduleFrame();
}
filters.forEach(button => button.addEventListener('click',() => {
  activeCategory = button.dataset.filter;
  filters.forEach(item => { item.classList.toggle('is-active',item === button); item.setAttribute('aria-pressed',String(item === button)); });
  updateDirectory();
}));
search?.addEventListener('input',updateDirectory);

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
