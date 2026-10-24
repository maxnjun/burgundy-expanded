import { test } from "node:test";
import assert from "node:assert/strict";
import { setup, placed, step, roundtrip, mount, startPhase, choose } from "../fixtures/shields";
import { applyCoreAction } from "../../src/game/core/engine";
import { shieldLayout, setShieldLayout, shieldAcquireIssue, type ShieldAcquireAction } from "../../src/game/shields";
import { prepareTileEffect } from "../../src/game/core/effects";
import { directShieldActions } from "../../src/game/direct-actions";
import { parseSavedGame } from "../../src/game/save";
import type { GameState } from "../../src/game/types";

function actions(g:GameState){return shieldLayout(g)!.slots.flatMap(s=>directShieldActions(g,"seat-1",s.id));}
function saved(game:GameState){return JSON.stringify({format:"burgundy-local-v1",randomAlgorithm:"counter-v1",game,logs:[],view:{zoom:1,focus:false,table:true,boardZooms:{}}});}
test("no placed castle means no acquisition and no resources or slot mutate",()=>{
 const g=setup(),a=actions(g)[0];
 const empty={...g,players:g.players.map((p,i)=>i?p:{...p,duchy:{...p.duchy,cells:p.duchy.cells.map(c=>({...c,tileId:null}))}})};
 const before=JSON.stringify(empty);assert.ok(shieldAcquireIssue(empty,a));assert.equal(actions(empty).length,0);assert.equal(applyCoreAction(empty,a).ok,false);assert.equal(JSON.stringify(empty),before);
});
test("one castle acquisition binds its physical tile ID atomically and replacement is explicit",()=>{
 const g=setup(),a=actions(g)[0],next=step(g,a),m=shieldLayout(next)!.mounted[0];
 assert.equal(m.castleTileId,g.players[0].duchy.cells.find(c=>c.id===a.payload.castleCellId)!.tileId);
 assert.equal(shieldLayout(next)!.slots.find(s=>s.id===a.payload.slotId)!.shieldNumber,null);
 const ready={...next,dice:g.dice},replacement=actions(ready)[0];assert.equal(replacement.payload.replaceShieldNumber,m.shieldNumber);
 const before=JSON.stringify(ready);assert.equal(applyCoreAction(ready,{...replacement,payload:{...replacement.payload,replaceShieldNumber:null}}).ok,false);assert.equal(JSON.stringify(ready),before);
 const replaced=step(ready,replacement);assert.equal(shieldLayout(replaced)!.mounted.length,1);assert.equal(shieldLayout(replaced)!.mounted[0].castleTileId,m.castleTileId);assert.ok(!shieldLayout(replaced)!.removed.includes(m.shieldNumber));assert.equal(shieldLayout(replaced)!.slots.find(s=>s.id===replacement.payload.slotId)!.shieldNumber,m.shieldNumber);assert.deepEqual(roundtrip(replaced),replaced);
});
test("multiple castles each hold one shield; filling an empty castle preserves the other",()=>{
 const g=placed(setup(),0,{type:"castle",back:"matching-color"}),a=actions(g)[0],first=step(g,a),ready={...first,dice:g.dice};
 const other=actions(ready).find(a=>a.payload.castleCellId!==shieldLayout(first)!.mounted[0].cellId)!;
 assert.equal(other.payload.replaceShieldNumber,null);const next=step(ready,other),mounted=shieldLayout(next)!.mounted;
 assert.equal(mounted.length,2);assert.equal(new Set(mounted.map(m=>m.castleTileId)).size,2);assert.deepEqual(roundtrip(next),next);
});
test("opponent-only castle, empty castle terrain and missing destination reject atomically",()=>{
 const g=placed(setup(),1,{type:"castle",back:"matching-color"}),a=actions(g)[0];
 const foreign=g.players[1].duchy.cells.find(c=>c.tileId&&c.id!==g.players[0].duchy.startingCastleCellId)!;
 for(const castleCellId of [foreign.id,g.players[0].duchy.cells.find(c=>c.terrain==="castle"&&!c.tileId)!.id,"missing"]){const before=JSON.stringify(g);assert.equal(applyCoreAction(g,{...a,payload:{...a.payload,castleCellId}}).ok,false);assert.equal(JSON.stringify(g),before);}
 assert.equal(applyCoreAction(g,{...a,payload:{slotId:a.payload.slotId,steps:a.payload.steps,replaceShieldNumber:null}} as unknown as ShieldAcquireAction).ok,false);
});
test("legacy valid cell bindings resolve to tile IDs only after full save validation",()=>{
 const g=mount(setup(),9),layout=shieldLayout(g)!;
 const legacy=setShieldLayout(g,{...layout,mounted:layout.mounted.map(({shieldNumber,playerId,cellId})=>({shieldNumber,playerId,cellId}))});
 const expected=setShieldLayout(g,{...layout,mounted:layout.mounted.map(({sourceDepot,...m})=>{assert.ok(sourceDepot);return m;})});assert.deepEqual(parseSavedGame(saved(legacy)).game,expected);assert.ok(!JSON.stringify(legacy).includes("castleTileId"));
 const wrong=setShieldLayout(g,{...layout,mounted:layout.mounted.map(m=>({...m,castleTileId:"wrong-castle"}))});assert.throws(()=>parseSavedGame(saved(wrong)));
});
test("saves reject duplicate, foreign and non-castle mount relations instead of repairing them",()=>{
 const g=mount(mount(setup(),8),9),layout=shieldLayout(g)!;
 const a=layout.mounted[0],b=layout.mounted[1];
 for(const mounted of [[a,{...b,cellId:a.cellId,castleTileId:a.castleTileId}],layout.mounted.map(m=>({...m,playerId:"seat-2"})),layout.mounted.map(m=>({...m,cellId:g.players[0].duchy.cells.find(c=>c.terrain!=="castle")!.id}))])assert.throws(()=>parseSavedGame(saved(setShieldLayout(g,{...layout,mounted}))));
});
test("maintenance removal detaches the castle while paid shields retain exact tile bindings",()=>{
 const g=mount(mount(setup(),8),9);let next=startPhase(g);
 next=choose(next,o=>o.id.startsWith("remove:"));next=choose(next,o=>o.id.includes(":silver"));
 const remaining=shieldLayout(next)!.mounted;assert.equal(remaining.length,1);assert.equal(remaining[0].castleTileId,shieldLayout(g)!.mounted.find(m=>m.shieldNumber===remaining[0].shieldNumber)!.castleTileId);assert.deepEqual(roundtrip(next),next);
});
test("castle11 extra action also acquires and mounts on a physical castle as one choice",()=>{
 let g=placed(mount(setup(),11),0,{type:"castle",back:"matching-color"});
 const cell=g.players[0].duchy.cells.find(c=>c.tileId&&g.tiles[c.tileId].type==="castle"&&!shieldLayout(g)!.mounted.some(m=>m.cellId===c.id))!;
 g=prepareTileEffect(g,"seat-1",cell.tileId!);const dice=structuredClone(g.dice),workers=g.players[0].workers;
 const next=choose(g,o=>(o.payload as {shield?:{castleCellId:string}}|null)?.shield?.castleCellId===cell.id);
 assert.deepEqual(next.dice,dice);assert.equal(next.players[0].workers,workers);assert.equal(shieldLayout(next)!.mounted.find(m=>m.cellId===cell.id)!.castleTileId,cell.tileId);assert.equal(shieldLayout(next)!.mounted.length,2);
});
