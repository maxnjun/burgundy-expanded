import { listCoreActionOptions, validateCoreAction } from "./core/engine";
import { orderedPlayers } from "./core/state";
import { shieldLayout, shieldWorkerSteps, shieldWorkerCost, type ShieldAcquireAction } from "./shields";
import type { ActionIntent, GameAction, GameState,TileType } from "./types";
import {isCastleAction} from './castle-actions';
import {automaticVineReward} from './core/vineyard-effects';
import {shieldPhaseTileSource,type BonusShieldTarget} from './core/shield-effects';
import type {VineIntent} from './vineyards';
import {previewRecolor,type RecolorTarget} from './core/territory';

export interface PhaseTileTarget {source:'numbered'|'black';tileId:string;cellId:string}
export interface RecolorPreview extends RecolorTarget {from:TileType;previousSizes:readonly number[];size:number;reopenedSizes:readonly number[];refund:number;sourceSize:number;sourceAfter:readonly number[]}
export interface BoardTarget {blackTile?:{tileId:string;storageSlot:number;discardTileId?:string};intent?:ActionIntent;goods?:{depot:number;goodsIds:readonly string[]};shield?:BonusShieldTarget;phaseTile?:PhaseTileTarget;recolor?:RecolorPreview;goodsDiscardType?:number;storageDiscardId?:string}
/** Public click targets are projections of canonical engine options, never executable UI payloads. */
export function boardTarget(game:GameState,action:GameAction):BoardTarget {
 if(action.type==='use-die')return {intent:action.intent};
 if(action.type==='extension'&&action.extensionId==='vineyards')return {intent:action.payload as unknown as VineIntent};
 if(action.type==='extension'&&action.extensionId==='additional-hexes'&&action.command==='recolor'){
  const p=game.players.find(p=>p.id===action.playerId)!,target=action.payload as RecolorTarget;
  const result=previewRecolor(game,p,target);
  return {recolor:{...target,from:result.old.terrain,previousSizes:result.previousSizes,size:result.connected.length,reopenedSizes:result.reopenedSizes,refund:result.points,sourceSize:result.sourceSize,sourceAfter:result.sourceAfter}};
 }
 if(action.type!=='resolve-choice')return {};
 const p=game.turn.pendingChoice?.options.find(o=>o.id===action.optionId)?.payload as {vineBlack?:BoardTarget['blackTile'];intent?:ActionIntent;depot?:number;goodsIds?:readonly string[];shield?:BoardTarget['shield'];shieldNumber?:number;tileId?:string;cellId?:string;goodsDiscardType?:number}|null;
 const source=p?.shieldNumber===undefined?undefined:shieldPhaseTileSource(game,p.shieldNumber);
 const storageDiscardId=game.turn.pendingChoice?.id.includes(':shield-storage:')?p?.tileId:undefined;
 return {blackTile:p?.vineBlack,intent:p?.intent,shield:p?.shield,...(p?.goodsDiscardType?{goodsDiscardType:p.goodsDiscardType}:{}),...(storageDiscardId?{storageDiscardId}:{}),...(source&&p?.tileId&&p.cellId?{phaseTile:{source,tileId:p.tileId,cellId:p.cellId}}:{}),...(p?.depot!==undefined&&p.goodsIds?{goods:{depot:p.depot,goodsIds:p.goodsIds}}:{})};
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
 if(game.status!=="playing"||game.turn.stage!=="player-turn"||game.turn.activePlayerId!==playerId||game.turn.pendingChoice||game.turn.pendingEffects.length||game.dice.players[playerId]?.filter(d=>!d.used).length<2)return [];
 const layout=shieldLayout(game),slot=layout?.slots.find(s=>s.id===slotId&&s.shieldNumber!==null),p=game.players.find(p=>p.id===playerId);if(!slot||!p)return [];
 const dice=game.dice.players[playerId],pairs=dice.flatMap((first,i)=>dice.slice(i+1).filter(second=>!first.used&&!second.used).map(second=>[first,second] as const));
 return p.duchy.cells.filter(c=>c.tileId&&game.tiles[c.tileId].type==="castle").flatMap(c=>pairs.map(([first,second]):ShieldAcquireAction=>({type:"extension",extensionId:"shields",command:layout!.effectsActive?"acquire":"acquire-preview",playerId,payload:{slotId,castleCellId:c.id,steps:[shieldWorkerSteps(first.value,slot.depot),shieldWorkerSteps(second.value,slot.depot)],...(dice.length===3?{dieIds:[first.id,second.id]}:{}),replaceShieldNumber:layout!.mounted.find(m=>m.playerId===playerId&&m.cellId===c.id)?.shieldNumber??null}}))).filter(a=>validateCoreAction(game,a).valid);
}
export function directCost(game:GameState,action:GameAction):number{
 if(action.type==="use-die")return action.adjustment.workersSpent;
 if(action.type==='resolve-choice'){const p=game.turn.pendingChoice?.options.find(o=>o.id===action.optionId)?.payload as {adjustment?:{workersSpent:number};shield?:BonusShieldTarget}|null;return p?.shield?.steps?p.shield.steps.reduce((n,s)=>n+shieldWorkerCost(game,action.playerId,s),0):p?.adjustment?.workersSpent??0;}
 if(action.type==="use-monastery-six")return 2;
 if(action.type==="extension"&&action.extensionId==="shields"&&["acquire","acquire-preview"].includes(action.command))return (action as ShieldAcquireAction).payload.steps.reduce((n,s)=>n+shieldWorkerCost(game,action.playerId,s),0);
 return 0;
}
export function phaseAdvanceAction(game:GameState):Extract<GameAction,{type:"advance-phase"}>|null{
 if(game.status!=="playing"||game.turn.stage!=="phase-end"||game.turn.pendingChoice||game.turn.pendingEffects.length)return null;
 return {type:"advance-phase",playerId:orderedPlayers(game)[0]};
}

/** Human turns and dice rolls wait for input; fixed rewards and phase settlement are automatic. */
export function automaticAction(game:GameState,actions:readonly GameAction[]):GameAction|null{
 const reward=automaticVineReward(game,actions);if(reward)return actions.find(a=>a.type==='resolve-choice'&&a.choiceId===reward.choiceId&&a.optionId===reward.optionId)??null;
 const advance=phaseAdvanceAction(game);
 return advance?actions.find(a=>a.type==="advance-phase"&&a.playerId===advance.playerId)??null:null;
}
