import {BY_ID,LESSONS} from './content.mjs';
// A new path prevents previously cached synthetic syllables from being reused.
export const KANA_AUDIO_VERSION='marugoto-v1';
export function kanaAudioURL(id,slow=false){
 if(Object.hasOwn(BY_ID,id))return `assets/kana-audio/${KANA_AUDIO_VERSION}/${id}${slow?'-slow':''}.mp3`;
 if(!slow&&LESSONS.some(l=>'word-'+l.id===id))return `assets/audio/${id}.mp3`;
 return null;
}
