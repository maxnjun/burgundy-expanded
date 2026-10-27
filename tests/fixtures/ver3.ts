import {setup,placed,mount} from './shields';
import {layeredVineFixture} from './vineyards';
import {prepareTileEffect,immediateOptions} from '../../src/game/core/effects';
import {applyCoreAction} from '../../src/game/core/engine';
import {createShieldLayout} from '../../src/game/shields';
import type {GameState,Tile} from '../../src/game/types';

/** TEST FIXTURE: physical tiles on registered boards and canonical pending reward menus. */
export function bonusShieldFixture(kind:'castle'|'white-castle'|'vine'='castle'):GameState {
 let g=setup();
 if(kind==='vine'){
  g=layeredVineFixture();const shield=createShieldLayout(2,g.random,true);
  g={...g,random:shield.random,config:{...g.config,extensions:[...g.config.extensions,{id:'shields',options:{rules:true}}]},extensionStates:{...g.extensionStates,shields:shield.layout as unknown as import('../../src/game/types').JsonValue}};
  const id='vine-benefit:seat-1:V04:1',source={document:'project-user-rule' as const,pages:[],section:'포도밭 · 프로젝트 복원판 v0.1'};
  g={...g,vineyards:{...g.vineyards!,stack:[{playerId:'seat-1',slotId:'V04',active:1}]},turn:{...g.turn,pendingEffects:[{id,playerId:'seat-1',kind:'tile-benefit',source,payload:{kind:'castle',vineRewardId:id}}],pendingChoice:{id,playerId:'seat-1',source,options:[]}}};
 }else{
  if(kind==='white-castle')g={...g,config:{...g.config,extensions:[...g.config.extensions,{id:'white-castles',options:{}}]}};
  g=placed(g,0,(kind==='castle'?{type:'castle',back:'matching-color'}:{type:'building',building:'white-castle',back:'black'}) as Tile);
  const id=g.players[0].duchy.cells.filter(c=>c.tileId&&(kind==='castle'?g.tiles[c.tileId].type==='castle':g.tiles[c.tileId].type==='building')).at(-1)!.tileId!;
  g=prepareTileEffect(g,'seat-1',id);
 }
 g={...g,revision:g.revision+1,dice:{...g.dice,whiteDie:3,players:{...g.dice.players,'seat-1':[{...g.dice.players['seat-1'][0],used:true,value:2},{...g.dice.players['seat-1'][1],used:false,value:4}]}}};
 return {...g,turn:{...g.turn,pendingChoice:{...g.turn.pendingChoice!,options:immediateOptions(g,g.players[0],kind==='white-castle'?'white-castle':'castle')}}};
}

export function shieldFiveFixture():GameState {
 let g=placed(mount(setup(),5),0,{type:'ship',back:'matching-color'});
 const id=g.players[0].duchy.cells.filter(c=>c.tileId&&g.tiles[c.tileId].type==='ship').at(-1)!.tileId!;
 g={...g,players:g.players.map((p,i)=>i?p:{...p,goods:[{type:1,tiles:[{id:'held1',type:1}]},{type:2,tiles:[{id:'held2',type:2}]}]}),market:{...g.market,numberedDepots:g.market.numberedDepots.map(d=>({...d,goods:[{id:`type1:${d.number}`,type:1},{id:`type4:${d.number}`,type:4}]}))}};
 g=prepareTileEffect(g,'seat-1',id);
 // Resolve the real ship acquisition, leaving shield5's canonical extra-goods choice.
 const action={type:'resolve-choice' as const,playerId:'seat-1',choiceId:g.turn.pendingChoice!.id,optionId:g.turn.pendingChoice!.options.find(o=>o.id.startsWith('depot:1:'))!.id};
 const next=applyCoreAction(g,action);if(!next.ok)throw Error(JSON.stringify(next));return next.value.state;
}
