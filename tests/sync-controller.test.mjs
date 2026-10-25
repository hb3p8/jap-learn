import test from 'node:test';
import assert from 'node:assert/strict';
import {freshState} from '../dist/engine.mjs';
import {createCloudSync} from '../dist/cloud-sync.mjs';
import {makeRecord} from '../dist/sync-core.mjs';
import {SyncAPIError} from '../dist/cloudflare-store.mjs';

const key='t'.repeat(43),endpoint='https://sync.example.test';
function environment(t,store,initial=freshState()){
 const saved=new Map([['kana-cloudflare-v1',JSON.stringify({device:'test-device',endpoint,lastCloudId:null,lastSyncedJSON:null})],['kana-sync-key-v1',key]]);
 let local=initial;const originals=new Map();
 const globals={localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)},navigator:{onLine:true},window:{addEventListener(){}}};
 for(const [name,value] of Object.entries(globals)){originals.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,configurable:true,writable:true});}
 const cloud=createCloudSync({getState:()=>local,applyState:s=>{local=s;},storeFactory:()=>store});
 t.after(()=>{cloud.disconnect();for(const [name,descriptor] of originals){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}});
 return {cloud,saved,getState:()=>local,setState:s=>{local=s;}};
}
function storeWith(heads=[]){return {endpoint,heads,async readHeads(){return this.heads;},async append(r){this.heads=[r];return r;}};}
test('a remembered device reconnects and restores cloud progress',async t=>{const record=makeRecord({...freshState(),xp:25,answered:5,correct:5},{id:'remote',device:'other'}),env=environment(t,storeWith([record]));await Promise.resolve();await env.cloud.sync();assert.equal(env.getState().xp,25);assert.equal(env.cloud.snapshot().status,'synced');assert.ok(!env.saved.get('kana-cloudflare-v1').includes(key));});
test('wrong or revoked credentials leave the learning state intact',async t=>{const store=storeWith(),env=environment(t,store);await Promise.resolve();await env.cloud.sync();env.setState({...freshState(),xp:15,answered:3,correct:3});store.readHeads=async()=>{throw new SyncAPIError('Неверный ключ.',401);};await env.cloud.sync();assert.equal(env.cloud.snapshot().status,'auth-required');assert.equal(env.getState().xp,15);assert.equal(env.cloud.snapshot().connected,false);});
test('disconnect during a pending write stays disconnected',async t=>{const store=storeWith(),env=environment(t,store);await Promise.resolve();await env.cloud.sync();env.setState({...freshState(),xp:10,answered:2,correct:2});let release,started;const writing=new Promise(r=>{started=r;});store.append=record=>{started();return new Promise(r=>{release=()=>r(record);});};const syncing=env.cloud.sync();await writing;env.cloud.disconnect();release();await syncing;assert.equal(env.cloud.snapshot().status,'disconnected');assert.ok(!env.saved.has('kana-sync-key-v1'));assert.equal(env.getState().xp,10);});
test('offline edits remain local and do not attempt an upload',async t=>{const store=storeWith(),env=environment(t,store);await Promise.resolve();await env.cloud.sync();env.setState({...freshState(),xp:20,answered:4,correct:4});navigator.onLine=false;await env.cloud.sync();assert.equal(env.cloud.snapshot().status,'offline');assert.equal(env.getState().xp,20);});
