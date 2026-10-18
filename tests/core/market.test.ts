import { test } from "node:test";
import assert from "node:assert/strict";
import { officialMarketRecipe } from "../../src/game/market-recipes";
import { createPracticeSession } from "../../src/game/practice";
import { applyCoreAction, validateCoreState } from "../../src/game/core";
import { parseSavedGame, serializeSavedGame } from "../../src/game/save";
import type { TestState } from "./fixture";
test("official 4-player source slots have the audited depot colors and 24+8 spaces", () => {
    const recipe = officialMarketRecipe(4, "A");
    assert.deepEqual(recipe.depots.map(d => d.slots.map(s => s.requiredType)), [
        ["monastery", "building", "ship", "livestock"], ["building", "monastery", "castle", "building"], ["building", "ship", "livestock", "monastery"],
        ["livestock", "ship", "building", "mine"], ["mine", "building", "monastery", "building"], ["building", "livestock", "castle", "ship"],
    ]);
    assert.equal(recipe.blackSlots, 8);
    for (const phase of ["B", "C", "D", "E"] as const)
        assert.deepEqual(officialMarketRecipe(4, phase), recipe);
});
test("3-player recipes omit marked-four slots and alternate only the identified 3BD slot", () => {
    for (const phase of ["A", "B", "C", "D", "E"] as const) {
        const recipe = officialMarketRecipe(3, phase);
        assert.equal(recipe.depots.flatMap(d => d.slots).length, 18);
        assert.equal(recipe.blackSlots, 6);
        assert.equal(recipe.depots[5].slots[2].id, "se:slot:6:2");
        assert.equal(recipe.depots[5].slots[2].requiredType, phase === "B" || phase === "D" ? "mine" : "castle");
    }
    assert.throws(() => officialMarketRecipe(1 as never, "A"));
});

test("two-player screenshot has exactly the twelve specified colored slots and four black slots", () => {
    const expected = [["building","ship"],["monastery","castle"],["livestock","building"],["ship","building"],["mine","monastery"],["building","livestock"]];
    for (const phase of ["A","B","C","D","E"] as const) {
        const recipe=officialMarketRecipe(2,phase);
        assert.deepEqual(recipe.depots.map(d=>d.slots.map(s=>s.requiredType)),expected);
        assert.equal(recipe.blackSlots,4);
    }
});

test("two-player finite project supply refills all five phases, discards hexes and retains goods and acquired tiles", () => {
    let state=createPracticeSession({names:["a","b"],seed:"two-player-photo",officialSlots:true,boardIds:["se:base:1","se:base:2"]});
    assert.equal(Object.keys(state.tiles).length,160);
    assert.equal(state.config.catalogId,"project:base-160-v1");
    const cows=Object.values(state.tiles).filter(t=>t.type==="livestock"&&t.species==="cattle");
    assert.equal(cows.length,6);
    assert.equal(cows.filter(t=>t.back==="black").length,2);
    const seen = new Set<string>();
    for (const phase of ["A","B","C","D","E"] as const) {
        assert.equal(state.turn.phase,phase);
        const ids=state.market.numberedDepots.flatMap(d=>d.slots.map(s=>s.tileId!)).concat(state.market.blackDepot as string[]);
        assert.equal(ids.length,16);
        for(const id of ids){assert.ok(!seen.has(id));seen.add(id);}
        for(const slot of state.market.numberedDepots.flatMap(d=>d.slots)){
            assert.equal(state.tiles[slot.tileId!].type,slot.requiredType);
            assert.equal(state.tiles[slot.tileId!].back,"matching-color");
        }
        assert.ok(state.market.blackDepot.every(id=>state.tiles[id!].back==="black"));
        if(phase==="E")break;
        const draft=structuredClone(state) as TestState;
        const acquired=draft.market.numberedDepots[0].slots[0].tileId!;
        draft.market.numberedDepots[0].slots[0].tileId=null;
        draft.players[0].storage[0]=acquired;
        // Move the previous storage tile to the box before acquiring another.
        const previous=state.players[0].storage[0];
        if(previous)draft.market.removedTileIds.push(previous);
        const good=draft.market.roundGoods.shift()!;
        draft.market.numberedDepots[0].goods.push(good);
        // Keep all remaining goods in a depot so conservation is exercised as well.
        draft.market.numberedDepots[1].goods.push(...draft.market.roundGoods);
        draft.market.roundGoods=[];draft.turn.stage="phase-end";draft.turn.round=5;
        const beforeGoods=structuredClone(draft.market.numberedDepots.map(d=>d.goods));
        const result=applyCoreAction(draft,{type:"advance-phase",playerId:"seat-1"});
        assert.ok(result.ok,JSON.stringify(result));
        state=result.value.state;
        assert.deepEqual(state.market.numberedDepots.map(d=>d.goods),beforeGoods);
        assert.equal(state.players[0].storage[0],acquired);
        assert.ok(!state.market.removedTileIds.includes(acquired));
        assert.ok(ids.filter(id=>id!==acquired).every(id=>state.market.removedTileIds.includes(id)));
        assert.equal(validateCoreState(state).valid,true);
    }
    assert.equal(seen.size,80);
    const saved={format:"burgundy-local-v1" as const,randomAlgorithm:"counter-v1" as const,game:state,logs:[],view:{zoom:1,focus:false,boardZooms:{}}};
    assert.deepEqual(parseSavedGame(serializeSavedGame(saved)),saved);
});

test("two-player initial supply is reproducible by seed and varies between seeds",()=>{
    const config={names:["a","b"],seed:"photo-a",officialSlots:true};
    const first=createPracticeSession(config);
    assert.deepEqual(first,createPracticeSession(config));
    assert.notDeepEqual(first.market,createPracticeSession({...config,seed:"photo-b"}).market);
});
test("3-player phase refill applies exact recipe identity and preserves a validated save", () => {
    const s = structuredClone(createPracticeSession({ names: ["a", "b", "c"], seed: "recipe", boardIds: Array(3).fill("se:base:2"), officialSlots: true })) as TestState;
    assert.equal(s.config.catalogId, "practice:non-official-supply");
    s.turn.stage = "phase-end";
    s.turn.round = 5;
    s.market.roundGoods = [];
    const result = applyCoreAction(s, { type: "advance-phase", playerId: "seat-1" });
    assert.ok(result.ok, JSON.stringify(result));
    assert.equal(validateCoreState(result.value.state).valid, true);
    const slot = result.value.state.market.numberedDepots[5].slots[2];
    assert.equal(slot.requiredType, "mine");
    assert.equal(result.value.state.tiles[slot.tileId!].type, "mine");
    const saved = { format: "burgundy-local-v1" as const, randomAlgorithm: "counter-v1" as const, game: result.value.state, logs: [], view: { zoom: 1, focus: false, boardZooms: {} } };
    assert.deepEqual(parseSavedGame(serializeSavedGame(saved)), saved);
});
