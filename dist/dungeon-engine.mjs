import {BY_ID,KANA,LESSONS} from './content.mjs';
import {accepts,normalize,learnedKana,recordKanaRecall} from './engine.mjs';
import {freshDungeon,DUNGEON_WIDTH as W,DUNGEON_HEIGHT as H} from './dungeon-state.mjs';
export const DIRECTIONS={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
export function randomFor(seed){let s=seed>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
function shuffled(list,rng){return list.map(value=>({value,key:rng()})).sort((a,b)=>a.key-b.key).map(x=>x.value);}
const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
export function dungeonPool(state,mode='learned'){if(mode==='all')return KANA.map(k=>k.id);if(mode.startsWith('row:'))return LESSONS.find(l=>l.id===mode.slice(4))?.ids||[];return learnedKana(state);}
function lineVisible(map,a,b){let x=a.x,y=a.y,dx=Math.abs(b.x-x),dy=-Math.abs(b.y-y),sx=x<b.x?1:-1,sy=y<b.y?1:-1,err=dx+dy;while(x!==b.x||y!==b.y){if((x!==a.x||y!==a.y)&&map[y][x]==='#')return false;const e=2*err;if(e>=dy){err+=dy;x+=sx;}if(e<=dx){err+=dx;y+=sy;}}return true;}
export function visibleCells(r){return r.map.flatMap((row,y)=>[...row].map((_,x)=>distance(r.player,{x,y})<=5&&lineVisible(r.map,r.player,{x,y})));}
function reveal(r){const visible=visibleCells(r);r.seen=r.seen.map((seen,i)=>seen||visible[i]);return r;}
export function visibleMonsters(r){const v=visibleCells(r);return r.monsters.filter(m=>v[m.y*W+m.x]);}
export function makeFloor(state,run){
 const rng=randomFor((run.seed+run.floor*7919)>>>0),map=Array.from({length:H},()=>Array(W).fill('#')),rooms=[];
 for(const [x,y,w,h]of [[1,1,6,3],[9,1,5,3],[1,7,6,3],[9,7,5,3]]){const left=x+Math.floor(rng()*2),top=y,width=w-(left-x),height=h;for(let yy=top;yy<top+height;yy++)for(let xx=left;xx<left+width;xx++)map[yy][xx]='.';rooms.push({x:left+Math.floor(width/2),y:top+1});}
 for(let i=1;i<rooms.length;i++){let {x,y}=rooms[i-1],end=rooms[i];while(x!==end.x){map[y][x]='.';x+=Math.sign(end.x-x);}while(y!==end.y){map[y][x]='.';y+=Math.sign(end.y-y);}map[y][x]='.';}
 const player={...rooms[0]},exit={...rooms[3]},spaces=shuffled(map.flatMap((row,y)=>row.flatMap((c,x)=>c==='.'&&distance(player,{x,y})>=3&&distance(exit,{x,y})>0?[{x,y}]:[])),rng);
 // Keep the first encounter within sight so a run begins with recall, not wandering.
 const first=spaces.findIndex(p=>distance(player,p)<=4&&lineVisible(map,player,p));if(first>0)[spaces[0],spaces[first]]=[spaces[first],spaces[0]];
 const ranked=shuffled(run.pool,rng).sort((a,b)=>Number(run.retry.includes(b))-Number(run.retry.includes(a))||Number(state.mistakes.includes(b))-Number(state.mistakes.includes(a))||(state.mastery[a]?.streak||0)-(state.mastery[b]?.streak||0));
 const monsters=Array.from({length:5},(_,i)=>({id:i,kana:ranked[i%ranked.length],...spaces[i],assisted:false}));
 return reveal({...run,map:map.map(row=>row.join('')),player,exit,monsters,potion:spaces[5],seen:Array(W*H).fill(false),target:null,feedback:null,notice:run.floor===1?'Введи чтение выбранного знака. Другого монстра можно выбрать нажатием.':'Новый этаж. Знаки с ошибками встретятся снова.'});
}
export function startDungeon(state,mode='learned',seed=(Date.now()>>>0),now=Date.now()){
 const pool=dungeonPool(state,mode);if(!pool.length)return state;
 const run=autoTarget(makeFloor(state,{seed:seed>>>0,startedAt:now,mode,pool,floor:1,hp:6,turn:0,kills:0,answers:0,correct:0,hints:0,retry:[],status:'explore'}));
 return {...state,activeCourse:'dungeon',dungeon:{...(state.dungeon||freshDungeon()),run}};
}
export function autoTarget(run){
 if(run.status!=='explore'||run.feedback)return run;
 const visible=visibleMonsters(run);
 if(visible.some(m=>m.id===run.target))return run;
 const nearest=[...visible].sort((a,b)=>distance(a,run.player)-distance(b,run.player)||a.id-b.id)[0];
 const target=nearest?.id??null;
 return target===run.target?run:{...run,target};
}
function changed(state,run){return {...state,dungeon:{...state.dungeon,run:autoTarget(reveal(run))}};}
function end(state,run,status,now){run={...run,status,target:null,feedback:null};const history=[{status,floor:run.floor,kills:run.kills,answers:run.answers,correct:run.correct,hints:run.hints,finishedAt:now},...state.dungeon.history].slice(0,30);return {...state,dungeon:{run,history}};}
function enemiesTurn(run,allowDamage=true){
 let hit=false;const occupied=new Set(run.monsters.map(m=>m.y*W+m.x));
 run.monsters=run.monsters.map(m=>{if(distance(m,run.player)===1){if(allowDamage)hit=true;return m;}if(distance(m,run.player)>7||!lineVisible(run.map,m,run.player))return m;
 const paths=Object.values(DIRECTIONS).map(([dx,dy])=>({x:m.x+dx,y:m.y+dy})).filter(p=>run.map[p.y]?.[p.x]==='.'&&distance(p,run.player)>0&&!occupied.has(p.y*W+p.x)).sort((a,b)=>distance(a,run.player)-distance(b,run.player));
 if(paths[0]&&distance(paths[0],run.player)<distance(m,run.player)){occupied.delete(m.y*W+m.x);occupied.add(paths[0].y*W+paths[0].x);return {...m,...paths[0]};}return m;});
 if(hit){run.hp--;run.notice='Монстр рядом ударил: −1 здоровье. Верный ответ защищает от атак.';}
 return run;
}
export function selectMonster(state,id){const r=state.dungeon.run;if(!r||r.status!=='explore'||r.feedback||!visibleMonsters(r).some(m=>m.id===id))return state;return changed(state,{...r,target:id});}
export function moveDungeon(state,direction,now=Date.now()){
 const old=state.dungeon.run;if(!old||old.status!=='explore'||old.feedback)return state;
 const delta=direction==='wait'?[0,0]:DIRECTIONS[direction];if(!delta)return state;
 const p={x:old.player.x+delta[0],y:old.player.y+delta[1]};if(old.map[p.y]?.[p.x]!=='.')return state;
 const monster=old.monsters.find(m=>m.x===p.x&&m.y===p.y);if(monster)return selectMonster(state,monster.id);
 let r={...old,player:p,turn:old.turn+1,target:null,notice:''};
 if(r.potion?.x===p.x&&r.potion?.y===p.y){r.hp=Math.min(6,r.hp+2);r.potion=null;r.notice='Зелье: +2 здоровья.';}
 r=enemiesTurn(r);if(r.hp<=0)return end(state,r,'lost',now);
 return changed(state,r);
}
export function hintDungeon(state){const r=state.dungeon.run,m=r?.monsters.find(m=>m.id===r.target);if(!m||r.feedback||r.status!=='explore'||!visibleMonsters(r).some(x=>x.id===m.id))return state;return changed(state,{...r,hints:r.hints+Number(!m.assisted),monsters:r.monsters.map(x=>x.id===m.id?{...x,assisted:true}:x),feedback:{kind:'hint',kana:m.kana,earned:0}});}
export function attackDungeon(state,value,now=Date.now()){
 const r=state.dungeon.run,m=r?.monsters.find(m=>m.id===r.target);if(!m||r.feedback||r.status!=='explore'||!visibleMonsters(r).some(x=>x.id===m.id)||!String(value).trim()||String(value).length>40)return state;
 const correct=normalize(value)!==BY_ID[m.kana].char&&accepts(m.kana,value),earned=correct&&!m.assisted?3:0;
 let next=state;if(!correct||!m.assisted)next=recordKanaRecall(state,m.kana,correct,now,earned);
 let run={...r,turn:r.turn+1,answers:r.answers+1,correct:r.correct+Number(correct),notice:'',feedback:{kind:correct?'right':'wrong',kana:m.kana,earned}};
 if(correct){run.monsters=r.monsters.filter(x=>x.id!==m.id);run.kills++;run.target=null;run=enemiesTurn(run,false);}
 else{run.hp--;run.retry=[...new Set([...r.retry,m.kana])];run.monsters=r.monsters.map(x=>x.id===m.id?{...x,assisted:true}:x);}
 if(run.hp<=0)return end(next,run,'lost',now);
 return changed(next,run);
}
export function continueDungeon(state){const r=state.dungeon.run;if(!r?.feedback||r.status!=='explore')return state;return changed(state,{...r,feedback:null});}
export function descendDungeon(state,now=Date.now()){
 const r=state.dungeon.run;if(!r||r.status!=='explore'||r.feedback)return state;
 if(r.player.x!==r.exit.x||r.player.y!==r.exit.y)return state;
 if(r.monsters.length)return changed(state,{...r,notice:'Сначала победи всех монстров на этаже.'});
 if(r.floor===3)return end(state,r,'won',now);
 return changed(state,makeFloor(state,{...r,floor:r.floor+1,hp:Math.min(6,r.hp+1)}));
}
