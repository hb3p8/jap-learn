import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {KANA} from '../dist/content.mjs';
import {kanaAudioURL} from '../dist/kana-audio.mjs';
let shortest=Infinity,longest=0,maxPeak=0;
for(const kana of KANA){const durations=[];for(const slow of [false,true]){const file='dist/'+kanaAudioURL(kana.id,slow),pcm=execFileSync('/opt/homebrew/bin/ffmpeg',['-v','error','-i',file,'-f','f32le','-ar','48000','-ac','1','pipe:1']);let peak=0,energy=0;for(let i=0;i<pcm.length;i+=4){const n=pcm.readFloatLE(i);assert.ok(Number.isFinite(n));peak=Math.max(peak,Math.abs(n));energy+=n*n;}const samples=pcm.length/4,duration=samples/48000,rms=Math.sqrt(energy/samples);assert.ok(duration>.2&&duration<3,`${kana.id}: duration ${duration}`);assert.ok(peak<.99&&rms>.005,`${kana.id}: clipped or silent`);durations.push(duration);shortest=Math.min(shortest,duration);longest=Math.max(longest,duration);maxPeak=Math.max(maxPeak,peak);}assert.ok(durations[1]/durations[0]>1.15&&durations[1]/durations[0]<1.4,`${kana.id}: invalid slow version`);}
console.log(JSON.stringify({files:92,decoding:'passed',clipping:false,shortestSeconds:+shortest.toFixed(3),longestSeconds:+longest.toFixed(3),highestPeakDb:+(20*Math.log10(maxPeak)).toFixed(2)}));
