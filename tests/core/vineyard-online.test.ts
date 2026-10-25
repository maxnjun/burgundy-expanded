import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,basename} from 'node:path';
import {RoomStore,RoomError} from '../../src/server/rooms';
import {vineFixture,blackVineFixture} from '../fixtures/vineyards';
test('online vineyards verifies seat, supply, replay, pending bonus and reconnect without revealing bag order',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'burgundy-vineyard-online-')),s=new RoomStore(dir);
 try{
  await assert.rejects(()=>s.create('A',false,false,null,false,false,'true'),e=>e instanceof RoomError&&e.status===400);
  const owner=await s.create('A',false,false,null,false,false,true),guest=await s.joinRoom(owner.id,'B'),path=join(dir,`${owner.id}.json`),room=JSON.parse(await readFile(path,'utf8'));room.game=vineFixture();await writeFile(path,JSON.stringify(room));
  let v=await s.view(owner.id,owner.token);assert.equal(v.vineyards!.bag.length,0);assert.equal(v.vineyards!.depots.length,3);
  const take=v.actions.find(a=>a.action.type==='use-die'&&a.action.intent.kind==='vineyard'&&a.action.intent.command==='take')!.action;
  await assert.rejects(()=>s.act(owner.id,guest.token,v.revision,take),e=>e instanceof RoomError&&e.status===403);
  const old=v.revision;v=await s.act(owner.id,owner.token,old,take);await assert.rejects(()=>s.act(owner.id,owner.token,old,take),e=>e instanceof RoomError&&e.status===409);
  assert.deepEqual((await new RoomStore(dir).view(owner.id,guest.token)).players[0].vineyardReserve,v.players[0].vineyardReserve);
  const place=v.actions.find(a=>a.action.type==='use-die'&&a.action.intent.kind==='vineyard'&&a.action.intent.command==='place')!.action;v=await s.act(owner.id,owner.token,v.revision,place);assert.ok(v.actions.some(a=>a.action.type==='resolve-choice'));
  assert.deepEqual((await new RoomStore(dir).view(owner.id,owner.token)).vineyards,v.vineyards);
  const fake={type:'extension',extensionId:'vineyards',command:'buy',playerId:'seat-1',payload:{kind:'vineyard',command:'take',source:'black',tileId:'B-B:1'}};
  await assert.rejects(()=>s.act(owner.id,owner.token,v.revision,fake),e=>e instanceof RoomError&&[400,409].includes(e.status));
 }finally{assert.equal(dirname(dir),tmpdir());assert.ok(basename(dir).startsWith('burgundy-vineyard-online-'));await rm(dir,{recursive:true});}
});

test('public phase goods and V12 server eligibility survive restart for both seats',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'burgundy-vineyard-online-')),s=new RoomStore(dir);
 try{
  const owner=await s.create('A',false,false,null,false,false,true),guest=await s.joinRoom(owner.id,'B'),path=join(dir,`${owner.id}.json`),room=JSON.parse(await readFile(path,'utf8'));room.game=blackVineFixture();await writeFile(path,JSON.stringify(room));
  let v=await s.view(owner.id,owner.token),peer=await s.view(owner.id,guest.token);assert.equal(v.commonBoard.revealedGoods!.length,5);assert.ok(v.commonBoard.revealedGoods!.every(Boolean));assert.deepEqual(v.commonBoard.revealedGoods,peer.commonBoard.revealedGoods);
  const candidate=v.actions.find(a=>a.action.type==='resolve-choice'&&!!a.target.blackTile)!;assert.ok(candidate);const illegal={...candidate.action,optionId:JSON.stringify({tileId:v.depots.flatMap(d=>d.slots).find(x=>x.tileId)!.tileId,storageSlot:0})};
  await assert.rejects(()=>s.act(owner.id,owner.token,v.revision,illegal),e=>e instanceof RoomError&&e.status===400);assert.equal((await s.view(owner.id,owner.token)).revision,v.revision);
  const before=v.players[0].silver;v=await s.act(owner.id,owner.token,v.revision,candidate.action);peer=await new RoomStore(dir).view(owner.id,guest.token);assert.deepEqual(v.players,peer.players);assert.deepEqual(v.blackDepot,peer.blackDepot);assert.equal(v.players[0].silver,before);assert.deepEqual(v.commonBoard.revealedGoods,peer.commonBoard.revealedGoods);
 }finally{assert.equal(dirname(dir),tmpdir());assert.ok(basename(dir).startsWith('burgundy-vineyard-online-'));await rm(dir,{recursive:true});}
});
