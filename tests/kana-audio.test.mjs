import test from 'node:test';
import assert from 'node:assert/strict';
import {KANA,LESSONS} from '../dist/content.mjs';
import {kanaAudioURL} from '../dist/kana-audio.mjs';
test('all kana use a cache-distinct recording with a separate slow asset, including wo and n',()=>{for(const {id}of KANA){assert.ok(kanaAudioURL(id).includes('/kana-audio/'));assert.ok(!kanaAudioURL(id).includes('/assets/audio/'));assert.notEqual(kanaAudioURL(id),kanaAudioURL(id,true));}assert.ok(kanaAudioURL('wo').endsWith('/wo.mp3'));assert.ok(kanaAudioURL('n').endsWith('/n.mp3'));assert.equal(new Set(KANA.flatMap(k=>[kanaAudioURL(k.id),kanaAudioURL(k.id,true)])).size,92);});
test('existing word examples retain their recordings; unknown paths are rejected',()=>{for(const l of LESSONS)assert.equal(kanaAudioURL('word-'+l.id),'assets/audio/word-'+l.id+'.mp3');for(const id of ['../secret','__proto__','unknown',null])assert.equal(kanaAudioURL(id),null);});
