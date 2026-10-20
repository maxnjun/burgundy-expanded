import {discardStored} from '../../src/game/vineyards';
import {createPracticeSession} from '../../src/game/practice';
import {applyCoreAction,listCoreActionOptions} from '../../src/game/core';
import type {GameState,GameAction} from '../../src/game/types';
function fixtureStep(g:GameState,a:GameAction):GameState {const r=applyCoreAction(g,a);if(!r.ok)throw new Error(JSON.stringify(r.issues));return r.value.state;}
export function vineFixture():GameState{let g=createPracticeSession({names:['포도1','포도2'],seed:'vine-test',vineyards:true,officialSlots:true,fullEffects:true});g=fixtureStep(g,{type:'roll-round',playerId:'seat-1'});return {...g,players:g.players.map(p=>({...p,workers:30,silver:10})),dice:{...g.dice,players:{...g.dice.players,'seat-1':[{...g.dice.players['seat-1'][0],value:1 as const},{...g.dice.players['seat-1'][1],value:4 as const}]}}};}
/** TEST FIXTURE: real validated transitions, increased resources for deterministic visual QA. */
export function plantedVineFixture():GameState {
 let g=vineFixture();const opts=()=>{const r=listCoreActionOptions(g,'seat-1');if(!r.ok)throw new Error('fixture');return r.value.actions;};
 g=fixtureStep(g,opts().find(a=>a.type==='use-die'&&a.intent.kind==='vineyard'&&a.intent.command==='take')!);
 g=fixtureStep(g,opts().find(a=>a.type==='use-die'&&a.intent.kind==='vineyard'&&a.intent.command==='place'&&a.intent.slotId==='V01')!);
 let limit=0;while(g.turn.pendingChoice){if(limit++>20)throw new Error('fixture loop');g=fixtureStep(g,opts().find(a=>a.type==='resolve-choice'&&a.optionId==='skip')??opts().find(a=>a.type==='resolve-choice')!);}
 return g;
}

/** TEST FIXTURE: conserved tile pool, actual validated actions; optional stop at first layer token choice. */
export function layeredVineFixture(stopAtToken=false,tokenLayer=1):GameState {
 let g=vineFixture();for(const slotId of stopAtToken&&tokenLayer===1?['V01','V02']:['V01','V02','V04','V03','V08','V07','V11']){
 const p=g.players[0];g=discardStored(g,p.id,[...p.storage.filter((x):x is string=>!!x),...(p.vineyardReserve??[]).map(x=>x.tileId)]);const id=g.vineyards!.bag[0];g={...g,vineyards:{...g.vineyards!,bag:g.vineyards!.bag.slice(1)},players:g.players.map((p,i)=>i?p:{...p,workers:50,vineyardReserve:[{tileId:id,keys:[0,1]}]}),dice:{...g.dice,players:{...g.dice.players,[p.id]:[{...g.dice.players[p.id][0],used:false},{...g.dice.players[p.id][1],used:false}]}}};
 const opts=()=>{const r=listCoreActionOptions(g,p.id);if(!r.ok)throw new Error(JSON.stringify(r));return r.value.actions;};const a=opts().find(a=>a.type==='use-die'&&a.intent.kind==='vineyard'&&a.intent.slotId===slotId);if(!a)throw new Error('fixture placement '+slotId);g=fixtureStep(g,a);
 let guard=0;while(g.turn.pendingChoice){if(stopAtToken&&(g.turn.pendingEffects[0]?.payload as {vineChoice?:string;layer?:number}).vineChoice==='token'&&(g.turn.pendingEffects[0]?.payload as {layer?:number}).layer===tokenLayer)return g;if(++guard>40)throw new Error('layer fixture loop');g=fixtureStep(g,opts().find(a=>a.type==='resolve-choice'&&a.optionId==='skip')??opts().find(a=>a.type==='resolve-choice'&&a.optionId.includes('take-workers'))??opts().find(a=>a.type==='resolve-choice')!);}
 }return g;
}
