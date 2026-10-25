import {BY_ID,LESSONS} from './content.mjs';
export const DUNGEON_WIDTH=15,DUNGEON_HEIGHT=11,DUNGEON_FLOORS=3;
export function freshDungeon(){return {run:null,history:[]};}
const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
const kana=id=>typeof id==='string'&&Object.hasOwn(BY_ID,id);
export function validateDungeon(raw){
 if(raw===undefined)return freshDungeon();
 if(!raw||!Array.isArray(raw.history)||raw.history.length>30||raw.history.some(h=>!h||!['won','lost'].includes(h.status)||!integer(h.floor,1,3)||!integer(h.kills,0,100)||!integer(h.correct,0,100)||!integer(h.answers,0,100)||h.correct>h.answers||!integer(h.hints,0,100)||!Number.isFinite(h.finishedAt)))throw new Error('Повреждена история подземелья.');
 const r=raw.run;
 if(r){
  const point=p=>p&&integer(p.x,0,14)&&integer(p.y,0,10)&&r.map?.[p.y]?.[p.x]==='.';
  if(!['learned','all',...LESSONS.map(l=>'row:'+l.id)].includes(r.mode)||!integer(r.seed,0,4294967295)||!Number.isFinite(r.startedAt)||!['explore','won','lost'].includes(r.status)||!integer(r.floor,1,3)||!Array.isArray(r.pool)||!r.pool.length||r.pool.length>46||r.pool.some(id=>!kana(id))||new Set(r.pool).size!==r.pool.length||!Array.isArray(r.map)||r.map.length!==11||r.map.some(row=>typeof row!=='string'||!/^[#.]{15}$/.test(row))||!point(r.player)||!point(r.exit)||!integer(r.hp,0,6)||!integer(r.turn,0,10000)||!integer(r.kills,0,100)||!integer(r.answers,0,100)||!integer(r.correct,0,r.answers)||!integer(r.hints,0,100)||!Array.isArray(r.seen)||r.seen.length!==165||r.seen.some(v=>typeof v!=='boolean')||!Array.isArray(r.monsters)||r.monsters.length>5||r.monsters.some(m=>!m||!integer(m.id,0,4)||!kana(m.kana)||!r.pool.includes(m.kana)||!point(m)||typeof m.assisted!=='boolean')||new Set(r.monsters.map(m=>m.id)).size!==r.monsters.length||new Set(r.monsters.map(m=>m.y*15+m.x)).size!==r.monsters.length||!Array.isArray(r.retry)||r.retry.length>46||r.retry.some(id=>!kana(id)||!r.pool.includes(id))||(r.potion!==null&&!point(r.potion))||(r.target!==null&&!r.monsters.some(m=>m.id===r.target))||typeof r.notice!=='string'||r.notice.length>150)throw new Error('Повреждено подземелье.');
  if(r.feedback&&(!['right','wrong','hint'].includes(r.feedback.kind)||!kana(r.feedback.kana)||![0,3].includes(r.feedback.earned)))throw new Error('Повреждён ответ в подземелье.');
 }
 return {run:r||null,history:raw.history};
}
