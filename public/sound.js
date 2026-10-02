// 两首原创电子音乐。点击播放后合成 PCM，再由一个 Web Audio 缓冲源循环播放。
const SAMPLE_RATE = 24000;
const DEFAULT_VOLUME = 0.22;
const TRACKS = [
  { id: 'neon', title: '霓虹巡航', subtitle: '合成器主旋律 · 切分低音', bpm: 112, bars: 32 },
  { id: 'deep', title: '深空漫游', subtitle: '星空钟音 · 宽阔和弦', bpm: 84, bars: 24 },
];
export const SOUND_TRACKS = Object.freeze(TRACKS.map(({ id, title, subtitle, bpm, bars }) =>
  Object.freeze({ id, title, subtitle, bpm, duration: bars * 4 * 60 / bpm })));

const SECTIONS = {
  neon: [[0, '信号启程'], [4, '霓虹律动'], [12, '轨道抬升'], [20, '失重间奏'], [24, '巡航回归']],
  deep: [[0, '星门开启'], [4, '远航回声'], [12, '静海漂浮'], [16, '星尘归途']],
};
const CHORDS = {
  neon: [[54, 57, 61, 64, 68], [50, 54, 57, 61, 64], [45, 52, 56, 59, 61], [52, 56, 59, 61, 66]],
  deep: [[48, 55, 58, 62, 63], [44, 51, 55, 58, 60], [51, 55, 58, 62, 65], [46, 53, 55, 60, 62]],
};
const ROOTS = { neon: [42, 38, 33, 40], deep: [36, 32, 39, 34] };
// [拍位置, MIDI 音高, 保持拍数]。两组主旋律有休止、长音与应答，不依赖重复琶音。
const NEON_HOOK = [
  [[0, 73, 0.7], [0.75, 76, 0.3], [1.5, 78, 0.5], [2.25, 76, 0.5], [3, 73, 0.75]],
  [[0, 74, 0.75], [1, 73, 0.5], [1.75, 69, 0.75], [3, 71, 0.75]],
  [[0, 73, 0.75], [1.5, 76, 0.5], [2.25, 80, 0.5], [3, 78, 0.45], [3.5, 76, 0.35]],
  [[0, 71, 0.75], [0.75, 73, 0.3], [1.5, 76, 0.75], [2.5, 73, 0.5], [3.25, 71, 0.55]],
];
const NEON_LIFT = [
  [[0, 78, 0.75], [1, 81, 0.5], [1.75, 80, 0.5], [2.5, 76, 0.5], [3.25, 73, 0.55]],
  [[0, 74, 0.75], [1, 78, 0.7], [2, 81, 0.7], [3, 80, 0.65]],
  [[0, 80, 0.5], [0.75, 81, 0.3], [1.5, 85, 0.75], [2.75, 81, 0.5], [3.5, 78, 0.35]],
  [[0, 80, 0.75], [1, 78, 0.5], [2, 76, 0.75], [3, 73, 0.8]],
];
const DEEP_MELODY = [
  [[0, 79, 1.45], [2, 75, 1.2], [3.5, 74, 0.4]],
  [[0.5, 72, 1.6], [2.75, 67, 0.9]],
  [[0, 70, 1.9], [2.5, 74, 0.75], [3.5, 75, 0.4]],
  [[0, 77, 1.45], [2, 74, 0.75], [3, 70, 0.8]],
];

const TAU = Math.PI * 2;
const TABLE_SIZE = 2048;
const SAW = new Float32Array(TABLE_SIZE);
const WARM = new Float32Array(TABLE_SIZE);
for (let i = 0; i < TABLE_SIZE; i += 1) {
  const phase = TAU * i / TABLE_SIZE;
  for (let harmonic = 1; harmonic <= 8; harmonic += 1) {
    SAW[i] += Math.sin(phase * harmonic) / harmonic * 0.54;
    WARM[i] += Math.sin(phase * harmonic) / (harmonic * harmonic) * 0.74;
  }
}
const wave = (table, phase) => {
  const position = (phase - Math.floor(phase)) * TABLE_SIZE;
  const index = Math.floor(position);
  const fraction = position - index;
  return table[index] + (table[(index + 1) % TABLE_SIZE] - table[index]) * fraction;
};
const frequency = (midi) => 440 * 2 ** ((midi - 69) / 12);
const clampVolume = (value) => {
  if (!Number.isFinite(value)) throw new TypeError('音乐音量需要是一个有效数字。');
  return Math.max(0, Math.min(1, value));
};
const yieldTask = () => new Promise((resolve) => setTimeout(resolve, 0));

function makeInstrument(type, midi, gate, cache) {
  const key = `${type}/${midi}/${Math.round(gate * SAMPLE_RATE)}`;
  if (cache.has(key)) return cache.get(key);
  const pad = type.startsWith('pad');
  const bass = type === 'bass';
  const bell = type === 'bell';
  const stab = type === 'stab';
  const release = pad ? 1.2 : bell ? 1.4 : bass ? 0.11 : stab ? 0.14 : 0.2;
  const length = Math.ceil((gate + release) * SAMPLE_RATE);
  const samples = new Float32Array(length);
  const hz = frequency(midi);
  const step = hz / SAMPLE_RATE;
  const attack = pad ? 0.6 : bass ? 0.004 : bell ? 0.008 : 0.012;
  const sustainAt = (moment) => pad ? 0.86 + 0.14 * Math.exp(-(moment - attack) * 2)
    : bell ? 0.3 + 0.7 * Math.exp(-(moment - attack) * 2.4) : 0.58 + 0.42 * Math.exp(-(moment - attack) * 10);
  const releaseLevel = sustainAt(gate);
  let phaseA = 0;
  let phaseB = 0.17;
  let filtered = 0;
  for (let i = 0; i < length; i += 1) {
    const time = i / SAMPLE_RATE;
    const envelope = time < attack ? Math.sin(time / attack * Math.PI / 2)
      : time < gate ? sustainAt(time)
      : Math.max(0, Math.cos((time - gate) / release * Math.PI / 2)) ** 2 * releaseLevel;
    let tone;
    if (bell) {
      tone = Math.sin(TAU * phaseA + Math.sin(TAU * phaseA * 2) * (1.8 * Math.exp(-time * 2.7) + 0.1));
      tone += Math.sin(TAU * phaseA * 3) * Math.exp(-time * 4) * 0.1;
    } else if (bass) {
      tone = Math.sin(TAU * phaseA) * 0.72 + wave(SAW, phaseA) * 0.38;
    } else {
      const table = pad ? WARM : SAW;
      tone = (wave(table, phaseA) + wave(table, phaseB)) * 0.5;
    }
    const cutoff = pad ? (type === 'pad-bright' ? 1800 : 850)
      : bass ? 250 + 600 * Math.exp(-time * 13)
      : bell ? 3400 : (type === 'lead-bright' ? 2100 : 1350) + 2600 * Math.exp(-time * 8);
    const coefficient = 1 - Math.exp(-TAU * cutoff / SAMPLE_RATE);
    filtered += coefficient * (tone - filtered);
    samples[i] = filtered * envelope;
    phaseA += step * (pad ? 0.9982 : 0.9991);
    phaseB += step * (pad ? 1.0024 : 1.0014);
  }
  cache.set(key, samples);
  return samples;
}

function makeDrum(type, cache) {
  if (cache.has(type)) return cache.get(type);
  const duration = { kick: 0.44, snare: 0.24, hat: 0.065, open: 0.24, rise: 1.45, click: 0.045 }[type];
  const samples = new Float32Array(Math.ceil(duration * SAMPLE_RATE));
  let seed = 14351 + type.length * 109;
  let lowNoise = 0;
  let highNoise = 0;
  let phase = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const time = i / SAMPLE_RATE;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 2147483648 - 1;
    lowNoise += 0.56 * (noise - lowNoise);
    highNoise += 0.86 * (noise - highNoise);
    const high = highNoise - lowNoise;
    let value;
    if (type === 'kick') {
      phase += TAU * (47 + 100 * Math.exp(-time * 32)) / SAMPLE_RATE;
      const attack = Math.min(1, time / 0.004);
      value = Math.tanh(Math.sin(phase) * 1.1) * Math.exp(-time * 12.5) * attack;
      value += high * Math.exp(-time * 110) * 0.08 * attack;
    } else if (type === 'snare') {
      const body = (Math.sin(TAU * 177 * time) + Math.sin(TAU * 313 * time) * 0.4) * Math.exp(-time * 24) * 0.2;
      value = (high * 1.3 + noise * 0.24) * Math.exp(-time * 19) + body;
      value *= Math.min(1, time / 0.002);
    } else if (type === 'rise') {
      const envelope = Math.sin(Math.min(1, time / 1.05) * Math.PI / 2) ** 2 * Math.max(0, 1 - Math.max(0, time - 1.05) / 0.4);
      value = (lowNoise * 0.8 + high * Math.min(1, time / 1.05)) * envelope;
    } else {
      const decay = type === 'open' ? 17 : type === 'click' ? 115 : 65;
      value = high * Math.exp(-time * decay) * Math.min(1, time / 0.0015);
    }
    // 每个单音自身归零，保留整段循环首拍鼓的自然起音。
    samples[i] = value * Math.min(1, (duration - time) / 0.012);
  }
  cache.set(type, samples);
  return samples;
}

function mix(samples, start, gain, pan, send, dry, wet) {
  const length = dry[0].length;
  const left = Math.cos((pan + 1) * Math.PI / 4) * gain;
  const right = Math.sin((pan + 1) * Math.PI / 4) * gain;
  let position = ((start % length) + length) % length;
  for (let i = 0; i < samples.length; i += 1) {
    if (position === length) position = 0;
    const value = samples[i];
    dry[0][position] += value * left;
    dry[1][position] += value * right;
    if (send) {
      wet[0][position] += value * left * send;
      wet[1][position] += value * right * send;
    }
    position += 1;
  }
}

function addReflection(destination, source, delay, amount) {
  let index = source.length - Math.round(delay * SAMPLE_RATE);
  while (index < 0) index += source.length;
  for (let i = 0; i < source.length; i += 1) {
    if (index === source.length) index = 0;
    destination[i] += source[index] * amount;
    index += 1;
  }
}

async function renderTrack(context, id, cancelled) {
  const track = TRACKS.find((item) => item.id === id);
  const beat = 60 / track.bpm;
  const length = Math.round(track.bars * 4 * beat * SAMPLE_RATE);
  const dry = [new Float32Array(length), new Float32Array(length)];
  const wet = [new Float32Array(length), new Float32Array(length)];
  const cache = new Map();
  const note = (type, midi, at, gate, level, pan = 0, send = 0.25) =>
    mix(makeInstrument(type, midi, gate * beat, cache), Math.round(at * beat * SAMPLE_RATE), level, pan, send, dry, wet);
  const drum = (type, at, level, pan = 0, send = 0) =>
    mix(makeDrum(type, cache), Math.round(at * beat * SAMPLE_RATE), level, pan, send, dry, wet);
  await yieldTask();
  if (cancelled()) throw new Error('音乐生成已经取消。');

  for (let bar = 0; bar < track.bars; bar += 1) {
    const start = bar * 4;
    const chordIndex = Math.floor(bar / 2) % 4;
    const chord = CHORDS[id][chordIndex];
    const root = ROOTS[id][chordIndex];
    const intro = bar < 4;
    const lift = id === 'neon' && bar >= 12 && bar < 20;
    const space = id === 'neon' ? bar >= 20 && bar < 24 : bar >= 12 && bar < 16;
    const returning = id === 'neon' ? bar >= 24 : bar >= 16;
    if (bar % 2 === 0) {
      for (let voice = 0; voice < chord.length; voice += 1) {
        note(lift ? 'pad-bright' : 'pad-dark', chord[voice], start, 7.35,
          id === 'neon' ? (space ? 0.029 : lift ? 0.05 : 0.044) : 0.063, (voice - 2) * 0.38, 0.48);
        if (voice % 2 === 1) {
          await yieldTask();
          if (cancelled()) throw new Error('音乐生成已经取消。');
        }
      }
    }

    if (id === 'neon') {
      const phrase = (lift ? NEON_LIFT : NEON_HOOK)[bar % 4];
      const melody = intro ? phrase.slice(0, 3) : space ? phrase.filter((_, index) => index % 2 === 0) : phrase;
      for (const [at, midi, gate] of melody) {
        note(space ? 'bell' : lift || returning ? 'lead-bright' : 'lead', midi - (space ? 12 : 0), start + at,
          space ? gate * 1.7 : gate, intro ? 0.25 : space ? 0.095 : lift ? 0.34 : 0.3, bar % 2 ? 0.08 : -0.08, space ? 0.6 : 0.36);
      }
      if (!intro && !space) {
        const bassline = bar % 2 ? [[0, 0, 0.65], [1.25, 0, 0.35], [2, 12, 0.4], [2.75, 0, 0.45], [3.5, 7, 0.3]]
          : [[0, 0, 0.65], [0.75, 0, 0.35], [1.5, 12, 0.4], [2.5, 0, 0.45], [3.25, 7, 0.35]];
        for (const [at, interval, gate] of bassline) note('bass', root + interval, start + at, gate, 0.24, 0, 0);
        for (const at of [0.5, 2, 3.5]) {
          chord.slice(1, 4).forEach((midi, voice) => note('stab', midi + 12, start + at, 0.24, 0.052, (voice - 1) * 0.35, 0.4));
        }
      } else {
        note('bass', root, start, space ? 1.4 : 1.8, space ? 0.075 : 0.15, 0, 0);
      }
      if (!space) {
        const kicks = intro ? (bar < 2 ? [0] : [0, 2]) : lift || returning && bar < 28 ? [0, 1, 2, 3] : [0, 1.5, 2, 3.25];
        kicks.forEach((at, index) => drum('kick', start + at, intro ? 0.23 : index ? 0.31 : 0.37));
        if (!intro || bar >= 2) [1, 3].forEach((at) => drum('snare', start + at, intro ? 0.11 : lift ? 0.24 : 0.2, 0.03, 0.1));
        const hats = intro ? [1.5, 3.5] : [0.5, 1, 1.5, 2.5, 3, 3.5];
        hats.forEach((at, index) => drum('hat', start + at + (index % 2 ? 0.014 : 0), intro ? 0.055 : 0.08, index % 2 ? 0.23 : -0.23));
        if (lift) [1.75, 3.75].forEach((at) => drum('hat', start + at, 0.065, -0.35));
        if (!intro) [1.5, 3.5].forEach((at) => drum('open', start + at, 0.045, -0.15));
      } else if (bar >= 22) {
        drum('kick', start, 0.18);
        drum('click', start + 2.75, 0.035, 0.4, 0.2);
      }
      if ([3, 11, 19, 23].includes(bar)) drum('rise', start + 1.5, 0.065, -0.12, 0.28);
      if ([11, 19, 27].includes(bar)) [3, 3.25, 3.5, 3.75].forEach((at, index) => drum('snare', start + at, 0.07 + index * 0.027, index % 2 ? 0.2 : -0.2, 0.12));
    } else {
      const melody = DEEP_MELODY[bar % 4];
      for (const [at, midi, gate] of melody) {
        note('bell', midi + (returning && bar % 4 === 2 ? 12 : 0), start + at, space ? gate * 1.35 : gate,
          intro ? 0.17 : space ? 0.16 : 0.22, bar % 2 ? -0.24 : 0.24, 0.62);
      }
      if (!space) {
        note('bass', root, start + (intro ? 0 : 0.5), intro ? 2.7 : 1.9, 0.17, 0, 0);
        if (!intro) note('bass', root + 7, start + 2.75, 0.75, 0.12, 0, 0);
        drum('kick', start, intro ? 0.11 : 0.22);
        if (!intro) {
          drum('kick', start + 2.5, 0.14);
          drum('snare', start + 2, 0.11, -0.07, 0.24);
          [0.75, 1.5, 2.75, 3.5].forEach((at, index) => drum('hat', start + at, 0.046, index % 2 ? 0.4 : -0.4));
        }
      }
      if (returning && bar % 2 === 1) note('bell', chord[3] + 12, start + 1.5, 0.65, 0.065, -0.55, 0.75);
    }
    await yieldTask();
    if (cancelled()) throw new Error('音乐生成已经取消。');
  }

  // 尾音按整段长度环绕混入，回声也使用环形索引；不裁切循环首拍的鼓瞬态。
  for (let channel = 0; channel < 2; channel += 1) {
    const samples = wet[channel];
    let filtered = samples[length - 1];
    for (let i = Math.max(0, length - 2048); i < length; i += 1) filtered += 0.42 * (samples[i] - filtered);
    for (let i = 0; i < length; i += 1) {
      filtered += 0.42 * (samples[i] - filtered);
      samples[i] = filtered;
    }
    await yieldTask();
    if (cancelled()) throw new Error('音乐生成已经取消。');
  }
  for (let channel = 0; channel < 2; channel += 1) {
    const samples = wet[channel];
    const other = wet[1 - channel];
    let reflectionIndex = 0;
    for (const [delay, amount] of [[0.037, 0.18], [0.079, 0.13], [0.131, 0.1], [0.211, 0.075], [0.337, 0.055], [0.557, 0.04]]) {
      addReflection(dry[channel], reflectionIndex++ % 2 ? samples : other, delay * (channel ? 1.09 : 1), amount);
      if (reflectionIndex % 3 === 0) await yieldTask();
    }
    for (const [multiple, amount] of [[0.75, 0.27], [1.5, 0.115], [2.25, 0.045]]) {
      addReflection(dry[channel], other, multiple * beat, amount);
    }
    await yieldTask();
    if (cancelled()) throw new Error('音乐生成已经取消。');
  }

  let energy = 0;
  for (const samples of dry) {
    let mean = 0;
    for (let i = 0; i < length; i += 1) mean += samples[i];
    mean /= length;
    for (let i = 0; i < length; i += 1) {
      samples[i] -= mean;
      energy += samples[i] * samples[i];
    }
    await yieldTask();
    if (cancelled()) throw new Error('音乐生成已经取消。');
  }
  const rms = Math.sqrt(energy / (length * 2));
  const scale = 0.14 / Math.max(rms, 0.00001);
  const buffer = context.createBuffer(2, length, SAMPLE_RATE);
  const waveform = Array(96).fill(0);
  let finalPeak = 0;
  for (let channel = 0; channel < 2; channel += 1) {
    const samples = buffer.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      const raw = dry[channel][i] * scale;
      // 只柔和压住极少数强瞬态，保留鼓的冲击和 0.82 峰值余量。
      const amplitude = Math.abs(raw);
      const value = amplitude <= 0.66 ? raw : Math.sign(raw) * (0.66 + 0.16 * (1 - Math.exp(-(amplitude - 0.66) / 0.16)));
      samples[i] = value;
      const absolute = Math.abs(value);
      finalPeak = Math.max(finalPeak, absolute);
      const bin = Math.min(95, Math.floor(i * 96 / length));
      waveform[bin] = Math.max(waveform[bin], absolute);
    }
    await yieldTask();
    if (cancelled()) throw new Error('音乐生成已经取消。');
  }
  return { buffer, waveform: Object.freeze(waveform.map((value) => value / Math.max(finalPeak, 0.00001))) };
}

function hold(parameter, time) {
  if (typeof parameter.cancelAndHoldAtTime === 'function') parameter.cancelAndHoldAtTime(time);
  else {
    const value = parameter.value;
    parameter.cancelScheduledValues(time);
    parameter.setValueAtTime(value, time);
  }
}

export class SpaceSound {
  constructor({ volume = DEFAULT_VOLUME, track = 'neon' } = {}) {
    if (!SOUND_TRACKS.some((item) => item.id === track)) throw new Error('没有找到这首音乐。');
    this._volume = clampVolume(volume);
    this._track = track;
    this._context = null;
    this._master = null;
    this._cache = new Map();
    this._pending = null;
    this._voice = null;
    this._offset = 0;
    this._generation = 0;
    this._wanted = false;
    this._disposed = false;
  }

  get playing() { return Boolean(this._voice) && this._context?.state === 'running'; }
  get volume() { return this._volume; }
  get track() { return this._track; }
  get duration() { return this._cache.get(this._track)?.buffer?.duration ?? SOUND_TRACKS.find((item) => item.id === this._track).duration; }
  get currentTime() {
    return this._voice ? (this._voice.offset + Math.max(0, this._context.currentTime - this._voice.startedAt)) % this.duration : this._offset;
  }
  get section() {
    const bar = this.currentTime / (240 / TRACKS.find((item) => item.id === this._track).bpm);
    return [...SECTIONS[this._track]].reverse().find(([start]) => bar >= start)[1];
  }
  get waveform() { return this._cache.get(this._track)?.waveform ?? null; }

  async play() {
    if (this._disposed) throw new Error('音乐播放器已经关闭。');
    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContext) throw new Error('当前浏览器不支持音频播放。');
    if (!this._context) {
      this._context = new AudioContext({ latencyHint: 'playback' });
      this._master = this._context.createGain();
      this._master.gain.value = this._volume;
      this._master.connect(this._context.destination);
    }
    // resume 在第一个 await 前调用，保留真实点击带来的音频许可。
    const resumed = this._context.state === 'running' ? Promise.resolve() : this._context.resume();
    if (this._voice) { await resumed; return this.playing; }
    if (this._pending) { await resumed; return this._pending; }
    this._wanted = true;
    const generation = ++this._generation;
    const request = Promise.all([resumed, this._prepareBuffer(this._track)]).then(([, result]) => {
      if (generation !== this._generation || !this._wanted || this._disposed) return false;
      if (this._context.state !== 'running') throw new Error('浏览器暂未允许播放，请再次点击播放。');
      this._startVoice(result.buffer, this._offset);
      return true;
    }).catch((error) => {
      if (generation !== this._generation || !this._wanted || this._disposed) return false;
      this._wanted = false;
      if (error.name === 'NotAllowedError') throw new Error('浏览器暂未允许播放，请再次点击播放。', { cause: error });
      throw error;
    }).finally(() => { if (this._pending === request) this._pending = null; });
    this._pending = request;
    return request;
  }

  _prepareBuffer(id) {
    let record = this._cache.get(id);
    if (record?.buffer) return Promise.resolve(record);
    if (!record) { record = {}; this._cache.set(id, record); }
    if (!record.promise) {
      record.promise = renderTrack(this._context, id, () => this._disposed).then((result) => {
        if (this._disposed) return null;
        Object.assign(record, result);
        return record;
      }).finally(() => { record.promise = null; });
    }
    return record.promise;
  }

  _startVoice(buffer, offset, fade = 0.025) {
    const context = this._context;
    const source = context.createBufferSource();
    const gain = context.createGain();
    const startedAt = context.currentTime;
    source.buffer = buffer;
    source.loop = true;
    gain.gain.setValueAtTime(0, startedAt);
    gain.gain.linearRampToValueAtTime(1, startedAt + fade);
    source.connect(gain);
    gain.connect(this._master);
    const voice = { source, gain, startedAt, offset };
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      if (this._voice === voice) this._voice = null;
    };
    source.start(startedAt, offset);
    this._voice = voice;
  }

  _stopVoice(fade = 0.055) {
    const voice = this._voice;
    if (!voice) return;
    this._voice = null;
    const now = this._context.currentTime;
    hold(voice.gain.gain, now);
    voice.gain.gain.setTargetAtTime(0, now, fade / 4);
    voice.source.stop(now + fade);
  }

  pause() {
    this._offset = this.currentTime;
    this._wanted = false;
    this._generation += 1;
    this._pending = null;
    this._stopVoice();
  }

  setTrack(id) {
    if (this._disposed) throw new Error('音乐播放器已经关闭。');
    const metadata = SOUND_TRACKS.find((item) => item.id === id);
    if (!metadata) throw new Error('没有找到这首音乐。');
    if (id !== this._track) {
      this.pause();
      this._track = id;
      this._offset = 0;
    }
    return metadata;
  }

  seek(seconds) {
    if (this._disposed) throw new Error('音乐播放器已经关闭。');
    if (!Number.isFinite(seconds)) throw new TypeError('播放位置需要是一个有效数字。');
    this._offset = Math.max(0, Math.min(this.duration - 1 / SAMPLE_RATE, seconds));
    if (this._voice) {
      this._stopVoice(0.035);
      this._startVoice(this._cache.get(this._track).buffer, this._offset, 0.012);
    }
    return this._offset;
  }

  setVolume(value) {
    this._volume = clampVolume(value);
    if (this._master && this._context.state !== 'closed') {
      const now = this._context.currentTime;
      hold(this._master.gain, now);
      this._master.gain.setTargetAtTime(this._volume, now, 0.06);
    }
  }

  async dispose() {
    if (this._disposed) return;
    this.pause();
    this._disposed = true;
    this._cache.clear();
    const context = this._context;
    this._context = null;
    this._master = null;
    if (context && context.state !== 'closed') await context.close();
  }
}
