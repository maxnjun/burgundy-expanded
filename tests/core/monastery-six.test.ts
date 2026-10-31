import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {monasterySixFixture} from '../fixtures/monastery-six';
import {applyCoreAction,validateCoreAction,validateCoreState} from '../../src/game/core';
import {directActions} from '../../src/game/direct-actions';
import {purchaseUsed} from '../../src/game/purchases';
import {parseSavedGame,serializeSavedGame} from '../../src/game/save';
import {actionLabel,createActionLog,readActionLog} from '../../src/game/action-log';
import {actionGuidance,canPurchaseTile} from '../../src/game/action-guidance';
import {beginHistory,recordTurnAction,undoTurn} from '../../src/game/turn-history';
import {serializeTurnHistory,restoreTurnHistory} from '../../src/game/turn-history-cache';
import {chooseComputerAction} from '../../src/game/computer';
import {RoomStore} from '../../src/server/rooms';
import type {GameState,GameAction,TileType} from '../../src/game/types';

const actions=(s:GameState)=>directActions(s,s.turn.activePlayerId!);
function buy(s:GameState,type:TileType='ship'){
 const a=actions(s).find(a=>a.type==='use-monastery-six'&&s.tiles[a.tileId].type===type);assert.ok(a);return a as Extract<GameAction,{type:'use-monastery-six'}>;
}
function silver(s:GameState){const a=actions(s).find(a=>a.type==='buy-black-tile');assert.ok(a);return a as Extract<GameAction,{type:'buy-black-tile'}>;}
function step(s:GameState,a:GameAction){const r=applyCoreAction(s,a);assert.ok(r.ok,JSON.stringify(r));return r.value.state;}
const saved=(s:GameState)=>serializeSavedGame({format:'burgundy-local-v1',randomAlgorithm:'counter-v1',game:s,logs:[],view:{hotseat:true,zoom:1,focus:false,table:true,boardZooms:{}}});
function rejects(s:GameState,a:GameAction){const before=structuredClone(s);assert.equal(validateCoreAction(s,a).valid,false);assert.equal(applyCoreAction(s,a).ok,false);assert.deepEqual(s,before);}
for(const type of ['building','castle','mine','ship','livestock','monastery'] as const)test(`monastery6 purchases numbered ${type} with exactly two workers and no dice/silver`,()=>{
 const s=monasterySixFixture(),a=buy(s,type),next=step(s,a);assert.equal(next.players[0].workers,4);assert.equal(next.players[0].silver,6);assert.equal(next.players[0].storage[a.storageSlot],a.tileId);
 assert.equal(next.market.numberedDepots.find(d=>d.number===a.depot)!.slots.some(slot=>slot.tileId===a.tileId),false);assert.deepEqual(next.dice,s.dice);assert.equal(purchaseUsed(next.turn),true);assert.equal(next.turn.blackPurchaseUsed,true);
 assert.match(actionLabel(s,a),/수도원 6번 · 일꾼 2개/);assert.equal(readActionLog(createActionLog(s,next,a)).tileId,a.tileId);assert.deepEqual(parseSavedGame(saved(next)).game,next);
});
test('source, owner, resources, stale targets and storage replacement are validated without spending on failure',()=>{
 const s=monasterySixFixture(),a=buy(s);rejects(s,{...a,tileId:s.market.blackDepot.find((id):id is string=>!!id)!});rejects(s,{...a,tileId:s.vineyards!.depots[0].tileId!});rejects(s,{...a,depot:(a.depot===1?2:1)});rejects(s,{...a,playerId:'seat-2'});
 const poor=structuredClone(s);poor.players[0].workers=1;rejects(poor,a);poor.players[0].workers=2;poor.players[0].silver=0;assert.equal(step(poor,a).players[0].workers,0);rejects(poor,silver(s));
 const missing=structuredClone(s);const slot=missing.market.numberedDepots.find(d=>d.number===a.depot)!.slots.find(x=>x.tileId===a.tileId)!;slot.tileId=null;missing.market.removedTileIds.push(a.tileId);rejects(missing,a);
 const full=structuredClone(s);for(let i=0;i<3;i++){const pool=full.market.supplyPools.find(p=>p.remainingTileIds.length)!;full.players[0].storage[i]=pool.remainingTileIds.pop()!;}assert.equal(validateCoreState(full).valid,true);rejects(full,a);rejects(full,{...a,discardTileId:full.players[0].storage[1]!});
 const old=full.players[0].storage[0]!,replaced=step(full,{...a,discardTileId:old});assert.equal(replaced.players[0].storage[0],a.tileId);assert.ok(replaced.market.removedTileIds.includes(old));assert.equal(replaced.players[0].workers,4);
 const inactive=structuredClone(s),cell=inactive.players[0].duchy.cells.find(c=>c.tileId&&inactive.tiles[c.tileId].type==='monastery'&&(inactive.tiles[c.tileId] as {number?:number}).number===6)!;inactive.market.removedTileIds.push(cell.tileId!);cell.tileId=null;rejects(inactive,a);
});
for(const first of ['silver','workers'] as const)test(`${first} purchase blocks both currencies, vineyard store and inns until next turn`,()=>{
 const s=monasterySixFixture(),worker=buy(s),coin=silver(s),next=step(s,first==='silver'?coin:worker);assert.equal(next.players[0].workers,first==='silver'?6:4);assert.equal(next.players[0].silver,first==='silver'?4:6);const store=actions(s).find(a=>a.type==='extension'&&a.extensionId==='vineyards'&&a.command==='buy');assert.ok(store);rejects(next,store);rejects(next,{...worker,storageSlot:1});rejects(next,{...coin,storageSlot:1});
 assert.equal(actions(next).some(a=>a.type==='buy-black-tile'||a.type==='use-monastery-six'||a.type==='extension'&&a.extensionId==='vineyards'&&a.command==='buy'),false);assert.equal(canPurchaseTile(actions(next)),false);
 const legacy=structuredClone(s);legacy.turn.monasterySixUsed=true;legacy.turn.blackPurchaseUsed=false;assert.deepEqual(parseSavedGame(saved(legacy)).game,legacy);rejects(legacy,coin);rejects(legacy,worker);
 let g=next;for(let turn=0;turn<2;turn++){for(const d of g.dice.players[g.turn.activePlayerId!])if(!d.used)g=step(g,{type:'use-die',playerId:g.turn.activePlayerId!,dieId:d.id,intent:{kind:'take-workers'},adjustment:{steps:[],workersSpent:0}});g=step(g,{type:'end-turn',playerId:g.turn.activePlayerId!});assert.equal(purchaseUsed(g.turn),false);if(turn===0){assert.equal(g.turn.activePlayerId,'seat-2');g=step(g,silver(g));assert.equal(g.players[1].silver,4);assert.equal(purchaseUsed(g.turn),true);}}
 g=step(g,{type:'roll-round',playerId:g.turn.orderTrack[0].players[0]});assert.equal(g.turn.activePlayerId,'seat-1');assert.ok(buy(g));
});
for(const count of [2,3,4] as const)test(`hotseat ${count} purchase, both undo scopes, logs and save/history roundtrip preserve the exact state`,()=>{
 const s=monasterySixFixture(count),a=buy(s),next=step(s,a),logs=[createActionLog(s,next,a)],h=recordTurnAction(beginHistory(s,[],true),s,next,a,[],logs);
 for(const kind of ['turn','action'] as const){const restored=restoreTurnHistory(serializeTurnHistory(next,logs,h),next,logs),undo=undoTurn(restored,next,kind);assert.ok(undo);assert.deepEqual(undo.snapshot.game,s);assert.deepEqual(undo.snapshot.logs,[]);assert.equal(purchaseUsed(undo.snapshot.game.turn),false);assert.ok(buy(undo.snapshot.game));}
 const ai=chooseComputerAction(s,'seat-1');assert.ok(ai.ok);assert.ok(validateCoreAction(s,ai.value).valid);assert.deepEqual(parseSavedGame(saved(next)).game,next);assert.equal(validateCoreState(next).valid,true);
});
test('AI spends the shared opportunity on a valid worker purchase and cannot buy twice',()=>{
 const s=monasterySixFixture();s.players[0].workers=2;s.players[0].silver=0;for(const d of s.dice.players['seat-1'])d.used=true;
 const chosen=chooseComputerAction(s,'seat-1');assert.ok(chosen.ok);assert.equal(chosen.value.type,'use-monastery-six');const next=step(s,chosen.value);assert.equal(next.players[0].workers,0);assert.equal(purchaseUsed(next.turn),true);assert.equal(actions(next).some(a=>a.type==='use-monastery-six'||a.type==='buy-black-tile'),false);
});
test('worker-only buying remains available after dice and the guidance is not limited to silver',()=>{
 const s=monasterySixFixture();s.players[0].silver=0;for(const d of s.dice.players['seat-1'])d.used=true;assert.equal(canPurchaseTile(actions(s)),true);assert.match(actionGuidance(s,actions(s)),/구매 가능/);assert.match(actionGuidance(s,actions(s),{special:true}),/번호 공급처 타일/);
});
test('server validates shared purchase, peer sync, duplicate IDs, both undo scopes and restart restore',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'burgundy-m6-')),store=new RoomStore(directory),a=await store.create('수도원1'),b=await store.joinRoom(a.id,'수도원2'),path=join(directory,a.id+'.json'),raw=JSON.parse(await readFile(path,'utf8')),s=monasterySixFixture();raw.game=s;raw.logs=[];raw.history=beginHistory(s,[],true);await writeFile(path,JSON.stringify(raw));
 let v=await store.view(a.id,a.token);assert.equal(v.purchase!.monasterySix,true);const action=buy(s);v=await store.act(a.id,a.token,v.revision,action,'monastery-six-request-0001');assert.equal(v.purchase!.used,true);assert.equal(v.players[0].workers,4);
 assert.equal((await store.act(a.id,a.token,s.revision,action,'monastery-six-request-0001')).revision,v.revision);await assert.rejects(store.act(a.id,b.token,v.revision,{...action,playerId:'seat-1'}));await assert.rejects(store.act(a.id,a.token,v.revision,{...silver(s),storageSlot:1},'monastery-six-request-0002'));const restarted=new RoomStore(directory),peer=await restarted.view(a.id,b.token);assert.deepEqual(peer.players,v.players);assert.deepEqual(peer.depots,v.depots);assert.equal(peer.purchase!.used,true);
 for(const kind of ['undo-action','undo-turn'] as const){v=await restarted.act(a.id,a.token,v.revision,{type:kind,playerId:'seat-1'});const current=JSON.parse(await readFile(path,'utf8'));assert.deepEqual({...current.game,revision:0},{...s,revision:0});assert.equal(v.logs.length,0);assert.equal(v.purchase!.used,false);if(kind==='undo-action')v=await restarted.act(a.id,a.token,v.revision,action,'monastery-six-request-0003');}
});
