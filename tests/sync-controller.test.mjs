import test from 'node:test';
import assert from 'node:assert/strict';
import {freshState} from '../dist/engine.mjs';
import {createGoogleSync} from '../dist/google-sync.mjs';
import {makeRecord} from '../dist/sync-core.mjs';
import {GoogleAPIError} from '../dist/google-sheets.mjs';

function environment(t,store,initial=freshState()){
 const saved=new Map([['kana-google-v1',JSON.stringify({device:'test-device',clientId:'123-test.apps.googleusercontent.com',lastCloudId:null,lastSyncedJSON:null})]]);
 let authDone,local=initial;const originals=new Map();
 const globals={localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)},navigator:{onLine:true},window:{addEventListener(){},google:{accounts:{oauth2:{hasGrantedAllScopes:()=>true,initTokenClient:config=>({requestAccessToken(){authDone=config.callback({access_token:'test-only',expires_in:3600});}})}}}}};
 for(const [key,value] of Object.entries(globals)){originals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
 const cloud=createGoogleSync({getState:()=>local,applyState:value=>{local=value;},storeFactory:()=>store});
 t.after(()=>{cloud.disconnect();for(const [key,descriptor] of originals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
 return {cloud,saved,getState:()=>local,setState:value=>{local=value;},async connect(){await Promise.resolve();await cloud.connect();await authDone;}};
}
function storeWith(heads=[]){return {id:'sheet',url:'https://docs.google.com/spreadsheets/d/sheet/edit',heads,async open(){return {id:this.id,url:this.url};},async readHeads(){return this.heads;},async append(record){this.heads=[record];return record;}};}
test('first connection restores a fresh device and never persists a bearer token',async t=>{
 const remote=makeRecord({...freshState(),xp:25,answered:5,correct:5},{id:'remote',device:'other'}),store=storeWith([remote]),env=environment(t,store);
 await env.connect();assert.equal(env.getState().xp,25);assert.equal(env.cloud.snapshot().status,'synced');assert.ok(!JSON.stringify([...env.saved.values()]).includes('test-only'));
});
test('expired Google authorization keeps local progress and requests a new login',async t=>{
 const store=storeWith(),env=environment(t,store);await env.connect();env.setState({...freshState(),xp:15,answered:3,correct:3});
 store.readHeads=async()=>{throw new GoogleAPIError('Сеанс Google истёк.',401);};await env.cloud.sync();
 assert.equal(env.cloud.snapshot().status,'auth-required');assert.equal(env.getState().xp,15);assert.equal(env.cloud.snapshot().connected,false);
});
test('disconnect during a pending write cannot reconnect or mutate sync status',async t=>{
 const store=storeWith(),env=environment(t,store);await env.connect();env.setState({...freshState(),xp:10,answered:2,correct:2});
 let release,started;const writing=new Promise(resolve=>{started=resolve;});
 store.append=record=>{started();return new Promise(resolve=>{release=()=>resolve(record);});};
 const syncing=env.cloud.sync();await writing;env.cloud.disconnect();release();await syncing;
 assert.equal(env.cloud.snapshot().status,'disconnected');assert.equal(env.cloud.snapshot().connected,false);assert.equal(env.getState().xp,10);
});
