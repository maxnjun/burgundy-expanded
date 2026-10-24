import type {GameAction,GameState,PendingChoice,PendingEffect,PlayerState,JsonValue} from '../types';
import {VINE_SLOTS,vineLayers,vineSlots,VINE_BONUS_NAMES,GRAPES,GRAPE_NAMES,vineIntents,vineTakeIssue,executeVine,keyOccupant,discardStored,type VineIntent} from '../vineyards';
import {immediateOptions} from './effects';
import {destinationIssue} from './intents';
import {rewardShieldWorkerGain} from '../shields';
const source={document:'project-user-rule' as const,pages:[],section:'포도밭 · 프로젝트 복원판 v0.1'};
const wrap=(s:GameState,id:string,pid:string,payload:JsonValue,options:PendingChoice['options']):GameState=>({...s,turn:{...s.turn,pendingEffects:[{id,playerId:pid,kind:'extension',source,payload}],pendingChoice:{id,playerId:pid,source,options}}});
export function vineStoreIntents(s:GameState,p:PlayerState):VineIntent[]{
 if(!s.vineyards)return [];return s.vineyards.store.flatMap(tileId=>tileId?// Reuse canonical discard combinations from a temporary depot view.
 vineIntents({...s,vineyards:{...s.vineyards!,depots:[{id:'temporary',values:[1],tileId}]}},p).filter(i=>i.command==='take').map(i=>({...i,source:'store' as const})):[]);
}
function blackOptions(s:GameState,p:PlayerState):PendingChoice['options']{
 const options:PendingChoice['options'][number][]=[];
 for(const tileId of s.market.blackDepot)if(tileId&&["castle","ship","mine","livestock","building","monastery"].includes(s.tiles[tileId]?.type))for(let storageSlot=0;storageSlot<p.storage.length;storageSlot++){
  const occupant=keyOccupant(p,storageSlot),a={tileId,storageSlot,...(occupant?{discardTileId:occupant}:{})};
  if(!destinationIssue(p,a))options.push({id:JSON.stringify(a),label:`검은 타일 ${tileId} · 보관${storageSlot+1}`,payload:{vineBlack:a}});
 }
 for(const intent of vineStoreIntents(s,p))options.push({id:JSON.stringify(intent),label:`포도 상점 ${intent.tileId} 무료 획득${intent.discardIds?.length?' · 폐기 필요':''}`,payload:{intent} as unknown as JsonValue});
 return [...options,{id:'skip',label:'효과 사용하지 않기',payload:null}];
}
function orderOptions(s:GameState,pid:string,slotId:string):PendingChoice['options']{const x=s.vineyards!.players[pid].placed.find(x=>x.slotId===slotId)!,slot=VINE_SLOTS.find(x=>x.id===slotId)!;return [0,1].filter(i=>!x.used.includes(i)).map(index=>({id:`vine-order:${slotId}:${index}`,label:`${VINE_BONUS_NAMES[slot.cells[index].bonus]} 먼저/다음 처리`,payload:{index}}));}
function tokenOptions(s:GameState):PendingChoice['options']{return GRAPES.filter(g=>s.vineyards!.pool[g]>0).map(grape=>({id:`vine-token:${grape}`,label:`${GRAPE_NAMES[grape]} 포도 점수 토큰`,payload:{grape}}));}
export function resumeVineyards(s:GameState):GameState {
 if(!s.vineyards||s.turn.pendingChoice||s.turn.pendingEffects.length)return s;
 let v=s.vineyards;const pid=s.turn.activePlayerId;if(!pid)return s;
 let top=v.stack.at(-1);
 if(top){
  if(top.active!==null){v={...v,stack:v.stack.map((f,i)=>i===v.stack.length-1?{...f,active:null}:f)};s={...s,vineyards:v};top=v.stack.at(-1);}
  const x=v.players[pid].placed.find(x=>x.slotId===top!.slotId)!;
  const automatic=VINE_SLOTS.find(slot=>slot.id===x.slotId)!.cells.findIndex((c,i)=>!x.used.includes(i)&&['bank','boarding-house','watchtower'].includes(c.bonus));
  if(automatic>=0)return resumeVineyards(applyVineBenefit(s,x.slotId,automatic));
  if(x.used.length===1)return resumeVineyards(applyVineBenefit(s,x.slotId,[0,1].find(i=>!x.used.includes(i))!));
  if(x.used.length<2)return wrap(s,`vine-order:${pid}:${x.slotId}:${x.used.length}`,pid,{vineChoice:'order',slotId:x.slotId},orderOptions(s,pid,x.slotId));
  v={...v,stack:v.stack.slice(0,-1)};s={...s,vineyards:v};
 }
 const layer=vineLayers(v).find(l=>!v.players[pid].layers.includes(l)&&!v.stack.some(f=>vineSlots(v).find(x=>x.id===f.slotId)!.layer===l)&&vineSlots(v).filter(x=>x.layer===l).every(slot=>v.players[pid].placed.some(x=>x.slotId===slot.id&&x.used.length===2)));
 if(layer)return wrap(s,`vine-layer:${pid}:${layer}`,pid,{vineChoice:'token',layer},tokenOptions(s));
 return v.stack.length?resumeVineyards(s):s;
}
export function validVineBenefit(s:GameState,e:PendingEffect,kind:string):boolean {
 const t=s.vineyards?.stack.at(-1);if(!t||t.active===null||e.source.document!=='project-user-rule'||e.source.section!==source.section)return false;
 return e.id===`vine-benefit:${t.playerId}:${t.slotId}:${t.active}`&&VINE_SLOTS.find(x=>x.id===t.slotId)?.cells[t.active].bonus===kind;
}
export function validVineChoice(s:GameState):boolean {
 try{const e=s.turn.pendingEffects[0],c=s.turn.pendingChoice,p=s.players.find(p=>p.id===s.turn.activePlayerId),v=s.vineyards,payload=e?.payload as {vineChoice?:string;slotId?:string;layer?:number}|null;
 if(!v||!p||!c||e.source.document!=='project-user-rule'||e.source.section!==source.section||c.source.document!=='project-user-rule'||e.kind!=='extension'||e.playerId!==p.id||c.playerId!==p.id||c.id!==e.id||s.turn.pendingEffects.length!==1)return false;
 let opts:PendingChoice['options'];
 if(payload?.vineChoice==='order'){const t=v.stack.at(-1);if(!t||t.slotId!==payload.slotId||t.active!==null)return false;opts=orderOptions(s,p.id,t.slotId);if(e.id!==`vine-order:${p.id}:${t.slotId}:${v.players[p.id].placed.find(x=>x.slotId===t.slotId)!.used.length}`)return false;}
 else if(payload?.vineChoice==='token'){const layer=payload.layer;if(!layer||!vineLayers(v).includes(layer)||v.stack.some(f=>vineSlots(v).find(x=>x.id===f.slotId)!.layer===layer)||v.players[p.id].layers.includes(layer)||e.id!==`vine-layer:${p.id}:${layer}`||!vineSlots(v).filter(x=>x.layer===layer).every(slot=>v.players[p.id].placed.some(x=>x.slotId===slot.id&&x.used.length===2)))return false;opts=tokenOptions(s);}
 else if(payload?.vineChoice==='black-get'&&validVineBenefit(s,e,'black-get'))opts=blackOptions(s,p);
 else if(payload?.vineChoice==='vine-get'&&validVineBenefit(s,e,'vine-get'))opts=[...vineIntents(s,p).filter(i=>i.command==='take').map(intent=>({id:JSON.stringify(intent),label:`포도 공급대 ${intent.tileId} 획득`,payload:{intent} as unknown as JsonValue})),{id:'skip',label:'효과 사용하지 않기',payload:null}];
 else return false;
 return JSON.stringify(opts)===JSON.stringify(c.options);
 }catch{return false;}
}
export function resolveVineChoice(s:GameState,optionId:string):GameState {
 if(!validVineChoice(s))throw new Error('Invalid vineyard choice');
 const opt=s.turn.pendingChoice!.options.find(o=>o.id===optionId);if(!opt)throw new Error('Unknown vineyard option');
 const payload=s.turn.pendingEffects[0].payload as {vineChoice:string;slotId:string;layer:number};
 let n={...s,turn:{...s.turn,pendingChoice:null,pendingEffects:[]}} as GameState;const v=n.vineyards!;const pid=s.turn.activePlayerId!,p=n.players.find(p=>p.id===pid)!;
 if(payload.vineChoice==='token'){
  const grape=(opt.payload as {grape:import('../vineyards').Grape}).grape;
  return {...n,vineyards:{...v,pool:{...v.pool,[grape]:v.pool[grape]-1},players:{...v.players,[pid]:{...v.players[pid],tokens:[...v.players[pid].tokens,grape],layers:[...v.players[pid].layers,payload.layer]}}}};
 }
 if(payload.vineChoice==='order'){
  return applyVineBenefit(n,payload.slotId,(opt.payload as {index:number}).index);
 }
 if(opt.id==='skip')return n;
 const data=opt.payload as unknown as {intent?:VineIntent;vineBlack?:{tileId:string;storageSlot:number;discardTileId?:string}};
 if(data.intent){if(vineTakeIssue(n,p,data.intent))throw new Error('Invalid free vine');return executeVine(n,pid,data.intent);}
 const a=data.vineBlack!;n=discardStored(n,pid,a.discardTileId?[a.discardTileId]:[]);
 return {...n,market:{...n.market,blackDepot:n.market.blackDepot.map(id=>id===a.tileId?null:id)},players:n.players.map(p=>p.id===pid?{...p,storage:p.storage.map((id,i)=>i===a.storageSlot?a.tileId:id)}:p)};
}

export function refreshVineChoice(s:GameState):GameState {
 const e=s.turn.pendingEffects[0],c=s.turn.pendingChoice,p=s.players.find(p=>p.id===s.turn.activePlayerId),x=e?.payload as {vineChoice?:string;slotId?:string};
 if(!s.vineyards||!c||!p||!x?.vineChoice)return s;
 const options=x.vineChoice==='order'?orderOptions(s,p.id,x.slotId!):x.vineChoice==='token'?tokenOptions(s):x.vineChoice==='black-get'?blackOptions(s,p):[...vineIntents(s,p).filter(i=>i.command==='take').map(intent=>({id:JSON.stringify(intent),label:`포도 공급대 ${intent.tileId} 획득`,payload:{intent} as unknown as JsonValue})),{id:'skip',label:'효과 사용하지 않기',payload:null}];
 return {...s,turn:{...s.turn,pendingChoice:{...c,options}}};
}

/** Old saves can already be paused before a now-automatic fixed reward. */
export function automaticVineReward(s:GameState,actions:readonly GameAction[]):Extract<GameAction,{type:"resolve-choice"}>|null {
 // A purchase can create another target; never auto-consume that decision window.
 const choice=s.turn.pendingChoice;
 if(choice?.source.document==='project-user-rule'&&choice.source.section===source.section&&choice.options.length===1&&((actions.length===1&&s.vineyards?.stack.length)||(choice.options[0].id!=='skip'&&validVineChoice(s))))return {type:'resolve-choice',playerId:choice.playerId,choiceId:choice.id,optionId:choice.options[0].id};
 const payload=s.turn.pendingEffects[0]?.payload as {vineChoice?:string;slotId?:string}|null;
 if(!choice||payload?.vineChoice!=='order'||!validVineChoice(s))return null;
 const slot=VINE_SLOTS.find(x=>x.id===payload.slotId)!;
 const option=choice.options.find(o=>['bank','boarding-house','watchtower'].includes(slot.cells[(o.payload as {index:number}).index].bonus));
 return option?{type:'resolve-choice',playerId:choice.playerId,choiceId:choice.id,optionId:option.id}:null;
}

function applyVineBenefit(n:GameState,slotId:string,index:number):GameState {
 let v=n.vineyards!;const pid=n.turn.activePlayerId!,p=n.players.find(p=>p.id===pid)!;
 const slot=VINE_SLOTS.find(x=>x.id===slotId)!,kind=slot.cells[index].bonus;
  v={...v,stack:v.stack.map((f,i)=>i===v.stack.length-1?{...f,active:index}:f),players:{...v.players,[pid]:{...v.players[pid],placed:v.players[pid].placed.map(x=>x.slotId===slot.id?{...x,used:[...x.used,index]}:x)}}};n={...n,vineyards:v};
  const id=`vine-benefit:${pid}:${slot.id}:${index}`;
  if(kind==='bank'||kind==='boarding-house'||kind==='watchtower'){
   const points=kind==='watchtower'?4:0;return rewardShieldWorkerGain({...n,players:n.players.map(x=>x.id===pid?{...x,silver:x.silver+(kind==='bank'?2:0),workers:x.workers+(kind==='boarding-house'?4:0),victoryPoints:x.victoryPoints+points}:x),scoreLedger:points?{...n.scoreLedger,[pid]:[...n.scoreLedger[pid],{id,category:'extension',extensionId:'vineyards',points,source}]}:n.scoreLedger},pid,kind==='boarding-house'?4:0);
  }
  if(kind==='black-get')return wrap(n,id,pid,{vineChoice:kind},blackOptions(n,p));
  if(kind==='vine-get')return wrap(n,id,pid,{vineChoice:kind},[...vineIntents(n,p).filter(i=>i.command==='take').map(intent=>({id:JSON.stringify(intent),label:`포도 공급대 ${intent.tileId} 획득`,payload:{intent} as unknown as JsonValue})),{id:'skip',label:'효과 사용하지 않기',payload:null}]);
  return {...n,turn:{...n.turn,pendingEffects:[{id,playerId:pid,kind:'tile-benefit',source,payload:{kind,vineRewardId:id}}],pendingChoice:{id,playerId:pid,source,options:immediateOptions(n,p,kind)}}};
}
