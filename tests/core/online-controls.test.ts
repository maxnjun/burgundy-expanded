import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,readFile,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {RoomStore,RoomError} from "../../src/server/rooms";
import {beginHistory} from "../../src/game/turn-history";
import {setup} from "../fixtures/shields";
import {vineFixture} from "../fixtures/vineyards";
import {directActions,directShieldActions} from "../../src/game/direct-actions";
import type {GameState,GameAction} from "../../src/game/types";

const withoutRevision=(game:Record<string,unknown>)=>({...game,revision:0});
async function fixture(setup=false){const directory=await mkdtemp(join(tmpdir(),"burgundy-controls-")),store=new RoomStore(directory),a=await store.create("A",true,true,null,true,true,true,[],setup),b=await store.joinRoom(a.id,"B"),path=join(directory,a.id+".json");return {directory,store,a,b,path,raw:async()=>JSON.parse(await readFile(path,"utf8"))};}
test("starting preview moves, cancels, survives restart and confirms only at the owner's turn end",async()=>{
 const f=await fixture(true);let v=await f.store.view(f.a.id,f.a.token);const first=v.actions[0].action,second=v.actions[1].action;
 assert.equal(first.type,"place-starting-castle");assert.equal(second.type,"place-starting-castle");
 assert.equal((await f.store.view(f.a.id,f.b.token)).actions.length,0);
 v=await f.store.act(f.a.id,f.a.token,v.revision,first);assert.ok(v.startingPreview);assert.equal(v.activePlayerId,"seat-1");assert.equal((await f.raw()).game.players[0].duchy.cells.filter((c:{tileId:string|null})=>c.tileId).length,0);
 v=await f.store.act(f.a.id,f.a.token,v.revision,second);assert.equal(v.startingPreview!.cellId,(second as {cellId:string}).cellId);
 const restarted=new RoomStore(f.directory);assert.deepEqual(await restarted.view(f.a.id,f.a.token),v);assert.deepEqual((await restarted.view(f.a.id,f.b.token)).startingPreview,v.startingPreview);
 v=await restarted.act(f.a.id,f.a.token,v.revision,{type:"undo-turn",playerId:"seat-1"});assert.equal(v.startingPreview,undefined);
 await assert.rejects(restarted.act(f.a.id,f.a.token,v.revision,{type:"end-turn",playerId:"seat-1"}));
 v=await restarted.act(f.a.id,f.a.token,v.revision,first);v=await restarted.act(f.a.id,f.a.token,v.revision,{type:"end-turn",playerId:"seat-1"});assert.equal(v.activePlayerId,"seat-2");assert.equal(v.startingPreview,undefined);
 await assert.rejects(restarted.act(f.a.id,f.a.token,v.revision,{type:"undo-turn",playerId:"seat-1"}));
 let g=await restarted.view(f.a.id,f.b.token);g=await restarted.act(f.a.id,f.b.token,g.revision,g.actions[0].action);g=await restarted.act(f.a.id,f.b.token,g.revision,{type:"end-turn",playerId:"seat-2"});assert.equal(g.status,"playing");assert.ok(g.players.every(p=>p.duchy.cells.filter(c=>c.tileId).length===1));
});
test("both online undo kinds restore complete game/RNG, branch, persist and reject duplicate/other-turn commands",async()=>{
 const f=await fixture();let v=await f.store.view(f.a.id,f.a.token);v=await f.store.act(f.a.id,f.a.token,v.revision,v.actions.find(x=>x.action.type==="roll-round")!.action);const start=await f.raw();
 const workers=()=>v.actions.find(x=>x.action.type==="use-die"&&x.action.intent.kind==="take-workers"&&x.action.adjustment.workersSpent===0)!.action;
 v=await f.store.act(f.a.id,f.a.token,v.revision,workers());const once=await f.raw();v=await f.store.act(f.a.id,f.a.token,v.revision,workers());assert.equal(v.undo!.turnReason,"");assert.equal(v.undo!.actionReason,"");
 const oldRevision=v.revision,restarted=new RoomStore(f.directory);v=await restarted.act(f.a.id,f.a.token,v.revision,{type:"undo-action",playerId:"seat-1"});assert.deepEqual(withoutRevision((await f.raw()).game),withoutRevision(once.game));assert.ok(v.revision>oldRevision);
 await assert.rejects(restarted.act(f.a.id,f.a.token,oldRevision,{type:"undo-action",playerId:"seat-1"}),(e:unknown)=>e instanceof RoomError&&e.status===409);
 await assert.rejects(restarted.act(f.a.id,f.b.token,v.revision,{type:"undo-turn",playerId:"seat-1"}),(e:unknown)=>e instanceof RoomError&&e.status===403);
 v=await restarted.act(f.a.id,f.a.token,v.revision,{type:"undo-action",playerId:"seat-1"});assert.deepEqual(withoutRevision((await f.raw()).game),withoutRevision(start.game));
 v=await restarted.act(f.a.id,f.a.token,v.revision,workers());v=await restarted.act(f.a.id,f.a.token,v.revision,{type:"undo-turn",playerId:"seat-1"});assert.deepEqual(withoutRevision((await f.raw()).game),withoutRevision(start.game));assert.equal(v.logs.join(),start.logs.join());
 for(let i=0;i<2;i++)v=await restarted.act(f.a.id,f.a.token,v.revision,workers());v=await restarted.act(f.a.id,f.a.token,v.revision,{type:"end-turn",playerId:"seat-1"});
 assert.notEqual(v.undo!.turnReason,"");await assert.rejects(restarted.act(f.a.id,f.a.token,v.revision,{type:"undo-action",playerId:"seat-1"}));
 const guest=await restarted.view(f.a.id,f.b.token);assert.equal(guest.activePlayerId,"seat-2");
 assert.equal((await f.raw()).history.past.length,0);
});
test("unknown legacy history is not fabricated, snapshot payloads stay private and random barriers discard unsafe undo",async()=>{
 const f=await fixture();let v=await f.store.view(f.a.id,f.a.token);v=await f.store.act(f.a.id,f.a.token,v.revision,v.actions[0].action);
 const room=await f.raw();delete room.history;await writeFile(f.path,JSON.stringify(room));
 v=await f.store.view(f.a.id,f.a.token);const take=v.actions.find(x=>x.action.type==="use-die"&&x.action.intent.kind==="take-workers")!.action;v=await f.store.act(f.a.id,f.a.token,v.revision,take);
 assert.notEqual(v.undo!.turnReason,"");assert.equal(v.undo!.actionReason,"");assert.equal("history" in v,false);assert.equal("random" in v,false);
 // A persisted barrier must never acquire a fabricated start snapshot on reload.
 const changed=await f.raw();changed.history=beginHistory(changed.game,changed.logs);changed.undoBarrier="새 무작위 결과";await writeFile(f.path,JSON.stringify(changed));assert.match((await new RoomStore(f.directory).view(f.a.id,f.a.token)).undo!.turnReason,/무작위/);
});
for(const kind of ["shield","vineyard","sale"] as const)test(`server undo restores ${kind} resources, scoring, effects and all engine state`,async()=>{
 const f=await fixture();let game:GameState=kind==="vineyard"?vineFixture():setup();
 if(kind==="sale")game={...game,players:game.players.map((p,i)=>i?p:{...p,goods:[{type:1,tiles:[{id:"undo-sale",type:1}]}]})};
 if(kind==="vineyard"){
  const a=directActions(game,"seat-1").find(a=>a.type==="use-die"&&a.intent.kind==="vineyard"&&a.intent.command==="take")!;
  const {applyCoreAction}=await import("../../src/game/core");const result=applyCoreAction(game,a);assert.ok(result.ok);game=result.value.state;
 }
 const stored=await f.raw();stored.game=game;stored.history=beginHistory(game,stored.logs,true);await writeFile(f.path,JSON.stringify(stored));const before=await f.raw();
 const action:GameAction=kind==="shield"?directShieldActions(game,"seat-1",(game.extensionStates.shields as unknown as {slots:{id:string}[]}).slots[0].id)[0]:directActions(game,"seat-1").find(a=>a.type==="use-die"&&(kind==="sale"?a.intent.kind==="sell-goods":a.intent.kind==="vineyard"&&a.intent.command==="place"))!;
 assert.ok(action);let view=await f.store.act(f.a.id,f.a.token,game.revision,action),guard=0;
 while(view.actions.some(a=>a.action.type==="resolve-choice")){
  assert.ok(++guard<30);const a=view.actions.find(a=>a.action.type==="resolve-choice"&&a.action.optionId==="skip")??view.actions.find(a=>a.action.type==="resolve-choice")!;view=await f.store.act(f.a.id,f.a.token,view.revision,a.action);
 }
 view=await new RoomStore(f.directory).act(f.a.id,f.a.token,view.revision,{type:"undo-action",playerId:"seat-1"});
 assert.deepEqual(withoutRevision((await f.raw()).game),withoutRevision(before.game));assert.ok(view.revision>game.revision);
});
