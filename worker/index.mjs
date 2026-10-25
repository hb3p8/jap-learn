import {validateRecord,stateJSON} from '../dist/sync-core.mjs';
import {cookieKey,accessHeaders,loginPage,handleAccess} from './access.mjs';

const MAX_BODY=200000;
function json(body,status=200,origin=null){
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
 if(origin){headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Allow-Methods']='GET, POST, OPTIONS';headers['Access-Control-Allow-Headers']='Authorization, Content-Type';headers['Access-Control-Max-Age']='600';}
 return new Response(JSON.stringify(body),{status,headers});
}
export async function keyHash(key){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function verifyKey(key,expected){
 if(!/^[a-f0-9]{64}$/i.test(expected||''))return false;
 if(typeof key!=='string'||! /^[A-Za-z0-9_-]{32,128}$/.test(key))return false;
 const actual=await keyHash(key);let diff=0;const lower=expected.toLowerCase();
 for(let i=0;i<64;i++)diff|=actual.charCodeAt(i)^lower.charCodeAt(i);return diff===0;
}
async function readBody(request){
 if(Number(request.headers.get('Content-Length')||0)>MAX_BODY)throw Object.assign(new Error('Сохранение слишком большое.'),{status:413});
 if(!(request.headers.get('Content-Type')||'').startsWith('application/json'))throw Object.assign(new Error('Нужен Content-Type application/json.'),{status:415});
 const reader=request.body?.getReader();if(!reader)throw Object.assign(new Error('Пустой запрос.'),{status:400});
 const chunks=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BODY){await reader.cancel();throw Object.assign(new Error('Сохранение слишком большое.'),{status:413});}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw Object.assign(new Error('Некорректный JSON.'),{status:400});}
}
async function loadRecord(db,row){
 const result=await db.prepare('SELECT parent_id FROM snapshot_parents WHERE child_id = ? ORDER BY parent_id').bind(row.id).all();
 return validateRecord({id:row.id,parents:result.results.map(p=>p.parent_id),device:row.device,savedAt:row.saved_at,state:JSON.parse(row.state_json)});
}
async function getHeads(db){
 const rows=await db.prepare('SELECT s.id, s.device, s.saved_at, s.state_json FROM snapshots s WHERE NOT EXISTS (SELECT 1 FROM snapshot_parents p WHERE p.parent_id = s.id) ORDER BY s.created_at, s.id LIMIT 21').all();
 if(rows.results.length>20)throw Object.assign(new Error('Слишком много конфликтующих версий. Сначала сохрани локальную копию.'),{status:409});
 return Promise.all(rows.results.map(row=>loadRecord(db,row)));
}
async function appendRecord(db,record){
 const old=await db.prepare('SELECT id, device, saved_at, state_json FROM snapshots WHERE id = ?').bind(record.id).first();
 if(old){const existing=await loadRecord(db,old);if(existing.device!==record.device||existing.savedAt!==record.savedAt||stateJSON(existing.state)!==stateJSON(record.state)||JSON.stringify([...existing.parents].sort())!==JSON.stringify([...record.parents].sort()))throw Object.assign(new Error('Идентификатор сохранения уже используется другой версией.'),{status:409});return existing;}
 if(record.parents.length){const known=await db.prepare(`SELECT id FROM snapshots WHERE id IN (${record.parents.map(()=>'?').join(',')})`).bind(...record.parents).all();if(known.results.length!==record.parents.length)throw Object.assign(new Error('Исходная версия недоступна. Повтори синхронизацию.'),{status:409});}
 // A snapshot and all parent links commit atomically. Old snapshots are immutable.
 const statements=[db.prepare('INSERT INTO snapshots(id, device, saved_at, state_json) VALUES (?, ?, ?, ?)').bind(record.id,record.device,record.savedAt,stateJSON(record.state)),...record.parents.map(parent=>db.prepare('INSERT INTO snapshot_parents(child_id, parent_id) VALUES (?, ?)').bind(record.id,parent))];
 try{await db.batch(statements);}catch(error){const duplicate=await db.prepare('SELECT id, device, saved_at, state_json FROM snapshots WHERE id = ?').bind(record.id).first();if(duplicate)return appendRecord(db,record);throw error;}return record;
}
export default {async fetch(request,env){
 const url=new URL(request.url),requestedOrigin=request.headers.get('Origin'),allowed=new Set((env.ALLOWED_ORIGINS||'').split(',').map(v=>v.trim()).filter(Boolean));
 const origin=requestedOrigin&&(allowed.has(requestedOrigin)||requestedOrigin===url.origin)?requestedOrigin:null;
 if(requestedOrigin&&!origin)return json({error:'Этот адрес приложения не разрешён.'},403);
 const path=new URL(request.url).pathname.replace(/\/$/,'');
 if(request.method==='OPTIONS')return json({},200,origin);
 if(path==='/health'&&request.method==='GET')return json({ok:!!env.DB&&/^[a-f0-9]{64}$/i.test(env.SYNC_KEY_HASH||''),service:'kana-sync',version:1},200,origin);
 if(!env.DB||!/^[a-f0-9]{64}$/i.test(env.SYNC_KEY_HASH||''))return json({error:'Синхронизация ещё не настроена.'},503,origin);
 const access=await handleAccess(request,env,verifyKey);if(access)return access;
 const bearer=/^Bearer ([A-Za-z0-9_-]{32,128})$/.exec(request.headers.get('Authorization')||'')?.[1];
 const token=request.headers.has('Authorization')?bearer:cookieKey(request);
 const authenticated=await verifyKey(token,env.SYNC_KEY_HASH);
 if(!bearer&&requestedOrigin&&requestedOrigin!==url.origin)return json({error:'Для этого запроса нужен ключ доступа.'},401,origin);
 if(!authenticated){
  if(env.ASSETS&&request.method==='GET'&&(path===''||path==='/index.html'||path==='/auth/login'))return loginPage();
  return json({error:'Неверный ключ синхронизации.'},401,origin);
 }
 try{
   if(path==='/v1/heads'&&request.method==='GET')return json({heads:await getHeads(env.DB)},200,origin);
   if(path==='/v1/snapshots'&&request.method==='POST'){
     let record;try{record=validateRecord(await readBody(request));}catch(error){return json({error:error.message},error.status||400,origin);}
     return json({record:await appendRecord(env.DB,record)},200,origin);
   }
   if(env.ASSETS&&['GET','HEAD'].includes(request.method)&&!path.startsWith('/v1/')&&!path.startsWith('/auth/')){
     const assetRequest=path===''?new Request(new URL('/index.html',url),request):request;
     const asset=await env.ASSETS.fetch(assetRequest),headers=new Headers(asset.headers);for(const [name,value]of Object.entries(accessHeaders()))headers.set(name,value);headers.set('X-Kana-Private','1');
     return new Response(asset.body,{status:asset.status,headers});
   }
   return json({error:'Маршрут не найден.'},404,origin);
 }catch(error){return json({error:error.status?error.message:'Не удалось выполнить операцию. Локальный прогресс сохранён.'},error.status||500,origin);}
}};
