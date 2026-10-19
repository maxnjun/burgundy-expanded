import {test} from "node:test";
import assert from "node:assert/strict";
import {FORTRESS_BOARDS,fortressLinesFor,type FortressLine} from "../../src/game/boards/fortress-lines";
import {fortressLineScore,lineFilled,PHASE_COMPLETION_POINTS} from "../../src/game/core/fortress-lines";
import {createPracticeSession} from "../../src/game/practice";
import {applyCoreAction,validateCoreState} from "../../src/game/core";
import {fortressFixture} from "../fixtures/fortress";
import {serializeSavedGame,parseSavedGame} from "../../src/game/save";
import {chooseComputerAction} from "../../src/game/computer";
import type {GameState,PlayerState} from "../../src/game/types";
const roundtrip=(game:GameState)=>parseSavedGame(serializeSavedGame({format:"burgundy-local-v1",randomAlgorithm:"counter-v1",game,logs:[],view:{zoom:1,focus:false,boardZooms:{}}})).game;
const filled=(p:PlayerState,ids:readonly string[]):PlayerState=>({...p,duchy:{...p.duchy,cells:p.duchy.cells.map(c=>({...c,tileId:ids.includes(c.id)?"TEST-OCCUPIED":null}))}});

test("all eight fortress boards explicitly map unchanged five-cell horizontal/q/-diagonal lines",()=>{
 assert.equal(Object.keys(FORTRESS_BOARDS).length,8);
 for(let n=23;n<=30;n++){
  const g=createPracticeSession({names:["a","b"],seed:"map",boardIds:[`se:border-posts:${n}`,"se:base:2"]}),p=g.players[0],lines=fortressLinesFor(p.duchy.boardId);
  assert.equal(p.duchy.cells.length,37);assert.equal(lines.length,3);
  for(const l of lines){assert.equal(new Set(l.cellIds).size,5);assert.ok(l.cellIds.every(id=>p.duchy.cells.some(c=>c.id===id)));assert.ok(l.icon.x===70||l.icon.x===550||l.icon.y===590);}
  assert.ok(lines[0].cellIds.every(id=>id.endsWith(",-2")));assert.ok(lines[1].cellIds.every(id=>id.startsWith("-2,")));assert.ok(lines[2].cellIds.every(id=>id.split(',').map(Number).reduce((a,b)=>a+b)===2));
 }
});
test("partial lines pay nothing, three full lines pay independently in each A–E phase",()=>{
 const g=fortressFixture().game,p=g.players[0],lines=fortressLinesFor(p.duchy.boardId),empty=filled(p,[]);
 for(const [phase,points]of Object.entries(PHASE_COMPLETION_POINTS)){
  const state={...g,turn:{...g.turn,phase:phase as GameState["turn"]["phase"]}};let before=empty;
  for(let i=0;i<3;i++){
   assert.deepEqual(fortressLineScore(state,empty,filled(p,lines[i].cellIds.slice(0,4))),[]);
   const after=filled(p,lines.slice(0,i+1).flatMap(l=>l.cellIds)),entries=fortressLineScore(state,before,after);
   assert.equal(entries.length,1);assert.equal(entries[0].points,points);assert.equal(entries[0].source.document,"project-user-rule");before=after;
   assert.deepEqual(fortressLineScore(state,before,before),[]);
  }
 }
});
test("TEST FIXTURE intersecting goals pay twice for one final cell, ledger prevents phase replay",()=>{
 const g=fortressFixture().game,p=g.players[0],base=fortressLinesFor(p.duchy.boardId)[0];
 const lines:FortressLine[]=[{...base,cellIds:["-1,-2","0,-2"]},{...base,id:"left-diagonal",cellIds:["-1,-2","1,-2"]}];
 const before=filled(p,["0,-2","1,-2"]),after=filled(p,["-1,-2","0,-2","1,-2"]),awards=fortressLineScore(g,before,after,lines);
 assert.deepEqual(awards.map(e=>e.points),[10,10]);
 const saved={...g,scoreLedger:{...g.scoreLedger,[p.id]:awards},turn:{...g.turn,phase:"E" as const}};
 assert.deepEqual(fortressLineScore(saved,before,after,lines),[]);
});
test("real placement scores region and fortress separately; saves, duplicate action and invalid awards",()=>{
 const {game,action}=fortressFixture(),before=structuredClone(game),r=applyCoreAction(game,action);assert.ok(r.ok,JSON.stringify(r));
 const next=r.value.state,entries=next.scoreLedger["seat-1"];
 assert.ok(entries.some(e=>e.id.startsWith("fortress:")&&e.points===10));assert.ok(entries.some(e=>e.category==="phase-bonus"));assert.deepEqual(game,before);
 assert.deepEqual(roundtrip(next),next);assert.equal(applyCoreAction(next,action).ok,false);assert.ok(lineFilled(next.players[0],fortressLinesFor(next.players[0].duchy.boardId)[0]));
 const duplicate={...next,scoreLedger:{...next.scoreLedger,"seat-1":[...entries,entries.find(e=>e.id.startsWith("fortress:"))!]}};assert.equal(validateCoreState(duplicate).valid,false);
});
test("1–22 boards never receive line awards even with legacy extension enabled; old saves unchanged",()=>{
 for(let n=1;n<=22;n++){const id=n<=10?`se:base:${n}`:n<=18?`se:additional-duchies:${n}`:n<=20?`se:championship:${n}`:`se:special-edition:${n}`;const g=createPracticeSession({names:["A","B"],seed:"base",boardIds:[id,"se:base:2"],borderPosts:true});const p=g.players[0];assert.deepEqual(fortressLineScore(g,filled(p,[]),filled(p,p.duchy.cells.map(c=>c.id))),[]);assert.deepEqual(roundtrip(g),g);}
});
test("AI sees the bonus through the shared placement evaluation and returns a legal action",()=>{
 const {game}=fortressFixture();const a=chooseComputerAction(game);assert.ok(a.ok);assert.ok(a.value.type==="use-die"&&a.value.intent.kind==="place-tile"&&a.value.intent.tileId==="fortress-last");assert.ok(applyCoreAction(game,a.value).ok);
});

test("AI fortress games finish25 rounds for2–4 seats",()=>{
 for(const n of [2,3,4]){let g=createPracticeSession({names:Array.from({length:n},(_,i)=>`P${i}`),seed:`fortress-full-${n}`,officialSlots:true,boardIds:Array(n).fill("se:border-posts:23")});let steps=0;const rounds=new Set<string>();while(g.status!=="finished"){assert.ok(++steps<1500);rounds.add(`${g.turn.phase}:${g.turn.round}`);const a=chooseComputerAction(g);assert.ok(a.ok);const next=applyCoreAction(g,a.value);assert.ok(next.ok);g=next.value.state;}assert.equal(rounds.size,25);assert.deepEqual(roundtrip(g),g);}
});
