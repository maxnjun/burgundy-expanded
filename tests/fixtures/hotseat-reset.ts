import {createPracticeSession} from '../../src/game/practice';
import {applyCoreAction,orderedPlayers} from '../../src/game/core';
import {directActions,directShieldActions} from '../../src/game/direct-actions';
import {shieldLayout} from '../../src/game/shields';
import type {GameAction} from '../../src/game/types';

export const resetOptions={officialSlots:true,fullEffects:true,shieldRules:true,vineyards:true,tradeRoutes:true,inns:true,geese:true,whiteCastles:true,additionalHexes:true};
/** Conserved real tiles and legal transitions; extra initial resources exercise every expansion. */
export function finishedHotseat(count:2|3|4=2){
 let game=createPracticeSession({...resetOptions,names:Array.from({length:count},(_,i)=>`이전${i+1}`),boardIds:Array(count).fill('se:base:2'),seed:`reset-old-${count}`});
 game={...game,players:game.players.map(p=>({...p,workers:40,silver:20}))};
 const events={purchase:false,shield:false,vineTake:false,vinePlace:false,sale:false,inn:false},actions:GameAction[]=[];
 for(let i=0;i<700&&game.status!=='finished';i++){
  const id=game.turn.activePlayerId??orderedPlayers(game)[0],all=directActions(game,id);
  let action:GameAction|undefined;
  if(game.turn.pendingChoice)action=all.find(a=>a.type==='resolve-choice'&&a.optionId==='skip')??all.find(a=>a.type==='resolve-choice');
  if(!action&&!events.purchase)action=all.find(a=>a.type==='buy-black-tile'&&game.tiles[a.tileId].type!=='inn');
  if(!action&&!events.shield)for(const slot of shieldLayout(game)?.slots??[]){action=directShieldActions(game,id,slot.id)[0];if(action)break;}
  if(!action&&!events.vineTake)action=all.find(a=>a.type==='use-die'&&a.intent.kind==='vineyard'&&a.intent.command==='take');
  if(!action&&!events.vinePlace)action=all.find(a=>a.type==='use-die'&&a.intent.kind==='vineyard'&&a.intent.command==='place');
  if(!action&&!events.sale)action=all.find(a=>a.type==='use-die'&&a.intent.kind==='sell-goods');
  if(!action&&!events.inn)action=all.find(a=>a.type==='buy-black-tile'&&game.tiles[a.tileId].type==='inn');
  action??=all.find(a=>a.type==='use-die'&&a.intent.kind==='take-workers')??all.find(a=>a.type==='end-turn')??all[0];
  if(!action)throw Error('No reset fixture action '+JSON.stringify(game.turn));
  if(action.type==='buy-black-tile')events[game.tiles[action.tileId].type==='inn'?'inn':'purchase']=true;
  if(action.type==='extension'&&action.extensionId==='shields')events.shield=true;
  if(action.type==='use-die'){if(action.intent.kind==='vineyard')events[action.intent.command==='take'?'vineTake':'vinePlace']=true;if(action.intent.kind==='sell-goods')events.sale=true;}
  const next=applyCoreAction(game,action);if(!next.ok)throw Error(JSON.stringify(next.issues));game=next.value.state;actions.push(action);
 }
 if(game.status!=='finished'||Object.values(events).some(v=>!v))throw Error('Incomplete reset fixture '+JSON.stringify(events));
 return {game,events,actions};
}
