import assert from 'node:assert/strict';
import test from 'node:test';
import {boardChoice,startVineDiscard} from '../../src/game/board-choice';
import {applyCoreAction} from '../../src/game/core';
import {parseSavedGame,serializeSavedGame} from '../../src/game/save';
import {choiceOptions,fullVineStorageFixture,shieldPlacementFixture} from '../fixtures/board-choices';
import {mount,setup,startPhase,step} from '../fixtures/shields';

for(const shield of [14,15] as const)test(`shield ${shield} maps only legal source and destination pairs until placement`,()=>{
 const game=shieldPlacementFixture(shield),options=choiceOptions(game),initial=boardChoice(options,null,game.revision);
 const supply=shield===14?game.market.numberedDepots.flatMap(d=>d.slots.map(s=>s.tileId)):game.market.blackDepot;
 assert.ok(initial.phaseTiles.length>0);
 assert.ok(initial.phaseTiles.every(t=>supply.includes(t.tileId)&&t.source===(shield===14?'numbered':'black')));
 const pair=initial.phaseTiles[0],draft={kind:'phase-tile' as const,revision:game.revision,tileId:pair.tileId};
 const selected=boardChoice(options,draft,game.revision);
 assert.equal(selected.shieldGuidance,'배치할 곳을 선택하세요.');
 assert.ok(selected.placements.every(t=>t.tileId===pair.tileId));
 assert.equal(boardChoice(options,draft,game.revision+1).selected,null);
 assert.equal(game.players[0].duchy.cells.find(c=>c.id===pair.cellId)?.tileId,null);
 const after=step(game,pair.action);
 assert.equal(after.players[0].duchy.cells.find(c=>c.id===pair.cellId)?.tileId,pair.tileId);
});

test('both phase shields remain available in the player’s chosen order',()=>{
 const game=startPhase(mount(mount(setup(),14),15));
 const choice=boardChoice(choiceOptions(game),null,game.revision);
 assert.deepEqual([...new Set(choice.phaseTiles.map(t=>t.source))].sort(),['black','numbered']);
 const black=choice.phaseTiles.find(t=>t.source==='black'&&game.tiles[t.tileId].type==='mine')??choice.phaseTiles.find(t=>t.source==='black')!;
 assert.equal(step(game,black.action).turn.phase,game.turn.phase);
});

for(const paid of [false,true])test(`vineyard ${paid?'shop':'die'} waits for a legal set of selected tiles`,()=>{
 const game=fullVineStorageFixture(),options=choiceOptions(game),original=structuredClone(game);
 const source=options.find(({action,target})=>(paid?action.type==='extension':action.type==='use-die')&&startVineDiscard(action,target,game.revision))!;
 const draft=startVineDiscard(source.action,source.target,game.revision)!;
 const [keep,first,second]=game.players[0].storage as string[];
 const c=boardChoice(options,draft,game.revision);
 assert.deepEqual(c.discardable,new Set([keep,first,second]));
 assert.equal(c.vineAction,undefined);
 const firstDraft=c.discard(first)!;
 assert.equal(boardChoice(options,firstDraft,game.revision).vineAction,undefined);
 const next=boardChoice(options,firstDraft,game.revision).discard(second)!;
 const saved=parseSavedGame(serializeSavedGame({format:'burgundy-local-v1',randomAlgorithm:'counter-v1',game,logs:[],view:{zoom:1,focus:false,table:true,boardZooms:{},boardChoice:next}}));
 assert.deepEqual(saved.game,original);
 assert.deepEqual(saved.view.boardChoice,next);
 const chosen=boardChoice(options,saved.view.boardChoice??null,game.revision).vineAction!;
 const after=step(game,chosen);
 assert.equal(after.players[0].storage.filter(Boolean)[0],keep);
 assert.equal(after.players[0].vineyardReserve?.length,1);
 assert.equal(after.players[0].silver,game.players[0].silver-(paid?2:0));
 assert.deepEqual(game,original);
 const invalid=chosen.type==='use-die'&&chosen.intent.kind==='vineyard'?{...chosen,intent:{...chosen.intent,discardIds:[first,second,keep]}}:
  chosen.type==='extension'?{...chosen,payload:{...(chosen.payload as object),discardIds:[first,second,keep]}}:chosen;
 assert.equal(applyCoreAction(game,invalid).ok,false);
});

test('a vine occupying two keys is a single discard choice',()=>{
 const game=fullVineStorageFixture(true),options=choiceOptions(game);
 const source=options.find(({action,target})=>action.type==='use-die'&&startVineDiscard(action,target,game.revision))!;
 const choice=boardChoice(options,startVineDiscard(source.action,source.target,game.revision),game.revision);
 const id=game.players[0].vineyardReserve![0].tileId;
 assert.deepEqual(choice.discardable,new Set([id]));
 assert.equal(choice.vineAction,undefined);
 const chosen=boardChoice(options,choice.discard(id),game.revision).vineAction!;
 const after=step(game,chosen);
 assert.ok(after.players[0].storage.includes(game.players[0].storage[2]));
 assert.equal(after.players[0].vineyardReserve?.length,1);
});
