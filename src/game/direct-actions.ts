import { listCoreActionOptions, validateCoreAction } from "./core/engine";
import { orderedPlayers } from "./core/state";
import { shieldLayout, shieldWorkerSteps, shieldWorkerCost, type ShieldAcquireAction } from "./shields";
import type { ActionIntent, GameAction, GameState } from "./types";
import {isCastleAction} from './castle-actions';
import {automaticVineReward} from './core/vineyard-effects';

export interface BoardTarget {blackTile?:{tileId:string;storageSlot:number;discardTileId?:string};intent?:ActionIntent;goods?:{depot:number;goodsIds:readonly string[]};shield?:{slotId:string;castleCellId:string;replaceShieldNumber:number|null}}
/** Public click targets are projections of canonical engine options, never executable UI payloads. */
export function boardTarget(game:GameState,action:GameAction):BoardTarget {
 if(action.type==='use-die')return {intent:action.intent};
 if(action.type!=='resolve-choice')return {};
 const p=game.turn.pendingChoice?.options.find(o=>o.id===action.optionId)?.payload as {vineBlack?:BoardTarget['blackTile'];intent?:ActionIntent;depot?:number;goodsIds?:readonly string[];shield?:BoardTarget['shield']}|null;
 return {blackTile:p?.vineBlack,intent:p?.intent,shield:p?.shield,...(p?.depot!==undefined&&p.goodsIds?{goods:{depot:p.depot,goodsIds:p.goodsIds}}:{})};
}
export function directBoardAction(game:GameState,actions:readonly GameAction[],dieId:string|undefined,match:(intent:ActionIntent)=>boolean):GameAction|null {
 if(dieId&&(!game.turn.pendingChoice||isCastleAction(game)))return cheapestDieAction(actions,dieId,match);
 return actions.filter(a=>a.type==='resolve-choice'&&!!boardTarget(game,a).intent&&match(boardTarget(game,a).intent!)).sort((a,b)=>directCost(game,a)-directCost(game,b))[0]??null;
}

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
 if(action.type==='resolve-choice')return (game.turn.pendingChoice?.options.find(o=>o.id===action.optionId)?.payload as {adjustment?:{workersSpent:number}}|null)?.adjustment?.workersSpent??0;
 if(action.type==="use-monastery-six")return 2;
 if(action.type==="extension"&&action.extensionId==="shields"&&["acquire","acquire-preview"].includes(action.command))return (action as ShieldAcquireAction).payload.steps.reduce((n,s)=>n+shieldWorkerCost(game,action.playerId,s),0);
 return 0;
}
/** Human turns end manually; setup and fixed rewards are automatic. */
export function automaticAction(game:GameState,actions:readonly GameAction[]):GameAction|null{
 const reward=automaticVineReward(game,actions);if(reward)return actions.find(a=>a.type==='resolve-choice'&&a.choiceId===reward.choiceId&&a.optionId===reward.optionId)??null;
 if(game.status!=="playing"||game.turn.pendingChoice||game.turn.pendingEffects.length)return null;
 const playerId=game.turn.activePlayerId??orderedPlayers(game)[0];
 if(game.turn.stage==="round-setup"||game.turn.stage==="phase-end")return actions.find(a=>a.playerId===playerId&&(a.type==="roll-round"||a.type==="advance-phase"))??null;
 return null;
}
