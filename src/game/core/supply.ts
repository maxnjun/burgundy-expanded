import type { GameState, Tile } from "../types";
import { drawDie } from "./random";

/** Shared uniform sampling without replacement. Caller commits the returned random state
 * and puts the selected ID in exactly one destination; input is never mutated.
 */
export function drawSupplyTile(state: Pick<GameState, "tiles" | "market" | "random">, back: Tile["back"], type?: Tile["type"]) {
  const eligible = state.market.supplyPools.flatMap(pool => pool.remainingTileIds.filter(id => state.tiles[id].back === back && (!type || state.tiles[id].type === type)));
  if (!eligible.length) throw new Error("Insufficient injected tile supply");
  let random = state.random, range: number, value: number;
  do {
    range = 1; value = 0;
    while (range < eligible.length) { const roll = drawDie(random); random = roll.random; range *= 6; value = value * 6 + roll.value - 1; }
  } while (value >= range - range % eligible.length);
  const tileId = eligible[value % eligible.length];
  return { tileId, random, market: { ...state.market, supplyPools: state.market.supplyPools.map(p => ({ ...p, remainingTileIds: p.remainingTileIds.filter(id => id !== tileId) })) } };
}
