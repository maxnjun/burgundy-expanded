import type {DieValue,GameState,GoodsTile} from "./types";
import {drawDie} from "./core/random";

/** PDF pp.3,14. No production catalog: the twelve physical fronts remain unverified. */
export interface TradeRouteTile {
 readonly id:string;
 readonly spaces:readonly [TradeRouteSlot,TradeRouteSlot,TradeRouteSlot];
}
export interface TradeRouteSlot {readonly goodsType:DieValue;readonly bonusId:string}
export interface TradeRouteState {
 readonly tileIds:readonly string[];
 /** Ordered prefix on the route, then the ordinary sold-goods pile after it fills. */
 readonly placedGoods:readonly GoodsTile[];
 readonly overflowGoods:readonly GoodsTile[];
 /** Matches only, NOT proof that an unresolved bonus was granted. */
 readonly matchedSpaceIds:readonly string[];
}
export const VERIFIED_TRADE_ROUTE_CATALOG:readonly TradeRouteTile[]=Object.freeze([]);
export const tradeTilesPerPlayer=(players:number)=>{
 if(![2,3,4].includes(players))throw new Error("Trade routes require2–4 players");
 return players===2?5:players===3?4:3;
};
function validCatalog(catalog:readonly TradeRouteTile[]):boolean{
 return catalog.length===12&&new Set(catalog.map(t=>t.id)).size===12&&catalog.every(t=>typeof t.id==="string"&&!!t.id&&t.id.length<=100&&Array.isArray(t.spaces)&&t.spaces.length===3&&t.spaces.every(s=>Number.isInteger(s.goodsType)&&s.goodsType>=1&&s.goodsType<=6&&typeof s.bonusId==="string"&&!!s.bonusId&&s.bonusId.length<=100));
}
/** Uniform Fisher–Yates using the existing counter-v1 stream; no replacement. */
export function prepareTradeRoutes(playerIds:readonly string[],catalog:readonly TradeRouteTile[],random:GameState["random"]){
 const count=tradeTilesPerPlayer(playerIds.length);
 if(new Set(playerIds).size!==playerIds.length||playerIds.some(id=>!id))throw new Error("Duplicate/empty trade-route player");
 if(!validCatalog(catalog))throw new Error("Complete twelve-tile trade route catalog is required");
 const deck=catalog.map(t=>t.id);let cursor=random;
 for(let i=deck.length-1;i>0;i--){
  let range:number,value:number;
  do{range=1;value=0;while(range<i+1){const die=drawDie(cursor);cursor=die.random;range*=6;value=value*6+die.value-1;}}while(value>=range-range%(i+1));
  const j=value%(i+1);[deck[i],deck[j]]=[deck[j],deck[i]];
 }
 const routes=Object.fromEntries(playerIds.map((id,i)=>[id,{tileIds:deck.slice(i*count,(i+1)*count),placedGoods:[],overflowGoods:[],matchedSpaceIds:[]} satisfies TradeRouteState]));
 return {routes,unusedTileIds:deck.slice(playerIds.length*count),random:cursor};
}
export function tradeRouteSpaces(route:TradeRouteState,catalog:readonly TradeRouteTile[]){
 return route.tileIds.flatMap(id=>{const tile=catalog.find(t=>t.id===id);if(!tile)throw new Error("Unknown trade route tile");return tile.spaces.map((slot,i)=>({...slot,id:`${id}:${i}`}));});
}
/** Typed-state validator; live save parsing must also bind the route to the server catalog. */
export function validTradeRoute(route:TradeRouteState,catalog:readonly TradeRouteTile[],playerCount:2|3|4):boolean{
 try{
  if(!validCatalog(catalog)||route.tileIds.length!==tradeTilesPerPlayer(playerCount)||new Set(route.tileIds).size!==route.tileIds.length)return false;
  const spaces=tradeRouteSpaces(route,catalog),all=[...route.placedGoods,...route.overflowGoods];
  if(route.placedGoods.length>spaces.length||(route.overflowGoods.length>0&&route.placedGoods.length!==spaces.length)||new Set(all.map(g=>g.id)).size!==all.length||all.some(g=>!g.id||!Number.isInteger(g.type)||g.type<1||g.type>6))return false;
  const matches=route.placedGoods.flatMap((g,i)=>g.type===spaces[i].goodsType?[spaces[i].id]:[]);
  return matches.length===route.matchedSpaceIds.length&&matches.every((id,i)=>id===route.matchedSpaceIds[i]);
 }catch{return false;}
}
/** Confirmed movement only. The caller must resolve the returned bonuses atomically.
 * No bonus values/effects are inferred and no live GameAction calls this yet.
 */
export function progressTradeRoute(route:TradeRouteState,sold:readonly GoodsTile[],catalog:readonly TradeRouteTile[],playerCount:2|3|4){
 if(!validTradeRoute(route,catalog,playerCount))throw new Error("Invalid trade route state");
 const owned=new Set([...route.placedGoods,...route.overflowGoods].map(g=>g.id));
 if(!sold.length||new Set(sold.map(g=>g.type)).size!==1||new Set(sold.map(g=>g.id)).size!==sold.length||sold.some(g=>!g.id||owned.has(g.id)||!Number.isInteger(g.type)||g.type<1||g.type>6))throw new Error("Expected one new sold goods stack");
 const spaces=tradeRouteSpaces(route,catalog),placed=[...route.placedGoods],overflow=[...route.overflowGoods],matched=[...route.matchedSpaceIds];
 const bonuses:{spaceId:string;goodsId:string;bonusId:string}[]=[];
 for(const good of sold){
  if(placed.length===spaces.length){overflow.push({...good});continue;}
  const space=spaces[placed.length];placed.push({...good});
  if(good.type===space.goodsType){matched.push(space.id);bonuses.push({spaceId:space.id,goodsId:good.id,bonusId:space.bonusId});}
 }
 return {route:{tileIds:[...route.tileIds],placedGoods:placed,overflowGoods:overflow,matchedSpaceIds:matched} satisfies TradeRouteState,bonuses};
}
