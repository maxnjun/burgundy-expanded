import { coreFixture, type TestState } from "../core/fixture";
import type { GameAction, GameState, Tile } from "../../src/game/types";
import { applyCoreAction } from "../../src/game/core";
import { createPracticeSession } from "../../src/game/practice";
import { prepareTileEffect } from "../../src/game/core/effects";

/** TEST FIXTURE ONLY: tiny injected geometry, never an official board. */
export function whiteFixture(): TestState {
  const s = coreFixture();
  s.config.extensions = [{ id: "white-castles", options: {} }, { id: "additional-hexes", options: {} }];
  s.tiles.white = { id: "white", type: "building", building: "white-castle", back: "matching-color" };
  s.players[0].storage[0] = "white";
  s.players[0].duchy.cells.push({ id: "target", coord: { q: 1, r: 0 }, terrain: "building", number: 1, regionId: "town", tileId: null });
  return s;
}
export function act(s: GameState, action: GameAction): GameState {
  const r = applyCoreAction(s, action);
  if (!r.ok) throw new Error(JSON.stringify(r));
  return r.value.state;
}
export function placeWhite(s: GameState): GameState {
  return act(s, { type: "use-die", playerId: "p1", dieId: "p1:a", adjustment: { workersSpent: 0, steps: [] }, intent: { kind: "place-tile", tileId: "white", cellId: "target" } });
}
export function choice(s: GameState, predicate: (payload: { intent?: Extract<GameAction,{type:"use-die"}>["intent"]; adjustment?: { workersSpent: number } }) => boolean): GameAction {
  const option = s.turn.pendingChoice!.options.find(o => o.payload && predicate(o.payload as Parameters<typeof predicate>[0]));
  if (!option) throw new Error("Missing TEST choice");
  return { type: "resolve-choice", playerId: s.turn.activePlayerId!, choiceId: s.turn.pendingChoice!.id, optionId: option.id };
}

/** Persistable TEST FIXTURE: actual registered board and catalog; bonus awaiting a paid sale. */
export function practicePending(): GameState {
  let s = createPracticeSession({ names: ["흰성A", "흰성B"], seed: "white-pending", officialSlots: true, boardIds: ["se:base:2", "se:base:2"], whiteCastles: true });
  s = act(s, { type: "roll-round", playerId: "seat-1" });
  const tileId = "white-castle:1", cell = s.players[0].duchy.cells.find(c=>c.terrain==="building")!;
  s = { ...s, market: { ...s.market, numberedDepots: s.market.numberedDepots.map(d=>({...d,slots:d.slots.map(slot=>slot.tileId===tileId?{...slot,tileId:null}:slot)})), blackDepot:s.market.blackDepot.map(id=>id===tileId?null:id), supplyPools:s.market.supplyPools.map(pool=>({...pool,remainingTileIds:pool.remainingTileIds.filter(id=>id!==tileId)})) },
    players:s.players.map((p,i)=>i?p:{...p,workers:2,goods:[{type:1,tiles:[{id:"white-test-sale",type:1}]}],duchy:{...p.duchy,cells:p.duchy.cells.map(c=>c.id===cell.id?{...c,tileId}:c)}}), dice:{...s.dice,whiteDie:6} };
  return prepareTileEffect(s,"seat-1",tileId);
}
export function placed(s: TestState, tile: Tile, q: number) {
  s.tiles[tile.id] = tile;
  s.players[0].duchy.cells.push({ id: tile.id, coord: { q, r: 1 }, terrain: tile.type, number: 1, regionId: tile.id, tileId: tile.id });
}
