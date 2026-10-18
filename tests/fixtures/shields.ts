import assert from "node:assert/strict";
import { createPracticeSession } from "../../src/game/practice";
import { applyCoreAction } from "../../src/game/core/engine";
import { validateCoreState, orderedPlayers } from "../../src/game/core/state";
import { settleShieldState } from "../../src/game/core/shield-effects";
import { shieldLayout, setShieldLayout } from "../../src/game/shields";
import { serializeSavedGame, parseSavedGame } from "../../src/game/save";
import type { GameState, Tile, GameAction } from "../../src/game/types";
/** TEST FIXTURE: inject physical tiles/dice/shields into known board geometry, never an official setup. */
export function setup(count=2):GameState {const g=createPracticeSession({names:["규칙A","규칙B","규칙C","규칙D"].slice(0,count),boardIds:Array(count).fill("se:base:2"),seed:"shield-rules-fixture",officialSlots:true,additionalHexes:true,shieldRules:true});const r=applyCoreAction(g,{type:"roll-round",playerId:"seat-1"});assert.ok(r.ok);return {...r.value.state,players:r.value.state.players.map(p=>({...p,workers:30,silver:30}))};}
export function step(g:GameState,a:GameAction):GameState {const r=applyCoreAction(g,a);assert.ok(r.ok,r.ok?"":JSON.stringify(r.issues));assert.ok(validateCoreState(r.value.state).valid);return r.value.state;}
let serial=0;
export function placed(g:GameState,index:number,tile:Omit<Tile,"id">,cellId?:string):GameState {
  const p=g.players[index],cell=p.duchy.cells.find(c=>c.tileId===null&&(cellId?c.id===cellId:c.terrain===tile.type));assert.ok(cell,"fixture space");const id=`shield-fixture:${serial++}`;return {...g,tiles:{...g.tiles,[id]:{...tile,id} as Tile},players:g.players.map((p,i)=>i===index?{...p,duchy:{...p.duchy,cells:p.duchy.cells.map(c=>c.id===cell.id?{...c,tileId:id}:c)}}:p)};
}
export function mount(g:GameState,n:number,index=0):GameState {
  let layout=shieldLayout(g)!;const owner=g.players[index];let cell=owner.duchy.cells.find(c=>c.tileId&&g.tiles[c.tileId].type==="castle"&&!layout.mounted.some(m=>m.playerId===owner.id&&m.cellId===c.id));
  if(!cell){g=placed(g,index,{type:"castle",back:"matching-color"});layout=shieldLayout(g)!;cell=g.players[index].duchy.cells.find(c=>c.tileId&&g.tiles[c.tileId].type==="castle"&&!layout.mounted.some(m=>m.playerId===owner.id&&m.cellId===c.id));}assert.ok(cell);
  let slots=[...layout.slots],boxed=[...layout.boxed];const source=slots.find(s=>s.shieldNumber===n);
  if(source)slots=slots.map(s=>s.id===source.id?{...s,shieldNumber:null}:s);else{assert.ok(boxed.includes(n));const slot=slots.find(s=>s.shieldNumber!==null)!;boxed=boxed.filter(x=>x!==n);boxed.push(slot.shieldNumber!);slots=slots.map(s=>s.id===slot.id?{...s,shieldNumber:null}:s);}
  return settleShieldState(setShieldLayout(g,{...layout,slots,boxed,mounted:[...layout.mounted,{shieldNumber:n,playerId:owner.id,cellId:cell.id,castleTileId:cell.tileId!}]}));
}
export function stash(g:GameState,tile:Omit<Tile,"id">):{g:GameState;id:string}{const id=`shield-stash:${serial++}`,i=g.players[0].storage.indexOf(null);assert.ok(i>=0);return {id,g:{...g,tiles:{...g.tiles,[id]:{...tile,id} as Tile},players:g.players.map((p,k)=>k===0?{...p,storage:p.storage.map((s,k)=>k===i?id:s)}:p)}};}
export function choose(g:GameState,match:(o:NonNullable<GameState["turn"]["pendingChoice"]>["options"][number])=>boolean):GameState {const c=g.turn.pendingChoice;assert.ok(c);const o=c.options.find(match);assert.ok(o,`missing option ${c.options.map(o=>o.id)}`);return step(g,{type:"resolve-choice",playerId:c.playerId,choiceId:c.id,optionId:o.id});}
export function boundary(g:GameState):GameState{return {...g,market:{...g.market,roundGoods:[],numberedDepots:g.market.numberedDepots.map((d,i)=>i===0?{...d,goods:[...d.goods,...g.market.roundGoods]}:d)},dice:{...g.dice,rolledForRound:false,roundGoodsDistributed:false,whiteDie:null},turn:{...g.turn,round:5,stage:"phase-end",activePlayerId:null,pendingChoice:null,pendingEffects:[],actedPlayerIds:[]}};}
export function startPhase(g:GameState){return step(boundary(g),{type:"advance-phase",playerId:orderedPlayers(g)[0]});}
export function roundtrip(g:GameState){return parseSavedGame(serializeSavedGame({format:"burgundy-local-v1",randomAlgorithm:"counter-v1",game:g,logs:[],view:{zoom:1,focus:false,table:true,boardZooms:{}}})).game;}
