import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,readdir} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {RoomStore,RoomError} from "../../src/server/rooms";
import {remoteRooms,UpstashRooms,SAVE_ROOM_SCRIPT} from "../../src/server/upstash-rooms";
import {layeredVineFixture} from "../fixtures/vineyards";
import {mount} from "../fixtures/shields";
import {createShieldLayout,setShieldLayout,shieldLayout} from "../../src/game/shields";

// REST contract double; provider Lua execution and actual free account remain external QA.
function provider(){
 const values=new Map<string,string>();let fail=false,writeFail=false,drop=false;
 const request:typeof fetch=async(_input,init)=>{
  assert.equal(new Headers(init?.headers).get("authorization"),"Bearer test-only");
  assert.equal(init?.redirect,"error");assert.ok(init?.signal);
  if(fail)return Response.json({error:"provider-private-error"},{status:429});
  const [command,...args]=JSON.parse(String(init?.body));let result:unknown;
  if(writeFail&&command==="EVAL")return Response.json({error:"provider-private-error"},{status:429});
  if(command==="PING")result="PONG";
  else if(command==="GET")result=values.get(args[0])??null;
  else {
   assert.equal(command,"EVAL");assert.equal(args[0],SAVE_ROOM_SCRIPT);assert.equal(args[1],1);
   const [, ,key,raw,revision]=args,old=values.get(key);
   result=revision==="new"?!old?1:0:old&&JSON.parse(old).game.revision===Number(revision)?1:0;
   if(result===1)values.set(key,raw);
   if(drop){drop=false;throw Error("connection lost after commit");}
  }
  return Response.json({result});
 };
 return {values,request,fail:()=>{fail=true;},failWrite:()=>{writeFail=true;},recover:()=>{fail=false;writeFail=false;},drop:()=>{drop=true;}};
}
test("external rooms survive a new process/empty local directory, protect seats and isolate staging",async()=>{
 const p=provider(),dir=await mkdtemp(join(tmpdir(),"burgundy-remote-"));
 const backend=(namespace="staging")=>new UpstashRooms("https://test.upstash.io","test-only",namespace,p.request);
 const store=new RoomStore(dir,backend()),a=await store.create("PC",true,true,null,true,true,true),b=await store.joinRoom(a.id,"iPhone");
 const v=await store.view(a.id,a.token);assert.equal(v.joined,true);assert.equal(v.seat,"seat-1");
 assert.deepEqual(await readdir(dir),[]);
 const restarted=new RoomStore(join(dir,"never-created"),backend());
 assert.deepEqual(await restarted.view(a.id,a.token),v);assert.equal((await restarted.view(a.id,b.token)).seat,"seat-2");
 await assert.rejects(new RoomStore(dir,backend("production")).view(a.id,a.token),(e:unknown)=>e instanceof RoomError&&e.status===404);
 await assert.rejects(store.view(a.id,"x".repeat(43)),(e:unknown)=>e instanceof RoomError&&e.status===401);
 const raw=[...p.values.values()][0];assert.ok(!raw.includes(a.token)&&!raw.includes(b.token));assert.equal(await restarted.maintain(),0);
 await restarted.checkStorage();
});
test("two Render processes commit one action; quota/outage writes leave the prior state intact",async()=>{
 const p=provider(),backend=()=>new UpstashRooms("https://test.upstash.io","test-only","staging",p.request);
 const store=new RoomStore("unused",backend()),a=await store.create("A"),b=await store.joinRoom(a.id,"B"),other=new RoomStore("unused",backend());
 const v=await store.view(a.id,a.token),action=v.actions.find(x=>x.action.type==="roll-round")!.action;
 const results=await Promise.allSettled([store.act(a.id,a.token,v.revision,action),other.act(a.id,a.token,v.revision,action)]);
 assert.equal(results.filter(x=>x.status==="fulfilled").length,1);assert.equal(results.filter(x=>x.status==="rejected"&&x.reason.status===409).length,1);
 const saved=await store.view(a.id,a.token),before=[...p.values];p.failWrite();
 await assert.rejects(other.act(a.id,a.token,saved.revision,saved.actions[0].action),(e:unknown)=>e instanceof RoomError&&e.status===503&&!e.message.includes("provider-private"));
 assert.deepEqual([...p.values],before);p.fail();await assert.rejects(store.checkStorage());p.recover();
 assert.deepEqual(await other.view(a.id,a.token),saved);assert.equal((await other.view(a.id,b.token)).revision,saved.revision);
});
test("ambiguous creation response retries same identity and missing configuration never falls back",async()=>{
 const p=provider(),store=new RoomStore("unused",new UpstashRooms("https://test.upstash.io","test-only","staging",p.request));
 const identity={id:"a".repeat(24),token:"b".repeat(43)};p.drop();
 await assert.rejects(store.create("A",false,false,null,false,false,false,[],false,identity));
 assert.deepEqual(await store.create("A",false,false,null,false,false,false,[],false,identity),identity);assert.equal(p.values.size,1);
 const b=await store.joinRoom(identity.id,"B"),v=await store.view(identity.id,identity.token),action=v.actions.find(x=>x.action.type==="roll-round")!.action;p.drop();
 await assert.rejects(store.act(identity.id,identity.token,v.revision,action));
 assert.equal((await new RoomStore("unused",new UpstashRooms("https://test.upstash.io","test-only","staging",p.request)).view(identity.id,b.token)).revision,v.revision+1);
 await assert.rejects(store.act(identity.id,identity.token,v.revision,action),(e:unknown)=>e instanceof RoomError&&e.status===409);
 assert.equal(remoteRooms({}),undefined);
 for(const env of [{BURGUNDY_STORAGE:"unknown"},{BURGUNDY_STORAGE:"upstash"},{BURGUNDY_STORAGE:"upstash",UPSTASH_REDIS_REST_URL:"http://localhost",UPSTASH_REDIS_REST_TOKEN:"test-only",BURGUNDY_ROOM_NAMESPACE:"staging"}])assert.throws(()=>remoteRooms(env));
});

test("request receipts commit with state, survive lost replies/restart, and deduplicate across processes",async()=>{
 const p=provider(),backend=()=>new UpstashRooms("https://test.upstash.io","test-only","staging",p.request),store=new RoomStore("unused",backend());
 const a=await store.create("A",true,true,null,true,true,true),b=await store.joinRoom(a.id,"B"),before=await store.view(a.id,a.token),roll=before.actions.find(x=>x.action.type==="roll-round")!.action,id="roll-request-000001";
 p.drop();const rolled=await store.act(a.id,a.token,before.revision,roll,id);assert.equal(rolled.revision,before.revision+1);
 const restarted=new RoomStore("empty-local-directory",backend());assert.deepEqual(await restarted.act(a.id,a.token,before.revision,roll,id),rolled);
 const worker=rolled.actions.find(x=>x.action.type==="use-die"&&x.action.intent.kind==="take-workers"&&x.action.adjustment.workersSpent===0)!.action;
 const results=await Promise.all([store.act(a.id,a.token,rolled.revision,worker,"worker-request-00001"),restarted.act(a.id,a.token,rolled.revision,worker,"worker-request-00001")]);
 assert.equal(results[0].revision,rolled.revision+1);assert.deepEqual(results[0],results[1]);assert.equal(results[0].players[0].workers,rolled.players[0].workers+2);
 assert.deepEqual(await restarted.act(a.id,a.token,before.revision,roll,id),results[0]);
 await assert.rejects(store.act(a.id,a.token,rolled.revision,worker,id),(e:unknown)=>e instanceof RoomError&&e.status===409);
 await assert.rejects(store.act(a.id,b.token,results[0].revision,roll,id),(e:unknown)=>e instanceof RoomError&&e.status===403);
 await assert.rejects(store.act(a.id,"invalid-token",before.revision,roll,id),(e:unknown)=>e instanceof RoomError&&e.status===401);
 await assert.rejects(store.act(a.id,a.token,results[0].revision,worker,"bad"),(e:unknown)=>e instanceof RoomError&&e.status===400);
 const raw=[...p.values.values()][0],stored=JSON.parse(raw);assert.equal(stored.version,1);assert.equal(stored.requests.length,2);assert.ok(stored.game.random);assert.ok(stored.game.vineyards);assert.ok(stored.game.config.extensions);assert.ok(!JSON.stringify(results[0]).includes(id));
 const undone=await restarted.act(a.id,a.token,results[0].revision,{type:"undo-action",playerId:"seat-1"},"undo-request-0000001");assert.deepEqual(undone.players,rolled.players);assert.deepEqual(undone.dice,rolled.dice);
 assert.deepEqual(await store.act(a.id,a.token,rolled.revision,worker,"worker-request-00001"),undone);
 const key=[...p.values.keys()][0],bounded=JSON.parse(p.values.get(key)!);bounded.requests=Array.from({length:128},(_,i)=>({id:`older-receipt-${String(i).padStart(5,"0")}`,seat:0,hash:"a".repeat(64)}));p.values.set(key,JSON.stringify(bounded));const unchanged=p.values.get(key);
 await assert.rejects(restarted.act(a.id,a.token,before.revision,roll,id),(e:unknown)=>e instanceof RoomError&&e.status===409);assert.equal(p.values.get(key),unchanged);
});

test("legacy rooms migrate without a read-write; incompatible rooms and corrupted receipts stay untouched",async()=>{
 const p=provider(),store=new RoomStore("unused",new UpstashRooms("https://test.upstash.io","test-only","staging",p.request)),a=await store.create("A"),b=await store.joinRoom(a.id,"B");
 const key=[...p.values.keys()][0],legacy=JSON.parse(p.values.get(key)!);delete legacy.requests;p.values.set(key,JSON.stringify(legacy));const raw=p.values.get(key);
 const restored=await store.view(a.id,b.token);assert.equal(restored.seat,"seat-2");assert.equal(p.values.get(key),raw);
 p.values.set(key,JSON.stringify({...legacy,version:999}));const unsupported=p.values.get(key);await assert.rejects(store.view(a.id,a.token),(e:unknown)=>e instanceof RoomError&&e.code==="ROOM_SCHEMA_UNSUPPORTED");assert.equal(p.values.get(key),unsupported);
 p.values.set(key,JSON.stringify({...legacy,game:{...legacy.game,schemaVersion:"future"}}));const future=p.values.get(key);await assert.rejects(store.view(a.id,a.token),(e:unknown)=>e instanceof RoomError&&e.code==="ROOM_SCHEMA_UNSUPPORTED");assert.equal(p.values.get(key),future);
 p.values.set(key,JSON.stringify({...legacy,requests:[{id:"invalid",seat:0,hash:"x"}]}));const invalid=p.values.get(key);await assert.rejects(store.view(a.id,a.token));assert.equal(p.values.get(key),invalid);
});

test("placed vineyard layers/tokens and mounted shield recover with all hidden state in external storage",async()=>{
 const p=provider(),backend=()=>new UpstashRooms("https://test.upstash.io","test-only","staging",p.request),store=new RoomStore("unused",backend()),a=await store.create("A"),b=await store.joinRoom(a.id,"B");
 const fixture=layeredVineFixture(),shields=createShieldLayout(2,fixture.random,true);
 const game=mount(setShieldLayout({...fixture,random:shields.random,config:{...fixture.config,extensions:[...fixture.config.extensions,{id:"shields",options:{rules:true}}]}},shields.layout),18);
 const key=[...p.values.keys()][0],room=JSON.parse(p.values.get(key)!);room.game=game;p.values.set(key,JSON.stringify(room));const raw=p.values.get(key);
 const restarted=new RoomStore("empty-after-deploy",backend()),v=await restarted.view(a.id,a.token),peer=await restarted.view(a.id,b.token);
 assert.deepEqual(v.players,game.players);assert.deepEqual(peer.vineyards,v.vineyards);assert.deepEqual(v.vineyards,{...game.vineyards,bag:[]});
 assert.deepEqual(v.shields!.mounted,shieldLayout(game)!.mounted);assert.equal(v.shields!.mounted[0].shieldNumber,18);assert.ok(v.vineyards!.players['seat-1'].placed.length>0);assert.ok(v.vineyards!.players['seat-1'].layers.length>0);assert.ok(v.vineyards!.players['seat-1'].tokens.length>1);
 assert.equal(p.values.get(key),raw);assert.deepEqual(JSON.parse(raw!).game.random,game.random);assert.deepEqual(JSON.parse(raw!).game.vineyards.bag,game.vineyards!.bag);
});

test("two seats submitting simultaneously commit only the active player's action",async()=>{
 const p=provider(),backend=()=>new UpstashRooms("https://test.upstash.io","test-only","staging",p.request),aStore=new RoomStore("unused",backend()),bStore=new RoomStore("unused",backend());
 const a=await aStore.create("A"),b=await aStore.joinRoom(a.id,"B"),initial=await aStore.view(a.id,a.token);
 const rolled=await aStore.act(a.id,a.token,initial.revision,initial.actions.find(x=>x.action.type==="roll-round")!.action,"concurrent-roll-00001");
 const worker=rolled.actions.find(x=>x.action.type==="use-die"&&x.action.intent.kind==="take-workers"&&x.action.adjustment.workersSpent===0)!.action;assert.equal(worker.type,"use-die");
 const other={...worker,playerId:"seat-2",dieId:rolled.dice.players['seat-2'][0].id};
 const results=await Promise.allSettled([aStore.act(a.id,a.token,rolled.revision,worker,"active-seat-request-01"),bStore.act(a.id,b.token,rolled.revision,other,"other-seat-request-001")]);
 assert.equal(results[0].status,"fulfilled");assert.ok(results[1].status==="rejected"&&results[1].reason instanceof RoomError&&[400,409].includes(results[1].reason.status));
 const saved=await bStore.view(a.id,b.token);assert.equal(saved.revision,rolled.revision+1);assert.equal(saved.players[0].workers,rolled.players[0].workers+2);assert.deepEqual(saved.players[1],rolled.players[1]);
 assert.ok(!JSON.parse([...p.values.values()][0]).requests.some((r:{id:string})=>r.id==="other-seat-request-001"));
});
