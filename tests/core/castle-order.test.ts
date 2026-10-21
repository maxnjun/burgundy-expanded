import {test} from 'node:test';
import assert from 'node:assert/strict';
import {coreFixture} from './fixture';
import {setup,placed,roundtrip} from '../fixtures/shields';
import {prepareTileEffect} from '../../src/game/core/effects';
import {applyCoreAction,validateCoreState} from '../../src/game/core';
import {directActions,directBoardAction,boardTarget} from '../../src/game/direct-actions';
import {suspendCastleAction,isCastleAction} from '../../src/game/castle-actions';
import {actionGuidance} from '../../src/game/action-guidance';
import {beginHistory,recordTurnAction,undoTurn} from '../../src/game/turn-history';
import {serializeTurnHistory,restoreTurnHistory} from '../../src/game/turn-history-cache';
import type {GameState,GameAction,ActionIntent} from '../../src/game/types';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RoomStore,RoomError} from '../../src/server/rooms';
import {vineFixture} from '../fixtures/vineyards';
const step=(g:GameState,a:GameAction)=>{const r=applyCoreAction(g,a);assert.ok(r.ok,JSON.stringify(r));return r.value.state;};
function fixture(count:2|3|4=2){const s=coreFixture(count);s.revision=1;return prepareTileEffect(s,'p1','castle-0');}
const action=(g:GameState,kind:ActionIntent['kind'],die?:string)=>{const a=directBoardAction(g,directActions(g,'p1'),die,i=>i.kind===kind);assert.ok(a);return a;};
for(const count of [2,3,4] as const)for(const ordinaryFirst of [false,true])test(`castle and die remain independent: ${count}p ordinaryFirst=${ordinaryFirst}`,()=>{
 let g=fixture(count);assert.equal(actionGuidance(g,directActions(g,'p1')),'추가 행동 또는 주사위를 선택하세요.');const cursor=g.random.cursor;
 const first=action(g,'take-workers',ordinaryFirst?'p1:a':undefined);g=step(g,first);
 assert.deepEqual(g.dice.players.p1.map(d=>d.used),[ordinaryFirst,false]);assert.equal(isCastleAction(g),ordinaryFirst);
 g=step(g,action(g,'sell-goods',ordinaryFirst?undefined:'p1:a'));assert.equal(g.players[0].goods.some(x=>x.type===1),false);assert.equal(g.players[0].soldGoods.length,2);
 assert.equal(g.turn.pendingChoice,null);assert.deepEqual(g.dice.players.p1.map(d=>d.used),[true,false]);assert.equal(g.random.cursor,cursor);
 assert.equal(g.turn.activePlayerId,'p1');assert.equal(g.players[0].workers,3);
});
test('ordinary ship child blocks switching, preserves castle credit, restores after goods and rejects replay',()=>{
 let g=placed(setup(),0,{type:'castle',back:'matching-color'});const id=g.players[0].duchy.cells.filter(c=>c.tileId&&g.tiles[c.tileId].type==='castle').at(-1)!.tileId!;g={...prepareTileEffect(g,'seat-1',id),revision:g.revision+1};
 const castleId=g.turn.pendingChoice!.id;
 // An actual placed ship effect after a normal action suspends the independent castle benefit.
 const normal=directActions(g,'seat-1').find(a=>a.type==='use-die'&&a.intent.kind==='take-workers')!;const after=step(g,normal);assert.equal(isCastleAction(after),true);
 const ship=placed(after,0,{type:'ship',back:'matching-color'});const sid=ship.players[0].duchy.cells.find(c=>c.tileId&&ship.tiles[c.tileId].type==='ship')!.tileId!;
 const pending=prepareTileEffect(suspendCastleAction(ship),'seat-1',sid);assert.equal(validateCoreState(pending).valid,true);assert.equal(roundtrip(pending).turn.castleActions?.length,1);
 assert.equal(directActions(pending,'seat-1').some(a=>a.type==='use-die'),false);
 const choice=directActions(pending,'seat-1').find(a=>a.type==='resolve-choice')!;const done=step(pending,choice);assert.equal(done.turn.pendingChoice!.id,castleId);assert.equal(done.turn.castleActions!.length,0);assert.equal(applyCoreAction(done,choice).ok,false);
});
test('chronological undo restores extra credit and real dice independently, including cached history',()=>{
 let g=placed(setup(),0,{type:'castle',back:'matching-color'});const id=g.players[0].duchy.cells.filter(c=>c.tileId&&g.tiles[c.tileId].type==='castle').at(-1)!.tileId!;g={...prepareTileEffect(g,'seat-1',id),revision:g.revision+1};
 let h=beginHistory(g,[],true);const a=directActions(g,'seat-1').find(a=>a.type==='use-die'&&a.intent.kind==='take-workers')!;const one=step(g,a);h=recordTurnAction(h,g,one,a,[],[]);
 const b=directBoardAction(one,directActions(one,'seat-1'),undefined,i=>i.kind==='take-workers')!;const two=step(one,b);h=recordTurnAction(h,one,two,b,[],[]);
 const restored=restoreTurnHistory(serializeTurnHistory(two,[],h),roundtrip(two),[]);assert.equal(restored.past.length,2);
 const back=undoTurn(restored,two,'action')!;assert.deepEqual(back.snapshot.game,one);assert.ok(isCastleAction(back.snapshot.game));assert.deepEqual(undoTurn(back.history,one,'action')!.snapshot.game,g);assert.deepEqual(undoTurn(h,two,'turn')!.snapshot.game,g);
});
test('forged deferred credits and another player cannot consume a castle benefit',()=>{
 const g=fixture();const a=action(g,'take-workers');assert.equal(applyCoreAction(g,{...a,playerId:'p2'}).ok,false);
 const bad={...g,turn:{...g.turn,castleActions:[g.turn.pendingEffects[0],g.turn.pendingEffects[0]]}};assert.equal(validateCoreState(bad).valid,false);
 assert.equal(boardTarget(g,a).intent?.kind,'take-workers');
});
test('a castle inside an already-started vineyard effect cannot suspend its mandatory parent',()=>{
 const g=fixture(),vine=vineFixture().vineyards!;
 const waiting={...g,vineyards:{...vine,stack:[{...vine.stack[0]}]}} as GameState;
 assert.equal(isCastleAction(waiting),false);assert.equal(suspendCastleAction(waiting),waiting);
});
test('online castle/die order, canonical targets, ownership, stale revision and reconnect',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'burgundy-castle-order-')),store=new RoomStore(directory);
 try{
  const owner=await store.create('A',true),guest=await store.joinRoom(owner.id,'B'),path=join(directory,`${owner.id}.json`);
  const room=JSON.parse(await readFile(path,'utf8'));let g=placed(setup(),0,{type:'castle',back:'matching-color'});const id=g.players[0].duchy.cells.filter(c=>c.tileId&&g.tiles[c.tileId].type==='castle').at(-1)!.tileId!;g={...prepareTileEffect(g,'seat-1',id),revision:g.revision+1};room.game=g;await writeFile(path,JSON.stringify(room));
  let view=await store.view(owner.id,owner.token);assert.equal(view.castleAction,true);const die=view.actions.filter(a=>a.action.type==='use-die'&&a.target.intent?.kind==='take-workers').sort((a,b)=>(a.action.type==='use-die'?a.action.adjustment.workersSpent:0)-(b.action.type==='use-die'?b.action.adjustment.workersSpent:0))[0];
  await assert.rejects(()=>store.act(owner.id,guest.token,view.revision,die.action),e=>e instanceof RoomError&&e.status===403);
  const revision=view.revision;view=await store.act(owner.id,owner.token,revision,die.action);assert.equal(view.castleAction,true);assert.equal(view.dice.players['seat-1'].filter(d=>d.used).length,1);
  await assert.rejects(()=>store.act(owner.id,owner.token,revision,die.action),e=>e instanceof RoomError&&e.status===409);
  const reconnected=await new RoomStore(directory).view(owner.id,owner.token);assert.deepEqual(reconnected.actions,view.actions);
  const bonus=view.actions.find(a=>a.action.type==='resolve-choice'&&a.target.intent?.kind==='take-workers')!;view=await store.act(owner.id,owner.token,view.revision,bonus.action);assert.equal(view.castleAction,false);assert.equal(view.dice.players['seat-1'].filter(d=>d.used).length,1);assert.equal(view.players[0].workers,g.players[0].workers+4);
  await assert.rejects(()=>store.act(owner.id,owner.token,view.revision,bonus.action),e=>e instanceof RoomError&&e.status===400);
 }finally{await rm(directory,{recursive:true});}
});
