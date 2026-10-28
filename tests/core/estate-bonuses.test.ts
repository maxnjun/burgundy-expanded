import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {completionReady,completionAction} from '../fixtures/estate-bonuses';
import {step,roundtrip} from '../fixtures/shields';
import {directActions} from '../../src/game/direct-actions';
import {finalScore} from '../../src/game/core';
import {beginHistory,recordTurnAction,undoTurn} from '../../src/game/turn-history';
import {RoomStore} from '../../src/server/rooms';
import type {TileType} from '../../src/game/types';

for(const count of [2,3,4])test(`${count}p completion first/second awards, exhaustion, score once, save and undo`,()=>{
 let game=completionReady(count);assert.equal(game.market.bonusTiles.length,12);
 for(let index=0;index<count;index++){
  const before=game,action=completionAction(game),player=game.players[index];
  game=step(game,action);
  const bonus=game.players[index].bonuses.find(b=>b.color==='mine');
  if(index<2){assert.equal(bonus?.points,count+(index===0?3:0));assert.equal(bonus?.rank,index===0?'first':'second');}
  else assert.equal(bonus,undefined);
  const award=game.scoreLedger[player.id].filter(e=>e.category==='color-bonus');
  assert.equal(award.reduce((n,e)=>n+e.points,0),bonus?.points??0);
  assert.equal(game.market.bonusTiles.filter(b=>b.color==='mine').length,Math.max(0,1-index));
  assert.deepEqual(roundtrip(game).players[index].bonuses,game.players[index].bonuses);
  const history=recordTurnAction(beginHistory(before,[],true),before,game,action,[],[]);
  for(const kind of ['turn','action'] as const)assert.deepEqual(undoTurn(history,game,kind)!.snapshot.game,before);
  const final=finalScore(game,game.players[index]);assert.ok(final.ok);
  assert.equal(final.value.earnedTotal,game.players[index].victoryPoints);
  assert.ok(!final.value.finalAdditions.some(e=>e.category==='color-bonus'));
  const worker=directActions(game,player.id).find(a=>a.type==='use-die'&&a.intent.kind==='take-workers');assert.ok(worker);
  game=step(game,worker);game=step(game,{type:'end-turn',playerId:player.id});
 }
});

for(const color of ['castle','mine','ship','livestock','building','monastery'] as TileType[])test(`${color} completion preserves correct color and claims one first tile`,()=>{
 const before=completionReady(2,color),game=step(before,completionAction(before));
 assert.equal(game.players[0].bonuses.filter(b=>b.color===color).length,1);
 assert.equal(game.players[0].bonuses.find(b=>b.color===color)!.points,5);
 assert.deepEqual(game.market.bonusTiles.filter(b=>b.color===color).map(b=>b.rank),['second']);
});

test('online bonus claim commits once, both seats recover after restart and server undo restores pool',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'estate-bonus-room-')),store=new RoomStore(directory);
 const a=await store.create('보상A'),b=await store.joinRoom(a.id,'보상B'),path=join(directory,`${a.id}.json`);
 const room=JSON.parse(await readFile(path,'utf8')),game=completionReady();
 room.game=game;room.history=beginHistory(game,[],true);await writeFile(path,JSON.stringify(room));
 const action=completionAction(game),results=await Promise.allSettled([store.act(a.id,a.token,game.revision,action),store.act(a.id,a.token,game.revision,action)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const restarted=new RoomStore(directory),first=await restarted.view(a.id,a.token),peer=await restarted.view(a.id,b.token);
 assert.deepEqual(peer.players.map(p=>p.bonuses),first.players.map(p=>p.bonuses));
 assert.deepEqual(peer.commonBoard.bonusTiles,first.commonBoard.bonusTiles);
 assert.equal(first.players[0].bonuses.find(b=>b.color==='mine')?.points,5);
 await assert.rejects(restarted.act(a.id,b.token,first.revision,{type:'undo-action',playerId:'seat-1'}));
 const restored=await restarted.act(a.id,a.token,first.revision,{type:'undo-action',playerId:'seat-1'});
 assert.deepEqual(restored.players[0].bonuses,game.players[0].bonuses);
 assert.deepEqual(restored.commonBoard.bonusTiles,game.market.bonusTiles);
 assert.equal(restored.players[0].victoryPoints,game.players[0].victoryPoints);
});
