import { shieldLayout, type ShieldAcquireAction } from "./shields";
import { directCost } from "./direct-actions";
import { monasteryNumbers } from "./core/state";
import { resolvePlacement } from "./core/placement";
import type { GameState, PlayerState, GameAction } from "./types";
/** Project heuristic, public information only. All effects/fees still run through the engine. */
export function shieldComputerValue(state:GameState,p:PlayerState,n:number):number{
 const layout=shieldLayout(state)!,remaining=5-"ABCDE".indexOf(state.turn.phase),tiles=p.duchy.cells.flatMap(c=>c.tileId?[state.tiles[c.tileId]]:[]),count=(type:string)=>tiles.filter(t=>t.type===type).length;
 const goods=p.goods.reduce((sum,g)=>sum+g.tiles.length,0),owned=layout.mounted.filter(m=>m.playerId===p.id).length;
 const potential=[0,count("livestock")*2,3,Math.min(p.workers,8),p.storage.filter(Boolean).length*2,goods,Math.max(...state.players.map(other=>monasteryNumbers(state,other).length))*2,3,count("mine")*3,goods*2,count("monastery")*2,count("castle"),goods*2,owned*4,5,5,4,4,6][n];
 return (n<=6?12:n<=12?8:4)+potential*Math.max(0,remaining-1)+Math.max(0,remaining-1)*2;
}
export function shieldExtensionValue(state:GameState,p:PlayerState,a:Extract<GameAction,{type:"extension"}>):number{
 const payload=a.payload as Record<string,unknown>,layout=shieldLayout(state)!;
 if(a.command==="choose-monastery-target"){const target=state.players.find(v=>v.id===payload.targetPlayerId)!;return 500+monasteryNumbers(state,target).filter(n=>n!==27&&!monasteryNumbers(state,p).includes(n)).length*5+(target.id!==p.id?1:0);}
 if(a.command==="change-die"){
  const value=Number(payload.value),die=state.dice.players[p.id].find(d=>d.id===payload.dieId)!;
  const usefulness=(n:number)=>p.duchy.cells.filter(c=>!c.tileId&&c.number===n&&p.storage.some(id=>id&&state.tiles[id].type===c.terrain)).length*5+(p.goods.find(g=>g.type===n)?.tiles.length??0)*3;
  return usefulness(value)>usefulness(die.value)?28+usefulness(value):-120;
 }
 const acquire=a as ShieldAcquireAction,number=layout.slots.find(s=>s.id===acquire.payload.slotId)!.shieldNumber!,old=acquire.payload.replaceShieldNumber;
 return 16+shieldComputerValue(state,p,number)-directCost(state,a)*3-(old?shieldComputerValue(state,p,old)+24:0)-(p.silver===0&&p.workers===0?12:0);
}
export function shieldChoiceValue(state:GameState,p:PlayerState,optionId:string):number|null{
 const option=state.turn.pendingChoice!.options.find(o=>o.id===optionId)!,payload=option.payload as {shieldNumber?:number;pay?:string;tileId?:string;cellId?:string;index?:number;goodsType?:number;shield?:{slotId:string;replaceShieldNumber:number|null}}|null;
 if(payload?.pay&&payload.shieldNumber){const worth=shieldComputerValue(state,p,payload.shieldNumber);return payload.pay==="remove"?-worth:worth-(payload.pay==="worker"?(p.workers>p.silver?1:4):(p.silver>1?2:5));}
 if(payload?.tileId&&payload.cellId){const result=resolvePlacement(state,{...p,storage:[...p.storage,payload.tileId]},payload.tileId,payload.cellId);return 35+result.entries.reduce((n,e)=>n+e.points,0)*2+(result.player.silver-p.silver)*3+(result.player.workers-p.workers);}
 if(optionId.startsWith("discard:")&&payload?.tileId)return -((state.tiles[payload.tileId].type==="castle"?8:4));
 if(optionId.startsWith("shield5:")&&payload?.goodsType)return 10+state.market.numberedDepots.reduce((n,d)=>n+d.goods.filter(g=>g.type===payload.goodsType).length,0)*4;
 if(payload?.shield){const n=shieldLayout(state)!.slots.find(s=>s.id===payload.shield!.slotId)!.shieldNumber!;return 25+shieldComputerValue(state,p,n)-(payload.shield.replaceShieldNumber?shieldComputerValue(state,p,payload.shield.replaceShieldNumber):0);}
 return null;
}
