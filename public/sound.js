// 原创 96 BPM 太空电子氛围循环，仅在用户点击播放后创建音频上下文。
const BPM = 96;
const BEAT = 60 / BPM;
const LOOP_SECONDS = 64 * BEAT;
const SAMPLE_RATE = 32000;
const PRE_ROLL = 8 * BEAT;
const DEFAULT_VOLUME = 0.22;

const CHORDS = [
  [50, 57, 60, 64, 65], // Dm9
  [46, 53, 57, 60, 62], // Bbmaj9
  [41, 57, 60, 64, 67], // Fmaj9
  [48, 55, 60, 62, 64], // Cadd9
  [50, 57, 60, 64, 65],
  [46, 53, 57, 60, 62],
  [41, 57, 60, 64, 67],
  [48, 55, 60, 62, 64],
];

const frequency = (midi) => 440 * 2 ** ((midi - 69) / 12);
const clampVolume = (value) => {
  if (!Number.isFinite(value)) throw new TypeError('音乐音量需要是一个有效数字。');
  return Math.max(0, Math.min(1, value));
};

function hold(parameter, time) {
  if (typeof parameter.cancelAndHoldAtTime === 'function') {
    parameter.cancelAndHoldAtTime(time);
  } else {
    const value = parameter.value;
    parameter.cancelScheduledValues(time);
    parameter.setValueAtTime(value, time);
  }
}

function connectPan(context, input, destination, pan) {
  if (typeof context.createStereoPanner === 'function') {
    const panner = context.createStereoPanner();
    panner.pan.value = pan;
    input.connect(panner);
    panner.connect(destination);
  } else {
    input.connect(destination);
  }
}

function softNote(context, bus, time, midi, duration, level, pan, pad = false) {
  const envelope = context.createGain();
  const lowpass = context.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = pad ? 1400 : 2900;
  lowpass.Q.value = 0.35;
  const attack = pad ? 1.35 : 0.014;
  const end = time + duration;
  envelope.gain.setValueAtTime(0, time);
  envelope.gain.linearRampToValueAtTime(level, time + attack);
  if (pad) {
    envelope.gain.setValueAtTime(level * 0.86, time + duration - 2.3);
    envelope.gain.linearRampToValueAtTime(0, end);
  } else {
    envelope.gain.exponentialRampToValueAtTime(0.00001, end);
  }
  envelope.connect(lowpass);
  connectPan(context, lowpass, bus, pan);

  const tone = context.createOscillator();
  tone.type = pad ? 'triangle' : 'sine';
  tone.frequency.value = frequency(midi);
  tone.detune.value = pad ? pan * 5 : 0;
  tone.connect(envelope);
  tone.start(time);
  tone.stop(end + 0.02);

  if (!pad) {
    const modulation = context.createOscillator();
    const amount = context.createGain();
    modulation.frequency.value = frequency(midi) * 2;
    amount.gain.setValueAtTime(frequency(midi) * 0.23, time);
    amount.gain.exponentialRampToValueAtTime(0.01, end);
    modulation.connect(amount);
    amount.connect(tone.frequency);
    modulation.start(time);
    modulation.stop(end + 0.02);
  }
}

function kick(context, bus, time, level) {
  const tone = context.createOscillator();
  const envelope = context.createGain();
  tone.frequency.setValueAtTime(82, time);
  tone.frequency.exponentialRampToValueAtTime(43, time + 0.16);
  envelope.gain.setValueAtTime(0.00001, time);
  envelope.gain.linearRampToValueAtTime(level, time + 0.007);
  envelope.gain.exponentialRampToValueAtTime(0.00001, time + 0.32);
  tone.connect(envelope);
  envelope.connect(bus);
  tone.start(time);
  tone.stop(time + 0.34);
}

function noise(context, bus, buffer, time, level, snare = false) {
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const envelope = context.createGain();
  source.buffer = buffer;
  source.playbackRate.value = snare ? 0.82 : 1.06;
  filter.type = snare ? 'bandpass' : 'highpass';
  filter.frequency.value = snare ? 1800 : 4400;
  filter.Q.value = snare ? 0.55 : 0.4;
  const duration = snare ? 0.18 : 0.065;
  envelope.gain.setValueAtTime(0, time);
  envelope.gain.linearRampToValueAtTime(level, time + 0.003);
  envelope.gain.exponentialRampToValueAtTime(0.00001, time + duration);
  source.connect(filter);
  filter.connect(envelope);
  connectPan(context, envelope, bus, snare ? 0.08 : -0.22);
  source.start(time);
  source.stop(time + duration + 0.01);
}

function finishLoop(context, rendered) {
  const length = Math.round(LOOP_SECONDS * SAMPLE_RATE);
  const offset = Math.round(PRE_ROLL * SAMPLE_RATE);
  const output = context.createBuffer(2, length, SAMPLE_RATE);
  let peak = 0;
  for (let channel = 0; channel < 2; channel += 1) {
    const samples = output.getChannelData(channel);
    samples.set(rendered.getChannelData(channel).subarray(offset, offset + length));
    // 四毫秒接缝将两端收拢到同一采样值，消除循环边界的轻微点击声。
    const seam = (samples[0] + samples[length - 1]) / 2;
    const seamFrames = Math.round(SAMPLE_RATE * 0.004);
    for (let i = 0; i < seamFrames; i += 1) {
      const weight = 0.5 - 0.5 * Math.cos(Math.PI * i / (seamFrames - 1));
      samples[i] = seam + (samples[i] - seam) * weight;
      samples[length - 1 - i] = seam + (samples[length - 1 - i] - seam) * weight;
    }
    for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  }
  // 单次离线归一化保留峰值余量，让低默认音量仍能听清旋律。
  if (peak > 0.00001) {
    for (let channel = 0; channel < 2; channel += 1) {
      const samples = output.getChannelData(channel);
      for (let i = 0; i < samples.length; i += 1) samples[i] *= 0.68 / peak;
    }
  }
  return output;
}

async function renderLoop(audioContext) {
  const OfflineContext = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  if (!OfflineContext) throw new Error('当前浏览器不支持这段氛围音乐。');
  const context = new OfflineContext(2, Math.round((LOOP_SECONDS + PRE_ROLL) * SAMPLE_RATE), SAMPLE_RATE);
  const bus = context.createGain();
  const compressor = context.createDynamicsCompressor();
  const output = context.createGain();
  compressor.threshold.value = -17;
  compressor.knee.value = 20;
  compressor.ratio.value = 2.2;
  compressor.attack.value = 0.01;
  compressor.release.value = 0.22;
  output.gain.value = 0.78;
  bus.connect(compressor);
  compressor.connect(output);
  output.connect(context.destination);

  const echo = context.createDelay(1);
  const feedback = context.createGain();
  const echoFilter = context.createBiquadFilter();
  const wet = context.createGain();
  echo.delayTime.value = BEAT * 0.75;
  feedback.gain.value = 0.2;
  echoFilter.type = 'lowpass';
  echoFilter.frequency.value = 1800;
  wet.gain.value = 0.15;
  bus.connect(echo);
  echo.connect(echoFilter);
  echoFilter.connect(wet);
  wet.connect(compressor);
  echoFilter.connect(feedback);
  feedback.connect(echo);

  const hiss = context.createBuffer(1, Math.ceil(SAMPLE_RATE * 0.24), SAMPLE_RATE);
  const hissSamples = hiss.getChannelData(0);
  let seed = 7193;
  for (let i = 0; i < hissSamples.length; i += 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    hissSamples[i] = (seed / 4294967296) * 2 - 1;
  }

  // 从上一轮的最后两小节预热，让和弦尾音和回声穿过循环边界。
  for (let chordIndex = -1; chordIndex < CHORDS.length; chordIndex += 1) {
    const index = (chordIndex + CHORDS.length) % CHORDS.length;
    const chord = CHORDS[index];
    const start = PRE_ROLL + chordIndex * 8 * BEAT;
    chord.forEach((midi, voice) => {
      softNote(context, bus, start, midi + 12, 8 * BEAT + 2.3, 0.025, (voice - 2) * 0.32, true);
    });
    for (let step = 0; step < 16; step += 1) {
      const time = start + step * BEAT / 2;
      if (step !== 4 && step !== 12) {
        const pattern = [2, 4, 3, 1, 3, 4, 2, 0];
        const midi = chord[pattern[step % pattern.length]] + (step % 4 === 3 ? 24 : 12);
        softNote(context, bus, time, midi, 0.58, step % 4 === 0 ? 0.07 : 0.045, step % 2 ? 0.35 : -0.35);
      }
      noise(context, bus, hiss, time, step % 2 ? 0.025 : 0.018);
      if (step % 8 === 0 || step % 8 === 4) kick(context, bus, time, step % 8 === 0 ? 0.21 : 0.13);
      if (step % 8 === 2 || step % 8 === 6) noise(context, bus, hiss, time, 0.07, true);
      if (step % 4 === 0) softNote(context, bus, time + 0.015, chord[0] - 12, 0.95, 0.11, 0);
    }
    softNote(context, bus, start + 6.5 * BEAT, chord[4] + 24, 1.7, 0.025, index % 2 ? -0.55 : 0.55);
  }

  const rendered = await context.startRendering();
  return finishLoop(audioContext, rendered);
}

export class SpaceSound {
  constructor({ volume = DEFAULT_VOLUME } = {}) {
    this._volume = clampVolume(volume);
    this._context = null;
    this._master = null;
    this._buffer = null;
    this._bufferPromise = null;
    this._pending = null;
    this._voice = null;
    this._offset = 0;
    this._generation = 0;
    this._wanted = false;
    this._disposed = false;
  }

  get playing() {
    return Boolean(this._voice) && this._context?.state === 'running';
  }

  get volume() {
    return this._volume;
  }

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
    // resume 在第一个 await 前调用，保留点击事件中的浏览器音频许可。
    const resumed = this._context.state === 'running' ? Promise.resolve() : this._context.resume();
    if (this._voice) {
      await resumed;
      return this.playing;
    }
    if (this._pending) {
      await resumed;
      return this._pending;
    }
    this._wanted = true;
    const generation = ++this._generation;
    const render = this._buffer ? Promise.resolve(this._buffer) : this._prepareBuffer();
    const request = Promise.all([resumed, render]).then(([, buffer]) => {
      if (generation !== this._generation || !this._wanted || this._disposed) return false;
      const context = this._context;
      if (context.state !== 'running') throw new Error('浏览器暂未允许播放，请再次点击播放。');
      const source = context.createBufferSource();
      const gain = context.createGain();
      const startedAt = context.currentTime;
      source.buffer = buffer;
      source.loop = true;
      gain.gain.setValueAtTime(0, startedAt);
      gain.gain.linearRampToValueAtTime(1, startedAt + 0.08);
      source.connect(gain);
      gain.connect(this._master);
      const voice = { source, gain, startedAt, offset: this._offset };
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        if (this._voice === voice) this._voice = null;
      };
      source.start(startedAt, this._offset);
      this._voice = voice;
      return true;
    }).catch((error) => {
      if (generation !== this._generation || !this._wanted || this._disposed) return false;
      this._wanted = false;
      if (error.name === 'NotAllowedError') throw new Error('浏览器暂未允许播放，请再次点击播放。', { cause: error });
      throw error;
    }).finally(() => {
      if (this._pending === request) this._pending = null;
    });
    this._pending = request;
    return request;
  }

  _prepareBuffer() {
    if (!this._bufferPromise) {
      this._bufferPromise = renderLoop(this._context).then((buffer) => {
        if (this._disposed) return null;
        this._buffer = buffer;
        return buffer;
      }).finally(() => {
        this._bufferPromise = null;
      });
    }
    return this._bufferPromise;
  }

  pause() {
    this._wanted = false;
    this._generation += 1;
    this._pending = null;
    const voice = this._voice;
    if (!voice) return;
    this._voice = null;
    const now = this._context.currentTime;
    this._offset = (voice.offset + Math.max(0, now - voice.startedAt)) % LOOP_SECONDS;
    hold(voice.gain.gain, now);
    voice.gain.gain.setTargetAtTime(0, now, 0.018);
    voice.source.stop(now + 0.08);
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
    this._buffer = null;
    const context = this._context;
    this._context = null;
    this._master = null;
    if (context && context.state !== 'closed') await context.close();
  }
}
