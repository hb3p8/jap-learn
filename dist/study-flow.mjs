import {GENKI_UNIT_BY_ID,GENKI_QUESTION_BY_ID} from './genki-content.mjs';

// A step identity survives status-only redraws but changes on navigation or progress.
export function studyStep(view,state){
 if(view==='lesson'&&state.session){
  const s=state.session,q=s.questions[s.index],f=s.feedback;
  return {key:`kana:${s.id}:${s.phase}:${s.phase==='learn'?s.learnIndex:s.index}`,feedback:!!f,correct:!!f?.correct,
   input:s.phase==='exercise'&&q?.type==='type'?'reading':null,
   next:s.phase==='learn'?'learn-next':s.phase==='exercise'&&f?'next':null,
   sound:!f&&(s.phase==='learn'?s.ids[s.learnIndex]:s.phase==='exercise'&&q.type==='listen'?q.id:null),course:'kana',delay:900};
 }
 if(view==='genki-lesson'&&state.genki.session){
  const s=state.genki.session,q=GENKI_QUESTION_BY_ID[s.questions[s.index]?.id],f=s.feedback;
  const card=s.phase==='learn'?GENKI_UNIT_BY_ID[s.unitId]?.cards[s.cardIndex]:null;
  return {key:`genki:${s.startedAt}:${s.unitId}:${s.phase}:${s.phase==='learn'?s.cardIndex:s.index}`,feedback:!!f,correct:!!f?.correct,
   input:s.phase==='exercise'&&q?.type==='type'?'genki-reading':null,
   next:s.phase==='learn'?'genki-learn-next':s.phase==='exercise'&&f?'genki-next':null,
   sound:!f&&(card?.word?card.audio:s.phase==='exercise'?q?.audio:null),course:'genki',delay:1200};
 }
 if(view==='dungeon-run'&&state.dungeon.run?.status==='explore'){
  const r=state.dungeon.run,f=r.feedback;
  return {key:`dungeon:${r.startedAt}:${r.seed}:${r.floor}:${r.turn}:${r.target}`,feedback:!!f,correct:f?.kind==='right',
   input:r.target!==null||f?'dungeon-reading':null,next:f?'dungeon-next':null,course:'dungeon',delay:1100};
 }
 return {key:view,feedback:false,correct:false};
}

// Manual continuation, navigation and backgrounding invalidate pending transitions.
export function createStudyFlow({schedule=setTimeout,cancel=clearTimeout,advance,canAdvance=()=>true}){
 let token=null,timer=null,paused=false;
 const clear=()=>{if(timer!==null)cancel(timer);timer=null;};
 return {
  update(step){
   const next=JSON.stringify([step.key,step.feedback,step.correct]);
   if(next!==token){clear();token=next;paused=false;}
   if(step.correct&&step.next&&!paused&&timer===null&&canAdvance()){
    const expected=token;
    timer=schedule(()=>{timer=null;if(expected===token&&!paused&&canAdvance()){paused=true;advance(step.next);}},step.delay);
   }
  },
  pause(){clear();paused=true;},
  suspend(){clear();},
  reset(){clear();token=null;paused=false;}
 };
}
