import { test } from "node:test";
import assert from "node:assert/strict";
import { coreFixture, type TestState } from "./fixture";
import { applyCoreAction, finalScore, validateCoreState } from "../../src/game/core";
import { createPracticeSession } from "../../src/game/practice";
import { parseSavedGame, serializeSavedGame } from "../../src/game/save";

function monk(s:TestState,index:number,n:27|28){
  const id=`extra-${n}`;s.tiles[id]={id,type:"monastery",number:n,back:"matching-color"};
  s.players[index].duchy.cells.push({id,coord:{q:1,r:0},terrain:"monastery",number:1,regionId:id,tileId:id});
}
function place(s:TestState,tileId:string){
  const result=applyCoreAction(s,{type:"use-die",playerId:"p1",dieId:"p1:a",adjustment:{steps:[],workersSpent:0},intent:{kind:"place-tile",tileId,cellId:"target"}});assert.ok(result.ok,JSON.stringify(result));return result.value.state;
}
test("monastery27 takes the top immediately and remains above an arriving ship marker",()=>{
  const s=coreFixture();s.config.extensions=[{id:"additional-hexes",options:{}}];
  s.tiles.m27={id:"m27",type:"monastery",number:27,back:"matching-color"};s.players[0].storage[0]="m27";
  s.players[0].duchy.cells.push({id:"target",coord:{q:1,r:0},terrain:"monastery",number:1,regionId:"target",tileId:null});s.turn.orderTrack[0].players=["p2","p1"];
  assert.deepEqual(place(s,"m27").turn.orderTrack[0].players,["p1","p2"]);
  const passive=coreFixture();passive.config.extensions=[{id:"additional-hexes",options:{}}];monk(passive,1,27);
  passive.turn.orderTrack=[{position:0,players:["p1"]},{position:1,players:["p2"]}];passive.tiles.ship={id:"ship",type:"ship",back:"matching-color"};passive.players[0].storage[0]="ship";
  passive.players[0].duchy.cells.push({id:"target",coord:{q:1,r:0},terrain:"ship",number:1,regionId:"target",tileId:null});
  const waiting=place(passive,"ship");const chosen=applyCoreAction(waiting,{type:"resolve-choice",playerId:"p1",choiceId:waiting.turn.pendingChoice!.id,optionId:waiting.turn.pendingChoice!.options[0].id});assert.ok(chosen.ok);assert.deepEqual(chosen.value.state.turn.orderTrack[0].players,["p2","p1"]);
});
test("monastery28 buys two workers for one silver without dice even outside its owner's turn",()=>{
  const s=coreFixture();s.config.extensions=[{id:"additional-hexes",options:{}}];monk(s,1,28);
  const result=applyCoreAction(s,{type:"buy-workers",playerId:"p2"});assert.ok(result.ok);
  assert.equal(result.value.state.players[1].workers,s.players[1].workers+2);assert.equal(result.value.state.players[1].silver,2);
  assert.deepEqual(result.value.state.dice,s.dice);assert.equal(result.value.state.turn.activePlayerId,"p1");assert.equal(s.players[1].silver,3);
  const empty=structuredClone(s);empty.players[1].silver=0;assert.equal(applyCoreAction(empty,{type:"buy-workers",playerId:"p2"}).ok,false);
});
test("crane chooses all eight building effects and simple benefits do not spend a second die",()=>{
  for(const building of ["market","carpenters-workshop","church","warehouse","boarding-house","bank","town-hall","watchtower"]){
    const s=coreFixture();s.config.extensions=[{id:"additional-hexes",options:{}}];s.tiles.crane={id:"crane",type:"building",building:"crane",back:"black"};s.players[0].storage[0]="crane";
    s.players[0].duchy.cells.push({id:"target",coord:{q:1,r:0},terrain:"building",number:1,regionId:"target",tileId:null});
    const waiting=place(s,"crane");assert.equal(waiting.turn.pendingChoice?.options.length,9);
    const chosen=applyCoreAction(waiting,{type:"resolve-choice",playerId:"p1",choiceId:waiting.turn.pendingChoice!.id,optionId:`crane:${building}`});assert.ok(chosen.ok,JSON.stringify(chosen));
    assert.equal(chosen.value.state.dice.players.p1[1].used,false);assert.equal(validateCoreState(chosen.value.state).valid,true);
    if(building==="bank")assert.equal(chosen.value.state.players[0].silver,5);
    if(building==="boarding-house")assert.equal(chosen.value.state.players[0].workers,5);
    if(building==="watchtower")assert.equal(chosen.value.state.players[0].victoryPoints,waiting.players[0].victoryPoints+4);
    if(!["bank","boarding-house","watchtower"].includes(building))assert.ok(chosen.value.state.turn.pendingChoice);
  }
});
test("extra hex catalog is optional, finite, saveable and rejects disabled definitions",()=>{
  const game=createPracticeSession({names:["A","B"],seed:"extra-tiles",officialSlots:true,additionalHexes:true});
  assert.equal(Object.keys(game.tiles).length,164);assert.ok(game.config.extensions.some(e=>e.id==="additional-hexes"));
  const saved={format:"burgundy-local-v1" as const,randomAlgorithm:"counter-v1" as const,game,logs:[],view:{zoom:1,focus:false,boardZooms:{}}};assert.deepEqual(parseSavedGame(serializeSavedGame(saved)),saved);
  const bad=structuredClone(game) as TestState;bad.config.extensions=bad.config.extensions.filter(e=>e.id!=="additional-hexes");assert.equal(validateCoreState(bad).valid,false);
  const s=coreFixture();s.config.extensions=[{id:"additional-hexes",options:{}}];
  for(const [i,n]of [16,17].entries()){const id=`monk${n}`;s.tiles[id]={id,type:"monastery",number:n as 16|17,back:"matching-color"};s.players[0].duchy.cells.push({id,coord:{q:i+1,r:0},terrain:"monastery",number:1,regionId:"monks",tileId:id});}
  s.tiles.crane={id:"crane",type:"building",building:"crane",back:"black"};s.players[0].duchy.cells.push({id:"crane",coord:{q:1,r:1},terrain:"building",number:1,regionId:"city",tileId:"crane"});
  const end=finalScore(s,s.players[0]);assert.ok(end.ok);assert.equal(end.value.finalAdditions.find(e=>e.id.endsWith("crane-building"))?.points,4);
});
