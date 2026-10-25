import {validateState} from './engine.mjs';

export const SYNC_HEADERS=['id','parents','device','saved_at','state_json'];
export function stateJSON(state){return JSON.stringify(validateState(state));}
export function hasProgress(state){return state.answered>0||state.completed.length>0||!!state.session;}
export function makeRecord(state,{id,parents=[],device,now=Date.now()}){
 const json=stateJSON(state);
 if(json.length>45000)throw new Error('Сохранение превышает размер ячейки Google Sheets. Выгрузи прогресс в файл.');
 const record={id,parents:[...new Set(parents)],device,savedAt:new Date(now).toISOString(),state:JSON.parse(json)};
 parseRecord([id,JSON.stringify(record.parents),device,record.savedAt,json]);
 return record;
}
export function recordRow(record){return [record.id,JSON.stringify(record.parents),record.device,record.savedAt,stateJSON(record.state)];}
export function parseHeader(row,index){
 const [id,parentsJSON,device]=row;
 if(typeof id!=='string'||!id||id.length>100||typeof device!=='string'||device.length>100)throw new Error('Повреждён журнал сохранений Google Sheets.');
 let parents;try{parents=JSON.parse(parentsJSON);}catch{throw new Error('Повреждены связи сохранений Google Sheets.');}
 if(!Array.isArray(parents)||parents.length>20||parents.some(p=>typeof p!=='string'||!p||p===id||p.length>100))throw new Error('Некорректная версия сохранения Google Sheets.');
 return {id,parents,device,row:index};
}
export function parseRecord(row){
 const header=parseHeader(row,0),savedAt=row[3];
 if(typeof savedAt!=='string'||!Number.isFinite(Date.parse(savedAt)))throw new Error('Повреждена дата сохранения Google Sheets.');
 let state;try{state=validateState(JSON.parse(row[4]));}catch{throw new Error('Не удалось прочитать прогресс из Google Sheets.');}
 return {...header,savedAt,state};
}
export function findHeads(headers){
 const byId=new Map();
 for(const h of headers){const old=byId.get(h.id);if(old&&JSON.stringify(old.parents)!==JSON.stringify(h.parents))throw new Error('Обнаружены несовместимые записи Google Sheets.');byId.set(h.id,h);}
 const referenced=new Set([...byId.values()].flatMap(h=>h.parents));
 const heads=[...byId.values()].filter(h=>!referenced.has(h.id));
 if(headers.length&&!heads.length)throw new Error('Журнал сохранений содержит цикл.');
 return heads;
}
export function syncDecision(local,heads,meta={}){
 const json=stateJSON(local);
 if(!heads.length)return {action:'push',parents:[]};
 const parents=heads.map(h=>h.id);
 if(heads.length>1){
   if(heads.every(h=>stateJSON(h.state)===json))return {action:'push',parents};
   return {action:'conflict',parents};
 }
 const remote=heads[0],remoteJSON=stateJSON(remote.state);
 if(remoteJSON===json)return {action:'ack',remote};
 if(remote.id===meta.lastCloudId)return {action:'push',parents};
 if(json===meta.lastSyncedJSON||(!hasProgress(local)&&!meta.lastCloudId))return {action:'pull',remote};
 return {action:'conflict',parents};
}
