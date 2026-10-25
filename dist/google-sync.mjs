import {GOOGLE_CLIENT_ID} from './config.mjs';
import {SheetsStore} from './google-sheets.mjs';
import {stateJSON,makeRecord,syncDecision} from './sync-core.mjs';

export const GOOGLE_SCOPE='https://www.googleapis.com/auth/drive.file';
const META_KEY='kana-google-v1';
let identityPromise;
function loadIdentity(){
 if(window.google?.accounts?.oauth2)return Promise.resolve();
 if(identityPromise)return identityPromise;
 identityPromise=new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;
   const timer=setTimeout(()=>{script.remove();identityPromise=null;reject(new Error('Не загрузился вход Google. Проверь соединение.'));},15000);
   script.onload=()=>{clearTimeout(timer);resolve();};script.onerror=()=>{clearTimeout(timer);script.remove();identityPromise=null;reject(new Error('Не загрузился вход Google. Проверь соединение.'));};document.head.append(script);
 });return identityPromise;
}
export function validClientId(value){return /^\d+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(value);}
export function createGoogleSync({getState,applyState,onStatus=()=>{},onMessage=()=>{}}){
 let meta={device:crypto.randomUUID(),lastCloudId:null,lastSyncedJSON:null},status='disconnected',error='',lastSavedAt=null,conflict=null;
 try{const old=JSON.parse(localStorage.getItem(META_KEY)||'null');if(old&&typeof old.device==='string')meta={...meta,...old};}catch{}
 let token=null,expiresAt=0,store=null,storeReady=false,tokenClient=null,timer=null,busy=null,pending=null;
 const persist=()=>{try{localStorage.setItem(META_KEY,JSON.stringify(meta));}catch{}};
 const clientId=()=>meta.clientId||GOOGLE_CLIENT_ID||'';
 const notify=()=>onStatus();
 function setStatus(value,message=''){status=value;error=message;notify();}
 function authenticated(){return !!token&&Date.now()<expiresAt;}
 function acknowledge(record){meta.lastCloudId=record.id;meta.lastSyncedJSON=stateJSON(record.state);meta.sheetId=store.id;meta.sheetUrl=store.url;lastSavedAt=record.savedAt;persist();pending=null;conflict=null;}
 async function prepare(){
   if(!clientId())return;
   await loadIdentity();
   tokenClient=window.google.accounts.oauth2.initTokenClient({client_id:clientId(),scope:GOOGLE_SCOPE,include_granted_scopes:false,
     callback:async response=>{
       if(response.error||!response.access_token){setStatus('error','Google не предоставил доступ.');return;}
       if(!window.google.accounts.oauth2.hasGrantedAllScopes(response,GOOGLE_SCOPE)){setStatus('error','Нужно разрешение на файлы приложения.');return;}
       token=response.access_token;expiresAt=Date.now()+(Number(response.expires_in||3600)-60)*1000;store=new SheetsStore(token);storeReady=false;
       try{setStatus('syncing');const opened=await store.open();if(meta.sheetId&&meta.sheetId!==opened.id){meta.lastCloudId=null;meta.lastSyncedJSON=null;}meta.sheetId=opened.id;meta.sheetUrl=opened.url;storeReady=true;persist();await sync();}catch(e){handleError(e);}
     },error_callback:e=>setStatus('disconnected',e.type==='popup_closed'?'Вход отменён.':'Разреши всплывающее окно входа Google.')});
 }
 function handleError(e){if(e.status===401){token=null;expiresAt=0;setStatus('auth-required',e.message);}else setStatus('error',e.message||'Ошибка синхронизации. Прогресс сохранён локально.');}
 async function sync(){
   clearTimeout(timer);
   if(busy)return busy;
   if(!authenticated()){setStatus(meta.lastCloudId?'auth-required':'disconnected');return;}
   if(!storeReady)return;
   if(!navigator.onLine){setStatus('offline');return;}
   busy=(async()=>{
     try{
       setStatus('syncing');const heads=await store.readHeads(),local=getState(),decision=syncDecision(local,heads,meta);
       if(decision.action==='conflict'){conflict={heads,local};setStatus('conflict');return;}
       if(decision.action==='pull'){applyState(decision.remote.state);acknowledge(decision.remote);onMessage('Прогресс загружен из Google Sheets.');}
       else if(decision.action==='ack')acknowledge(decision.remote);
       else{
         const json=stateJSON(local);
         if(!pending||stateJSON(pending.state)!==json||JSON.stringify(pending.parents)!==JSON.stringify(decision.parents))pending=makeRecord(local,{id:crypto.randomUUID(),parents:decision.parents,device:meta.device});
         const record=pending;await store.append(record);acknowledge(record);
       }
       setStatus('synced');if(stateJSON(getState())!==meta.lastSyncedJSON)noteChange();
     }catch(e){handleError(e);}
   })();
   try{await busy;}finally{busy=null;}
 }
 function noteChange(){
   if(!token)return;
   clearTimeout(timer);
   if(!authenticated()){setStatus('auth-required');return;}
   if(conflict){notify();return;}
   if(!navigator.onLine){setStatus('offline');return;}
   if(status!=='syncing')setStatus('pending');
   timer=setTimeout(()=>sync(),8000);
 }
 async function resolveConflict(choice){
   if(!conflict||!authenticated())return;
   const {heads}=conflict;
   const selected=choice==='local'?getState():heads.find(h=>h.id===choice)?.state;
   if(!selected)throw new Error('Версия сохранения недоступна. Обнови синхронизацию.');
   try{
     setStatus('syncing');const current=await store.readHeads();
     if(JSON.stringify(current.map(h=>h.id).sort())!==JSON.stringify(heads.map(h=>h.id).sort())){conflict={heads:current,local:getState()};setStatus('conflict');onMessage('В Google Sheets появилась новая версия. Выбери сохранение повторно.');return;}
     const record=makeRecord(selected,{id:crypto.randomUUID(),parents:heads.map(h=>h.id),device:meta.device});
     await store.append(record);
     if(choice!=='local'){try{localStorage.setItem('kana-before-restore-v1',stateJSON(getState()));}catch{}applyState(selected);}
     acknowledge(record);setStatus('synced');
   }catch(e){handleError(e);}
 }
 function disconnect(){clearTimeout(timer);token=null;store=null;storeReady=false;expiresAt=0;conflict=null;setStatus('disconnected');}
 persist();
 if(clientId())prepare().catch(e=>setStatus('error',e.message));
 window.addEventListener('online',()=>{if(authenticated())sync();});
 window.addEventListener('offline',()=>{if(token)setStatus('offline');});
 window.addEventListener('focus',()=>{if(authenticated()&&status!=='conflict')sync();});
 return {
   snapshot:()=>({configured:!!clientId(),connected:authenticated()&&storeReady,clientId:clientId(),status,error,lastSavedAt,sheetUrl:meta.sheetUrl||null,conflict}),
   async configure(value){if(!validClientId(value))throw new Error('Нужен OAuth Client ID вида 123-abc.apps.googleusercontent.com.');disconnect();meta.clientId=value;persist();await prepare();notify();},
   async connect(){if(!clientId())return false;if(!tokenClient){await prepare();onMessage('Вход Google загружен. Нажми «Подключить» ещё раз.');return true;}setStatus('connecting');tokenClient.requestAccessToken({prompt:'select_account'});return true;},
   sync,noteChange,resolveConflict,disconnect
 };
}
