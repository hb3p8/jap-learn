import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {GENKI_WORDS} from '../dist/genki-content.mjs';
import {genkiAudioURL} from '../dist/genki-audio.mjs';
import {GENKI_CLIPS,GENKI_SOURCE_HASHES} from './genki-word-clips.mjs';
const source=process.argv[2];if(!source)throw new Error('Pass the local Genki second-edition folder.');
const sourceDir=join(source,'Genki1_KaiwaBunpo-hen(Textbook)'),target=resolve('dist/assets/genki');
const ffmpeg=process.env.FFMPEG||'/opt/homebrew/bin/ffmpeg';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
await mkdir(target,{recursive:true});
for(const [track,expected] of Object.entries(GENKI_SOURCE_HASHES)){
 if(sha(await readFile(join(sourceDir,track+'.mp3')))!==expected)throw new Error('Different source recording: '+track+'. Check the clip boundaries before using this edition.');
}
for(const id of ['K01-01','K01-02','K01-03','K01-04','K01-05','K01-06','K01-07','K01-11'])await copyFile(join(sourceDir,id+'.mp3'),join(target,id+'.mp3'));
const records=[];
for(const word of GENKI_WORDS){
 const clip=GENKI_CLIPS[word.id];if(!clip)throw new Error('Missing clip: '+word.id);
 const [track,start,end]=clip,src=join(sourceDir,track+'.mp3'),duration=end-start;
 const pcm=execFileSync(ffmpeg,['-v','error','-i',src,'-ss',String(start),'-t',String(duration),'-f','f32le','-ac','1','pipe:1']);
 let peak=0;for(let i=0;i<pcm.length;i+=4)peak=Math.max(peak,Math.abs(pcm.readFloatLE(i)));
 if(!Number.isFinite(peak)||peak<.01)throw new Error('Silent clip: '+word.id);
 const gain=-2-20*Math.log10(peak),files={};
 for(const slow of [false,true]){
  const file=resolve('dist',genkiAudioURL(word.audio,slow));await mkdir(resolve(file,'..'),{recursive:true});
  // Boundaries include silence around the complete utterance. Short fades only touch that padding.
  const filter=`atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS,afade=t=in:d=0.01,afade=t=out:st=${(duration-.01).toFixed(4)}:d=0.01,volume=${gain.toFixed(5)}dB${slow?',atempo=0.8':''},alimiter=limit=0.89125:level=false`;
  execFileSync(ffmpeg,['-y','-v','error','-i',src,'-af',filter,'-ac','1','-ar','48000','-c:a','libmp3lame','-b:a','128k',file]);
  files[slow?'slow':'normal']=sha(await readFile(file));
 }
 records.push({id:word.id,track,start,end,gainDb:+gain.toFixed(3),files});
}
await mkdir('.local/genki-audio',{recursive:true});await writeFile('.local/genki-audio/manifest.json',JSON.stringify({sourceHashes:GENKI_SOURCE_HASHES,processing:'Original Genki second-edition words; peak -2 dBFS; optional atempo=0.8.',records},null,2)+'\n');
console.log('8 original Genki tracks + 28 original word clips + 28 pitch-preserving slow versions prepared for private hosting.');
