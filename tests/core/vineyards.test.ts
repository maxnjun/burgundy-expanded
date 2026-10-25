import {automaticAction} from "../../src/game/direct-actions";
import {prepareTileEffect,immediateOptions,refreshPendingChoice} from "../../src/game/core/effects";
import {setupCustomTrade} from "../../src/game/custom-trade-routes";
import {mkdirSync,writeFileSync} from "node:fs";
import {mount,placed} from "../fixtures/shields";
import {createShieldLayout,setShieldLayout,shieldLayout} from "../../src/game/shields";
import {settleShieldState} from "../../src/game/core/shield-effects";
import {vineFixture,layeredVineFixture,blackVineFixture} from "../fixtures/vineyards";
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPracticeSession} from '../../src/game/practice';
import {applyCoreAction,listCoreActionOptions,validateCoreState,validateCoreAction} from '../../src/game/core';
import {VINE_SLOTS,VINE_TILES,GRAPES,vineNeighbors,vineScore,vineScoreBreakdown,refillVineyards} from '../../src/game/vineyards';
import {chooseComputerAction} from '../../src/game/computer';
import {parseSavedGame,serializeSavedGame} from '../../src/game/save';
import type {GameState,GameAction} from '../../src/game/types';
export const vineStep=(g:GameState,a:GameAction)=>{const r=applyCoreAction(g,a);assert.ok(r.ok,JSON.stringify(r));return r.value.state;};
const options=(g:GameState)=>{const r=listCoreActionOptions(g,g.turn.activePlayerId??'seat-1');assert.ok(r.ok,JSON.stringify(r));return r.value.actions;};
const saved=(game:GameState)=>parseSavedGame(serializeSavedGame({format:'burgundy-local-v1',randomAlgorithm:'counter-v1',game,logs:[],view:{zoom:1,focus:false,boardZooms:{}}})).game;

test('vineyard reconstruction has24 tessellated cells,12 adjacent pairs,2/4/5/1 layers and51 conserved grape tiles',()=>{
 assert.equal(VINE_SLOTS.length,12);assert.equal(new Set(VINE_SLOTS.flatMap(s=>s.cells.map(c=>`${c.q},${c.r}`))).size,24);
 for(const s of VINE_SLOTS)assert.ok(vineNeighbors(...s.cells));for(let n=1;n<=6;n++)assert.equal(VINE_SLOTS.filter(s=>s.value===n).length,2);
 assert.deepEqual([1,2,3,4].map(l=>VINE_SLOTS.filter(s=>s.layer===l).length),[2,4,5,1]);assert.equal(Object.keys(VINE_TILES).length,51);
 for(const g of GRAPES){assert.equal(Object.values(VINE_TILES).flat().filter(c=>c===g).length,17);assert.equal(Object.values(VINE_TILES).filter(cs=>cs[0]===g&&cs[1]===g).length,1);}
});
for(const count of [2,3,4] as const)test(`vineyard${count} preparation, P01, P02, deterministic deal and old save compatibility`,()=>{
 const cfg={names:Array.from({length:count},(_,i)=>`P${i}`),seed:'vine-setup',vineyards:true},g=createPracticeSession(cfg);assert.deepEqual(createPracticeSession(cfg),g);assert.equal(g.vineyards!.depots.length,count===4?6:3);assert.equal(g.vineyards!.store.length,count===2?1:3);assert.equal(new Set(Object.values(g.vineyards!.players).flatMap(p=>p.tokens)).size,count);assert.deepEqual(saved(g),g);assert.equal(createPracticeSession({...cfg,vineyards:false}).vineyards,undefined);
});
test('taking occupies two distinct keys; first placement blocks higher layers, uses workers atomically and persists both directions',()=>{
 let g=vineFixture();const a=options(g).find(a=>a.type==='use-die'&&a.intent.kind==='vineyard'&&a.intent.command==='take')!;assert.ok(a);g=vineStep(g,a);const reserve=g.players[0].vineyardReserve![0];assert.equal(new Set(reserve.keys).size,2);assert.deepEqual(saved(g),g);
 const first=options(g).filter(a=>a.type==='use-die'&&a.intent.kind==='vineyard'&&a.intent.command==='place');assert.ok(first.length);assert.ok(first.every(a=>a.type==='use-die'&&a.intent.kind==='vineyard'&&['V01','V02'].includes(a.intent.slotId!)));
 const normal=g.market.numberedDepots[0].slots.find(s=>s.tileId)!;assert.equal(validateCoreAction(g,{type:'use-die',playerId:'seat-1',dieId:g.dice.players['seat-1'][1].id,adjustment:{steps:[],workersSpent:0},intent:{kind:'take-tile',depot:1,tileId:normal.tileId!,storageSlot:reserve.keys[0]}}).valid,false);
 const place=first.find(a=>a.type==='use-die'&&a.intent.kind==='vineyard'&&a.intent.slotId==='V01'&&a.intent.flipped)!;g=vineStep(g,place);assert.equal(g.players[0].vineyardReserve!.length,0);assert.equal(g.vineyards!.players['seat-1'].placed[0].flipped,true);assert.ok(g.turn.pendingChoice);assert.deepEqual(saved(g),g);assert.equal(validateCoreAction(g,place).valid,false);
 let n=0;while(g.turn.pendingChoice){assert.ok(n++<20);g=vineStep(g,options(g).find(a=>a.type==='resolve-choice'&&a.optionId==='skip')??options(g).find(a=>a.type==='resolve-choice')!);}
 assert.equal(g.vineyards!.stack.length,0);assert.equal(g.vineyards!.players['seat-1'].placed[0].used.length,2);assert.ok(g.players[0].workers>=34);assert.deepEqual(saved(g),g);
});
test('store purchase shares black/inn flag and duplicate/refill/save tampering is rejected',()=>{
 let g=vineFixture();const buy=options(g).find(a=>a.type==='extension'&&a.extensionId==='vineyards')!;assert.ok(buy);g=vineStep(g,buy);assert.equal(g.turn.blackPurchaseUsed,true);assert.equal(options(g).some(a=>a.type==='buy-black-tile'||a.type==='extension'&&a.extensionId==='vineyards'),false);assert.equal(refillVineyards(g,'A'),g);
 const corrupt={...g,vineyards:{...g.vineyards!,bag:[...g.vineyards!.bag,g.vineyards!.bag[0]]}};assert.equal(validateCoreState(corrupt).valid,false);assert.throws(()=>saved(corrupt));
});
test('vine scoring counts connected hexes, one token per region, repeated tokens never multiply one area',()=>{
 const v=vineFixture().vineyards!,p=v.players['seat-1'];const testV={...v,players:{...v.players,'seat-1':{...p,placed:[{slotId:'V01',tileId:'B-B:1',flipped:false,used:[0,1]}],tokens:['B','B'] as const}}};assert.equal(vineScore(testV,'seat-1'),3);
 const rows=vineScoreBreakdown(testV,'seat-1');assert.equal(rows.length,6);assert.deepEqual(rows.find(r=>r.grape==='B'),{grape:'B',tokens:2,regions:[2],counted:[2],points:3});assert.ok(rows.filter(r=>r.grape!=='B').every(r=>r.tokens===0&&r.points===0));
 const noTokens={...testV,players:{...testV.players,'seat-1':{...testV.players['seat-1'],tokens:[]}}};assert.equal(vineScore(noTokens,'seat-1'),0);assert.deepEqual(vineScoreBreakdown(noTokens,'seat-1')[0].counted,[]);
});
function resolveAll(g:GameState):GameState {let n=0;while(g.turn.pendingChoice){assert.ok(n++<50);const list=options(g).filter(a=>a.type==='resolve-choice'),a=list.find(a=>a.type==='resolve-choice'&&a.optionId==='skip')??list.find(a=>a.type==='resolve-choice'&&a.optionId.includes('take-workers'))??list[0];g=vineStep(g,a);g=saved(g);}return g;}
function reserveFromBag(g:GameState):GameState {const id=g.vineyards!.bag[0];return {...g,vineyards:{...g.vineyards!,bag:g.vineyards!.bag.slice(1)},players:g.players.map((p,i)=>i?p:{...p,vineyardReserve:[{tileId:id,keys:[0,1]}]}),dice:{...g.dice,players:{...g.dice.players,'seat-1':[{...g.dice.players['seat-1'][0],used:false},{...g.dice.players['seat-1'][1],used:false}]}}};}
test('all12 placements independently claim4 layers once and every bonus resumes after save',()=>{
 let g=vineFixture();for(const id of ['V01','V02','V04','V03','V05','V06','V08','V09','V10','V07','V11','V12']){g=reserveFromBag(g);const a=options(g).find(a=>a.type==='use-die'&&a.intent.kind==='vineyard'&&a.intent.command==='place'&&a.intent.slotId===id);assert.ok(a,id);g=resolveAll(vineStep(g,a));}
 assert.deepEqual([...g.vineyards!.players['seat-1'].layers].sort(),[1,2,3,4]);assert.equal(g.vineyards!.players['seat-1'].tokens.length,5);assert.equal(g.vineyards!.players['seat-1'].placed.length,12);assert.equal(g.vineyards!.stack.length,0);assert.deepEqual(saved(g),g);
});
test('castle bonus purchases a vine then nests free placement without losing the outer bonus',()=>{
 let g=vineFixture();g=resolveAll(vineStep(reserveFromBag(g),options(reserveFromBag(g)).find(a=>a.type==='use-die'&&a.intent.kind==='vineyard'&&a.intent.command==='place'&&a.intent.slotId==='V01')!));
 g=reserveFromBag(g);g=vineStep(g,options(g).find(a=>a.type==='use-die'&&a.intent.kind==='vineyard'&&a.intent.slotId==='V04')!);
 assert.equal(g.turn.pendingChoice!.source.section,'포도밭 · 프로젝트 복원판 v0.1');assert.ok(!g.turn.pendingChoice!.options.some(o=>o.id.startsWith('vine-order:')), 'the only remaining castle reward starts automatically');
 const buy=options(g).find(a=>a.type==='extension'&&a.extensionId==='vineyards');assert.ok(buy);g=vineStep(g,buy);
 const child=options(g).find(a=>a.type==='resolve-choice'&&(g.turn.pendingChoice!.options.find(o=>o.id===a.optionId)?.payload as unknown as {intent?:{kind?:string;command?:string}})?.intent?.kind==='vineyard'&&(g.turn.pendingChoice!.options.find(o=>o.id===a.optionId)?.payload as unknown as {intent:{command:string}}).intent.command==='place');assert.ok(child);
 g=resolveAll(vineStep(g,child));assert.equal(g.vineyards!.players['seat-1'].placed.length,3);assert.ok(g.vineyards!.players['seat-1'].placed.every(x=>x.used.length===2));assert.equal(g.vineyards!.stack.length,0);
});
test('optional grape reduction conserves35/22 tiles and never deals an excluded token',()=>{
 for(const [count,excluded,total] of [[3,['Y'],35],[2,['Y','R'],22]] as const){const g=createPracticeSession({names:Array.from({length:count},(_,i)=>`P${i}`),seed:'reduced',vineyards:true,excludedGrapes:excluded});const v=g.vineyards!;assert.equal(v.bag.length+v.depots.length+v.store.length,total);assert.ok(Object.values(v.players).every(p=>p.tokens.every(t=>!(excluded as readonly string[]).includes(t))));assert.deepEqual(saved(g),g);}
});
for(const count of [2,3,4] as const)test(`vine AI${count} plays25 rounds with nested bonuses, shields, inns, trade, white castles and repeated save`,{skip:!!process.env.VINEYARD_COUNT&&Number(process.env.VINEYARD_COUNT)!==count},()=>{
 for(let simulation=0;simulation<Number(process.env.VINEYARD_SIMULATIONS??1);simulation++){
 let g=createPracticeSession({names:Array.from({length:count},(_,i)=>`AI${i}`),seed:`vine-ai-${count}-${simulation}`,vineyards:true,inns:true,tradeRoutes:true,whiteCastles:true,additionalHexes:true,shieldRules:true,officialSlots:true});let steps=0;
 while(g.status!=='finished'){assert.ok(++steps<2500);let a;try{a=chooseComputerAction(g);}catch(error){mkdirSync(".local-data/vineyards",{recursive:true});writeFileSync(`.local-data/vineyards/failed-${count}-${simulation}.json`,JSON.stringify(g));throw error;}if(!a.ok){mkdirSync(".local-data/vineyards",{recursive:true});writeFileSync(`.local-data/vineyards/failed-${count}-${simulation}.json`,JSON.stringify(g));}assert.ok(a.ok,JSON.stringify({count,simulation,steps,result:a}));g=vineStep(g,a.value);if(steps%35===0)g=saved(g);}
 assert.equal(g.turn.phase,'E');assert.ok(Object.values(g.vineyards!.players).some(p=>p.placed.length));assert.deepEqual(saved(g),g);
 }
});

test('vineyard actions replay deterministically from identical serialized checkpoints',()=>{
 let a=vineFixture(),b=saved(a);for(let n=0;n<35&&a.status!=='finished';n++){const r=chooseComputerAction(a);assert.ok(r.ok);a=vineStep(a,r.value);b=vineStep(b,r.value);assert.deepEqual(b,a);}assert.deepEqual(saved(a),a);
});

function withShield(g:GameState,n:number):GameState{const x=createShieldLayout(2,g.random,true);return mount(setShieldLayout({...g,random:x.random,config:{...g.config,extensions:[...g.config.extensions,{id:'shields',options:{rules:true}}]}},x.layout),n);}
for(let n=1;n<=18;n++)test(`shield${n} preserves vine acquisition, placement, two bonuses and save`,()=>{
 let g=withShield(vineFixture(),n);const take=options(g).find(a=>a.type==='use-die'&&a.intent.kind==='vineyard'&&a.intent.command==='take')!;assert.ok(take);g=vineStep(g,take);
 const place=options(g).find(a=>a.type==='use-die'&&a.intent.kind==='vineyard'&&a.intent.command==='place'&&a.intent.slotId==='V01')!;assert.ok(place);g=resolveAll(vineStep(g,place));assert.equal(g.vineyards!.players['seat-1'].placed[0].used.length,2);assert.deepEqual(saved(g),g);
});
test('losing shield4 offers a whole double tile discard and compacts the remaining two key reservation',()=>{
 let g=withShield(vineFixture(),4);
 const take=options(g).find(a=>a.type==='use-die'&&a.intent.kind==='vineyard'&&a.intent.command==='take')!;g=vineStep(g,take);const buy=options(g).find(a=>a.type==='extension'&&a.extensionId==='vineyards')!;assert.ok(buy);g=vineStep(g,buy);assert.equal(g.players[0].vineyardReserve!.length,2);
 const l=shieldLayout(g)!;g=settleShieldState(setShieldLayout(g,{...l,mounted:l.mounted.filter(m=>m.shieldNumber!==4),removed:[...l.removed,4]}));assert.ok(validateCoreState(g).valid,JSON.stringify(validateCoreState(g)));assert.ok(g.turn.pendingChoice!.options.some(o=>o.id.startsWith('discard:vine:')));g=vineStep(g,options(g).find(a=>a.type==='resolve-choice'&&a.optionId.startsWith('discard:vine:'))!);assert.equal(g.players[0].storage.length,3);assert.equal(g.players[0].vineyardReserve!.length,1);assert.deepEqual(saved(g),g);
});

test('regression AI3 seed5 resumes phase-end shield15 white castle using the retained last white die',()=>{
 let g=createPracticeSession({names:['A','B','C'],seed:'vine-ai-3-5',vineyards:true,inns:true,tradeRoutes:true,whiteCastles:true,additionalHexes:true,shieldRules:true,officialSlots:true});let steps=0;while(g.status!=='finished'){assert.ok(++steps<2500);const a=chooseComputerAction(g);assert.ok(a.ok,JSON.stringify(a));g=vineStep(g,a.value);if(g.turn.stage==='phase-end')assert.notEqual(g.dice.whiteDie,null);if(steps%15===0)g=saved(g);}assert.equal(g.turn.phase,'E');
});

test('white castle uses its die and workers for a free vineyard placement, then resumes both bonuses',()=>{
 let g=vineFixture();g={...g,config:{...g.config,extensions:[...g.config.extensions,{id:'white-castles',options:{}}]},dice:{...g.dice,whiteDie:3}};g=reserveFromBag(g);g=placed(g,0,{type:'building',building:'white-castle',back:'matching-color'} as Omit<import('../../src/game/types').Tile,'id'>);const id=Object.values(g.tiles).find(t=>t.type==='building'&&t.building==='white-castle')!.id;
 const before=g;g=prepareTileEffect(g,'seat-1',id);assert.deepEqual(saved(g),g);const option=g.turn.pendingChoice!.options.find(o=>{const i=(o.payload as unknown as {intent?:{kind?:string;command?:string;slotId?:string}})?.intent;return i?.kind==='vineyard'&&i.command==='place'&&i.slotId==='V01';});assert.ok(option);g=resolveAll(vineStep(g,{type:'resolve-choice',playerId:'seat-1',choiceId:g.turn.pendingChoice!.id,optionId:option.id}));assert.equal(g.players[0].workers,before.players[0].workers+3);assert.deepEqual(g.dice,before.dice);assert.equal(g.vineyards!.players['seat-1'].placed.length,1);
 const unavailable={...before,dice:{...before.dice,whiteDie:null}};assert.deepEqual(immediateOptions(unavailable,unavailable.players[0],'white-castle').map(o=>o.id),['skip']);
});
test('a vineyard warehouse sale gives normal resources and advances custom trade once',()=>{
 let g=vineFixture();g=setupCustomTrade({...g,config:{...g.config,extensions:[...g.config.extensions,{id:'trade-routes',options:{}}]}});g=reserveFromBag(g);g=resolveAll(vineStep(g,options(g).find(a=>a.type==='use-die'&&a.intent.kind==='vineyard'&&a.intent.slotId==='V01')!));g=reserveFromBag(g);g=vineStep(g,options(g).find(a=>a.type==='use-die'&&a.intent.kind==='vineyard'&&a.intent.slotId==='V03')!);g=vineStep(g,options(g).find(a=>a.type==='resolve-choice'&&a.optionId==='vine-order:V03:0')!);
 const before=g.players[0].silver,sold=g.players[0].soldGoods.length;g=vineStep(g,options(g).find(a=>a.type==='resolve-choice'&&(g.turn.pendingChoice!.options.find(o=>o.id===a.optionId)?.payload as unknown as {intent?:{kind?:string}})?.intent?.kind==='sell-goods')!);assert.equal(g.players[0].silver,before+1);assert.ok(g.players[0].soldGoods.length>sold);assert.equal(g.tradeRoutes!.routes['seat-1'].sales.length,1);const restored=saved(resolveAll(g));assert.equal(restored.tradeRoutes!.routes['seat-1'].sales.length,1);assert.deepEqual(restored.players[0].soldGoods,g.players[0].soldGoods);
});

test('fourth single slot completes before third layer, adds only one token and survives replay/save',()=>{
 const g=layeredVineFixture(),own=g.vineyards!.players['seat-1'];assert.equal(VINE_SLOTS.find(s=>s.id==='V07')!.layer,3);assert.deepEqual(VINE_SLOTS.filter(s=>s.layer===4).map(s=>s.id),['V11']);assert.ok(own.placed.some(p=>p.slotId==='V11'));assert.ok(own.layers.includes(4));assert.ok(!own.layers.includes(3));assert.equal(own.tokens.length,own.layers.length+1);assert.deepEqual(saved(g),g);assert.deepEqual(resolveAll(g),g);
});
test('validated legacy three-layer active save upgrades explicitly without inventing claimed tokens',()=>{
 const g=layeredVineFixture(true),old={...g,vineyards:{...g.vineyards!,version:'project-vineyards-v1' as const}};const n=saved(old);assert.equal(n.vineyards!.version,'project-vineyards-v2');assert.deepEqual(n.vineyards!.pool,old.vineyards!.pool);assert.deepEqual(n.vineyards!.players,old.vineyards!.players);assert.deepEqual(saved(n),n);assert.deepEqual(saved(resolveAll(n)),resolveAll(n));
});

test('V11 horizontal top pair alone completes tier4 after its two bonuses, awards exactly one token',()=>{
 let g=layeredVineFixture(true,4);const p=g.vineyards!.players['seat-1'];assert.equal((g.turn.pendingEffects[0].payload as {layer:number}).layer,4);assert.ok(p.placed.find(x=>x.slotId==='V11')?.used.length===2);assert.ok(!p.layers.includes(4));const before=p.tokens.length;const action=options(g).find(a=>a.type==='resolve-choice')!;g=vineStep(g,action);assert.equal(g.vineyards!.players['seat-1'].tokens.length,before+1);assert.ok(g.vineyards!.players['seat-1'].layers.includes(4));assert.equal(validateCoreAction(g,action).valid,false);assert.deepEqual(saved(g),g);
});

test('unmarked intermediate tier4 saves are rejected explicitly instead of silently moving earned rewards',()=>{
 const g=vineFixture();const text=serializeSavedGame({format:'burgundy-local-v1',randomAlgorithm:'counter-v1',game:g,logs:[],view:{zoom:1,focus:false,boardZooms:{}}});const raw=JSON.parse(text);delete raw.game.vineyards.topSlotId;raw.game.vineyards.players['seat-1'].layers=[4];assert.throws(()=>parseSavedGame(JSON.stringify(raw)),/최상층 위치 표시/);
});

test('unclaimed intermediate tier map adopts V11 without changing any tile, pool or token',()=>{
 const g=vineFixture(),raw=JSON.parse(serializeSavedGame({format:'burgundy-local-v1',randomAlgorithm:'counter-v1',game:g,logs:[],view:{zoom:1,focus:false,boardZooms:{}}}));delete raw.game.vineyards.topSlotId;const n=parseSavedGame(JSON.stringify(raw)).game;assert.deepEqual(n,g);
});

test('new vineyard board IDs use supported coordinates and legacy saves never reroll',()=>{
 const g=vineFixture();assert.ok(g.vineyards!.players['seat-1'].boardId);assert.deepEqual(saved(g),g);
 const old={...g,vineyards:{...g.vineyards!,players:Object.fromEntries(Object.entries(g.vineyards!.players).map(([id,{boardId,...p}])=>{assert.ok(boardId);return [id,p];}))}};assert.deepEqual(saved(old),old);
 assert.throws(()=>saved({...g,vineyards:{...g.vineyards!,players:{...g.vineyards!.players,'seat-1':{...g.vineyards!.players['seat-1'],boardId:'unknown' as never}}}}));
});
test('a remaining vineyard reward starts directly and the fixed bank reward cannot run twice',()=>{
 let g=reserveFromBag(vineFixture());const before=g.players[0].silver;g=vineStep(g,options(g).find(a=>a.type==='use-die'&&a.intent.kind==='vineyard'&&a.intent.slotId==='V02')!);
 assert.equal(g.players[0].silver,before+2);assert.deepEqual(g.vineyards!.players['seat-1'].placed[0].used,[0,1]);assert.ok(g.turn.pendingChoice);assert.ok(g.turn.pendingChoice.options.every(o=>!o.id.startsWith('vine-order:')));g=resolveAll(g);assert.equal(g.players[0].silver,before+2);assert.deepEqual(saved(g),g);
});
test('V12 free acquisition permits documented normal black types only, rejects numbered tiles and does not spend a purchase',()=>{
 let g=blackVineFixture();const list=g.turn.pendingChoice!.options,black=list.find(o=>(o.payload as {vineBlack?:object}|null)?.vineBlack)!;assert.ok(black);
 for(const o of list){const id=(o.payload as {vineBlack?:{tileId:string}}|null)?.vineBlack?.tileId;if(id){assert.ok(g.market.blackDepot.includes(id));assert.ok(['castle','ship','mine','livestock','building','monastery'].includes(g.tiles[id].type));}}
 const tileId=g.market.numberedDepots.flatMap(d=>d.slots).find(s=>s.tileId)!.tileId!;const bad:GameAction={type:'resolve-choice',playerId:'seat-1',choiceId:g.turn.pendingChoice!.id,optionId:JSON.stringify({tileId,storageSlot:0})};assert.equal(validateCoreAction(g,bad).valid,false);
 const old=g.players[0].silver,used=g.turn.blackPurchaseUsed;g=vineStep(g,{type:'resolve-choice',playerId:'seat-1',choiceId:g.turn.pendingChoice!.id,optionId:black.id});assert.equal(g.players[0].silver,old);assert.equal(g.turn.blackPurchaseUsed,used);assert.deepEqual(saved(g),g);
});

test('a skip-only vineyard placement reward waits when a legal purchase can create a target',()=>{
 let g=reserveFromBag(layeredVineFixture());g=vineStep(g,options(g).find(a=>a.type==='use-die'&&a.intent.kind==='vineyard'&&a.intent.slotId==='V05')!);g=vineStep(g,options(g).find(a=>a.type==='resolve-choice'&&a.optionId==='vine-order:V05:1')!);
 assert.deepEqual(g.turn.pendingChoice!.options.map(o=>o.id),['skip']);assert.equal(automaticAction(g,options(g)),null);
 const candidate=options(g).filter(a=>a.type==='buy-black-tile').map(a=>applyCoreAction(g,a)).find(r=>r.ok&&r.value.state.turn.pendingChoice!.options.some(o=>(o.payload as {intent?:{kind:string}}|null)?.intent?.kind==='place-tile'));assert.ok(candidate?.ok);if(candidate.ok){assert.ok(candidate.value.state.turn.pendingChoice!.options.length>1);assert.deepEqual(saved(candidate.value.state),candidate.value.state);}
});
test('a single vineyard castle choice waits when a legal purchase can create another action',()=>{
 let g=reserveFromBag(layeredVineFixture());g=vineStep(g,options(g).find(a=>a.type==='use-die'&&a.intent.kind==='vineyard'&&a.intent.slotId==='V06')!);const goods=g.players[0].goods.flatMap(s=>s.tiles),v=g.vineyards!;
 g=refreshPendingChoice({...g,players:g.players.map((p,i)=>i?p:{...p,goods:[]}),market:{...g.market,removedTileIds:[...g.market.removedTileIds,...g.market.numberedDepots.flatMap(d=>d.slots.flatMap(s=>s.tileId?[s.tileId]:[]))],numberedDepots:g.market.numberedDepots.map((d,i)=>({...d,slots:d.slots.map(s=>({...s,tileId:null})),goods:i?d.goods:[...d.goods,...goods]}))},vineyards:{...v,removed:[...v.removed,...v.depots.flatMap(d=>d.tileId?[d.tileId]:[]),...v.store.filter((id):id is string=>id!==null)],depots:v.depots.map(d=>({...d,tileId:null})),store:v.store.map(()=>null)}});
 assert.ok(validateCoreState(g).valid);assert.equal(g.turn.pendingChoice!.options.length,1);assert.ok(options(g).some(a=>a.type==='buy-black-tile'));assert.ok(!options(g).some(a=>a.type==='use-die'),'a started vineyard effect remains mandatory');assert.equal(automaticAction(g,options(g)),null);
 const only={...g,market:{...g.market,removedTileIds:[...g.market.removedTileIds,...g.market.blackDepot.filter((id):id is string=>!!id)],blackDepot:g.market.blackDepot.map(()=>null)}};const action=automaticAction(only,options(only));assert.ok(action);assert.equal(options(only).length,1);const done=vineStep(only,action);assert.equal(done.turn.activePlayerId,'seat-1');assert.equal(automaticAction(done,options(done)),null);assert.deepEqual(saved(done),done);
});
