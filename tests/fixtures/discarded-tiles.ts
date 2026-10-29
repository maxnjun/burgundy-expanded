import {createPracticeSession} from '../../src/game/practice';
import {applyCoreAction} from '../../src/game/core';
import type {GameAction,GameState} from '../../src/game/types';
import {boundary} from './shields';

export function discardStep(g:GameState,a:GameAction):GameState{
 const r=applyCoreAction(g,a);if(!r.ok)throw Error(JSON.stringify(r.issues));return r.value.state;
}
/** Conserved public pool: one real purchase, prior removals, two buildings and one monastery left. */
export function discardBoundary(keep=3,extensions=false):GameState{
 let g=createPracticeSession({names:['기록1','기록2'],seed:'phase-discards',officialSlots:true,boardIds:['se:base:2','se:base:2'],inns:extensions,vineyards:extensions});
 g={...g,players:g.players.map((p,i)=>i?p:{...p,silver:4})};
 g=discardStep(g,{type:'roll-round',playerId:'seat-1'});
 g=discardStep(g,{type:'buy-black-tile',playerId:'seat-1',tileId:g.market.blackDepot.find((id):id is string=>id!==null)!,storageSlot:0});
 g=boundary(g);
 const publicIds=[...g.market.numberedDepots.flatMap(d=>d.slots.flatMap(s=>s.tileId?[s.tileId]:[])),...g.market.blackDepot.filter((id):id is string=>id!==null)];
 const candidates=[...publicIds.filter(id=>g.tiles[id].type==='building').slice(0,2),...publicIds.filter(id=>g.tiles[id].type==='monastery').slice(0,1)];
 if(candidates.length!==3)throw Error('Discard gallery needs two buildings and one monastery');
 const left=new Set(candidates.slice(0,keep));
 return {...g,market:{...g.market,removedTileIds:[...g.market.removedTileIds,...publicIds.filter(id=>!left.has(id))],numberedDepots:g.market.numberedDepots.map(d=>({...d,slots:d.slots.map(s=>({...s,tileId:s.tileId&&left.has(s.tileId)?s.tileId:null}))})),blackDepot:g.market.blackDepot.map(id=>id&&left.has(id)?id:null)}};
}
