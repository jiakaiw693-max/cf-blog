import { SpaceSound, SOUND_TRACKS } from './sound.js';

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

function closeTransientPanels(keepSound = false) {
  const menu = document.querySelector('.theme-menu');
  if (menu) menu.hidden = true;
  document.querySelector('.theme-toggle')?.setAttribute('aria-expanded', 'false');
  const navToggle = document.querySelector('.menu-toggle');
  if (navToggle?.getAttribute('aria-expanded') === 'true') navToggle.click();
  if (!keepSound) closeSoundPanel();
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
      if (item.itemId) option.dataset.visitItem = item.itemId;
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
      if (item.action) window.bitdriftTheme?.set(item.action);
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
  window.dispatchEvent(new CustomEvent('bitdrift:panelopen', { detail: { source: 'command' } }));
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

function readSoundPreferences() {
  const defaults = { track: SOUND_TRACKS[0].id, volume: 0.22, previousVolume: 0.22 };
  try {
    const saved = JSON.parse(localStorage.getItem('bitdrift-radio') || '{}');
    if (SOUND_TRACKS.some(track => track.id === saved?.track)) defaults.track = saved.track;
    if (Number.isFinite(saved?.volume) && saved.volume >= 0 && saved.volume <= 1) defaults.volume = saved.volume;
    if (Number.isFinite(saved?.previousVolume) && saved.previousVolume > 0 && saved.previousVolume <= 1) defaults.previousVolume = saved.previousVolume;
    else if (defaults.volume > 0) defaults.previousVolume = defaults.volume;
  } catch { }
  return defaults;
}
const soundPreferences = readSoundPreferences();
const sound = new SpaceSound({ volume: soundPreferences.volume, track: soundPreferences.track, audioElement: document.querySelector('.sound-audio') });
const dock = document.querySelector('.sound-dock');
const soundButton = document.querySelector('.sound-toggle');
const soundPanel = document.querySelector('.sound-panel');
const soundExpand = document.querySelector('.sound-expand');
const soundStatus = document.querySelector('.sound-status');
const volume = document.querySelector('.sound-volume');
const volumeOutput = document.querySelector('.sound-volume-value');
const mute = document.querySelector('.sound-mute');
const seek = document.querySelector('.sound-seek');
const trackButtons = [...document.querySelectorAll('[data-sound-track]')];
const sectionLabel = document.querySelector('.sound-section');
let playbackRequest = 0;
let rememberedVolume = soundPreferences.previousVolume;
let progressTimer = 0;
let seeking = false;
let seekDirty = false;
let renderedWaveform = null;
const formatTime = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const trackInfo = () => SOUND_TRACKS.find(track => track.id === sound.track) || SOUND_TRACKS[0];
function saveSoundPreferences() {
  try { localStorage.setItem('bitdrift-radio', JSON.stringify({ track: sound.track, volume: sound.volume, previousVolume: rememberedVolume })); } catch { }
}

function stopProgress() { clearInterval(progressTimer); progressTimer = 0; }
function updateProgress(seconds, force = false) {
  if (seeking && !force) return;
  const time = Math.max(0, Math.min(sound.duration, seconds ?? sound.currentTime));
  const durationLabel = formatTime(Math.round(sound.duration));
  seek.value = String(time);
  seek.setAttribute('aria-valuetext', `${formatTime(time)}，共 ${durationLabel}`);
  dock.querySelector('.sound-elapsed').textContent = formatTime(time);
  dock.querySelector('.sound-dock-time').textContent = formatTime(time);
  dock.querySelector('.sound-duration').textContent = durationLabel;
  const progress = time / sound.duration;
  dock.style.setProperty('--sound-progress', `${progress * 100}%`);
  dock.style.setProperty('--sound-ratio', String(progress));
  dock.querySelector('.sound-waveform-mask').setAttribute('width', String(progress * 288));
  const section = sound.section;
  if (sectionLabel.textContent !== section) sectionLabel.textContent = section;
}
function renderWaveform() {
  const waveform = sound.waveform;
  if (waveform === renderedWaveform) return;
  renderedWaveform = waveform;
  const base = dock.querySelector('.sound-waveform-base');
  const played = dock.querySelector('.sound-waveform-played');
  base.replaceChildren(); played.replaceChildren();
  dock.querySelector('.sound-waveform').classList.toggle('has-waveform', Boolean(waveform));
  if (!waveform) return;
  waveform.forEach((level, i) => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    const x = (i + 0.5) * 288 / waveform.length;
    const height = Math.max(2, level * 41);
    line.setAttribute('x1', x); line.setAttribute('x2', x);
    line.setAttribute('y1', (46 - height) / 2); line.setAttribute('y2', (46 + height) / 2);
    base.append(line); played.append(line.cloneNode());
  });
}
function startProgress() {
  stopProgress(); updateProgress(); renderWaveform();
  if (dock.dataset.state === 'playing' && !document.hidden) progressTimer = setInterval(updateProgress, 500);
}
function renderTrack() {
  const track = trackInfo();
  dock.dataset.track = track.id;
  dock.style.setProperty('--sound-beat', '1.8s');
  dock.style.setProperty('--music-accent', track.accent);
  dock.querySelector('.sound-title').textContent = track.title;
  dock.querySelector('.sound-dock-title').textContent = track.title;
  dock.querySelector('.sound-description').textContent = track.subtitle;
  dock.querySelector('.sound-bpm').textContent = `${track.year} · VOCAL`;
  const source = dock.querySelector('.sound-source');
  source.href = track.source;
  source.textContent = track.artist;
  const license = dock.querySelector('.sound-license');
  license.href = track.licenseUrl; license.textContent = track.license;
  const jump = dock.querySelector('.sound-jump');
  jump.hidden = !track.highlight;
  if (track.highlight) {
    jump.replaceChildren(document.createTextNode(`${track.highlight.label} `));
    const stamp = document.createElement('span'); stamp.className = 'mono'; stamp.textContent = `${formatTime(track.highlight.time)} ↗`; jump.append(stamp);
  }
  trackButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.soundTrack === track.id)));
  seek.max = String(sound.duration);
  seeking = false; seekDirty = false;
  renderWaveform(); updateProgress(undefined, true);
}
function setSoundState(state) {
  dock.dataset.state = state;
  const playing = state === 'playing' || state === 'buffering';
  soundButton.setAttribute('aria-pressed', String(playing));
  soundButton.setAttribute('aria-busy', String(state === 'loading' || state === 'buffering'));
  const title = trackInfo().title;
  soundButton.setAttribute('aria-label', playing ? `暂停${title}` : state === 'loading' ? '取消音乐播放' : `播放${title}`);
  dock.querySelector('.sound-state').textContent = state === 'buffering' ? '缓冲中…' : playing ? (sound.volume === 0 ? '静音中' : '正在播放') : state === 'loading' ? '加载音乐…' : sound.currentTime > 0 ? '已暂停' : '点击播放';
  if (playing) startProgress();
  else { stopProgress(); updateProgress(); }
}
function closeSoundPanel(returnFocus = false) {
  if (!soundPanel || !soundExpand) return;
  soundPanel.hidden = true; soundExpand.setAttribute('aria-expanded', 'false'); soundExpand.setAttribute('aria-label', '展开音乐控制');
  if (returnFocus) soundExpand.focus();
}
function openSoundPanel() {
  window.dispatchEvent(new CustomEvent('bitdrift:panelopen', { detail: { source: 'sound' } }));
  closeTransientPanels(true);
  soundPanel.hidden = false; soundExpand.setAttribute('aria-expanded', 'true'); soundExpand.setAttribute('aria-label', '收起音乐控制');
  renderWaveform(); updateProgress();
  trackButtons.find(button => button.getAttribute('aria-pressed') === 'true')?.focus({ preventScroll: true });
}
async function toggleSound() {
  const request = ++playbackRequest;
  if (sound.playing || ['playing', 'buffering', 'loading'].includes(dock.dataset.state)) {
    sound.pause(); setSoundState('paused'); soundStatus.textContent = '音乐已暂停。'; return;
  }
  soundStatus.textContent = ''; setSoundState('loading');
  try {
    const started = await sound.play();
    if (request !== playbackRequest) return;
    setSoundState(started && sound.playing ? 'playing' : 'paused');
    soundStatus.textContent = sound.playing ? `正在播放「${trackInfo().title}」。` : '音乐已暂停。';
  } catch {
    if (request !== playbackRequest) return;
    setSoundState('paused'); openSoundPanel(); soundStatus.textContent = '音乐暂时无法播放，请再点一次，或使用支持音频的浏览器。';
  }
}
function changeTrack(id, playNow = false) {
  if (!SOUND_TRACKS.some(track => track.id === id)) return;
  if (sound.track === id) { if (playNow && dock.dataset.state !== 'playing') { if (dock.dataset.state === 'loading') return; toggleSound(); } return; }
  const resume = playNow || ['playing', 'buffering', 'loading'].includes(dock.dataset.state);
  playbackRequest++; stopProgress(); seeking = false;
  sound.setTrack(id); saveSoundPreferences(); renderTrack(); setSoundState('paused');
  soundStatus.textContent = `已选择「${trackInfo().title}」。`;
  if (resume) toggleSound();
}
soundButton?.addEventListener('click', toggleSound);
soundExpand?.addEventListener('click', () => { if (soundPanel.hidden) openSoundPanel(); else closeSoundPanel(); });
document.querySelector('.sound-panel-close')?.addEventListener('click', () => closeSoundPanel(true));
trackButtons.forEach(button => button.addEventListener('click', () => changeTrack(button.dataset.soundTrack)));
document.querySelector('.sound-next')?.addEventListener('click', () => {
  const index = SOUND_TRACKS.findIndex(track => track.id === sound.track);
  changeTrack(SOUND_TRACKS[(index + 1) % SOUND_TRACKS.length].id);
});
document.querySelector('.sound-repeat')?.addEventListener('click', event => {
  sound.setRepeat(!sound.repeat);
  event.currentTarget.setAttribute('aria-pressed', String(sound.repeat));
  event.currentTarget.setAttribute('aria-label', sound.repeat ? '切换到顺序播放' : '切换到单曲循环');
  event.currentTarget.textContent = sound.repeat ? '单曲循环' : '顺序播放';
});
document.querySelector('.sound-jump')?.addEventListener('click', () => {
  if (!trackInfo().highlight) return;
  seeking = false; seekDirty = false;
  sound.seek(trackInfo().highlight.time); updateProgress(undefined, true);
  if (!['playing', 'buffering', 'loading'].includes(dock.dataset.state)) toggleSound();
});
function commitSeek() {
  if (!seeking && !seekDirty) return;
  const changed = seekDirty;
  if (changed) sound.seek(Math.min(Number(seek.value), sound.duration - 0.03));
  seeking = false; seekDirty = false; updateProgress(undefined, true);
  if (changed && dock.dataset.state !== 'playing' && dock.dataset.state !== 'loading') setSoundState('paused');
}
seek?.addEventListener('pointerdown', () => { seeking = true; seekDirty = false; });
seek?.addEventListener('input', () => { seeking = true; seekDirty = true; updateProgress(Number(seek.value), true); });
seek?.addEventListener('change', commitSeek);
window.addEventListener('pointerup', commitSeek);
seek?.addEventListener('pointercancel', () => { seeking = false; seekDirty = false; updateProgress(); });
seek?.addEventListener('blur', commitSeek);
function setVolume(value, persist = true) {
  sound.setVolume(value);
  volume.value = String(Math.round(value * 100)); volumeOutput.textContent = `${Math.round(value * 100)}%`;
  mute.setAttribute('aria-pressed', String(value === 0)); mute.textContent = value === 0 ? '取消静音' : '静音';
  if (value > 0) rememberedVolume = value;
  if (dock.dataset.state === 'playing') dock.querySelector('.sound-state').textContent = value === 0 ? '静音中' : '正在播放';
  if (persist) saveSoundPreferences();
}
volume?.addEventListener('input', () => setVolume(Number(volume.value) / 100));
mute?.addEventListener('click', () => setVolume(sound.volume > 0 ? 0 : rememberedVolume));
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !event.defaultPrevented && !soundPanel.hidden) { event.preventDefault(); closeSoundPanel(true); } });
document.addEventListener('click', event => { if (!event.target.closest('.sound-dock')) closeSoundPanel(); });
dock?.addEventListener('focusout', event => { if (!dock.contains(event.relatedTarget)) closeSoundPanel(); });
window.addEventListener('bitdrift:panelopen', event => { if (event.detail?.source !== 'sound') closeSoundPanel(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) stopProgress(); else startProgress(); });
sound.subscribe(state => {
  if (state === 'ended') {
    const index = SOUND_TRACKS.findIndex(track => track.id === sound.track);
    changeTrack(SOUND_TRACKS[(index + 1) % SOUND_TRACKS.length].id, true);
  } else if (state === 'error') {
    playbackRequest++; setSoundState('paused');
    soundStatus.textContent = '音频加载失败，请检查连接后重试。';
    openSoundPanel();
  } else setSoundState(state);
});
window.addEventListener('pagehide', event => {
  playbackRequest++; seeking = false; sound.pause(); setSoundState('paused');
  if (!event.persisted) sound.dispose().catch(() => {});
});
setVolume(sound.volume, false); renderTrack(); setSoundState('paused');
root.classList.add('experience-ready');
