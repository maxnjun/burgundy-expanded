import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseComputerAction } from "../../src/game/computer";
import { createPracticeSession } from "../../src/game/practice";
import { applyCoreAction, validateCoreAction } from "../../src/game/core";
import { parseSavedGame, serializeSavedGame } from "../../src/game/save";

test("computer is deterministic, legal, immutable and cannot consult hidden future randomness",()=>{
  let game=createPracticeSession({names:["A","B"],seed:"computer-public",officialSlots:true,boardIds:["se:base:1","se:base:2"]});
  const rolled=applyCoreAction(game,{type:"roll-round",playerId:"seat-1"});assert.ok(rolled.ok);game=rolled.value.state;
  const before=structuredClone(game),first=chooseComputerAction(game);assert.ok(first.ok);
  assert.equal(validateCoreAction(game,first.value).valid,true);
  assert.deepEqual(chooseComputerAction(game),first);assert.deepEqual(game,before);
  const changed={...game,random:{...game.random,cursor:game.random.cursor+999},market:{...game.market,supplyPools:game.market.supplyPools.map(p=>({...p,remainingTileIds:[...p.remainingTileIds].reverse()}))}};
  assert.deepEqual(chooseComputerAction(changed),first);
});

test("project two-player computer games finish A to E with choices, scoring and saved resumption",()=>{
  for(const seed of ["computer-full-1","computer-full-2","computer-full-3"]){
    let game=createPracticeSession({names:["A","B"],seed,officialSlots:true,boardIds:["se:base:1","se:base:2"],geese:true,borderPosts:true,additionalHexes:true});
    let steps=0,placements=0,choices=0;
    while(game.status!=="finished"){
      assert.ok(++steps<900,"AI must terminate");
      const action=chooseComputerAction(game);assert.ok(action.ok);
      if(action.value.type==="use-die"&&action.value.intent.kind==="place-tile")placements++;
      if(action.value.type==="resolve-choice")choices++;
      const next=applyCoreAction(game,action.value);assert.ok(next.ok,JSON.stringify(next));game=next.value.state;
      if(steps%30===0)game=parseSavedGame(serializeSavedGame({format:"burgundy-local-v1",randomAlgorithm:"counter-v1",game,logs:[],view:{zoom:1,focus:false,boardZooms:{},computerPlayerIds:["seat-2"]}})).game;
    }
    assert.ok(placements>10);assert.ok(choices>0);assert.ok(game.players.some(p=>p.victoryPoints>0));
    assert.equal(game.finalScores?.length,2);
    assert.equal(chooseComputerAction(game).ok,false);
  }
});
