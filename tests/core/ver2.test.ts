import {test} from "node:test";
import assert from "node:assert/strict";
import {townHallVineFixture,blackVineFixture} from "../fixtures/vineyards";
import {applyCoreAction,listCoreActionOptions,validateCoreAction} from "../../src/game/core";
import {immediateOptions,prepareTileEffect,upgradeTownHallChoice} from "../../src/game/core/effects";
import {parseSavedGame,serializeSavedGame} from "../../src/game/save";
import type {ActionIntent,GameState} from "../../src/game/types";
import {discardStored} from "../../src/game/vineyards";
import {refreshPendingChoice} from "../../src/game/core/effects";
import {boardTarget} from "../../src/game/direct-actions";
import {createActionLog,readActionLog,actionLabel} from "../../src/game/action-log";
import {coreFixture} from "./fixture";
import {marketRewardFixture,earnedCastleBonusFixture} from "../fixtures/ver2";
import {RoomStore,RoomError} from "../../src/server/rooms";
import {mkdtemp,readFile,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {beginHistory} from "../../src/game/turn-history";

const save=(game:GameState)=>parseSavedGame(serializeSavedGame({format:"burgundy-local-v1",randomAlgorithm:"counter-v1",game,logs:[],view:{zoom:1,focus:false,boardZooms:{}}})).game;
test("all unrestricted reserve placement rewards allow vines, consume no die, preserve bonuses and restore saves",()=>{
 let g=townHallVineFixture();g=discardStored(g,g.players[0].id,g.players[0].storage.filter((id):id is string=>!!id));const id=g.vineyards!.bag[0];g=refreshPendingChoice({...g,vineyards:{...g.vineyards!,bag:g.vineyards!.bag.slice(1)},players:g.players.map((p,i)=>i?p:{...p,vineyardReserve:[{tileId:id,keys:[0,1]}]})});const c=g.turn.pendingChoice!,options=c.options.filter(o=>(o.payload as unknown as {intent?:ActionIntent})?.intent?.kind==="vineyard");
 assert.ok(options.length>=2);const before=save(g);
 for(const option of options){const i=(option.payload as unknown as {intent:ActionIntent}).intent;assert.equal(i.kind==="vineyard"&&i.command,"place");const a={type:"resolve-choice" as const,playerId:g.turn.activePlayerId!,choiceId:c.id,optionId:option.id};const result=applyCoreAction(g,a);assert.ok(result.ok,JSON.stringify(result));const next=result.value.state;
  assert.deepEqual(next.dice,g.dice);assert.equal(next.players[0].vineyardReserve!.length,g.players[0].vineyardReserve!.length-1);assert.equal(next.vineyards!.players[g.players[0].id].placed.length,g.vineyards!.players[g.players[0].id].placed.length+1);assert.ok(next.turn.pendingChoice);assert.deepEqual(save(next),next);assert.equal(validateCoreAction(next,a).valid,false);
 }
 assert.deepEqual(g,before);
 const legacy={...g,turn:{...g.turn,pendingChoice:{...c,options:c.options.filter(o=>!options.includes(o))}}};
 assert.deepEqual(upgradeTownHallChoice(legacy),g);assert.deepEqual(save(legacy),g);
 const tampered={...legacy,turn:{...legacy.turn,pendingChoice:{...legacy.turn.pendingChoice,options:legacy.turn.pendingChoice.options.slice(1)}}};assert.equal(upgradeTownHallChoice(tampered),tampered);assert.throws(()=>save(tampered));
});
test("public action logs use real consumed dice, hide zero points and coordinates, and handle player two",()=>{
 const g=coreFixture();g.turn.activePlayerId="p2";const a={type:"use-die" as const,playerId:"p2",dieId:"p2:a",adjustment:{steps:[] as const,workersSpent:0},intent:{kind:"take-workers" as const}};
 const result=applyCoreAction(g,a);assert.ok(result.ok);const log=readActionLog(createActionLog(g,result.value.state,a));assert.deepEqual(log.dice,[{index:1,value:1,source:'player',color:'red'}]);assert.match(log.text,/일꾼 \+2/);assert.ok(!log.text.includes("승점 +0"));assert.ok(!log.text.includes("일꾼 +0"));
 const start={type:"place-starting-castle" as const,playerId:"p2",cellId:"private-cell-coordinate"};assert.equal(actionLabel(g,start),"시작 성 배치");
 const legacy=readActionLog("성 → (q2,r3) 배치 · 승점 +0");assert.deepEqual(legacy,{text:"성 배치",dice:[]});
 assert.equal(readActionLog('행동 (승점 +0 · 은화 +1 · 일꾼 +0)').text,'행동 (은화 +1 · 일꾼 +0)');
 assert.equal(readActionLog('영주 · 포도 배치 V01 · 뒤집기 · 승점 +0').text,'영주 · 포도 배치 · 뒤집기');
 assert.equal(readActionLog('영주 · 방패17 획득 · 성 se:base:2:q0r0 · 두 주사위 · 일꾼0').text,'영주 · 방패17 획득 · 두 주사위 · 일꾼0');
 const noDice=readActionLog(createActionLog(g,g,{type:"resolve-choice",playerId:"p2",choiceId:"x",optionId:"skip"}));assert.deepEqual(noDice.dice,[]);
 assert.deepEqual(g.dice.players.p2.map(d=>d.used),[false,false]);
});
test("earned completion icons use a real placement bonus removed from the supply",()=>{const g=earnedCastleBonusFixture(),b=g.players[0].bonuses[0];assert.equal(b.color,"castle");assert.equal(g.market.bonusTiles.some(x=>x.id===b.id),false);assert.deepEqual(save(g),g);});
test("market reward cannot turn a black tile into a numbered-depot free action; vine black reward stays legal",()=>{
 let g=blackVineFixture();const vine=listCoreActionOptions(g,g.turn.activePlayerId!);assert.ok(vine.ok);assert.ok(vine.value.actions.some(a=>!!boardTarget(g,a).blackTile));
 const building=Object.values(g.tiles).find(t=>t.type==="building"&&t.building==="market")!;assert.ok(building);
 const p=g.players[0],cell=p.duchy.cells.find(c=>c.terrain==="building")!;
 g={...g,players:g.players.map((p,i)=>i?p:{...p,duchy:{...p.duchy,cells:p.duchy.cells.map(c=>c.id===cell.id?{...c,tileId:building.id}:c)}})};g=prepareTileEffect(g,p.id,building.id);
 const black=g.market.blackDepot.find((id):id is string=>!!id)!;
 assert.ok(immediateOptions(g,g.players[0],"market").every(o=>{const i=(o.payload as unknown as {intent?:ActionIntent})?.intent;return !i||i.kind==="take-tile"&&!!g.market.numberedDepots.find(d=>d.number===i.depot)?.slots.some(s=>s.tileId===i.tileId);}));
 const forged={type:"resolve-choice" as const,playerId:p.id,choiceId:g.turn.pendingChoice!.id,optionId:JSON.stringify({kind:"take-tile",depot:1,tileId:black,storageSlot:0})};assert.equal(validateCoreAction(g,forged).valid,false);assert.equal(applyCoreAction(g,forged).ok,false);
});
test("online ordinary market rejects forged black reward, preserves paid opt-in, authenticates, and restores both seats",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"burgundy-ver2-")),store=new RoomStore(dir),owner=await store.create("A",true),guest=await store.joinRoom(owner.id,"B"),file=join(dir,`${owner.id}.json`),room=JSON.parse(await readFile(file,'utf8')),g=marketRewardFixture();room.game=g;room.history=beginHistory(g,room.logs,true);await writeFile(file,JSON.stringify(room));
 const v=await store.view(owner.id,owner.token),black=v.blackDepot.find(id=>!!id)!;assert.equal(v.actions.some(a=>!!a.target.blackTile),false);assert.ok(v.actions.some(a=>a.action.type==="buy-black-tile"&&a.action.tileId===black));
 const forged={type:"resolve-choice",playerId:"seat-1",choiceId:g.turn.pendingChoice!.id,optionId:JSON.stringify({kind:"take-tile",depot:1,tileId:black,storageSlot:0})};await assert.rejects(()=>store.act(owner.id,owner.token,v.revision,forged),e=>e instanceof RoomError&&e.status===400);assert.deepEqual((await store.view(owner.id,owner.token)).players,v.players);
 const allowed=v.actions.find(a=>a.target.intent?.kind==="take-tile")!;assert.ok(allowed);await assert.rejects(()=>store.act(owner.id,guest.token,v.revision,allowed.action),e=>e instanceof RoomError&&e.status===403);
 const after=await store.act(owner.id,owner.token,v.revision,allowed.action),peer=await new RoomStore(dir).view(owner.id,guest.token);assert.deepEqual(peer.players,after.players);assert.deepEqual(peer.blackDepot,v.blackDepot);assert.equal(after.players[0].silver,v.players[0].silver);assert.equal(JSON.parse(await readFile(file,'utf8')).game.turn.blackPurchaseUsed,false);
});
