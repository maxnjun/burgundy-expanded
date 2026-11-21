import type {BoardTarget} from './direct-actions';
import type {GameAction} from './types';

export const vineyardDiscardGuidance='저장고가 가득 찼습니다. 버릴 타일을 선택하세요.';
export type BoardChoiceDraft=
 | {kind:'phase-tile';revision:number;tileId:string}
 | {kind:'vine-discard';revision:number;tileId:string;group:string;discardIds:readonly string[]};
type Option={action:GameAction;target:BoardTarget};

export function validBoardChoice(value:unknown):value is BoardChoiceDraft {
 if(!value||typeof value!=='object')return false;
 const draft=value as Partial<BoardChoiceDraft>;
 const id=(x:unknown)=>typeof x==='string'&&x.length>0&&x.length<=200;
 if(!Number.isSafeInteger(draft.revision)||!id(draft.tileId))return false;
 return draft.kind==='phase-tile'||draft.kind==='vine-discard'&&id(draft.group)&&
  Array.isArray(draft.discardIds)&&draft.discardIds.length<=2&&draft.discardIds.every(id)&&new Set(draft.discardIds).size===draft.discardIds.length;
}

function vineGroup(action:GameAction) {
 if(action.type==='use-die')return action.dieId;
 if(action.type==='resolve-choice')return action.choiceId;
 return 'paid-store';
}

export function startVineDiscard(action:GameAction,target:BoardTarget,revision:number):BoardChoiceDraft|null {
 const intent=target.intent;
 return intent?.kind==='vineyard'&&intent.command==='take'&&intent.discardIds?.length
  ?{kind:'vine-discard',tileId:intent.tileId,revision,group:vineGroup(action),discardIds:[]}:null;
}

export function boardChoice(options:readonly Option[],draft:BoardChoiceDraft|null,revision:number) {
 const phaseTiles=options.flatMap(({action,target})=>target.phaseTile?[{action,cost:0,...target.phaseTile}]:[]);
 const sources=new Set(phaseTiles.map(t=>t.source));
 const selected= draft?.kind==='phase-tile'&&draft.revision===revision&&phaseTiles.some(t=>t.tileId===draft.tileId)?draft.tileId:null;
 const placements=phaseTiles.filter(t=>t.tileId===selected);
 const shieldGuidance=selected?'배치할 곳을 선택하세요.':sources.size===2?'번호 타일 또는 검은 타일을 선택하세요.':
  sources.has('numbered')?'번호 타일 중 원하는 타일을 선택하세요.':sources.has('black')?'검은 타일 중 원하는 타일을 선택하세요.':null;
 const vineDraft=draft?.kind==='vine-discard'&&draft.revision===revision?draft:null;
 const vineOptions=vineDraft?options.flatMap(({action,target})=>{
  const intent=target.intent;
  return intent?.kind==='vineyard'&&intent.command==='take'&&intent.tileId===vineDraft.tileId&&
   vineGroup(action)===vineDraft.group&&intent.discardIds?.length?[{action,ids:intent.discardIds}]:[];
 }):[];
 const vine=vineDraft&&vineOptions.length&&vineOptions.some(o=>vineDraft.discardIds.every(id=>o.ids.includes(id)))?vineDraft:null;
 const discardable=vine?new Set(vineOptions.filter(o=>vine.discardIds.every(id=>o.ids.includes(id))).flatMap(o=>o.ids)):undefined;
 const vineAction=vine?vineOptions.find(o=>o.ids.length===vine.discardIds.length&&vine.discardIds.every(id=>o.ids.includes(id)))?.action:undefined;
 function discard(id:string){
  if(!vine||!discardable?.has(id))return null;
  const discardIds=vine.discardIds.includes(id)?vine.discardIds.filter(x=>x!==id):[...vine.discardIds,id];
  return {...vine,discardIds};
 }
 return {phaseTiles,placements,selected,shieldGuidance,vine,vineAction,discardable,discard};
}
