import {validateState} from './engine.mjs';
export const MAX_STATE_BYTES=150000;
export function stateJSON(state){return JSON.stringify(validateState(state));}
export function hasProgress(state){return !!state.dungeon?.run||!!state.dungeon?.history?.length||state.answered>0||state.completed.length>0||!!state.session||!!state.genki?.session||!!state.genki?.completed?.length||!!Object.keys(state.genki?.mastery||{}).length;}
export function validateRecord(value){
 const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(id);
 if(!value||typeof value!=='object'||!validId(value.id)||!validId(value.device))throw new Error('Неверный формат сохранения.');
 if(!Array.isArray(value.parents)||value.parents.length>20||value.parents.some(p=>!validId(p)||p===value.id)||new Set(value.parents).size!==value.parents.length)throw new Error('Повреждены связи версий.');
 if(typeof value.savedAt!=='string'||!Number.isFinite(Date.parse(value.savedAt)))throw new Error('Некорректная дата сохранения.');
 const json=stateJSON(value.state);
 if(new TextEncoder().encode(json).length>MAX_STATE_BYTES)throw new Error('Сохранение слишком большое. Выгрузи прогресс в файл.');
 return {id:value.id,parents:[...value.parents],device:value.device,savedAt:value.savedAt,state:JSON.parse(json)};
}
export function makeRecord(state,{id,parents=[],device,now=Date.now()}){return validateRecord({id,parents:[...new Set(parents)],device,savedAt:new Date(now).toISOString(),state});}
export function findHeads(records){
 const byId=new Map();
 for(const record of records){const previous=byId.get(record.id);if(previous&&JSON.stringify(previous.parents)!==JSON.stringify(record.parents))throw new Error('Обнаружены несовместимые версии сохранения.');byId.set(record.id,record);}
 const referenced=new Set([...byId.values()].flatMap(r=>r.parents)),heads=[...byId.values()].filter(r=>!referenced.has(r.id));
 if(records.length&&!heads.length)throw new Error('Журнал сохранений содержит цикл.');return heads;
}
export function syncDecision(local,heads,meta={}){
 const json=stateJSON(local);
 if(!heads.length)return {action:'push',parents:[]};
 const parents=heads.map(h=>h.id);
 if(heads.length>1){if(heads.every(h=>stateJSON(h.state)===json))return {action:'push',parents};return {action:'conflict',parents};}
 const remote=heads[0],remoteJSON=stateJSON(remote.state);
 if(remoteJSON===json)return {action:'ack',remote};
 if(remote.id===meta.lastCloudId)return {action:'push',parents};
 let previous=meta.lastSyncedJSON;
 // Old clients stored snapshots before the Genki section existed.
 try{if(previous)previous=stateJSON(JSON.parse(previous));}catch{}
 if(json===previous||(!hasProgress(local)&&!meta.lastCloudId))return {action:'pull',remote};
 return {action:'conflict',parents};
}
