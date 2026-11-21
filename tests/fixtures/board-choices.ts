import {boardTarget, directActions} from '../../src/game/direct-actions';
import type {GameState} from '../../src/game/types';
import {mount, setup, startPhase} from './shields';
import {vineFixture} from './vineyards';

export const shieldPlacementFixture=(shield:14|15,count=2)=>startPhase(mount(setup(count),shield));

export function fullVineStorageFixture(withVine=false):GameState {
 const game=vineFixture();
 const supplyPools=game.market.supplyPools.map(p=>({...p,remainingTileIds:[...p.remainingTileIds]}));
 const take=()=>supplyPools.find(p=>p.remainingTileIds.length)!.remainingTileIds.pop()!;
 const vineyard=game.vineyards!;
 const storage=withVine?[null,null,take()]:[take(),take(),take()];
 return {...game,market:{...game.market,supplyPools},
  vineyards:withVine?{...vineyard,bag:vineyard.bag.slice(1)}:vineyard,
  players:game.players.map((p,i)=>i?p:{...p,storage,
   vineyardReserve:withVine?[{tileId:vineyard.bag[0],keys:[0,1]}]:[]}),
 };
}

export const choiceOptions=(game:GameState)=>directActions(game,'seat-1').map(action=>({action,target:boardTarget(game,action)}));
