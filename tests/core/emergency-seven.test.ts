import {test} from 'node:test';import assert from 'node:assert/strict';
import {tradeFixture,directSale,tradeStep} from '../fixtures/custom-trade';
import {immediateOptions,upgradeTradeCastleChoice} from '../../src/game/core/effects';
import {parseSavedGame,serializeSavedGame} from '../../src/game/save';
import {validateCoreAction} from '../../src/game/core';
import {beginHistory,recordTurnAction,undoTurn} from '../../src/game/turn-history';
import {restoreTurnHistory,serializeTurnHistory} from '../../src/game/turn-history-cache';
import {connectionError} from '../../src/app/online/room-connection';
import type {ActionIntent,GameState} from '../../src/game/types';
const load=(g:GameState)=>parseSavedGame(serializeSavedGame({format:'burgundy-local-v1',randomAlgorithm:'counter-v1',game:g,logs:[],view:{zoom:1,focus:false,boardZooms:{}}})).game;
test('trade grants one unrestricted extra action; white-castle still follows white die and worker cost',()=>{
 const initial=tradeFixture('castle'),before={...initial,players:initial.players.map(p=>({...p,workers:0})),dice:{...initial.dice,whiteDie:1 as const}},sale=directSale(before),after=tradeStep(before,sale),choice=after.turn.pendingChoice!;
 const selected=choice.options.find(o=>(o.payload as {intent?:ActionIntent})?.intent?.kind==='take-tile'&&((o.payload as {intent?:ActionIntent}).intent as {depot?:number}).depot===6)!;assert.ok(selected);assert.equal((after.turn.pendingEffects[0].payload as {kind:string}).kind,'castle');
 assert.equal(immediateOptions(after,after.players[0],'white-castle',true).some(o=>(o.payload as {intent?:{depot?:number}})?.intent?.depot===6),false);
 const action={type:'resolve-choice' as const,playerId:'seat-1',choiceId:choice.id,optionId:selected.id},done=tradeStep(after,action);assert.deepEqual(done.dice,after.dice);assert.equal(done.players[0].workers,0);assert.equal(done.tradeRoutes!.routes['seat-1'].sales[0].status,'resolved');assert.equal(validateCoreAction(done,action).valid,false);assert.deepEqual(load(done),done);
 const h=recordTurnAction(beginHistory(before,[],true),before,after,sale,[],['sale']);assert.deepEqual(undoTurn(h,after,'action')!.snapshot.game,before);
});
test('only exact legacy pending trade white menu migrates; old completed trade and physical whites stay intact',()=>{
 const g=tradeStep(tradeFixture('castle'),directSale(tradeFixture('castle'))),effect=g.turn.pendingEffects[0],choice=g.turn.pendingChoice!;
 const legacy={...g,turn:{...g.turn,pendingEffects:[{...effect,payload:{...(effect.payload as object),kind:'white-castle'}}],pendingChoice:{...choice,options:immediateOptions(g,g.players[0],'white-castle',true)}}};
 const restored=load(legacy);assert.equal((restored.turn.pendingEffects[0].payload as {kind:string}).kind,'castle');assert.deepEqual(restored.dice,g.dice);assert.deepEqual(restored.turn.pendingChoice!.options,g.turn.pendingChoice!.options);
 const queued={...effect,id:effect.id+':queued',payload:{kind:'bank'}};assert.deepEqual(upgradeTradeCastleChoice({...legacy,turn:{...legacy.turn,pendingEffects:[...legacy.turn.pendingEffects,queued]}}).turn.pendingEffects.slice(1),[queued]);
 assert.throws(()=>load({...legacy,turn:{...legacy.turn,pendingChoice:{...legacy.turn.pendingChoice,options:legacy.turn.pendingChoice.options.slice(1)}}}));
 const pure={...legacy,turn:{...legacy.turn,pendingEffects:[{...effect,payload:{kind:'white-castle',tileId:'not-owned'}}]}};assert.throws(()=>load(pure));
});
test('network and timeout errors offer safe retry instead of raw signal errors',()=>{
 assert.match(connectionError(new DOMException('signal timed out','TimeoutError')),/같은 요청/);assert.match(connectionError(new TypeError('Failed to fetch')),/자리 정보/);assert.equal(connectionError(new Error('좌석 인증이 필요합니다.')),'좌석 인증이 필요합니다.');
});

test('legacy pending trade migration preserves trustworthy Undo snapshots and rejects a stale sidecar',()=>{
 const before=tradeFixture('castle'),sale=directSale(before),g=tradeStep(before,sale),effect=g.turn.pendingEffects[0],choice=g.turn.pendingChoice!;
 const legacy={...g,turn:{...g.turn,pendingEffects:[{...effect,payload:{...(effect.payload as object),kind:'white-castle'}}],pendingChoice:{...choice,options:immediateOptions(g,g.players[0],'white-castle',true)}}};
 const history=recordTurnAction(beginHistory(before,[],true),before,legacy,sale,[],['sale']),text=serializeTurnHistory(legacy,['sale'],history),restored=load(legacy);
 const undo=restoreTurnHistory(text,restored,['sale']);assert.deepEqual(undoTurn(undo,restored,'action')!.snapshot.game,before);
 assert.equal(restoreTurnHistory(text,{...restored,revision:restored.revision+1},['sale']).past.length,0);
});
