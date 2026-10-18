import { test } from "node:test";
import assert from "node:assert/strict";
import { createPracticeSession } from "../../src/game/practice";
import { parseSavedGame, serializeSavedGame, type SavedGame } from "../../src/game/save";
import { applyCoreAction } from "../../src/game/core";
import type { TestState } from "./fixture";
type SaveDraft = { game: TestState; view: { zoom: number } };
const save = (): SavedGame => ({ format:"burgundy-local-v1", randomAlgorithm:"counter-v1",game:createPracticeSession({names:["a","b"],seed:"save",boardIds:["se:base:2",""]}),logs:["준비"],view:{zoom:1,focus:false,boardZooms:{"seat-1":.8}} });
test("save round trip retains official geometry, randomness, resources, logs and view",()=>{
  const s=save();assert.deepEqual(parseSavedGame(serializeSavedGame(s)),s);
  const restored=parseSavedGame(serializeSavedGame(s));
  assert.deepEqual(applyCoreAction(restored.game,{type:"roll-round",playerId:"seat-1"}),applyCoreAction(s.game,{type:"roll-round",playerId:"seat-1"}));
});
test("bad JSON, unknown format, excessive size and prototype keys reject",()=>{
  for(const text of ["{", "null",JSON.stringify({...save(),format:"other"})," ".repeat(2_000_001),'{"__proto__":{}}']) assert.throws(()=>parseSavedGame(text));
});

test("common board zoom persists without changing game state and older saves remain readable",()=>{
  const original=save();
  assert.equal(parseSavedGame(serializeSavedGame(original)).view.commonZoom,undefined);
  for(const commonZoom of [.75,1,1.25,2]){
    const saved={...original,view:{...original.view,commonZoom}};
    const restored=parseSavedGame(serializeSavedGame(saved));
    assert.equal(restored.view.commonZoom,commonZoom);
    assert.deepEqual(restored.game,original.game);
  }
});

test("invalid common board zoom cannot enter a restored view",()=>{
  const original=save();
  for(const commonZoom of [null,"1",.5,.749,2.01,-1,Infinity,NaN]){
    assert.throws(()=>parseSavedGame(JSON.stringify({...original,view:{...original.view,commonZoom}})));
  }
});
test("tampered official dice/terrain/coordinates and foreign board IDs reject",()=>{
  for(const key of ["number","terrain","coord","boardId"]){
    const s=JSON.parse(JSON.stringify(save()));
    if(key==="boardId")s.game.players[0].duchy.boardId="se:base:1";
    else s.game.players[0].duchy.cells[0][key]=key==="number"?5:key==="terrain"?"mine":{q:9,r:9};
    assert.throws(()=>parseSavedGame(JSON.stringify(s)));
  }
});
test("negative resources, duplicate tile locations, bad phases and invalid view reject",()=>{
  const mutations=[(s:SaveDraft)=>s.game.players[0].silver=-1,(s:SaveDraft)=>s.game.players[0].storage[0]=s.game.players[0].duchy.cells.find(c=>c.tileId)!.tileId,(s:SaveDraft)=>s.game.market.phaseGoods.B=[],(s:SaveDraft)=>s.view.zoom=99];
  for(const mutate of mutations){const s=JSON.parse(JSON.stringify(save()));mutate(s);assert.throws(()=>parseSavedGame(JSON.stringify(s)));}
});


test("computer view preferences accept only unique known seats",()=>{
  const original=save();
  const good={...original,view:{...original.view,computerPlayerIds:["seat-2"]}};
  assert.deepEqual(parseSavedGame(serializeSavedGame(good)).view.computerPlayerIds,["seat-2"]);
  for(const computerPlayerIds of [["unknown"],["seat-1","seat-1"],null,"seat-1",[1]])assert.throws(()=>parseSavedGame(JSON.stringify({...original,view:{...original.view,computerPlayerIds}})));
});


test("saved AI pause is boolean and older saves do not require it",()=>{
  const original=save();const paused={...original,view:{...original.view,computerPaused:true}};
  assert.equal(parseSavedGame(serializeSavedGame(paused)).view.computerPaused,true);
  for(const computerPaused of [null,"true",1])assert.throws(()=>parseSavedGame(JSON.stringify({...original,view:{...original.view,computerPaused}})));
});
