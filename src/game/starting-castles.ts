import type {GameState} from "./types";
import {VERIFIED_BOARD_DEFINITIONS} from "./boards/catalog";
export interface StartingCastlePreview {readonly playerId:string;readonly cellId:string}
export function validStartingCastlePreview(s:GameState,value:unknown):value is StartingCastlePreview{
 if(!value||typeof value!=='object')return false;const p=value as StartingCastlePreview;
 return typeof p.playerId==='string'&&typeof p.cellId==='string'&&p.playerId===s.turn.activePlayerId&&startingCastleCells(s,p.playerId).includes(p.cellId);
}
export function startingCastlePending(s:GameState,playerId:string):boolean {const p=s.players.find(p=>p.id===playerId);return s.status==="setup"&&!!p&&p.storage[0]===`practice-start:${p.seat}`;}
export function startingCastleCells(s:GameState,playerId:string):readonly string[]{
 const p=s.players.find(p=>p.id===playerId);if(!p||!startingCastlePending(s,playerId))return [];
 return VERIFIED_BOARD_DEFINITIONS.find(b=>b.id===p.duchy.boardId)?.startingCastle.allowedCellIds??p.duchy.cells.filter(c=>c.terrain==="castle").map(c=>c.id);
}
/** Initial physical castles wait in the existing storage; no new save field or hidden random draw. */
export function deferStartingCastles(s:GameState):GameState {
 return {...s,status:"setup",players:s.players.map(p=>({...p,storage:[`practice-start:${p.seat}`,null,null],duchy:{...p.duchy,cells:p.duchy.cells.map(c=>({...c,tileId:null})),completedRegionIds:[],completedColors:[]}})),turn:{...s.turn,stage:"setup",activePlayerId:[...s.turn.orderTrack].sort((a,b)=>b.position-a.position).flatMap(s=>s.players)[0]}};
}
export function validStartingSetup(s:GameState):boolean {
 if(s.status!=="setup")return s.turn.stage!=="setup";
 const pending=s.players.filter(p=>startingCastlePending(s,p.id));
 return pending.length>0&&s.turn.stage==="setup"&&pending.some(p=>p.id===s.turn.activePlayerId)&&s.turn.phase==="A"&&s.turn.round===1&&!s.dice.rolledForRound&&!s.dice.roundGoodsDistributed&&s.dice.whiteDie===null&&!s.turn.pendingChoice&&!s.turn.pendingEffects.length&&!s.turn.castleActions?.length&&!s.turn.actedPlayerIds.length&&s.market.roundGoods.length===5&&s.finalScores===null&&s.players.every(p=>p.victoryPoints===0&&!s.scoreLedger[p.id].length&&(!startingCastlePending(s,p.id)||(p.storage.slice(1).every(id=>id===null)&&s.tiles[p.storage[0]!]?.type==="castle"&&p.duchy.cells.every(c=>c.tileId===null)&&!p.duchy.completedRegionIds.length)));
}
export function placeStartingCastle(s:GameState,playerId:string,cellId:string):GameState {
 const players=s.players.map(p=>{if(p.id!==playerId)return p;const id=p.storage[0]!,cells=p.duchy.cells.map(c=>c.id===cellId?{...c,tileId:id}:c);return {...p,storage:p.storage.map(t=>t===id?null:t),duchy:{...p.duchy,startingCastleCellId:cellId,cells,completedRegionIds:[...new Set(cells.map(c=>c.regionId))].filter(region=>cells.filter(c=>c.regionId===region).every(c=>c.tileId!==null))}};});
 const n={...s,players,config:{...s.config,players:s.config.players.map(p=>p.id===playerId?{...p,startingCastleCellId:cellId}:p)}};
 const order=[...s.turn.orderTrack].sort((a,b)=>b.position-a.position).flatMap(s=>s.players),next=order.find(id=>startingCastlePending(n,id));
 return {...n,status:next?"setup":"playing",turn:{...s.turn,stage:next?"setup":"round-setup",activePlayerId:next??null}};
}
