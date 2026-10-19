import { createPracticeSession } from "../../src/game/practice";
import { applyCoreAction } from "../../src/game/core";
import { fortressLinesFor } from "../../src/game/boards/fortress-lines";
import type { Tile, GameAction } from "../../src/game/types";
/** TEST FIXTURE: inject occupied cells on an unchanged registered board. */
export function fortressFixture(number=23){
 let g=createPracticeSession({names:["요새A","요새B"],boardIds:[`se:border-posts:${number}`,"se:base:2"],seed:"fortress-fixture",officialSlots:true});
 const roll=applyCoreAction(g,{type:"roll-round",playerId:"seat-1"});if(!roll.ok)throw Error("roll");g=roll.value.state;
 const lines=fortressLinesFor(g.players[0].duchy.boardId),target=lines[0].cellIds.findLast(id=>!g.players[0].duchy.cells.find(c=>c.id===id)!.tileId)!;
 const omit=new Set(lines.slice(1).flatMap(l=>l.cellIds));omit.add(target);
 const tiles={...g.tiles};let count=0;
 const face=(type:Tile["type"],id:string):Tile=>type==="building"?{id,type,building:"watchtower",back:"matching-color"}:type==="monastery"?{id,type,number:1,back:"matching-color"}:type==="livestock"?{id,type,species:"sheep",count:2,back:"matching-color"}:{id,type,back:"matching-color"};
 const p=g.players[0],cells=p.duchy.cells.map(c=>{if(c.tileId||omit.has(c.id))return c;const id=`fortress-fixture:${count++}`;tiles[id]=face(c.terrain,id);return {...c,tileId:id};});
 const last=p.duchy.cells.find(c=>c.id===target)!;tiles["fortress-last"]=face(last.terrain,"fortress-last");
 g={...g,tiles,players:g.players.map((p,i)=>i?p:{...p,workers:30,storage:["fortress-last",null,null],duchy:{...p.duchy,cells}}),dice:{...g.dice,players:{...g.dice.players,"seat-1":[{...g.dice.players["seat-1"][0],value:last.number},g.dice.players["seat-1"][1]]}}};
 const action:GameAction={type:"use-die",playerId:"seat-1",dieId:"seat-1:a",adjustment:{steps:[],workersSpent:0},intent:{kind:"place-tile",tileId:"fortress-last",cellId:target}};
 return {game:g,action,target};
}
