import {mkdir,readFile,writeFile,access} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {KANA} from '../dist/content.mjs';
import {KANA_AUDIO_VERSION} from '../dist/kana-audio.mjs';
const page='https://a1.marugotoweb.jp/en/hiragana.php';
const sourceDir=resolve('.local/kana-audio-sources'),output=resolve('dist/assets/kana-audio',KANA_AUDIO_VERSION);
await mkdir(sourceDir,{recursive:true});await mkdir(output,{recursive:true});
async function get(url){for(let attempt=0;attempt<3;attempt++){try{const response=await fetch(url,{signal:AbortSignal.timeout(45000)});if(!response.ok)throw new Error('HTTP '+response.status);return Buffer.from(await response.arrayBuffer());}catch(error){if(attempt===2)throw error;}}}
const html=(await get(page)).toString('utf8'),mapping=new Map();
for(const match of html.matchAll(/<a href="#detail_column_[^"]+"[^>]*><img[^>]*alt="([^"]+)"[^>]*>.*?<source src="([^"]+)"/gs))if(!mapping.has(match[1]))mapping.set(match[1],new URL(match[2],page).href);
for(const kana of KANA)if(!mapping.has(kana.char))throw new Error('Missing official audio mapping for '+kana.id);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),records=[];let index=0;
async function prepare(){while(index<KANA.length){const kana=KANA[index++],source=join(sourceDir,kana.id+'.mp3'),url=mapping.get(kana.char);try{await access(source);}catch{await writeFile(source,await get(url));}
 const bytes=await readFile(source);if(bytes.length<1000)throw new Error('Invalid source file '+kana.id);
 const pcm=execFileSync('/opt/homebrew/bin/ffmpeg',['-v','error','-i',source,'-f','f32le','-ac','1','pipe:1']);let peak=0,energy=0;for(let i=0;i<pcm.length;i+=4){const n=pcm.readFloatLE(i);peak=Math.max(peak,Math.abs(n));energy+=n*n;}if(!Number.isFinite(peak)||peak<.01)throw new Error('Silent recording '+kana.id);
 const gain=-2-20*Math.log10(peak);
 const files={};for(const slow of [false,true]){const file=join(output,kana.id+(slow?'-slow':'')+'.mp3');execFileSync('/opt/homebrew/bin/ffmpeg',['-y','-v','error','-i',source,'-af',`volume=${gain.toFixed(5)}dB${slow?',atempo=0.8':''},alimiter=limit=0.89125:level=false`,'-ac','1','-ar','48000','-c:a','libmp3lame','-b:a','128k',file]);files[slow?'slow':'normal']=sha(await readFile(file));}
 records.push({id:kana.id,char:kana.char,source:url,sourceSHA256:sha(bytes),sourcePeakDb:Number((20*Math.log10(peak)).toFixed(2)),gainDb:Number(gain.toFixed(2)),files});
}}
await Promise.all(Array.from({length:4},prepare));
await writeFile(join(sourceDir,'manifest.json'),JSON.stringify({sourcePage:page,credit:'The Japan Foundation, Japanese-Language Institute, Kansai',version:KANA_AUDIO_VERSION,processing:'Original timing; peak normalized to -2 dBFS; optional atempo=0.8; 128 kbps mono MP3.',records:records.sort((a,b)=>KANA.findIndex(k=>k.id===a.id)-KANA.findIndex(k=>k.id===b.id))},null,2)+'\n');
console.log('46 recorded kana + 46 pitch-preserving slow versions prepared for private hosting.');
