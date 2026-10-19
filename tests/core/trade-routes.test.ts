import {test} from "node:test";
import assert from "node:assert/strict";
import {prepareTradeRoutes,progressTradeRoute,tradeRouteSpaces,validTradeRoute,VERIFIED_TRADE_ROUTE_CATALOG,type TradeRouteTile} from "../../src/game/trade-routes";
import type {DieValue} from "../../src/game/types";

/** TEST FIXTURE ONLY: arbitrary numbers/opaque bonuses, NEVER official component data. */
const catalog:readonly TradeRouteTile[]=Array.from({length:12},(_,i)=>({id:`TEST-ROUTE-${i}`,spaces:[0,1,2].map(j=>({goodsType:((i+j)%6+1) as DieValue,bonusId:`TEST-UNKNOWN-BONUS-${j}`})) as unknown as TradeRouteTile["spaces"]}));
for(const players of [2,3,4]as const)test(`trade-route ${players}-player setup deals5/4/3 distinct strips reproducibly without changing input`,()=>{
 const ids=Array.from({length:players},(_,i)=>`p${i}`),random={seed:"trade-setup",cursor:0},before=structuredClone(catalog);
 const a=prepareTradeRoutes(ids,catalog,random),b=prepareTradeRoutes(ids,catalog,random);assert.deepEqual(a,b);assert.deepEqual(catalog,before);assert.equal(random.cursor,0);
 const all=[...Object.values(a.routes).flatMap(r=>r.tileIds),...a.unusedTileIds];assert.equal(new Set(all).size,12);assert.equal(all.length,12);
 for(const r of Object.values(a.routes)){assert.equal(r.tileIds.length,players===2?5:players===3?4:3);assert.equal(tradeRouteSpaces(r,catalog).length,r.tileIds.length*3);assert.ok(validTradeRoute(r,catalog,players));}
});
test("trade-route rejects absent/unverified-sized/duplicate/malformed component catalogs",()=>{
 assert.equal(VERIFIED_TRADE_ROUTE_CATALOG.length,0);
 assert.throws(()=>prepareTradeRoutes(["a","b"],VERIFIED_TRADE_ROUTE_CATALOG,{seed:"s",cursor:0}));
 assert.throws(()=>prepareTradeRoutes(["a","a"],catalog,{seed:"s",cursor:0}));
 assert.throws(()=>prepareTradeRoutes(["a"],catalog,{seed:"s",cursor:0}));
 assert.throws(()=>prepareTradeRoutes(["a","b"],[catalog[0],...catalog.slice(0,11)],{seed:"s",cursor:0}));
 assert.throws(()=>prepareTradeRoutes(["a","b"],catalog.map((t,i)=>i?t:{...t,spaces:[]} as unknown as TradeRouteTile),{seed:"s",cursor:0}));
});
test("sold goods fill left-to-right, consume mismatches, emit each matched bonus once and reject replay",()=>{
 const route=prepareTradeRoutes(["a","b"],catalog,{seed:"s",cursor:0}).routes.a,before=structuredClone(route),spaces=tradeRouteSpaces(route,catalog);
 const type=spaces[0].goodsType,sold=Array.from({length:4},(_,i)=>({id:`sold-${i}`,type}));
 const r=progressTradeRoute(route,sold,catalog,2);assert.deepEqual(route,before);assert.deepEqual(r.route.placedGoods,sold);
 assert.deepEqual(r.bonuses,spaces.slice(0,4).flatMap((s,i)=>s.goodsType===type?[{spaceId:s.id,goodsId:sold[i].id,bonusId:s.bonusId}]:[]));
 assert.ok(r.bonuses.length<sold.length);assert.ok(validTradeRoute(r.route,catalog,2));
 assert.throws(()=>progressTradeRoute(r.route,sold,catalog,2));assert.throws(()=>progressTradeRoute(route,[sold[0],sold[0]],catalog,2));
});
test("sale crossing the end and later sales move excess goods to normal overflow with no bonus",()=>{
 const route=prepareTradeRoutes(["a","b","c","d"],catalog,{seed:"overflow",cursor:0}).routes.a;
 const sale=Array.from({length:12},(_,i)=>({id:`g${i}`,type:1 as const})),r=progressTradeRoute(route,sale,catalog,4);
 assert.equal(r.route.placedGoods.length,9);assert.equal(r.route.overflowGoods.length,3);assert.ok(r.bonuses.every(b=>Number(b.goodsId.slice(1))<9));
 const next=progressTradeRoute(r.route,[{id:"late",type:6}],catalog,4);assert.equal(next.route.overflowGoods.length,4);assert.deepEqual(next.bonuses,[]);
});
test("JSON roundtrip preserves exact route position/matches and detects tampering",()=>{
 const route=prepareTradeRoutes(["a","b"],catalog,{seed:"save",cursor:0}).routes.a;
 const r=progressTradeRoute(route,[{id:"one",type:tradeRouteSpaces(route,catalog)[0].goodsType}],catalog,2).route;
 const saved=JSON.parse(JSON.stringify(r));assert.deepEqual(saved,r);assert.ok(validTradeRoute(saved,catalog,2));
 assert.equal(validTradeRoute({...r,matchedSpaceIds:[]},catalog,2),false);
 assert.equal(validTradeRoute({...r,tileIds:["forged",...r.tileIds.slice(1)]},catalog,2),false);
 assert.equal(validTradeRoute({...r,overflowGoods:[{id:"overflow-too-soon",type:1}]},catalog,2),false);
 assert.throws(()=>progressTradeRoute(r,[],catalog,2));assert.throws(()=>progressTradeRoute(r,[{id:"x",type:1},{id:"y",type:2}],catalog,2));
});
