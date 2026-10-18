import { test } from "node:test";
import assert from "node:assert/strict";
import { createPracticeSession } from "../../src/game/practice";
import { borderPostScore, connectedPostPairs } from "../../src/game/core/border-posts";
import { resolvePlacement } from "../../src/game/core/placement";
import { finalScore } from "../../src/game/core/phases";
import { validateCoreState } from "../../src/game/core/state";
import { serializeSavedGame, parseSavedGame } from "../../src/game/save";
import { coreFixture, type TestState } from "./fixture";

test("geese join one best herd, later count with any species, and monastery 7 counts each scoring tile", () => {
  const s=coreFixture();s.config.extensions=[{id:"geese",options:{}}];
  const p=s.players[0];
  for(const [id,species,count,q] of [["cow","cattle",4,1],["pig","pigs",3,2],["goose","geese",2,3],["pig2","pigs",2,4]] as const){
    s.tiles[id]={id,type:"livestock",species,count,back:species==="geese"?"black":"matching-color"};
    p.duchy.cells.push({id,coord:{q,r:0},terrain:"livestock",number:1,regionId:"pasture",tileId:id==="goose"||id==="pig2"?null:id});
  }
  p.storage[0]="goose";p.storage[1]="pig2";
  let result=resolvePlacement(s,p,"goose","goose");
  assert.equal(result.entries.find(e=>e.category==="livestock")?.points,6); // goose + cows, not all species
  s.players[0]=structuredClone(result.player) as TestState["players"][number];
  result=resolvePlacement(s,s.players[0],"pig2","pig2");
  assert.equal(result.entries.find(e=>e.category==="livestock")?.points,7); // pig2 + pig3 + goose2
  s.tiles.monk={id:"monk",type:"monastery",number:7,back:"black"};
  p.duchy.cells.push({id:"monk",coord:{q:0,r:1},terrain:"monastery",number:1,regionId:"monk",tileId:"monk"});
  result=resolvePlacement(s,p,"goose","goose");
  assert.equal(result.entries.find(e=>e.category==="livestock")?.points,8); // 6 + two scoring tiles
});

test("all three post pairs score once and first/second complete connections get a bonus",()=>{
  const s=structuredClone(createPracticeSession({names:["a","b"],seed:"posts",boardIds:["se:border-posts:23","se:border-posts:23"],officialSlots:true,borderPosts:true})) as TestState;
  const player=s.players[0];
  const fill=(ids:string[])=>({...player,duchy:{...player.duchy,cells:player.duchy.cells.map(c=>({...c,tileId:ids.includes(c.id)?"occupied":null}))}});
  const top=["-1,-2","0,-2","1,-2","2,-2","3,-2"];
  const before=fill([]), pair=fill(top), all=fill([...top,"-1,-1","-1,0","-1,1","-1,2","-1,3"]);
  assert.deepEqual(connectedPostPairs(pair),["left-right"]);
  assert.equal(connectedPostPairs(all).length,3);
  assert.deepEqual(borderPostScore(s,before,pair).map(e=>e.points),[10]);
  assert.deepEqual(borderPostScore(s,pair,pair),[]);
  const entries=borderPostScore(s,pair,all);
  assert.deepEqual(entries.map(e=>e.points),[10,10,5]);
  s.scoreLedger[player.id]=structuredClone(entries) as TestState["scoreLedger"][string];
  const secondBefore={...before,id:s.players[1].id},secondAfter={...all,id:s.players[1].id};
  s.turn.phase="D";
  assert.deepEqual(borderPostScore(s,secondBefore,secondAfter).map(e=>e.points),[4,4,4,2]);
  s.config.extensions=[];
  assert.deepEqual(borderPostScore(s,before,all),[]);
});

test("monastery 24 counts geese separately and monastery 26 counts a won border bonus",()=>{
  const s=coreFixture();s.config.extensions=[{id:"geese",options:{}},{id:"border-posts",options:{}}];
  const p=s.players[0];
  for(const [id,tile]of Object.entries({goose:{id:"goose",type:"livestock",species:"geese",count:2,back:"black"},cow:{id:"cow",type:"livestock",species:"cattle",count:3,back:"matching-color"},m24:{id:"m24",type:"monastery",number:24,back:"black"},m26:{id:"m26",type:"monastery",number:26,back:"matching-color"}} as const)){
    s.tiles[id]=tile;p.duchy.cells.push({id,coord:{q:p.duchy.cells.length,r:1},terrain:tile.type,number:1,regionId:id,tileId:id});
  }
  s.scoreLedger.p1.push({id:"border:p1:all",category:"extension",extensionId:"border-posts",points:5,source:{document:"special-edition-rulebook",pages:[14],section:"Border bonus"}});p.victoryPoints=5;
  const result=finalScore(s,p);assert.ok(result.ok);
  assert.equal(result.value.finalAdditions.find(e=>e.id.endsWith("monastery-24"))?.points,8);
  assert.equal(result.value.finalAdditions.find(e=>e.id.endsWith("monastery-26"))?.points,3);
});

test("optional rules persist in saves and disabled/invalid goose definitions are rejected",()=>{
  const game=createPracticeSession({names:["a","b"],seed:"optional-save",officialSlots:true,geese:true,borderPosts:true,boardIds:["se:border-posts:23","se:base:2"]});
  assert.equal(Object.keys(game.tiles).length,161);
  assert.equal(Object.values(game.tiles).filter(t=>t.type==="livestock"&&t.species==="geese").length,1);
  assert.equal(validateCoreState(game).valid,true);
  const saved={format:"burgundy-local-v1" as const,randomAlgorithm:"counter-v1" as const,game,logs:[],view:{zoom:1,focus:false,boardZooms:{}}};
  assert.deepEqual(parseSavedGame(serializeSavedGame(saved)),saved);
  const bad=structuredClone(game) as TestState;bad.config.extensions=[];
  assert.equal(validateCoreState(bad).valid,false);
  bad.config.extensions=[{id:"geese",options:{}}];
  const goose=Object.values(bad.tiles).find(t=>t.type==="livestock"&&t.species==="geese")!;
  if(goose.type==="livestock")goose.count=3;
  assert.equal(validateCoreState(bad).valid,false);
});
