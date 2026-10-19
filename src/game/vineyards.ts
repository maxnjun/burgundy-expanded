import type {AxialCoord,DieValue,GameState,Phase,PlayerState} from './types';
import {drawDie} from './core/random';
import {hasShield} from './shields';

export const GRAPES=['B','K','G','O','R','Y'] as const;
export type Grape=typeof GRAPES[number];
export const GRAPE_COLORS:Record<Grape,string>={B:'#386db3',K:'#403b51',G:'#92b332',O:'#e58a3f',R:'#be3d65',Y:'#e1bf42'};
export const GRAPE_NAMES:Record<Grape,string>={B:'파랑',K:'검정',G:'연두',O:'주황',R:'자홍',Y:'노랑'};
export type VineBonus='market'|'boarding-house'|'bank'|'carpenters-workshop'|'warehouse'|'church'|'watchtower'|'castle'|'town-hall'|'vine-get'|'black-get';
export const VINE_BONUS_NAMES:Record<VineBonus,string>={market:'시장','boarding-house':'일꾼4',bank:'은화2','carpenters-workshop':'목공소',warehouse:'상품 판매',church:'교회',watchtower:'승점4',castle:'자유 행동','town-hall':'무료 배치','vine-get':'포도 획득','black-get':'검은/상점 획득'};
type Cell=AxialCoord & {bonus:VineBonus};
export interface VineSlot {id:string;layer:number;value:DieValue;cells:readonly [Cell,Cell]}
const rows:readonly [number,DieValue,number,number,VineBonus,number,number,VineBonus][]=[
 [1,4,-2,2,'market',-2,3,'boarding-house'],[1,1,-2,4,'bank',-2,5,'carpenters-workshop'],
 [2,3,-1,1,'warehouse',0,0,'church'],[2,6,-1,2,'watchtower',-1,3,'castle'],
 [2,2,-1,4,'warehouse',0,4,'town-hall'],[2,5,-1,5,'castle',0,5,'watchtower'],
 [3,5,1,0,'carpenters-workshop',2,0,'vine-get'],[3,2,0,1,'town-hall',1,1,'warehouse'],
 [3,3,0,2,'market',1,2,'bank'],[3,4,0,3,'church',1,3,'boarding-house'],
 [3,6,2,1,'watchtower',2,2,'castle'],[3,1,1,4,'black-get',2,3,'warehouse'],
];
/** Project reconstruction v0.1. Coordinates are shared by logic and renderer. */
export const VINE_SLOTS:readonly VineSlot[]=rows.map(([layer,value,q,r,bonus,s,t,other],i)=>({id:`V${String(i+1).padStart(2,'0')}`,layer,value,cells:[{q,r,bonus},{q:s,r:t,bonus:other}]}));
export const VINE_TILES:Readonly<Record<string,readonly [Grape,Grape]>>=Object.fromEntries(GRAPES.flatMap((a,i)=>GRAPES.slice(i).flatMap(b=>Array.from({length:a===b?1:3},(_,n)=>[`${a}-${b}:${n+1}`,[a,b] as const]))));
export interface VinePlaced {slotId:string;tileId:string;flipped:boolean;used:readonly number[]}
export interface VineFrame {playerId:string;slotId:string;active:number|null}
export interface VineyardState {
 version:'project-vineyards-v1';excluded:readonly Grape[];bag:readonly string[];removed:readonly string[];phases:readonly Phase[];
 depots:readonly {id:string;values:readonly DieValue[];tileId:string|null}[];store:readonly (string|null)[];
 players:Readonly<Record<string,{placed:readonly VinePlaced[];tokens:readonly Grape[];layers:readonly number[]}>>;
 pool:Readonly<Record<Grape,number>>;stack:readonly VineFrame[];
}
export interface VineIntent {kind:'vineyard';command:'take'|'place';tileId:string;source?:'depot'|'store'|'black';slotId?:string;flipped?:boolean;discardIds?:readonly string[];storageSlot?:number;discardTileId?:string}
export const vineNeighbors=(a:AxialCoord,b:AxialCoord)=>Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs(a.q+a.r-b.q-b.r))===1;
export const reservedKey=(p:PlayerState,i:number)=>p.vineyardReserve?.find(r=>r.keys.includes(i))?.tileId??null;
export const keyOccupant=(p:PlayerState,i:number)=>p.storage[i]??reservedKey(p,i);
export const storedWeight=(p:PlayerState)=>p.storage.filter(Boolean).length+(p.vineyardReserve?.length??0)*2;
export function compactVineStorage(p:PlayerState):PlayerState{const ids=p.storage.filter((id):id is string=>id!==null);let at=ids.length;const reserve=p.vineyardReserve?.map(r=>({...r,keys:[at++,at++] as const}));return {...p,storage:[...ids,...Array(3-ids.length).fill(null)],...(reserve?{vineyardReserve:reserve}:{})};}
export function discardStored(state:GameState,playerId:string,ids:readonly string[]):GameState {
 const p=state.players.find(p=>p.id===playerId)!,reserve=p.vineyardReserve??[],v=state.vineyards;
 return {...state,players:state.players.map(x=>x.id===playerId?{...x,storage:x.storage.map(id=>id&&ids.includes(id)?null:id),...(x.vineyardReserve?{vineyardReserve:reserve.filter(r=>!ids.includes(r.tileId))}:{})}:x),market:{...state.market,removedTileIds:[...state.market.removedTileIds,...ids.filter(id=>p.storage.includes(id))]},...(v?{vineyards:{...v,removed:[...v.removed,...ids.filter(id=>reserve.some(r=>r.tileId===id))]}}:{})};
}
function shuffle<T>(items:readonly T[],random:GameState['random']):{items:T[];random:GameState['random']} {
 const result=[...items];for(let i=result.length-1;i>0;i--){let n:number;const limit=6**4-(6**4%(i+1));do{n=0;for(let j=0;j<4;j++){const d=drawDie(random);random=d.random;n=n*6+d.value-1;}}while(n>=limit);const k=n%(i+1);[result[i],result[k]]=[result[k],result[i]];}return {items:result,random};
}
export function setupVineyards(s:GameState,excluded:readonly Grape[]=[]):GameState {
 if(!s.config.extensions.some(e=>e.id==='vineyards'))return s;
 if(new Set(excluded).size!==excluded.length||excluded.some(g=>!GRAPES.includes(g))||excluded.length>(s.players.length===2?2:s.players.length===3?1:0))throw new Error('Invalid excluded grapes');
 const a=shuffle(Object.keys(VINE_TILES).filter(id=>!VINE_TILES[id].some(g=>excluded.includes(g))),s.random),b=shuffle(GRAPES.filter(g=>!excluded.includes(g)),a.random),pool=Object.fromEntries(GRAPES.map(g=>[g,excluded.includes(g)?0:4])) as Record<Grape,number>;
 const players=Object.fromEntries(s.players.map((p,i)=>{pool[b.items[i]]--;return [p.id,{placed:[],tokens:[b.items[i]],layers:[]}];}));
 return refillVineyards({...s,random:b.random,vineyards:{version:'project-vineyards-v1',excluded,bag:a.items,removed:[],phases:[],depots:[],store:[],players,pool,stack:[]}},'A');
}
export function refillVineyards(s:GameState,phase:Phase):GameState {
 const v=s.vineyards;if(!v||v.phases.includes(phase))return s;const bag=[...v.bag],draw=()=>{const id=bag.shift();if(!id)throw new Error('Vineyard supply exhausted');return id;};
 const values:DieValue[][]=s.players.length===4?[[1],[2],[3],[4],[5],[6]]:[[1,4],[2,5],[3,6]];
 return {...s,vineyards:{...v,bag,phases:[...v.phases,phase],removed:[...v.removed,...v.depots.flatMap(d=>d.tileId?[d.tileId]:[]),...v.store.filter((id):id is string=>id!==null)],depots:values.map((values,i)=>({id:`vine-depot:${i}`,values,tileId:draw()})),store:Array.from({length:s.players.length===2?1:3},draw)}};
}
export function vineValues(s:GameState,intent:VineIntent):readonly DieValue[]{return intent.command==='place'?[VINE_SLOTS.find(x=>x.id===intent.slotId)?.value??1]:s.vineyards?.depots.find(d=>d.tileId===intent.tileId)?.values??[];}
export function vinePlacementIssue(s:GameState,p:PlayerState,intent:VineIntent):string|null {
 if(intent.discardIds?.length)return "Placement cannot discard stored tiles";
 const v=s.vineyards,slot=VINE_SLOTS.find(x=>x.id===intent.slotId),own=v?.players[p.id];
 if(!v||!own||!slot||typeof intent.flipped!=='boolean'||!p.vineyardReserve?.some(r=>r.tileId===intent.tileId)||own.placed.some(x=>x.slotId===slot.id))return '포도 보관 타일/빈 공간을 확인하세요.';
 if(!own.placed.length)return slot.layer===1?null:'첫 포도 타일은 1층에 배치하세요.';
 return own.placed.some(x=>VINE_SLOTS.find(y=>y.id===x.slotId)!.cells.some(a=>slot.cells.some(b=>vineNeighbors(a,b))))?null:'기존 포도 타일과 변으로 인접해야 합니다.';
}
export function vineTakeIssue(s:GameState,p:PlayerState,intent:VineIntent):string|null {
 const v=s.vineyards;if(!v||!VINE_TILES[intent.tileId])return 'Invalid vineyard tile';
 if(intent.source==='depot'?!v.depots.some(d=>d.tileId===intent.tileId):intent.source==='store'?!v.store.includes(intent.tileId):true)return 'Tile not in vineyard supply';
 const ids=intent.discardIds??[],owned=[...p.storage.filter((id):id is string=>id!==null),...(p.vineyardReserve??[]).map(r=>r.tileId)];
 if(new Set(ids).size!==ids.length||ids.some(id=>!owned.includes(id)))return 'Invalid vineyard discard';
 const after=discardStored(s,p.id,ids).players.find(x=>x.id===p.id)!;
 return hasShield(s,p.id,4)||after.storage.filter((_,i)=>!keyOccupant(after,i)).length>=2?null:'포도 타일은 빈 보관 2칸이 필요합니다.';
}
export function executeVine(s:GameState,pid:string,intent:VineIntent):GameState {
 let n=discardStored(s,pid,intent.discardIds??[]);const p=n.players.find(x=>x.id===pid)!,v=n.vineyards!;
 if(intent.command==='take'){
  const keys=p.storage.flatMap((_,i)=>keyOccupant(p,i)?[]:[i]);const storage=[...p.storage];while(keys.length<2){keys.push(storage.length);storage.push(null);}
  return {...n,players:n.players.map(x=>x.id===pid?{...x,storage,vineyardReserve:[...(x.vineyardReserve??[]),{tileId:intent.tileId,keys:[keys[0],keys[1]]}]}:x),vineyards:{...v,depots:v.depots.map(d=>d.tileId===intent.tileId?{...d,tileId:null}:d),store:v.store.map(id=>id===intent.tileId?null:id)}};
 }
 n={...n,players:n.players.map(x=>x.id===pid?{...x,vineyardReserve:x.vineyardReserve?.filter(r=>r.tileId!==intent.tileId)}:x),vineyards:{...v,players:{...v.players,[pid]:{...v.players[pid],placed:[...v.players[pid].placed,{slotId:intent.slotId!,tileId:intent.tileId,flipped:intent.flipped!,used:[]}]}},stack:[...v.stack,{playerId:pid,slotId:intent.slotId!,active:null}]}};return n;
}
export function vineIntents(s:GameState,p:PlayerState):VineIntent[]{
 if(!s.vineyards)return [];const owned=[...p.storage.filter((id):id is string=>id!==null),...(p.vineyardReserve??[]).map(r=>r.tileId)],discards:string[][]=[[]];
 for(let i=0;i<owned.length;i++){discards.push([owned[i]]);for(let j=i+1;j<owned.length;j++)discards.push([owned[i],owned[j]]);}
 const take=s.vineyards.depots.flatMap(d=>d.tileId?discards.map(discardIds=>({kind:'vineyard' as const,command:'take' as const,source:'depot' as const,tileId:d.tileId!,discardIds})).filter(i=>!vineTakeIssue(s,p,i)):[]);
 const min=take.filter(i=>!take.some(j=>j.tileId===i.tileId&&(j.discardIds?.length??0)<(i.discardIds?.length??0)));
 return [...min,...(p.vineyardReserve??[]).flatMap(r=>VINE_SLOTS.flatMap(slot=>[false,true].map(flipped=>({kind:'vineyard' as const,command:'place' as const,tileId:r.tileId,slotId:slot.id,flipped}))).filter(i=>!vinePlacementIssue(s,p,i)))];
}
export function vineScore(v:VineyardState,pid:string):number {
 const cells=v.players[pid].placed.flatMap(p=>VINE_SLOTS.find(s=>s.id===p.slotId)!.cells.map((c,i)=>({...c,grape:VINE_TILES[p.tileId][p.flipped?1-i:i]}))),seen=new Set<number>(),areas:Record<string,number[]>={};
 for(let i=0;i<cells.length;i++){if(seen.has(i))continue;const todo=[i];seen.add(i);let size=0;while(todo.length){const j=todo.pop()!;size++;for(let k=0;k<cells.length;k++)if(!seen.has(k)&&cells[k].grape===cells[j].grape&&vineNeighbors(cells[k],cells[j])){seen.add(k);todo.push(k);}}(areas[cells[i].grape]??=[]).push(size);}
 return GRAPES.reduce((sum,g)=>sum+(areas[g]??[]).sort((a,b)=>b-a).slice(0,v.players[pid].tokens.filter(x=>x===g).length).reduce((n,size)=>n+size*(size+1)/2,0),0);
}
/** Strict save/runtime conservation; physical vine IDs never enter base tile locations. */
export function validVineyards(s:GameState):boolean {
 try{
 const enabled=s.config.extensions.some(e=>e.id==='vineyards'),v=s.vineyards;
 if(!enabled)return v===undefined&&s.players.every(p=>p.vineyardReserve===undefined);
 if(!v||v.version!=='project-vineyards-v1'||Object.keys(v.players).length!==s.players.length||new Set(v.excluded).size!==v.excluded.length||v.excluded.some(g=>!GRAPES.includes(g))||v.excluded.length>(s.players.length===2?2:s.players.length===3?1:0))return false;
 if(JSON.stringify(v.phases)!==JSON.stringify(['A','B','C','D','E'].slice(0,'ABCDE'.indexOf(s.turn.phase)+1)))return false;
 const expected=s.players.length===4?[[1],[2],[3],[4],[5],[6]]:[[1,4],[2,5],[3,6]];
 if(v.depots.length!==expected.length||v.depots.some((d,i)=>d.id!==`vine-depot:${i}`||JSON.stringify(d.values)!==JSON.stringify(expected[i]))||v.store.length!==(s.players.length===2?1:3))return false;
 const ids=[...v.bag,...v.removed,...v.depots.flatMap(d=>d.tileId?[d.tileId]:[]),...v.store.filter((id):id is string=>id!==null)];
 const totals=Object.fromEntries(GRAPES.map(g=>[g,v.pool[g]])) as Record<Grape,number>;
 for(const p of s.players){
  const own=v.players[p.id];if(!own||new Set(own.layers).size!==own.layers.length||own.layers.some(l=>![1,2,3].includes(l))||own.tokens.length>4)return false;
  for(const g of own.tokens){if(!GRAPES.includes(g))return false;totals[g]++;}
  if(new Set(own.placed.map(x=>x.slotId)).size!==own.placed.length)return false;
  for(const [index,x] of own.placed.entries()){const current=VINE_SLOTS.find(slot=>slot.id===x.slotId);if(current&&(index===0?current.layer!==1:!own.placed.slice(0,index).some(old=>VINE_SLOTS.find(slot=>slot.id===old.slotId)?.cells.some(a=>current.cells.some(b=>vineNeighbors(a,b))))))return false;if(!VINE_SLOTS.some(slot=>slot.id===x.slotId)||typeof x.flipped!=='boolean'||new Set(x.used).size!==x.used.length||x.used.some(i=>i!==0&&i!==1))return false;ids.push(x.tileId);}
  const expectedPoints=own.placed.flatMap(x=>x.used.filter(i=>VINE_SLOTS.find(slot=>slot.id===x.slotId)!.cells[i].bonus==='watchtower').map(i=>`vine-benefit:${p.id}:${x.slotId}:${i}`)),entries=s.scoreLedger[p.id].filter(e=>e.id.startsWith('vine-benefit:'));if(entries.length!==expectedPoints.length||entries.some(e=>!expectedPoints.includes(e.id)||e.points!==4||e.extensionId!=='vineyards'||e.source.document!=='project-user-rule'))return false;
  const keys:number[]=[];for(const r of p.vineyardReserve??[]){if(r.keys.length!==2||r.keys.some(k=>!Number.isInteger(k)||k<0||k>=p.storage.length||p.storage[k]!==null))return false;keys.push(...r.keys);ids.push(r.tileId);}
  if(new Set(keys).size!==keys.length)return false;
  for(const layer of own.layers)if(!VINE_SLOTS.filter(x=>x.layer===layer).every(slot=>own.placed.some(x=>x.slotId===slot.id&&x.used.length===2)))return false;
  if(own.tokens.length!==own.layers.length+1)return false;
  for(const x of own.placed)if(x.used.length<2&&!v.stack.some(f=>f.playerId===p.id&&f.slotId===x.slotId))return false;
 }
 const catalog=Object.keys(VINE_TILES).filter(id=>!VINE_TILES[id].some(g=>v.excluded.includes(g)));
 if(ids.length!==catalog.length||new Set(ids).size!==ids.length||ids.some(id=>!catalog.includes(id)))return false;
 if(GRAPES.some(g=>!Number.isSafeInteger(v.pool[g])||v.pool[g]<0||totals[g]!==(v.excluded.includes(g)?0:4)))return false;
 if(v.stack.length&&(!s.turn.pendingChoice||!s.turn.pendingEffects.length))return false;
 if(new Set(v.stack.map(f=>`${f.playerId}:${f.slotId}`)).size!==v.stack.length)return false;
 for(const f of v.stack){const x=v.players[f.playerId]?.placed.find(x=>x.slotId===f.slotId);if(!x||f.playerId!==s.turn.activePlayerId||f.active!==null&&(![0,1].includes(f.active)||!x.used.includes(f.active)))return false;}
 return true;
 }catch{return false;}
}
