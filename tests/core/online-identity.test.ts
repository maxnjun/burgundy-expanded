import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,readFile,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {RoomStore,RoomError} from "../../src/server/rooms";
import {createPracticeSession} from "../../src/game/practice";
import {PLAYER_COLORS,playerColorKey} from "../../src/game/player-colors";
import {roundtrip} from "../fixtures/shields";

test("six player colors roundtrip without changing rules, random draws or dice; old saves retain seat defaults",()=>{
 const base=createPracticeSession({names:["A","B"],seed:"identity-colors"});
 for(const color of PLAYER_COLORS){
  const g=createPracticeSession({names:["새 이름","B"],colors:[color,color==="red"?"blue":"red"],seed:"identity-colors"});
  assert.deepEqual(roundtrip(g),g);assert.deepEqual(g.random,base.random);assert.deepEqual(g.dice,base.dice);assert.deepEqual(g.market,base.market);
 }
 const legacy={...base,players:base.players.map(p=>({...p,color:undefined})),config:{...base.config,players:base.config.players.map(p=>({...p,color:undefined}))}};
 assert.deepEqual(roundtrip(legacy).players.map(playerColorKey),["blue","red"]);
 assert.throws(()=>createPracticeSession({names:["A","B"],seed:"x",colors:["pink","pink"]}));
});

test("online identity is own-seat, unique, pregame only, persisted and idempotent; validation leaves rooms intact",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"burgundy-identity-"));
 try{
  let store=new RoomStore(dir);const a=await store.create("영주 1",false,false,null,false,false,false,[],true,{lobby:true,color:"purple"});
  let v=await store.view(a.id,a.token);
  const profile=(playerId:string,name:string,color:unknown)=>({command:"profile",playerId,name,color});
  await assert.rejects(store.joinRoom(a.id,"B",undefined,"purple"),/이미 사용 중인 색상/);
  assert.equal((await store.view(a.id,a.token)).joined,false);
  await assert.rejects(store.joinRoom(a.id,"B",undefined,"invalid"),/색상/);
  const b=await store.joinRoom(a.id,"영주 2",undefined,"pink");v=await store.view(a.id,a.token);
  const before=JSON.parse(await readFile(join(dir,`${a.id}.json`),"utf8")).game;
  for(const [pid,n,c,status] of [["seat-2","침입","blue",403],["seat-1","","blue",400],["seat-1","A","orange",400],["seat-1","A","pink",409]] as const)
   await assert.rejects(store.control(a.id,a.token,v.revision,profile(pid,n,c)),(e:unknown)=>e instanceof RoomError&&e.status===status);
  assert.equal((await store.view(a.id,a.token)).revision,v.revision);
  v=await store.control(a.id,a.token,v.revision,{command:"ready",playerId:"seat-1",ready:true});
  const stale=v.revision;v=await store.control(a.id,a.token,v.revision,profile("seat-1","푸른 영주","blue"));
  assert.equal(v.lobby!.ready[0],false);await assert.rejects(store.control(a.id,a.token,stale,profile("seat-1","stale","red")),/최신/);
  await store.joinRoom(a.id,"덮어쓰기",b.token,"yellow");assert.equal((await store.view(a.id,b.token)).players[1].name,"영주 2");
  store=new RoomStore(dir);await store.checkStorage();assert.equal((await store.view(a.id,b.token)).players[0].name,"푸른 영주");
  const after=JSON.parse(await readFile(join(dir,`${a.id}.json`),"utf8")).game;
  assert.deepEqual(after.random,before.random);assert.deepEqual(after.dice,before.dice);assert.deepEqual(after.market,before.market);
  assert.equal(after.config.players[0].color,"blue");assert.equal(after.config.players[0].name,"푸른 영주");
  for(const seat of [a,b]){v=await store.view(a.id,seat.token);v=await store.control(a.id,seat.token,v.revision,{command:"ready",playerId:v.seat,ready:true});}
  v=await store.control(a.id,a.token,v.revision,{command:"start",playerId:"seat-1"});
  await assert.rejects(store.control(a.id,a.token,v.revision,profile("seat-1","late","green")),/이미 시작/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test("unoccupied default color and legacy missing colors stay distinct; simultaneous profile changes cannot collide",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"burgundy-identity-")),store=new RoomStore(dir);
 try{
  const a=await store.create("영주 1",false,false,null,false,false,false,[],true,{lobby:true});let v=await store.view(a.id,a.token);
  v=await store.control(a.id,a.token,v.revision,{command:"profile",playerId:"seat-1",name:"빨강",color:"red"});await store.checkStorage();
  const b=await store.joinRoom(a.id,"영주 2");v=await store.view(a.id,a.token);assert.deepEqual(v.players.map(playerColorKey),["red","blue"]);
  const results=await Promise.allSettled([a,b].map((seat,i)=>store.control(a.id,seat.token,v.revision,{command:"profile",playerId:`seat-${i+1}`,name:`P${i}`,color:"purple"})));
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1);v=await store.view(a.id,a.token);assert.equal(new Set(v.players.map(playerColorKey)).size,2);
  const file=join(dir,`${a.id}.json`),raw=JSON.parse(await readFile(file,"utf8"));
  for(const p of [...raw.game.players,...raw.game.config.players])delete p.color;
  await writeFile(file,JSON.stringify(raw));const legacy=new RoomStore(dir);await legacy.checkStorage();assert.deepEqual((await legacy.view(a.id,b.token)).players.map(playerColorKey),["blue","red"]);
 }finally{await rm(dir,{recursive:true,force:true});}
});
