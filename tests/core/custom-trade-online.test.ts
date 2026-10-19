import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,readFile,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,dirname,basename} from "node:path";
import {RoomStore,RoomError} from "../../src/server/rooms";
import {roomHandlers} from "../../src/server/room-http";
import {tradeFixture,directSale} from "../fixtures/custom-trade";

test("server custom trade validates option, assigns cards, sells once, resolves white bonus and reconnects both seats",async()=>{
 const directory=await mkdtemp(join(tmpdir(),"burgundy-custom-trade-")),store=new RoomStore(directory);
 try{
  await assert.rejects(()=>store.create('A',false,false,null,false,'true'),e=>e instanceof RoomError&&e.status===400);
  const res=await roomHandlers(store).create(new Request('http://localhost/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'A',tradeRoutes:true})}));assert.equal(res.status,200);
  const owner=await res.json(),guest=await store.joinRoom(owner.id,'B'),path=join(directory,`${owner.id}.json`),initial=await store.view(owner.id,owner.token);assert.ok(initial.tradeRoutes);assert.equal(initial.tradeRoutes.routes['seat-1'].tileIds.length,5);
  const room=JSON.parse(await readFile(path,'utf8'));room.game=tradeFixture('white-castle');await writeFile(path,JSON.stringify(room));
  const before=await store.view(owner.id,owner.token),action=directSale(room.game);
  await assert.rejects(()=>store.act(owner.id,guest.token,before.revision,action),e=>e instanceof RoomError&&e.status===403);
  const next=await store.act(owner.id,owner.token,before.revision,action);assert.equal(next.tradeRoutes!.routes['seat-1'].sales.length,1);assert.equal(next.tradeRoutes!.routes['seat-1'].sales[0].status,'pending');
  await assert.rejects(()=>store.act(owner.id,owner.token,before.revision,action),e=>e instanceof RoomError&&e.status===409);
  const reconnect=await new RoomStore(directory).view(owner.id,guest.token);assert.deepEqual(reconnect.tradeRoutes,next.tradeRoutes);
  const choice=next.actions.find(a=>a.action.type==='resolve-choice'&&(a.action.optionId.includes('take-workers')))!;assert.ok(choice);
  const after=await store.act(owner.id,owner.token,next.revision,choice.action);assert.equal(after.tradeRoutes!.routes['seat-1'].sales[0].status,'resolved');assert.equal(after.tradeRoutes!.routes['seat-1'].sales.length,1);
  const fake={type:'extension',extensionId:'trade-routes',playerId:'seat-1',command:'advance',payload:{playerId:'seat-2',position:10}};
  await assert.rejects(()=>store.act(owner.id,owner.token,after.revision,fake),e=>e instanceof RoomError&&e.status===400);
  assert.deepEqual((await new RoomStore(directory).view(owner.id,owner.token)).tradeRoutes,after.tradeRoutes);
 }finally{assert.equal(dirname(directory),tmpdir());assert.ok(basename(directory).startsWith('burgundy-custom-trade-'));await rm(directory,{recursive:true});}
});
