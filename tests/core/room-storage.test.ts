import {test,mock} from "node:test";
import {promises as fs} from "node:fs";
import assert from "node:assert/strict";
import {mkdtemp,readFile,writeFile,readdir,mkdir} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {gunzipSync} from "node:zlib";
import {RoomStore,RoomError,requireRoomSpace} from "../../src/server/rooms";
import {respond,roomHandlers} from "../../src/server/room-http";

test("fifty old ongoing rooms stay byte-exact and do not prevent a new room",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"burgundy-room-storage-")),store=new RoomStore(dir),owner=await store.create("A");await store.joinRoom(owner.id,"B");
 const room=JSON.parse(await readFile(join(dir,owner.id+".json"),"utf8"));room.updatedAt=Date.now()-3*86400_000;
 const originals=new Map<string,string>();
 for(let i=0;i<50;i++){const id=i===0?owner.id:i.toString(16).padStart(24,"0"),raw=JSON.stringify({...room,id});originals.set(id,raw);await writeFile(join(dir,id+".json"),raw);}
 const next=await store.create("C");assert.ok(next.id);assert.equal((await readdir(dir)).filter(n=>/^[a-f0-9]{24}\.json$/.test(n)).length,51);
 for(const [id,raw]of originals)assert.equal(await readFile(join(dir,id+".json"),"utf8"),raw);
 assert.equal((await new RoomStore(dir).view(owner.id,owner.token)).joined,true);
});

test("actual low-disk create rejects before saving but idempotent existing-seat recovery still succeeds",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"burgundy-room-storage-")),store=new RoomStore(dir),owner=await store.create("A"),raw=await readFile(join(dir,owner.id+".json"),"utf8"),disk=await fs.statfs(dir);
 const low=mock.method(fs,"statfs",async()=>({...disk,bavail:0}));
 try{
  const response=await roomHandlers(store).create(new Request("http://localhost/api/rooms",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:"B",roomId:"f".repeat(24),seatToken:"a".repeat(64)})}));
  assert.equal(response.status,503);assert.equal((await response.json()).code,"ROOM_STORAGE_FULL");assert.equal((await readdir(dir)).filter(n=>n.endsWith(".json")).length,1);
  assert.deepEqual(await store.create("A",false,false,null,false,false,false,[],false,{id:owner.id,token:owner.token}),owner);assert.equal(await readFile(join(dir,owner.id+".json"),"utf8"),raw);
 }finally{low.mock.restore();}
});

test("cold untouched waiting rooms compress losslessly, authenticate after restart and reactivate on join",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"burgundy-room-storage-")),store=new RoomStore(dir),a=await store.create("A");
 const path=join(dir,a.id+".json"),room=JSON.parse(await readFile(path,"utf8"));room.updatedAt=Date.now()-2*86400_000;const raw=JSON.stringify(room);await writeFile(path,raw);
 const before=await store.view(a.id,a.token);assert.equal(await store.maintain(),1);assert.equal(await store.maintain(),0);
 const compressed=await readFile(join(dir,"archive",a.id+".json.gz"));assert.ok(compressed.length<Buffer.byteLength(raw));assert.equal(gunzipSync(compressed).toString(),raw);
 await assert.rejects(readFile(path),{code:"ENOENT"});const restarted=new RoomStore(dir);await restarted.checkStorage();assert.deepEqual(await restarted.view(a.id,a.token),before);
 await assert.rejects(restarted.view(a.id,"x".repeat(64)),(e:unknown)=>e instanceof RoomError&&e.status===401);
 const b=await restarted.joinRoom(a.id,"B");assert.equal((await restarted.view(a.id,b.token)).joined,true);assert.equal((await restarted.view(a.id,a.token)).revision,before.revision+1);
 await assert.rejects(readFile(join(dir,"archive",a.id+".json.gz")),{code:"ENOENT"});assert.equal(await readFile(join(dir,"backups",a.id,"0.json"),"utf8"),raw);
 const recent=await restarted.create("recent");assert.equal(await restarted.maintain(),0);assert.ok(await readFile(join(dir,recent.id+".json")));
});

test("failed archive keeps the source; real disk exhaustion has a safe, explicit error",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"burgundy-room-storage-")),store=new RoomStore(dir),a=await store.create("A"),path=join(dir,a.id+".json");
 const room=JSON.parse(await readFile(path,"utf8"));room.updatedAt=Date.now()-2*86400_000;const raw=JSON.stringify(room);await writeFile(path,raw);await mkdir(join(dir,"archive",a.id+".json.gz"),{recursive:true});
 await assert.rejects(store.maintain());assert.equal(await readFile(path,"utf8"),raw);assert.equal((await store.view(a.id,a.token)).joined,false);
 assert.doesNotThrow(()=>requireRoomSpace(100_000_000));
 const response=await respond(async()=>requireRoomSpace(1));assert.equal(response.status,503);const data=await response.json();assert.equal(data.code,"ROOM_STORAGE_FULL");assert.match(data.error,/디스크/);
 const io=await respond(async()=>{throw Object.assign(new Error("private path"),{code:"ENOSPC"});});assert.equal(io.status,503);assert.ok(!(await io.text()).includes("private path"));
});
