import {test} from "node:test";
import assert from "node:assert/strict";
import {CUSTOM_TRADE_CATALOG,TRADE_REWARD_NAMES,customTradeSpaces,type TradeReward} from "../../src/game/custom-trade-routes";
import {createPracticeSession} from "../../src/game/practice";
import {applyCoreAction,validateCoreAction,validateCoreState} from "../../src/game/core";
import {parseSavedGame,serializeSavedGame} from "../../src/game/save";
import {chooseComputerAction} from "../../src/game/computer";
import {goodsSaleReward} from "../../src/game/core/intents";
import {tradeFixture,directSale,tradeStep} from "../fixtures/custom-trade";
import type {GameState} from "../../src/game/types";
import {createShieldLayout,setShieldLayout} from "../../src/game/shields";
import {mount,placed} from "../fixtures/shields";
const roundtrip=(game:GameState)=>parseSavedGame(serializeSavedGame({format:"burgundy-local-v1",randomAlgorithm:"counter-v1",game,logs:[],view:{zoom:1,focus:false,boardZooms:{}}})).game;

test("custom36 cells match the exact user table:6 per color,4 per reward,unique3-color cards",()=>{
 assert.equal(CUSTOM_TRADE_CATALOG.length,12);assert.deepEqual(CUSTOM_TRADE_CATALOG.map(t=>t.id),Array.from({length:12},(_,i)=>String(i+1)));
 const slots=CUSTOM_TRADE_CATALOG.flatMap(t=>t.spaces);assert.equal(slots.length,36);
 for(let n=1;n<=6;n++)assert.equal(slots.filter(s=>s.goodsType===n).length,6);
 for(const kind of Object.keys(TRADE_REWARD_NAMES))assert.equal(slots.filter(s=>s.bonusId===kind).length,4);
 for(const card of CUSTOM_TRADE_CATALOG){assert.equal(card.spaces.length,3);assert.equal(new Set(card.spaces.map(s=>s.goodsType)).size,3);}
 assert.deepEqual(CUSTOM_TRADE_CATALOG[0].spaces,[{goodsType:1,bonusId:"warehouse"},{goodsType:4,bonusId:"carpenters-workshop"},{goodsType:2,bonusId:"church"}]);
});
for(const count of [2,3,4]as const)test(`custom trade ${count} seats has deterministic unique allocation and unchanged legacy setup when disabled`,()=>{
 const config={names:Array.from({length:count},(_,i)=>`P${i}`),seed:"deal",tradeRoutes:true},a=createPracticeSession(config),b=createPracticeSession(config);
 assert.deepEqual(a,b);const all=[...a.tradeRoutes!.unusedTileIds,...Object.values(a.tradeRoutes!.routes).flatMap(r=>r.tileIds)];assert.equal(new Set(all).size,12);assert.equal(all.length,12);
 assert.ok(Object.values(a.tradeRoutes!.routes).every(r=>r.tileIds.length===(count===2?5:count===3?4:3)));assert.deepEqual(roundtrip(a),a);
 const old=createPracticeSession({...config,tradeRoutes:false});assert.equal(old.tradeRoutes,undefined);assert.deepEqual(roundtrip(old),old);
});
for(const kind of Object.keys(TRADE_REWARD_NAMES) as TradeReward[])test(`custom reward ${kind} uses a single direct sale and canonical effect resolution`,()=>{
 const before=tradeFixture(kind),player=before.players[0],type=before.dice.players['seat-1'][0].value,stack=player.goods.find(g=>g.type===type)!,normal=goodsSaleReward(before,player,stack.tiles.length),game=tradeStep(before,directSale(before)),route=game.tradeRoutes!.routes['seat-1'];
 assert.ok(stack.tiles.length>1);assert.equal(route.sales.length,1);assert.equal(route.sales[0].goodsIds.length,stack.tiles.length);assert.deepEqual(roundtrip(game),game);
 if(["bank","boarding-house","watchtower"].includes(kind)){
  assert.equal(route.sales[0].status,"resolved");assert.equal(game.players[0].silver-player.silver,normal.silver+(kind==="bank"?2:0));assert.equal(game.players[0].workers-player.workers,kind==="boarding-house"?4:0);assert.equal(game.players[0].victoryPoints-player.victoryPoints,normal.points+(kind==="watchtower"?4:0));
 }else{
  assert.equal(route.sales[0].status,"pending");assert.ok(game.turn.pendingChoice);assert.equal(validateCoreAction(game,{type:"end-turn",playerId:"seat-1"}).valid,false);
  const choice=game.turn.pendingChoice!,option=choice.options.find(o=>o.id!=="skip"&&((kind!=="white-castle")||(o.payload as {intent?:{kind?:string}})?.intent?.kind==="take-workers"));assert.ok(option,kind);
  const action={type:"resolve-choice" as const,playerId:"seat-1",choiceId:choice.id,optionId:option.id};const next=tradeStep(game,action);assert.equal(next.tradeRoutes!.routes['seat-1'].sales.length,1);assert.equal(next.tradeRoutes!.routes['seat-1'].sales[0].status,"resolved");assert.equal(validateCoreAction(next,action).valid,false);assert.deepEqual(roundtrip(next),next);
  if(kind==="white-castle"){assert.equal(next.players[0].workers-game.players[0].workers,2);assert.deepEqual(next.dice,game.dice);}
  if(kind==="warehouse")assert.equal(next.players[0].goods.length,0);
 }
 assert.equal(validateCoreAction(game,directSale(before)).valid,false);
});
test("mismatch advances one slot without rewards; all completed routes still allow ordinary sales",()=>{
 let g=tradeFixture("bank");const type=g.players[0].goods[1].type;g={...g,dice:{...g.dice,players:{...g.dice.players,'seat-1':[{...g.dice.players['seat-1'][0],value:type},g.dice.players['seat-1'][1]]}}};
 const next=tradeStep(g,directSale(g));assert.equal(next.tradeRoutes!.routes['seat-1'].sales[0].status,"mismatch");assert.equal(next.players[0].silver-g.players[0].silver,1);
 assert.throws(()=>roundtrip({...next,tradeRoutes:{...next.tradeRoutes!,routes:{...next.tradeRoutes!.routes,'seat-1':{...next.tradeRoutes!.routes['seat-1'],tileIds:['99',...next.tradeRoutes!.routes['seat-1'].tileIds.slice(1)]}}}}));
});
test("white reward can sell with worker adjustment but cannot recursively progress trade route",()=>{
 const before=tradeFixture('white-castle'),g=tradeStep(before,directSale(before)),choice=g.turn.pendingChoice!,option=choice.options.find(o=>(o.payload as {intent?:{kind?:string}})?.intent?.kind==='sell-goods');assert.ok(option);
 const next=tradeStep(g,{type:'resolve-choice',playerId:'seat-1',choiceId:choice.id,optionId:option.id});assert.equal(next.tradeRoutes!.routes['seat-1'].sales.length,1);assert.equal(next.players[0].goods.length,0);assert.deepEqual(next.dice,g.dice);
});
test("full route stops at capacity and still sells normally, without duplicate or skipped slots",()=>{
 let g=tradeFixture('bank');const capacity=customTradeSpaces(g.tradeRoutes!.routes['seat-1']).length;
 for(let i=0;i<=capacity;i++){
  const space=customTradeSpaces(g.tradeRoutes!.routes['seat-1'])[i],type=space?(space.goodsType===6?1:space.goodsType+1) as 1|2|3|4|5|6:1;
  const hand=g.players[0].goods.flatMap(s=>s.tiles),goods=hand.length?hand.map(t=>({...t,type})):[{id:`TEST-FULL-${i}`,type}];
  g={...g,players:g.players.map((p,j)=>j?p:{...p,goods:[{type,tiles:goods}]}),dice:{...g.dice,players:{...g.dice.players,'seat-1':[{...g.dice.players['seat-1'][0],value:type,used:false},g.dice.players['seat-1'][1]]}}};
  const old=g,after=tradeStep(g,directSale(g));assert.equal(after.tradeRoutes!.routes['seat-1'].sales.length,Math.min(i+1,capacity));assert.equal(after.players[0].silver-old.players[0].silver,1);g=after;
 }
 assert.deepEqual(roundtrip(g),g);
 const route=g.tradeRoutes!.routes['seat-1'];assert.throws(()=>roundtrip({...g,tradeRoutes:{...g.tradeRoutes!,routes:{...g.tradeRoutes!.routes,'seat-1':{...route,sales:[...route.sales.slice(0,-1),{...route.sales.at(-1)!,revision:route.sales[0].revision}]}}}}));
});
test("town-hall reward chains physical white castle then sells without starting another route reward",()=>{
 let g=tradeFixture('town-hall');const p=g.players[0];const cell=p.duchy.cells.find(c=>c.terrain==='building'&&!c.tileId&&p.duchy.cells.some(n=>n.tileId&&Math.max(Math.abs(c.coord.q-n.coord.q),Math.abs(c.coord.r-n.coord.r),Math.abs(c.coord.q+c.coord.r-n.coord.q-n.coord.r))===1))!;assert.ok(cell);
 g={...g,config:{...g.config,extensions:[...g.config.extensions,{id:'white-castles',options:{}}]},tiles:{...g.tiles,'TEST-WHITE':{id:'TEST-WHITE',type:'building',building:'white-castle',back:'matching-color'}},market:{...g.market,removedTileIds:[...g.market.removedTileIds,'TEST-TRADE-STASH']},players:g.players.map((p,i)=>i?p:{...p,storage:['TEST-WHITE',null,null]})};
 g=tradeStep(g,directSale(g));let c=g.turn.pendingChoice!,o=c.options.find(o=>(o.payload as {intent?:{cellId?:string}})?.intent?.cellId===cell.id)!;assert.ok(o);g=tradeStep(g,{type:'resolve-choice',playerId:'seat-1',choiceId:c.id,optionId:o.id});
 assert.equal(g.tradeRoutes!.routes['seat-1'].sales[0].status,'resolved');assert.ok(g.turn.pendingChoice?.source.section.includes('흰 성'));c=g.turn.pendingChoice!;o=c.options.find(o=>(o.payload as {intent?:{kind?:string}})?.intent?.kind==='sell-goods')!;assert.ok(o);g=tradeStep(g,{type:'resolve-choice',playerId:'seat-1',choiceId:c.id,optionId:o.id});assert.equal(g.tradeRoutes!.routes['seat-1'].sales.length,1);assert.deepEqual(roundtrip(g),g);
});
test("custom bank does not multiply shield9/monastery3 sale; boarding-house triggers other player's shield2 once",()=>{
 const enable=(g:GameState)=>{const s=createShieldLayout(2,g.random,true);return setShieldLayout({...g,random:s.random,config:{...g.config,extensions:[...g.config.extensions,{id:'shields',options:{rules:true}}]}},s.layout);};
 let g=mount(enable(tradeFixture('bank')),9);g=placed(g,0,{type:'monastery',back:'matching-color',number:3} as import('../../src/game/types').Tile);
 const old=g.players[0].silver,count=g.players[0].goods.find(s=>s.type===g.dice.players['seat-1'][0].value)!.tiles.length;g=tradeStep(g,directSale(g));assert.equal(g.players[0].silver-old,count+1+2);
 let workers=mount(enable(tradeFixture('boarding-house')),2,1);const before=workers.players[1].workers;workers=tradeStep(workers,directSale(workers));assert.equal(workers.players[1].workers,before+1);assert.deepEqual(roundtrip(workers),workers);
});
for(const count of [2,3,4]as const)test(`custom trade AI${count} completes25 rounds with expansions and save/choice restoration`,()=>{
 let g=createPracticeSession({names:Array.from({length:count},(_,i)=>`AI${i}`),seed:`trade-ai-${count}`,tradeRoutes:true,inns:true,whiteCastles:true,shieldRules:true,additionalHexes:true,officialSlots:true,boardIds:Array(count).fill("se:border-posts:23")});let steps=0,sales=0;
 while(g.status!=="finished"){
  assert.ok(++steps<1800);const a=chooseComputerAction(g);assert.ok(a.ok);if(a.value.type==='use-die'&&a.value.intent.kind==='sell-goods')sales++;
  const r=applyCoreAction(g,a.value);assert.ok(r.ok,JSON.stringify(r));g=r.value.state;if(steps%30===0)g=roundtrip(g);
 }
 assert.equal(g.turn.phase,'E');assert.ok(sales>0);assert.ok(Object.values(g.tradeRoutes!.routes).some(r=>r.sales.length>0));assert.equal(roundtrip(g).finalScores!.length,count);assert.ok(validateCoreState(g).valid);
});
