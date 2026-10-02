import { SpaceSound } from './sound.js';

const root = document.documentElement;
const dialog = document.querySelector('.command-dialog');
const commandInput = document.querySelector('.command-input');
const results = document.querySelector('.command-results');
const commandCount = document.querySelector('.command-count');
const commandEmpty = document.querySelector('.command-empty');
const commandData = JSON.parse(document.querySelector('#command-data')?.textContent || '[]');
const indexed = commandData.map(item => ({ ...item, search: `${item.name} ${item.description} ${item.category} ${item.href || ''}`.normalize('NFKC').toLowerCase() }));
let matches = indexed;
let selected = 0;
let returnFocus;

function closeTransientPanels() {
  const menu = document.querySelector('.theme-menu');
  if (menu) menu.hidden = true;
  document.querySelector('.theme-toggle')?.setAttribute('aria-expanded', 'false');
  const navToggle = document.querySelector('.menu-toggle');
  if (navToggle?.getAttribute('aria-expanded') === 'true') navToggle.click();
  closeSoundPanel();
}
function highlightName(name, query) {
  const span = document.createElement('span');
  span.className = 'command-result-name';
  const index = name.toLowerCase().indexOf(query);
  if (!query || index < 0) { span.textContent = name; return span; }
  span.append(document.createTextNode(name.slice(0, index)));
  const mark = document.createElement('mark');
  mark.textContent = name.slice(index, index + query.length);
  span.append(mark, document.createTextNode(name.slice(index + query.length)));
  return span;
}
function selectResult(index, scroll = false) {
  const options = [...results.querySelectorAll('.command-result')];
  if (!options.length) { commandInput.removeAttribute('aria-activedescendant'); return; }
  selected = (index + options.length) % options.length;
  options.forEach((option, i) => option.setAttribute('aria-selected', String(i === selected)));
  commandInput.setAttribute('aria-activedescendant', options[selected].id);
  if (scroll) options[selected].scrollIntoView({ block: 'nearest', behavior: 'auto' });
}
function renderResults() {
  const query = commandInput.value.normalize('NFKC').trim().toLowerCase();
  matches = indexed.filter(item => !query || item.search.includes(query));
  const fragment = document.createDocumentFragment();
  matches.forEach((item, index) => {
    const option = document.createElement(item.href ? 'a' : 'button');
    option.className = 'command-result';
    option.id = `command-option-${index}`;
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', 'false');
    option.tabIndex = -1;
    if (item.href) {
      option.href = item.href;
      if (item.external) { option.target = '_blank'; option.rel = 'noopener noreferrer'; }
    } else option.type = 'button';
    const symbol = document.createElement('span');
    symbol.className = 'command-result-icon'; symbol.textContent = item.external ? '↗' : item.action ? '⌁' : '→'; symbol.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span'); text.className = 'command-result-text';
    const description = document.createElement('span'); description.className = 'command-result-description'; description.textContent = item.description;
    text.append(highlightName(item.name, query), description);
    const category = document.createElement('span'); category.className = 'command-result-category'; category.textContent = item.category;
    option.append(symbol, text, category);
    option.addEventListener('pointerenter', () => selectResult(index));
    option.addEventListener('click', () => {
      dialog.close();
      if (item.action === 'sound') toggleSound();
      else if (item.action) window.bitdriftTheme?.set(item.action);
    });
    fragment.append(option);
  });
  results.replaceChildren(fragment);
  commandCount.textContent = `${matches.length} 个结果`;
  commandEmpty.hidden = matches.length > 0;
  selectResult(0);
}
function openCommand(trigger) {
  if (dialog.open) { dialog.close(); return; }
  returnFocus = trigger || document.activeElement;
  closeTransientPanels();
  commandInput.value = '';
  renderResults();
  dialog.showModal();
  commandInput.focus();
}
document.querySelectorAll('[data-open-command]').forEach(button => button.addEventListener('click', () => openCommand(button)));
document.querySelector('.command-close')?.addEventListener('click', () => dialog.close());
dialog?.addEventListener('close', () => {
  if (returnFocus?.isConnected && typeof returnFocus.focus === 'function') returnFocus.focus({ preventScroll: true });
});
dialog?.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
});
commandInput?.addEventListener('input', renderResults);
commandInput?.addEventListener('keydown', event => {
  if (event.isComposing) return;
  if (event.key === 'Escape') { event.preventDefault(); dialog.close(); return; }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); selectResult(selected + (event.key === 'ArrowDown' ? 1 : -1), true); }
  if (event.key === 'Enter') { event.preventDefault(); results.querySelector(`#command-option-${selected}`)?.click(); }
});
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k' && !event.isComposing) {
    event.preventDefault(); openCommand(document.activeElement);
  }
});

// 主视觉切换真实的关注方向，所有入口在初始 HTML 中可读。
const orbit = document.querySelector('.orbit-terminal');
const modes = JSON.parse(document.querySelector('#orbit-data')?.textContent || '[]');
const orbitButtons = [...document.querySelectorAll('[data-orbit-choice]')];
if (orbit && 'IntersectionObserver' in window) {
  const orbitVisibility = new IntersectionObserver(entries => {
    orbit.classList.toggle('orbit-offscreen', !entries[0].isIntersecting);
  }, { rootMargin: '120px' });
  orbitVisibility.observe(orbit);
}
let orbitTimer;
orbitButtons.forEach(button => button.addEventListener('click', () => {
  const mode = modes.find(item => item.key === button.dataset.orbitChoice);
  if (!mode || orbit.dataset.orbit === mode.key) return;
  orbit.dataset.orbit = mode.key;
  orbitButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  orbit.querySelector('.orbit-title').textContent = mode.title;
  orbit.querySelector('.orbit-description').textContent = mode.description;
  orbit.querySelector('.orbit-tags').textContent = mode.tags;
  orbit.querySelector('.orbit-code').textContent = `0${modes.indexOf(mode) + 1} / ${mode.label.toUpperCase()}`;
  const link = orbit.querySelector('.orbit-link'); link.href = mode.href; link.setAttribute('aria-label', `查看${mode.title}关注方向`);
  orbit.classList.add('orbit-switching');
  clearTimeout(orbitTimer); orbitTimer = setTimeout(() => orbit.classList.remove('orbit-switching'), 450);
}));

const directorySearch = document.querySelector('#directory-search');
const directoryClear = document.querySelector('.directory-clear');
directorySearch?.addEventListener('input', () => { directoryClear.hidden = !directorySearch.value; });
directoryClear?.addEventListener('click', () => {
  directorySearch.value = ''; directorySearch.dispatchEvent(new Event('input', { bubbles: true })); directorySearch.focus();
});
const directoryGrid = document.querySelector('.directory-grid');
let refreshTimer;
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
  directoryGrid.classList.add('results-refresh');
  clearTimeout(refreshTimer); refreshTimer = setTimeout(() => directoryGrid.classList.remove('results-refresh'), 420);
}));
const copyFeedback = new WeakMap();
window.addEventListener('bitdrift:copied', event => {
  const button = event.detail.button;
  let state = copyFeedback.get(button);
  if (!state) { const target = button.querySelector('.copy-label') || button; state = { target, label: target.textContent }; copyFeedback.set(button, state); }
  clearTimeout(state.timer); state.target.textContent = '已复制 ✓'; button.classList.add('is-copied');
  state.timer = setTimeout(() => { state.target.textContent = state.label; button.classList.remove('is-copied'); }, 1600);
});

const sound = new SpaceSound({ volume: 0.22 });
const dock = document.querySelector('.sound-dock');
const soundButton = document.querySelector('.sound-toggle');
const soundPanel = document.querySelector('.sound-panel');
const soundExpand = document.querySelector('.sound-expand');
const soundStatus = document.querySelector('.sound-status');
const volume = document.querySelector('.sound-volume');
const volumeOutput = document.querySelector('.sound-volume-value');
const mute = document.querySelector('.sound-mute');
let playbackRequest = 0;
let rememberedVolume = 0.22;
function setSoundState(state) {
  dock.dataset.state = state;
  const playing = state === 'playing';
  soundButton.setAttribute('aria-pressed', String(playing));
  soundButton.setAttribute('aria-busy', String(state === 'loading'));
  soundButton.setAttribute('aria-label', playing ? '暂停太空电子音乐' : state === 'loading' ? '取消音乐播放' : '播放太空电子音乐');
  dock.querySelector('.sound-state').textContent = playing ? '正在播放' : state === 'loading' ? '准备中…' : '点击播放';
}
function closeSoundPanel(returnFocus = false) {
  if (!soundPanel || !soundExpand) return;
  soundPanel.hidden = true; soundExpand.setAttribute('aria-expanded', 'false'); soundExpand.setAttribute('aria-label', '展开音乐控制');
  if (returnFocus) soundExpand.focus();
}
function openSoundPanel() {
  soundPanel.hidden = false; soundExpand.setAttribute('aria-expanded', 'true'); soundExpand.setAttribute('aria-label', '收起音乐控制');
}
async function toggleSound() {
  const request = ++playbackRequest;
  if (sound.playing || dock.dataset.state === 'playing' || dock.dataset.state === 'loading') { sound.pause(); setSoundState('paused'); soundStatus.textContent = '音乐已暂停。'; return; }
  soundStatus.textContent = ''; setSoundState('loading');
  try {
    const started = await sound.play();
    if (request !== playbackRequest) return;
    setSoundState(started && sound.playing ? 'playing' : 'paused');
    soundStatus.textContent = sound.playing ? '原创太空电子声景正在播放。' : '音乐已暂停。';
  } catch {
    if (request !== playbackRequest) return;
    setSoundState('paused'); openSoundPanel(); soundStatus.textContent = '音乐暂时无法播放，请再点一次，或使用支持音频的浏览器。';
  }
}
soundButton?.addEventListener('click', toggleSound);
soundExpand?.addEventListener('click', () => { if (soundPanel.hidden) openSoundPanel(); else closeSoundPanel(); });
document.querySelector('.sound-panel-close')?.addEventListener('click', () => closeSoundPanel(true));
function setVolume(value) {
  sound.setVolume(value);
  volume.value = String(Math.round(value * 100)); volumeOutput.textContent = `${Math.round(value * 100)}%`;
  mute.setAttribute('aria-pressed', String(value === 0)); mute.textContent = value === 0 ? '取消静音' : '静音';
  if (value > 0) rememberedVolume = value;
}
volume?.addEventListener('input', () => setVolume(Number(volume.value) / 100));
mute?.addEventListener('click', () => setVolume(sound.volume > 0 ? 0 : rememberedVolume));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !soundPanel.hidden) closeSoundPanel(true);
});
document.addEventListener('click', event => {
  if (!event.target.closest('.sound-dock')) closeSoundPanel();
});
window.addEventListener('pagehide', event => {
  playbackRequest++; sound.pause(); setSoundState('paused');
  if (!event.persisted) sound.dispose().catch(() => {});
});
root.classList.add('experience-ready');
