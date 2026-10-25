import assert from 'node:assert/strict';
import {setup,stash,step,placed} from './shields';
import {directActions} from '../../src/game/direct-actions';
import {areAxialNeighbors} from '../../src/game/boards/axial';
import {vineFixture} from './vineyards';
import {VINE_TILES} from '../../src/game/vineyards';
import type {GameState} from '../../src/game/types';
/** A real registered-board placement leaves the ordinary market benefit pending. */
export function marketRewardFixture(){
 const market={type:'building' as const,building:'market' as const,back:'matching-color' as const};const stored=stash(setup(),market),a=directActions(stored.g,'seat-1').find(a=>a.type==='use-die'&&a.intent.kind==='place-tile'&&a.intent.tileId===stored.id);assert.ok(a);return step(stored.g,a);
}
export function townHallReserveFixture():GameState{
 const hall={type:'building' as const,building:'town-hall' as const,back:'matching-color' as const},stored=stash(vineFixture(),hall),g=stored.g,id=g.vineyards!.bag.find(id=>VINE_TILES[id][0]!==VINE_TILES[id][1])!;
 return {...g,vineyards:{...g.vineyards!,bag:g.vineyards!.bag.filter(x=>x!==id)},players:g.players.map((p,i)=>i?p:{...p,vineyardReserve:[{tileId:id,keys:[1,2] as const}]})};
}
export function earnedCastleBonusFixture(){
 let g=setup();const empty=g.players[0].duchy.cells.filter(c=>c.terrain==='castle'&&!c.tileId),target=empty.at(-1)!;assert.ok(target);
 for(const cell of empty.slice(0,-1))g=placed(g,0,{type:'castle',back:'matching-color'},cell.id);
 if(!g.players[0].duchy.cells.some(c=>c.tileId&&areAxialNeighbors(c.coord,target.coord))){const neighbor=g.players[0].duchy.cells.find(c=>!c.tileId&&areAxialNeighbors(c.coord,target.coord))!;assert.ok(neighbor);const prototype=Object.values(g.tiles).find(t=>t.type===neighbor.terrain)!;g=placed(g,0,prototype,neighbor.id);}
 const stored=stash(g,{type:'castle',back:'matching-color'}),a=directActions(stored.g,'seat-1').find(a=>a.type==='use-die'&&a.intent.kind==='place-tile'&&a.intent.tileId===stored.id&&a.intent.cellId===target.id);assert.ok(a);const next=step(stored.g,a);assert.equal(next.players[0].bonuses.length,1);return next;
}
