import type { ActionIntent, GameAction, GameState, PlayerState, Tile } from "./types";
import type { EngineResult } from "./interfaces";
import { listCoreActionOptions, orderedPlayers } from "./core";
import { areAxialNeighbors } from "./boards/axial";
import { resolvePlacement } from "./core/placement";

/** A project heuristic opponent, NOT the official Chateauma or solo rules.
 * Reads public board/market/player information only: no future pool, seed or RNG cursor.
 * Returns an engine-generated legal action without changing state or rolling future dice.
 */
export function chooseComputerAction(state: GameState, playerId = state.turn.activePlayerId ?? orderedPlayers(state)[0]): EngineResult<GameAction> {
  const options = listCoreActionOptions(state, playerId);
  if (!options.ok) return options;
  const player = state.players.find(p => p.id === playerId)!;
  const choices = options.value.actions;
  if (!choices.length) return { ok: false, issues: [{ code: "illegal-action", message: "No legal computer action in this state" }] };
  const value = (action: GameAction): number => {
    if (action.type === "roll-round" || action.type === "advance-phase") return 10000;
    if (action.type === "end-turn") return -100;
    if (action.type === "buy-workers") return player.workers<2?10:-190;
    if (action.type === "resolve-choice") {
      const payload = state.turn.pendingChoice?.options.find(o => o.id === action.optionId)?.payload as { intent?: ActionIntent; goodsIds?: string[] } | null;
      return payload?.intent ? intentValue(state, player, payload.intent) : action.optionId === "skip" ? -200 : 10 + (payload?.goodsIds?.length ?? 0)*3;
    }
    if (action.type === "use-die") return intentValue(state, player, action.intent) - action.adjustment.workersSpent * 2;
    if (action.type === "buy-black-tile" || action.type === "use-monastery-six") {
      if (action.discardTileId || !player.storage.includes(null)) return -180;
      return acquisitionValue(state, player, state.tiles[action.tileId]) - (action.type === "buy-black-tile" ? 8 : 5);
    }
    return -300;
  };
  let best = choices[0], bestValue = value(best);
  for (const action of choices.slice(1)) {
    const rank = value(action);
    if (rank > bestValue) { best = action; bestValue = rank; }
  }
  return { ok: true, value: best };
}

function acquisitionValue(state: GameState, player: PlayerState, tile: Tile): number {
  const possible = player.duchy.cells.filter(c => c.tileId === null && c.terrain === tile.type &&
    player.duchy.cells.some(n => n.tileId !== null && areAxialNeighbors(c.coord,n.coord)) &&
    (tile.type !== "building" || !player.duchy.cells.some(n => {
      const placed = n.tileId ? state.tiles[n.tileId] : null;
      return n.regionId === c.regionId && placed?.type === "building" && placed.building === tile.building;
    })));
  if (!possible.length) return -30;
  const same = player.storage.filter(id => id && state.tiles[id].type === tile.type).length;
  return 15 + Math.min(possible.length,3) - same*9 + (tile.type === "castle" ? 4 : tile.type === "mine" ? 3 : 0);
}

function intentValue(state: GameState, player: PlayerState, intent: ActionIntent): number {
  if (intent.kind === "place-tile") {
    const placed = resolvePlacement(state,player,intent.tileId,intent.cellId);
    return 35 + placed.entries.reduce((sum,e)=>sum+e.points,0)*2 + (placed.player.silver-player.silver)*3 + (placed.player.workers-player.workers);
  }
  if (intent.kind === "sell-goods") return 8 + (player.goods.find(g=>g.type===intent.goodsType)?.tiles.length??0)*state.config.playerCount*2;
  if (intent.kind === "take-workers") return player.workers < 2 ? 12 : player.workers < 5 ? 2 : -10;
  return intent.discardTileId ? -150 : acquisitionValue(state,player,state.tiles[intent.tileId]);
}
