import { test } from "node:test";
import assert from "node:assert/strict";
import { createPracticeSession } from "../../src/game/practice";
import { drawSupplyTile } from "../../src/game/core/supply";

const fixture = () => createPracticeSession({ names: ["A", "B"], seed: "supply-test" });
test("shared supply sampling is deterministic, immutable and keeps colour/back eligibility", () => {
  const state = fixture(), snapshot = structuredClone(state);
  const draw = drawSupplyTile(state, "matching-color", "building");
  assert.deepEqual(draw, drawSupplyTile(state, "matching-color", "building"));
  assert.deepEqual(state, snapshot);
  assert.equal(state.tiles[draw.tileId].type, "building");
  assert.equal(state.tiles[draw.tileId].back, "matching-color");
  assert.ok(!draw.market.supplyPools.some(p => p.remainingTileIds.includes(draw.tileId)));
});
test("sequential black supply draws exhaust without replacement and never leak coloured tiles", () => {
  let state = fixture(); const selected = new Set<string>();
  const count = state.market.supplyPools.flatMap(p => p.remainingTileIds).filter(id => state.tiles[id].back === "black").length;
  for (let n = 0; n < count; n++) {
    const draw = drawSupplyTile(state, "black");
    assert.ok(!selected.has(draw.tileId)); selected.add(draw.tileId);
    assert.equal(state.tiles[draw.tileId].back, "black");
    state = { ...state, random: draw.random, market: { ...draw.market, removedTileIds: [...draw.market.removedTileIds, draw.tileId] } };
  }
  assert.throws(() => drawSupplyTile(state, "black"), /Insufficient/);
});
test("empty eligible supply and exhausted random cursor reject without changing input", () => {
  const state = fixture(), snapshot = structuredClone(state);
  assert.throws(() => drawSupplyTile({ ...state, market: { ...state.market, supplyPools: [] } }, "black"), /Insufficient/);
  assert.throws(() => drawSupplyTile({ ...state, random: { ...state.random, cursor: Number.MAX_SAFE_INTEGER } }, "matching-color"), /cursor/);
  assert.deepEqual(state, snapshot);
});
