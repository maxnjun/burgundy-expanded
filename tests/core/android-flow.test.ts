import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BOARD_ZOOM_STEPS,nextBoardZoom,readBoardDisplay,fitBoardZooms} from '../../src/app/board-display';
import {createPracticeSession} from '../../src/game/practice';
import {applyCoreAction} from '../../src/game/core';
import {startingCastleCells,validStartingCastlePreview} from '../../src/game/starting-castles';
import {parseSavedGame,serializeSavedGame,type SavedGame} from '../../src/game/save';
test('board zoom buttons cover all requested values and fit preserves widths without hiding content',()=>{
 let z:number=.25;const values=[z];while(z<2){z=nextBoardZoom(z,1);values.push(z);}assert.deepEqual(values,BOARD_ZOOM_STEPS);
 for(let i=values.length-1;i>0;i--)assert.equal(nextBoardZoom(values[i],-1),values[i-1]);
 for(const width of [560,640,822,1200]){const f=fitBoardZooms(width,940,360,18,12,false);assert.ok(940*f.commonZoom+360*f.supplyZoom+30<=width+.001);assert.equal(f.commonZoom,f.supplyZoom);}
 const vertical=fitBoardZooms(600,940,360,18,12,true);assert.ok(vertical.commonZoom<1);assert.equal(vertical.supplyZoom,1);
 for(const text of ['', '{', 'null',JSON.stringify({commonZoom:.1,supplyZoom:1,fit:true}),JSON.stringify({commonZoom:1,supplyZoom:Infinity,fit:false})])assert.deepEqual(readBoardDisplay(text,.75),{commonZoom:.75,supplyZoom:1,fit:false});
 assert.deepEqual(readBoardDisplay(JSON.stringify({commonZoom:.35,supplyZoom:.5,fit:true})),{commonZoom:.35,supplyZoom:.5,fit:true});
});
for(const count of [2,3,4])test(`hotseat ${count} starting preview is save-only metadata, validates identity and commits once`,()=>{
 let game=createPracticeSession({names:Array.from({length:count},(_,i)=>`선택${i+1}`),seed:`preview-${count}`,boardIds:Array(count).fill('se:base:2'),chooseStartingCastles:true,fullEffects:true,officialSlots:true,vineyards:true});
 for(let seat=0;seat<count;seat++){
  const playerId=game.turn.activePlayerId!,cells=startingCastleCells(game,playerId),before=structuredClone(game);assert.ok(cells.length>1);
  const preview={playerId,cellId:cells[0]},save:SavedGame={format:'burgundy-local-v1',randomAlgorithm:'counter-v1',game,logs:[],view:{hotseat:true,zoom:1,focus:false,commonZoom:.25,boardZooms:{},startingPreview:preview}};
  const read=parseSavedGame(serializeSavedGame(save));assert.deepEqual(read.game,before);assert.deepEqual(read.view.startingPreview,preview);
  assert.ok(validStartingCastlePreview(game,{playerId,cellId:cells[1]}));assert.ok(!validStartingCastlePreview(game,{playerId:'not-owner',cellId:cells[0]}));
  assert.throws(()=>parseSavedGame(JSON.stringify({...save,view:{...save.view,startingPreview:{playerId,cellId:'not-a-cell'}}})));
  assert.throws(()=>parseSavedGame(JSON.stringify({...save,view:{...save.view,hotseat:false}})));
  const action={type:'place-starting-castle' as const,playerId,cellId:cells[1]},result=applyCoreAction(game,action);assert.ok(result.ok);game=result.value.state;
  assert.equal(applyCoreAction(game,action).ok,false);assert.equal(game.players.find(p=>p.id===playerId)!.duchy.startingCastleCellId,cells[1]);
  assert.throws(()=>parseSavedGame(JSON.stringify({...save,game})));
 }
 assert.equal(game.status,'playing');assert.equal(game.turn.stage,'round-setup');
});
