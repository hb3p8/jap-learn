import {GENKI_UNITS,GENKI_UNIT_BY_ID,GENKI_QUESTIONS,GENKI_QUESTION_BY_ID} from './genki-content.mjs';
const DAY=86400000;
const shuffle=(list,rng=Math.random)=>{const out=[...list];for(let i=out.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;};
export const normalizeGenki=value=>String(value).normalize('NFKC').toLowerCase().replace(/[\s。？！?!.,、・〜~]/g,'');
export function freshGenki(){return {completed:[],mastery:{},mistakes:[],history:[],session:null};}
const knownQuestion=id=>typeof id==='string'&&Object.hasOwn(GENKI_QUESTION_BY_ID,id);
const knownUnit=id=>typeof id==='string'&&Object.hasOwn(GENKI_UNIT_BY_ID,id);
export function validateGenki(raw){
 if(raw===undefined)return freshGenki();
 if(!raw||!Array.isArray(raw.completed)||raw.completed.some(id=>!knownUnit(id))||!raw.mastery||Array.isArray(raw.mastery)||typeof raw.mastery!=='object'||!Array.isArray(raw.mistakes)||raw.mistakes.some(id=>!knownQuestion(id))||!Array.isArray(raw.history))throw new Error('Повреждён прогресс Genki.');
 for(const [id,m]of Object.entries(raw.mastery))if(!knownQuestion(id)||!m||['right','wrong','streak','dueAt','lastAnsweredAt'].some(k=>!Number.isFinite(m[k])||m[k]<0))throw new Error('Повреждены результаты Genki.');
 if(raw.history.some(h=>!h||!['g1-review','g1-errors',...GENKI_UNITS.map(u=>u.id)].includes(h.unitId)||!/^\d{4}-\d{2}-\d{2}$/.test(h.date)||!Number.isInteger(h.correct)||!Number.isInteger(h.total)||h.correct<0||h.total<1||h.correct>h.total))throw new Error('Повреждена история Genki.');
 const s=raw.session;
 if(s){
  if(!['g1-review','g1-errors',...GENKI_UNITS.map(u=>u.id)].includes(s.unitId)||!['learn','exercise','result'].includes(s.phase)||!Array.isArray(s.questions)||!s.questions.length||s.questions.length>60||s.questions.some(q=>!q||!knownQuestion(q.id)||typeof q.retry!=='boolean')||!Number.isInteger(s.index)||s.index<0||s.index>=s.questions.length||!Number.isInteger(s.cardIndex)||s.cardIndex<0||(s.phase==='learn'&&(!knownUnit(s.unitId)||s.cardIndex>=GENKI_UNIT_BY_ID[s.unitId].cards.length))||!Number.isInteger(s.firstAnswers)||!Number.isInteger(s.firstCorrect)||s.firstCorrect<0||s.firstCorrect>s.firstAnswers||s.firstAnswers>60)throw new Error('Повреждено занятие Genki.');
  if(s.feedback&&(typeof s.feedback.correct!=='boolean'||typeof s.feedback.value!=='string'||s.feedback.value.length>500||![0,3,5].includes(s.feedback.earned)))throw new Error('Повреждён ответ Genki.');
 }
 return {...freshGenki(),...raw};
}
export function startGenki(unitId,raw,rng=Math.random,now=Date.now()){
 const g=validateGenki(raw),unit=GENKI_UNIT_BY_ID[unitId];let pool;
 if(unit)pool=GENKI_QUESTIONS.filter(q=>q.unit===unitId);
 else if(unitId==='g1-errors')pool=g.mistakes.map(id=>GENKI_QUESTION_BY_ID[id]);
 else if(unitId==='g1-review')pool=GENKI_QUESTIONS.filter(q=>g.mastery[q.id]||g.completed.includes(q.unit));
 else return null;
 if(!pool.length)return null;
 // Vocabulary practice covers each word once before mixing additional task types.
 let selected;
 if(unitId==='g1-people'||unitId==='g1-everyday'){
  const words=[...new Set(pool.map(q=>q.word||q.id.replace(/^l-/,'')))];
  selected=shuffle(words,rng).map((word,i)=>pool.find(q=>q.id===`${['v','l','r'][i%3]}-${word}`));
 }else selected=shuffle(pool,rng).sort((a,b)=>Number(g.mistakes.includes(b.id))-Number(g.mistakes.includes(a.id))).slice(0,12);
 return {unitId,phase:unit?'learn':'exercise',cardIndex:0,questions:selected.filter(Boolean).map(q=>({id:q.id,retry:false})),index:0,feedback:null,firstAnswers:0,firstCorrect:0,startedAt:now,bonus:0};
}
export function genkiCorrect(q,value){return [q.answer,...(q.accepted||[])].some(v=>normalizeGenki(v)===normalizeGenki(value));}
export function answerGenki(state,value,now=Date.now()){
 const g=validateGenki(state.genki),s=g.session;if(!s||s.phase!=='exercise'||s.feedback)return state;
 const item=s.questions[s.index],q=GENKI_QUESTION_BY_ID[item.id],correct=genkiCorrect(q,value),old=g.mastery[q.id]||{right:0,wrong:0,streak:0,dueAt:0,lastAnsweredAt:0};
 const streak=correct?old.streak+1:0,intervals=[0,300000,DAY,3*DAY,7*DAY,14*DAY,30*DAY];
 const m={right:old.right+Number(correct),wrong:old.wrong+Number(!correct),streak,dueAt:now+(correct?intervals[Math.min(streak,6)]:60000),lastAnsweredAt:now};
 const mistakes=new Set(g.mistakes);if(!correct)mistakes.add(q.id);else if(streak>=2)mistakes.delete(q.id);
 const questions=[...s.questions];if((!correct||mistakes.has(q.id))&&!questions.slice(s.index+1).some(x=>x.id===q.id)&&questions.length<60)questions.splice(Math.min(s.index+3,questions.length),0,{id:q.id,retry:true});
 const day=new Date(now),today=`${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`,earned=correct?(item.retry?3:5):0;
 return {...state,xp:state.xp+earned,answered:state.answered+1,correct:state.correct+Number(correct),days:state.days.includes(today)?state.days:[...state.days,today].slice(-730),genki:{...g,mastery:{...g.mastery,[q.id]:m},mistakes:[...mistakes],session:{...s,questions,firstAnswers:s.firstAnswers+Number(!item.retry),firstCorrect:s.firstCorrect+Number(!item.retry&&correct),feedback:{correct,value:String(value),earned}}}};
}
export function advanceGenki(state,now=Date.now()){
 const g=validateGenki(state.genki),s=g.session;if(!s?.feedback)return state;
 if(s.index+1<s.questions.length)return {...state,genki:{...g,session:{...s,index:s.index+1,feedback:null}}};
 const first=knownUnit(s.unitId)&&!g.completed.includes(s.unitId),d=new Date(now),date=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
 return {...state,xp:state.xp+(first?20:0),genki:{...g,completed:first?[...g.completed,s.unitId]:g.completed,history:[{unitId:s.unitId,date,correct:s.firstCorrect,total:s.firstAnswers},...g.history].slice(0,100),session:{...s,phase:'result',feedback:null,bonus:first?20:0}}};
}
