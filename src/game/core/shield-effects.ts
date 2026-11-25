import { LIVESTOCK_NAMES } from "../tile-help";
import {keyOccupant,storedWeight,compactVineStorage,discardStored,VINE_TILES} from "../vineyards";
import type { GameState, JsonValue, PendingChoice, PlayerState, DieValue } from "../types";
import { hasShield, shieldLayout, setShieldLayout, acquireShieldPreview, shieldSlotCount, diceShieldStatus, dieChangeShield, shieldRoundNumber, shieldWorkerSteps, shieldWorkerCost,goodsCapacity, type ShieldAcquireAction } from "../shields";
import { drawDie } from "./random";
import { placementIssue } from "./placement";
import { executeIntent } from "./intents";
import { prepareTileEffect, refreshPendingChoice } from "./effects";
import { orderedPlayers,storageCapacity } from "./state";
import {mayTakeSupply,settleTileReservations} from './custom-actions';

function tileLabel(state:GameState,id:string):string {
  if(VINE_TILES[id])return `포도 ${id} (2칸)`;
  const t=state.tiles[id];
  if(t.type==="inn")return "여관";
  if(t.type==="livestock")return `${LIVESTOCK_NAMES[t.species]} ${t.count}마리`;
  if(t.type==="building")return ({"white-castle":"흰 성",market:"시장","carpenters-workshop":"목공소",church:"교회",warehouse:"창고","boarding-house":"숙소",bank:"은행","town-hall":"시청",watchtower:"감시탑",crane:"기중기"})[t.building];
  return t.type==="monastery"?`수도원 ${t.number}`:({castle:"성",ship:"선박",mine:"광산"})[t.type];
}
const source={document:"special-edition-rulebook" as const,pages:[17,18],section:"Shield abilities"};
type Window={kind:"shield-five";tileId:string}|{kind:"shield-storage"|"shield-goods"|"shield-phase"};
const json=(v:unknown)=>v as JsonValue;
const phaseTileSources=new Map<number,'numbered'|'black'>([[14,'numbered'],[15,'black']]);
export function shieldPhaseTileSource(state:GameState,shieldNumber:number){
 return windowOf(state)?.kind==='shield-phase'&&shieldLayout(state)?.rules?.phase?.stage==='free'
  ?phaseTileSources.get(shieldNumber):undefined;
}
function windowOf(state:GameState):Window|null {
  const effect=state.turn.pendingEffects[0];
  if(!effect||effect.kind!=="extension"||effect.source.section!==source.section)return null;
  const p=effect.payload as Window|null;
  return p&&["shield-five","shield-storage","shield-goods","shield-phase"].includes(p.kind)?p:null;
}
function phaseOptions(state:GameState,player:PlayerState,legacy=false):PendingChoice["options"] {
  const layout=shieldLayout(state)!,flow=layout.rules!.phase!;
  const owned=layout.mounted.filter(m=>m.playerId===player.id);
  if(flow.stage==="tribute")return owned.filter(m=>!flow.paid.includes(m.shieldNumber)).flatMap(m=>[
    ...(player.silver>0?[{id:`pay:${m.shieldNumber}:silver`,label:`방패 ${m.shieldNumber} 유지 · 은화1`,payload:json({shieldNumber:m.shieldNumber,pay:"silver"})}]:[]),
    ...(hasShield(state,player.id,3)&&player.workers>0?[{id:`pay:${m.shieldNumber}:worker`,label:`방패 ${m.shieldNumber} 유지 · 일꾼1 (방패3)`,payload:json({shieldNumber:m.shieldNumber,pay:"worker"})}]:[]),
    ...(legacy?[{id:`remove:${m.shieldNumber}`,label:`방패 ${m.shieldNumber} 제거 · 유지비 내지 않기`,payload:json({shieldNumber:m.shieldNumber,pay:"remove"})}]:
      (m.sourceDepot?[m.sourceDepot]:[1,2,3,4,5,6]).map(depot=>({id:m.sourceDepot?`remove:${m.shieldNumber}`:`remove:${m.shieldNumber}:return:${depot}`,label:`방패 ${m.shieldNumber} 제거 · ${depot}번 공급처 반환`,payload:json({shieldNumber:m.shieldNumber,pay:"remove",returnDepot:depot})}))),
  ]);
  if(flow.stage!=="free")return [];
  return owned.filter(m=>phaseTileSources.has(m.shieldNumber)&&!flow.freeDone.includes(m.shieldNumber)).flatMap(m=>{
    const tileIds=phaseTileSources.get(m.shieldNumber)==='numbered'?state.market.numberedDepots.flatMap(d=>d.slots.flatMap(s=>s.tileId?[s.tileId]:[])):state.market.blackDepot.filter((id):id is string=>id!==null);
    const options:PendingChoice["options"][number][]=[];
    for(const tileId of tileIds.filter(id=>mayTakeSupply(state,player.id,id)))for(const cell of player.duchy.cells){
      if(!placementIssue(state,{...player,storage:[...player.storage,tileId]},tileId,cell.id,cell.number))options.push({id:`free:${m.shieldNumber}:${tileId}:${cell.id}`,label:`방패${m.shieldNumber} · ${tileLabel(state,tileId)} → ${cell.id} 직접 배치`,payload:json({shieldNumber:m.shieldNumber,tileId,cellId:cell.id})});
    }
    return options.length?options:[{id:`free:${m.shieldNumber}:none`,label:`방패${m.shieldNumber} · 합법 배치 없음`,payload:json({shieldNumber:m.shieldNumber})}];
  });
}
function optionsFor(state:GameState,player:PlayerState,window:Window,legacy=false):PendingChoice["options"] {
  if(window.kind==="shield-phase")return phaseOptions(state,player);
  if(window.kind==="shield-storage")return [...player.storage.flatMap((id,i)=>id?[{id:`discard:${i}:${id}`,label:`초과 보관 타일 ${i+1} 폐기 · ${tileLabel(state,id)}`,payload:json({tileId:id,index:i})}]:[]),...(player.vineyardReserve??[]).map(r=>({id:`discard:vine:${r.tileId}`,label:`초과 포도 ${r.tileId} 폐기 (2칸)`,payload:json({tileId:r.tileId})}))];
  if(window.kind==="shield-goods")return player.goods.map(({type,tiles})=>({id:`discard-goods:${type}`,label:`${type}번 상품 ${tiles.length}개 폐기`,payload:{goodsDiscardType:type}}));
  const types=([1,2,3,4,5,6] as const).filter(type=>(legacy||state.market.numberedDepots.some(d=>d.goods.some(g=>g.type===type)))&&(player.goods.length<goodsCapacity(state,player.id)||player.goods.some(g=>g.type===type)));
  return [{id:"shield5:skip",label:legacy||types.length?"방패5 추가 상품 가져오지 않기":"가져올 수 있는 상품 없음 · 건너뛰기",payload:null},...types.map(type=>({id:`shield5:${type}`,label:`방패5 · ${type}번 상품 전 공급처에서 수령`,payload:json({goodsType:type})}))];
}
function prepare(state:GameState,playerId:string,window:Window):GameState {
  const player=state.players.find(p=>p.id===playerId)!;
  const id=`shield:${state.revision+1}:${window.kind}:${playerId}`;
  return {...state,turn:{...state.turn,activePlayerId:playerId,pendingEffects:[{id,playerId,kind:"extension",source,payload:json(window)}],pendingChoice:{id,playerId,source,options:optionsFor(state,player,window)}}};
}
/** Exact old tribute menus are upgraded in memory; unknown/corrupt choices still fail validation. */
export function upgradeShieldPhaseChoice(state:GameState):GameState {
 const choice=state.turn.pendingChoice,p=state.players.find(p=>p.id===state.turn.activePlayerId);
 if(windowOf(state)?.kind!=='shield-phase'||!choice||!p||shieldLayout(state)?.rules?.phase?.stage!=='tribute')return state;
 return JSON.stringify(choice.options)===JSON.stringify(phaseOptions(state,p,true))?{...state,turn:{...state.turn,pendingChoice:{...choice,options:phaseOptions(state,p)}}}:state;
}
/** Only an exact old shield5 menu is migrated; injected choices remain invalid. */
export function upgradeShieldFiveChoice(state:GameState):GameState {
 const w=windowOf(state),c=state.turn.pendingChoice,p=state.players.find(p=>p.id===c?.playerId);
 return w?.kind==='shield-five'&&c&&p&&JSON.stringify(c.options)===JSON.stringify(optionsFor(state,p,w,true))?{...state,turn:{...state.turn,pendingChoice:{...c,options:optionsFor(state,p,w)}}}:state;
}
export function validShieldChoice(state:GameState):boolean {
  try{
    const w=windowOf(state),choice=state.turn.pendingChoice,e=state.turn.pendingEffects[0],p=state.players.find(p=>p.id===state.turn.activePlayerId);
    if(!w||!choice||!p||!shieldLayout(state)?.effectsActive||state.turn.pendingEffects.length!==1||e.id!==choice.id||e.playerId!==p.id||choice.playerId!==p.id||choice.source.section!==source.section)return false;
    if(w.kind==="shield-five"&&(!hasShield(state,p.id,5)||!p.duchy.cells.some(c=>c.tileId===w.tileId&&state.tiles[w.tileId]?.type==="ship")))return false;
    if(w.kind==="shield-storage"&&(hasShield(state,p.id,4)||storedWeight(p)<=storageCapacity(state,p)))return false;
    if(w.kind==="shield-goods"&&p.goods.length<=goodsCapacity(state,p.id))return false;
    if(w.kind==="shield-phase"&&(state.turn.stage!=="phase-end"||!shieldLayout(state)?.rules?.phase||!phaseOptions(state,p).length))return false;
    return JSON.stringify(choice.options)===JSON.stringify(optionsFor(state,p,w));
  }catch{return false;}
}
export function prepareShieldFive(state:GameState,playerId:string,tileId:string):GameState {
  return hasShield(state,playerId,5)?prepare(state,playerId,{kind:"shield-five",tileId}):state;
}
/** Canonical continuation: finish child tile effects before the next free placement/tribute. */
export function settleShieldState(input:GameState):GameState {
  if(!shieldLayout(input)?.effectsActive&&!input.config.customRules)return input;
  let state=settleTileReservations(input);
  const players=state.players.map(p=>{
    const limit=storageCapacity(state,p);
    if(hasShield(state,p.id,4))return p.storage.length<limit||!p.storage.some((_,i)=>!keyOccupant(p,i))?{...p,storage:[...p.storage,null]}:p;
    if(p.storage.length!==limit&&storedWeight(p)<=limit)return compactVineStorage(p,limit);
    return p;
  });state={...state,players};
  if(state.turn.pendingChoice){
    const w=windowOf(state),player=state.players.find(p=>p.id===state.turn.pendingChoice!.playerId);
    return w&&player?{...state,turn:{...state.turn,pendingChoice:{...state.turn.pendingChoice,options:optionsFor(state,player,w)}}}:refreshPendingChoice(state);
  }
  const overflow=state.players.find(p=>!hasShield(state,p.id,4)&&storedWeight(p)>storageCapacity(state,p));
  if(overflow)return prepare(state,overflow.id,{kind:"shield-storage"});
  const excessGoods=state.players.find(p=>p.goods.length>goodsCapacity(state,p.id));
  if(excessGoods)return prepare(state,excessGoods.id,{kind:'shield-goods'});
  const layout=shieldLayout(state)!,flow=layout?.rules?.phase;
  if(state.turn.stage!=="phase-end"||!flow)return state;
  if(flow.stage==="free"){
    const owner=orderedPlayers(state).find(id=>layout.mounted.some(m=>m.playerId===id&&phaseTileSources.has(m.shieldNumber)&&!flow.freeDone.includes(m.shieldNumber)));
    if(owner)return prepare(state,owner,{kind:"shield-phase"});
    state=setShieldLayout(state,{...layout,rules:{...layout.rules!,phase:{...flow,stage:"tribute"}}});
  }
  const nextLayout=shieldLayout(state)!,nextFlow=nextLayout.rules!.phase!;
  if(nextFlow.stage==="tribute"){
    const owner=orderedPlayers(state).find(id=>nextLayout.mounted.some(m=>m.playerId===id&&!nextFlow.paid.includes(m.shieldNumber)));
    if(owner)return prepare(state,owner,{kind:"shield-phase"});
    state=setShieldLayout(state,{...nextLayout,rules:{...nextLayout.rules!,phase:{...nextFlow,stage:"ready"}}});
  }
  return {...state,turn:{...state.turn,activePlayerId:null}};
}
export function startShieldPhase(state:GameState):GameState {
  const layout=shieldLayout(state);
  if(!layout?.effectsActive)return state;
  if(layout.rules!.phase)return settleShieldState(state);
  return settleShieldState(setShieldLayout(state,{...layout,rules:{...layout.rules!,phase:{phase:state.turn.phase,stage:"free",freeDone:[],paid:[]}}}));
}
export function resolveShieldChoice(state:GameState,optionId:string):GameState {
  if(!validShieldChoice(state))throw new Error("Invalid shield choice");
  const option=state.turn.pendingChoice!.options.find(o=>o.id===optionId);if(!option)throw new Error("Unknown shield option");
  const w=windowOf(state)!,playerId=state.turn.activePlayerId!,payload=option.payload as Record<string,unknown>|null;
  let next:GameState={...state,turn:{...state.turn,pendingChoice:null,pendingEffects:[]}};
  if(w.kind==="shield-storage"){
    const id=payload!.tileId as string;
    next=discardStored(next,playerId,[id]);
  }else if(w.kind==="shield-goods"){
    next={...next,players:next.players.map(p=>p.id===playerId?{...p,goods:p.goods.filter(g=>g.type!==payload?.goodsDiscardType)}:p)};
  }else if(w.kind==="shield-five"){
    if(payload){const type=payload.goodsType as 1|2|3|4|5|6;const taken=next.market.numberedDepots.flatMap(d=>d.goods.filter(g=>g.type===type));
      next={...next,market:{...next.market,numberedDepots:next.market.numberedDepots.map(d=>({...d,goods:d.goods.filter(g=>g.type!==type)}))},players:next.players.map(p=>p.id===playerId?{...p,goods:taken.length?[...p.goods.filter(g=>g.type!==type),{type,tiles:[...(p.goods.find(g=>g.type===type)?.tiles??[]),...taken]}]:p.goods}:p)};
    }
  }else{
    const layout=shieldLayout(next)!,flow=layout.rules!.phase!,n=payload!.shieldNumber as number;
    if(flow.stage==="free"){
      next=setShieldLayout(next,{...layout,rules:{...layout.rules!,phase:{...flow,freeDone:[...flow.freeDone,n]}}});
      if(payload!.tileId){const tileId=payload!.tileId as string,cellId=payload!.cellId as string;
        const player=next.players.find(p=>p.id===playerId)!,length=player.storage.length;
        next={...next,players:next.players.map(p=>p.id===playerId?{...p,storage:[...p.storage,tileId]}:p),market:{...next.market,numberedDepots:next.market.numberedDepots.map(d=>({...d,slots:d.slots.map(s=>s.tileId===tileId?{...s,tileId:null}:s)})),blackDepot:next.market.blackDepot.map(id=>id===tileId?null:id)}};
        next=executeIntent(next,playerId,{kind:"place-tile",tileId,cellId});
        next={...next,players:next.players.map(p=>p.id===playerId?{...p,storage:p.storage.slice(0,length)}:p)};
        next=prepareTileEffect(next,playerId,tileId);
      }
    }else{
      const pay=payload!.pay;
      let slots=layout.slots;
      if(pay==='remove'){
        const exact=layout.mounted.find(m=>m.shieldNumber===n)?.sourceSlotId;
        const depot=payload!.returnDepot as DieValue,empty=slots.find(s=>s.shieldNumber===null&&(exact?s.id===exact:s.depot===depot));
        if(empty)slots=slots.map(s=>s.id===empty.id?{...s,shieldNumber:n}:s);
        else {let index=shieldSlotCount(state.config.playerCount,depot);while(slots.some(s=>s.depot===depot&&s.index===index))index++;slots=[...slots,{id:`shield:depot:${depot}:${index}`,depot,index,shieldNumber:n}];}
      }
      next=setShieldLayout(next,{...layout,slots,mounted:pay==="remove"?layout.mounted.filter(m=>m.shieldNumber!==n):layout.mounted,rules:{...layout.rules!,phase:{...flow,paid:[...flow.paid,n]}}});
      next={...next,players:next.players.map(p=>p.id===playerId?{...p,silver:p.silver-(pay==="silver"?1:0),workers:p.workers-(pay==="worker"?1:0)}:p)};
    }
  }
  return settleShieldState(next);
}
export function castleShieldOptions(state:GameState,player:PlayerState):PendingChoice["options"] {
  if(!hasShield(state,player.id,11))return [];
  const layout=shieldLayout(state)!;
  return layout.slots.filter(s=>s.shieldNumber!==null).flatMap(slot=>player.duchy.cells.filter(c=>c.tileId&&state.tiles[c.tileId].type==="castle").map(c=>{
    const old=layout.mounted.find(m=>m.playerId===player.id&&m.cellId===c.id)?.shieldNumber??null;
    const shield={slotId:slot.id,castleCellId:c.id,replaceShieldNumber:old};
    return {id:`castle-shield:${slot.id}:${c.id}`,label:`방패11 · 방패${slot.shieldNumber} → 성 ${c.id}${old?` (방패${old} 반환·교체)`:""}`,payload:json({shield})};
  }));
}
export interface BonusShieldTarget {slotId:string;castleCellId:string;replaceShieldNumber:number|null;dieId?:string;steps?:readonly [readonly (1|-1)[],readonly (1|-1)[]]}
/** One virtual reward die plus exactly one unused owned die; shield11 stays a separate free option. */
export function bonusShieldOptions(state:GameState,player:PlayerState,white=false):PendingChoice['options'] {
 const layout=shieldLayout(state);if(!layout?.effectsActive||white&&state.dice.whiteDie===null)return [];
 return layout.slots.filter(s=>s.shieldNumber!==null).flatMap(slot=>state.dice.players[player.id].filter(d=>!d.used).flatMap(die=>{
  const steps=[white?shieldWorkerSteps(state.dice.whiteDie!,slot.depot):[],shieldWorkerSteps(die.value,slot.depot)] as const;
  if(steps.reduce((n,s)=>n+shieldWorkerCost(state,player.id,s),0)>player.workers)return [];
  return player.duchy.cells.filter(c=>c.tileId&&state.tiles[c.tileId].type==='castle').map(c=>{
   const shield:BonusShieldTarget={slotId:slot.id,castleCellId:c.id,replaceShieldNumber:layout.mounted.find(m=>m.playerId===player.id&&m.cellId===c.id)?.shieldNumber??null,dieId:die.id,steps};
   return {id:`bonus-shield:${JSON.stringify(shield)}`,label:`보상 주사위 + 주사위 ${state.dice.players[player.id].findIndex(d=>d.id===die.id)+1} · ${slot.depot}번 방패${slot.shieldNumber}`,payload:json({shield})};
  });
 }));
}
export function resolveCastleShield(state:GameState,payload:BonusShieldTarget):GameState {
  if(payload.dieId){
   const playerId=state.turn.activePlayerId!,slot=shieldLayout(state)!.slots.find(s=>s.id===payload.slotId)!,cost=payload.steps!.reduce((n,s)=>n+shieldWorkerCost(state,playerId,s),0);
   state={...state,players:state.players.map(p=>p.id===playerId?{...p,workers:p.workers-cost}:p),dice:{...state.dice,players:{...state.dice.players,[playerId]:state.dice.players[playerId].map(d=>d.id===payload.dieId?{...d,used:true,value:slot.depot}:d) as unknown as GameState['dice']['players'][string]}}};
  }
  const action:ShieldAcquireAction={type:"extension",extensionId:"shields",command:"acquire",playerId:state.turn.activePlayerId!,payload:{...payload,steps:[[],[]]}};
  return settleShieldState(acquireShieldPreview(state,action,true));
}
export function shieldSpecialIssue(state:GameState,action:Extract<import("../types").GameAction,{type:"extension"}>):string|null {
  const layout=shieldLayout(state),p=action.payload as Record<string,unknown>|null;
  if(!layout?.effectsActive)return "Active shield rules required";
  if(action.command==="use-extra-die")return action.payload===null&&state.dice.rolledForRound&&state.dice.players[action.playerId]?.length===2&&diceShieldStatus(layout,state.turn,state.dice,action.playerId,22)==="ready"?null:"Shield22 adds one action die once per phase";
  if(!p||typeof p!=="object"||Array.isArray(p))return "Active shield rules required";
  if(action.command==="choose-monastery-target")return hasShield(state,action.playerId,6)&&layout.rules!.monasteryTarget===null&&Object.keys(p).join() ==="targetPlayerId"&&state.players.some(player=>player.id!==action.playerId&&player.id===p.targetPlayerId)?null:"Choose another player once for shield6";
  const number=dieChangeShield(action.command);
  if(number)return diceShieldStatus(layout,state.turn,state.dice,action.playerId,number)==="ready"&&Object.keys(p).sort().join() ==="dieId,value"&&state.dice.players[action.playerId]?.some(d=>d.id===p.dieId&&!d.used)&&Number.isInteger(p.value)&&Number(p.value)>=1&&Number(p.value)<=6?null:`Shield${number} changes one unused die every other personal turn`;
  return "Unknown shield command";
}
export function applyShieldSpecial(state:GameState,action:Extract<import("../types").GameAction,{type:"extension"}>):GameState {
  const layout=shieldLayout(state)!,p=action.payload as Record<string,unknown>;
  if(action.command==="choose-monastery-target")return setShieldLayout(state,{...layout,rules:{...layout.rules!,monasteryTarget:p.targetPlayerId as string}});
  if(action.command==="use-extra-die"){
    const roll=drawDie(state.random),[first,second]=state.dice.players[action.playerId];
    const die={id:`${action.playerId}:c`,value:roll.value,used:false};
    return setShieldLayout({...state,random:roll.random,dice:{...state.dice,players:{...state.dice.players,[action.playerId]:[first,second,die]}}},
      {...layout,rules:{...layout.rules!,extraDieUsedRound:shieldRoundNumber(state.turn)}});
  }
  const dice=state.dice.players[action.playerId].map(d=>d.id===p.dieId?{...d,value:p.value}:d) as unknown as GameState["dice"]["players"][string];
  return setShieldLayout({...state,dice:{...state.dice,players:{...state.dice.players,[action.playerId]:dice}}},{...layout,rules:{...layout.rules!,dieChangedRounds:{...layout.rules!.dieChangedRounds,[action.playerId]:shieldRoundNumber(state.turn)}}});
}
