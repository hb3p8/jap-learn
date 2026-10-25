import test from 'node:test';
import assert from 'node:assert/strict';
import {GENKI_WORDS} from '../dist/genki-content.mjs';
import {genkiAudioURL} from '../dist/genki-audio.mjs';
import {GENKI_CLIPS,GENKI_SOURCE_HASHES} from '../scripts/genki-word-clips.mjs';
test('all 28 Genki words have distinct versioned original and slow recordings',()=>{
 assert.equal(Object.keys(GENKI_CLIPS).length,28);
 for(const w of GENKI_WORDS){const [source,start,end]=GENKI_CLIPS[w.id];assert.ok(GENKI_SOURCE_HASHES[source]);assert.ok(start>=0&&end>start&&end-start<3);assert.equal(genkiAudioURL(w.audio),`assets/genki/words-original-v1/${w.id}.mp3`);assert.equal(genkiAudioURL(w.audio,true),`assets/genki/words-original-v1/${w.id}-slow.mp3`);}
 assert.equal(genkiAudioURL('K01-01'),'assets/genki/K01-01.mp3');assert.equal(genkiAudioURL('unknown'),null);assert.equal(genkiAudioURL('__proto__'),null);
});
