import {readActionLog} from "../../src/game/action-log";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { RoomStore, RoomError } from "../../src/server/rooms";
import { practicePending } from "../fixtures/white-castles";
import { roomHandlers } from "../../src/server/room-http";

test("online white castle validates configuration, paid actions, seat ownership, replay and reconnection",async()=>{
 const directory=await mkdtemp(join(tmpdir(),"burgundy-white-online-")),store=new RoomStore(directory);
 try{
  await assert.rejects(()=>store.create("A",false,"true"),e=>e instanceof RoomError&&e.status===400);
  const bad=await roomHandlers(store).create(new Request("http://localhost/api/rooms",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:"A",whiteCastles:"true"})}));assert.equal(bad.status,400);
  const owner=await store.create("A",false,true),guest=await store.joinRoom(owner.id,"B"),path=join(directory,`${owner.id}.json`);
  let room=JSON.parse(await readFile(path,"utf8"));assert.equal(Object.values(room.game.tiles).filter(t=>(t as {building:string}).building==="white-castle").length,8);
  room.game=practicePending();await writeFile(path,JSON.stringify(room));
  const before=await store.view(owner.id,owner.token),action=before.actions.find(a=>a.group==="resolve-choice"&&a.target.intent?.kind==="sell-goods"&&a.cost===1)!.action;
  assert.ok(action);await assert.rejects(()=>store.act(owner.id,guest.token,before.revision,action),e=>e instanceof RoomError&&e.status===403);
  assert.ok(action.type==="resolve-choice");const fake={...action,optionId:JSON.stringify({intent:{kind:"sell-goods",goodsType:1},adjustment:{steps:[1],workersSpent:0}})};
  await assert.rejects(()=>store.act(owner.id,owner.token,before.revision,fake),e=>e instanceof RoomError&&e.status===400);
  const next=await store.act(owner.id,owner.token,before.revision,action);
  assert.equal(next.players[0].workers,1);assert.equal(next.players[0].silver,before.players[0].silver+1);assert.equal(next.dice.whiteDie,6);
  const reconnect=await new RoomStore(directory).view(owner.id,guest.token);assert.deepEqual(next.players,reconnect.players);assert.deepEqual(next.dice,reconnect.dice);
  await assert.rejects(()=>store.act(owner.id,owner.token,next.revision,action),e=>e instanceof RoomError&&e.status===400);
  assert.ok(next.logs[0].includes("상품 판매"));assert.deepEqual(readActionLog(next.logs[0]).dice,[{index:0,value:1,source:'white'}]);assert.deepEqual(next.dice.players,before.dice.players);
  room=JSON.parse(await readFile(path,"utf8"));assert.equal(room.game.turn.pendingChoice,null);
 }finally{assert.equal(dirname(directory),tmpdir());assert.ok(basename(directory).startsWith("burgundy-white-online-"));await rm(directory,{recursive:true});}
});
