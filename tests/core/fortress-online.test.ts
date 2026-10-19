import {test} from "node:test";import assert from "node:assert/strict";
import {mkdtemp,readFile,writeFile,rm} from "node:fs/promises";import {tmpdir} from "node:os";import {join,basename,dirname} from "node:path";
import {RoomStore,RoomError} from "../../src/server/rooms";
import {fortressFixture} from "../fixtures/fortress";
import {roomHandlers} from "../../src/server/room-http";
const status=(code:number)=>(e:unknown)=>e instanceof RoomError&&e.status===code;
test("online authoritative draft rejects forged/opponent/stale choices, gates game and persists reconnect",async()=>{
 const directory=await mkdtemp(join(tmpdir(),"burgundy-fortress-online-")),store=new RoomStore(directory);
 try{
  const owner=await store.create("A",false,false,"fortress"),guest=await store.joinRoom(owner.id,"B");let v=await store.view(owner.id,owner.token);
  assert.equal(v.actions.length,0);assert.ok(v.boardDraft);assert.ok(!JSON.stringify(v.boardDraft).includes('"random"'));
  const first=v.boardDraft!.seats[0].candidates[0];
  await assert.rejects(()=>store.act(owner.id,owner.token,v.revision,{type:"roll-round",playerId:"seat-1"}),status(409));
  await assert.rejects(()=>store.chooseBoard(owner.id,guest.token,v.revision,{playerId:"seat-1",boardId:first}),status(403));
  await assert.rejects(()=>store.chooseBoard(owner.id,owner.token,v.revision,{playerId:"seat-1",boardId:"se:base:1"}),status(400));
  const req=new Request("http://localhost/api/rooms/test/actions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${owner.token}`},body:JSON.stringify({revision:v.revision,action:{type:"choose-board",playerId:"seat-1",boardId:first}})});
  const response=await roomHandlers(store).act(req,owner.id);assert.equal(response.status,200);v=await response.json();
  assert.equal(v.boardDraft!.seats[0].selected,first);assert.equal(v.actions.length,0);
  const reconnect=await new RoomStore(directory).view(owner.id,owner.token);assert.deepEqual(reconnect.boardDraft,v.boardDraft);
  await assert.rejects(()=>store.chooseBoard(owner.id,owner.token,v.revision-1,{playerId:"seat-1",boardId:first}),status(409));
  v=await store.chooseBoard(owner.id,guest.token,v.revision,{playerId:"seat-2",range:"all"});const second=v.boardDraft!.seats[1].candidates[1];
  v=await store.chooseBoard(owner.id,guest.token,v.revision,{playerId:"seat-2",boardId:second});
  assert.deepEqual(v.players.map(p=>p.duchy.boardId),[first,second]);assert.ok((await store.view(owner.id,owner.token)).actions.some(a=>a.action.type==="roll-round"));
  await assert.rejects(()=>store.chooseBoard(owner.id,guest.token,v.revision,{playerId:"seat-2",boardId:second}),status(409));
  assert.deepEqual((await new RoomStore(directory).view(owner.id,owner.token)).boardDraft,v.boardDraft);
 }finally{assert.equal(dirname(directory),tmpdir());assert.ok(basename(directory).startsWith("burgundy-fortress-online-"));await rm(directory,{recursive:true});}
});
test("online fortress placement awards once and both clients reconnect to identical line state",async()=>{
 const directory=await mkdtemp(join(tmpdir(),"burgundy-fortress-online-")),store=new RoomStore(directory);
 try{
  const owner=await store.create("A"),guest=await store.joinRoom(owner.id,"B"),path=join(directory,`${owner.id}.json`),room=JSON.parse(await readFile(path,"utf8")),fixture=fortressFixture();room.game=fixture.game;await writeFile(path,JSON.stringify(room));
  const before=await store.view(owner.id,owner.token),after=await store.act(owner.id,owner.token,before.revision,fixture.action);
  assert.equal(after.fortressScores["seat-1"].length,1);assert.equal(after.fortressScores["seat-1"][0].points,10);assert.ok(after.logs[0].includes("요새 줄"));
  await assert.rejects(()=>store.act(owner.id,owner.token,after.revision,fixture.action),status(400));
  const reconnect=await new RoomStore(directory).view(owner.id,guest.token);assert.deepEqual(reconnect.fortressScores,after.fortressScores);assert.deepEqual(reconnect.players,after.players);
 }finally{assert.equal(dirname(directory),tmpdir());assert.ok(basename(directory).startsWith("burgundy-fortress-online-"));await rm(directory,{recursive:true});}
});
