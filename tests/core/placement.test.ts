import { test } from "node:test";
import assert from "node:assert/strict";
import { coreFixture, type TestState } from "./fixture";
import { applyCoreAction, validateCoreAction, listCoreActionOptions } from "../../src/game/core";
import type { GameAction, BaseTile as Tile } from "../../src/game/types";

/** TEST FIXTURE ONLY: connected injected geometry, no official board identity. */
function setup(tile: Tile = { id: "placed", type: "mine", back: "matching-color" }, size = 2): TestState {
  const s = coreFixture(); s.market.numberedDepots[0].slots[0].tileId = null;
  s.market.removedTileIds.push("mine"); s.tiles[tile.id] = tile; s.players[0].storage[0] = tile.id;
  for (let i = 1; i <= size; i++) s.players[0].duchy.cells.push({ id: `m${i}`, coord: { q: i, r: 0 }, terrain: tile.type, number: i === 1 ? 1 : 2, regionId: "test-region", tileId: null });
  if (tile.type === "castle") s.players[0].duchy.cells[0].regionId = "test-region";
  s.market.bonusTiles = [{ id: "first", color: tile.type, rank: "first", points: 5 }, { id: "second", color: tile.type, rank: "second", points: 2 }];
  return s;
}
function place(s: TestState, tileId = "placed", cellId = "m1", dieId = "p1:a"): TestState {
  const before = structuredClone(s);
  const result = applyCoreAction(s, { type: "use-die", playerId: "p1", dieId, adjustment: { workersSpent: 0, steps: [] }, intent: { kind: "place-tile", tileId, cellId } });
  assert.ok(result.ok, JSON.stringify(result)); assert.deepEqual(s, before);
  return structuredClone(result.value.state) as TestState;
}
const action = (cellId = "m1"): GameAction => ({ type: "use-die", playerId: "p1", dieId: "p1:a", adjustment: { workersSpent: 0, steps: [] }, intent: { kind: "place-tile", tileId: "placed", cellId } });

test("placement moves owned storage tile onto matching adjacent cell without scoring an incomplete region", () => {
  const s = setup(), next = place(s);
  assert.equal(next.players[0].storage[0], null); assert.equal(next.players[0].duchy.cells[1].tileId, "placed");
  assert.equal(next.players[0].victoryPoints, 0); assert.equal(next.dice.players.p1[0].used, true);
});
test("wrong terrain, number, occupied and nonadjacent cells reject atomically", () => {
  for (const mutate of [(s: TestState) => { s.players[0].duchy.cells[1].terrain = "building"; },
    (s: TestState) => { s.players[0].duchy.cells[1].number = 5; }]) {
    const s = setup(); mutate(s); const before = structuredClone(s);
    assert.equal(applyCoreAction(s, action()).ok, false); assert.deepEqual(s, before);
  }
  assert.equal(validateCoreAction(setup(), action("m2")).valid, false);
  assert.equal(validateCoreAction(setup(), action("start")).valid, false);
});
test("region completion scores size, phase, color bonus once and leaves second bonus available", () => {
  let s = setup(); s.tiles.secondMine = { id: "secondMine", type: "mine", back: "matching-color" }; s.players[0].storage[1] = "secondMine";
  s = place(s); s = place(s, "secondMine", "m2", "p1:b");
  assert.equal(s.players[0].victoryPoints, 18);
  assert.deepEqual(s.scoreLedger.p1.map(e => [e.category, e.points]), [["region-size", 3], ["phase-bonus", 10], ["color-bonus", 5]]);
  assert.deepEqual(s.market.bonusTiles.map(b => b.rank), ["second"]);
  assert.deepEqual(s.players[0].duchy.completedRegionIds, ["test-region"]);
  assert.equal(applyCoreAction(s, action()).ok, false);
});
test("all eight verified region sizes use the source table and phase E adds two", () => {
  for (let size = 1; size <= 8; size++) {
    const s = setup(undefined, size); s.turn.phase = "E"; s.market.bonusTiles = [];
    for (let i = 1; i < size; i++) { const id = `old${i}`; s.tiles[id] = { id, type: "mine", back: "matching-color" }; s.players[0].duchy.cells[i].tileId = id; }
    s.players[0].duchy.cells[size].number = 1;
    const next = place(s, "placed", `m${size}`);
    assert.equal(next.players[0].victoryPoints, [0, 1, 3, 6, 10, 15, 21, 28, 36][size] + 2);
  }
});
test("simple buildings apply their own effects alongside region points", () => {
  for (const building of ["bank", "boarding-house", "watchtower"] as const) {
    const next = place(setup({ id: "placed", type: "building", building, back: "matching-color" }, 1));
    assert.equal(next.players[0].silver, building === "bank" ? 5 : 3);
    assert.equal(next.players[0].workers, building === "boarding-house" ? 5 : 1);
    assert.equal(next.players[0].victoryPoints, building === "watchtower" ? 20 : 16);
  }
});
test("same city duplicate building is forbidden; monastery one permits it", () => {
  let s = setup({ id: "placed", type: "building", building: "bank", back: "matching-color" });
  s.tiles.another = { id: "another", type: "building", building: "bank", back: "matching-color" }; s.players[0].storage[1] = "another";
  s = place(s);
  const a: GameAction = { type: "use-die", playerId: "p1", dieId: "p1:b", adjustment: { workersSpent: 0, steps: [] }, intent: { kind: "place-tile", tileId: "another", cellId: "m2" } };
  assert.equal(validateCoreAction(s, a).valid, false);
  s.tiles.monk = { id: "monk", type: "monastery", number: 1, back: "matching-color" };
  s.players[0].duchy.cells.push({ id: "monk", coord: { q: 0, r: -1 }, terrain: "monastery", number: 1, regionId: "monk", tileId: "monk" });
  assert.equal(applyCoreAction(s, a).ok, true);
});
test("livestock scores same species across the pasture, not only adjacent tiles", () => {
  const s = setup({ id: "placed", type: "livestock", species: "sheep", count: 3, back: "matching-color" }, 3);
  s.tiles.sheep = { id: "sheep", type: "livestock", species: "sheep", count: 4, back: "matching-color" };
  s.tiles.pig = { id: "pig", type: "livestock", species: "pigs", count: 2, back: "matching-color" };
  s.players[0].duchy.cells[1].tileId = "sheep"; s.players[0].duchy.cells[2].tileId = "pig"; s.players[0].duchy.cells[3].number = 1;
  const next = place(s, "placed", "m3");
  assert.equal(next.scoreLedger.p1.find(e => e.category === "livestock")?.points, 7);
  assert.equal(next.players[0].victoryPoints, 28);
});
test("livestock on a different pasture does not score again", () => {
  const s = setup({ id: "placed", type: "livestock", species: "sheep", count: 3, back: "matching-color" }, 1);
  s.tiles.old = { id: "old", type: "livestock", species: "sheep", count: 4, back: "matching-color" };
  s.players[0].duchy.cells.push({ id: "other", coord: { q: 0, r: -1 }, terrain: "livestock", number: 1, regionId: "other", tileId: "old" });
  const next = place(s);
  assert.equal(next.scoreLedger.p1.find(e => e.category === "livestock")?.points, 3);
});
test("castle and town hall placements consume a die and resolve or queue their verified effects", () => {
  for (const tile of [{ id: "placed", type: "castle", back: "matching-color" },
    { id: "placed", type: "building", building: "town-hall", back: "matching-color" }] as Tile[]) {
    const s = setup(tile), before = structuredClone(s), result = applyCoreAction(s, action());
    assert.ok(result.ok, JSON.stringify(result)); assert.equal(result.value.state.dice.players.p1[0].used, true); assert.equal(result.value.state.players[0].storage[0], null); assert.deepEqual(s, before);
  }
});
test("supported action options include legal placement targets and exclude illegal cells", () => {
  const s = setup(), result = listCoreActionOptions(s, "p1"); assert.ok(result.ok);
  assert.ok(result.value.actions.some(a => a.type === "use-die" && a.intent.kind === "place-tile" && a.intent.cellId === "m1"));
  assert.ok(!result.value.actions.some(a => a.type === "use-die" && a.intent.kind === "place-tile" && a.intent.cellId === "start"));
});
