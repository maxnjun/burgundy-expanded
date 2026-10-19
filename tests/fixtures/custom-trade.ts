import {createPracticeSession} from "../../src/game/practice";
import {applyCoreAction} from "../../src/game/core";
import {CUSTOM_TRADE_CATALOG,type TradeReward} from "../../src/game/custom-trade-routes";
import {areAxialNeighbors} from "../../src/game/boards/axial";
import type {GameAction,GameState,Tile} from "../../src/game/types";

/** TEST FIXTURE: control route order/resources/hand on unchanged registered boards. */
export function tradeFixture(reward:TradeReward="bank",count:2|3|4=2):GameState{
 let game=createPracticeSession({names:Array.from({length:count},(_,i)=>`무역${i+1}`),boardIds:Array(count).fill("se:base:2"),seed:"custom-trade-fixture",tradeRoutes:true,officialSlots:true});
 const rolled=applyCoreAction(game,{type:"roll-round",playerId:"seat-1"});if(!rolled.ok)throw Error(JSON.stringify(rolled));game=rolled.value.state;
 const trade=structuredClone(game.tradeRoutes!),wanted=CUSTOM_TRADE_CATALOG.find(t=>t.spaces[0].bonusId===reward)!,first=trade.routes['seat-1'].tileIds[0];
 const swap=(ids:readonly string[])=>ids.map(id=>id===wanted.id?first:id===first?wanted.id:id);
 const routes=Object.fromEntries(Object.entries(trade.routes).map(([id,r])=>[id,{...r,tileIds:swap(r.tileIds)}]));
 const type=wanted.spaces[0].goodsType,other=(type===6?1:type+1) as 1|2|3|4|5|6;
 game={...game,tradeRoutes:{...trade,routes,unusedTileIds:swap(trade.unusedTileIds)},players:game.players.map((p,i)=>i?p:{...p,silver:30,workers:30,goods:[{type,tiles:p.goods.flatMap(g=>g.tiles).map(g=>({...g,type}))},{type:other,tiles:[{id:"TEST-EXTRA-GOOD",type:other}]}]}),dice:{...game.dice,players:{...game.dice.players,'seat-1':[{...game.dice.players['seat-1'][0],value:type},game.dice.players['seat-1'][1]]}}};
 if(reward==="town-hall"){
  const p=game.players[0],target=p.duchy.cells.find(c=>!c.tileId&&p.duchy.cells.some(n=>n.tileId&&areAxialNeighbors(c.coord,n.coord)))!,prototype=Object.values(game.tiles).find(t=>t.type===target.terrain)!;
  const tile:Tile={...prototype,id:"TEST-TRADE-STASH"};game={...game,tiles:{...game.tiles,[tile.id]:tile},players:game.players.map((p,i)=>i?p:{...p,storage:[tile.id,null,null]})};
 }
 return game;
}
export function directSale(game:GameState):GameAction{
 return {type:"use-die",playerId:"seat-1",dieId:game.dice.players['seat-1'][0].id,adjustment:{steps:[],workersSpent:0},intent:{kind:"sell-goods",goodsType:game.dice.players['seat-1'][0].value}};
}
export function tradeStep(game:GameState,action:GameAction):GameState{const r=applyCoreAction(game,action);if(!r.ok)throw Error(JSON.stringify(r.issues));return r.value.state;}
