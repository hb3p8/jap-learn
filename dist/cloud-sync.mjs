import {CLOUDFLARE_SYNC_URL} from './config.mjs';
import {CloudflareStore,normalizeEndpoint,validSyncKey} from './cloudflare-store.mjs';
import {stateJSON,makeRecord,syncDecision} from './sync-core.mjs';

const META_KEY='kana-cloudflare-v1',KEY_STORAGE='kana-sync-key-v1';
export function createCloudSync({getState,applyState,onStatus=()=>{},onMessage=()=>{},sessionAuth=false,endpointOverride='',storeFactory=(endpoint,key)=>new CloudflareStore(endpoint,key,{sessionAuth})}){
 let meta={device:crypto.randomUUID(),lastCloudId:null,lastSyncedJSON:null},key='',status='disconnected',error='',conflict=null;
 try{const saved=JSON.parse(localStorage.getItem(META_KEY)||'null');if(saved&&typeof saved.device==='string')meta={...meta,...saved};if(!sessionAuth)key=localStorage.getItem(KEY_STORAGE)||'';}catch{}
 let store=null,busy=null,timer=null,pending=null,generation=0,ready=false,stopped=false,retryCount=0,rerun=false;
 const endpoint=()=>endpointOverride||meta.endpoint||CLOUDFLARE_SYNC_URL||'';
 const configured=()=>!stopped&&!!endpoint()&&(sessionAuth||validSyncKey(key));
 const persist=()=>{try{localStorage.setItem(META_KEY,JSON.stringify(meta));}catch{}};
 const notify=()=>onStatus();
 function setStatus(value,message=''){status=value;error=message;notify();}
 function retry(){if(!configured()||!navigator.onLine)return;clearTimeout(timer);timer=setTimeout(()=>sync(),Math.min(2000*2**retryCount++,60000));}
 function handleError(e){
  if(e.status===401){ready=false;setStatus('auth-required',sessionAuth?'Войди снова, чтобы продолжить автосохранение.':e.message);}
  else{setStatus('error',e.message||'Ошибка синхронизации. Прогресс сохранён локально.');if(e.status===0||e.status===429||e.status>=500)retry();}
 }
 function acknowledge(record){meta.lastCloudId=record.id;meta.lastSyncedJSON=stateJSON(record.state);meta.endpoint=store.endpoint;meta.lastSavedAt=record.savedAt;persist();pending=null;conflict=null;retryCount=0;}
 async function sync(){
  clearTimeout(timer);
  if(busy)return busy;
  if(!configured()){setStatus('disconnected');return;}
  if(!navigator.onLine){setStatus('offline');return;}
  if(!store)store=storeFactory(endpoint(),key);
  const connection=generation,activeStore=store;rerun=false;
  const job=(async()=>{
   try{
    setStatus('syncing');const heads=await activeStore.readHeads();if(connection!==generation)return;ready=true;
    const local=getState(),decision=syncDecision(local,heads,meta);
    if(decision.action==='conflict'){conflict={heads,local};setStatus('conflict');return;}
    if(decision.action==='pull'){applyState(decision.remote.state);acknowledge(decision.remote);onMessage('Прогресс загружен.');}
    else if(decision.action==='ack')acknowledge(decision.remote);
    else{
     if(!pending||stateJSON(pending.state)!==stateJSON(local)||JSON.stringify(pending.parents)!==JSON.stringify(decision.parents))pending=makeRecord(local,{id:crypto.randomUUID(),parents:decision.parents,device:meta.device});
     const record=pending;await activeStore.append(record);if(connection!==generation)return;acknowledge(record);
    }
    setStatus('synced');if(stateJSON(getState())!==meta.lastSyncedJSON)rerun=true;
   }catch(e){if(connection===generation)handleError(e);}
  })();
  busy=job;try{await job;}finally{if(busy===job){busy=null;if(connection===generation&&rerun&&status==='synced'){rerun=false;queueMicrotask(()=>sync());}}}
 }
 function noteChange(){
  if(!configured()||status==='auth-required')return;
  if(conflict){notify();return;}if(!navigator.onLine){setStatus('offline');return;}
  if(busy){rerun=true;return;}
  clearTimeout(timer);setStatus('pending');timer=setTimeout(()=>sync(),250);
 }
 async function resolveConflict(choice){
  if(!conflict||busy)return;
  const connection=generation,activeStore=store,{heads}=conflict,localBefore=stateJSON(getState());
  const selected=choice==='local'?getState():heads.find(h=>h.id===choice)?.state;
  if(!selected)throw new Error('Версия недоступна. Повтори синхронизацию.');
  const job=(async()=>{
   try{
    setStatus('syncing');const current=await activeStore.readHeads();if(connection!==generation)return;
    if(JSON.stringify(current.map(h=>h.id).sort())!==JSON.stringify(heads.map(h=>h.id).sort())){conflict={heads:current,local:getState()};setStatus('conflict');onMessage('Появилась новая версия. Выбери сохранение повторно.');return;}
    const record=makeRecord(selected,{id:crypto.randomUUID(),parents:heads.map(h=>h.id),device:meta.device});
    await activeStore.append(record);if(connection!==generation)return;
    if(choice!=='local'){
     if(stateJSON(getState())!==localBefore){conflict={heads:[record],local:getState()};setStatus('conflict');return;}
     try{localStorage.setItem('kana-before-restore-v1',stateJSON(getState()));}catch{}applyState(selected);
    }
    acknowledge(record);setStatus('synced');if(stateJSON(getState())!==meta.lastSyncedJSON)rerun=true;
   }catch(e){if(connection===generation)handleError(e);}
  })();busy=job;try{await job;}finally{if(busy===job){busy=null;if(connection===generation&&rerun&&status==='synced'){rerun=false;queueMicrotask(()=>sync());}}}
 }
 function disconnect(forget=true){generation++;stopped=true;clearTimeout(timer);store=null;busy=null;ready=false;conflict=null;key='';if(forget){try{localStorage.removeItem(KEY_STORAGE);}catch{}}setStatus('disconnected');}
 async function configure(url,newKey){
  const normalized=normalizeEndpoint(url),value=String(newKey).trim()||(normalized===endpoint()?key:'');if(!validSyncKey(value))throw new Error('Нужен ключ синхронизации из файла подключения.');
  const previous=endpoint();disconnect(false);stopped=false;if(previous!==normalized){meta.lastCloudId=null;meta.lastSyncedJSON=null;meta.lastSavedAt=null;}
  meta.endpoint=normalized;key=value;persist();try{localStorage.setItem(KEY_STORAGE,key);}catch{onMessage('Ключ доступен до закрытия страницы: браузер запретил сохранение.');}await sync();
 }
 persist();
 window.addEventListener('online',()=>{if(configured())sync();});
 window.addEventListener('offline',()=>{if(configured())setStatus('offline');});
 const flush=()=>{if(configured()&&!['conflict','auth-required'].includes(status))sync();};
 window.addEventListener('focus',flush);window.addEventListener('pagehide',flush);
 if(typeof document!=='undefined')document.addEventListener('visibilitychange',flush);
 window.addEventListener('storage',event=>{if(!sessionAuth&&event.key===KEY_STORAGE&&event.newValue===null)disconnect(false);});
 if(configured())queueMicrotask(()=>sync());
 return {snapshot:()=>({configured:configured(),endpoint:endpoint(),hasKey:!!key,sessionAuth,connected:ready,status,error,lastSavedAt:meta.lastSavedAt||null,conflict}),configure,sync,noteChange,resolveConflict,disconnect,connect:sync};
}
