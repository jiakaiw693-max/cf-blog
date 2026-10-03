import { AUDIO_WAVEFORMS } from './audio/waveforms.js';

const ACTIVATION_SILENCE = 'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YSADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
const LICENSE_URL = 'https://creativecommons.org/licenses/by/4.0/';
export const SOUND_TRACKS = Object.freeze([
  { id: 'neon', title: 'EDM Detection Mode', subtitle: '电子低音 · 重拍律动', mood: '电子 · 驱动', bpm: 128, duration: 365.688187,
    src: '/audio/edm-detection-mode.mp3', artist: 'Kevin MacLeod', source: 'https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1500026', license: 'CC BY 4.0', licenseUrl: LICENSE_URL },
  { id: 'deep', title: 'Tech Live', subtitle: '合成器 · 科技氛围', mood: '合成器 · 律动', bpm: 124, duration: 228.440844,
    src: '/audio/tech-live.mp3', artist: 'Kevin MacLeod', source: 'https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1700030', license: 'CC BY 4.0', licenseUrl: LICENSE_URL },
].map(track => Object.freeze(track)));

const clamp = (value, max) => Math.max(0, Math.min(max, Number.isFinite(value) ? value : 0));

// 完整音频由本网站提供。媒体事件同步浮窗状态，旧播放请求不能重新启动声音。
export class SpaceSound {
  constructor({ track = 'neon', volume = 0.22, audioElement = null, fetchAudio = (url, options) => fetch(url, options) } = {}) {
    this._track = SOUND_TRACKS.some(item => item.id === track) ? track : SOUND_TRACKS[0].id;
    this.volume = clamp(volume, 1);
    this._audio = audioElement;
    this._ready = false;
    this._wanted = false;
    this._position = 0;
    this._pendingSeek = null;
    this._request = 0;
    this._disposed = false;
    this._listeners = [];
    this._subscribers = new Set();
    this._state = 'paused';
    this._fetchAudio = fetchAudio;
    this._cache = new Map();
    this._controller = null;
    this._fileBound = false;
  }
  get info() { return SOUND_TRACKS.find(item => item.id === this._track); }
  get track() { return this._track; }
  get duration() { return this._fileBound && Number.isFinite(this._audio?.duration) && this._audio.duration > 0 ? this._audio.duration : this.info.duration; }
  get currentTime() { return this._pendingSeek ?? (this._fileBound && this._audio?.readyState >= 1 ? this._audio.currentTime : this._position); }
  get playing() { return this._wanted && this._fileBound && Boolean(this._audio && !this._audio.paused); }
  get section() { return this.info.artist; }
  get waveform() { return AUDIO_WAVEFORMS[this.track]; }
  subscribe(listener) { this._subscribers.add(listener); return () => this._subscribers.delete(listener); }
  _notify(state) {
    this._state = state;
    for (const listener of this._subscribers) listener(state);
  }
  _prepare() {
    if (this._ready) return this._audio;
    const audio = this._audio || new Audio();
    this._audio = audio;
    audio.preload = 'none'; audio.loop = true; audio.volume = this.volume;
    const listen = (event, fn) => { audio.addEventListener(event, fn); this._listeners.push([event, fn]); };
    listen('loadedmetadata', () => {
      if (!this._fileBound) return;
      if (this._pendingSeek !== null) {
        audio.currentTime = clamp(this._pendingSeek, Math.max(0, this.duration - 0.03));
        this._pendingSeek = null;
      }
      this._notify(this._state);
    });
    listen('playing', () => { if (this._wanted && this._fileBound && !audio.paused) this._notify('playing'); else if (!this._wanted) audio.pause(); });
    listen('waiting', () => { if (this._wanted && this._fileBound && !audio.paused) this._notify('buffering'); });
    listen('pause', () => {
      if (audio.paused && ['playing', 'buffering'].includes(this._state) && this._wanted) { this._wanted = false; this._request++; }
      if (!this._wanted) this._notify('paused');
    });
    listen('error', () => {
      if (!this._fileBound || !audio.error || !audio.hasAttribute('src')) return;
      this._wanted = false; this._request++; audio.pause(); this._notify('error');
    });
    this._ready = true;
    return audio;
  }
  async play() {
    if (this._disposed) return false;
    const audio = this._prepare();
    const request = ++this._request;
    this._wanted = true;
    this._notify('loading');
    const track = this.info;
    let url = this._cache.get(track.id);
    try {
      if (!url) {
        // 同一次点击先激活媒体元素，再加载完整文件；Blob 来源可可靠定位。
        this._fileBound = false;
        audio.src = ACTIVATION_SILENCE;
        audio.play().catch(() => {});
        this._controller?.abort();
        const controller = new AbortController();
        this._controller = controller;
        const response = await this._fetchAudio(track.src, { signal: controller.signal });
        if (!response.ok) throw new Error('Audio download failed');
        const blob = await response.blob();
        if (controller.signal.aborted) return false;
        url = URL.createObjectURL(new Blob([blob], { type: 'audio/mpeg' }));
        this._cache.set(track.id, url);
        if (this._controller === controller) this._controller = null;
      }
      if (request !== this._request || !this._wanted || this._disposed) return false;
      this._fileBound = true;
      if (audio.getAttribute('src') !== url) {
        this._pendingSeek = this._position;
        audio.src = url;
      }
      await audio.play();
    }
    catch (error) {
      if (request !== this._request || !this._wanted || this._disposed) return false;
      this._wanted = false; audio.pause(); this._notify('error'); throw error;
    }
    if (request !== this._request || !this._wanted || this._disposed) { if (!this._wanted || this._disposed) audio.pause(); return false; }
    this._notify('playing');
    return true;
  }
  pause() {
    this._request++; this._wanted = false;
    this._controller?.abort(); this._controller = null;
    this._position = this.currentTime;
    this._audio?.pause(); this._notify('paused');
  }
  setTrack(id) {
    if (!SOUND_TRACKS.some(item => item.id === id) || this._track === id) return;
    this.pause();
    this._track = id; this._position = 0; this._pendingSeek = null; this._fileBound = false;
    if (this._ready) { this._audio.removeAttribute('src'); this._audio.load(); }
  }
  seek(seconds) {
    const position = clamp(seconds, Math.max(0, this.duration - 0.03));
    this._position = position;
    if (this._fileBound && this._audio?.readyState >= 1) { this._audio.currentTime = position; this._pendingSeek = null; }
    else this._pendingSeek = position;
  }
  setVolume(volume) { this.volume = clamp(volume, 1); if (this._audio) this._audio.volume = this.volume; }
  async dispose() {
    this.pause(); this._disposed = true;
    if (this._audio) {
      for (const [event, listener] of this._listeners) this._audio.removeEventListener(event, listener);
      this._audio.removeAttribute('src'); this._audio.load();
    }
    for (const url of this._cache.values()) URL.revokeObjectURL(url);
    this._cache.clear(); this._fileBound = false;
    this._listeners.length = 0; this._subscribers.clear();
  }
}
