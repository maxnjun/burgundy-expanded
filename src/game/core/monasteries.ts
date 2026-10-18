import type { BuildingType } from "../types";
/** Official PDF p.12 icons compared with the named building pictures on pp.8-9. */
export const MONASTERY_BUILDINGS: Readonly<Partial<Record<number, BuildingType>>> = Object.freeze({
    16: "warehouse", 17: "watchtower", 18: "carpenters-workshop", 19: "church",
    20: "market", 21: "boarding-house", 22: "bank", 23: "town-hall",
});


/** Monk27 always occupies the top of its stack, including passive arrivals. PDF p.13. */
export function prioritizeMonastery27(state:import("../types").GameState,track:import("../types").GameState["turn"]["orderTrack"]){
  const holders=new Set(state.players.filter(p=>p.duchy.cells.some(c=>{const t=c.tileId?state.tiles[c.tileId]:null;return t?.type==="monastery"&&t.number===27;})).map(p=>p.id));
  return track.map(space=>({...space,players:[...space.players.filter(id=>holders.has(id)),...space.players.filter(id=>!holders.has(id))]}));
}
