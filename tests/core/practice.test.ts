import { test } from "node:test";
import assert from "node:assert/strict";
import { createPracticeSession, practiceBoard } from "../../src/game/practice";
import { validateBoardDefinition } from "../../src/game/boards/validation";
import { VERIFIED_BOARD_DEFINITIONS, getSelectableBoards } from "../../src/game/boards/catalog";
import { applyCoreAction, validateCoreState } from "../../src/game/core";

test("authored exercise boards have valid distinct geometry but no official number or verified status", () => {
  for (const variant of [0, 1]) {
    const board = practiceBoard(variant);
    assert.equal(board.cells.length, 37); assert.equal(board.officialNumber, null);
    assert.equal(board.verification.status, "synthetic-test"); assert.equal(validateBoardDefinition(board).valid, true);
    assert.ok(!VERIFIED_BOARD_DEFINITIONS.some(b => b.id === board.id));
    assert.ok(!getSelectableBoards().some(b => b.id === board.id));
  }
  assert.notDeepEqual(practiceBoard(0).cells, practiceBoard(1).cells);
});
test("practice initialization for 2/3/4 players is valid, deterministic, and starts with unrolled dice", () => {
  for (const count of [2, 3, 4]) {
    const config = { names: Array.from({ length: count }, (_, i) => `연습 ${i + 1}`), seed: "practice-test" };
    const s = createPracticeSession(config);
    assert.deepEqual(s, createPracticeSession(config)); assert.equal(validateCoreState(s).valid, true);
    assert.equal(s.turn.stage, "round-setup"); assert.equal(s.dice.rolledForRound, false);
    assert.ok(s.config.catalogId.startsWith("practice:"));
    for (const p of s.players) { assert.equal(p.silver, 1); assert.equal(p.workers, p.seat + 1); assert.equal(p.goods.reduce((n, g) => n + g.tiles.length, 0), 3); assert.equal(p.victoryPoints, 0); }
  }
});
test("practice retains full phase goods and draws starting goods without replacement", () => {
  const s = createPracticeSession({ names: ["a", "b", "c", "d"], seed: "goods" });
  const goods = [...s.market.roundGoods, ...Object.values(s.market.phaseGoods).flat(), ...s.players.flatMap(p => p.goods.flatMap(g => g.tiles))];
  assert.equal(goods.length, 37); assert.equal(new Set(goods.map(g => g.id)).size, 37);
  for (let type = 1; type <= 6; type++) assert.ok(goods.filter(g => g.type === type).length <= 7);
});
test("practice UI actions roll, change resources, consume dice and advance to the next player", () => {
  let s = createPracticeSession({ names: ["a", "b"], seed: "ui" });
  const roll = applyCoreAction(s, { type: "roll-round", playerId: "seat-1" }); assert.ok(roll.ok); s = roll.value.state;
  for (const die of s.dice.players["seat-1"]) {
    const next = applyCoreAction(s, { type: "use-die", playerId: "seat-1", dieId: die.id, adjustment: { workersSpent: 0, steps: [] }, intent: { kind: "take-workers" } });
    assert.ok(next.ok); s = next.value.state;
  }
  assert.equal(s.players[0].workers, 5);
  const end = applyCoreAction(s, { type: "end-turn", playerId: "seat-1" }); assert.ok(end.ok); assert.equal(end.value.state.turn.activePlayerId, "seat-2");
});
test("unverified official requests and unsupported player counts cannot start sessions", () => {
  assert.throws(() => createPracticeSession({ names: ["a", "b"], seed: "x", boardIds: ["se:solo:33"] }), /검증되지/);
  assert.throws(() => createPracticeSession({ names: ["a"], seed: "x" }));
  assert.throws(() => createPracticeSession({ names: ["a", "b"], seed: "" }));
});

test("selected official SE2 reaches actual player state without replacing practice supply", () => {
  const s = createPracticeSession({ names: ["a", "b"], seed: "official-board", boardIds: ["se:base:2", ""] });
  const board = VERIFIED_BOARD_DEFINITIONS.find(b => b.id === "se:base:2")!;
  assert.equal(validateCoreState(s).valid, true);
  assert.equal(s.players[0].duchy.boardId, board.id);
  assert.equal(s.config.players[0].boardId, board.id);
  assert.equal(s.players[1].duchy.boardId, "practice:generated:1");
  assert.deepEqual(s.players[0].duchy.cells.map(({ tileId, ...cell }) => { assert.ok(tileId === null || cell.id === "0,0"); return cell; }), board.cells);
  assert.equal(s.players[0].duchy.startingCastleCellId, "0,0");
  assert.equal(s.players[0].victoryPoints, 0);
  assert.equal(s.config.catalogId, "practice:non-official-supply");
});

test("2 to 4 players may each use the verified SE2 copy and roll a valid round", () => {
  for (const count of [2,3,4]) {
    const s = createPracticeSession({ names: Array(count).fill("영주"), seed: "se2-round", boardIds: Array(count).fill("se:base:2") });
    const result = applyCoreAction(s, { type: "roll-round", playerId: "seat-1" });
    assert.ok(result.ok);
    assert.equal(validateCoreState(result.value.state).valid, true);
    assert.ok(result.value.state.players.every(p => p.duchy.boardId === "se:base:2"));
  }
});

test("preparation preserves chosen colors, starting castles and clockwise workers from selected leader",()=>{
  const s=createPracticeSession({names:["a","b","c"],seed:"prepare",boardIds:Array(3).fill("se:base:2"),firstSeat:1,colors:["green","blue","red"],startingCastleIds:["0,-3","3,0","-3,3"],fullEffects:true});
  assert.deepEqual(s.turn.orderTrack[0].players,["seat-2","seat-3","seat-1"]);
  assert.deepEqual(s.players.map(p=>p.workers),[3,1,2]);assert.deepEqual(s.players.map(p=>p.color),["green","blue","red"]);
  assert.deepEqual(s.players.map(p=>p.duchy.startingCastleCellId),["0,-3","3,0","-3,3"]);assert.ok(s.players.every(p=>p.victoryPoints===0));
  assert.equal(validateCoreState(s).valid,true);assert.equal(s.config.startingPlayerId,"seat-2");
});
test("preparation rejects repeated colors, noncastle starts and nonexistent first seat",()=>{
  const config={names:["a","b"],seed:"bad-prepare",boardIds:["se:base:2","se:base:2"]};
  assert.throws(()=>createPracticeSession({...config,colors:["red","red"]}));
  assert.throws(()=>createPracticeSession({...config,startingCastleIds:["1,-3",""]}));
  assert.throws(()=>createPracticeSession({...config,firstSeat:2}));
});

test("every imported duchy and each of its four starting castles initializes and rolls with another map", () => {
  for (const board of VERIFIED_BOARD_DEFINITIONS) for (const start of board.startingCastle.allowedCellIds) {
    const state = createPracticeSession({ names: ["a", "b"], seed: "all-duchies", boardIds: [board.id, "se:base:2"], startingCastleIds: [start, "0,0"] });
    assert.equal(state.players[0].duchy.boardId, board.id);
    assert.equal(state.players[0].duchy.cells.filter(c => c.tileId).length, 1);
    assert.equal(state.players[0].duchy.cells.find(c => c.id === start)?.terrain, "castle");
    assert.equal(state.config.extensions.length, 0);
    assert.equal(validateCoreState(state).valid, true, `${board.id} start ${start}`);
    assert.ok(applyCoreAction(state, { type: "roll-round", playerId: "seat-1" }).ok, board.id);
  }
});
