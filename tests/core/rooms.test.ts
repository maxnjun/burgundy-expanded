import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, basename } from "node:path";
import { RoomError, RoomStore } from "../../src/server/rooms";

async function fixture(){
  const directory=await mkdtemp(join(tmpdir(),"burgundy-room-test-"));
  const store=new RoomStore(directory),owner=await store.create("A"),guest=await store.joinRoom(owner.id,"B");
  const cleanup=async()=>{if(dirname(directory)!==tmpdir()||!basename(directory).startsWith("burgundy-room-test-"))throw new Error("Unsafe test cleanup");await rm(directory,{recursive:true});};
  return {store,owner,guest,directory,cleanup};
}
test("room seat authority, private-state redaction and persisted reconnection",async()=>{
  const f=await fixture();try{
    const view=await f.store.view(f.owner.id,f.owner.token);
    for(const type of ['undo','undo-action','undo-turn','restore-state']){
      await assert.rejects(()=>f.store.act(f.owner.id,f.owner.token,view.revision,{type,playerId:'seat-1',state:{}}),(e:unknown)=>e instanceof RoomError&&e.status===400);
      await assert.rejects(()=>f.store.act(f.owner.id,f.guest.token,view.revision,{type,playerId:'seat-1'}),(e:unknown)=>e instanceof RoomError&&e.status===403);
      assert.deepEqual(await f.store.view(f.owner.id,f.owner.token),view);
    }
    assert.equal(view.joined,true);assert.equal(view.seat,"seat-1");
    const text=JSON.stringify(view);assert.ok(!text.includes("supplyPools"));assert.ok(!text.includes("random"));assert.ok(!text.includes("token"));
    assert.ok(Object.keys(view.tiles).length<160);
    const raw=await readFile(join(f.directory,`${f.owner.id}.json`),"utf8");assert.ok(!raw.includes(f.owner.token));assert.ok(!raw.includes(f.guest.token));
    const restarted=new RoomStore(f.directory);assert.deepEqual(await restarted.view(f.owner.id,f.owner.token),view);
    await assert.rejects(()=>f.store.view(f.owner.id,"x".repeat(43)),(e:unknown)=>e instanceof RoomError&&e.status===401);
    await assert.rejects(()=>f.store.view("../escape",f.owner.token),(e:unknown)=>e instanceof RoomError&&e.status===404);
    await assert.rejects(()=>f.store.act(f.owner.id,f.guest.token,view.revision,{type:"roll-round",playerId:"seat-1"}),(e:unknown)=>e instanceof RoomError&&e.status===403);
    await assert.rejects(()=>f.store.joinRoom(f.owner.id,"C"),(e:unknown)=>e instanceof RoomError&&e.status===409);
  }finally{await f.cleanup();}
});
test("concurrent room requests commit once and stale/replayed actions cannot change state",async()=>{
  const f=await fixture();try{
    const before=await f.store.view(f.owner.id,f.owner.token),action=before.actions.find(a=>a.action.type==="roll-round")!.action;
    const outcomes=await Promise.allSettled([f.store.act(f.owner.id,f.owner.token,before.revision,action),f.store.act(f.owner.id,f.owner.token,before.revision,action)]);
    assert.equal(outcomes.filter(r=>r.status==="fulfilled").length,1);
    assert.equal(outcomes.filter(r=>r.status==="rejected"&&r.reason instanceof RoomError&&r.reason.status===409).length,1);
    const after=await f.store.view(f.owner.id,f.owner.token);assert.equal(after.revision,before.revision+1);
    await assert.rejects(()=>f.store.act(f.owner.id,f.owner.token,after.revision,{type:"use-die",playerId:"seat-1",dieId:"forged",intent:{kind:"take-workers"},adjustment:{workersSpent:0,steps:[]}}));
    assert.deepEqual(await f.store.view(f.owner.id,f.owner.token),after);
  }finally{await f.cleanup();}
});
test("two authenticated clients finish a complete server game without hidden state",async()=>{
  const f=await fixture();try{
    let steps=0,finished=false;
    while(!finished){
      assert.ok(++steps<900,"room game must not loop");
      const a=await f.store.view(f.owner.id,f.owner.token),b=await f.store.view(f.owner.id,f.guest.token);
      assert.equal(a.revision,b.revision);
      if(a.status==="finished"){assert.ok(a.winnerIds.length>0);finished=true;break;}
      const current=a.actions.length?a:b,token=a.actions.length?f.owner.token:f.guest.token;
      const rank=(g:string)=>["roll-round","advance-phase","resolve-choice","place-tile","take-tile","sell-goods","take-workers","end-turn","buy-black-tile"].indexOf(g);
      const selected=[...current.actions].sort((x,y)=>(rank(x.group)<0?99:rank(x.group))-(rank(y.group)<0?99:rank(y.group)))[0];
      assert.ok(selected);await f.store.act(f.owner.id,token,current.revision,selected.action);
    }
  }finally{await f.cleanup();}
});
