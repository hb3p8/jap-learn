import {freshState,validateState,STORAGE_KEY} from './engine.mjs';
import {hasProgress} from './sync-core.mjs';
import {createCloudSync} from './cloud-sync.mjs';
import {validSyncKey} from './cloudflare-store.mjs';
import {CLOUDFLARE_SYNC_URL} from './config.mjs';
const status=document.querySelector('#status'),form=document.querySelector('#connect'),choices=document.querySelector('#choices');
document.querySelector('#open').href=CLOUDFLARE_SYNC_URL;
let raw='',state=freshState(),chosenKey='',cloud,opening=false,invalid=false;
try{raw=localStorage.getItem(STORAGE_KEY)||'';if(raw)state=validateState(JSON.parse(raw));chosenKey=localStorage.getItem('kana-sync-key-v1')||'';}catch{invalid=true;status.textContent='Не удалось прочитать местное сохранение. Скачай его перед переходом.';status.className='error';}
document.querySelector('#backup').hidden=!raw;
document.querySelector('#backup').onclick=()=>{const url=URL.createObjectURL(new Blob([raw||JSON.stringify(state)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='kana-before-move.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
// Remove the former public app cache without touching any learning state.
if('serviceWorker'in navigator){for(const registration of await navigator.serviceWorker.getRegistrations())await registration.unregister();}
if('caches'in window)for(const name of await caches.keys())if(name.startsWith('kana:'))await caches.delete(name);
function enter(){if(opening||!validSyncKey(chosenKey))return;opening=true;status.textContent='Прогресс сохранён. Открываем приложение…';const login=document.createElement('form');login.method='POST';login.action=CLOUDFLARE_SYNC_URL+'/auth/login';const input=document.createElement('input');input.type='hidden';input.name='key';input.value=chosenKey;login.append(input);document.body.append(login);login.submit();}
function show(){const c=cloud?.snapshot();if(!c)return;choices.replaceChildren();if(c.status==='synced'){enter();return;}status.className=['error','auth-required'].includes(c.status)?'error':'';status.textContent={syncing:'Сохраняем прогресс в облако…',pending:'Сохраняем изменения…',offline:'Нет соединения. Местный прогресс сохранён.',disconnected:'Введи тот же ключ, которым подключалась синхронизация.','auth-required':'Ключ не подошёл. Введи его ещё раз.',error:c.error,conflict:'Найдено несколько версий. Выбери прогресс, который нужно продолжить.'}[c.status]||'';form.hidden=c.status==='syncing';if(c.conflict){for(const item of [{id:'local',label:'На этом устройстве',state},...c.conflict.heads.map(h=>({id:h.id,label:'В облаке · '+new Date(h.savedAt).toLocaleString('ru-RU'),state:h.state}))]){const button=document.createElement('button');button.textContent=`${item.label}: ${item.state.xp} XP, ${item.state.completed.length} уроков хираганы, ${item.state.genki.completed.length} Genki`;button.onclick=()=>cloud.resolveConflict(item.id);choices.append(button);}}}
if(!invalid){if(!hasProgress(state)&&!validSyncKey(chosenKey)){location.replace(CLOUDFLARE_SYNC_URL);}else{cloud=createCloudSync({getState:()=>state,applyState:remote=>{state=validateState(remote);localStorage.setItem(STORAGE_KEY,JSON.stringify(state));},onStatus:show,endpointOverride:CLOUDFLARE_SYNC_URL});show();}}
form.addEventListener('submit',async event=>{event.preventDefault();if(invalid)return;chosenKey=String(new FormData(form).get('key')||'').trim();try{await cloud.configure(CLOUDFLARE_SYNC_URL,chosenKey);}catch(error){status.className='error';status.textContent=error.message;}});
