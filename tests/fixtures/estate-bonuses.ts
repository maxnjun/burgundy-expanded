import assert from 'node:assert/strict';
import {setup,placed} from './shields';
import {areAxialNeighbors} from '../../src/game/boards/axial';
import {directActions} from '../../src/game/direct-actions';
import type {GameState,TileType} from '../../src/game/types';

/** Fixture only: leave one real board cell per player to complete this terrain. */
export function completionReady(count=2,color:TileType='mine'):GameState{
 let game=setup(count);
 for(let index=0;index<count;index++){
  const empty=game.players[index].duchy.cells.filter(c=>c.terrain===color&&!c.tileId),target=empty.at(-1);assert.ok(target);
  const prototype=Object.values(game.tiles).find(t=>t.type===color&&(t.type!=='building'||t.building==='bank'))!;
  const filler=prototype.type==='building'?{...prototype,building:'market' as const}:prototype;
  for(const cell of empty.slice(0,-1))game=placed(game,index,filler,cell.id);
  if(!game.players[index].duchy.cells.some(c=>c.tileId&&areAxialNeighbors(c.coord,target.coord))){
   const neighbor=game.players[index].duchy.cells.find(c=>!c.tileId&&areAxialNeighbors(c.coord,target.coord))!;
   game=placed(game,index,Object.values(game.tiles).find(t=>t.type===neighbor.terrain)!,neighbor.id);
  }
  const id=`bonus-completion:${index}:${color}`;
  const dice=game.dice.players[game.players[index].id];
  game={...game,tiles:{...game.tiles,[id]:{...prototype,id}},players:game.players.map((p,i)=>i===index?{...p,storage:[id,null,null]}:p),dice:{...game.dice,players:{...game.dice.players,[game.players[index].id]:[{...dice[0],value:target.number},dice[1]]}}};
 }
 return game;
}
export function completionAction(game:GameState){
 const player=game.players.find(p=>p.id===game.turn.activePlayerId)!;
 const action=directActions(game,player.id).find(a=>a.type==='use-die'&&a.intent.kind==='place-tile'&&a.intent.tileId===player.storage[0]&&a.adjustment.workersSpent===0);
 assert.ok(action,'real legal completion placement');return action;
}
