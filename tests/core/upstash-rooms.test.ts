import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,readdir} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {RoomStore,RoomError} from "../../src/server/rooms";
import {remoteRooms,UpstashRooms,SAVE_ROOM_SCRIPT} from "../../src/server/upstash-rooms";

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
