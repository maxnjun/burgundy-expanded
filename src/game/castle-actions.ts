import type {GameState, PendingEffect} from './types';

/** Only an actual castle benefit may wait; a started ship/building/vineyard choice may not. */
export function isCastleAction(game:GameState):boolean {
 const e=game.turn.pendingEffects[0],p=e?.payload as {kind?:string;tileId?:string;vineRewardId?:string;tradeSlotId?:string}|null;
 return game.turn.stage==='player-turn'&&!game.vineyards?.stack.length&&game.turn.pendingEffects.length===1&&!!game.turn.pendingChoice&&e.id===game.turn.pendingChoice.id&&e.playerId===game.turn.activePlayerId&&p?.kind==='castle'&&!p.vineRewardId&&!p.tradeSlotId&&!!p.tileId&&game.tiles[p.tileId]?.type==='castle';
}
export function suspendCastleAction(game:GameState):GameState {
 if(!isCastleAction(game))return game;
 return {...game,turn:{...game.turn,castleActions:[...(game.turn.castleActions??[]),game.turn.pendingEffects[0]],pendingChoice:null,pendingEffects:[]}};
}
export function validCastleActions(game:GameState):boolean {
 const waiting=game.turn.castleActions;
 if(waiting===undefined)return true;
 if(!Array.isArray(waiting)||waiting.length>game.players.reduce((n,p)=>n+p.duchy.cells.length,0))return false;
 const ids=new Set<string>(),tiles=new Set<string>();
 const valid=(e:PendingEffect)=>{
  const p=e?.payload as {kind?:string;tileId?:string}|null;
  if(!e||typeof e.id!=='string'||e.kind!=='tile-benefit'||e.playerId!==game.turn.activePlayerId||p?.kind!=='castle'||typeof p.tileId!=='string'||game.tiles[p.tileId]?.type!=='castle'||!game.players.find(x=>x.id===e.playerId)?.duchy.cells.some(c=>c.tileId===p.tileId)||e.id!==`core:${Number(e.id.split(':')[1])}:benefit:${p.tileId}`||!Number.isSafeInteger(Number(e.id.split(':')[1]))||Number(e.id.split(':')[1])>game.revision||!e.source||e.source.section!=='성 · 자유 추가 행동'||ids.has(e.id)||tiles.has(p.tileId))return false;
  ids.add(e.id);tiles.add(p.tileId);return true;
 };
 const current=game.turn.pendingEffects[0],p=current?.payload as {kind?:string;tileId?:string}|null;
 const castle=!!p?.tileId&&p.kind==='castle'&&game.tiles[p.tileId]?.type==='castle';
 return (!waiting.length||game.status==='playing'&&game.turn.stage==='player-turn')&&waiting.every(valid)&&(!waiting.length||!castle||valid(current));
}
