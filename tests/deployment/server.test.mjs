import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,readdir,writeFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";
import {createServer as httpServer} from "node:http";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createServer} from "node:net";
import {spawn} from "node:child_process";
import {once} from "node:events";
import {setTimeout as delay} from "node:timers/promises";
import WebSocket from "ws";
import {restoreRooms} from "../../scripts/room-backups.mjs";

for(const storage of ["file","upstash"])test(`${storage}: production HTTP + WebSocket authenticate, synchronize and recover exact rooms after restart`,{timeout:120_000},async t=>{
 const dir=await mkdtemp(join(tmpdir(),"burgundy-production-")),probe=createServer();await new Promise(r=>probe.listen(0,"127.0.0.1",r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 const origin=`http://127.0.0.1:${port}`;let version=process.env.TEST_GAME_VERSION||"integration-release";
 let child,logs="",dataDir=dir,provider,providerDown=false,nodeOptions=process.env.NODE_OPTIONS||"";const sockets=[],values=new Map();let holdNextWrite=false,heldResponse,committed;
 if(storage==="upstash"){
  // HTTP provider contract fixture, not a live Upstash account or real Lua interpreter.
  provider=httpServer(async(req,res)=>{
   const chunks=[];for await(const chunk of req)chunks.push(chunk);
   assert.equal(req.headers.authorization,"Bearer deployment-test-only");
   if(providerDown){res.writeHead(429);res.end();return;}
   const [command,...args]=JSON.parse(Buffer.concat(chunks).toString());let result;
   if(command==="PING")result="PONG";
   else if(command==="GET")result=values.get(args[0])??null;
   else {
    assert.equal(command,"EVAL");const [,count,key,raw,revision]=args;assert.equal(count,1);
    const old=values.get(key);result=revision==="new"?old?0:1:old&&JSON.parse(old).game.revision===Number(revision)?1:0;if(result===1){values.set(key,raw);if(holdNextWrite){holdNextWrite=false;heldResponse=res;committed();return;}}
   }
   res.setHeader("Content-Type","application/json");res.end(JSON.stringify({result}));
  });
  await new Promise(r=>provider.listen(0,"127.0.0.1",r));
  const preload=join(dir,"provider-preload.mjs"),endpoint=`http://127.0.0.1:${provider.address().port}`;
  await writeFile(preload,`const original=globalThis.fetch;globalThis.fetch=(input,init)=>original(String(input).startsWith("https://deployment-test.upstash.io")?${JSON.stringify(endpoint)}:input,init);`);
  nodeOptions+=` --import=${pathToFileURL(preload).href}`;
 }
 const stop=async()=>{if(child&&child.exitCode===null){const exited=once(child,"exit");child.kill();await exited;}};
 t.after(async()=>{heldResponse?.destroy();for(const ws of sockets)ws.terminate();await stop();if(provider)await new Promise(r=>provider.close(r));});
 async function start(){child=spawn(process.execPath,["scripts/server.mjs"],{env:{...process.env,NODE_ENV:"production",HOST:"127.0.0.1",PORT:String(port),BURGUNDY_DATA_DIR:dataDir,APP_ORIGIN:origin,GAME_VERSION:version,BURGUNDY_STORAGE:storage,...(storage==="upstash"?{UPSTASH_REDIS_REST_URL:"https://deployment-test.upstash.io",UPSTASH_REDIS_REST_TOKEN:"deployment-test-only",BURGUNDY_ROOM_NAMESPACE:"staging",NODE_OPTIONS:nodeOptions}:{})},stdio:["ignore","pipe","pipe"]});
 child.stdout.on("data",b=>{logs=(logs+b.toString()).slice(-8000);});child.stderr.on("data",b=>{logs=(logs+b.toString()).slice(-8000);});
 for(let i=0;i<300;i++){if(child.exitCode!==null)throw Error(`Production server exited: ${logs}`);try{const res=await fetch(`${origin}/api/health`);if(res.ok){assert.equal((await res.json()).version,version);return;}}catch{}await delay(100);}throw Error("Production server health timeout");}
 const headers={"Content-Type":"application/json","X-Game-Version":version,"X-Game-Protocol":"1",Origin:origin};
 async function post(path,payload,token){return fetch(origin+path,{method:"POST",headers:{...headers,...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(payload)});}
 const view=async seat=>(await fetch(`${origin}/api/rooms/${seat.id}`,{headers:{Authorization:`Bearer ${seat.token}`}})).json();
 async function socket(seat,clientVersion=version){const ws=new WebSocket(`${origin.replace("http","ws")}/api/rooms/${seat.id}/live`,{origin});sockets.push(ws);const messages=[];ws.on("message",b=>messages.push(JSON.parse(b.toString())));await once(ws,"open");ws.send(JSON.stringify({type:"authenticate",token:seat.token,version:clientVersion,protocol:1}));return {ws,messages};}
 async function seen(client,predicate){for(let i=0;i<100;i++){const found=client.messages.find(predicate);if(found)return found;await delay(50);}throw Error("WebSocket update missing");}
 await start();const a=await(await post("/api/rooms",{name:"Desktop",lobby:true,chooseStartingCastles:true,shieldRules:true,whiteCastles:true,inns:true,tradeRoutes:true,vineyards:true})).json();assert.match(a.id,/^[a-f0-9]{24}$/);
 const b=await(await post(`/api/rooms/${a.id}/join`,{name:"Mobile"})).json();let live=await socket(b);await seen(live,m=>m.type==="state");
 for(const [seat,command]of [[a,"ready"],[b,"ready"],[a,"start"]]){const v=await view(seat);const res=await post(`/api/rooms/${a.id}/actions`,{revision:v.revision,action:{type:"room-control",playerId:v.seat,command,ready:true}},seat.token);assert.equal(res.status,200);}
 for(const seat of [a,b]){
  let setup=await view(seat),res=await post('/api/rooms/'+a.id+'/actions',{revision:setup.revision,action:setup.actions[0].action},seat.token);assert.equal(res.status,200);setup=await res.json();assert.ok(setup.startingPreview);
  if(seat===a){await seen(live,m=>m.type==='state'&&m.view.startingPreview?.cellId===setup.startingPreview.cellId);await stop();await start();assert.deepEqual(await view(a),setup);live=await socket(b);}
  res=await post('/api/rooms/'+a.id+'/actions',{revision:setup.revision,action:{type:'undo-turn',playerId:setup.seat}},seat.token);assert.equal(res.status,200);setup=await res.json();assert.equal(setup.startingPreview,undefined);
  res=await post('/api/rooms/'+a.id+'/actions',{revision:setup.revision,action:setup.actions[0].action},seat.token);assert.equal(res.status,200);setup=await res.json();
  res=await post('/api/rooms/'+a.id+'/actions',{revision:setup.revision,action:{type:'end-turn',playerId:setup.seat}},seat.token);assert.equal(res.status,200);
 }
 let v=await view(a);let response=await post(`/api/rooms/${a.id}/actions`,{revision:v.revision,action:v.actions.find(a=>a.action.type==="roll-round").action},a.token);assert.equal(response.status,200);v=await response.json();
 await seen(live,m=>m.type==="state"&&m.view.revision===v.revision);const before=v,worker=v.actions.find(a=>a.action.type==="use-die"&&a.action.intent.kind==="take-workers"&&a.action.adjustment.workersSpent===0).action;
 const requests=await Promise.all([post(`/api/rooms/${a.id}/actions`,{revision:v.revision,action:worker},a.token),post(`/api/rooms/${a.id}/actions`,{revision:v.revision,action:worker},a.token)]);assert.deepEqual(requests.map(r=>r.status).sort(),[200,409]);v=await view(a);assert.equal(v.players[0].workers,before.players[0].workers+2);
 const pushed=await seen(live,m=>m.type==="state"&&m.view.revision===v.revision);assert.equal(pushed.view.random,undefined);assert.equal(pushed.view.supplyPools,undefined);assert.equal(JSON.stringify(pushed).includes(a.token),false);assert.equal(JSON.stringify(pushed).includes(b.token),false);
 const undone=await post('/api/rooms/'+a.id+'/actions',{revision:v.revision,action:{type:'undo-action',playerId:v.seat}},a.token);assert.equal(undone.status,200);const restored=await undone.json();assert.deepEqual(restored.players,before.players);assert.deepEqual(restored.dice,before.dice);await seen(live,m=>m.type==='state'&&m.view.revision===restored.revision);assert.equal((await view(b)).revision,restored.revision);
 const replay=await post('/api/rooms/'+a.id+'/actions',{revision:restored.revision,action:worker},a.token);assert.equal(replay.status,200);v=await replay.json();
 const forbidden=new WebSocket(`${origin.replace("http","ws")}/api/rooms/${a.id}/live`,{origin:"https://other.example"});forbidden.on("error",()=>{});const rejected=await once(forbidden,"unexpected-response");assert.equal(rejected[1].statusCode,403);rejected[1].resume();forbidden.terminate();
 const bad=await socket({id:a.id,token:"x".repeat(64)});await once(bad.ws,"close");
 if(version!=="development"){const old=await socket(a,"old");await seen(old,m=>m.type==="update");}
 const stale=await fetch(`${origin}/api/rooms/${a.id}/actions`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${a.token}`},body:JSON.stringify({revision:before.revision,action:worker})});assert.equal(stale.status,version==="development"?409:426);
 let saved=await view(a);await stop();if(storage==="upstash")dataDir=join(dir,"empty-after-restart");await start();assert.deepEqual(await view(a),saved);const recovered=await socket(a);await seen(recovered,m=>m.type==="state"&&m.view.revision===saved.revision);
 if(storage==="file"){
  const snapshots=(await readdir(join(dir,"snapshots"))).sort();assert.ok(snapshots.length>=2);await stop();dataDir=join(dir,"recovery");assert.equal(await restoreRooms(join(dir,"snapshots",snapshots.at(-1)),dataDir),1);await start();assert.deepEqual(await view(a),saved);
 }else{
  // Kill the real Node process after external commit but before its HTTP reply.
  const current=await view(a),nextWorker=current.actions.find(a=>a.action.type==="use-die"&&a.action.intent.kind==="take-workers"&&a.action.adjustment.workersSpent===0).action;
  const payload={requestId:"restart-request-00001",revision:current.revision,action:nextWorker};
  const didCommit=new Promise(resolve=>{committed=resolve;});holdNextWrite=true;
  const lost=post('/api/rooms/'+a.id+'/actions',payload,a.token).catch(()=>null);await didCommit;
  const durable=[...values.values()][0],exited=once(child,"exit");child.kill("SIGKILL");await exited;heldResponse.destroy();assert.equal(await lost,null);
  const oldVersion=version;version+="-updated";headers["X-Game-Version"]=version;dataDir=join(dir,"empty-after-crash");await start();
  const outdated=await fetch(origin+'/api/rooms/'+a.id+'/actions',{method:"POST",headers:{...headers,"X-Game-Version":oldVersion,Authorization:'Bearer '+a.token},body:JSON.stringify(payload)});assert.equal(outdated.status,426);assert.equal([...values.values()][0],durable);
  const resumed=await post('/api/rooms/'+a.id+'/actions',payload,a.token);assert.equal(resumed.status,200);const recoveredAction=await resumed.json();
  assert.equal(recoveredAction.revision,current.revision+1);assert.equal(recoveredAction.players[0].workers,current.players[0].workers+2);
  assert.deepEqual(recoveredAction.players,JSON.parse(durable).game.players);assert.deepEqual(recoveredAction.dice,JSON.parse(durable).game.dice);
  assert.equal(JSON.parse(durable).requests.filter(r=>r.id===payload.requestId).length,1);assert.equal([...values.values()][0],durable);
  assert.equal((await post('/api/rooms/'+a.id+'/actions',payload,a.token)).status,200);assert.equal([...values.values()][0],durable);
  assert.equal((await view(b)).revision,recoveredAction.revision);const reconnected=await socket(a);await seen(reconnected,m=>m.type==="state"&&m.view.revision===recoveredAction.revision);
  saved=recoveredAction;
  assert.deepEqual(await readdir(dir),["provider-preload.mjs"]);assert.equal(values.size,1);
  providerDown=true;assert.equal((await fetch(`${origin}/api/health`)).status,503);assert.equal((await fetch(`${origin}/api/rooms/${a.id}`,{headers:{Authorization:`Bearer ${a.token}`}})).status,503);providerDown=false;
  assert.deepEqual(await view(a),saved);
 }
 assert.equal(logs.includes(a.token),false);assert.equal(logs.includes(b.token),false);
});
