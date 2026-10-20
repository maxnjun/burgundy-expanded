import {createPracticeSession} from '../../src/game/practice';
import {chooseComputerAction} from '../../src/game/computer';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {beginHistory,recordTurnAction,undoTurn,canUndoTurn,turnKey} from '../../src/game/turn-history';
import {applyCoreAction} from '../../src/game/core';
import {directActions,directShieldActions} from '../../src/game/direct-actions';
import {setup,roundtrip} from '../fixtures/shields';
import {whiteFixture,choice} from '../fixtures/white-castles';
import {vineFixture} from '../fixtures/vineyards';
import type {GameAction,GameState} from '../../src/game/types';
function step(g:GameState,a:GameAction){const r=applyCoreAction(g,a);assert.ok(r.ok,r.ok?'':JSON.stringify(r.issues));return r.value.state;}
for(const count of [2,3,4])test(`turn snapshots ${count} seats restore all resources, RNG, supply, dice, logs and branching`,()=>{
 const g=setup(count),h=beginHistory(g,['start'],true);
 const a=directActions(g,'seat-1').find(a=>a.type==='use-die'&&a.intent.kind==='take-workers')!;
 const one=step(g,a),h1=recordTurnAction(h,g,one,a,['start'],['worker']);
 const b=directActions(one,'seat-1').find(a=>a.type==='buy-black-tile')!,two=step(one,b),h2=recordTurnAction(h1,one,two,b,['worker'],['purchase']);
 assert.deepEqual(undoTurn(h2,two,'turn')!.snapshot,{game:g,logs:['start']});
 const undo=undoTurn(h2,two,'action')!;assert.deepEqual(undo.snapshot,{game:one,logs:['worker']});
 const again=undoTurn(undo.history,undo.snapshot.game,'action')!;assert.deepEqual(again.snapshot.game,g);assert.equal(canUndoTurn(again.history,g,'action'),false);
 const alternative=directActions(one,'seat-1').find(a=>a.type==='use-die'&&a.intent.kind==='take-workers')!;
 const branch=step(one,alternative),branched=recordTurnAction(undo.history,one,branch,alternative,['worker'],['branch']);
 assert.deepEqual(undoTurn(branched,branch,'action')!.snapshot.game,one);
 const end=step(branch,{type:'end-turn',playerId:'seat-1'}),closed=recordTurnAction(branched,branch,end,{type:'end-turn',playerId:'seat-1'},[],[]);
 assert.notEqual(turnKey(g),turnKey(end));assert.equal(undoTurn(closed,end,'turn'),null);assert.equal(undoTurn(branched,end,'action'),null);
 const loaded=roundtrip(one);assert.equal(undoTurn(beginHistory(loaded,[]),loaded,'turn'),null);
});
test('shield acquisition, spent dice and all mounted effects restore atomically',()=>{
 const g=setup(),a=directShieldActions(g,'seat-1',(g.extensionStates.shields as unknown as {slots:{id:string}[]}).slots[0].id)[0];assert.ok(a);
 const next=step(g,a),h=recordTurnAction(beginHistory(g,[],true),g,next,a,[],['shield']);assert.deepEqual(undoTurn(h,next,'turn')!.snapshot.game,g);
});
test('white castle bonus chain is one completed undo unit and pending choices block undo/end',()=>{
 const g=whiteFixture(),a:GameAction={type:'use-die',playerId:'p1',dieId:'p1:a',adjustment:{workersSpent:0,steps:[]},intent:{kind:'place-tile',tileId:'white',cellId:'target'}};
 const pending=step(g,a),h=recordTurnAction(beginHistory(g,[],true),g,pending,a,[],[]);assert.ok(pending.turn.pendingChoice);assert.equal(undoTurn(h,pending,'action'),null);
 assert.equal(applyCoreAction(pending,{type:'end-turn',playerId:'p1'}).ok,false);
 const child=choice(pending,p=>p.intent?.kind==='take-workers'),done=step(pending,child),finished=recordTurnAction(h,pending,done,child,[],[]);
 assert.equal(finished.past.length,1);assert.deepEqual(undoTurn(finished,done,'action')!.snapshot.game,g);
});
test('vineyard double placement and both child bonuses undo to before placement',()=>{
 const original=vineFixture(),take=directActions(original,'seat-1').find(a=>a.type==='use-die'&&a.intent.kind==='vineyard'&&a.intent.command==='take')!,g=step(original,take);
 let h=beginHistory(g,[],true),next=g;const place=directActions(g,'seat-1').find(a=>a.type==='use-die'&&a.intent.kind==='vineyard'&&a.intent.slotId==='V01')!;assert.ok(place);
 next=step(g,place);h=recordTurnAction(h,g,next,place,[],[]);let guard=0;
 while(next.turn.pendingChoice){assert.ok(++guard<25);const a=directActions(next,'seat-1').find(a=>a.type==='resolve-choice'&&a.optionId==='skip')??directActions(next,'seat-1').find(a=>a.type==='resolve-choice')!;const after=step(next,a);h=recordTurnAction(h,next,after,a,[],[]);next=after;}
 assert.equal(h.past.length,1);assert.deepEqual(undoTurn(h,next,'turn')!.snapshot.game,g);
});

test('all extensions AI25 rounds: every settled action and turn restores its complete original state',()=>{
 let game=createPracticeSession({names:['A','B'],seed:'shield-ai-2',officialSlots:true,fullEffects:true,shieldRules:true,vineyards:true,tradeRoutes:true,inns:true,whiteCastles:true,additionalHexes:true,boardIds:['se:base:2','se:base:2']});
 let history=beginHistory(game,[],true),root=game,start=game,n=0,checks=0;
 while(game.status!=='finished'){
  assert.ok(++n<1400);const a=chooseComputerAction(game);assert.ok(a.ok);if(!game.turn.pendingChoice&&!game.turn.pendingEffects.length)root=game;
  const next=step(game,a.value);history=recordTurnAction(history,game,next,a.value,[],[]);
  if(turnKey(game)!==turnKey(next))start=next;
  if(canUndoTurn(history,next,'action')){assert.deepEqual(undoTurn(history,next,'action')!.snapshot.game,root);checks++;}
  if(canUndoTurn(history,next,'turn'))assert.deepEqual(undoTurn(history,next,'turn')!.snapshot.game,start);
  game=next;
 }
 assert.ok(checks>20);assert.ok(game.finalScores);assert.equal(game.turn.phase,'E');assert.equal(game.turn.round,5);
});
