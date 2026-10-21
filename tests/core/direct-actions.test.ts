import { test } from "node:test";
import assert from "node:assert/strict";
import { directActions, cheapestDieAction, directShieldActions, directCost, automaticAction } from "../../src/game/direct-actions";
import { validateCoreState } from "../../src/game/core/state";
import { applyCoreAction } from "../../src/game/core/engine";
import { prepareTileEffect } from "../../src/game/core/effects";
import { setup, mount, placed, roundtrip, stash } from "../fixtures/shields";
import type { GameState, Tile } from "../../src/game/types";
function dice(g:GameState,value:1|2|3|4|5|6,workers=30):GameState{return {...g,players:g.players.map((p,i)=>i===0?{...p,workers}:p),dice:{...g.dice,players:{...g.dice.players,"seat-1":[{...g.dice.players["seat-1"][0],value},g.dice.players["seat-1"][1]]}}};}
for(const [value,target,cost] of [[1,1,0],[1,2,1],[1,4,3],[1,6,1],[6,1,1]] as const)test(`direct minimum ${value} to ${target} costs ${cost}, preview pure`,()=>{const g=dice(setup(),value),before=JSON.stringify(g),a=cheapestDieAction(directActions(g,"seat-1"),g.dice.players["seat-1"][0].id,i=>i.kind==="take-tile"&&i.depot===target);assert.ok(a);assert.equal(directCost(g,a),cost);assert.equal(JSON.stringify(g),before);const next=applyCoreAction(g,a);assert.ok(next.ok);assert.equal(next.value.state.players[0].workers,g.players[0].workers-cost);assert.equal(next.value.state.dice.players["seat-1"][0].used,true);});
test("direct selection absent/used and insufficient workers cannot create action",()=>{let g=dice(setup(),1,0);const list=directActions(g,"seat-1"),id=g.dice.players["seat-1"][0].id;assert.equal(cheapestDieAction(list,undefined,()=>true),null);assert.equal(cheapestDieAction(list,id,i=>i.kind==="take-tile"&&i.depot===4),null);g={...g,dice:{...g.dice,players:{...g.dice.players,"seat-1":[{...g.dice.players["seat-1"][0],used:true},g.dice.players["seat-1"][1]]}}};assert.equal(cheapestDieAction(directActions(g,"seat-1"),id,()=>true),null);});
test("direct monastery discounts use same canonical engine validation",()=>{let g=dice(setup(),1,1);g=placed(g,0,{type:"monastery",number:12,back:"matching-color"} as Tile);const a=cheapestDieAction(directActions(g,"seat-1"),g.dice.players["seat-1"][0].id,i=>i.kind==="take-tile"&&i.depot===3);assert.ok(a);assert.equal(a.adjustment.workersSpent,1);assert.ok(applyCoreAction(g,a).ok);});
test("direct shield acquisition preserves fixed empty slots and roundtrips",()=>{const g=setup(),slot=(g.extensionStates.shields as unknown as {slots:{id:string;shieldNumber:number|null}[]}).slots.find(s=>s.shieldNumber!==null)!;const a=directShieldActions(g,"seat-1",slot.id)[0];assert.ok(a);const r=applyCoreAction(g,a);assert.ok(r.ok);assert.deepEqual(roundtrip(r.value.state),r.value.state);assert.equal(directShieldActions(r.value.state,"seat-1",slot.id).length,0);});
test("human turns never auto-end, with or without purchases and pending choices",()=>{let g=setup();g={...g,players:g.players.map(p=>({...p,silver:0})),dice:{...g.dice,players:{...g.dice.players,"seat-1":[{...g.dice.players["seat-1"][0],used:true},{...g.dice.players["seat-1"][1],used:true}]}}};assert.equal(automaticAction(g,directActions(g,"seat-1")),null);g={...g,players:g.players.map(p=>({...p,silver:30}))};assert.equal(automaticAction(g,directActions(g,"seat-1")),null);g=mount(g,9);g=placed(g,0,{type:"castle",back:"matching-color"});const tile=g.players[0].duchy.cells.filter(c=>c.tileId&&g.tiles[c.tileId].type==="castle").at(-1)!.tileId!;g=prepareTileEffect(g,"seat-1",tile);assert.equal(automaticAction(g,directActions(g,"seat-1")),null);});

test("direct automatic complete game saves every intermediate phase and first-choice chain",()=>{
 let g=mount(mount(setup(),3),14);g={...g,players:g.players.map((p,i)=>i===0?{...p,silver:0}:p)};
 for(let n=0;n<650&&g.status!=="finished";n++){
  const actor=g.turn.activePlayerId??g.turn.orderTrack[0].players[0],actions=directActions(g,actor);let action=automaticAction(g,actions);
  if(!action&&g.turn.pendingChoice){const c=g.turn.pendingChoice,o=c.options.find(o=>o.id.includes(":silver"))??c.options[0];action={type:"resolve-choice",playerId:c.playerId,choiceId:c.id,optionId:o.id};}
  if(!action){const id=g.dice.players[actor].find(d=>!d.used)?.id;action=cheapestDieAction(actions,id,i=>i.kind==="take-workers")??actions.find(a=>a.type==="end-turn")??null;}
  assert.ok(action);const result=applyCoreAction(g,action);assert.ok(result.ok);g=result.value.state;
  assert.doesNotThrow(()=>roundtrip(g),`save failed ${g.turn.phase}${g.turn.round} revision ${g.revision}`);
 }assert.equal(g.status,"finished");
});

test("pending action enumeration is immutable and retains canonical resolution validation",()=>{let g=mount(mount(setup(),14),18);g={...g,market:{...g.market,roundGoods:[],numberedDepots:g.market.numberedDepots.map((d,i)=>i===0?{...d,goods:[...d.goods,...g.market.roundGoods]}:d)},dice:{...g.dice,rolledForRound:false,roundGoodsDistributed:false,whiteDie:null},turn:{...g.turn,round:5,stage:"phase-end",activePlayerId:null,pendingChoice:null,pendingEffects:[],actedPlayerIds:[]}};const start=automaticAction(g,directActions(g,"seat-1"));assert.ok(start);const result=applyCoreAction(g,start);assert.ok(result.ok);g=result.value.state;const before=JSON.stringify(g),actions=directActions(g,"seat-1"),choice=actions.find(a=>a.type==="resolve-choice");assert.ok(choice);assert.ok(applyCoreAction(g,choice).ok);assert.equal(JSON.stringify(g),before);assert.equal(automaticAction(g,actions),null);});

for(const count of [2,3,4])test(`human ${count}p spent dice retain a legal explicit end and never auto-pass`,()=>{
 const initial=setup(count),g={...initial,dice:{...initial.dice,players:{...initial.dice.players,"seat-1":[{...initial.dice.players["seat-1"][0],used:true},{...initial.dice.players["seat-1"][1],used:true}] as const}}};
 const actions=directActions(g,"seat-1");assert.ok(actions.some(a=>a.type==="end-turn"));assert.equal(automaticAction(g,actions),null);assert.equal(g.turn.activePlayerId,"seat-1");
});
test("purchase hint source respects actual supply, silver, shared purchase flag and full-storage replacement",()=>{
 const g=setup(),buys=(s:GameState)=>directActions(s,"seat-1").filter(a=>a.type==="buy-black-tile");assert.ok(buys(g).length);
 const spent={...g,turn:{...g.turn,blackPurchaseUsed:true}},poor={...g,players:g.players.map(p=>({...p,silver:1}))};
 const empty={...g,market:{...g.market,blackDepot:g.market.blackDepot.map(()=>null),removedTileIds:[...g.market.removedTileIds,...g.market.blackDepot.filter((id):id is string=>!!id)]}};
 for(const state of [g,spent,poor,empty])assert.ok(validateCoreState(state).valid);
 assert.equal(buys(spent).length,0);assert.equal(buys(poor).length,0);assert.equal(buys(empty).length,0);
 let full=g;for(let n=0;n<3;n++)full=stash(full,{type:"mine",back:"matching-color"}).g;
 assert.ok(validateCoreState(full).valid);const replacements=buys(full);assert.ok(replacements.length);assert.ok(replacements.every(a=>a.type==="buy-black-tile"&&!!a.discardTileId));
});
