import { test } from "node:test";
import assert from "node:assert/strict";
import type { GameAction, GameState } from "../../src/game/types";
import { applyCoreAction, validateCoreAction, advanceCoreTurn, listCoreActionOptions, validateCoreState, adjustedDie, orderedPlayers, drawDie } from "../../src/game/core";
import { coreFixture, addMonastery, type TestState } from "./fixture";

const workers = (id = "p1", die = "a"): GameAction => ({ type: "use-die", playerId: id, dieId: `${id}:${die}`,
  adjustment: { workersSpent: 0, steps: [] }, intent: { kind: "take-workers" } });
const take: GameAction = { ...workers(), type: "use-die", playerId: "p1", dieId: "p1:a", adjustment: { workersSpent: 0, steps: [] },
  intent: { kind: "take-tile", depot: 1, tileId: "mine", storageSlot: 0 } };
const sale: GameAction = { type: "use-die", playerId: "p1", dieId: "p1:a", adjustment: { workersSpent: 0, steps: [] }, intent: { kind: "sell-goods", goodsType: 1 } };
const buy: GameAction = { type: "buy-black-tile", playerId: "p1", tileId: "black", storageSlot: 0 };

function apply(state: GameState, action: GameAction): TestState {
  const result = applyCoreAction(state, action);
  assert.ok(result.ok, JSON.stringify(result));
  assert.equal(result.value.events.length, 1);
  assert.equal(result.value.state.revision, state.revision + 1);
  assert.deepEqual(validateCoreState(result.value.state), { valid: true });
  return structuredClone(result.value.state) as TestState;
}
function rejects(state: GameState, action: GameAction, code = "illegal-action") {
  const before = structuredClone(state);
  const result = applyCoreAction(state, action);
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.issues.some(i => i.code === code), JSON.stringify(result));
  assert.deepEqual(state, before, "failure must leave all input state unchanged");
}
function exhaust(state: TestState, id: string) { state.dice.players[id].forEach(d => { d.used = true; }); }
function fullStorage(state: TestState) {
  for (let i = 0; i < 3; i++) {
    const id = `stored-${i}`;
    state.tiles[id] = { id, type: "mine", back: "matching-color" };
    state.players[0].storage[i] = id;
  }
}
function deepFreeze(value: object) {
  Object.freeze(value);
  for (const child of Object.values(value)) if (child && typeof child === "object") deepFreeze(child);
}

test("TEST FIXTURE accepts 2/3/4 players without claiming any official geometry", () => {
  for (const count of [2, 3, 4] as const) {
    const state = coreFixture(count);
    assert.deepEqual(validateCoreState(state), { valid: true });
    assert.match(state.config.catalogId, /TEST-FIXTURE-NOT-OFFICIAL/);
  }
});
test("worker arithmetic wraps both directions and multiple steps", () => {
  assert.equal(adjustedDie(1, [-1]), 6);
  assert.equal(adjustedDie(6, [1]), 1);
  assert.equal(adjustedDie(2, [-1, -1]), 6);
});
test("worker action consumes one die, adds two workers, and leaves the other die untouched", () => {
  const state = coreFixture(); deepFreeze(state);
  const next = apply(state, workers());
  assert.equal(state.players[0].workers, 1);
  assert.equal(next.players[0].workers, 3);
  assert.equal(next.dice.players.p1[0].used, true);
  assert.deepEqual(next.dice.players.p1[1], state.dice.players.p1[1]);
});
test("worker cost is deducted atomically with the chosen action", () => {
  const state = coreFixture();
  const action: GameAction = { type: "use-die", playerId: "p1", dieId: "p1:a", adjustment: { workersSpent: 1, steps: [1] }, intent: { kind: "sell-goods", goodsType: 2 } };
  const next = apply(state, action);
  assert.equal(next.players[0].workers, 0);
  assert.equal(next.players[0].victoryPoints, 2);
  assert.equal(next.dice.players.p1[0].value, 2);
});
test("unaffordable, negative, fractional and mismatched worker costs are rejected", () => {
  for (const adjustment of [{ workersSpent: 2, steps: [1, 1] }, { workersSpent: -1, steps: [] },
    { workersSpent: .5, steps: [] }, { workersSpent: 0, steps: [1] }, { workersSpent: 1, steps: [2] }]) {
    rejects(coreFixture(), { ...workers(), adjustment } as GameAction);
  }
});
test("foreign, white, reused dice and wrong player cannot act", () => {
  const state = coreFixture();
  rejects(state, workers("p2"));
  rejects(state, { ...workers(), dieId: "p2:a" } as GameAction);
  rejects(state, { ...workers(), dieId: "white" } as GameAction);
  rejects(apply(state, workers()), workers());
});
test("sell full stack: 2/3/4 points per tile, one silver per stack, ledger and event", () => {
  for (const count of [2, 3, 4] as const) {
    const state = coreFixture(count);
    const result = applyCoreAction(state, sale); assert.ok(result.ok);
    const next = result.value.state, player = next.players[0];
    assert.equal(player.victoryPoints, 2 * count);
    assert.equal(player.silver, 4);
    assert.equal(player.soldGoods.length, 2);
    assert.equal(player.goods.length, 1);
    assert.equal(player.goods[0].type, 2);
    assert.equal(next.scoreLedger.p1[0].points, 2 * count);
    assert.deepEqual(result.value.events[0].source.pages, [6, 10, 11]);
    assert.equal((result.value.events[0].payload as { pointsDelta: number }).pointsDelta, 2 * count);
  }
});
test("sale of absent or wrong-number goods rejects without charging workers", () => {
  rejects(coreFixture(), { ...sale, intent: { kind: "sell-goods", goodsType: 2 } } as GameAction);
  const state = coreFixture(); state.players[0].goods = [];
  rejects(state, sale);
});
test("monasteries 3 and 4 modify each sale once, not per goods tile", () => {
  const state = coreFixture(); addMonastery(state, 3); addMonastery(state, 4);
  const next = apply(state, sale);
  assert.equal(next.players[0].silver, 5);
  assert.equal(next.players[0].workers, 2);
  assert.equal(next.players[0].victoryPoints, 4);
});
test("monasteries 13 and 14 modify only the worker action", () => {
  const state = coreFixture(); addMonastery(state, 13); addMonastery(state, 14);
  const next = apply(state, workers());
  assert.equal(next.players[0].workers, 5);
  assert.equal(next.players[0].silver, 4);
  assert.equal(apply(state, sale).players[0].silver, 4);
});
test("take tile moves depot -> storage without placing or scoring", () => {
  const state = coreFixture(), next = apply(state, take);
  assert.equal(next.market.numberedDepots[0].slots[0].tileId, null);
  assert.equal(next.players[0].storage[0], "mine");
  assert.deepEqual(next.players[0].duchy, state.players[0].duchy);
  assert.equal(next.players[0].victoryPoints, 0);
});
test("tile acquisition rejects mismatched depot, unknown tile and invalid storage", () => {
  for (const changes of [{ depot: 2 }, { tileId: "black" }, { storageSlot: -1 }, { storageSlot: 3 }, { storageSlot: .5 }]) {
    assert.equal(take.type, "use-die");
    rejects(coreFixture(), { ...take, intent: { ...take.intent, ...changes } } as GameAction);
  }
});
test("full tile storage requires explicit matching discard; discarded tile is preserved in removed zone", () => {
  const state = coreFixture(); fullStorage(state);
  rejects(state, take);
  assert.equal(take.type, "use-die");
  const next = apply(state, { ...take, intent: { ...take.intent, discardTileId: "stored-0" } } as GameAction);
  assert.equal(next.players[0].storage[0], "mine");
  assert.deepEqual(next.market.removedTileIds, ["stored-0"]);
  assert.ok(next.tiles["stored-0"]);
});
test("cannot discard a different storage tile or unnecessarily discard while an empty slot exists", () => {
  const state = coreFixture(); fullStorage(state);
  assert.equal(take.type, "use-die");
  rejects(state, { ...take, intent: { ...take.intent, discardTileId: "stored-1" } } as GameAction);
  state.players[0].storage[2] = null; state.market.removedTileIds.push("stored-2");
  rejects(state, { ...take, intent: { ...take.intent, discardTileId: "stored-0" } } as GameAction);
});
test("black purchase costs two silver, no die, once per turn", () => {
  const state = coreFixture(), next = apply(state, buy);
  assert.equal(next.players[0].silver, 1);
  assert.equal(next.players[0].storage[0], "black");
  assert.deepEqual(next.market.blackDepot, [null]);
  assert.deepEqual(next.dice, state.dice);
  assert.equal(next.turn.blackPurchaseUsed, true);
  const another = coreFixture(); another.turn.blackPurchaseUsed = true;
  rejects(another, buy);
});
test("black purchase may follow both dice, but insufficient silver and wrong source reject", () => {
  const state = coreFixture(); exhaust(state, "p1");
  assert.equal(apply(state, buy).players[0].silver, 1);
  state.players[0].silver = 1; rejects(state, buy);
  rejects(coreFixture(), { ...buy, tileId: "mine" } as GameAction);
});
test("black purchase also honors the full-storage discard rule", () => {
  const state = coreFixture(); fullStorage(state); rejects(state, buy);
  assert.equal(buy.type, "buy-black-tile");
  const next = apply(state, { ...buy, discardTileId: "stored-0" });
  assert.deepEqual(next.market.removedTileIds, ["stored-0"]);
});
test("cannot end turn with unused dice or pending effect/choice", () => {
  rejects(coreFixture(), { type: "end-turn", playerId: "p1" });
  const state = coreFixture(); exhaust(state, "p1");
  state.turn.pendingChoice = { id: "choice", playerId: "p1", source: { document: "special-edition-rulebook", pages: [7], section: "TEST" }, options: [] };
  rejects(state, { type: "end-turn", playerId: "p1" }, "unresolved-rule");
  state.turn.pendingChoice = null;
  state.turn.pendingEffects.push({ id: "effect", playerId: "p1", kind: "extra-action", payload: null, source: { document: "special-edition-rulebook", pages: [7], section: "TEST" } });
  rejects(state, workers(), "unresolved-rule");
});
test("turn transition follows track stacks, resets per-turn flags and skips already-acted players", () => {
  const state = coreFixture(3); exhaust(state, "p1");
  state.turn.orderTrack = [{ position: 2, players: ["p2"] }, { position: 1, players: ["p3", "p1"] }];
  state.turn.actedPlayerIds = ["p2"]; state.turn.blackPurchaseUsed = true; state.turn.monasterySixUsed = true;
  assert.deepEqual(orderedPlayers(state), ["p2", "p3", "p1"]);
  const next = apply(state, { type: "end-turn", playerId: "p1" });
  assert.equal(next.turn.activePlayerId, "p3");
  assert.deepEqual(next.turn.actedPlayerIds, ["p2", "p1"]);
  assert.equal(next.turn.blackPurchaseUsed, false);
  assert.equal(next.turn.monasterySixUsed, false);
});
test("last player moves to next round setup; advance cannot skip unrolled round", () => {
  const state = coreFixture(); state.turn.actedPlayerIds = ["p2"]; exhaust(state, "p1");
  const next = apply(state, { type: "end-turn", playerId: "p1" });
  assert.equal(next.turn.round, 2); assert.equal(next.turn.stage, "round-setup");
  assert.equal(next.turn.activePlayerId, null); assert.equal(next.dice.rolledForRound, false);
  assert.deepEqual(next.turn.actedPlayerIds, []);
  assert.equal(advanceCoreTurn(next).ok, false);
});
test("fifth round stops at phase-end, including E; income/final scoring are not fabricated", () => {
  for (const phase of ["A", "E"] as const) {
    const state = coreFixture(); state.turn.phase = phase; state.turn.round = 5;
    state.turn.actedPlayerIds = ["p2"]; state.market.roundGoods = []; exhaust(state, "p1");
    const next = apply(state, { type: "end-turn", playerId: "p1" });
    assert.equal(next.turn.stage, "phase-end"); assert.equal(next.turn.phase, phase);
    assert.equal(next.status, "playing"); assert.equal(next.finalScores, null);
    assert.equal(advanceCoreTurn(next).ok, false);
  }
});
test("roll round is deterministic for 2/3/4 players and distributes exactly the bottom-first good", () => {
  for (const count of [2, 3, 4] as const) {
    const state = coreFixture(count); state.turn.stage = "round-setup"; state.turn.activePlayerId = null;
    state.dice.rolledForRound = false; state.dice.roundGoodsDistributed = false;
    state.market.roundGoods.unshift({ id: "bottom-first", type: 6 });
    const next = apply(state, { type: "roll-round", playerId: "p1" });
    assert.deepEqual(next, apply(state, { type: "roll-round", playerId: "p1" }));
    assert.equal(next.random.cursor, 2 * count + 1);
    assert.equal(next.turn.activePlayerId, "p1");
    assert.equal(next.market.roundGoods.length, 4);
    const depot = next.market.numberedDepots.find(d => d.number === next.dice.whiteDie)!;
    assert.deepEqual(depot.goods, [{ id: "bottom-first", type: 6 }]);
    rejects(next, { type: "roll-round", playerId: "p1" });
  }
});
test("round rolls use seat order for RNG, track leader for action order, and cannot be called by another player", () => {
  const state = coreFixture(); state.turn.stage = "round-setup"; state.turn.activePlayerId = null;
  state.dice.rolledForRound = false; state.dice.roundGoodsDistributed = false;
  state.market.roundGoods.unshift({ id: "bottom-first", type: 6 });
  state.turn.orderTrack = [{ position: 0, players: ["p1"] }, { position: 1, players: ["p2"] }];
  rejects(state, { type: "roll-round", playerId: "p1" });
  assert.equal(apply(state, { type: "roll-round", playerId: "p2" }).turn.activePlayerId, "p2");
  state.market.roundGoods.pop(); rejects(state, { type: "roll-round", playerId: "p2" }, "incomplete-catalog");
});
test("drawDie supports saved cursor replay and rejects invalid/exhausted counters", () => {
  let random = { seed: "TEST-SEED", cursor: 0 };
  const values: number[] = [];
  for (let i = 0; i < 100; i++) { const next = drawDie(random); values.push(next.value); random = next.random; }
  assert.equal(new Set(values).size, 6);
  assert.ok(values.every(n => n >= 1 && n <= 6));
  assert.deepEqual(drawDie(random), drawDie(JSON.parse(JSON.stringify(random))));
  for (const cursor of [-1, .1, Infinity, Number.MAX_SAFE_INTEGER]) assert.throws(() => drawDie({ seed: "TEST", cursor }), RangeError);
});
test("supported action options are validated representatives and advertise incomplete scope", () => {
  const state = coreFixture();
  const options = listCoreActionOptions(state, "p1"); assert.ok(options.ok);
  assert.ok(options.value.actions.length > 0);
  assert.ok(options.value.actions.every(action => validateCoreAction(state, action).valid));
  assert.ok(options.value.unsupported.includes("official-supply-recipes-and-setup"));
  const other = listCoreActionOptions(state, "p2"); assert.ok(other.ok); assert.deepEqual(other.value.actions, []);
  assert.equal(listCoreActionOptions(state, "unknown").ok, false);
});
test("invalid placement, unowned monastery modifiers and extensions fail explicitly", () => {
  rejects(coreFixture(), { ...sale, intent: { kind: "place-tile", tileId: "mine", cellId: "start" } } as GameAction, "illegal-action");
  const state = coreFixture(); addMonastery(state, 8);
  assert.ok(applyCoreAction(state, { ...workers(), adjustment: { workersSpent: 1, steps: [1, 1] } } as GameAction).ok);
  rejects(coreFixture(), { ...workers(), adjustment: { workersSpent: 0, steps: [], monasteryNumber: 12 } } as GameAction, "illegal-action");
  rejects(coreFixture(), { type: "use-monastery-six", playerId: "p1", depot: 1, tileId: "mine", storageSlot: 0 }, "illegal-action");
  rejects(coreFixture(), { type: "extension", playerId: "p1", extensionId: "shields", command: "TEST", payload: null }, "unsupported-extension");
});
test("malformed state, negative resources, duplicate tile/goods/dice and score mismatch reject", () => {
  const mutations: ((s: TestState) => void)[] = [s => { s.players[0].workers = -1; },
    s => { s.players[0].storage[0] = "mine"; }, s => { s.players[0].storage[0] = "missing"; },
    s => { s.players[0].goods[0].tiles.push(s.players[0].goods[0].tiles[0]); },
    s => { s.dice.players.p1[1].id = "p1:a"; }, s => { s.players[0].victoryPoints = 10; },
    s => { s.turn.orderTrack[0].players = ["p1", "p1"]; }, s => { s.turn.round = 6 as never; },
    s => { s.market.roundGoods.pop(); }, s => { s.tiles.black.back = "matching-color"; },
    s => { s.market.numberedDepots[0].slots[0].requiredType = "castle"; }];
  for (const mutate of mutations) { const state = coreFixture(); mutate(state); rejects(state, workers(), "invalid-config"); }
  assert.equal(validateCoreState(null as never).valid, false);
  rejects(coreFixture(), null as never);
});
test("resource overflow rolls back rather than committing unsafe numbers", () => {
  const state = coreFixture(); state.players[0].workers = Number.MAX_SAFE_INTEGER;
  rejects(state, workers(), "invalid-config");
});
test("five rounds of 2/3/4-player worker actions run to phase boundary without state loss", () => {
  for (const count of [2, 3, 4] as const) {
    let state = coreFixture(count); let actionCount = 0;
    while (state.turn.stage !== "phase-end") {
      if (state.turn.stage === "round-setup") state = apply(state, { type: "roll-round", playerId: orderedPlayers(state)[0] });
      const playerId = state.turn.activePlayerId!;
      state = apply(state, workers(playerId, "a"));
      state = apply(state, workers(playerId, "b"));
      actionCount += 2;
      const next = advanceCoreTurn(state); assert.ok(next.ok); state = structuredClone(next.value.state) as TestState;
    }
    assert.equal(actionCount, count * 10);
    assert.equal(state.market.roundGoods.length, 0);
    assert.deepEqual(state.players.map(p => p.workers), Array.from({ length: count }, (_, i) => i + 21));
  }
});
