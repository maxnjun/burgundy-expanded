import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPracticeSession} from '../../src/game/practice';
import {applyCoreAction,orderedPlayers} from '../../src/game/core';
import {directActions} from '../../src/game/direct-actions';
import {parseSavedGame,serializeSavedGame,type SavedGame} from '../../src/game/save';
import {beginHistory,recordTurnAction,undoTurn,canUndoTurn} from '../../src/game/turn-history';
import {serializeTurnHistory,restoreTurnHistory} from '../../src/game/turn-history-cache';
import {PLAYER_COLORS,normalizeSeatColors} from '../../src/game/player-colors';
import {createActionLog,readActionLog} from '../../src/game/action-log';
import type {GameState,GameAction} from '../../src/game/types';

function step(g:GameState,a:GameAction){const r=applyCoreAction(g,a);assert.ok(r.ok,r.ok?'':JSON.stringify(r.issues));return r.value.state;}
function save(game:GameState,logs:readonly string[]=[],undo?:string):SavedGame{return {format:'burgundy-local-v1',randomAlgorithm:'counter-v1',game,logs,...(undo?{undo}:{}),view:{zoom:1,focus:false,hotseat:true,computerPlayerIds:[],boardZooms:{}}};}
for(const count of [2,3,4])test(`hotseat ${count} seats retain identity, independent state, manual turns and file Undo`,()=>{
 let g=createPracticeSession({names:Array.from({length:count},(_,i)=>`플레이어 ${i+1}`),colors:PLAYER_COLORS.slice(0,count),seed:`hotseat-${count}`,officialSlots:true,fullEffects:true,vineyards:true,shieldRules:true,tradeRoutes:true,inns:true,geese:true,whiteCastles:true,boardIds:Array(count).fill('se:base:2')});
 g=step(g,{type:'roll-round',playerId:orderedPlayers(g)[0]});
 const order=orderedPlayers(g),first=g;
 for(const playerId of order){
  assert.equal(g.turn.activePlayerId,playerId);
  const start=g,untouched=g.players.filter(p=>p.id!==playerId);let h=beginHistory(g,[],true),logs:readonly string[]=[];
  for(let i=0;i<2;i++){
   const a=directActions(g,playerId).find(a=>a.type==='use-die'&&a.intent.kind==='take-workers')!;assert.ok(a);
   const next=step(g,a),nextLogs=[createActionLog(g,next,a),...logs];h=recordTurnAction(h,g,next,a,logs,nextLogs);g=next;logs=nextLogs;
   assert.equal(g.turn.activePlayerId,playerId);assert.deepEqual(g.players.filter(p=>p.id!==playerId),untouched);
   const log=readActionLog(logs[0]);assert.equal(log.playerId,playerId);assert.equal(log.playerColor,g.players.find(p=>p.id===playerId)!.color);
  }
  const file=parseSavedGame(serializeSavedGame(save(g,logs,serializeTurnHistory(g,logs,h))));assert.deepEqual(file.game,g);
  const restored=restoreTurnHistory(file.undo!,file.game,file.logs);assert.deepEqual(undoTurn(restored,g,'turn')!.snapshot.game,start);
  const ended=step(g,{type:'end-turn',playerId}),endedHistory=recordTurnAction(h,g,ended,{type:'end-turn',playerId},logs,logs);
  assert.equal(canUndoTurn(endedHistory,ended,'action'),false);g=ended;
 }
 assert.equal(first.players.length,count);assert.equal(g.turn.stage,'round-setup');
 assert.equal(parseSavedGame(serializeSavedGame(save(g))).view.hotseat,true);
});
test('seat colors normalize duplicates without losing prior seats; all six colors supported',()=>{
 assert.deepEqual(normalizeSeatColors(['purple','pink','purple','pink']),['purple','pink','blue','red']);
 for(const color of PLAYER_COLORS){const values=normalizeSeatColors([color]);assert.equal(values[0],color);assert.equal(new Set(values).size,4);}
});
test('legacy save compatibility, untrusted hotseat metadata and stale history limits',()=>{
 const g=createPracticeSession({seed:'hotseat-save',names:['a','b']}),s=save(g);
 const legacy={...s,view:{zoom:1,focus:false,boardZooms:{}}};assert.deepEqual(parseSavedGame(serializeSavedGame(legacy)),legacy);
 for(const invalid of [{...s,view:{...s.view,hotseat:'yes'}},{...s,view:{...s.view,computerPlayerIds:['seat-1']}},{...legacy,undo:'{}'},{...s,undo:'x'.repeat(4_000_001)}])assert.throws(()=>parseSavedGame(JSON.stringify(invalid)));
 assert.throws(()=>parseSavedGame(' '.repeat(2_000_001)+JSON.stringify(legacy)));
 const padded=JSON.stringify({...s,undo:' '.repeat(2_000_010)});assert.ok(parseSavedGame(padded).undo);
 assert.throws(()=>parseSavedGame(' '.repeat(6_000_001)));
 const h=beginHistory(g,[]);assert.deepEqual(restoreTurnHistory('{',g,[]),h);
 assert.deepEqual(restoreTurnHistory(serializeTurnHistory(g,[],h),{...g,revision:g.revision+1},[]),beginHistory({...g,revision:g.revision+1},[]));
 assert.equal(readActionLog(JSON.stringify({format:'action-log-v1',text:'a',dice:[],playerColor:'bad'})).playerColor,undefined);
});
