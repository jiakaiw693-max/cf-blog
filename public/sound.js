import { AUDIO_WAVEFORMS } from './audio/waveforms.js';

const ACTIVATION_SILENCE = 'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YSADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
const LICENSE_URL = 'https://creativecommons.org/licenses/by/4.0/';
export const SOUND_TRACKS = Object.freeze([
  { id: 'just-a-fool', title: 'Just A Fool (feat. Zara Taylor)', subtitle: '女声电子流行 · Zara Taylor', mood: '女声 · 电子流行', collection: 'MIDNIGHT POP', year: '2019', duration: 211.252187, accent: '#ab9dff', highlight: { time: 56, label: '进入副歌' },
    src: '/audio/just-a-fool.mp3', artist: 'Sascha Ende', source: 'https://ende.app/en/song/5132-just-a-fool-feat-zara-taylor', license: 'CC BY 4.0', licenseUrl: LICENSE_URL },
  { id: 'love', title: 'Love', subtitle: '女声电子舞曲 · 合成器与律动', mood: '女声 · 电子舞曲', collection: 'CITY LIGHTS', year: '2016', duration: 228.466938, accent: '#83cfff', highlight: { time: 79, label: '进入律动段' },
    src: '/audio/love.mp3', artist: 'Sascha Ende', source: 'https://ende.app/en/song/527-love', license: 'CC BY 4.0', licenseUrl: LICENSE_URL },
  { id: 'impatient', title: 'Impatient (feat. Zara Taylor)', subtitle: '女声抒情 · 钢琴与电子氛围', mood: '女声 · 抒情', collection: 'AFTER HOURS', year: '2018', duration: 156.081625, accent: '#89d8bd',
    src: '/audio/impatient.mp3', artist: 'Sascha Ende', source: 'https://ende.app/en/song/3006-impatient-feat-zara-taylor', license: 'CC BY 4.0', licenseUrl: LICENSE_URL },
].map(track => Object.freeze(track)));

const clamp = (value, max) => Math.max(0, Math.min(max, Number.isFinite(value) ? value : 0));

// 完整音频由本网站提供。媒体事件同步浮窗状态，旧播放请求不能重新启动声音。
export class SpaceSound {
  constructor({ track = SOUND_TRACKS[0].id, volume = 0.22, audioElement = null, fetchAudio = (url, options) => fetch(url, options) } = {}) {
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
    this.repeat = false;
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
    audio.preload = 'none'; audio.loop = this.repeat; audio.volume = this.volume;
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
      if (audio.ended) return;
      if (audio.paused && ['playing', 'buffering'].includes(this._state) && this._wanted) { this._wanted = false; this._request++; }
      if (!this._wanted) this._notify('paused');
    });
    listen('error', () => {
      if (!this._fileBound || !audio.error || !audio.hasAttribute('src')) return;
      this._wanted = false; this._request++; audio.pause(); this._notify('error');
    });
    listen('ended', () => {
      if (!this._wanted || !this._fileBound || !audio.ended) return;
      this._wanted = false; this._position = 0; this._notify('ended');
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
  setRepeat(repeat) { this.repeat = Boolean(repeat); if (this._audio) this._audio.loop = this.repeat; }
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
