import test from "node:test";
import type {MonasteryNumber,BuildingType} from "../../src/game/types";
import assert from "node:assert/strict";
import {existsSync} from "node:fs";
import {getTileHelp,tileHelpId,TILE_HELP_ENTRIES,TILE_HELP_CATEGORIES,SHIELD_MAINTENANCE} from "../../src/game/tile-help";
import {setup,placed,mount,step} from "../fixtures/shields";
import {executeIntent} from "../../src/game/core/intents";
import {finalScore} from "../../src/game/core/phases";
import {shieldSpecialIssue} from "../../src/game/core/shield-effects";

const monk=(number:MonasteryNumber)=>({type:"monastery" as const,number,back:"matching-color" as const});
const building=(building:BuildingType)=>({type:"building" as const,building,back:"matching-color" as const});
const seal={type:"livestock",species:"geese",count:2,back:"black"} as const;
const guineaPig={type:"livestock",species:"chickens",count:2,back:"matching-color"} as const;

test("encyclopedia and effects share complete numbered monastery29 and shield18 entries",()=>{
 assert.equal(new Set(TILE_HELP_ENTRIES.map(h=>h.id)).size,TILE_HELP_ENTRIES.length);
 for(const [kind,total] of [["monastery",29],["shield",18]] as const){
  const list=TILE_HELP_ENTRIES.filter(h=>h.kind===kind);assert.deepEqual(list.map(h=>h.number),Array.from({length:total},(_,i)=>i+1));
  for(const h of list){assert.equal(getTileHelp(kind,h.number),h);for(const field of [h.name,h.summary,h.details,h.timing,h.conditions])assert.ok(field.length>4);if(h.tile)assert.equal(tileHelpId(h.tile),h.id);}
 }
 assert.equal(getTileHelp("monastery",30),undefined);assert.equal(getTileHelp("shield",0),undefined);
 assert.equal(TILE_HELP_CATEGORIES.findIndex(c=>c.kind==="shield"),TILE_HELP_CATEGORIES.findIndex(c=>c.kind==="monastery")+1);
});
test("all approved images exist and the reference catalog covers buildings10 animals13 and extensions",()=>{
 for(const h of TILE_HELP_ENTRIES)if(h.imagePath)assert.ok(existsSync(`public${h.imagePath}`),h.id);
 assert.equal(TILE_HELP_ENTRIES.filter(h=>h.kind==="building").length,10);
 assert.equal(TILE_HELP_ENTRIES.filter(h=>h.kind==="livestock").length,13);
 assert.match(getTileHelp("livestock:chickens:2")!.name,/기니피그/);assert.match(getTileHelp("livestock:geese:2")!.name,/하프물범/);
 assert.match(getTileHelp("vineyard")!.details,/최대 5개/);assert.match(getTileHelp("trade-route")!.details,/다시 진행하지/);
});
test("monastery13 and14 description follows actual worker action and castle action semantics",()=>{
 let g=placed(placed(setup(),0,monk(13)),0,monk(14));
 const before=structuredClone(g);g=executeIntent(g,g.players[0].id,{kind:"take-workers"});
 assert.equal(g.players[0].workers-before.players[0].workers,4);assert.equal(g.players[0].silver-before.players[0].silver,1);assert.deepEqual(g.dice,before.dice);
 assert.match(getTileHelp("monastery",13)!.details,/성/);assert.match(getTileHelp("monastery",13)!.details,/일꾼 4개와 은화 1개/);assert.match(getTileHelp("monastery",14)!.details,/숙소/);
});
test("monastery24 and25 distinguish animal types from sold tiles and monastery26 includes border bonus",()=>{
 let g=setup();for(const number of [24,25,26] as const)g=placed(g,0,monk(number));
 g=placed(g,0,seal);g=placed(g,0,guineaPig);
 const p=g.players[0],goods=p.goods.flatMap(g=>g.tiles);
 g={...g,players:g.players.map((x,i)=>i===0?{...x,goods:[],soldGoods:goods}:x),scoreLedger:{...g.scoreLedger,[p.id]:[...g.scoreLedger[p.id],{id:`border:${p.id}:all`,category:"color-bonus",points:0,source:{document:"project-user-rule",pages:[],section:"test"}}]}};
 const score=finalScore(g,g.players[0]);assert.ok(score.ok);
 assert.equal(score.value.finalAdditions.find(e=>e.id.endsWith("monastery-24"))!.points,8);
 assert.equal(score.value.finalAdditions.find(e=>e.id.endsWith("monastery-25"))!.points,goods.length);
 assert.equal(score.value.finalAdditions.find(e=>e.id.endsWith("monastery-26"))!.points,(p.bonuses.length+1)*3);
 assert.match(getTileHelp("monastery",24)!.details,/하프물범/);assert.match(getTileHelp("monastery",25)!.details,/전체 장수/);assert.match(getTileHelp("monastery",26)!.details,/국경 요새/);
});
test("monastery28 other-turn repeat purchase and29 crane count agree with descriptions",()=>{
 let g=placed(setup(),0,monk(28));g={...g,turn:{...g.turn,activePlayerId:g.players[1].id}};
 const before=g.players[0];g=step(g,{type:"buy-workers",playerId:before.id});g=step(g,{type:"buy-workers",playerId:before.id});assert.equal(g.players[0].silver,before.silver-2);assert.equal(g.players[0].workers,before.workers+4);
 assert.match(getTileHelp("monastery",28)!.details,/다른 플레이어 차례/);
 g=placed(g,0,monk(29));g=placed(g,0,building("white-castle"));g=placed(g,0,building("crane"));
 const score=finalScore(g,g.players[0]);assert.ok(score.ok);assert.equal(score.value.finalAdditions.find(e=>e.id.endsWith("monastery-29"))!.points,4);assert.equal(score.value.finalAdditions.find(e=>e.id.endsWith("crane-building"))!.points,4);assert.match(getTileHelp("monastery",29)!.details,/일반 초록 성은 세지/);
});
test("shield6 self target and16 once-per-turn unused die condition match actual validation",()=>{
 const g=mount(mount(setup(),6),16),p=g.players[0];
 assert.equal(shieldSpecialIssue(g,{type:"extension",extensionId:"shields",command:"choose-monastery-target",playerId:p.id,payload:{targetPlayerId:p.id}}),null);
 const a={type:"extension" as const,extensionId:"shields" as const,command:"change-die",playerId:p.id,payload:{dieId:g.dice.players[p.id][0].id,value:6}};
 assert.equal(shieldSpecialIssue(g,a),null);const next=step(g,a);assert.ok(shieldSpecialIssue(next,a));assert.equal(next.dice.players[p.id][0].used,false);
 assert.match(getTileHelp("shield",6)!.details,/자기 자신/);assert.match(getTileHelp("shield",16)!.timing,/한 번/);
 assert.match(getTileHelp("shield",3)!.details,/일꾼 1개/);assert.match(getTileHelp("shield",14)!.details,/유지비/);assert.match(getTileHelp("shield",15)!.details,/포도 상점은 대상이 아닙니다/);assert.match(SHIELD_MAINTENANCE,/14·15/);
});
