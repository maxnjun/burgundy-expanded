import type {GameState} from './types';
import {beginHistory,turnKey,type TurnHistory,type TurnSnapshot} from './turn-history';
import {parseSavedGame} from './save';
import {isCastleAction} from './castle-actions';

export function serializeTurnHistory(game:GameState,logs:readonly string[],history:TurnHistory):string {
 const text=JSON.stringify({game,logs,history});
 if(text.length>4_000_000)throw new Error('되돌리기 기록의 자동 저장 용량을 초과했습니다. 현재 게임 저장은 유지됩니다.');
 return text;
}
/** A sidecar preserves the existing save-file format; stale or invalid history is never attached. */
export function restoreTurnHistory(text:string|null,game:GameState,logs:readonly string[]):TurnHistory {
 const fallback=beginHistory(game,logs);
 try{
  if(!text||text.length>4_000_000)return fallback;
  const cached=JSON.parse(text),h=cached?.history as TurnHistory;
  if(JSON.stringify(cached.game)!==JSON.stringify(game)||JSON.stringify(cached.logs)!==JSON.stringify(logs)||!h||h.key!==turnKey(game)||!Array.isArray(h.past)||h.past.length>128)return fallback;
  function checked(value:TurnSnapshot):TurnSnapshot {
   const s=parseSavedGame(JSON.stringify({format:'burgundy-local-v1',randomAlgorithm:'counter-v1',game:value.game,logs:value.logs,view:{zoom:1,focus:false,table:true,boardZooms:{}}}));
   if(!h.key||turnKey(s.game)!==h.key||JSON.stringify(s.game.config)!==JSON.stringify(game.config)||s.game.revision>game.revision||((s.game.turn.pendingChoice||s.game.turn.pendingEffects.length)&&!isCastleAction(s.game)))throw new Error('Mismatched turn snapshot');
   return {game:s.game,logs:s.logs};
  }
  const start=h.start===null?null:checked(h.start),past=h.past.map(checked);
  if(past.some((s,i)=>s.game.revision>=game.revision||i>0&&s.game.revision<=past[i-1].game.revision)||start&&past.some(s=>s.game.revision<start.game.revision))return fallback;
  return {key:h.key,start,past};
 }catch{return fallback;}
}
