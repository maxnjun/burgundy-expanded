import {test} from 'node:test';
import assert from 'node:assert/strict';
import {actionGuidance,canPurchaseTile,canEndTurn} from '../../src/game/action-guidance';
import {directActions} from '../../src/game/direct-actions';
import {beginHistory,recordTurnAction,undoTurn} from '../../src/game/turn-history';
import {serializeTurnHistory,restoreTurnHistory} from '../../src/game/turn-history-cache';
import {prepareTileEffect} from '../../src/game/core/effects';
import {setup,step,placed,stash} from '../fixtures/shields';
import {whiteFixture,placeWhite} from '../fixtures/white-castles';
import type {BuildingType,GameState,JsonValue} from '../../src/game/types';
const work=(g:GameState)=>directActions(g,'seat-1').find(a=>a.type==='use-die'&&a.intent.kind==='take-workers')!;

for(const count of [2,3,4])test(`first player ${count}p: exact cached turn/action undo, stale and damaged caches rejected`,()=>{
 const g=setup(count),a=work(g),one=step(g,a),h=recordTurnAction(beginHistory(g,[],true),g,one,a,[],['one']);
 const text=serializeTurnHistory(one,['one'],h),restored=restoreTurnHistory(text,one,['one']);
 assert.deepEqual(undoTurn(restored,one,'turn')!.snapshot.game,g);assert.deepEqual(undoTurn(restored,one,'action')!.snapshot.game,g);
 assert.equal(restoreTurnHistory(text,one,[]).start,null);
 assert.equal(restoreTurnHistory(text,step(one,work(one)),['one']).start,null);
 for(const corrupt of ['{',JSON.stringify({...JSON.parse(text),history:{...h,start:{game:{},logs:[]}}}),JSON.stringify({...JSON.parse(text),history:{...h,key:'different'}}),JSON.stringify({...JSON.parse(text),history:{...h,past:[h.past[0],h.past[0]]}})])assert.equal(restoreTurnHistory(corrupt,one,['one']).start,null);
 const unknown=recordTurnAction(beginHistory(g,[]),g,one,a,[],[]);assert.equal(restoreTurnHistory(serializeTurnHistory(one,[],unknown),one,[]).start,null);
 const two=step(one,work(one)),end={type:'end-turn' as const,playerId:'seat-1'},next=step(two,end);
 assert.equal(undoTurn(restoreTurnHistory(text,next,['one']),next,'turn'),null);
 const nextHistory=recordTurnAction(h,two,next,end,[],[]);assert.equal(undoTurn(nextHistory,next,'turn'),null);assert.equal(nextHistory.key?.includes('seat-2'),true);
});

test('guidance follows legal actions, purchase availability, UI selection and completed dice',()=>{
 const g=setup();assert.equal(actionGuidance(g,directActions(g,'seat-1')),'주사위를 선택하세요.');
 const stashed=stash(g,{type:'mine',back:'matching-color'});assert.equal(actionGuidance(stashed.g,[],{tileId:stashed.id}),'타일을 배치할 영지를 선택하세요.');
 assert.equal(actionGuidance(g,[],{tileId:'supply'}),'교체할 저장고 타일을 선택하세요.');assert.match(actionGuidance(g,[],{shieldNumber:8}),/장착할 성/);assert.match(actionGuidance(g,[],{special:true}),/선택을 취소/);
 const monastery={type:'monastery' as const,number:6 as const,back:'matching-color' as const},monk=placed(g,0,monastery);assert.match(actionGuidance(monk,directActions(monk,'seat-1'),{special:true}),/가져올 건물/);
 const two=step(step(g,work(g)),work(step(g,work(g))));const actions=directActions(two,'seat-1');assert.equal(canEndTurn(actions),true);assert.equal(canPurchaseTile(actions),true);assert.equal(actionGuidance(two,actions),'턴을 종료하시겠습니까? (구매 가능)');
 const poor={...two,players:two.players.map(p=>({...p,silver:1}))};assert.equal(actionGuidance(poor,directActions(poor,'seat-1')),'턴을 종료하시겠습니까?');
 const bought=step(two,actions.find(a=>a.type==='buy-black-tile')!);assert.equal(canPurchaseTile(directActions(bought,'seat-1')),false);assert.equal(actionGuidance(bought,directActions(bought,'seat-1')),'턴을 종료하시겠습니까?');
 assert.match(actionGuidance(g,[],{replacement:true}),/교체/);assert.match(actionGuidance(g,[],{vineTileId:'vine'}),/포도밭 자리/);assert.match(actionGuidance(g,[],{computer:'playing'}),/진행/);assert.match(actionGuidance(g,[],{computer:'paused'}),/일시정지/);
 assert.match(actionGuidance(g,directActions(g,'seat-1'),{dieId:g.dice.players['seat-1'][0].id}),/행동 대상/);
});

test('all selectable tile benefits override end guidance; white castle and contextual rewards stay specific',()=>{
 const messages:Partial<Record<BuildingType|string,RegExp>>={castle:/추가 행동 또는 주사위/,market:/선박 또는 동물/,'carpenters-workshop':/건물 타일/,church:/성·광산·수도원/,warehouse:/판매할 상품/,'town-hall':/추가로 배치/,crane:/복사할 건물/,ship:/공용보드에서 상품 보관함/};
 for(const [kind,message] of Object.entries(messages)){
  const tile=kind==='castle'||kind==='ship'?{type:kind as 'castle'|'ship',back:'matching-color' as const}:{type:'building' as const,building:kind as BuildingType,back:'matching-color' as const};
  const g=placed(setup(),0,tile),id=Object.keys(g.tiles).find(k=>k.startsWith('shield-fixture:'))!,pending=prepareTileEffect(g,'seat-1',id);
  assert.match(actionGuidance(pending,directActions(pending,'seat-1')),message!);
 }
 const white=placeWhite(whiteFixture());assert.match(actionGuidance(white,directActions(white,'p1')),/흰 주사위/);
 const base=white.turn.pendingEffects[0];
 for(const [payload,pattern] of [[{vineChoice:'order'},/먼저 처리/],[{vineChoice:'token'},/보너스 토큰/],[{vineChoice:'black-get'},/무료로 가져올/],[{vineChoice:'vine-get'},/포도 타일/],[{kind:'ship',primary:1},/인접 공급처/],[{kind:'shield-five'},/추가로 가져올 상품/],[{kind:'shield-storage'},/초과 보관/],[{kind:'warehouse',tradeSlotId:'trade'},/무역로 보상 · 판매/],[{kind:'church',vineRewardId:'vine'},/포도밭 보너스 · 가져올/]] as const){
  const pending={...white,turn:{...white.turn,pendingEffects:[{...base,payload:payload as JsonValue}]}};assert.match(actionGuidance(pending,[]),pattern);
 }
});
