import type {GameAction,GameState} from "./types";
import {LIVESTOCK_NAMES} from "./tile-help";
import {directCost} from "./direct-actions";
import {shieldLayout} from "./shields";
import {isPlayerColor,playerColorKey} from './player-colors';
import {vineValues} from './vineyards';
const tileName=(s:GameState,id:string)=>{const t=s.tiles[id];return t.type==="building"?({"white-castle":"흰 성",crane:"기중기",market:"시장",bank:"은행",church:"교회",warehouse:"창고","boarding-house":"숙소","carpenters-workshop":"목공소","town-hall":"시청",watchtower:"감시탑"})[t.building]:t.type==="monastery"?`수도원${t.number}`:t.type==="livestock"?`${LIVESTOCK_NAMES[t.species]}${t.count}`:({inn:"여관",castle:"성",mine:"광산",ship:"선박"})[t.type];};
const intentLabel=(s:GameState,i:import("./types").ActionIntent):string=>i.kind==="take-workers"?"일꾼 획득":i.kind==="sell-goods"?`${i.goodsType}번 상품 판매`:i.kind==="vineyard"?`포도 타일 ${i.command==="take"?"획득":"배치"}`:i.kind==="take-tile"?`${i.depot}번 ${tileName(s,i.tileId)} 획득 · 보관${i.storageSlot+1}${i.discardTileId?" 교체":""}`:`${tileName(s,i.tileId)} 배치`;
export function actionLabel(s:GameState,a:GameAction):string{
  if(a.type==="place-starting-castle")return "시작 성 배치";
  if(a.type==="roll-round")return "라운드 주사위 굴리기";
  if(a.type==="end-turn")return "차례 종료";
  if(a.type==="advance-phase")return s.turn.phase==="E"?"최종 정산":"단계 수입·보충";
  if(a.type==="resolve-choice"){const o=s.turn.pendingChoice?.options.find(o=>o.id===a.optionId),p=o?.payload as unknown as {intent?:import("./types").ActionIntent;vineBlack?:{tileId:string}}|null;return p?.intent?intentLabel(s,p.intent):p?.vineBlack?`${tileName(s,p.vineBlack.tileId)} 무료 획득`:o?.label??"효과 선택";}
  if(a.type==="buy-black-tile"||a.type==="use-monastery-six")return `${tileName(s,a.tileId)} ${a.type==="buy-black-tile"&&s.tiles[a.tileId].type==="inn"?"구매":"획득"} · ${a.type==="buy-black-tile"?"은화2":"일꾼2"} · 보관${a.storageSlot+1}${a.discardTileId?" 교체":""}`;
  if(a.type==="extension"&&a.extensionId==="shields"){
    const payload=a.payload as Record<string,unknown>;
    if(a.command==="choose-monastery-target")return `방패6 · ${s.players.find(p=>p.id===payload.targetPlayerId)?.name} 수도원 공유`;
    if(a.command==="change-die")return `방패16 · 주사위${s.dice.players[a.playerId].findIndex(d=>d.id===payload.dieId)+1} → ${payload.value}`;
    const number=shieldLayout(s)?.slots.find(slot=>slot.id===payload.slotId)?.shieldNumber;
    return `방패${number} 획득 · 일꾼${directCost(s,a)}${payload.replaceShieldNumber?` · 기존 방패${payload.replaceShieldNumber} 반환·교체`:""}`;
  }
  if(a.type==="extension"&&a.extensionId==="vineyards")return "포도 상점 구매 · 은화2";
  if(a.type!=="use-die")return "확장 행동";
  return `${intentLabel(s,a.intent)}${a.adjustment.workersSpent?` · 일꾼${a.adjustment.workersSpent}`:""}`;
}

export interface ActionLogData {text:string;playerId?:string;playerColor?:import('./types').PlayerColor;dice:{index:number;value:number|null;source?:'player'|'white'|'bonus';color?:import('./types').PlayerColor}[];tileId?:string}
/** Keep the existing string[] save format; old plain-text records remain readable. */
export function createActionLog(before:GameState,after:GameState,action:GameAction,prefix=""):string {
 const p=before.players.find(p=>p.id===action.playerId)!,next=after.players.find(other=>other.id===p.id)!;
 const delta=([['승점',next.victoryPoints-p.victoryPoints],['은화',next.silver-p.silver],['일꾼',next.workers-p.workers]] as const).filter(([,n])=>n!==0).map(([name,n])=>`${name} ${n>0?'+':''}${n}`);
 const dice:ActionLogData['dice']=(before.dice.players[p.id]??[]).flatMap((d,i)=>!d.used&&after.dice.players[p.id]?.[i]?.used?[{index:i+1,value:after.dice.players[p.id][i].value,source:'player' as const,color:playerColorKey(p)}]:[]);
 const payload=action.type==='resolve-choice'?before.turn.pendingChoice?.options.find(o=>o.id===action.optionId)?.payload as unknown as {intent?:import('./types').ActionIntent;tileId?:string;vineBlack?:{tileId:string};shield?:import('./core/shield-effects').BonusShieldTarget}|null:undefined;
 const intent=action.type==='use-die'?action.intent:payload?.intent;
 const effect=before.turn.pendingEffects[0]?.payload as {kind?:string}|null;
 if(action.type==='resolve-choice'&&(effect?.kind==='castle'||effect?.kind==='white-castle')&&(intent||payload?.shield)){
  const shield=payload?.shield,slot=shield?shieldLayout(before)?.slots.find(s=>s.id===shield.slotId):undefined;
  const value=slot?.depot??(intent?.kind==='take-tile'?intent.depot:intent?.kind==='place-tile'?p.duchy.cells.find(c=>c.id===intent.cellId)?.number:intent?.kind==='sell-goods'?intent.goodsType:intent?.kind==='vineyard'?vineValues(before,intent)[0]:null);
  dice.unshift({index:0,value:value??(effect.kind==='white-castle'?before.dice.whiteDie:null),source:effect.kind==='white-castle'?'white':'bonus'});
 }
 const tileId=intent&&'tileId' in intent?intent.tileId:payload?.vineBlack?.tileId??payload?.tileId??(action.type==='buy-black-tile'||action.type==='use-monastery-six'?action.tileId:action.type==='extension'&&action.extensionId==='vineyards'?(action.payload as {tileId?:string}).tileId:action.type==='place-starting-castle'?p.storage[0]??undefined:undefined);
 return JSON.stringify({format:'action-log-v1',playerId:p.id,playerColor:playerColorKey(p),text:[prefix,p.name,actionLabel(before,action),...delta].filter(Boolean).join(' · '),dice,...(tileId?{tileId}:{})});
}
export function readActionLog(record:string):ActionLogData {
 try{const d=JSON.parse(record);if(d?.format==='action-log-v1'&&typeof d.text==='string'&&(d.playerId===undefined||typeof d.playerId==='string')&&(d.playerColor===undefined||isPlayerColor(d.playerColor))&&Array.isArray(d.dice)&&d.dice.length<=3&&d.dice.every((x:ActionLogData['dice'][number])=>[0,1,2].includes(x.index)&&(x.value===null||Number.isInteger(x.value)&&x.value>=1&&x.value<=6)&&(x.source===undefined||['player','white','bonus'].includes(x.source))&&(x.color===undefined||['blue','red','green','yellow','purple','pink'].includes(x.color)))&&(d.tileId===undefined||typeof d.tileId==='string'))return d;}catch{}
 return {text:record.replace(/(\(| · )승점 \+0(?= · |\)|$)/g,'$1').replace(/ ·\s*· /g,' · ').replace(/\(\s*· /g,'(').replace(/ ·\s*$/g,'').replace(/ → \([^)]*\) 배치/g,' 배치').replace(/\s*\([^)]*\) 배치/g,' 배치').replace(/시작 성 배치 · [^ ·)]+/g,'시작 성 배치').replace(/포도 배치 V\d{2}(?= · |$)/g,'포도 배치').replace(/(방패\d+ 획득) · 성 [^ ·]+ · 두 주사위/g,'$1 · 두 주사위'),dice:[]};
}
