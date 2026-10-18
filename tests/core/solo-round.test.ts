import { test } from "node:test";
import assert from "node:assert/strict";
import { createPracticeSession } from "../../src/game/practice";
import { drawDie } from "../../src/game/core/random";
import { applySoloRoundAction, soloRemovalTarget, validateSoloRemovalPlan, type SoloRemovalPlan, type SoloRoundContext } from "../../src/game/modes/solo-round";
import type { DieValue } from "../../src/game/types";

/** TEST FIXTURE. Deliberately reversed slot order; never an official physical removal plan. */
function fixture(): { state: SoloRoundContext; plan: SoloRemovalPlan } {
  const base = createPracticeSession({ names: ["solo-fixture", "unused"], seed: "solo-round-fixture" });
  return { state: { playerId: "solo", revision: 0, phase: "A", round: 1, stage: "round-setup", dice: [{ id: "solo:1", value: 1, used: false }, { id: "solo:2", value: 1, used: false }], whiteDie: null,
    tiles: base.tiles, market: base.market, random: base.random },
    plan: { depots: base.market.numberedDepots.map(d => ({ depot: d.number, slotIds: d.slots.map(s => s.id).reverse() })) } };
}
function emptyDepots(state: SoloRoundContext, numbers: readonly number[]): SoloRoundContext {
  const removed = state.market.numberedDepots.filter(d => numbers.includes(d.number)).flatMap(d => d.slots.flatMap(s => s.tileId === null ? [] : [s.tileId]));
  return { ...state, market: { ...state.market, removedTileIds: [...state.market.removedTileIds, ...removed], numberedDepots: state.market.numberedDepots.map(d => numbers.includes(d.number) ? { ...d, slots: d.slots.map(s => ({ ...s, tileId: null })) } : d) } };
}
function withWhite(state: SoloRoundContext, white: DieValue): SoloRoundContext {
  for (let n = 0; n < 100; n++) {
    const random = { seed: `white-fixture:${n}`, cursor: 0 };
    const a = drawDie(random), b = drawDie(a.random), c = drawDie(b.random);
    if (c.value === white) return { ...state, random };
  }
  throw new Error("No deterministic white die fixture");
}
test("solo removal uses injected physical slot order and respects holes rather than storage array order", () => {
  const { state, plan } = fixture(), depot = state.market.numberedDepots[0];
  const first = soloRemovalTarget(state, 1, plan)!;
  assert.equal(first.slotId, depot.slots[1].id);
  assert.equal(first.tileId, depot.slots[1].tileId);
  const holes = { ...state, market: { ...state.market, numberedDepots: state.market.numberedDepots.map(d => d.number === 1 ? { ...d, slots: d.slots.map((s, i) => i === 1 ? { ...s, tileId: null } : s) } : d) } };
  assert.equal(soloRemovalTarget(holes, 1, plan)!.slotId, depot.slots[0].id);
});
test("empty depot fallback is clockwise by depot number, including 6 to 1 wrap", () => {
  const { state, plan } = fixture();
  assert.equal(soloRemovalTarget(emptyDepots(state, [2, 3]), 2, plan)!.depot, 4);
  assert.equal(soloRemovalTarget(emptyDepots(state, [6, 1]), 6, plan)!.depot, 2);
  const shuffled = { ...state, market: { ...state.market, numberedDepots: [...state.market.numberedDepots].reverse() } };
  assert.deepEqual(soloRemovalTarget(shuffled, 6, plan), soloRemovalTarget(state, 6, plan));
});
test("fully exhausted numbered supply returns no removal and never removes a black tile", () => {
  const { state, plan } = fixture(), empty = emptyDepots(state, [1, 2, 3, 4, 5, 6]);
  assert.equal(soloRemovalTarget(empty, 4, plan), null);
  const result = applySoloRoundAction(empty, { type: "roll-round", playerId: "solo" }, plan);
  assert.ok(result.ok);
  assert.deepEqual(result.value.state.market.blackDepot, empty.market.blackDepot);
  assert.deepEqual(result.value.state.market.removedTileIds, empty.market.removedTileIds);
  assert.equal(result.value.state.market.roundGoods.length, 4);
});
test("round roll resets two action dice, rolls white, distributes one good and removes one hex atomically", () => {
  const { state, plan } = fixture(), snapshot = structuredClone(state);
  const result = applySoloRoundAction(state, { type: "roll-round", playerId: "solo" }, plan);
  assert.ok(result.ok); assert.deepEqual(state, snapshot);
  const next = result.value.state, target = soloRemovalTarget(state, next.whiteDie!, plan)!;
  assert.equal(next.stage, "player-turn"); assert.equal(next.revision, 1);
  assert.ok(next.dice.every(d => !d.used)); assert.ok(next.random.cursor >= state.random.cursor + 3);
  assert.equal(next.market.numberedDepots.find(d => d.number === target.depot)!.slots.find(s => s.id === target.slotId)!.tileId, null);
  assert.ok(next.market.removedTileIds.includes(target.tileId));
  assert.ok(next.market.numberedDepots.find(d => d.number === next.whiteDie)!.goods.some(g => g.id === state.market.roundGoods[0].id));
  assert.deepEqual(result, applySoloRoundAction(state, { type: "roll-round", playerId: "solo" }, plan));
  assert.equal(result.value.events[0].type, "solo:roll-round");
});
test("goods go to the white depot even when its hex removal falls back to another depot", () => {
  const original = fixture(), state = withWhite(emptyDepots(original.state, [2, 3]), 2);
  const result = applySoloRoundAction(state, { type: "roll-round", playerId: "solo" }, original.plan); assert.ok(result.ok);
  const payload = result.value.events[0].payload as { goodsDepot: number; removedDepot: number };
  assert.equal(payload.goodsDepot, 2); assert.equal(payload.removedDepot, 4);
  assert.equal(result.value.state.market.numberedDepots.find(d => d.number === 2)!.goods.at(-1)!.id, state.market.roundGoods[0].id);
});
test("wrong owner and replayed rolls fail without consuming resources or randomness", () => {
  const { state, plan } = fixture(), before = structuredClone(state);
  assert.equal(applySoloRoundAction(state, { type: "roll-round", playerId: "other" }, plan).ok, false);
  const next = applySoloRoundAction(state, { type: "roll-round", playerId: "solo" }, plan); assert.ok(next.ok);
  assert.equal(applySoloRoundAction(next.value.state, { type: "roll-round", playerId: "solo" }, plan).ok, false);
  assert.deepEqual(state, before);
});
test("removal plan requires exactly all six depots and each depot's unique actual slots", () => {
  const { state, plan } = fixture();
  for (const bad of [{ depots: [] }, { depots: plan.depots.slice(1) }, { depots: [...plan.depots.slice(1), plan.depots[1]] },
    { depots: plan.depots.map((d, i) => i === 0 ? { ...d, slotIds: ["unknown", "other"] } : d) },
    { depots: plan.depots.map((d, i) => i === 0 ? { ...d, slotIds: [d.slotIds[0], d.slotIds[0]] } : d) }]) {
    assert.equal(validateSoloRemovalPlan(state, bad), false);
    assert.equal(applySoloRoundAction(state, { type: "roll-round", playerId: "solo" }, bad).ok, false);
  }
  assert.throws(() => soloRemovalTarget(state, 7 as never, plan));
});
test("malformed boundary, duplicate tile/goods, exhausted RNG and revision overflow reject immutably", () => {
  const { state, plan } = fixture();
  const variants: SoloRoundContext[] = [
    { ...state, round: 0 as never }, { ...state, phase: "F" as never }, { ...state, whiteDie: 1 },
    { ...state, dice: [state.dice[0], state.dice[0]] }, { ...state, market: { ...state.market, roundGoods: [] } },
    { ...state, market: { ...state.market, roundGoods: state.market.roundGoods.map(() => state.market.roundGoods[0]) } },
    { ...state, market: { ...state.market, removedTileIds: [...state.market.removedTileIds, state.market.numberedDepots[0].slots[0].tileId!] } },
    { ...state, random: { ...state.random, cursor: Number.MAX_SAFE_INTEGER } }, { ...state, revision: Number.MAX_SAFE_INTEGER },
  ];
  for (const variant of variants) {
    const snapshot = structuredClone(variant);
    assert.equal(applySoloRoundAction(variant, { type: "roll-round", playerId: "solo" }, plan).ok, false);
    assert.deepEqual(variant, snapshot);
  }
});
