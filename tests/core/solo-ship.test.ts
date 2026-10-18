import { test } from "node:test";
import assert from "node:assert/strict";
import { createPracticeSession } from "../../src/game/practice";
import type { DieValue, GameAction, GoodsTile, JsonValue } from "../../src/game/types";
import { applySoloShipAction, beginSoloShipEffect, soloTileHasEffect, validateSoloShipContext, type SoloShipContext } from "../../src/game/modes/solo-ship";

/** TEST FIXTURE: authored goods and placed source ship, not a verified solo map. */
function fixture(): SoloShipContext {
  const base = createPracticeSession({ names: ["solo-fixture", "unused"], seed: "solo-ship-fixture" }), player = base.players[0];
  const shipCell = player.duchy.cells.find(c => c.terrain === "ship")!, shipId = "test:placed-ship";
  const owned: GoodsTile[] = [1, 2, 3, 4, 5].map(type => ({ id: `test:owned:${type}`, type: type as DieValue }));
  return { revision: 0, player: { id: "solo", storage: [null, null, null], goods: owned.map(g => ({ type: g.type, tiles: [g] })), soldGoods: [],
    duchy: { ...player.duchy, cells: player.duchy.cells.map(c => c.id === shipCell.id ? { ...c, tileId: shipId } : c) } },
    tiles: { ...Object.fromEntries(Object.entries(base.tiles).filter(([id]) => id !== "practice-start:1")), [shipId]: { id: shipId, type: "ship", back: "matching-color" } },
    market: { ...base.market, numberedDepots: base.market.numberedDepots.map(d => ({ ...d, goods: d.number === 1 ? [{ id: "test:depot:1", type: 6 }] : d.number === 2 ? [{ id: "test:depot:2", type: 2 }, { id: "test:depot:3", type: 3 }] : [] })) },
    removedGoods: player.goods.flatMap(g => g.tiles), wildTileIds: [], resolvedShipTileIds: [], shipEffect: null };
}
function begun(): SoloShipContext {
  const initial = fixture(), result = beginSoloShipEffect(initial, "test:placed-ship");
  assert.ok(result.ok); assert.equal(result.value.revision, initial.revision); return result.value;
}
function command(state: SoloShipContext, name: string, payload: Record<string, JsonValue> = {}): Extract<GameAction, { type: "extension" }> {
  return { type: "extension", playerId: state.player.id, extensionId: "solo-game", command: name, payload: { choiceId: state.shipEffect!.id, ...payload } };
}
function step(state: SoloShipContext, name: string, payload: Record<string, JsonValue> = {}): SoloShipContext {
  const snapshot = structuredClone(state), result = applySoloShipAction(state, command(state, name, payload));
  assert.ok(result.ok, JSON.stringify(result)); assert.deepEqual(state, snapshot);
  assert.ok(validateSoloShipContext(result.value.state).valid);
  assert.equal(result.value.state.revision, state.revision + 1); assert.equal(result.value.events.length, 1);
  return result.value.state;
}
function reject(state: SoloShipContext, action: Extract<GameAction, { type: "extension" }>) {
  const before = structuredClone(state);
  assert.equal(applySoloShipAction(state, action).ok, false); assert.deepEqual(state, before);
}
test("solo ship takes ALL chosen depot goods, permits six types and removes every other depot's goods", () => {
  const state = step(begun(), "take-ship-goods", { depot: 1 });
  assert.equal(state.player.goods.length, 6);
  assert.ok(state.player.goods.flatMap(g => g.tiles).some(g => g.id === "test:depot:1"));
  assert.ok(state.removedGoods.some(g => g.id === "test:depot:2") && state.removedGoods.some(g => g.id === "test:depot:3"));
  assert.ok(state.market.numberedDepots.every(d => d.goods.length === 0));
  assert.equal(state.shipEffect!.stage, "exchange");
});
test("empty chosen depot still removes others and allows an exchange using already owned goods", () => {
  let state = step(begun(), "take-ship-goods", { depot: 6 });
  assert.equal(state.player.goods.flatMap(g => g.tiles).length, 5);
  assert.ok(state.removedGoods.some(g => g.id === "test:depot:1"));
  const tileId = state.market.blackDepot[0]!;
  state = step(state, "exchange-ship-goods", { tileId, goodsIds: state.player.goods.flatMap(g => g.tiles).map(g => g.id), storageSlot: 0 });
  assert.equal(state.player.storage[0], tileId); assert.deepEqual(state.wildTileIds, [tileId]);
  assert.equal(state.market.blackDepot[0], null); assert.equal(state.player.goods.length, 0);
  assert.equal(state.shipEffect, null); assert.deepEqual(state.resolvedShipTileIds, ["test:placed-ship"]);
});
test("five goods may come from mixed types, but sold, removed, foreign and repeated IDs never count", () => {
  const state = step(begun(), "take-ship-goods", { depot: 1 }), tileId = state.market.blackDepot[0]!, ids = state.player.goods.flatMap(g => g.tiles).map(g => g.id);
  for (const goodsIds of [ids.slice(0, 4), ids, [ids[0], ids[0], ...ids.slice(1, 4)], ["foreign", ...ids.slice(0, 4)], [state.removedGoods[0].id, ...ids.slice(0, 4)]]) reject(state, command(state, "exchange-ship-goods", { tileId, goodsIds, storageSlot: 0 }));
  const sold = state.player.goods[0].tiles[0];
  const soldState = { ...state, player: { ...state.player, goods: state.player.goods.filter(g => g.type !== sold.type), soldGoods: [sold] } };
  reject(soldState, command(soldState, "exchange-ship-goods", { tileId, goodsIds: ids.slice(0, 5), storageSlot: 0 }));
  const next = step(state, "exchange-ship-goods", { tileId, goodsIds: ids.slice(0, 5), storageSlot: 0 });
  assert.equal(next.player.goods.flatMap(g => g.tiles).length, 1);
});
test("exchange is optional once after collection, cannot precede collection and cannot be replayed", () => {
  const state = begun(), premature = command(state, "finish-ship"); reject(state, premature);
  reject(state, command(state, "exchange-ship-goods", { tileId: state.market.blackDepot[0], goodsIds: state.player.goods.flatMap(g => g.tiles).map(g => g.id), storageSlot: 0 }));
  let next = step(state, "take-ship-goods", { depot: 1 });
  reject(next, command(next, "take-ship-goods", { depot: 1 }));
  const finish = command(next, "finish-ship"); next = step(next, "finish-ship"); reject(next, finish);
  assert.equal(beginSoloShipEffect(next, "test:placed-ship").ok, false);
  assert.equal(next.player.goods.length, 6);
});
test("black-backed face-up ships remain active but five-goods wild ships never trigger effects", () => {
  const base = fixture(), id = "test:placed-ship";
  const faceUp = { ...base, tiles: { ...base.tiles, [id]: { id, type: "ship" as const, back: "black" as const } } };
  assert.equal(soloTileHasEffect(faceUp, id), true); assert.equal(beginSoloShipEffect(faceUp, id).ok, true);
  const wild = { ...faceUp, wildTileIds: [id] };
  assert.equal(soloTileHasEffect(wild, id), false); assert.equal(beginSoloShipEffect(wild, id).ok, false);
  const otherTerrain = { ...faceUp, player: { ...faceUp.player, duchy: { ...faceUp.player.duchy, cells: faceUp.player.duchy.cells.map(c => c.tileId === id ? { ...c, terrain: "mine" as const } : c) } } };
  assert.equal(validateSoloShipContext(otherTerrain).valid, false);
  assert.ok(validateSoloShipContext({ ...otherTerrain, wildTileIds: [id] }).valid);
  assert.equal(soloTileHasEffect(faceUp, "unknown"), false);
});
test("full three-slot storage needs explicit occupant discard and preserves it in the removed zone", () => {
  let state = begun();
  const ids = state.market.numberedDepots.flatMap(d => d.slots).slice(0, 3).map(s => s.tileId!);
  state = { ...state, player: { ...state.player, storage: ids }, market: { ...state.market, numberedDepots: state.market.numberedDepots.map(d => ({ ...d, slots: d.slots.map(s => ids.includes(s.tileId!) ? { ...s, tileId: null } : s) })) } };
  state = step(state, "take-ship-goods", { depot: 1 });
  const payload = { tileId: state.market.blackDepot[0]!, goodsIds: state.player.goods.flatMap(g => g.tiles).slice(0, 5).map(g => g.id), storageSlot: 1 };
  reject(state, command(state, "exchange-ship-goods", payload));
  reject(state, command(state, "exchange-ship-goods", { ...payload, discardTileId: ids[0] }));
  const next = step(state, "exchange-ship-goods", { ...payload, discardTileId: ids[1] });
  assert.ok(next.market.removedTileIds.includes(ids[1])); assert.equal(next.player.storage[1], payload.tileId);
});
test("foreign actors, stale window IDs, wrong extensions and invalid destinations reject atomically", () => {
  const state = step(begun(), "take-ship-goods", { depot: 1 }), good = command(state, "finish-ship");
  reject(state, { ...good, playerId: "other" }); reject(state, { ...good, extensionId: "team-game" });
  reject(state, { ...good, payload: { choiceId: "old" } }); reject(state, { ...good, payload: [] });
  reject(state, command(state, "unknown"));
  const goodsIds = state.player.goods.flatMap(g => g.tiles).slice(0, 5).map(g => g.id), tileId = state.market.blackDepot[0]!;
  for (const storageSlot of [-1, 3, 0.5]) reject(state, command(state, "exchange-ship-goods", { tileId, goodsIds, storageSlot }));
  reject(state, command(state, "exchange-ship-goods", { tileId: "unknown", goodsIds, storageSlot: 0 }));
  reject(state, command(state, "exchange-ship-goods", { tileId, goodsIds, storageSlot: 0, discardTileId: "not-owned" }));
});
test("ship context validation rejects duplicate tile/goods locations and malformed effect history", () => {
  const state = fixture(), tileId = state.market.blackDepot[0]!;
  const variants: SoloShipContext[] = [
    { ...state, player: { ...state.player, storage: [tileId, null, null] } },
    { ...state, wildTileIds: ["unknown"] },
    { ...state, removedGoods: [...state.removedGoods, state.player.goods[0].tiles[0]] },
    { ...state, resolvedShipTileIds: ["unknown"] },
    { ...state, shipEffect: { id: "test", tileId: "unknown", stage: "goods" } },
    { ...state, revision: -1 },
  ];
  for (const variant of variants) { assert.equal(validateSoloShipContext(variant).valid, false); assert.equal(beginSoloShipEffect(variant, "test:placed-ship").ok, false); }
});
test("pending and completed ship components retain wildcard/removed-goods history through JSON round trips", () => {
  let state = step(begun(), "take-ship-goods", { depot: 1 });
  state = JSON.parse(JSON.stringify(state)); assert.ok(validateSoloShipContext(state).valid);
  state = step(state, "exchange-ship-goods", { tileId: state.market.blackDepot[0], storageSlot: 2, goodsIds: state.player.goods.flatMap(g => g.tiles).slice(0, 5).map(g => g.id) });
  const restored = JSON.parse(JSON.stringify(state)); assert.ok(validateSoloShipContext(restored).valid); assert.deepEqual(restored, state);
  assert.equal(beginSoloShipEffect(restored, "test:placed-ship").ok, false);
});
test("revision overflow rejects a ship action without consuming goods or closing the window", () => {
  const state = { ...begun(), revision: Number.MAX_SAFE_INTEGER };
  reject(state, command(state, "take-ship-goods", { depot: 1 }));
  assert.equal(beginSoloShipEffect({ ...fixture(), revision: Number.MAX_SAFE_INTEGER }, "test:placed-ship").ok, false);
});
