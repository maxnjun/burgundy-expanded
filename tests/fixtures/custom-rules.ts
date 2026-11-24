import assert from 'node:assert/strict';
import {deriveRegions} from '../../src/game/boards/regions';
import {areAxialNeighbors} from '../../src/game/boards/axial';
import {createPracticeSession} from '../../src/game/practice';
import {settleShieldState} from '../../src/game/core/shield-effects';
import {setShieldLayout,shieldLayout} from '../../src/game/shields';
import type {GameState,GameAction,Tile} from '../../src/game/types';
import {mount,step} from './shields';

export function customGame(count=2,shields=true,vineyards=false,inns=false):GameState{
 const game=createPracticeSession({customRules:true,names:['왕실A','왕실B','왕실C','왕실D'].slice(0,count),seed:'rules-24-check',boardIds:Array(count).fill('se:base:2'),officialSlots:true,shieldRules:shields,vineyards,inns});
 const rolled=step(game,{type:'roll-round',playerId:'seat-1'});
 return {...rolled,players:rolled.players.map(p=>({...p,silver:30,workers:30}))};
}
export function customMount(game:GameState,n:number,index=0){
 const old=shieldLayout(game)!,source=old.slots.find(s=>s.shieldNumber===n)??old.slots.find(s=>s.shieldNumber!==null)!;
 const mounted=mount(game,n,index),layout=shieldLayout(mounted)!;
 return setShieldLayout(mounted,{...layout,mounted:layout.mounted.map(m=>m.shieldNumber===n?{...m,sourceSlotId:source.id,sourceDepot:source.depot}:m)});
}
export function moveTile(game:GameState,match:(tile:Tile)=>boolean,cellId?:string,seat=0,index=0):{game:GameState;tileId:string}{
 const m=game.market,choices=[...m.supplyPools.flatMap(p=>p.remainingTileIds),...m.numberedDepots.flatMap(d=>d.slots.map(s=>s.tileId)),...m.blackDepot,...(m.inns?.stack??[])];
 const tileId=choices.find(id=>id&&match(game.tiles[id]));
 assert.ok(tileId);
 return {tileId,game:{...game,market:{...m,blackDepot:m.blackDepot.map(id=>id===tileId?null:id),
  ...(m.inns?{inns:{...m.inns,stack:m.inns.stack.filter(id=>id!==tileId)}}:{}),
  numberedDepots:m.numberedDepots.map(d=>({...d,slots:d.slots.map(s=>s.tileId===tileId?{...s,tileId:null}:s)})),
  supplyPools:m.supplyPools.map(p=>({...p,remainingTileIds:p.remainingTileIds.filter(id=>id!==tileId)}))},
  players:game.players.map((p,i)=>i!==seat?p:cellId?{...p,duchy:{...p.duchy,cells:p.duchy.cells.map(c=>c.id===cellId?{...c,tileId}:c)}}:
   {...p,storage:p.storage.map((id,i)=>i===index?tileId:id)})}};
}
export const special=(command:string,payload:import('../../src/game/types').JsonValue=null,extensionId:'additional-hexes'|'shields'='shields',playerId='seat-1'):GameAction=>
 ({type:'extension',extensionId,command,payload,playerId});

export function officialTerritory(){
 let game=customGame(2,false);
 const p=game.players[0],cells=p.duchy.cells;
 const regions=deriveRegions(cells).filter(r=>r.terrain!=='castle'&&r.terrain!=='monastery'&&r.cellIds.length===2);
 const region=regions.find(r=>cells.some(c=>c.terrain!==r.terrain&&!c.tileId&&r.cellIds.some(id=>areAxialNeighbors(c.coord,cells.find(x=>x.id===id)!.coord))))!;
 const target=cells.find(c=>c.terrain!==region.terrain&&!c.tileId&&region.cellIds.some(id=>areAxialNeighbors(c.coord,cells.find(x=>x.id===id)!.coord)))!;
 const monk=cells.find(c=>c.terrain==='monastery'&&c.id!==target.id)!;
 game=moveTile(game,t=>t.type==='monastery'&&t.number===31,monk.id).game;
 for(const id of region.cellIds)game=moveTile(game,t=>t.type===region.terrain,id).game;
 game={...game,players:game.players.map((p,i)=>i?p:{...p,victoryPoints:18,duchy:{...p.duchy,completedRegionIds:[...p.duchy.completedRegionIds,region.id]}}),
  scoreLedger:{...game.scoreLedger,'seat-1':[
   {id:'old:size',category:'region-size',points:3,regionId:region.id,source:{document:'project-user-rule',pages:[],section:'fixture'}},
   {id:'old:phase',category:'phase-bonus',points:10,regionId:region.id,source:{document:'project-user-rule',pages:[],section:'fixture'}},
   {id:'old:color',category:'color-bonus',points:5,regionId:region.id,source:{document:'project-user-rule',pages:[],section:'fixture'}},
  ]}};
 const a=special('recolor',{cellId:target.id,terrain:region.terrain},'additional-hexes');
 return {game:settleShieldState(game),a,target,region};
}
