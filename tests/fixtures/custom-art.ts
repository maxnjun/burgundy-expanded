import assert from 'node:assert/strict';
import {areAxialNeighbors,VERIFIED_BOARD_DEFINITIONS} from '../../src/game/boards';
import {createPracticeSession} from '../../src/game/practice';
import {customMount,moveTile} from './custom-rules';
import {roundtrip,step} from './shields';

export function customArtEstate(){
 const board=VERIFIED_BOARD_DEFINITIONS.find(b=>b.family==='base'&&b.regions.some(r=>r.terrain==='monastery'&&r.cellIds.length>=4))!;
 assert.ok(board);
 const region=board.regions.find(r=>r.terrain==='monastery'&&r.cellIds.length>=4)!;
 const cells=region.cellIds.map(id=>board.cells.find(c=>c.id===id)!);
 const first=cells.find(c=>board.cells.some(d=>d.terrain==='building'&&areAxialNeighbors(c.coord,d.coord)))!;
 assert.ok(first);
 const neighbours=[first];
 while(neighbours.length<4)neighbours.push(cells.find(c=>!neighbours.includes(c)&&neighbours.some(d=>areAxialNeighbors(c.coord,d.coord)))!);
 const bank=board.cells.find(c=>c.terrain==='building'&&areAxialNeighbors(first.coord,c.coord))!;
 let game=createPracticeSession({customRules:true,names:['왕실A','왕실B'],seed:'rules-24-check',boardIds:[board.id,board.id],officialSlots:true,shieldRules:true});
 game=step(game,{type:'roll-round',playerId:'seat-1'});
 game=moveTile(game,t=>t.type==='building',bank.id).game;
 for(const [i,number] of [1,30,31,32].entries())
  game=moveTile(game,t=>t.type==='monastery'&&t.number===number,neighbours[i].id).game;
 game=customMount(game,24);
 roundtrip(game);
 return {game,neighbours:neighbours.map(c=>c.id),bank:bank.id};
}
