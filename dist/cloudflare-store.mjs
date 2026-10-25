import {validateRecord,stateJSON} from './sync-core.mjs';
export class SyncAPIError extends Error{constructor(message,status){super(message);this.status=status;}}
export function normalizeEndpoint(value){
 let url;try{url=new URL(String(value).trim());}catch{throw new Error('Укажи адрес синхронизации.');}
 const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 if((url.protocol!=='https:'&&!(local&&url.protocol==='http:'))||url.username||url.password||url.search||url.hash||url.pathname.replace(/\/$/,'')!=='')throw new Error('Нужен HTTPS-адрес Worker без пути, параметров и пароля.');return url.origin;
}
export const validSyncKey=key=>typeof key==='string'&&/^[a-zA-Z0-9_-]{32,128}$/.test(key);
export class CloudflareStore{
 // Browser fetch requires its Window/WorkerGlobalScope receiver.
 constructor(endpoint,key,{fetcher=globalThis.fetch.bind(globalThis)}={}){this.endpoint=normalizeEndpoint(endpoint);if(!validSyncKey(key))throw new Error('Неверный формат ключа синхронизации.');this.key=key;this.fetcher=fetcher;}
 async request(path,{method='GET',body}={}){
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);let response;
   try{response=await this.fetcher(this.endpoint+path,{method,headers:{Authorization:`Bearer ${this.key}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',credentials:'omit',signal:controller.signal});}
   catch(error){throw new SyncAPIError(error.name==='AbortError'?'Сервер не ответил вовремя. Прогресс сохранён локально.':'Нет соединения с синхронизацией. Прогресс сохранён локально.',0);}finally{clearTimeout(timer);}
   const data=await response.json().catch(()=>({}));
   if(!response.ok){const messages={401:'Неверный ключ синхронизации.',403:'Адрес приложения не разрешён сервером.',409:'Версии изменились. Повтори синхронизацию.',413:'Сохранение слишком большое.',429:'Лимит запросов. Повтори синхронизацию позже.',503:'Сервер синхронизации ещё не настроен.'};throw new SyncAPIError(messages[response.status]||'Ошибка синхронизации. Локальный прогресс сохранён.',response.status);}return data;
 }
 async open(){await this.readHeads();return {id:this.endpoint};}
 async readHeads(){const data=await this.request('/v1/heads');if(!Array.isArray(data.heads)||data.heads.length>20)throw new Error('Некорректный ответ сервера синхронизации.');return data.heads.map(validateRecord);}
 async append(record){const data=await this.request('/v1/snapshots',{method:'POST',body:record}),saved=validateRecord(data.record);if(saved.id!==record.id||stateJSON(saved.state)!==stateJSON(record.state)||saved.device!==record.device||saved.savedAt!==record.savedAt||JSON.stringify([...saved.parents].sort())!==JSON.stringify([...record.parents].sort()))throw new Error('Сервер не подтвердил сохранение.');return saved;}
}
