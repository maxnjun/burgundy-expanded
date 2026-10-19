import { test } from "node:test";
import assert from "node:assert/strict";
import { coreFixture, type TestState } from "./fixture";
import type { GameAction, GameState, BaseTile as Tile, ActionIntent, MonasteryNumber } from "../../src/game/types";
import { applyCoreAction, validateCoreAction, orderedPlayers } from "../../src/game/core";
import { deriveRegions } from "../../src/game/boards/regions";
import { adjustmentValid, planAdjustment } from "../../src/game/core/modifiers";
import { MONASTERY_BUILDINGS } from "../../src/game/core/monasteries";
import { finalScore } from "../../src/game/core/phases";
function geometry(s: TestState) { for (const r of deriveRegions(s.players[0].duchy.cells))
    for (const id of r.cellIds)
        s.players[0].duchy.cells.find(c => c.id === id)!.regionId = r.id; }
function cell(s: TestState, id: string, q: number, r: number, tile: Tile, placed = false, number: 1 | 2 | 3 | 4 | 5 | 6 = 1) {
    s.tiles[tile.id] = tile;
    s.players[0].duchy.cells.push({ id, coord: { q, r }, terrain: tile.type, number, regionId: id, tileId: placed ? tile.id : null });
    geometry(s);
}
function monk(s: TestState, n: MonasteryNumber) { cell(s, `monk${n}`, 0, -1, { id: `monk${n}`, type: "monastery", number: n, back: "matching-color" }, true); }
function act(s: GameState, a: GameAction): GameState { const result = applyCoreAction(s, a); assert.ok(result.ok, JSON.stringify(result)); return result.value.state; }
function place(s: GameState, tileId: string, cellId: string) { return act(s, { type: "use-die", playerId: "p1", dieId: "p1:a", adjustment: { steps: [], workersSpent: 0 }, intent: { kind: "place-tile", tileId, cellId } }); }
function choose(s: GameState, predicate: (i: ActionIntent) => boolean) {
    const choice = s.turn.pendingChoice!;
    assert.ok(choice);
    const option = choice.options.find(o => { const p = o.payload as unknown as {
        intent?: ActionIntent;
    }; return p?.intent && predicate(p.intent); });
    assert.ok(option, JSON.stringify(choice.options));
    return act(s, { type: "resolve-choice", playerId: "p1", choiceId: choice.id, optionId: option.id });
}
const tile = (id: string, type: Tile["type"], building?: Extract<Tile, {
    type: "building";
}>["building"]): Tile => type === "building" ? { id, type, building: building!, back: "matching-color" } : { id, type: type as "castle" | "ship" | "mine", back: "matching-color" };
test("castle → town hall → bank chain resolves completely without another die/worker", () => {
    const s = coreFixture();
    cell(s, "c", 1, 0, tile("c", "castle"));
    cell(s, "hall", 2, 0, tile("hall", "building", "town-hall"), false, 4);
    cell(s, "bank", 3, 0, tile("bank", "building", "bank"), false, 6);
    s.players[0].storage = ["c", "hall", "bank"];
    let next = place(s, "c", "c");
    const originalChoice = next.turn.pendingChoice!.id;
    next = choose(next, i => i.kind === "place-tile" && i.tileId === "hall");
    next = choose(next, i => i.kind === "place-tile" && i.tileId === "bank");
    assert.equal(next.turn.pendingChoice, null);
    assert.equal(next.players[0].silver, 5);
    assert.equal(next.players[0].workers, 1);
    assert.deepEqual(next.dice.players.p1.map(d => d.used), [true, false]);
    assert.ok(next.players[0].storage.every(id => id === null));
    assert.equal(applyCoreAction(next, { type: "resolve-choice", playerId: "p1", choiceId: originalChoice, optionId: "skip" }).ok, false);
    assert.equal(s.players[0].duchy.cells.find(c => c.id === "c")!.tileId, null);
});
test("market, workshop and church offer only their allowed numbered-depot types", () => {
    for (const [building, allowed] of [["market", ["ship", "livestock"]], ["carpenters-workshop", ["building"]], ["church", ["mine", "castle", "monastery"]]] as const) {
        const s = coreFixture();
        cell(s, "target", 1, 0, tile("target", "building", building));
        s.players[0].storage[0] = "target";
        const extra: Tile[] = [tile("ship", "ship"), tile("building", "building", "bank"), tile("castle", "castle"), { id: "livestock", type: "livestock", species: "sheep", count: 3, back: "matching-color" }, { id: "yellow", type: "monastery", number: 1, back: "matching-color" }];
        for (const t of extra) {
            s.tiles[t.id] = t;
            s.market.numberedDepots[1].slots.push({ id: t.id, requiredType: t.type, tileId: t.id });
        }
        const next = place(s, "target", "target"), options = next.turn.pendingChoice!.options;
        assert.ok(options.some(o => o.id === "skip"));
        for (const o of options)
            if (o.id !== "skip") {
                const intent = (o.payload as unknown as {
                    intent: Extract<ActionIntent, {
                        kind: "take-tile";
                    }>;
                }).intent;
                assert.ok((allowed as readonly string[]).includes(next.tiles[intent.tileId].type));
                assert.notEqual(intent.tileId, "black");
            }
        const resolved = choose(next, i => i.kind === "take-tile");
        assert.equal(resolved.players[0].storage.filter(Boolean).length, 1);
        assert.equal(resolved.turn.pendingChoice, null);
    }
});
test("warehouse sale applies monastery 3/4 bonuses and full goods sale exactly once", () => {
    const s = coreFixture();
    cell(s, "warehouse", 1, 0, tile("warehouse", "building", "warehouse"));
    s.players[0].storage[0] = "warehouse";
    monk(s, 3);
    cell(s, "monk4", 1, -1, { id: "monk4", type: "monastery", number: 4, back: "matching-color" }, true);
    const placed = place(s, "warehouse", "warehouse"), next = choose(placed, i => i.kind === "sell-goods" && i.goodsType === 1);
    assert.equal(next.players[0].silver, 5);
    assert.equal(next.players[0].workers, 2);
    assert.equal(next.players[0].soldGoods.length, 2);
    assert.equal(next.scoreLedger.p1.filter(e => e.category === "goods-sale").reduce((n, e) => n + e.points, 0), 4);
    assert.equal(next.dice.players.p1[1].used, false);
});
test("a building with no available benefit may explicitly finish its immediate window", () => {
    const s = coreFixture();
    s.market.numberedDepots[0].slots[0].tileId = null;
    s.market.removedTileIds.push("mine");
    cell(s, "church", 1, 0, tile("church", "building", "church"));
    s.players[0].storage[0] = "church";
    const next = place(s, "church", "church");
    assert.deepEqual(next.turn.pendingChoice!.options.map(o => o.id), ["skip"]);
    assert.equal(act(next, { type: "resolve-choice", playerId: "p1", choiceId: next.turn.pendingChoice!.id, optionId: "skip" }).turn.pendingChoice, null);
});
test("an initially empty town hall window allows buying then placing a black tile", () => {
    const s = coreFixture();
    cell(s, "hall", 1, 0, tile("hall", "building", "town-hall"));
    cell(s, "bank-cell", 2, 0, tile("temporary", "building", "bank"));
    delete s.tiles.temporary;
    s.players[0].storage[0] = "hall";
    const placed = place(s, "hall", "hall");
    assert.deepEqual(placed.turn.pendingChoice!.options.map(o => o.id), ["skip"]);
    const bought = act(placed, { type: "buy-black-tile", playerId: "p1", tileId: "black", storageSlot: 0 });
    assert.ok(bought.turn.pendingChoice!.options.length > 1);
    const next = choose(bought, i => i.kind === "place-tile" && i.tileId === "black");
    assert.equal(next.players[0].duchy.cells.find(c => c.id === "bank-cell")!.tileId, "black");
    assert.equal(next.dice.players.p1[1].used, false);
});
test("black purchase during a castle benefit refreshes legal extra placements", () => {
    const s = coreFixture();
    cell(s, "c", 1, 0, tile("c", "castle"));
    cell(s, "town", 1, 1, tile("placeholder", "building", "bank"));
    delete s.tiles.placeholder;
    s.players[0].storage[0] = "c";
    const pending = place(s, "c", "c");
    const bought = act(pending, { type: "buy-black-tile", playerId: "p1", tileId: "black", storageSlot: 0 });
    assert.equal(bought.turn.blackPurchaseUsed, true);
    const next = choose(bought, i => i.kind === "place-tile" && i.tileId === "black");
    assert.equal(next.players[0].duchy.cells.find(c => c.id === "town")!.tileId, "black");
    assert.equal(next.players[0].silver, 3);
});
test("monastery 6 takes a numbered building for two workers once, even after both dice", () => {
    const s = coreFixture();
    monk(s, 6);
    s.players[0].workers = 4;
    s.tiles.bank = tile("bank", "building", "bank");
    s.market.numberedDepots[1].slots.push({ id: "bank", tileId: "bank", requiredType: "building" });
    s.dice.players.p1.forEach(d => { d.used = true; });
    const a: GameAction = { type: "use-monastery-six", playerId: "p1", depot: 2, tileId: "bank", storageSlot: 0 };
    const next = act(s, a);
    assert.equal(next.players[0].workers, 2);
    assert.equal(next.players[0].storage[0], "bank");
    assert.equal(next.turn.monasterySixUsed, true);
    assert.equal(applyCoreAction(next, a).ok, false);
    assert.equal(next.turn.blackPurchaseUsed, false);
});
test("monastery 5 takes a second adjacent depot, then advances the track only once", () => {
    const s = coreFixture();
    monk(s, 5);
    cell(s, "ship", 1, 0, tile("ship", "ship"));
    s.players[0].storage[0] = "ship";
    s.market.numberedDepots[0].goods = [{ id: "primary", type: 1 }];
    s.market.numberedDepots[5].goods = [{ id: "adjacent", type: 3 }];
    let next = place(s, "ship", "ship");
    let c = next.turn.pendingChoice!;
    next = act(next, { type: "resolve-choice", playerId: "p1", choiceId: c.id, optionId: "depot:1:types:" });
    assert.equal(next.turn.orderTrack[0].position, 0);
    c = next.turn.pendingChoice!;
    assert.ok(c.options.some(o => o.id.startsWith("depot:6")));
    assert.ok(!c.options.some(o => o.id.startsWith("depot:3")));
    next = act(next, { type: "resolve-choice", playerId: "p1", choiceId: c.id, optionId: "depot:6:types:3" });
    assert.equal(next.turn.pendingChoice, null);
    assert.equal(next.turn.orderTrack.find(s => s.players.includes("p1"))!.position, 1);
    assert.equal(next.players[0].goods.length, 3);
    assert.deepEqual(orderedPlayers(next), ["p1", "p2"]);
});
test("monastery 8 supports one/two pips per worker and combines with one free monastery pip", () => {
    const s = coreFixture();
    monk(s, 8);
    const p = s.players[0];
    p.workers = 3;
    const intent: ActionIntent = { kind: "take-workers" };
    assert.equal(adjustmentValid(s, p, intent, { workersSpent: 1, steps: [1, 1] }), true);
    assert.equal(adjustmentValid(s, p, intent, { workersSpent: 1, steps: [1, 1, 1] }), false);
    assert.equal(adjustmentValid(s, p, intent, { workersSpent: 1, steps: [1, -1] }), false);
    cell(s, "monk9", 1, -1, { id: "monk9", type: "monastery", number: 9, back: "matching-color" }, true);
    cell(s, "bank", 1, 0, tile("bank", "building", "bank"), false, 4);
    p.storage[0] = "bank";
    const action: GameAction = { type: "use-die", playerId: "p1", dieId: "p1:a", adjustment: { workersSpent: 1, steps: [1, 1, 1], monasteryNumber: 9 }, intent: { kind: "place-tile", tileId: "bank", cellId: "bank" } };
    assert.equal(validateCoreAction(s, action).valid, true);
    assert.equal(act(s, action).players[0].workers, 2);
});
test("monasteries 9-12 permit only their own action/terrain and never waive ownership", () => {
    for (const [n, type] of [[9, "building"], [10, "ship"], [11, "mine"]] as const) {
        const s = coreFixture();
        monk(s, n);
        cell(s, "target", 1, 0, tile("target", type, "bank"), false, 2);
        s.players[0].storage[0] = "target";
        s.players[0].workers = 0;
        const intent: ActionIntent = { kind: "place-tile", tileId: "target", cellId: "target" };
        const adjustment = planAdjustment(s, s.players[0], intent, [1]);
        assert.equal(adjustment.workersSpent, 0);
        assert.equal(adjustment.monasteryNumber, n);
        assert.ok(applyCoreAction(s, { type: "use-die", playerId: "p1", dieId: "p1:a", adjustment, intent }).ok);
        assert.equal(adjustmentValid(s, s.players[0], { kind: "take-workers" }, adjustment), false);
    }
    const s = coreFixture();
    monk(s, 12);
    s.dice.players.p1[0].value = 2;
    s.players[0].workers = 0;
    const intent: ActionIntent = { kind: "take-tile", depot: 1, tileId: "mine", storageSlot: 0 };
    assert.ok(applyCoreAction(s, { type: "use-die", playerId: "p1", dieId: "p1:a", adjustment: planAdjustment(s, s.players[0], intent, [-1]), intent }).ok);
});
test("all eight monastery building icons score their mapped building, excluding storage", () => {
    const expected = ["warehouse", "watchtower", "carpenters-workshop", "church", "market", "boarding-house", "bank", "town-hall"];
    for (let n = 16; n <= 23; n++) {
        assert.equal(MONASTERY_BUILDINGS[n], expected[n - 16]);
        const s = coreFixture();
        monk(s, n as MonasteryNumber);
        cell(s, "placed", 1, 0, tile("placed", "building", MONASTERY_BUILDINGS[n]), true);
        s.tiles.stored = tile("stored", "building", MONASTERY_BUILDINGS[n]);
        s.players[0].storage[0] = "stored";
        const result = finalScore(s, s.players[0]);
        assert.ok(result.ok);
        assert.equal(result.value.finalAdditions.find(e => e.category === "monastery")!.points, 4);
    }
});
