import {createPracticeSession} from '../../src/game/practice';
import {applyCoreAction,validateCoreState} from '../../src/game/core';
import type {TestState} from '../core/fixture';

/** QA only: conserved real tile pool with monastery 6 already owned and resources for purchases. */
export function monasterySixFixture(count:2|3|4=2):TestState{
 const initial=createPracticeSession({names:Array.from({length:count},(_,i)=>`수도원${i+1}`),seed:`monastery-six-${count}`,officialSlots:true,fullEffects:true,vineyards:true,inns:true});
 const rolled=applyCoreAction(initial,{type:'roll-round',playerId:'seat-1'});if(!rolled.ok)throw new Error(JSON.stringify(rolled.issues));
 const s=structuredClone(rolled.value.state) as TestState,monk=Object.values(s.tiles).find(t=>t.type==='monastery'&&t.number===6)!;
 for(const d of s.market.numberedDepots)for(const slot of d.slots)if(slot.tileId===monk.id)slot.tileId=null;
 s.market.blackDepot=s.market.blackDepot.map(id=>id===monk.id?null:id);
 for(const pool of s.market.supplyPools)pool.remainingTileIds=pool.remainingTileIds.filter(id=>id!==monk.id);
 s.market.removedTileIds=s.market.removedTileIds.filter(id=>id!==monk.id);
 s.players[0].duchy.cells.find(c=>c.terrain==='monastery'&&!c.tileId)!.tileId=monk.id;
 for(const type of ['building','castle','mine','ship','livestock','monastery'] as const){
  if(s.market.numberedDepots.some(d=>d.slots.some(slot=>slot.tileId&&s.tiles[slot.tileId].type===type)))continue;
  const slot=s.market.numberedDepots.flatMap(d=>d.slots).find(slot=>slot.requiredType===type)!;
  const pool=s.market.supplyPools.find(p=>p.remainingTileIds.some(id=>s.tiles[id].type===type))!,id=pool.remainingTileIds.find(id=>s.tiles[id].type===type)!;
  if(slot.tileId)s.market.removedTileIds.push(slot.tileId);slot.tileId=id;pool.remainingTileIds=pool.remainingTileIds.filter(x=>x!==id);
 }
 for(const p of s.players){p.workers=6;p.silver=6;}
 const valid=validateCoreState(s);if(!valid.valid)throw new Error(JSON.stringify(valid.issues));return s;
}
