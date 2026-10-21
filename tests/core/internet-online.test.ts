import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,readFile,readdir,mkdir} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {randomBytes} from "node:crypto";
import {RoomStore,RoomError} from "../../src/server/rooms";
import {roomHandlers} from "../../src/server/room-http";
import {roomLimit} from "../../src/server/room-limit";

test("lobby requires each owner ready, host start, preserves restart and archives previous state",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"burgundy-internet-")),store=new RoomStore(dir),id=randomBytes(12).toString("hex"),token=randomBytes(32).toString("hex");
 const a=await store.create("A",true,false,null,true,true,true,[],true,{id,token,lobby:true});
 assert.deepEqual(await store.create("A",true,false,null,true,true,true,[],true,{id,token,lobby:true}),a);
 await assert.rejects(store.joinRoom(a.id,"B",token),(e:unknown)=>e instanceof RoomError&&e.status===409);
 const bt=randomBytes(32).toString("hex"),b=await store.joinRoom(a.id,"B",bt);assert.deepEqual(await store.joinRoom(a.id,"B",bt),b);
 await assert.rejects(store.joinRoom(a.id,"C",randomBytes(32).toString("hex")),(e:unknown)=>e instanceof RoomError&&e.status===409);
 let v=await store.view(a.id,a.token);assert.equal(v.actions.length,0);
 await assert.rejects(store.control(a.id,a.token,v.revision,{playerId:"seat-2",command:"ready",ready:true}),(e:unknown)=>e instanceof RoomError&&e.status===403);
 await assert.rejects(store.act(a.id,a.token,v.revision,{type:"roll-round",playerId:"seat-1"}));
 v=await store.control(a.id,a.token,v.revision,{playerId:"seat-1",command:"ready",ready:true});
 await assert.rejects(store.control(a.id,a.token,v.revision,{playerId:"seat-1",command:"start"}));
 v=await store.control(a.id,b.token,v.revision,{playerId:"seat-2",command:"ready",ready:true});
 await assert.rejects(store.control(a.id,b.token,v.revision,{playerId:"seat-2",command:"start"}),(e:unknown)=>e instanceof RoomError&&e.status===403);
 v=await store.control(a.id,a.token,v.revision,{playerId:"seat-1",command:"start"});assert.equal(v.lobby!.started,true);assert.ok(v.actions.every(a=>a.action.type==="place-starting-castle"));
 const restarted=new RoomStore(dir);await restarted.checkStorage();assert.deepEqual(await restarted.view(a.id,a.token),v);
 const raw=await readFile(join(dir,`${id}.json`),"utf8");assert.ok(!raw.includes(token)&&!raw.includes(bt));
 assert.ok((await readdir(join(dir,"backups",id))).length>=4);
 await assert.rejects(store.control(a.id,a.token,v.revision,{playerId:"seat-1",command:"start"}));
});
test("old rooms bypass the new opt-in lobby; production versions gate mutations without changing state",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"burgundy-version-")),store=new RoomStore(dir),a=await store.create("A"),b=await store.joinRoom(a.id,"B");void b;
 const before=await store.view(a.id,a.token);assert.equal(before.lobby,undefined);assert.ok(before.actions.length);
 const old=process.env.GAME_VERSION;process.env.GAME_VERSION="test-release";
 try{const handlers=roomHandlers(store),request=new Request(`http://localhost/api/rooms/${a.id}/actions`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${a.token}`},body:JSON.stringify({revision:before.revision,action:before.actions[0].action})});
 const response=await handlers.act(request,a.id);assert.equal(response.status,426);assert.equal(response.headers.get("x-game-version"),"test-release");assert.equal((await store.view(a.id,a.token)).revision,before.revision);
 }finally{if(old===undefined)delete process.env.GAME_VERSION;else process.env.GAME_VERSION=old;}
});
test("storage read errors stop creation instead of treating existing data as a missing room",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"burgundy-storage-")),id=randomBytes(12).toString("hex"),token=randomBytes(32).toString("hex"),store=new RoomStore(dir);await mkdir(join(dir,`${id}.json`));
 const unavailable=(e:unknown)=>e instanceof RoomError&&e.status===500;
 await assert.rejects(store.view(id,token),unavailable);await assert.rejects(store.create("A",false,false,null,false,false,false,[],false,{id,token}),unavailable);assert.deepEqual(await readdir(join(dir,`${id}.json`)),[]);
});
test("production request limits ignore spoofed left proxy addresses and keep resource bounds",()=>{
 const node=process.env.NODE_ENV,proxy=process.env.TRUST_PROXY;Object.assign(process.env,{NODE_ENV:"production",TRUST_PROXY:"1"});const kind=randomBytes(8).toString("hex");
 try{roomLimit(new Request("http://localhost",{headers:{"x-forwarded-for":"forged-a, real-peer"}}),kind,1);assert.throws(()=>roomLimit(new Request("http://localhost",{headers:{"x-forwarded-for":"forged-b, real-peer"}}),kind,1),(e:unknown)=>e instanceof RoomError&&e.status===429);roomLimit(new Request("http://localhost",{headers:{"x-forwarded-for":"another-peer"}}),kind,1);}
 finally{for(const [key,value]of [["NODE_ENV",node],["TRUST_PROXY",proxy]])if(value===undefined)Reflect.deleteProperty(process.env,key!);else Reflect.set(process.env,key!,value);}
});
