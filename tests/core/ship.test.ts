import { test } from "node:test";
import assert from "node:assert/strict";
import { coreFixture } from "./fixture";
import { applyCoreAction, orderedPlayers, validateCoreState, listCoreActionOptions } from "../../src/game/core";
import { createPracticeSession } from "../../src/game/practice";
import { parseSavedGame, serializeSavedGame } from "../../src/game/save";
import type { TestState } from "./fixture";
function placed() {
  const s=coreFixture(); s.tiles.ship={id:"ship",type:"ship",back:"matching-color"};s.players[0].storage[0]="ship";
  s.players[0].duchy.cells.push({id:"target",coord:{q:1,r:0},terrain:"ship",number:1,regionId:"target",tileId:null});
  s.market.numberedDepots[2].goods=[{id:"ship-good1",type:1},{id:"ship-good3",type:3},{id:"ship-good4",type:4}];
  s.turn.orderTrack=[{position:0,players:["p1"]},{position:1,players:["p2"]}];
  const result=applyCoreAction(s,{type:"use-die",playerId:"p1",dieId:"p1:a",adjustment:{workersSpent:0,steps:[]},intent:{kind:"place-tile",tileId:"ship",cellId:"target"}});
  assert.ok(result.ok);return result.value.state;
}
test("ship placement requests engine-generated depot choices and blocks premature end/action",()=>{
  const s=placed();assert.equal(validateCoreState(s).valid,true);assert.ok(s.turn.pendingChoice);
  const options=s.turn.pendingChoice.options.filter(o=>o.id.startsWith("depot:3"));assert.equal(options.length,2);
  assert.equal(applyCoreAction(s,{type:"end-turn",playerId:"p1"}).ok,false);
  const legal=listCoreActionOptions(s,"p1");assert.ok(legal.ok);assert.ok(legal.value.actions.every(a=>a.type==="resolve-choice"||a.type==="buy-black-tile"));
});
test("ship stacks owned goods, selects one new type, leaves overflow and moves atop destination",()=>{
  const s=placed();const choice=s.turn.pendingChoice!;
  const result=applyCoreAction(s,{type:"resolve-choice",playerId:"p1",choiceId:choice.id,optionId:"depot:3:types:3"});assert.ok(result.ok);
  const next=result.value.state;
  assert.equal(next.players[0].goods.find(g=>g.type===1)!.tiles.length,3);
  assert.equal(next.players[0].goods.find(g=>g.type===3)!.tiles.length,1);
  assert.deepEqual(next.market.numberedDepots[2].goods.map(g=>g.type),[4]);
  assert.deepEqual(orderedPlayers(next),["p1","p2"]);assert.deepEqual(next.turn.orderTrack,[{position:1,players:["p1","p2"]}]);
  assert.equal(next.turn.pendingChoice,null);assert.equal(next.dice.players.p1[1].used,false);
  assert.equal(s.turn.pendingChoice?.id,choice.id);
});
test("forged, foreign and replayed ship decisions reject atomically",()=>{
  const s=placed(),before=structuredClone(s);
  for(const action of [{type:"resolve-choice",playerId:"p2",choiceId:s.turn.pendingChoice!.id,optionId:"depot:1:types:"},{type:"resolve-choice",playerId:"p1",choiceId:"fake",optionId:"fake"}] as const)assert.equal(applyCoreAction(s,action).ok,false);
  assert.deepEqual(s,before);
  const action={type:"resolve-choice" as const,playerId:"p1",choiceId:s.turn.pendingChoice!.id,optionId:s.turn.pendingChoice!.options[0].id};
  const result=applyCoreAction(s,action);assert.ok(result.ok);assert.equal(applyCoreAction(result.value.state,action).ok,false);
});
test("a pending ship decision on official SE2 survives a validated save round trip",()=>{
  const s=structuredClone(createPracticeSession({names:["a","b"],seed:"ship-save",boardIds:["se:base:2",""]})) as TestState;
  const roll=applyCoreAction(s,{type:"roll-round",playerId:"seat-1"});assert.ok(roll.ok);
  const draft=structuredClone(roll.value.state) as TestState;
  const id=draft.market.numberedDepots[0].slots[0].tileId!;draft.market.numberedDepots[0].slots[0].tileId=null;draft.players[0].storage[0]=id;draft.dice.players["seat-1"][0].value=1;
  const result=applyCoreAction(draft,{type:"use-die",playerId:"seat-1",dieId:draft.dice.players["seat-1"][0].id,adjustment:{workersSpent:0,steps:[]},intent:{kind:"place-tile",tileId:id,cellId:"0,-1"}});assert.ok(result.ok);
  const saved={format:"burgundy-local-v1" as const,randomAlgorithm:"counter-v1" as const,game:result.value.state,logs:[],view:{zoom:1,focus:false,boardZooms:{}}};
  assert.deepEqual(parseSavedGame(serializeSavedGame(saved)),saved);
});
