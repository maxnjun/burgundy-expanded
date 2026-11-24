import assert from 'node:assert/strict';
import test from 'node:test';
import {applyCoreAction,listCoreActionOptions,validateCoreAction} from '../../src/game/core';
import {finalScore} from '../../src/game/core/phases';
import {previewRecolor,type RecolorTarget} from '../../src/game/core/territory';
import {boardTarget} from '../../src/game/direct-actions';
import {createActionLog,readActionLog} from '../../src/game/action-log';
import {discardStored} from '../../src/game/vineyards';
import {diceShieldStatus,hasShield,setShieldLayout,shieldLayout,SHIELD_POINTS} from '../../src/game/shields';
import {orderedPlayers} from '../../src/game/core/state';
import {settleShieldState} from '../../src/game/core/shield-effects';
import {prepareShipChoice} from '../../src/game/core/ship';
import {chooseComputerAction} from '../../src/game/computer';
import {boundary,choose,finishDiceRound,placed,roundtrip,step} from '../fixtures/shields';
import {customGame,customMount,moveTile,officialTerritory,special} from '../fixtures/custom-rules';
import type {GameState,DieValue} from '../../src/game/types';

function options(game:GameState,pid='seat-1'){
 const list=listCoreActionOptions(game,pid);assert.ok(list.ok,JSON.stringify(list));return list.value.actions;
}
function advance(game:GameState){
 let n=step(boundary(game),{type:'advance-phase',playerId:'seat-1'});
 while(n.turn.pendingChoice)n=choose(n,o=>o.id.startsWith('pay:')&&o.id.endsWith(':silver'));
 return n.turn.stage==='phase-end'?step(n,{type:'advance-phase',playerId:'seat-1'}):n;
}

test('31 returns exactly historical entries, protects color points, saves and re-scores at B completion',()=>{
 const {game,a,target,region}=officialTerritory();
 const before=roundtrip(game);
 assert.equal(boardTarget(game,a).recolor?.refund,13);
 const after=step(game,a),p=after.players[0];
 assert.equal(p.victoryPoints,5);assert.equal(p.duchy.completedRegionIds.includes(region.id),false);
 assert.deepEqual(after.scoreLedger[p.id].filter(e=>e.reversalOf).map(e=>e.points),[-3,-10]);
 assert.equal(after.scoreLedger[p.id].find(e=>e.id==='old:color')?.points,5);
 assert.match(readActionLog(createActionLog(game,after,a)).text,/13점 반납/);
 assert.deepEqual(roundtrip(after),after);
 assert.deepEqual(before,game);
 assert.equal(applyCoreAction(after,a).ok,false);
 let b=step(advance(after),{type:'roll-round',playerId:p.id});
 const stored=moveTile(b,t=>t.type===region.terrain);b=stored.game;
 const action=options(b).find(x=>x.type==='use-die'&&x.intent.kind==='place-tile'&&x.intent.cellId===target.id&&x.intent.tileId===stored.tileId)!;
 const complete=step(b,action),entries=complete.scoreLedger[p.id].slice(-3).filter(e=>e.regionId===complete.players[0].duchy.cells.find(c=>c.id===target.id)?.regionId);
 assert.ok(entries.some(e=>e.category==='region-size'&&e.points===6));
 assert.ok(entries.some(e=>e.category==='phase-bonus'&&e.points===8));
 assert.equal(complete.players[0].duchy.completedRegionIds.filter(id=>id.startsWith('monastery31:')).length,1);
 assert.equal(applyCoreAction(complete,action).ok,false);
});

test('31 merges two scored regions and uses the paid amounts independently of current shield and inn size',()=>{
 let game=customMount(customGame(2,true,false,true),17);
 const player=game.players[0];
 const cell=(q:number,terrain:RecolorTarget['terrain'],regionId:string,tileId:string|null=null)=>({id:String(q),coord:{q,r:0},number:1 as const,terrain,regionId,tileId});
 game={...game,players:game.players.map((p,i)=>i?p:{...p,victoryPoints:29,duchy:{...p.duchy,startingCastleCellId:'0',completedColors:['mine'],completedRegionIds:['castle','a','b'],cells:[
  cell(-1,'monastery','monk'),cell(0,'castle','castle',player.duchy.cells.find(c=>c.id===player.duchy.startingCastleCellId)!.tileId),
  cell(1,'mine','a'),cell(2,'ship','gap'),cell(3,'mine','b'),
 ]}}),config:{...game.config,players:game.config.players.map((p,i)=>i?p:{...p,startingCastleCellId:'0'})},
 scoreLedger:{...game.scoreLedger,'seat-1':(['a','b'] as const).flatMap((id,i)=>[
  {id:id+'-size',category:'region-size' as const,points:i?6:3,regionId:id,source:{document:'project-user-rule' as const,pages:[],section:'fixture'}},
  {id:id+'-phase',category:'phase-bonus' as const,points:10,regionId:id,source:{document:'project-user-rule' as const,pages:[],section:'fixture'}},
 ])}};
 const layout=shieldLayout(game)!;
 game={...game,extensionStates:{...game.extensionStates,shields:{...layout,mounted:layout.mounted.map(m=>({...m,cellId:'0'}))} as unknown as GameState['extensionStates']['shields']}};
 game=moveTile(game,t=>t.type==='monastery'&&t.number===31,'-1').game;
 game=moveTile(game,t=>t.type==='inn','1').game;
 game=moveTile(game,t=>t.type==='mine','3').game;
 const action=special('recolor',{cellId:'2',terrain:'mine'},'additional-hexes');
 const after=step(game,action);
 assert.equal(after.players[0].victoryPoints,0);
 assert.equal(after.players[0].duchy.cells.filter(c=>c.regionId==='monastery31:1').length,3);
 const stored=moveTile(after,t=>t.type==='mine');
 const place=options(stored.game).find(a=>a.type==='use-die'&&a.intent.kind==='place-tile'&&a.intent.cellId==='2')!;
 const final=step(stored.game,place);
 assert.equal(final.players[0].victoryPoints,25);
 assert.deepEqual(final.scoreLedger['seat-1'].slice(-2).map(e=>e.points),[15,10]);
});

test('31 splits one incomplete source into new scoring regions without refunding unrelated awards',()=>{
 const {game}=officialTerritory();
 const target=game.players[0].duchy.cells.find(c=>!c.tileId);
 assert.ok(target);
 const actor=game.players[0],original=actor.duchy.cells.find(c=>c.id===actor.duchy.startingCastleCellId)!;
 const cells=[{...original,coord:{q:0,r:0},regionId:'s'},...[1,2,3].map(q=>({...target,id:String(q),terrain:'mine' as const,coord:{q,r:0},regionId:'m',tileId:null})),
  {...target,id:'monk',coord:{q:-1,r:0},regionId:'monk',terrain:'monastery' as const,tileId:actor.duchy.cells.find(c=>c.tileId==='custom:monastery:31')!.tileId}];
 const base={...game,players:game.players.map((p,i)=>i?p:{...p,duchy:{...p.duchy,cells,completedRegionIds:['s']}})};
 const orphaned=actor.duchy.cells.flatMap(c=>c.tileId&&!cells.some(k=>k.tileId===c.tileId)?[c.tileId]:[]);
 let n={...base,market:{...base.market,removedTileIds:[...base.market.removedTileIds,...orphaned]}};
 n=moveTile(n,t=>t.type==='mine','1').game as typeof n;
 n=moveTile(n,t=>t.type==='mine','3').game as typeof n;
 const t={cellId:'2',terrain:'building' as const};
 assert.equal(previewRecolor(n,n.players[0],t).points,0);
 const changed=step(n,special('recolor',t,'additional-hexes'));
 assert.deepEqual(changed.players[0].duchy.completedRegionIds,['s','monastery31:1','monastery31:3']);
 assert.equal(changed.players[0].victoryPoints,45);
 assert.equal(changed.scoreLedger['seat-1'].filter(e=>e.id.startsWith('recolor:')&&e.category==='color-bonus').length,1);
});

test('31 refund remains at final scoring when the expanded region is incomplete',()=>{
 const {game,a}=officialTerritory();
 let n=step(game,a);
 for(let i=0;i<5;i++)n=advance(n);
 assert.equal(n.status,'finished');
 assert.equal(n.finalScores?.[0].earnedTotal,5);
 assert.deepEqual(roundtrip(n),n);
});

for(const [count,expected] of [[2,[6,7,8,9,10]],[3,[9,10,11,12,12]],[4,[12,12,12,12,12]]] as const)test(`custom ${count} players draw unique shields into new slots each phase`,()=>{
 let n=customGame(count);
 for(const size of expected){const layout=shieldLayout(n)!;
  assert.equal(layout.slots.length,size);assert.ok(layout.slots.every(s=>s.index<2));assert.equal(layout.boxed.length,24-size);
  assert.deepEqual(roundtrip(n),n);
  const next=advance(n);assert.deepEqual(advance(n),next);n=next;
 }
 assert.equal(n.status,'finished');assert.equal(shieldLayout(n)?.slots.length,expected.at(-1));
});

test('paid rival transfer pays the owner, prints one shared opportunity and 24 lifts it',()=>{
 let game=customMount(customGame(),21);
 game=moveTile(game,t=>t.type==='ship',undefined,1).game;
 game=moveTile(game,t=>t.type==='mine',undefined,1,1).game;
 const first=options(game).find(a=>a.type==='extension'&&a.command==='buy-rival-tile')!;
 const once=step(game,first);
 assert.equal(once.players[1].silver,32);assert.equal(once.players[0].silver,28);
 assert.equal(options(once).some(a=>a.type==='buy-black-tile'||a.type==='extension'&&a.command==='buy-rival-tile'),false);
 let unlimited=customMount(game,24);
 unlimited=step(unlimited,first);
 unlimited=step(unlimited,options(unlimited).find(a=>a.type==='extension'&&a.command==='buy-rival-tile')!);
 assert.equal(unlimited.players[1].silver,34);
 assert.ok(options(unlimited).some(a=>a.type==='buy-black-tile'));
});

test('shield20 protects supply across owners and consumes its phase use even after cancellation',()=>{
 let game=customMount(customGame(),20);
 const id=game.market.blackDepot[0]!,other='seat-2';
 game=step(game,special('reserve-tile',{tileId:id}));
 const rotated={...game,turn:{...game.turn,activePlayerId:other}};
 assert.equal(applyCoreAction(rotated,{type:'buy-black-tile',tileId:id,storageSlot:0,playerId:other}).ok,false);
 game=step(game,special('cancel-reservation'));
 assert.equal(applyCoreAction(game,special('reserve-tile',{tileId:id})).ok,false);
 assert.deepEqual(roundtrip(game),game);
 assert.equal(advance(game).tileReservations,undefined);
});

test('22 rolls next round, 16 changes the third die and shield acquisition spends only the selected pair',()=>{
 let game=customMount(customMount(customGame(),22),16);
 assert.equal(game.dice.players['seat-1'].length,2);
 const next={...game,dice:{...game.dice,whiteDie:null,rolledForRound:false,roundGoodsDistributed:false},turn:{...game.turn,activePlayerId:null,stage:'round-setup' as const},
  market:{...game.market,roundGoods:[game.market.numberedDepots.flatMap(d=>d.goods)[0],...game.market.roundGoods],numberedDepots:game.market.numberedDepots.map(d=>({...d,goods:[]}))}};
 game=step(next,{type:'roll-round',playerId:'seat-1'});
 const dice=game.dice.players['seat-1'];assert.equal(dice.length,3);
 game=step(game,special('change-die',{dieId:dice[2]!.id,value:dice[2]!.value===1?2:1}));
 const a=options(game).find(a=>a.type==='extension'&&a.command==='acquire'&&(a.payload as {dieIds?:string[]}).dieIds?.join(',')===[dice[0].id,dice[2]!.id].join(','))!;
 const acquired=step(game,a);
 assert.deepEqual(acquired.dice.players['seat-1'].map(d=>d.used),[true,false,true]);
 assert.equal(validateCoreAction(acquired,{type:'end-turn',playerId:'seat-1'}).valid,false);
});

test('shield 22 starts after acquisition and alternates independently of shield 16 across phases',()=>{
 const roll=(game:GameState)=>step(game,{type:'roll-round',playerId:orderedPlayers(game)[0]});
 const status=(game:GameState,number:number)=>diceShieldStatus(shieldLayout(game),game.turn,game.dice,'seat-1',number);
 let game=placed(customMount(customGame(3),16),0,{type:'castle',back:'matching-color'});
 for(let i=0;i<3;i++)game=roll(finishDiceRound(game));
 const layout=shieldLayout(game)!;
 const slot=layout.slots.find(s=>s.shieldNumber===22)??layout.slots.find(s=>s.shieldNumber!==null)!;
 if(slot.shieldNumber!==22)game=setShieldLayout(game,{...layout,slots:layout.slots.map(s=>s.id===slot.id?{...s,shieldNumber:22}:s),boxed:layout.boxed.map(n=>n===22?slot.shieldNumber!:n)});
 const acquire=options(game).find(a=>{
  if(a.type!=='extension'||a.command!=='acquire')return false;
  const {slotId,replaceShieldNumber}=a.payload as {slotId:string;replaceShieldNumber:number|null};
  return slotId===slot.id&&replaceShieldNumber===null;
 });
 assert.ok(acquire);
 game=roundtrip(step(game,acquire));
 assert.equal(status(game,22),'pending');
 assert.equal(game.dice.players['seat-1'].length,2);
 game=roll(finishDiceRound(game));
 assert.deepEqual([game.turn.phase,game.turn.round,status(game,22)],['A',5,'ready']);
 assert.deepEqual(game.players.map(p=>game.dice.players[p.id].length),[3,2,2]);
 const die=game.dice.players['seat-1'][2]!;
 const change=special('change-die',{dieId:die.id,value:die.value===1?2:1});
 game=roundtrip(step(game,change));
 assert.equal(status(game,16),'used');
 const end=finishDiceRound(game);
 assert.equal(end.turn.stage,'phase-end');
 game=roll(advance(end));
 assert.deepEqual([game.turn.phase,game.turn.round,status(game,16),status(game,22)],['B',1,'cooldown','cooldown']);
 assert.equal(game.dice.players['seat-1'].length,2);
 assert.equal(applyCoreAction(game,special('change-die',{dieId:game.dice.players['seat-1'][0].id,value:6})).ok,false);
 assert.ok(!options(game).some(a=>a.type==='extension'&&a.command==='change-die'));
 assert.ok(game.turn.activePlayerId==='seat-1');
 const ai=chooseComputerAction(game,'seat-1');
 assert.ok(ai.ok&&!(ai.value.type==='extension'&&ai.value.command==='change-die'));
 game=roll(finishDiceRound(roundtrip(game)));
 assert.deepEqual([status(game,16),game.dice.players['seat-1'].length],['ready',3]);
 game=roll(finishDiceRound(game));
 assert.deepEqual([status(game,16),game.dice.players['seat-1'].length],['ready',2]);
});

test('legacy shield 22 saves keep previously rolled dice and anchor the next roll',()=>{
 const roll=(game:GameState)=>step(game,{type:'roll-round',playerId:orderedPlayers(game)[0]});
 let game=roll(finishDiceRound(customMount(customGame(),22)));
 assert.equal(game.dice.players['seat-1'].length,3);
 const layout=shieldLayout(game)!;
 game=roundtrip(setShieldLayout(game,{...layout,rules:{...layout.rules!,extraDieSchedule:undefined}}));
 assert.equal(game.dice.players['seat-1'].length,3);
 game=roll(finishDiceRound(game));
 assert.equal(game.dice.players['seat-1'].length,2);
 assert.deepEqual(shieldLayout(game)!.rules!.extraDieSchedule,{playerId:'seat-1',firstRound:2});
 assert.equal(roll(finishDiceRound(roundtrip(game))).dice.players['seat-1'].length,3);
});

test('19 and 30 stack, 32 gives a fourth key, and shield 13 doubles each explicit new value',()=>{
 let n=customMount(customMount(customGame(2,true,true),19),13);
 for(const number of [30,32]){const cellId=n.players[0].duchy.cells.find(c=>c.terrain==='monastery'&&!c.tileId)!.id;n=settleShieldState(moveTile(n,t=>t.type==='monastery'&&t.number===number,cellId).game);}
 assert.equal(n.players[0].storage.length,4);
 const storage=moveTile(n,t=>t.type==='mine');n=storage.game;
 const p=n.players[0];const discarded=discardStored(n,p.id,[storage.tileId,storage.tileId]);
 assert.deepEqual([discarded.players[0].silver-p.silver,discarded.players[0].workers-p.workers],[1,2]);
 const final=finalScore(discarded,discarded.players[0]);assert.ok(final.ok);
 assert.equal(final.value.finalAdditions.find(e=>e.id.endsWith('shield-19'))?.points,SHIELD_POINTS[18]*2);
 assert.equal(hasShield(n,p.id,13),true);
});

test('23 accepts six goods types and losing it requires one choice per excess stack',()=>{
 let n=customMount(customGame(),23);
 const depotGoods=([1,2,3,4,5,6] as const).map(type=>({type,id:`test-good:${type}`}));
 n={...n,market:{...n.market,numberedDepots:n.market.numberedDepots.map((d,i)=>i?d:{...d,goods:depotGoods})}};
 const placed=moveTile(n,t=>t.type==='ship',n.players[0].duchy.cells.find(c=>c.terrain==='ship')!.id);
 n=placed.game;
 const owned=shieldLayout(n)!.mounted.find(m=>m.shieldNumber===23)!;
 const shipped=prepareShipChoice(n,'seat-1',placed.tileId);
 n=choose(shipped,o=>o.id.startsWith('depot:1:'));
 const types=new Set(n.players[0].goods.map(g=>g.type));
 assert.deepEqual(types,new Set<DieValue>([1,2,3,4,5,6]));
 const replace=options(n).find(a=>a.type==='extension'&&a.command==='acquire'&&(a.payload as {replaceShieldNumber?:number}).replaceShieldNumber===23)!;
 n=step(n,replace);
 assert.equal(shieldLayout(n)!.slots.find(s=>s.id===owned.sourceSlotId)?.shieldNumber,23);
 for(const type of [1,4,5])n=choose(n,o=>o.id===`discard-goods:${type}`);
 assert.deepEqual(new Set(n.players[0].goods.map(g=>g.type)),new Set<DieValue>([2,3,6]));
 assert.equal(n.turn.pendingChoice,null);
});

test('shield 6 shares monastery 31 per player and the owning seat retains its own use',()=>{
 let g=customMount(customGame(),6);
 const cellId=g.players[1].duchy.cells.find(c=>c.terrain==='monastery')!.id;
 g=moveTile(g,t=>t.type==='monastery'&&t.number===31,cellId,1).game;
 assert.equal(options(g).some(a=>a.type==='extension'&&a.command==='recolor'),false);
 g=step(g,special('choose-monastery-target',{targetPlayerId:'seat-2'}));
 const option=options(g).find(a=>a.type==='extension'&&a.command==='recolor')!;
 g=step(g,option);
 assert.equal(applyCoreAction(g,option).ok,false);
 for(const die of g.dice.players['seat-1'])g=step(g,{type:'use-die',playerId:'seat-1',dieId:die.id,adjustment:{steps:[],workersSpent:0},intent:{kind:'take-workers'}});
 g=step(g,{type:'end-turn',playerId:'seat-1'});
 const own=options(g,'seat-2').find(a=>a.type==='extension'&&a.command==='recolor')!;
 assert.ok(step(g,own).players.every(p=>!!p.duchy.recoloredCell));
});

test('loss of unlimited storage falls back to four keys with monastery 32',()=>{
 let g=customMount(customGame(),4);
 const monk=g.players[0].duchy.cells.find(c=>c.terrain==='monastery')!.id;
 g=settleShieldState(moveTile(g,t=>t.type==='monastery'&&t.number===32,monk).game);
 for(let i=0;i<5;i++)g=settleShieldState(moveTile(g,t=>t.type==='mine',undefined,0,i).game);
 const swap=options(g).find(a=>a.type==='extension'&&a.command==='acquire'&&(a.payload as {replaceShieldNumber?:number}).replaceShieldNumber===4)!;
 const excess=step(g,swap);
 assert.ok(excess.turn.pendingChoice?.id.includes('shield-storage'));
 assert.ok(chooseComputerAction(excess).ok);
 const result=choose(excess,o=>o.id.startsWith('discard:'));
 assert.equal(result.players[0].storage.length,4);
 assert.equal(result.players[0].storage.filter(Boolean).length,4);
});
