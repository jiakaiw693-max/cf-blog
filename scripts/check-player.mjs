import assert from 'node:assert/strict';
import { SpaceSound, SOUND_TRACKS } from '../public/sound.js';
class Media extends EventTarget {
  constructor() { super(); this.attributes=new Map(); this.paused=true; this.currentTime=0; this.duration=NaN; this.readyState=0; this.pending=[]; this.error=null; this.ended=false; }
  set src(value) { this.attributes.set('src',value); this.readyState=0; this.duration=NaN; this.currentTime=0; }
  get src() { return this.attributes.get('src'); }
  getAttribute(name) { return this.attributes.get(name) || null; }
  hasAttribute(name) { return this.attributes.has(name); }
  removeAttribute(name) { this.attributes.delete(name); }
  play() { this.paused=false; if(this.src?.startsWith('data:'))return Promise.resolve(); return new Promise((resolve,reject)=>this.pending.push({resolve,reject})); }
  pause() { const changed=!this.paused; this.paused=true; if(changed) this.dispatchEvent(new Event('pause')); }
  load() { this.readyState=0; this.currentTime=0; this.duration=NaN; }
  metadata(duration=SOUND_TRACKS[0].duration) { this.readyState=4; this.duration=duration; this.dispatchEvent(new Event('loadedmetadata')); }
  finish(index=0) { this.pending[index].resolve(); }
}
const fetchAudio=async()=>({ok:true,blob:async()=>new Blob(['ID3 test'])});
const settle=()=>new Promise(resolve=>setImmediate(resolve));
let checks=0;
{
  const audio=new Media(), sound=new SpaceSound({audioElement:audio,fetchAudio});
  assert.equal(audio.src,undefined); assert.equal(sound.playing,false); checks++;
  const pending=sound.play(); sound.pause();
  assert.equal(await pending,false); assert.equal(audio.paused,true); checks++;
  await sound.dispose();
}
{
  const audio=new Media(), sound=new SpaceSound({audioElement:audio,fetchAudio}), states=[];
  sound.subscribe(state=>states.push(state));
  sound.seek(120); const pending=sound.play(); await settle(); audio.metadata();
  assert.equal(audio.currentTime,120); audio.finish(); assert.equal(await pending,true); checks++;
  audio.dispatchEvent(new Event('waiting')); assert.equal(states.at(-1),'buffering'); checks++;
  sound.setVolume(0); assert.equal(audio.volume,0); sound.setVolume(.37); assert.equal(audio.volume,.37); checks++;
  audio.pause(); assert.equal(sound.playing,false); assert.equal(states.at(-1),'paused'); checks++;
  sound.seek(99999); assert.ok(audio.currentTime<audio.duration); checks++;
  await sound.dispose(); assert.equal(audio.src,undefined); assert.equal(await sound.play(),false); checks++;
}
{
  const audio=new Media(), sound=new SpaceSound({audioElement:audio,fetchAudio});
  const old=sound.play(); sound.setTrack('love'); const current=sound.play();
  await settle(); audio.metadata(228.387); audio.finish(0);
  assert.equal(await old,false); assert.equal(await current,true);
  assert.equal(sound.track,'love'); assert.match(audio.src,/^blob:/); assert.equal(audio.paused,false); checks++;
  audio.error={code:3}; audio.dispatchEvent(new Event('error'));
  assert.equal(sound.playing,false); assert.equal(audio.paused,true); checks++;
  await sound.dispose();
}
{
  const audio = new Media(), sound = new SpaceSound({audioElement:audio,fetchAudio}), states=[];
  sound.subscribe(state=>states.push(state));
  const pending=sound.play(); await settle(); audio.metadata(SOUND_TRACKS[0].duration); audio.finish(); await pending;
  sound.setRepeat(true); assert.equal(audio.loop,true); sound.setRepeat(false); assert.equal(audio.loop,false); checks++;
  audio.ended=true; audio.pause(); audio.dispatchEvent(new Event('ended'));
  assert.equal(states.at(-1),'ended'); assert.equal(sound.playing,false); checks++;
  await sound.dispose();
}
{
  const audio = new Media(); let aborted=false;
  const fetchPending = (_url,{signal}) => new Promise((_resolve,reject) => signal.addEventListener('abort',()=>{aborted=true; reject(new Error('aborted'));}));
  const sound = new SpaceSound({audioElement:audio,fetchAudio:fetchPending});
  const pending=sound.play(); sound.pause(); assert.equal(await pending,false); assert.equal(aborted,true); checks++;
  await sound.dispose();
}
for(const track of SOUND_TRACKS) { const sound=new SpaceSound({track:track.id}); assert.equal(sound.waveform.length,96); assert.ok(sound.waveform.every(x=>Number.isFinite(x)&&x>=0&&x<=1)); checks++; }
console.log(`${checks} audio lifecycle and asset checks passed`);
