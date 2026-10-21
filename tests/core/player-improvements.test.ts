import {test} from "node:test";
import assert from "node:assert/strict";
import {vineFixture} from "../fixtures/vineyards";
import {applyCoreAction,listCoreActionOptions,validateCoreState} from "../../src/game/core";
import {resumeVineyards} from "../../src/game/core/vineyard-effects";
import type {GameState,GameAction} from "../../src/game/types";
const options=(g:GameState)=>{const r=listCoreActionOptions(g,g.turn.activePlayerId??"seat-1");assert.ok(r.ok);return r.value.actions;};
const step=(g:GameState,a:GameAction)=>{const r=applyCoreAction(g,a);assert.ok(r.ok,JSON.stringify(r));assert.ok(validateCoreState(r.value.state).valid);return r.value.state;};
for(const [slot,reward] of [["V01","workers"],["V02","silver"]] as const)test(`vine ${slot} auto ${reward}, choice only for remaining effect, idempotent`,()=>{
 let g=vineFixture();g=step(g,options(g).find(a=>a.type==="use-die"&&a.intent.kind==="vineyard"&&a.intent.command==="take")!);const before=g.players[0][reward];
 g=step(g,options(g).find(a=>a.type==="use-die"&&a.intent.kind==="vineyard"&&a.intent.slotId===slot)!);
 assert.equal(g.players[0][reward],before+(reward==="workers"?4:2));assert.equal(g.vineyards!.players['seat-1'].placed[0].used.includes(reward==="workers"?1:0),true);
 assert.ok(g.turn.pendingChoice);assert.ok(g.turn.pendingChoice.options.every(o=>!o.label.includes(reward==="workers"?"일꾼4":"은화2")));assert.deepEqual(resumeVineyards(g),g);
});

import {setup,mount,roundtrip} from "../fixtures/shields";
import {shieldLayout,shieldWorkerSteps,hasShield,type ShieldAcquireAction} from "../../src/game/shields";
for(const count of [2,3,4])test(`shield replacement ${count}p swaps into occupied source slot, conserves all18, can reacquire`,()=>{
 const initial=mount(setup(count),8),old=8,slot=shieldLayout(initial)!.slots.find(s=>s.shieldNumber!==null)!,pid=initial.players[0].id;
 const action:ShieldAcquireAction={type:"extension",extensionId:"shields",command:"acquire",playerId:pid,payload:{slotId:slot.id,castleCellId:initial.players[0].duchy.startingCastleCellId,replaceShieldNumber:old,steps:initial.dice.players[pid].map(d=>shieldWorkerSteps(d.value,slot.depot)) as [readonly (1|-1)[],readonly (1|-1)[]]}};
 let g=step(initial,action);assert.equal(hasShield(g,pid,8),false);assert.equal(shieldLayout(g)!.slots.find(s=>s.id===slot.id)!.shieldNumber,8);assert.deepEqual(roundtrip(g),g);
 g={...g,dice:initial.dice};g=step(g,{...action,payload:{...action.payload,replaceShieldNumber:slot.shieldNumber}});assert.equal(hasShield(g,pid,8),true);assert.equal(shieldLayout(g)!.slots.find(s=>s.id===slot.id)!.shieldNumber,slot.shieldNumber);
});

import {scoreRows} from "../../src/game/score-summary";
import {finalScore} from "../../src/game/core/phases";
test("score table includes every end item exactly once and preserves unrecorded historical points",()=>{
 const g=vineFixture(),p={...g.players[0],victoryPoints:17};const result=finalScore(g,p);assert.ok(result.ok);const score=result.value,rows=scoreRows(score);
 assert.equal(rows.earned.find(r=>r.id==="unclassified")!.points,17);assert.equal(rows.final.length,score.finalAdditions.length);assert.equal([...rows.earned,...rows.final].reduce((n,r)=>n+r.points,0),score.total);assert.deepEqual(scoreRows(score),rows);
});

import {createPracticeSession} from "../../src/game/practice";
import {chooseComputerAction} from "../../src/game/computer";
import {startingCastleCells} from "../../src/game/starting-castles";
for(const count of [2,3,4])test(`starting castle ${count}p blocks play, persists partial choices and uses no points or random draws`,()=>{
 let g=createPracticeSession({names:Array.from({length:count},(_,i)=>`P${i}`),seed:"starting-castles",chooseStartingCastles:true,officialSlots:true,firstSeat:count-1});assert.equal(g.status,"setup");assert.deepEqual(roundtrip(g),g);const cursor=g.random.cursor;
 for(const id of g.players.map(p=>p.id)){
  assert.ok(options(g).every(a=>a.type==="place-starting-castle"));assert.equal(applyCoreAction(g,{type:"roll-round",playerId:id}).ok,false);assert.equal(applyCoreAction(g,{type:"place-starting-castle",playerId:id,cellId:"invalid"}).ok,false);
  const cellId=startingCastleCells(g,id).at(-1)!;g=step(g,{type:"place-starting-castle",playerId:id,cellId});assert.equal(g.players.find(p=>p.id===id)!.duchy.startingCastleCellId,cellId);assert.equal(applyCoreAction(g,{type:"place-starting-castle",playerId:id,cellId}).ok,false);assert.deepEqual(roundtrip(g),g);
 }
 assert.equal(g.status,"playing");assert.equal(g.turn.stage,"round-setup");assert.equal(g.random.cursor,cursor);assert.ok(g.players.every(p=>p.victoryPoints===0&&p.storage.every(id=>id===null)&&p.duchy.cells.filter(c=>c.tileId).length===1));assert.equal(g.turn.pendingChoice,null);
});
test("AI chooses a legal recommended starting castle for each seat",()=>{
 let g=createPracticeSession({names:["AI1","AI2","AI3","AI4"],seed:"ai-start",chooseStartingCastles:true});let count=0;while(g.status==="setup"){assert.ok(++count<=4);const a=chooseComputerAction(g);assert.ok(a.ok);assert.equal(a.value.type,"place-starting-castle");g=step(g,a.value);}assert.equal(count,4);
});
import {RoomStore,RoomError} from "../../src/server/rooms";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
test("online starting castles enforce seat ownership, stale revision and reconnect without duplicate effects",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"burgundy-start-castles-"));try{let store=new RoomStore(dir);const a=await store.create("A",false,false,null,false,false,false,[],true),b=await store.joinRoom(a.id,"B");let v=await store.view(a.id,a.token);assert.equal(v.status,"setup");const action=v.actions.find(x=>x.action.type==="place-starting-castle")!.action;await assert.rejects(store.act(a.id,b.token,v.revision,action),(e:unknown)=>e instanceof RoomError&&e.status===403);v=await store.act(a.id,a.token,v.revision,action);assert.equal(v.actions.length,0);await assert.rejects(store.act(a.id,a.token,v.revision-1,action),(e:unknown)=>e instanceof RoomError&&e.status===409);store=new RoomStore(dir);const guest=await store.view(a.id,b.token);assert.equal(guest.status,"setup");const done=await store.act(a.id,b.token,guest.revision,guest.actions[0].action);assert.equal(done.status,"playing");assert.ok(done.players.every(p=>p.duchy.cells.filter(c=>c.tileId).length===1));}finally{await rm(dir,{recursive:true,force:true});}
});

import {automaticVineReward,refreshVineChoice} from "../../src/game/core/vineyard-effects";
import {automaticAction} from "../../src/game/direct-actions";
test("legacy saved fixed vine reward resumes once through a validated automatic action",()=>{
 let g=vineFixture();g=step(g,options(g).find(a=>a.type==="use-die"&&a.intent.kind==="vineyard"&&a.intent.command==="take")!);g=step(g,options(g).find(a=>a.type==="use-die"&&a.intent.kind==="vineyard"&&a.intent.slotId==="V02")!);
 const pid=g.players[0].id,id=`vine-order:${pid}:V02:0`;
 g=refreshVineChoice({...g,players:g.players.map((p,i)=>i?p:{...p,silver:p.silver-2}),vineyards:{...g.vineyards!,players:{...g.vineyards!.players,[pid]:{...g.vineyards!.players[pid],placed:g.vineyards!.players[pid].placed.map(x=>({...x,used:[]}))}}},turn:{...g.turn,pendingChoice:{...g.turn.pendingChoice!,id},pendingEffects:g.turn.pendingEffects.map(e=>({...e,id}))}});
 assert.ok(validateCoreState(g).valid);g=roundtrip(g);const before=g.players[0].silver,a=automaticVineReward(g)!;assert.ok(a);assert.deepEqual(automaticAction(g,options(g)),a);g=step(g,a);assert.equal(g.players[0].silver,before+2);assert.equal(automaticVineReward(g),null);assert.equal(applyCoreAction(g,a).ok,false);
});
