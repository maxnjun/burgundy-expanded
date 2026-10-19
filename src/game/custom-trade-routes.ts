import type {BuildingType,DieValue,GameState} from "./types";
import {prepareTradeRoutes,type TradeRouteTile} from "./trade-routes";

export type TradeReward=Exclude<BuildingType,"crane">;
export const TRADE_REWARD_NAMES:Record<TradeReward,string>={warehouse:"창고","carpenters-workshop":"목수 작업장",church:"교회",market:"시장","boarding-house":"하숙집",bank:"은행","town-hall":"시청",watchtower:"망루","white-castle":"흰 성"};
/** User-designed catalog. NOT the publisher's twelve trade-route fronts. */
const rows:readonly (readonly [DieValue,TradeReward])[]=[
 [1,"warehouse"],[4,"carpenters-workshop"],[2,"church"],
 [5,"market"],[3,"boarding-house"],[6,"bank"],
 [2,"town-hall"],[1,"watchtower"],[4,"white-castle"],
 [6,"carpenters-workshop"],[3,"church"],[5,"market"],
 [1,"boarding-house"],[5,"bank"],[2,"town-hall"],
 [4,"watchtower"],[6,"white-castle"],[3,"warehouse"],
 [3,"church"],[2,"market"],[1,"boarding-house"],
 [5,"bank"],[4,"town-hall"],[6,"watchtower"],
 [2,"white-castle"],[3,"warehouse"],[5,"carpenters-workshop"],
 [4,"market"],[1,"boarding-house"],[6,"bank"],
 [6,"town-hall"],[5,"watchtower"],[3,"white-castle"],
 [1,"warehouse"],[2,"carpenters-workshop"],[4,"church"],
];
export const CUSTOM_TRADE_CATALOG:readonly TradeRouteTile[]=Object.freeze(Array.from({length:12},(_,i)=>Object.freeze({id:String(i+1),spaces:Object.freeze(rows.slice(i*3,i*3+3).map(([goodsType,bonusId])=>Object.freeze({goodsType,bonusId}))) as unknown as TradeRouteTile["spaces"]})));
export interface TradeSale {readonly goodsType:DieValue;readonly goodsIds:readonly string[];readonly revision:number;readonly status:"mismatch"|"pending"|"resolved"|"skipped"}
export interface CustomTradeRoute {readonly tileIds:readonly string[];readonly sales:readonly TradeSale[]}
export interface CustomTradeState {readonly version:1;readonly routes:Readonly<Record<string,CustomTradeRoute>>;readonly unusedTileIds:readonly string[]}
export const customTradeSpaces=(route:CustomTradeRoute)=>route.tileIds.flatMap(id=>CUSTOM_TRADE_CATALOG.find(t=>t.id===id)!.spaces);
export function setupCustomTrade(state:GameState):GameState{
 if(!state.config.extensions.some(e=>e.id==="trade-routes"))return state;
 const setup=prepareTradeRoutes(state.players.map(p=>p.id),CUSTOM_TRADE_CATALOG,state.random);
 return {...state,random:setup.random,tradeRoutes:{version:1,routes:Object.fromEntries(Object.entries(setup.routes).map(([id,r])=>[id,{tileIds:r.tileIds,sales:[]}])),unusedTileIds:setup.unusedTileIds}};
}
export function tradeSlotId(playerId:string,index:number){return `trade:${playerId}:${index}`;}
export function pendingTradeReward(state:GameState,playerId:string,slotId:string):TradeReward|null{
 const route=state.tradeRoutes?.routes[playerId];if(!route)return null;
 const index=route.sales.length-1;
 return route.sales[index]?.status==="pending"&&tradeSlotId(playerId,index)===slotId?customTradeSpaces(route)[index].bonusId as TradeReward:null;
}
export function settleTradeReward(state:GameState,playerId:string,slotId:string,skipped=false):GameState{
 if(!pendingTradeReward(state,playerId,slotId))throw new Error("Unknown or already consumed trade reward");
 const route=state.tradeRoutes!.routes[playerId];
 return {...state,tradeRoutes:{...state.tradeRoutes!,routes:{...state.tradeRoutes!.routes,[playerId]:{...route,sales:route.sales.map((s,i)=>i===route.sales.length-1?{...s,status:skipped?"skipped":"resolved"}:s)}}}};
}
export function validCustomTrade(state:GameState):boolean{
 try{
  if(!state.config.extensions.some(e=>e.id==="trade-routes"))return state.tradeRoutes===undefined;
  const trade=state.tradeRoutes;if(!trade||trade.version!==1||Object.keys(trade.routes).length!==state.players.length)return false;
  const all=[...trade.unusedTileIds,...Object.values(trade.routes).flatMap(r=>r.tileIds)];
  if(all.length!==12||new Set(all).size!==12||all.some(id=>!CUSTOM_TRADE_CATALOG.some(t=>t.id===id)))return false;
  let pending=0;
  for(const p of state.players){
   const r=trade.routes[p.id];if(!r||r.tileIds.length!==(state.players.length===2?5:state.players.length===3?4:3)||r.sales.length>r.tileIds.length*3)return false;
   const spaces=customTradeSpaces(r),seen=new Set<string>();let revision=-1;
   for(const [i,s]of r.sales.entries()){
    if(!Number.isSafeInteger(s.revision)||s.revision<1||s.revision<=revision||s.revision>state.revision||!s.goodsIds.length||s.goodsIds.some(id=>{if(seen.has(id)||!p.soldGoods.some(g=>g.id===id&&g.type===s.goodsType))return true;seen.add(id);return false;}))return false;
    revision=s.revision;const match=s.goodsType===spaces[i].goodsType;
    if(!["mismatch","pending","resolved","skipped"].includes(s.status)||(s.status==="mismatch")===match)return false;
    if(match&&["bank","boarding-house","watchtower"].includes(spaces[i].bonusId)&&s.status!=="resolved")return false;
    if(s.status==="pending"){
     pending++;const e=state.turn.pendingEffects[0],payload=e?.payload as {tradeSlotId?:string;kind?:string}|null;
     if(i!==r.sales.length-1||state.turn.activePlayerId!==p.id||payload?.tradeSlotId!==tradeSlotId(p.id,i)||payload.kind!==spaces[i].bonusId||e?.kind!=="tile-benefit"||["bank","boarding-house","watchtower"].includes(payload.kind))return false;
    }
   }
   const expected=r.sales.flatMap((s,i)=>s.status==="resolved"&&spaces[i].bonusId==="watchtower"?[`${tradeSlotId(p.id,i)}:points`]:[]),entries=state.scoreLedger[p.id].filter(e=>e.extensionId==="trade-routes");
   if(entries.length!==expected.length||new Set(entries.map(e=>e.id)).size!==entries.length||entries.some(e=>!expected.includes(e.id)||e.points!==4||e.source.document!=="project-user-rule"))return false;
  }
  return pending<=1;
 }catch{return false;}
}
