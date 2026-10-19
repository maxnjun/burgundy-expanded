import { test } from "node:test";
import assert from "node:assert/strict";
import { whiteFixture, placeWhite, act, choice, placed, practicePending } from "../fixtures/white-castles";
import { applyCoreAction, finalScore, validateCoreState } from "../../src/game/core";
import { createPracticeSession } from "../../src/game/practice";
import { parseSavedGame, serializeSavedGame } from "../../src/game/save";
import { chooseComputerAction } from "../../src/game/computer";
import { placementIssue } from "../../src/game/core/placement";
import type { GameState, Tile } from "../../src/game/types";
import { setup, mount, placed as placeFixture, boundary, step } from "../fixtures/shields";

const roundtrip = (game: GameState) => parseSavedGame(serializeSavedGame({ format: "burgundy-local-v1", randomAlgorithm: "counter-v1", game, logs: [], view: { zoom: 1, focus: false, boardZooms: {} } })).game;

test("optional white-castle set has six beige, two black and one yellow29; old saves stay unchanged", () => {
  for (const n of [2,3,4]) {
    const g = createPracticeSession({ names: Array.from({length:n},(_,i)=>`P${i}`), seed: "white-supply", officialSlots: true, whiteCastles: true });
    const whites = Object.values(g.tiles).filter(t=>t.type==="building"&&t.building==="white-castle");
    assert.equal(whites.length,8); assert.equal(whites.filter(t=>t.back==="black").length,2);
    assert.equal(Object.values(g.tiles).filter(t=>t.type==="monastery"&&t.number===29).length,1);
    assert.deepEqual(roundtrip(g),g);
    assert.equal(validateCoreState({...g,config:{...g.config,extensions:[]}}).valid,false);
  }
  const old=createPracticeSession({names:["A","B"],seed:"old"}); assert.deepEqual(roundtrip(old),old);
});

test("white castle is a town building, not a green castle; duplicate building restriction is retained",()=>{
  const s=whiteFixture(), p=s.players[0];
  assert.ok(placementIssue(s,p,"white","start",1));
  placed(s,{id:"existing",type:"building",building:"white-castle",back:"black"},2);
  p.duchy.cells.find(c=>c.id==="existing")!.regionId="town";
  assert.ok(placementIssue(s,p,"white","target",1));
});

test("white castles participate in initial phase-A supply for every seat count",()=>{
  for(const n of [2,3,4]){
    let seen=false;
    for(let seed=0;seed<20&&!seen;seed++){
      const g=createPracticeSession({names:Array.from({length:n},(_,i)=>`P${i}`),seed:`white-initial-${seed}`,officialSlots:true,whiteCastles:true});
      const ids=[...g.market.numberedDepots.flatMap(d=>d.slots.map(s=>s.tileId)),...g.market.blackDepot];
      seen=ids.some(id=>id?.startsWith("white-castle:"));
    }
    assert.ok(seen,`${n} seats: expansion must not be held back until phase B`);
  }
});

test("white die bonus uses zero/one/multiple workers and wraps1↔6 without changing any dice",()=>{
  for(const [white,goods,cost] of [[1,1,0],[6,1,1],[1,6,1],[4,1,3]] as const){
    const s=whiteFixture();s.dice.whiteDie=white;s.players[0].workers=cost;
    s.players[0].goods=[{type:goods,tiles:[{id:"test-sale",type:goods}]}];
    const pending=placeWhite(s), a=choice(pending,p=>p.intent?.kind==="sell-goods");
    assert.equal(JSON.parse((a as {optionId:string}).optionId).adjustment.workersSpent,cost);
    const before=structuredClone(pending),next=act(pending,a);
    assert.equal(next.players[0].workers,0);assert.equal(next.players[0].silver,pending.players[0].silver+1);
    assert.deepEqual(next.dice,pending.dice);assert.deepEqual(pending,before);assert.equal(next.turn.pendingChoice,null);
    assert.equal(applyCoreAction(next,a).ok,false);
  }
});

test("insufficient workers and forged free-white actions are rejected atomically; worker gain is ordinary",()=>{
  const s=whiteFixture();s.dice.whiteDie=6;s.players[0].workers=0;
  const pending=placeWhite(s);
  assert.ok(!pending.turn.pendingChoice!.options.some(o=>(o.payload as {intent?:{kind:string}})?.intent?.kind==="sell-goods"));
  const a=choice(pending,p=>p.intent?.kind==="take-workers"),before=structuredClone(pending);
  assert.equal(applyCoreAction(pending,{...a,optionId:'{"intent":{"kind":"sell-goods","goodsType":1},"adjustment":{"workersSpent":0,"steps":[]}}'} as typeof a).ok,false);
  assert.deepEqual(pending,before);assert.equal(act(pending,a).players[0].workers,2);
});

test("white bonus acquisition pays workers and stores exactly once",()=>{
  const s=whiteFixture();s.dice.whiteDie=6;
  const pending=placeWhite(s), next=act(pending,choice(pending,p=>p.intent?.kind==="take-tile"));
  assert.ok(next.players[0].storage.includes("mine"));assert.equal(next.players[0].workers,0);
  assert.equal(next.market.numberedDepots[0].slots[0].tileId,null);
});

test("monastery8/12 modifiers and monastery28 purchases refresh white action costs",()=>{
  const s=whiteFixture();s.dice.whiteDie=4;s.players[0].workers=1;
  placed(s,{id:"m8",type:"monastery",number:8,back:"matching-color"},0);
  let pending=placeWhite(s);
  assert.equal(pending.turn.pendingChoice!.options.filter(o=>(o.payload as {intent?:{kind:string}})?.intent?.kind==="sell-goods").length,1); // goods2 costs one, goods1 costs two
  const other=whiteFixture();other.dice.whiteDie=6;other.players[0].workers=0;
  placed(other,{id:"m12",type:"monastery",number:12,back:"matching-color"},0);
  pending=placeWhite(other);assert.ok(choice(pending,p=>p.intent?.kind==="take-tile"&&p.adjustment?.workersSpent===0));
  const buying=whiteFixture();buying.dice.whiteDie=6;buying.players[0].workers=0;
  placed(buying,{id:"m28",type:"monastery",number:28,back:"matching-color"},0);
  pending=placeWhite(buying);pending=act(pending,{type:"buy-workers",playerId:"p1"});
  assert.equal(act(pending,choice(pending,p=>p.intent?.kind==="sell-goods"&&p.intent.goodsType===1)).players[0].workers,1);
});

test("crane→white castle→town hall→bank chains consume each parent once",()=>{
  const s=whiteFixture();s.tiles.white={id:"white",type:"building",building:"crane",back:"black"};
  s.tiles.hall={id:"hall",type:"building",building:"town-hall",back:"matching-color"};s.players[0].storage[1]="hall";
  s.tiles.bank={id:"bank",type:"building",building:"bank",back:"matching-color"};s.players[0].storage[2]="bank";
  s.players[0].duchy.cells.push({id:"hall",coord:{q:2,r:0},terrain:"building",number:3,regionId:"town",tileId:null},{id:"bank",coord:{q:2,r:-1},terrain:"building",number:6,regionId:"town",tileId:null});
  let g=placeWhite(s);g=act(g,{type:"resolve-choice",playerId:"p1",choiceId:g.turn.pendingChoice!.id,optionId:"crane:white-castle"});
  const whiteWindow=structuredClone(g);g=act(whiteWindow,choice(whiteWindow,p=>p.intent?.kind==="place-tile"&&p.intent.tileId==="hall"));
  g=act(g,choice(g,p=>p.intent?.kind==="place-tile"&&p.intent.tileId==="bank"));
  assert.equal(g.players[0].silver,5);assert.equal(g.turn.pendingChoice,null);assert.equal(g.dice.players.p1[1].used,false);assert.equal(g.dice.whiteDie,3);
});

test("monastery29 scores placed whites only, including at most one building identity per crane",()=>{
  for(const count of [0,1,3]){
    const s=whiteFixture();placed(s,{id:"m29",type:"monastery",number:29,back:"matching-color"},4);
    for(let i=0;i<count;i++)placed(s,{id:`placed-white-${i}`,type:"building",building:"white-castle",back:"matching-color"},5+i);
    let result=finalScore(s,s.players[0]);assert.ok(result.ok);assert.equal(result.value.finalAdditions.find(e=>e.id.endsWith("monastery-29"))?.points,count*4);
    placed(s,{id:"crane",type:"building",building:"crane",back:"black"},10);placed(s,{id:"m16",type:"monastery",number:16,back:"matching-color"},11);
    result=finalScore(s,s.players[0]);assert.ok(result.ok);assert.equal(result.value.finalAdditions.find(e=>e.id.endsWith("crane-building"))?.points,4);
    assert.deepEqual(finalScore(s,s.players[0]),result);
  }
});

test("ordinary AI resolves a paid white-die action legally",()=>{
  const s=whiteFixture();s.dice.whiteDie=6;const pending=placeWhite(s),a=chooseComputerAction(pending);assert.ok(a.ok);
  assert.equal(a.value.type,"resolve-choice");assert.equal(validateCoreState(act(pending,a.value)).valid,true);
});

test("monastery29 and shield10 final scoring survives phase completion without duplication",()=>{
  let g=setup();g={...g,config:{...g.config,extensions:[...g.config.extensions,{id:"white-castles",options:{}}]}};
  g=mount(g,10);g=placeFixture(g,0,{type:"monastery",number:29,back:"matching-color"} as Tile);
  g=placeFixture(g,0,{type:"building",building:"white-castle",back:"matching-color"} as Tile);
  g=placeFixture(g,0,{type:"building",building:"crane",back:"black"} as Tile);
  g=boundary(g);g={...g,market:{...g.market,numberedDepots:g.market.numberedDepots.map((d,i)=>i?d:{...d,goods:[...d.goods,...Object.values(g.market.phaseGoods).flat()]}),phaseGoods:{A:[],B:[],C:[],D:[],E:[]}},turn:{...g.turn,phase:"E"}};
  // One mounted shield requires its phase upkeep before final scoring.
  for(let i=0;i<10&&g.status!=="finished";i++){
    const a=chooseComputerAction(g);assert.ok(a.ok);g=step(g,a.value);
  }
  assert.equal(g.status,"finished");const score=g.finalScores![0];
  assert.equal(score.finalAdditions.find(e=>e.id.endsWith("monastery-29"))?.points,8);
  assert.equal(score.finalAdditions.find(e=>e.id.endsWith("crane-building"))?.points,8);
  assert.deepEqual(finalScore(roundtrip(g),g.players[0]),{ok:true,value:score});
});

test("2–4 seat AI games with white castles and all existing extra/shield rules finish25 rounds",()=>{
  let whitesPlaced=0,whiteBonuses=0;
  for(const n of [2,3,4]){
    let g=createPracticeSession({names:Array.from({length:n},(_,i)=>`P${i}`),seed:`white-full-${n}`,officialSlots:true,boardIds:Array(n).fill("se:base:2"),whiteCastles:true,additionalHexes:true,shieldRules:true});
    const rounds=new Set<string>();let steps=0;
    while(g.status!=="finished"){
      assert.ok(++steps<1800);rounds.add(`${g.turn.phase}:${g.turn.round}`);
      const a=chooseComputerAction(g);assert.ok(a.ok,JSON.stringify(a));
      if(a.value.type==="use-die"&&a.value.intent.kind==="place-tile"&&g.tiles[a.value.intent.tileId].type==="building"&&(g.tiles[a.value.intent.tileId] as {building:string}).building==="white-castle")whitesPlaced++;
      if(a.value.type==="resolve-choice"&&(g.turn.pendingEffects[0]?.payload as {kind?:string})?.kind==="white-castle")whiteBonuses++;
      g=act(g,a.value);
      if(steps%60===0)g=roundtrip(g);
    }
    assert.equal(rounds.size,25);assert.equal(g.finalScores?.length,n);assert.equal(validateCoreState(g).valid,true);
  }
  assert.ok(whitesPlaced>0,"AI must actually place a white castle");assert.ok(whiteBonuses>0,"AI must resolve its bonus");
});

 test("persisted white bonus resumes with the exact worker cost and rejects tampered options",()=>{
  const g=practicePending(), saved=roundtrip(g);assert.deepEqual(saved,g);
  const sale=choice(saved,p=>p.intent?.kind==="sell-goods");const next=act(saved,sale);
  assert.equal(next.players[0].workers,1);assert.equal(next.dice.whiteDie,6);assert.deepEqual(roundtrip(next),next);
  const forged=structuredClone(g) as import("./fixture").TestState;
  (forged.turn.pendingChoice!.options.find(o=>(o.payload as {intent?:{kind:string}})?.intent?.kind==="sell-goods")!.payload as {adjustment:{workersSpent:number}}).adjustment.workersSpent=0;
  assert.throws(()=>roundtrip(forged));
  assert.equal(applyCoreAction(forged,choice(forged,p=>p.intent?.kind==="sell-goods")).ok,false);
 });
