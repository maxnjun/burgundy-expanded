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
