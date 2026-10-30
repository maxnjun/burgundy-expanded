import {createPracticeSession} from '../../src/game/practice';
import {applyCoreAction,orderedPlayers} from '../../src/game/core';
import {serializeSavedGame} from '../../src/game/save';
import {boundary} from './shields';
import type {GameState} from '../../src/game/types';

/** Real phase refills/final scoring; skip round play only to reach each boundary. */
export function vineyardPhases():GameState[]{
 let g=createPracticeSession({names:['공급 확인1','공급 확인2'],seed:'android-vine-supply',vineyards:true,officialSlots:true,fullEffects:true});
 const states=[g];
 for(let i=0;i<5;i++){
  const next=applyCoreAction(boundary(g),{type:'advance-phase',playerId:orderedPlayers(g)[0]});
  if(!next.ok)throw Error(JSON.stringify(next.issues));g=next.value.state;states.push(g);
 }
 return states;
}
export function vineyardSave(game:GameState,commonZoom=1){
 return serializeSavedGame({format:'burgundy-local-v1',randomAlgorithm:'counter-v1',game,logs:[],view:{zoom:1,commonZoom,focus:false,table:true,boardZooms:{}}});
}
