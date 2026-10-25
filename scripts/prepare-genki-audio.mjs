import {mkdir,copyFile,access} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve,join} from 'node:path';
import {GENKI_WORDS} from '../dist/genki-content.mjs';
const source=process.argv[2];if(!source)throw new Error('Pass the local Genki second-edition folder.');
const target=resolve('dist/assets/genki'),temporary=resolve('.local/genki-audio');
await mkdir(join(target,'words'),{recursive:true});await mkdir(temporary,{recursive:true});
for(const id of ['K01-01','K01-02','K01-03','K01-04','K01-05','K01-06','K01-07','K01-11'])await copyFile(join(source,'Genki1_KaiwaBunpo-hen(Textbook)',id+'.mp3'),join(target,id+'.mp3'));
const run=(command,args)=>new Promise((resolve,reject)=>{const child=spawn(command,args,{stdio:['ignore','ignore','pipe']});let error='';child.stderr.on('data',b=>error+=b);child.on('error',reject);child.on('close',code=>code===0?resolve():reject(new Error(error||command+' failed')));});
for(const word of GENKI_WORDS){const file=join(target,'words',word.id+'.mp3');try{await access(file);continue;}catch{}const aiff=join(temporary,word.id+'.aiff');await run('/usr/bin/say',['-v','Kyoko','-r','125','-o',aiff,word.kana]);await run('/opt/homebrew/bin/ffmpeg',['-y','-v','error','-i',aiff,'-ac','1','-ar','24000','-codec:a','libmp3lame','-b:a','64k',file]);}
console.log('8 original Genki recordings and 28 word pronunciations prepared in the ignored private audio directory.');
