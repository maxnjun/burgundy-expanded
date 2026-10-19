import { test } from "node:test";
import assert from "node:assert/strict";
import { createPracticeSession } from "../../src/game/practice";
import { applyCoreAction, checkCoreGameEnd, finalScore, orderedPlayers, validateCoreState } from "../../src/game/core";
import type { GameAction, GameState, MonasteryNumber, BaseTile as Tile } from "../../src/game/types";
import { parseSavedGame, serializeSavedGame } from "../../src/game/save";
import { coreFixture, type TestState } from "./fixture";

function act(state: GameState, action: GameAction) { const result = applyCoreAction(state, action); assert.ok(result.ok, JSON.stringify(result)); return result.value.state; }
function phaseEnd(): TestState {
  const s = coreFixture(); s.turn.stage = "phase-end"; s.turn.round = 5; s.turn.activePlayerId = null;
  s.market.roundGoods = []; s.dice.rolledForRound = false; s.dice.roundGoodsDistributed = false; s.dice.whiteDie = null;
  return s;
}

test("a complete 25-round 2/3/4-player exercise reaches final scoring and a winner", () => {
  for (const count of [2,3,4]) {
    let state = createPracticeSession({ names: Array(count).fill("영주"), seed: `full-${count}`, boardIds: Array(count).fill("se:base:2") });
    let actions = 0, rounds = 0, phases = 0;
    while (state.status !== "finished") {
      if (state.turn.stage === "round-setup") { state = act(state, { type: "roll-round", playerId: orderedPlayers(state)[0] }); rounds++; }
      else if (state.turn.stage === "phase-end") { state = act(state, { type: "advance-phase", playerId: orderedPlayers(state)[0] }); phases++; }
      else {
        const playerId = state.turn.activePlayerId!;
        for (const die of state.dice.players[playerId]) { state = act(state, { type: "use-die", playerId, dieId: die.id, adjustment: { workersSpent: 0, steps: [] }, intent: { kind: "take-workers" } }); actions++; }
        state = act(state, { type: "end-turn", playerId });
      }
    }
    assert.equal(rounds,25); assert.equal(phases,5); assert.equal(actions,count*50);
    assert.equal(validateCoreState(state).valid,true);
    assert.equal(state.players[0].victoryPoints,54); // goods3 + silver1 + floor(101 workers/2)
    const result = checkCoreGameEnd(state); assert.ok(result.ok && result.value.ended); assert.equal(result.value.winnerIds.length,1);
    const saved = { format: "burgundy-local-v1" as const, randomAlgorithm: "counter-v1" as const, game: state, logs: [], view: { zoom: 1, focus: false, boardZooms: {} } };
    assert.deepEqual(parseSavedGame(serializeSavedGame(saved)), saved);
  }
});

test("verified end-score monasteries count placed buildings/species and sold goods/bonuses only", () => {
  for (const [number, expected] of [[15,4],[17,8],[22,8],[24,8],[25,3],[26,6]] as const) {
    const s=phaseEnd(),p=s.players[0];
    const add=(tile:Tile)=>{s.tiles[tile.id]=tile;p.duchy.cells.push({id:tile.id,coord:{q:p.duchy.cells.length,r:0},terrain:tile.type,number:1,regionId:tile.id,tileId:tile.id});};
    add({id:"monk",type:"monastery",number:number as MonasteryNumber,back:"matching-color"});
    p.soldGoods=[{id:"sold1",type:1},{id:"sold2",type:1},{id:"sold3",type:2}];
    for(const building of ["watchtower","bank"] as const)for(let i=0;i<2;i++)add({id:`${building}${i}`,type:"building",building,back:"matching-color"});
    for(const species of ["cattle","sheep"] as const)add({id:species,type:"livestock",species,count:3,back:"matching-color"});
    p.bonuses=[{id:"bonus1",color:"mine",rank:"first",points:5},{id:"bonus2",color:"ship",rank:"second",points:2}];
    const result=finalScore(s,p);assert.ok(result.ok);
    assert.equal(result.value.finalAdditions.filter(e=>e.category==="monastery").reduce((n,e)=>n+e.points,0),expected);
    assert.equal(p.victoryPoints,0); // scoring query is pure
  }
});

test("final totals take priority over all tie-breaks", () => {
  const s=phaseEnd();s.turn.phase="E";s.players[0].victoryPoints=100;
  s.scoreLedger.p1=[{id:"earned",category:"goods-sale",points:100,source:{document:"special-edition-rulebook",pages:[10],section:"test"}}];
  const result=checkCoreGameEnd(act(s,{type:"advance-phase",playerId:"p1"}));
  assert.ok(result.ok&&result.value.ended);assert.deepEqual(result.value.winnerIds,["p1"]);
});

test("phase refill preserves depot goods, consumes unique reserve tiles and removes leftovers", () => {
  const s = structuredClone(createPracticeSession({ names:["a","b"],seed:"refill" })) as TestState;
  s.turn.stage="phase-end"; s.turn.round=5; s.market.roundGoods=[];
  s.market.numberedDepots[0].goods.push({id:"depot-retained",type:6});
  const oldIds=s.market.numberedDepots.flatMap(d=>d.slots.map(s=>s.tileId!));
  const next=act(s,{type:"advance-phase",playerId:"seat-1"});
  assert.equal(next.turn.phase,"B"); assert.equal(next.market.roundGoods.length,5); assert.equal(next.market.phaseGoods.B.length,0);
  assert.equal(next.market.numberedDepots[0].goods[0].id,"depot-retained");
  assert.ok(oldIds.every(id=>next.market.removedTileIds.includes(id)));
  assert.equal(next.market.supplyPools[0].remainingTileIds.length,s.market.supplyPools[0].remainingTileIds.length-13);
  assert.deepEqual(act(s,{type:"advance-phase",playerId:"seat-1"}),next);
  assert.equal(s.turn.phase,"A");
});

test("mine income and monastery 2 workers apply to placed tiles including phase E", () => {
  const s=phaseEnd(); s.turn.phase="E";
  s.market.numberedDepots[0].slots[0].tileId=null;
  s.players[0].duchy.cells.push({id:"mine",coord:{q:1,r:0},terrain:"mine",number:1,regionId:"mine",tileId:"mine"});
  s.tiles.monk={id:"monk",type:"monastery",number:2,back:"matching-color"};
  s.players[0].duchy.cells.push({id:"monk",coord:{q:2,r:0},terrain:"monastery",number:2,regionId:"monk",tileId:"monk"});
  const next=act(s,{type:"advance-phase",playerId:"p1"});
  assert.equal(next.players[0].silver,4); assert.equal(next.players[0].workers,2);
  assert.equal(next.players[0].victoryPoints,8); // three goods + four silver + one worker pair
  assert.equal(applyCoreAction(next,{type:"advance-phase",playerId:"p1"}).ok,false);
  assert.deepEqual(finalScore(next,next.players[0]),{ok:true,value:next.finalScores![0]});
});

test("incomplete injected supply rejects atomically before income or refill", () => {
  const s=phaseEnd(); s.market.phaseGoods.B=Array.from({length:5},(_,i)=>({id:`b${i}`,type:1}));
  const before=structuredClone(s);
  assert.equal(applyCoreAction(s,{type:"advance-phase",playerId:"p1"}).ok,false); assert.deepEqual(s,before);
});

test("phase advance rejects early, wrong player, and unresolved choices", () => {
  const s=phaseEnd();
  assert.equal(applyCoreAction(s,{type:"advance-phase",playerId:"p2"}).ok,false);
  s.turn.round=4; assert.equal(applyCoreAction(s,{type:"advance-phase",playerId:"p1"}).ok,false);
  s.turn.round=5; s.turn.phase="E"; s.turn.pendingEffects.push({id:"x",playerId:"p1",kind:"extra-action",source:{document:"special-edition-rulebook",pages:[7],section:"test"},payload:null});
  assert.equal(applyCoreAction(s,{type:"advance-phase",playerId:"p1"}).ok,false);
});

test("verified monastery 16 counts only placed warehouses, never storage", () => {
  const s=phaseEnd();s.turn.phase="E";s.tiles.unknown={id:"unknown",type:"monastery",number:16,back:"matching-color"};
  s.players[0].storage[0]="unknown";
  assert.equal(applyCoreAction(s,{type:"advance-phase",playerId:"p1"}).ok,true); // storage never counts
  s.players[0].storage[0]=null;s.players[0].duchy.cells.push({id:"unknown",coord:{q:1,r:0},terrain:"monastery",number:1,regionId:"unknown",tileId:"unknown"});
  assert.equal(applyCoreAction(s,{type:"advance-phase",playerId:"p1"}).ok,true);
});

test("final score tie breaks by fewer empty cells, then the rear of the order track", () => {
  const s=phaseEnd();s.turn.phase="E";s.players[0].goods=[];s.players[0].workers=2;
  let finished=act(s,{type:"advance-phase",playerId:"p1"});
  let result=checkCoreGameEnd(finished);assert.ok(result.ok&&result.value.ended);assert.deepEqual(result.value.winnerIds,["p2"]);
  s.players[1].duchy.cells.push({id:"empty",coord:{q:1,r:0},terrain:"mine",number:1,regionId:"empty",tileId:null});
  finished=act(s,{type:"advance-phase",playerId:"p1"});result=checkCoreGameEnd(finished);
  assert.ok(result.ok&&result.value.ended);assert.deepEqual(result.value.winnerIds,["p1"]);
});
