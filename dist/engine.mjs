import {KANA,BY_ID,LESSONS,CONFUSABLES} from './content.mjs';
export const STORAGE_KEY='kana-garden-v1';
export const DAY=86400000;
export function freshState(){return {version:1,xp:0,answered:0,correct:0,completed:[],mastery:{},mistakes:[],days:[],history:[],session:null};}
export function dateKey(time=Date.now()){const d=new Date(time);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function shuffle(list,rng=Math.random){const a=[...list];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function normalize(value){return String(value).normalize('NFKC').trim().toLowerCase().replace(/\s+/g,'');}
export function accepts(id,value){const k=BY_ID[id];if(!k)return false;const alternatives={shi:['si','ши','ши'],chi:['ti','чи'],tsu:['tu'],fu:['hu'],wo:['o','во'],n:["n'",'nn']};return [id,k.char,k.ru,...(alternatives[id]||[])].map(normalize).includes(normalize(value));}
export function optionsFor(id,pool=KANA.map(k=>k.id),rng=Math.random){const other=[...new Set([...(CONFUSABLES[id]||[]).filter(k=>pool.includes(k)),...shuffle(pool,rng)])].filter(k=>k!==id&&BY_ID[k]);return shuffle([id,...other.slice(0,3)],rng);}
function question(id,type,pool,rng){return {id,type,options:optionsFor(id,pool,rng),retry:false};}
export function startSession(lessonId,state,rng=Math.random,now=Date.now()){
 const lesson=LESSONS.find(l=>l.id===lessonId);let ids;
 if(lesson){ids=lesson.ids;}else if(lessonId==='mistakes'){ids=state.mistakes.filter(id=>BY_ID[id]).slice(0,10);}else{ids=KANA.filter(k=>state.mastery[k.id]&&state.mastery[k.id].dueAt<=now).map(k=>k.id).slice(0,10);}
 if(!ids?.length)return null;
 const index=LESSONS.findIndex(l=>l.id===lessonId);
 const pool=lesson?LESSONS.slice(0,index+1).flatMap(l=>l.ids):[...new Set([...Object.keys(state.mastery),...ids])];
 while(pool.length<4){const next=KANA.find(k=>!pool.includes(k.id));if(!next)break;pool.push(next.id);}
 const questions=[...shuffle(ids,rng).map(id=>question(id,'read',pool,rng)),...shuffle(ids,rng).map(id=>question(id,'listen',pool,rng)),...shuffle(ids,rng).slice(0,2).map(id=>question(id,'type',pool,rng))];
 return {id:`s-${now}`,lessonId,ids,pool,questions,index:0,phase:lesson?'learn':'exercise',learnIndex:0,feedback:null,firstAnswers:0,firstCorrect:0,startedAt:now,finished:false};
}
export function answer(state,value,now=Date.now()){
 const session=state.session;if(!session||session.feedback||session.finished||session.phase!=='exercise')return state;
 const q=session.questions[session.index];if(!q)return state;
 const correct=q.type==='type'?accepts(q.id,value):value===q.id;
 const old=state.mastery[q.id]||{right:0,wrong:0,streak:0,dueAt:0};
 const streak=correct?old.streak+1:0;
 const intervals=[0,5*60000,DAY,3*DAY,7*DAY,14*DAY,30*DAY];
 const m={right:old.right+(correct?1:0),wrong:old.wrong+(correct?0:1),streak,dueAt:now+(correct?intervals[Math.min(streak,6)]:60000),lastAnsweredAt:now};
 const mistakes=new Set(state.mistakes);if(!correct)mistakes.add(q.id);else if(streak>=2)mistakes.delete(q.id);
 let questions=[...session.questions];
 // An error returns after two intervening tasks. A second successful recall clears it.
 if(!correct || (mistakes.has(q.id)&&!questions.slice(session.index+1).some(item=>item.id===q.id))){
   const future=questions.slice(session.index+1).filter(item=>item.id===q.id&&item.retry).length;
   if(!future&&questions.length<60)questions.splice(Math.min(session.index+3,questions.length),0,{...question(q.id,'read',session.pool||q.options,Math.random),retry:true});
 }
 const first=!q.retry;const today=dateKey(now);
 return {...state,xp:state.xp+(correct?(q.retry?3:5):0),answered:state.answered+1,correct:state.correct+(correct?1:0),days:state.days.includes(today)?state.days:[...state.days,today].slice(-730),mastery:{...state.mastery,[q.id]:m},mistakes:[...mistakes],session:{...session,questions,firstAnswers:session.firstAnswers+(first?1:0),firstCorrect:session.firstCorrect+(first&&correct?1:0),feedback:{correct,value,earned:correct?(q.retry?3:5):0}}};
}
export function advance(state,now=Date.now()){
 const s=state.session;if(!s?.feedback)return state;
 if(s.index+1<s.questions.length)return {...state,session:{...s,index:s.index+1,feedback:null}};
 const lesson=LESSONS.find(l=>l.id===s.lessonId);
 const newlyCompleted=lesson&&!state.completed.includes(lesson.id);
 return {...state,xp:state.xp+(newlyCompleted?20:0),completed:newlyCompleted?[...state.completed,lesson.id]:state.completed,history:[{date:dateKey(now),lessonId:s.lessonId,correct:s.firstCorrect,total:s.firstAnswers} ,...state.history].slice(0,100),session:{...s,finished:true,phase:'result',feedback:null,bonus:newlyCompleted?20:0}};
}
export function stats(state,now=Date.now()){
 const mastered=KANA.filter(k=>(state.mastery[k.id]?.streak||0)>=3).length;
 const seen=Object.keys(state.mastery).filter(id=>BY_ID[id]).length;
 const due=KANA.filter(k=>state.mastery[k.id]?.dueAt<=now).length;
 let streak=0;let d=new Date(now);if(!state.days.includes(dateKey(d.getTime())))d.setDate(d.getDate()-1);
 for(let i=0;i<state.days.length;i++){if(!state.days.includes(dateKey(d.getTime())))break;streak++;d.setDate(d.getDate()-1);}
 return {mastered,seen,due,streak,level:Math.floor(state.xp/100)+1,levelXP:state.xp%100,accuracy:state.answered?Math.round(state.correct/state.answered*100):0};
}
export function validateState(raw){
 if(!raw||raw.version!==1||!Array.isArray(raw.completed)||!Array.isArray(raw.mistakes)||!Array.isArray(raw.days)||!Array.isArray(raw.history)||typeof raw.mastery!=='object'||!raw.mastery)throw new Error('Неверный формат файла прогресса.');
 for(const field of ['xp','answered','correct'])if(!Number.isFinite(raw[field])||raw[field]<0)throw new Error('В файле повреждены числовые данные.');
 if(raw.correct>raw.answered||raw.completed.some(id=>!LESSONS.some(l=>l.id===id))||raw.mistakes.some(id=>!BY_ID[id])||raw.days.some(d=>!/^\d{4}-\d{2}-\d{2}$/.test(d)))throw new Error('В файле есть неизвестные данные.');
 if(raw.history.some(h=>!h||typeof h.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(h.date)||!['review','mistakes',...LESSONS.map(l=>l.id)].includes(h.lessonId)||!Number.isInteger(h.correct)||!Number.isInteger(h.total)||h.correct<0||h.total<1||h.correct>h.total))throw new Error('Повреждена история занятий.');
 for(const [id,m] of Object.entries(raw.mastery)){if(!BY_ID[id]||!m||['right','wrong','streak','dueAt'].some(f=>!Number.isFinite(m[f])||m[f]<0))throw new Error('Повреждены данные о знаках.');}
 if(raw.session){const s=raw.session;if(!['learn','exercise','result'].includes(s.phase)||!Array.isArray(s.ids)||s.ids.some(id=>!BY_ID[id])||!Array.isArray(s.questions)||!Number.isInteger(s.index)||s.index<0||s.index>=s.questions.length||!Number.isInteger(s.learnIndex)||s.learnIndex<0||s.learnIndex>=s.ids.length||!Number.isFinite(s.firstAnswers)||!Number.isFinite(s.firstCorrect)||s.questions.some(q=>!BY_ID[q.id]||!['read','listen','type'].includes(q.type)||!Array.isArray(q.options)||q.options.some(id=>!BY_ID[id])))throw new Error('Повреждено сохранение занятия.');}
 return {...freshState(),...raw};
}
