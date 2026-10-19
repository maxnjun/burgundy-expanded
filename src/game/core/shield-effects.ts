import type { GameState, JsonValue, PendingChoice, PlayerState } from "../types";
import { hasShield, shieldLayout, setShieldLayout, acquireShieldPreview, shieldTurnKey, type ShieldAcquireAction } from "../shields";
import { placementIssue } from "./placement";
import { executeIntent } from "./intents";
import { prepareTileEffect, refreshPendingChoice } from "./effects";
import { orderedPlayers } from "./state";

function tileLabel(state:GameState,id:string):string {
  const t=state.tiles[id];
  if(t.type==="inn")return "여관";
  if(t.type==="livestock")return `${({cattle:"소",sheep:"양",pigs:"돼지",chickens:"닭",geese:"거위"})[t.species]} ${t.count}마리`;
  if(t.type==="building")return ({"white-castle":"흰 성",market:"시장","carpenters-workshop":"목공소",church:"교회",warehouse:"창고","boarding-house":"숙소",bank:"은행","town-hall":"시청",watchtower:"감시탑",crane:"기중기"})[t.building];
  return t.type==="monastery"?`수도원 ${t.number}`:({castle:"성",ship:"선박",mine:"광산"})[t.type];
}
const source={document:"special-edition-rulebook" as const,pages:[17,18],section:"Shield abilities"};
type Window={kind:"shield-five";tileId:string}|{kind:"shield-storage"}|{kind:"shield-phase"};
const json=(v:unknown)=>v as JsonValue;
function windowOf(state:GameState):Window|null {
  const effect=state.turn.pendingEffects[0];
  if(!effect||effect.kind!=="extension"||effect.source.section!==source.section)return null;
  const p=effect.payload as Window|null;
  return p&&["shield-five","shield-storage","shield-phase"].includes(p.kind)?p:null;
}
function phaseOptions(state:GameState,player:PlayerState):PendingChoice["options"] {
  const layout=shieldLayout(state)!,flow=layout.rules!.phase!;
  const owned=layout.mounted.filter(m=>m.playerId===player.id);
  if(flow.stage==="tribute")return owned.filter(m=>!flow.paid.includes(m.shieldNumber)).flatMap(m=>[
    ...(player.silver>0?[{id:`pay:${m.shieldNumber}:silver`,label:`방패 ${m.shieldNumber} 유지 · 은화1`,payload:json({shieldNumber:m.shieldNumber,pay:"silver"})}]:[]),
    ...(hasShield(state,player.id,3)&&player.workers>0?[{id:`pay:${m.shieldNumber}:worker`,label:`방패 ${m.shieldNumber} 유지 · 일꾼1 (방패3)`,payload:json({shieldNumber:m.shieldNumber,pay:"worker"})}]:[]),
    {id:`remove:${m.shieldNumber}`,label:`방패 ${m.shieldNumber} 제거 · 유지비 내지 않기`,payload:json({shieldNumber:m.shieldNumber,pay:"remove"})},
  ]);
  if(flow.stage!=="free")return [];
  return owned.filter(m=>(m.shieldNumber===14||m.shieldNumber===15)&&!flow.freeDone.includes(m.shieldNumber)).flatMap(m=>{
    const tileIds=m.shieldNumber===14?state.market.numberedDepots.flatMap(d=>d.slots.flatMap(s=>s.tileId?[s.tileId]:[])):state.market.blackDepot.filter((id):id is string=>id!==null);
    const options:PendingChoice["options"][number][]=[];
    for(const tileId of tileIds)for(const cell of player.duchy.cells){
      if(!placementIssue(state,{...player,storage:[...player.storage,tileId]},tileId,cell.id,cell.number))options.push({id:`free:${m.shieldNumber}:${tileId}:${cell.id}`,label:`방패${m.shieldNumber} · ${tileLabel(state,tileId)} → ${cell.id} 직접 배치`,payload:json({shieldNumber:m.shieldNumber,tileId,cellId:cell.id})});
    }
    return options.length?options:[{id:`free:${m.shieldNumber}:none`,label:`방패${m.shieldNumber} · 합법 배치 없음`,payload:json({shieldNumber:m.shieldNumber})}];
  });
}
function optionsFor(state:GameState,player:PlayerState,window:Window):PendingChoice["options"] {
  if(window.kind==="shield-phase")return phaseOptions(state,player);
  if(window.kind==="shield-storage")return player.storage.flatMap((id,i)=>id?[{id:`discard:${i}:${id}`,label:`초과 보관 타일 ${i+1} 폐기 · ${tileLabel(state,id)}`,payload:json({tileId:id,index:i})}]:[]);
  return [{id:"shield5:skip",label:"방패5 추가 상품 가져오지 않기",payload:null},...([1,2,3,4,5,6] as const).filter(type=>player.goods.length<3||player.goods.some(g=>g.type===type)).map(type=>({id:`shield5:${type}`,label:`방패5 · ${type}번 상품 전 공급처에서 수령`,payload:json({goodsType:type})}))];
}
function prepare(state:GameState,playerId:string,window:Window):GameState {
  const player=state.players.find(p=>p.id===playerId)!;
  const id=`shield:${state.revision+1}:${window.kind}:${playerId}`;
  return {...state,turn:{...state.turn,activePlayerId:playerId,pendingEffects:[{id,playerId,kind:"extension",source,payload:json(window)}],pendingChoice:{id,playerId,source,options:optionsFor(state,player,window)}}};
}
export function validShieldChoice(state:GameState):boolean {
  try{
    const w=windowOf(state),choice=state.turn.pendingChoice,e=state.turn.pendingEffects[0],p=state.players.find(p=>p.id===state.turn.activePlayerId);
    if(!w||!choice||!p||!shieldLayout(state)?.effectsActive||state.turn.pendingEffects.length!==1||e.id!==choice.id||e.playerId!==p.id||choice.playerId!==p.id||choice.source.section!==source.section)return false;
    if(w.kind==="shield-five"&&(!hasShield(state,p.id,5)||!p.duchy.cells.some(c=>c.tileId===w.tileId&&state.tiles[w.tileId]?.type==="ship")))return false;
    if(w.kind==="shield-storage"&&(hasShield(state,p.id,4)||p.storage.filter(Boolean).length<=3))return false;
    if(w.kind==="shield-phase"&&(state.turn.stage!=="phase-end"||!shieldLayout(state)?.rules?.phase||!phaseOptions(state,p).length))return false;
    return JSON.stringify(choice.options)===JSON.stringify(optionsFor(state,p,w));
  }catch{return false;}
}
export function prepareShieldFive(state:GameState,playerId:string,tileId:string):GameState {
  return hasShield(state,playerId,5)?prepare(state,playerId,{kind:"shield-five",tileId}):state;
}
/** Canonical continuation: finish child tile effects before the next free placement/tribute. */
export function settleShieldState(input:GameState):GameState {
  if(!shieldLayout(input)?.effectsActive)return input;
  let state=input;
  const players=state.players.map(p=>{
    if(hasShield(state,p.id,4))return p.storage.includes(null)?p:{...p,storage:[...p.storage,null]};
    if(p.storage.length>3&&p.storage.filter(Boolean).length<=3){const ids=p.storage.filter((id):id is string=>id!==null);return {...p,storage:[...ids,...Array(3-ids.length).fill(null)]};}
    return p;
  });state={...state,players};
  if(state.turn.pendingChoice){
    const w=windowOf(state),player=state.players.find(p=>p.id===state.turn.pendingChoice!.playerId);
    return w&&player?{...state,turn:{...state.turn,pendingChoice:{...state.turn.pendingChoice,options:optionsFor(state,player,w)}}}:refreshPendingChoice(state);
  }
  const overflow=state.players.find(p=>!hasShield(state,p.id,4)&&p.storage.filter(Boolean).length>3);
  if(overflow)return prepare(state,overflow.id,{kind:"shield-storage"});
  const layout=shieldLayout(state)!,flow=layout.rules?.phase;
  if(state.turn.stage!=="phase-end"||!flow)return state;
  if(flow.stage==="free"){
    const owner=orderedPlayers(state).find(id=>layout.mounted.some(m=>m.playerId===id&&(m.shieldNumber===14||m.shieldNumber===15)&&!flow.freeDone.includes(m.shieldNumber)));
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
    const id=payload!.tileId as string,index=payload!.index as number;
    next={...next,market:{...next.market,removedTileIds:[...next.market.removedTileIds,id]},players:next.players.map(p=>p.id===playerId?{...p,storage:p.storage.map((s,i)=>i===index?null:s)}:p)};
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
      next=setShieldLayout(next,{...layout,mounted:pay==="remove"?layout.mounted.filter(m=>m.shieldNumber!==n):layout.mounted,removed:pay==="remove"?[...layout.removed,n]:layout.removed,rules:{...layout.rules!,phase:{...flow,paid:[...flow.paid,n]}}});
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
    return {id:`castle-shield:${slot.id}:${c.id}`,label:`방패11 · 방패${slot.shieldNumber} → 성 ${c.id}${old?` (방패${old} 제거·교체)`:""}`,payload:json({shield})};
  }));
}
export function resolveCastleShield(state:GameState,payload:{slotId:string;castleCellId:string;replaceShieldNumber:number|null}):GameState {
  const action:ShieldAcquireAction={type:"extension",extensionId:"shields",command:"acquire",playerId:state.turn.activePlayerId!,payload:{...payload,steps:[[],[]]}};
  return settleShieldState(acquireShieldPreview(state,action,true));
}
export function shieldSpecialIssue(state:GameState,action:Extract<import("../types").GameAction,{type:"extension"}>):string|null {
  const layout=shieldLayout(state),p=action.payload as Record<string,unknown>|null;
  if(!layout?.effectsActive||!p||typeof p!=="object"||Array.isArray(p))return "Active shield rules required";
  if(action.command==="choose-monastery-target")return hasShield(state,action.playerId,6)&&layout.rules!.monasteryTarget===null&&Object.keys(p).join() ==="targetPlayerId"&&state.players.some(player=>player.id===p.targetPlayerId)?null:"Choose a player once for shield6";
  if(action.command==="change-die")return hasShield(state,action.playerId,16)&&Object.keys(p).sort().join() ==="dieId,value"&&layout.rules!.dieChangedTurn!==shieldTurnKey(state,action.playerId)&&state.dice.players[action.playerId]?.some(d=>d.id===p.dieId&&!d.used)&&Number.isInteger(p.value)&&Number(p.value)>=1&&Number(p.value)<=6?null:"Shield16 changes one unused die once per turn";
  return "Unknown shield command";
}
export function applyShieldSpecial(state:GameState,action:Extract<import("../types").GameAction,{type:"extension"}>):GameState {
  const layout=shieldLayout(state)!,p=action.payload as Record<string,unknown>;
  if(action.command==="choose-monastery-target")return setShieldLayout(state,{...layout,rules:{...layout.rules!,monasteryTarget:p.targetPlayerId as string}});
  const dice=state.dice.players[action.playerId].map(d=>d.id===p.dieId?{...d,value:p.value}:d) as unknown as GameState["dice"]["players"][string];
  return setShieldLayout({...state,dice:{...state.dice,players:{...state.dice.players,[action.playerId]:dice}}},{...layout,rules:{...layout.rules!,dieChangedTurn:shieldTurnKey(state,action.playerId)}});
}
