import {deriveRegions} from '../boards/regions';
import {hasShield} from '../shields';
import type {GameState,HexCell,PlayerState,ScoreEntry,TileType} from '../types';
import {monasteryNumbers} from './state';
import {PHASE_COMPLETION_POINTS} from './fortress-lines';

export const TERRAIN_NAMES:Readonly<Record<TileType,string>>={
 castle:'성',mine:'광산',ship:'선박',livestock:'목초지',building:'건물',monastery:'수도원',
};
export type RecolorTarget={cellId:string;terrain:TileType};
const source={document:'project-user-rule' as const,pages:[],section:'수도원 31번 · 영지 색상 변경'};
const scoredRegion=(e:ScoreEntry)=>e.category==='region-size'||e.category==='phase-bonus';

export function recoloredRegions<C extends Pick<HexCell,'id'|'coord'|'terrain'|'number'|'regionId'>>(cells:readonly C[],target:RecolorTarget):C[]{
 const modified=cells.map(c=>c.id===target.cellId?{...c,terrain:target.terrain}:c);
 const previous=new Map<string,string[]>();
 for(const c of cells){const group=previous.get(c.regionId)??[];group.push(c.id);previous.set(c.regionId,group);}
 const beforeByCell=new Map(cells.map(c=>[c.id,c]));
 const regions=deriveRegions(modified);
 const ids=new Map(regions.flatMap(r=>{
  const old=beforeByCell.get(r.cellIds[0])!;
  const stable=old.terrain===r.terrain&&r.cellIds.length===previous.get(old.regionId)!.length&&
   r.cellIds.every(id=>beforeByCell.get(id)?.regionId===old.regionId);
  const id=stable?old.regionId:`monastery31:${r.cellIds[0]}`;
  return r.cellIds.map(cellId=>[cellId,id] as const);
 }));
 return modified.map(c=>({...c,regionId:ids.get(c.id)!}));
}

export function regionPoints(state:GameState,player:PlayerState,region:readonly HexCell[]){
 const size=region.length+Number(region.some(c=>c.tileId&&state.tiles[c.tileId]?.type==='inn'))+Number(hasShield(state,player.id,17));
 return size*(size+1)/2;
}

export function colorCompletion(state:GameState,player:PlayerState,cells:readonly HexCell[],terrain:TileType){
 const color=cells.filter(c=>c.terrain===terrain);
 if(!color.length||color.some(c=>!c.tileId)||player.duchy.completedColors.includes(terrain))return null;
 const bonus=state.market.bonusTiles.filter(b=>b.color===terrain).sort((a,b)=>Number(a.rank==='second')-Number(b.rank==='second'))[0];
 return {bonus,points:(bonus?.points??0)*(hasShield(state,player.id,7)?2:1)};
}

export function recolorTargets(state:GameState,player:PlayerState):RecolorTarget[]{
 if(!state.config.customRules||player.duchy.recoloredCell||!monasteryNumbers(state,player).includes(31))return [];
 return player.duchy.cells.filter(c=>c.tileId===null).flatMap(c=>(Object.keys(TERRAIN_NAMES) as TileType[])
  .filter(terrain=>terrain!==c.terrain).map(terrain=>({cellId:c.id,terrain})));
}

export function previewRecolor(state:GameState,player:PlayerState,target:RecolorTarget){
 const cells=recoloredRegions(player.duchy.cells,target),old=player.duchy.cells.find(c=>c.id===target.cellId)!;
 const group=cells.find(c=>c.id===target.cellId)!.regionId;
 const connected=cells.filter(c=>c.regionId===group);
 const previous=player.duchy.cells,oldIds=new Set(connected.flatMap(c=>c.id===old.id?[]:[previous.find(o=>o.id===c.id)!.regionId]));
 const previousSize=(id:string)=>previous.filter(c=>c.regionId===id).length;
 const sourceCells=cells.filter(c=>c.id!==old.id&&previous.find(o=>o.id===c.id)?.regionId===old.regionId);
 const sourceAfter=[...new Set(sourceCells.map(c=>c.regionId))].map(id=>sourceCells.filter(c=>c.regionId===id).length);
 const reopened=player.duchy.completedRegionIds.filter(id=>oldIds.has(id));
 const ledger=state.scoreLedger[player.id];
 const refunded=new Set(ledger.flatMap(e=>e.reversalOf?[e.reversalOf]:[]));
 const refunds=ledger.filter(e=>scoredRegion(e)&&e.regionId&&reopened.includes(e.regionId)&&!refunded.has(e.id));
 return {
  cells,old,connected,reopened,refunds,points:refunds.reduce((n,e)=>n+e.points,0),
  previousSizes:[...oldIds].map(previousSize),reopenedSizes:reopened.map(previousSize),sourceAfter,sourceSize:previousSize(old.regionId),
 };
}

export function applyRecolor(state:GameState,player:PlayerState,target:RecolorTarget):GameState{
 const {cells,old,refunds}=previewRecolor(state,player,target);
 const completed=player.duchy.completedRegionIds.filter(id=>cells.some(c=>c.regionId===id));
 const entries:ScoreEntry[]=refunds.map(e=>({id:`refund:${e.id}`,category:'region-refund',points:-e.points,regionId:e.regionId,reversalOf:e.id,source}));
 const finished=new Set(completed);
 for(const region of deriveRegions(cells)){
  if(!region.id.startsWith('monastery31:')||finished.has(region.id)||region.cellIds.some(id=>!cells.find(c=>c.id===id)?.tileId))continue;
  finished.add(region.id);
  const id=`recolor:${state.revision+1}:${region.id}`;
  entries.push({id:`${id}:size`,category:'region-size',points:regionPoints(state,player,cells.filter(c=>c.regionId===region.id)),regionId:region.id,source},
   {id:`${id}:phase`,category:'phase-bonus',points:PHASE_COMPLETION_POINTS[state.turn.phase],regionId:region.id,source});
 }
 const color=colorCompletion(state,player,cells,old.terrain);
 if(color?.bonus)entries.push({id:`recolor:${state.revision+1}:color`,category:'color-bonus',points:color.points,source});
 const updated:PlayerState={...player,duchy:{...player.duchy,cells,recoloredCell:target,completedRegionIds:[...finished],
  completedColors:color?[...player.duchy.completedColors,old.terrain]:player.duchy.completedColors},
  bonuses:color?.bonus?[...player.bonuses,color.bonus]:player.bonuses,
  victoryPoints:player.victoryPoints+entries.reduce((n,e)=>n+e.points,0)};
 return {...state,players:state.players.map(p=>p.id===player.id?updated:p),
  market:color?.bonus?{...state.market,bonusTiles:state.market.bonusTiles.filter(b=>b.id!==color.bonus!.id)}:state.market,
  scoreLedger:{...state.scoreLedger,[player.id]:[...state.scoreLedger[player.id],...entries]}};
}

export function validEarnedEntries(entries:readonly ScoreEntry[],recolored:boolean){
 const originals=new Map<string,ScoreEntry>(),refunds=new Set<string>();
 for(const e of entries){
  if(!Number.isSafeInteger(e.points))return false;
  if(e.category==='region-refund'){
   const old=e.reversalOf&&originals.get(e.reversalOf);
   if(!recolored||!old||refunds.has(old.id)||old.points!==-e.points||old.regionId!==e.regionId)return false;
   refunds.add(old.id);
  }else{
   if(e.points<0||e.reversalOf!==undefined)return false;
   if(scoredRegion(e))originals.set(e.id,e);
  }
 }
 return true;
}
