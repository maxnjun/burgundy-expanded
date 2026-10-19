import { listCoreActionOptions, validateCoreAction } from "./core/engine";
import { orderedPlayers } from "./core/state";
import { shieldLayout, shieldWorkerSteps, shieldWorkerCost, type ShieldAcquireAction } from "./shields";
import type { ActionIntent, GameAction, GameState } from "./types";

export type DieAction = Extract<GameAction,{type:"use-die"}>;
/** Only engine-validated actions; selection and preview never mutate state. */
export function directActions(game:GameState,playerId:string):readonly GameAction[]{
 const result=listCoreActionOptions(game,playerId);return result.ok?result.value.actions:[];
}
export function cheapestDieAction(actions:readonly GameAction[],dieId:string|undefined,match:(intent:ActionIntent)=>boolean):DieAction|null{
 return actions.filter((a):a is DieAction=>a.type==="use-die"&&a.dieId===dieId&&match(a.intent)).sort((a,b)=>a.adjustment.workersSpent-b.adjustment.workersSpent||a.adjustment.steps.length-b.adjustment.steps.length)[0]??null;
}
export function directShieldActions(game:GameState,playerId:string,slotId:string):readonly ShieldAcquireAction[]{
 if(game.status!=="playing"||game.turn.stage!=="player-turn"||game.turn.activePlayerId!==playerId||game.turn.pendingChoice||game.turn.pendingEffects.length||game.dice.players[playerId]?.some(d=>d.used))return [];
 const layout=shieldLayout(game),slot=layout?.slots.find(s=>s.id===slotId&&s.shieldNumber!==null),p=game.players.find(p=>p.id===playerId);if(!slot||!p)return [];
 const steps=game.dice.players[playerId].map(d=>shieldWorkerSteps(d.value,slot.depot)) as [readonly (1|-1)[],readonly (1|-1)[]];
 return p.duchy.cells.filter(c=>c.tileId&&game.tiles[c.tileId].type==="castle").map(c=>({type:"extension" as const,extensionId:"shields" as const,command:layout!.effectsActive?"acquire":"acquire-preview",playerId,payload:{slotId,castleCellId:c.id,steps,replaceShieldNumber:layout!.mounted.find(m=>m.playerId===playerId&&m.cellId===c.id)?.shieldNumber??null}})).filter(a=>validateCoreAction(game,a).valid);
}
export function directCost(game:GameState,action:GameAction):number{
 if(action.type==="use-die")return action.adjustment.workersSpent;
 if(action.type==="use-monastery-six")return 2;
 if(action.type==="extension"&&action.extensionId==="shields"&&["acquire","acquire-preview"].includes(action.command))return (action as ShieldAcquireAction).payload.steps.reduce((n,s)=>n+shieldWorkerCost(game,action.playerId,s),0);
 return 0;
}
/** Preserve optional purchases after both dice; never pass a pending mandatory choice. */
export function automaticAction(game:GameState,actions:readonly GameAction[]):GameAction|null{
 if(game.status!=="playing"||game.turn.pendingChoice||game.turn.pendingEffects.length)return null;
 const playerId=game.turn.activePlayerId??orderedPlayers(game)[0];
 if(game.turn.stage==="round-setup"||game.turn.stage==="phase-end")return actions.find(a=>a.playerId===playerId&&(a.type==="roll-round"||a.type==="advance-phase"))??null;
 if(actions.some(a=>(a.type==="extension"&&a.extensionId==="vineyards")||a.type==="buy-black-tile"||a.type==="use-monastery-six"||a.type==="buy-workers"))return null;
 return actions.find(a=>a.type==="end-turn")??null;
}
