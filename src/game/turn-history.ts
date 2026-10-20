import type { GameAction, GameState } from './types';

export interface TurnSnapshot { readonly game:GameState;readonly logs:readonly string[] }
export interface TurnHistory {readonly key:string|null;readonly start:TurnSnapshot|null;readonly past:readonly TurnSnapshot[]}
export function turnKey(game:GameState):string|null {
 return game.status==='playing'&&game.turn.stage==='player-turn'&&game.turn.activePlayerId
  ? JSON.stringify([game.config.seed,game.turn.phase,game.turn.round,game.turn.activePlayerId,game.turn.actedPlayerIds]):null;
}
const snapshot=(game:GameState,logs:readonly string[]):TurnSnapshot=>structuredClone({game,logs});
/** Imported checkpoints have no trustworthy start-of-turn snapshot. File format stays unchanged. */
export function beginHistory(game:GameState,logs:readonly string[],knownStart=false):TurnHistory{
 const key=turnKey(game);return {key,start:key&&knownStart?snapshot(game,logs):null,past:[]};
}
/** A die action and every mandatory child choice form one undo unit. */
export function recordTurnAction(history:TurnHistory,before:GameState,after:GameState,action:GameAction,logs:readonly string[],nextLogs:readonly string[]):TurnHistory{
 const key=turnKey(before),next=turnKey(after);
 if(key!==next||action.type==='end-turn')return beginHistory(after,nextLogs,true);
 if(!key||action.playerId!==before.turn.activePlayerId)return beginHistory(after,nextLogs);
 const current=history.key===key?history:beginHistory(before,logs);
 if(before.turn.pendingChoice||before.turn.pendingEffects.length)return current;
 return {...current,past:[...current.past,snapshot(before,logs)]};
}
export function canUndoTurn(history:TurnHistory,game:GameState,kind:'turn'|'action'):boolean{
 return !!history.key&&history.key===turnKey(game)&&history.past.length>0&&!game.turn.pendingChoice&&!game.turn.pendingEffects.length&&(kind==='action'||!!history.start);
}
export function undoTurn(history:TurnHistory,game:GameState,kind:'turn'|'action'): {snapshot:TurnSnapshot;history:TurnHistory}|null{
 if(!canUndoTurn(history,game,kind))return null;
 const target=kind==='turn'?history.start:history.past.at(-1);
 if(!target)return null;
 return {snapshot:structuredClone(target),history:{...history,past:kind==='turn'?[]:history.past.slice(0,-1)}};
}
