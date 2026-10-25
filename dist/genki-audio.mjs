import {GENKI_AUDIO} from './genki-content.mjs';
export const GENKI_WORD_AUDIO_VERSION='original-v1';
export function genkiAudioURL(id,slow=false){
 if(!Object.hasOwn(GENKI_AUDIO,id))return null;
 const src=GENKI_AUDIO[id];
 return slow&&id.startsWith('word-')?src.replace(/\.mp3$/,'-slow.mp3'):src;
}
