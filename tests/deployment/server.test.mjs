import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,readdir} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createServer} from "node:net";
import {spawn} from "node:child_process";
import {once} from "node:events";
import {setTimeout as delay} from "node:timers/promises";
import WebSocket from "ws";
import {restoreRooms} from "../../scripts/room-backups.mjs";

test("production HTTP + WebSocket authenticate, synchronize and recover exact rooms after restart",{timeout:120_000},async t=>{
 const dir=await mkdtemp(join(tmpdir(),"burgundy-production-")),probe=createServer();await new Promise(r=>probe.listen(0,"127.0.0.1",r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 const origin=`http://127.0.0.1:${port}`,version=process.env.TEST_GAME_VERSION||"integration-release";
 let child,logs="",dataDir=dir;const sockets=[];
 const stop=async()=>{if(child&&child.exitCode===null){const exited=once(child,"exit");child.kill();await exited;}};
 t.after(async()=>{for(const ws of sockets)ws.terminate();await stop();});
 async function start(){child=spawn(process.execPath,["scripts/server.mjs"],{env:{...process.env,NODE_ENV:"production",HOST:"127.0.0.1",PORT:String(port),BURGUNDY_DATA_DIR:dataDir,APP_ORIGIN:origin,GAME_VERSION:version},stdio:["ignore","pipe","pipe"]});
 child.stdout.on("data",b=>{logs=(logs+b.toString()).slice(-8000);});child.stderr.on("data",b=>{logs=(logs+b.toString()).slice(-8000);});
 for(let i=0;i<300;i++){if(child.exitCode!==null)throw Error(`Production server exited: ${logs}`);try{const res=await fetch(`${origin}/api/health`);if(res.ok){assert.equal((await res.json()).version,version);return;}}catch{}await delay(100);}throw Error("Production server health timeout");}
 const headers={"Content-Type":"application/json","X-Game-Version":version,"X-Game-Protocol":"1",Origin:origin};
 async function post(path,payload,token){return fetch(origin+path,{method:"POST",headers:{...headers,...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(payload)});}
 const view=async seat=>(await fetch(`${origin}/api/rooms/${seat.id}`,{headers:{Authorization:`Bearer ${seat.token}`}})).json();
 async function socket(seat,clientVersion=version){const ws=new WebSocket(`${origin.replace("http","ws")}/api/rooms/${seat.id}/live`,{origin});sockets.push(ws);const messages=[];ws.on("message",b=>messages.push(JSON.parse(b.toString())));await once(ws,"open");ws.send(JSON.stringify({type:"authenticate",token:seat.token,version:clientVersion,protocol:1}));return {ws,messages};}
 async function seen(client,predicate){for(let i=0;i<100;i++){const found=client.messages.find(predicate);if(found)return found;await delay(50);}throw Error("WebSocket update missing");}
 await start();const a=await(await post("/api/rooms",{name:"Desktop",lobby:true,shieldRules:true,whiteCastles:true,inns:true,tradeRoutes:true,vineyards:true})).json();assert.match(a.id,/^[a-f0-9]{24}$/);
 const b=await(await post(`/api/rooms/${a.id}/join`,{name:"Mobile"})).json();const live=await socket(b);await seen(live,m=>m.type==="state");
 for(const [seat,command]of [[a,"ready"],[b,"ready"],[a,"start"]]){const v=await view(seat);const res=await post(`/api/rooms/${a.id}/actions`,{revision:v.revision,action:{type:"room-control",playerId:v.seat,command,ready:true}},seat.token);assert.equal(res.status,200);}
 let v=await view(a);let response=await post(`/api/rooms/${a.id}/actions`,{revision:v.revision,action:v.actions.find(a=>a.action.type==="roll-round").action},a.token);assert.equal(response.status,200);v=await response.json();
 await seen(live,m=>m.type==="state"&&m.view.revision===v.revision);const before=v,worker=v.actions.find(a=>a.action.type==="use-die"&&a.action.intent.kind==="take-workers"&&a.action.adjustment.workersSpent===0).action;
 const requests=await Promise.all([post(`/api/rooms/${a.id}/actions`,{revision:v.revision,action:worker},a.token),post(`/api/rooms/${a.id}/actions`,{revision:v.revision,action:worker},a.token)]);assert.deepEqual(requests.map(r=>r.status).sort(),[200,409]);v=await view(a);assert.equal(v.players[0].workers,before.players[0].workers+2);
 const pushed=await seen(live,m=>m.type==="state"&&m.view.revision===v.revision);assert.equal(pushed.view.random,undefined);assert.equal(pushed.view.supplyPools,undefined);assert.equal(JSON.stringify(pushed).includes(a.token),false);assert.equal(JSON.stringify(pushed).includes(b.token),false);
 const forbidden=new WebSocket(`${origin.replace("http","ws")}/api/rooms/${a.id}/live`,{origin:"https://other.example"});forbidden.on("error",()=>{});const rejected=await once(forbidden,"unexpected-response");assert.equal(rejected[1].statusCode,403);rejected[1].resume();forbidden.terminate();
 const bad=await socket({id:a.id,token:"x".repeat(64)});await once(bad.ws,"close");
 if(version!=="development"){const old=await socket(a,"old");await seen(old,m=>m.type==="update");}
 const stale=await fetch(`${origin}/api/rooms/${a.id}/actions`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${a.token}`},body:JSON.stringify({revision:before.revision,action:worker})});assert.equal(stale.status,version==="development"?409:426);
 const saved=await view(a);await stop();await start();assert.deepEqual(await view(a),saved);const recovered=await socket(a);await seen(recovered,m=>m.type==="state"&&m.view.revision===saved.revision);
 const snapshots=(await readdir(join(dir,"snapshots"))).sort();assert.ok(snapshots.length>=2);await stop();dataDir=join(dir,"recovery");assert.equal(await restoreRooms(join(dir,"snapshots",snapshots.at(-1)),dataDir),1);await start();assert.deepEqual(await view(a),saved);assert.equal(logs.includes(a.token),false);assert.equal(logs.includes(b.token),false);
});
