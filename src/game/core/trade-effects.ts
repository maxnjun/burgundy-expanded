import type {DieValue,GameState} from "../types";
import {customTradeSpaces,settleTradeReward,tradeSlotId,TRADE_REWARD_NAMES,type TradeReward} from "../custom-trade-routes";
import {immediateOptions} from "./effects";
import {rewardShieldWorkerGain} from "../shields";

/** Each actual sale advances once; its goods have already left the player's inventory. */
export function advanceCustomTrade(state:GameState,playerId:string,goodsType:DieValue,goodsIds:readonly string[]):GameState{
 const r=state.tradeRoutes?.routes[playerId];if(!r||r.sales.length===r.tileIds.length*3)return state;
 const index=r.sales.length,space=customTradeSpaces(r)[index],slotId=tradeSlotId(playerId,index),match=space.goodsType===goodsType;
 let next:GameState={...state,tradeRoutes:{...state.tradeRoutes!,routes:{...state.tradeRoutes!.routes,[playerId]:{...r,sales:[...r.sales,{goodsType,goodsIds:[...goodsIds],revision:state.revision+1,status:match?"pending":"mismatch"}]}}}};
 if(!match)return next;
 const kind=space.bonusId,source={document:"project-user-rule" as const,pages:[],section:`커스텀 무역로 보상 · ${TRADE_REWARD_NAMES[kind as TradeReward]}`};
 if(kind==="bank"||kind==="boarding-house"||kind==="watchtower"){
  const points=kind==="watchtower"?4:0;
  next={...next,players:next.players.map(p=>p.id===playerId?{...p,silver:p.silver+(kind==="bank"?2:0),workers:p.workers+(kind==="boarding-house"?4:0),victoryPoints:p.victoryPoints+points}:p),scoreLedger:points?{...next.scoreLedger,[playerId]:[...next.scoreLedger[playerId],{id:`${slotId}:points`,category:"extension",extensionId:"trade-routes",points,source}]}:next.scoreLedger};
  next=rewardShieldWorkerGain(next,playerId,kind==="boarding-house"?4:0);
  return settleTradeReward(next,playerId,slotId);
 }
 const effect={id:slotId,playerId,kind:"tile-benefit" as const,source,payload:{kind,tradeSlotId:slotId}};
 return {...next,turn:{...next.turn,pendingEffects:[effect],pendingChoice:{id:slotId,playerId,source,options:immediateOptions(next,next.players.find(p=>p.id===playerId)!,kind as Parameters<typeof immediateOptions>[2],true)}}};
}
