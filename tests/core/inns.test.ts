import {test} from "node:test";
import assert from "node:assert/strict";
import {coreFixture,type TestState} from "./fixture";
import {supplyInn,innId,INN_PHASES,regionSizePoints} from "../../src/game/inns";
import {applyCoreAction,validateCoreAction,validateCoreState} from "../../src/game/core";
import {placementIssue,resolvePlacement} from "../../src/game/core/placement";
import {deriveRegions} from "../../src/game/boards/regions";
import {createPracticeSession} from "../../src/game/practice";
import {chooseComputerAction} from "../../src/game/computer";
import {serializeSavedGame,parseSavedGame} from "../../src/game/save";
import type {GameAction,GameState,TileType} from "../../src/game/types";
import {createShieldLayout} from "../../src/game/shields";
import {mount} from "../fixtures/shields";
import {fortressFixture} from "../fixtures/fortress";

const roundtrip=(game:GameState)=>parseSavedGame(serializeSavedGame({format:"burgundy-local-v1",randomAlgorithm:"counter-v1",game,logs:[],view:{zoom:1,focus:false,boardZooms:{}}})).game;
function fixture(terrain:TileType="mine",size=2):TestState{
 let s=coreFixture();s.config.extensions.push({id:"inns",options:{}});s=structuredClone(supplyInn(s,"A")) as TestState;
 const id=innId("A");s.market.inns!.stack=[];s.players[0].storage[0]=id;
 // TEST FIXTURE: straight axial region attached to the starting castle.
 for(let q=1;q<=size;q++)s.players[0].duchy.cells.push({id:`cell${q}`,coord:{q,r:0},terrain,number:1,regionId:"region",tileId:null});
 for(const region of deriveRegions(s.players[0].duchy.cells))for(const cell of s.players[0].duchy.cells)if(region.cellIds.includes(cell.id))cell.regionId=region.id;
 return s;
}
const place=(id=innId("A"),cellId="cell1"):GameAction=>({type:"use-die",playerId:"p1",dieId:"p1:a",adjustment:{steps:[],workersSpent:0},intent:{kind:"place-tile",tileId:id,cellId}});

test("inn supply accumulates exactly one per A–E and is immutable/idempotent",()=>{
 let s=createPracticeSession({names:["a","b"],seed:"inn-supply",inns:true});
 for(const [i,p]of INN_PHASES.entries()){
  if(i)s={...supplyInn(s,p),turn:{...s.turn,phase:p}};
  assert.equal(s.market.inns!.stack.length,i+1);assert.equal(s.market.inns!.suppliedPhases.length,i+1);
  const before=structuredClone(s);assert.equal(supplyInn(s,p),s);assert.deepEqual(s,before);assert.ok(validateCoreState(s).valid);
 }
 const old=createPracticeSession({names:["a","b"],seed:"off"});assert.equal(supplyInn(old,"A"),old);assert.equal(roundtrip(old).market.inns,undefined);
});
test("inn purchase is atomic, costs2, shares black limit, preserves dice and rejects buried/empty/foreign purchase",()=>{
 const s=fixture();s.players[0].storage[0]=null;s.market.inns!.stack=[innId("A")];
 const action:GameAction={type:"buy-black-tile",playerId:"p1",tileId:innId("A"),storageSlot:0};
 const before=structuredClone(s),r=applyCoreAction(s,action);assert.ok(r.ok,JSON.stringify(r));assert.deepEqual(s,before);
 assert.equal(r.value.state.players[0].silver,1);assert.equal(r.value.state.market.inns!.stack.length,0);assert.deepEqual(r.value.state.dice,s.dice);
 assert.equal(validateCoreAction(r.value.state,{...action,tileId:"black",storageSlot:1}).valid,false);
 assert.equal(validateCoreAction(s,{...action,playerId:"p2"}).valid,false);
 assert.equal(validateCoreAction({...s,players:s.players.map((p,i)=>i? p:{...p,silver:1})},action).valid,false);
 const b=applyCoreAction(s,{...action,tileId:"black"});assert.ok(b.ok);assert.equal(validateCoreAction(b.value.state,{...action,storageSlot:1}).valid,false);
 let three:GameState=s;for(const phase of ["B","C"]as const)three={...supplyInn(three,phase),turn:{...three.turn,phase}};
 assert.equal(validateCoreAction(three,action).valid,false);
 const top=applyCoreAction(three,{...action,tileId:innId("C")});assert.ok(top.ok);assert.equal(top.value.state.market.inns!.stack.length,2);
 assert.equal(supplyInn(r.value.state,"B").market.inns!.stack.length,1);
});
for(const terrain of ["castle","building","livestock","ship","mine","monastery"]as const)test(`inn joker ${terrain}: placement triggers no native tile benefit`,()=>{
 const s=fixture(terrain),r=applyCoreAction(s,place());assert.ok(r.ok,JSON.stringify(r));
 assert.equal(r.value.state.players[0].duchy.cells.find(c=>c.id==="cell1")!.tileId,innId("A"));
 assert.equal(r.value.state.turn.pendingChoice,null);assert.equal(r.value.state.players[0].silver,s.players[0].silver);assert.deepEqual(r.value.state.turn.orderTrack,s.turn.orderTrack);
 assert.equal(r.value.state.scoreLedger.p1.filter(e=>e.category==="livestock"||e.category==="building").length,0);
});
for(let size=1;size<=8;size++)test(`inn actual region size${size}: scoring size+1, phase independent`,()=>{
 const s=fixture("mine",size);
 for(let q=2;q<=size;q++){const id=`filler${q}`;s.tiles[id]={id,type:"mine",back:"matching-color"};s.players[0].duchy.cells.find(c=>c.id===`cell${q}`)!.tileId=id;}
 const r=applyCoreAction(s,place());assert.ok(r.ok,JSON.stringify(r));
 assert.equal(r.value.state.scoreLedger.p1.find(e=>e.category==="region-size")!.points,regionSizePoints(size+1));
 assert.equal(r.value.state.scoreLedger.p1.find(e=>e.category==="phase-bonus")!.points,10);
 assert.equal(r.value.state.players[0].duchy.cells.length,size+1);assert.equal(r.value.state.scoreLedger.p1.find(e=>e.category==="region-size")!.source.document,"project-user-rule");
 assert.equal(validateCoreAction(r.value.state,place()).valid,false);
});
test("incomplete region pays nothing; second inn in same region forbidden; separate region allowed",()=>{
 const s=fixture(),first=applyCoreAction(s,place());assert.ok(first.ok);assert.equal(first.value.state.scoreLedger.p1.length,0);
 let next={...supplyInn(first.value.state,"B"),turn:{...first.value.state.turn,phase:"B" as const}};
 next={...next,market:{...next.market,inns:{...next.market.inns!,stack:[]}},players:next.players.map((p,i)=>i?p:{...p,storage:[innId("B"),null,null]})};
 assert.ok(placementIssue(next,next.players[0],innId("B"),"cell2",1));
 const other=structuredClone(next) as TestState;other.players[0].duchy.cells.find(c=>c.id==="cell2")!.terrain="building";other.players[0].duchy.cells.find(c=>c.id==="cell2")!.regionId="other";
 for(const r of deriveRegions(other.players[0].duchy.cells))for(const c of other.players[0].duchy.cells)if(r.cellIds.includes(c.id))c.regionId=r.id;
 assert.equal(placementIssue(other,other.players[0],innId("B"),"cell2",1),null);
 assert.equal(regionSizePoints(10),55);assert.throws(()=>regionSizePoints(11));
 const finished=resolvePlacement(other,other.players[0],innId("B"),"cell2");assert.equal(finished.entries.find(e=>e.category==="region-size")!.points,3);
});
test("inn size bonus stacks once with shield17, phase values remain10/8/6/4/2",()=>{
 let s=fixture("mine",8);for(let q=2;q<=8;q++){const id=`fill${q}`;s.tiles[id]={id,type:"mine",back:"matching-color"};s.players[0].duchy.cells.find(c=>c.id===`cell${q}`)!.tileId=id;}
 const shields=createShieldLayout(2,s.random,true);s={...s,random:shields.random,extensionStates:{shields:JSON.parse(JSON.stringify(shields.layout))}};
 s.config.extensions.push({id:"shields",options:{rules:true}});const game=mount(s,17);
 const result=applyCoreAction(game,place());assert.ok(result.ok,JSON.stringify(result));assert.equal(result.value.state.scoreLedger.p1.find(e=>e.category==="region-size")!.points,55);
 for(const [i,phase]of INN_PHASES.entries()){
  const r=resolvePlacement({...game,turn:{...game.turn,phase}},game.players[0],innId("A"),"cell1");assert.equal(r.entries.find(e=>e.category==="phase-bonus")!.points,10-i*2);
 }
});
test("inn completes fortress line with unmodified phase award and original cell count",()=>{
 const f=fortressFixture();let game=supplyInn({...f.game,config:{...f.game.config,extensions:[...f.game.config.extensions,{id:"inns",options:{}}]}},"A");
 const last=game.players[0].storage[0]!;
 game={...game,market:{...game.market,removedTileIds:[...game.market.removedTileIds,last],inns:{...game.market.inns!,stack:[]}},players:game.players.map((p,i)=>i?p:{...p,storage:[innId("A"),null,null]})};
 assert.equal(f.action.type,"use-die");if(f.action.type!=="use-die"||f.action.intent.kind!=="place-tile")return;
 const r=applyCoreAction(game,{...f.action,intent:{...f.action.intent,tileId:innId("A")}});assert.ok(r.ok,JSON.stringify(r));
 const entries=r.value.state.scoreLedger['seat-1'].filter(e=>e.id.startsWith('fortress:'));assert.equal(entries.length,1);assert.equal(entries[0].points,10);assert.equal(r.value.state.players[0].duchy.cells.length,37);
});
test("save rejects forged supply, repeated inn in region and incorrectly enabled legacy game",()=>{
 const game=createPracticeSession({names:["a","b"],seed:"inn-forgery",inns:true});assert.deepEqual(roundtrip(game),game);
 assert.throws(()=>roundtrip({...game,market:{...game.market,inns:{suppliedPhases:["A","A"],stack:[innId("A")]}}}));
 assert.throws(()=>roundtrip({...game,market:{...game.market,inns:{...game.market.inns!,stack:[]},blackDepot:[innId("A"),...game.market.blackDepot.slice(1)]}}));
 assert.throws(()=>roundtrip({...game,config:{...game.config,extensions:[]}}));
 const s=fixture();s.players[0].duchy.cells[1].tileId=innId("A");s.players[0].storage[0]=null;const b=supplyInn(s,"B");
 const forged={...b,turn:{...b.turn,phase:"B" as const},market:{...b.market,inns:{...b.market.inns!,stack:[]}},players:b.players.map((p,i)=>i?p:{...p,duchy:{...p.duchy,cells:p.duchy.cells.map(c=>c.id==="cell2"?{...c,tileId:innId("B")}:c)}})};
 assert.equal(validateCoreState(forged).valid,false);
});
for(const count of [2,3,4]as const)test(`inn AI ${count} seats finishes25 rounds with other expansions and save restoration`,()=>{
 let game=createPracticeSession({names:Array.from({length:count},(_,i)=>`AI${i}`),seed:`inn-ai-${count}`,inns:true,whiteCastles:true,additionalHexes:true,shieldRules:true,officialSlots:true,boardIds:Array(count).fill("se:border-posts:23")});
 let steps=0,purchases=0,placements=0;
 while(game.status!=="finished"){
  assert.ok(++steps<1800);const a=chooseComputerAction(game);assert.ok(a.ok);
  if(a.value.type==="buy-black-tile"&&game.tiles[a.value.tileId].type==="inn")purchases++;
  if(a.value.type==="use-die"&&a.value.intent.kind==="place-tile"&&game.tiles[a.value.intent.tileId].type==="inn")placements++;
  const r=applyCoreAction(game,a.value);assert.ok(r.ok,JSON.stringify(r));game=r.value.state;
  if(steps%40===0)game=roundtrip(game);
 }
 assert.equal(game.turn.phase,"E");assert.equal(game.market.inns!.suppliedPhases.length,5);assert.ok(purchases>0);assert.ok(placements>0);assert.equal(roundtrip(game).finalScores!.length,count);
});
