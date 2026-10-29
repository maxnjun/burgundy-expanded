import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {discardBoundary,discardStep} from '../fixtures/discarded-tiles';
import {boundary,setup,mount,step} from '../fixtures/shields';
import {createPracticeSession} from '../../src/game/practice';
import {applyCoreAction,listCoreActionOptions,orderedPlayers,validateCoreState} from '../../src/game/core';
import {parseSavedGame,serializeSavedGame} from '../../src/game/save';
import {beginHistory,recordTurnAction,undoTurn} from '../../src/game/turn-history';
import {RoomStore,RoomError} from '../../src/server/rooms';
import type {GameState} from '../../src/game/types';

const advance=(g:GameState)=>discardStep(g,{type:'advance-phase',playerId:orderedPlayers(g)[0]});
const saved=(game:GameState)=>({format:'burgundy-local-v1' as const,randomAlgorithm:'counter-v1' as const,game,logs:[],view:{zoom:1,focus:false,boardZooms:{}}});

test('A records exactly three remaining physical tiles, not purchases, prior removals, goods or player tiles',()=>{
 const before=discardBoundary(),purchased=before.players[0].storage[0]!,ids=before.market.numberedDepots.flatMap(d=>d.slots.flatMap(s=>s.tileId?[s.tileId]:[])).concat(before.market.blackDepot.filter((id):id is string=>!!id));
 const after=advance(before),entry=after.discardedTiles![0];assert.equal(entry.phase,'A');assert.deepEqual(entry.tileIds,ids);assert.equal(ids.length,3);assert.equal(entry.vineyardTileIds.length,0);
 assert.equal(entry.tileIds.filter(id=>after.tiles[id].type==='building').length,2);assert.ok(entry.tileIds.some(id=>after.tiles[id].type==='monastery'));
 assert.ok(!entry.tileIds.includes(purchased));assert.ok(entry.tileIds.every(id=>!before.market.removedTileIds.includes(id)));assert.deepEqual(after.players[0].storage,before.players[0].storage);
 assert.deepEqual(after.market.numberedDepots.map(d=>d.goods),before.market.numberedDepots.map(d=>d.goods));assert.equal(after.players[0].victoryPoints,before.players[0].victoryPoints);
 assert.deepEqual(before.discardedTiles,[]);assert.deepEqual(after.discardedTiles,advance(before).discardedTiles);assert.equal(applyCoreAction(after,{type:'advance-phase',playerId:'seat-1'}).ok,false);
});

test('A through E accumulate once; E records zero because existing final scoring keeps the remaining supply',()=>{
 let g=discardBoundary();const a=advance(g).discardedTiles![0];
 for(const phase of ['A','B','C','D','E']){g=advance(g);assert.equal(g.discardedTiles!.at(-1)!.phase,phase);assert.deepEqual(g.discardedTiles![0],a);if(phase!=='E')g=boundary(g);}
 assert.equal(g.discardedTiles!.length,5);assert.equal(g.status,'finished');assert.deepEqual(g.discardedTiles!.at(-1),{phase:'E',tileIds:[],vineyardTileIds:[]});assert.ok(g.market.numberedDepots.some(d=>d.slots.some(s=>s.tileId)));
 assert.deepEqual(parseSavedGame(serializeSavedGame(saved(g))).game,g);assert.deepEqual(createPracticeSession({names:['new1','new2'],seed:'new'}).discardedTiles,[]);
});

test('empty phase records zero and extension history follows actual vine removal while inns and shields carry over',()=>{
 const empty=advance(discardBoundary(0));assert.deepEqual(empty.discardedTiles,[{phase:'A',tileIds:[],vineyardTileIds:[]}]);
 const before=discardBoundary(3,true),v=before.vineyards!,vines=[...v.depots.flatMap(d=>d.tileId?[d.tileId]:[]),...v.store.filter((id):id is string=>!!id)],after=advance(before);
 assert.deepEqual(after.discardedTiles![0].vineyardTileIds,vines);assert.equal(after.discardedTiles![0].tileIds.length,3);assert.ok(before.market.inns!.stack.every(id=>after.market.inns!.stack.includes(id)));assert.ok(!after.discardedTiles![0].tileIds.some(id=>after.tiles[id].type==='inn'));
 const shield=boundary(setup()),next=advance(shield);assert.deepEqual(next.extensionStates.shields,shield.extensionStates.shields);assert.deepEqual(next.discardedTiles![0].vineyardTileIds,[]);
});

test('mandatory shield phase choices finish before recording, and cannot duplicate an unfinished transition',()=>{
 let g=boundary(mount(setup(),14));g=advance(g);assert.ok(g.turn.pendingChoice);assert.equal(g.discardedTiles?.length,0);assert.equal(applyCoreAction(g,{type:'advance-phase',playerId:'seat-1'}).ok,false);
 for(let limit=0;g.turn.pendingChoice;limit++){
  assert.ok(limit<20);const c=g.turn.pendingChoice,o=c.options.find(o=>o.id.includes('skip'))??c.options[0];g=step(g,{type:'resolve-choice',playerId:c.playerId,choiceId:c.id,optionId:o.id});
 }
 g=advance(g);assert.equal(g.discardedTiles!.length,1);assert.equal(g.discardedTiles![0].phase,'A');
});

test('legacy saves omit history without guessing prior phases; malformed references and future/duplicate phases reject',()=>{
 const after=advance(discardBoundary()),{discardedTiles:ignored,...legacy}=after;void ignored;
 const restored=parseSavedGame(JSON.stringify(saved(legacy))).game;assert.equal(restored.discardedTiles,undefined);
 assert.deepEqual(advance(boundary(restored)).discardedTiles!.map(p=>p.phase),['B']);
 const first=after.discardedTiles![0];
 for(const entries of [null,{},[first,first],[{...first,phase:'B'}],[{...first,tileIds:[first.tileIds[0],first.tileIds[0]]}],[{...first,tileIds:['missing']}],[{...first,tileIds:[after.players[0].storage[0]]}],[{...first,vineyardTileIds:['B-B:1']}]]){
  const bad={...after,discardedTiles:entries} as GameState;assert.equal(validateCoreState(bad).valid,false);assert.throws(()=>parseSavedGame(JSON.stringify(saved(bad))));
 }
});

test('ordinary turn Undo restores the complete history; phase boundary Undo remains blocked by the existing turn scope',()=>{
 const before=discardBoundary(),after=advance(before),boundaryHistory=recordTurnAction(beginHistory(before,[],true),before,after,{type:'advance-phase',playerId:'seat-1'},[],[]);
 assert.equal(undoTurn(boundaryHistory,after,'action'),null);
 const rolled=discardStep(after,{type:'roll-round',playerId:'seat-1'}),a={type:'use-die' as const,playerId:'seat-1',dieId:rolled.dice.players['seat-1'][0].id,adjustment:{workersSpent:0,steps:[]},intent:{kind:'take-workers' as const}},next=discardStep(rolled,a);
 const history=recordTurnAction(beginHistory(rolled,[],true),rolled,next,a,[],[]),undo=undoTurn(history,next,'action');assert.deepEqual(undo!.snapshot.game,rolled);assert.deepEqual(next.discardedTiles,rolled.discardedTiles);
});

test('server persists history and only its public tile definitions, synchronizes both seats and replays a request once',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'burgundy-discard-test-')),store=new RoomStore(directory),owner=await store.create('A'),guest=await store.joinRoom(owner.id,'B');
 const file=join(directory,`${owner.id}.json`),room=JSON.parse(await readFile(file,'utf8'));room.game=discardBoundary(3,true);room.history=beginHistory(room.game,[]);room.logs=[];await writeFile(file,JSON.stringify(room));
 const before=await store.view(owner.id,owner.token),action=before.actions.find(a=>a.action.type==='advance-phase')!.action;
 await assert.rejects(store.act(owner.id,guest.token,before.revision,action),e=>e instanceof RoomError&&e.status===403);
 const after=await store.act(owner.id,owner.token,before.revision,action,'discard-phase-request-001');assert.equal(after.discardedTiles!.length,1);
 assert.deepEqual((await store.act(owner.id,owner.token,before.revision,action,'discard-phase-request-001')).discardedTiles,after.discardedTiles);
 const peer=await new RoomStore(directory).view(owner.id,guest.token);assert.deepEqual(peer.discardedTiles,after.discardedTiles);assert.deepEqual(peer.tiles,after.tiles);
 for(const id of after.discardedTiles![0].tileIds)assert.equal(after.tiles[id].id,id);
 const raw=JSON.parse(await readFile(file,'utf8'));assert.deepEqual(raw.game.discardedTiles,after.discardedTiles);assert.ok(!raw.game.market.supplyPools[0].remainingTileIds.some((id:string)=>after.tiles[id]));
 assert.ok(!JSON.stringify(peer).includes('supplyPools'));assert.ok(!JSON.stringify(peer).includes(owner.token));
 assert.equal(listCoreActionOptions(raw.game,'seat-1').ok,true);
});
