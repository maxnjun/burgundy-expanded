import type {GameState} from './types';

/** Observe the existing removal lists only after a complete phase transition succeeds. */
export function recordPhaseDiscards(before:GameState,after:GameState):GameState{
 const oldTiles=new Set(before.market.removedTileIds),oldVines=new Set(before.vineyards?.removed??[]);
 return {...after,discardedTiles:[...(before.discardedTiles??[]),{
  phase:before.turn.phase,
  tileIds:after.market.removedTileIds.filter(id=>!oldTiles.has(id)),
  vineyardTileIds:(after.vineyards?.removed??[]).filter(id=>!oldVines.has(id)),
 }]};
}

export function validDiscardedTiles(state:GameState):boolean{
 const history=state.discardedTiles;if(history===undefined)return true;
 if(!Array.isArray(history)||history.length>5)return false;
 const tiles=new Set<string>(),vines=new Set<string>();let previous='';
 for(const entry of history){
  if(!entry||!['A','B','C','D','E'].includes(entry.phase)||entry.phase<=previous||entry.phase>state.turn.phase||
   entry.phase===state.turn.phase&&!(state.status==='finished'&&entry.phase==='E')||!Array.isArray(entry.tileIds)||!Array.isArray(entry.vineyardTileIds))return false;
  previous=entry.phase;
  for(const id of entry.tileIds){
   if(typeof id!=='string'||!Object.hasOwn(state.tiles,id)||!state.market.removedTileIds.includes(id)||tiles.has(id))return false;
   tiles.add(id);
  }
  for(const id of entry.vineyardTileIds){
   if(typeof id!=='string'||!state.vineyards?.removed.includes(id)||vines.has(id))return false;
   vines.add(id);
  }
 }
 return true;
}
