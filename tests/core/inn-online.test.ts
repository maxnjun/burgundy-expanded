import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,readFile,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,dirname,basename} from "node:path";
import {RoomStore,RoomError} from "../../src/server/rooms";
import {roomHandlers} from "../../src/server/room-http";
import {applyCoreAction} from "../../src/game/core";
import type {GameAction} from "../../src/game/types";

test("online inns validate option/actor/payment/region placement, sync stack and reconnect without replay",async()=>{
 const directory=await mkdtemp(join(tmpdir(),"burgundy-inn-online-")),store=new RoomStore(directory);
 try{
  await assert.rejects(()=>store.create("A",false,false,null,"true"),e=>e instanceof RoomError&&e.status===400);
  const res=await roomHandlers(store).create(new Request("http://localhost/api/rooms",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:"A",inns:true})}));assert.equal(res.status,200);
  const owner=await res.json(),guest=await store.joinRoom(owner.id,"B"),path=join(directory,`${owner.id}.json`);
  const room=JSON.parse(await readFile(path,"utf8"));const roll=applyCoreAction(room.game,{type:"roll-round",playerId:"seat-1"});assert.ok(roll.ok);room.game=roll.value.state;room.game.players[0].silver=4;room.game.players[0].workers=10;await writeFile(path,JSON.stringify(room));
  const before=await store.view(owner.id,owner.token);assert.equal(before.inns!.stack.length,1);assert.equal(before.tiles[before.inns!.stack[0]].type,"inn");
  const buy=before.actions.find(a=>a.action.type==="buy-black-tile"&&a.action.tileId===before.inns!.stack[0])!.action;assert.ok(buy);
  await assert.rejects(()=>store.act(owner.id,guest.token,before.revision,buy),e=>e instanceof RoomError&&e.status===403);
  const after=await store.act(owner.id,owner.token,before.revision,buy);assert.equal(after.inns!.stack.length,0);assert.equal(after.players[0].silver,2);
  await assert.rejects(()=>store.act(owner.id,owner.token,before.revision,buy),e=>e instanceof RoomError&&e.status===409);
  const put=after.actions.find(a=>a.action.type==="use-die"&&a.action.intent.kind==="place-tile"&&a.action.intent.tileId===before.inns!.stack[0])!.action;assert.ok(put);
  const forged:GameAction={...put,playerId:"seat-2"};await assert.rejects(()=>store.act(owner.id,owner.token,after.revision,forged),e=>e instanceof RoomError&&e.status===403);
  const placed=await store.act(owner.id,owner.token,after.revision,put);assert.ok(placed.players[0].duchy.cells.some(c=>c.tileId===before.inns!.stack[0]));
  const reconnect=await new RoomStore(directory).view(owner.id,guest.token);assert.deepEqual(reconnect.players,placed.players);assert.deepEqual(reconnect.inns,placed.inns);assert.deepEqual(reconnect.logs,placed.logs);
  const illegal:GameAction={type:"buy-black-tile",playerId:"seat-1",tileId:before.inns!.stack[0],storageSlot:0};await assert.rejects(()=>store.act(owner.id,owner.token,placed.revision,illegal),e=>e instanceof RoomError&&e.status===400);
 }finally{assert.equal(dirname(directory),tmpdir());assert.ok(basename(directory).startsWith("burgundy-inn-online-"));await rm(directory,{recursive:true});}
});
