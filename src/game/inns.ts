import type { GameState, Phase } from "./types";

export const INN_PHASES: readonly Phase[] = ["A","B","C","D","E"];
export const innId = (phase: Phase) => `project:inn:${phase}`;
export const innsEnabled = (state: Pick<GameState,"config">) => state.config.extensions.some(e=>e.id==="inns");
/** User-confirmed project rule. Pure and idempotent; unclaimed inns carry over. */
export function supplyInn(state: GameState, phase: Phase): GameState {
  if (!innsEnabled(state)) return state;
  const supply = state.market.inns ?? { suppliedPhases: [], stack: [] };
  if (supply.suppliedPhases.includes(phase)) return state;
  const id = innId(phase);
  if (state.tiles[id]) throw new Error("Inn tile ID collision");
  return {...state,tiles:{...state.tiles,[id]:{id,type:"inn",back:"black"}},market:{...state.market,inns:{suppliedPhases:[...supply.suppliedPhases,phase],stack:[...supply.stack,id]}}};
}
export function validInns(state: GameState): boolean {
  const supply=state.market.inns, tiles=Object.values(state.tiles).filter(t=>t.type==="inn");
  if(!innsEnabled(state))return supply===undefined && tiles.length===0;
  if(!supply || !Array.isArray(supply.stack) || !Array.isArray(supply.suppliedPhases))return false;
  const phases=INN_PHASES.slice(0,INN_PHASES.indexOf(state.turn.phase)+1);
  if(supply.suppliedPhases.length!==phases.length || phases.some((p,i)=>supply.suppliedPhases[i]!==p) || tiles.length!==phases.length || tiles.some(t=>t.back!=="black"||!phases.some(p=>innId(p)===t.id)))return false;
  if(new Set(supply.stack).size!==supply.stack.length || supply.stack.some(id=>state.tiles[id]?.type!=="inn"))return false;
  if(supply.stack.some((id,i)=>i>0&&phases.findIndex(p=>innId(p)===id)<=phases.findIndex(p=>innId(p)===supply.stack[i-1])))return false;
  if([...state.market.blackDepot,...state.market.supplyPools.flatMap(p=>p.remainingTileIds)].some(id=>id&&state.tiles[id]?.type==="inn"))return false;
  return state.players.every(p=>p.duchy.cells.every(c=>!c.tileId||state.tiles[c.tileId]?.type!=="inn"||p.duchy.cells.filter(n=>n.regionId===c.regionId&&n.tileId&&state.tiles[n.tileId]?.type==="inn").length===1));
}
/** The existing triangular size table extends explicitly to size10 (inn + shield17). */
export function regionSizePoints(size: number): number {
  if(!Number.isInteger(size)||size<1||size>10)throw new Error("Unsupported scoring region size");
  return size*(size+1)/2;
}
