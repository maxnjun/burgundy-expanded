import {vineScore,VINE_SLOTS,VINE_TILES,GRAPES,type VineyardState,type VineIntent} from "./vineyards";
import type { ActionIntent, GameAction, GameState, PlayerState, Tile } from "./types";
import type { EngineResult } from "./interfaces";
import { listCoreActionOptions, orderedPlayers } from "./core";
import { areAxialNeighbors } from "./boards/axial";
import { shieldLayout, hasShield } from "./shields";
import { monasteryNumbers } from "./core/state";
import { goodsSaleReward } from "./core/intents";
import { shieldChoiceValue, shieldExtensionValue } from "./computer-shields";
import {customTradeSpaces} from "./custom-trade-routes";
import { resolvePlacement } from "./core/placement";

/** A project heuristic opponent, NOT the official Chateauma or solo rules.
 * Reads public board/market/player information only: no future pool, seed or RNG cursor.
 * Returns an engine-generated legal action without changing state or rolling future dice.
 */
export function chooseComputerAction(state: GameState, playerId = state.turn.activePlayerId ?? orderedPlayers(state)[0]): EngineResult<GameAction> {
  if(state.config.extensions.some(e=>e.id==="shields")&&!shieldLayout(state)?.effectsActive)return {ok:false,issues:[{code:"unsupported-extension",message:"Legacy shield preview has no active AI rules"}]};
  const options = listCoreActionOptions(state, playerId);
  if (!options.ok) return options;
  const player = state.players.find(p => p.id === playerId)!;
  const choices = options.value.actions;
  if (!choices.length) return { ok: false, issues: [{ code: "illegal-action", message: "No legal computer action in this state" }] };
  const value = (action: GameAction): number => {
    if (action.type === "roll-round" || action.type === "advance-phase") return 10000;
    if (action.type === "end-turn") return -100;
    if (action.type === "buy-workers") return player.workers<2?10:-190;
    if(action.type==="extension"&&action.extensionId==="shields")return shieldExtensionValue(state,player,action);
    if(action.type==="extension"&&action.extensionId==="vineyards")return (action.payload as unknown as VineIntent).discardIds?.length?-180:16;
    if (action.type === "resolve-choice") {
      if(action.optionId.startsWith("vine-token:")&&state.vineyards){const v=state.vineyards,g=action.optionId.slice(11) as typeof GRAPES[number],own=v.players[player.id];return 10+vineScore({...v,players:{...v.players,[player.id]:{...own,tokens:[...own.tokens,g]}}},player.id)-vineScore(v,player.id)+own.placed.reduce((n,p)=>n+VINE_TILES[p.tileId].filter(x=>x===g).length,0)*.1;}
      const special=shieldChoiceValue(state,player,action.optionId);if(special!==null)return special;
      const payload = state.turn.pendingChoice?.options.find(o => o.id === action.optionId)?.payload as { intent?: ActionIntent; adjustment?: { workersSpent: number }; goodsIds?: string[] } | null;
      return payload?.intent ? intentValue(state, player, payload.intent) - (payload.adjustment?.workersSpent ?? 0)*2 : action.optionId === "skip" ? -200 : 10 + (payload?.goodsIds?.length ?? 0)*3;
    }
    if (action.type === "use-die") return intentValue(state, player, action.intent, true) - action.adjustment.workersSpent * 2;
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
  const possible = player.duchy.cells.filter(c => c.tileId === null && (tile.type === "inn" || c.terrain === tile.type) &&
    (tile.type !== "inn" || !player.duchy.cells.some(n=>n.regionId===c.regionId&&n.tileId&&state.tiles[n.tileId]?.type==="inn")) &&
    (hasShield(state,player.id,18)||player.duchy.cells.some(n => n.tileId !== null && areAxialNeighbors(c.coord,n.coord))) &&
    (tile.type !== "building" || monasteryNumbers(state,player).includes(1) || !player.duchy.cells.some(n => {
      const placed = n.tileId ? state.tiles[n.tileId] : null;
      return n.regionId === c.regionId && placed?.type === "building" && placed.building === tile.building;
    })));
  if (!possible.length) return -30;
  const same = player.storage.filter(id => id && state.tiles[id].type === tile.type).length;
  return (tile.type === "inn" ? 24 : 15) + Math.min(possible.length,3) - same*9 + (tile.type === "castle" ? 4 : tile.type === "mine" ? 3 : 0);
}

function intentValue(state: GameState, player: PlayerState, intent: ActionIntent,direct=false): number {
  if(intent.kind==="vineyard"){if(intent.command==="take")return intent.discardIds?.length?-160:25;const v=state.vineyards!,own=v.players[player.id],score=vineScore({...v,players:{...v.players,[player.id]:{...own,placed:[...own.placed,{slotId:intent.slotId!,tileId:intent.tileId,flipped:intent.flipped!,used:[]}]}}},player.id);const slot=VINE_SLOTS.find(s=>s.id===intent.slotId)!,remaining=VINE_SLOTS.filter(s=>s.layer===slot.layer&&!own.placed.some(p=>p.slotId===s.id)).length;const projected={...v,players:{...v.players,[player.id]:{...own,placed:[...own.placed,{slotId:intent.slotId!,tileId:intent.tileId,flipped:intent.flipped!,used:[]}]}}};return 48+score-vineScore(v,player.id)+(!own.layers.includes(slot.layer)?(4+vineTokenPotential(projected,player.id))/remaining:0);}
  if (intent.kind === "place-tile") {
    const placed = resolvePlacement(state,player,intent.tileId,intent.cellId);
    return 35 + placed.entries.reduce((sum,e)=>sum+e.points,0)*2 + (placed.player.silver-player.silver)*3 + (placed.player.workers-player.workers);
  }
  if (intent.kind === "sell-goods") {const reward=goodsSaleReward(state,player,player.goods.find(g=>g.type===intent.goodsType)?.tiles.length??0);const route=state.tradeRoutes?.routes[player.id],next=route?customTradeSpaces(route)[route.sales.length]:null;const bonus=direct&&next?.goodsType===intent.goodsType?({warehouse:8,"carpenters-workshop":9,church:9,market:9,"boarding-house":8,bank:6,"town-hall":10,watchtower:8,"white-castle":12}[next.bonusId]??0):0;return 8+reward.points*2+reward.silver*2+bonus;}
  if (intent.kind === "take-workers") {const fees=shieldLayout(state)?.mounted.filter(m=>m.playerId===player.id).length??0;return hasShield(state,player.id,3)&&player.workers+player.silver<fees?20:player.workers < 2 ? 12 : player.workers < 5 ? 2 : -10;}
  return intent.discardTileId ? -150 : acquisitionValue(state,player,state.tiles[intent.tileId]);
}

/** Best marginal token value from PUBLIC current regions and remaining public pool only. */
export function vineTokenPotential(v:VineyardState,pid:string):number {const own=v.players[pid],base=vineScore(v,pid);return Math.max(0,...GRAPES.filter(g=>v.pool[g]>0).map(g=>vineScore({...v,players:{...v.players,[pid]:{...own,tokens:[...own.tokens,g]}}},pid)-base));}
