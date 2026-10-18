import type { EngineResult, Transition, ValidationResult } from "../interfaces";
import type { GameAction, GameState, GoodsTile, PlayerState } from "../types";
import { destinationIssue } from "../core/intents";
import { isCount, isDie } from "../core/state";

/** Serializable component, not yet the complete solo game or its untrusted save parser. */
export interface SoloShipContext extends Pick<GameState, "tiles" | "market" | "revision"> {
  readonly player: Pick<PlayerState, "id" | "duchy" | "storage" | "goods" | "soldGoods">;
  readonly wildTileIds: readonly string[];
  readonly removedGoods: readonly GoodsTile[];
  readonly resolvedShipTileIds: readonly string[];
  readonly shipEffect: { readonly id: string; readonly tileId: string; readonly stage: "goods" | "exchange" } | null;
}
type SoloCommand = Extract<GameAction, { type: "extension" }>;
const fail = (message: string): EngineResult<never> => ({ ok: false, issues: [{ code: "illegal-action", message }] });
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** A black BACK is not the same as a face-down wildcard. Normal black purchases and
 * colour-completion rewards have effects; only the 5-goods exchanged wildcard has none.
 */
export function soloTileHasEffect(state: Pick<SoloShipContext, "tiles" | "player" | "wildTileIds">, tileId: string): boolean {
  return !!state.tiles[tileId] && state.player.duchy.cells.some(c => c.tileId === tileId) && !state.wildTileIds.includes(tileId);
}

export function validateSoloShipContext(state: SoloShipContext): ValidationResult {
  try {
    if (!isCount(state.revision) || !state.player.id || state.player.storage.length !== 3) throw new Error("Invalid solo ship identity/storage");
    const tiles = [...state.player.storage.filter((id): id is string => id !== null), ...state.player.duchy.cells.flatMap(c => c.tileId === null ? [] : [c.tileId]),
      ...state.market.numberedDepots.flatMap(d => d.slots.flatMap(s => s.tileId === null ? [] : [s.tileId])), ...state.market.blackDepot.filter((id): id is string => id !== null),
      ...state.market.removedTileIds, ...state.market.supplyPools.flatMap(p => p.remainingTileIds)];
    if (new Set(tiles).size !== tiles.length || tiles.some(id => !state.tiles[id]) || Object.entries(state.tiles).some(([id, tile]) => id !== tile.id || !tiles.includes(id))) throw new Error("Solo tiles must have unique physical locations");
    if (state.market.blackDepot.some(id => id !== null && state.tiles[id].back !== "black")) throw new Error("Invalid black depot tile");
    if (state.player.duchy.cells.some(c => c.tileId !== null && !state.wildTileIds.includes(c.tileId) && state.tiles[c.tileId]?.type !== c.terrain)) throw new Error("Face-up placed tile terrain mismatch");
    if (new Set(state.wildTileIds).size !== state.wildTileIds.length || state.wildTileIds.some(id => state.tiles[id]?.back !== "black" || ![...state.player.storage, ...state.player.duchy.cells.map(c => c.tileId), ...state.market.removedTileIds].includes(id))) throw new Error("Invalid face-down wildcard identity");
    if (state.player.goods.length > 6 || new Set(state.player.goods.map(g => g.type)).size !== state.player.goods.length || state.player.goods.some(g => !isDie(g.type) || !g.tiles.length || g.tiles.some(t => t.type !== g.type))) throw new Error("Invalid solo goods stacks");
    const goods = [...state.player.goods.flatMap(g => g.tiles), ...state.player.soldGoods, ...state.removedGoods, ...state.market.numberedDepots.flatMap(d => d.goods), ...state.market.roundGoods, ...Object.values(state.market.phaseGoods).flat()];
    if (new Set(goods.map(g => g.id)).size !== goods.length || goods.some(g => !g.id || !isDie(g.type))) throw new Error("Solo goods must have unique locations");
    if (state.market.numberedDepots.length !== 6 || new Set(state.market.numberedDepots.map(d => d.number)).size !== 6 || state.market.numberedDepots.some(d => !isDie(d.number))) throw new Error("Six solo depots required");
    if (new Set(state.resolvedShipTileIds).size !== state.resolvedShipTileIds.length || state.resolvedShipTileIds.some(id => state.tiles[id]?.type !== "ship" || !soloTileHasEffect(state, id))) throw new Error("Invalid resolved ship history");
    const effect = state.shipEffect;
    if (effect && (!effect.id || !["goods", "exchange"].includes(effect.stage) || state.tiles[effect.tileId]?.type !== "ship" || !soloTileHasEffect(state, effect.tileId) || state.resolvedShipTileIds.includes(effect.tileId))) throw new Error("Invalid solo ship window");
    return { valid: true };
  } catch (e) { return { valid: false, issues: [{ code: "invalid-config", message: e instanceof Error ? e.message : "Malformed solo ship context" }] }; }
}

/** Trusted effect scheduling after a validated placement; not a free player action.
 * The eventual placement transition owns the revision increment, like core.prepareTileEffect.
 */
export function beginSoloShipEffect<T extends SoloShipContext>(state: T, tileId: string): EngineResult<T> {
  const valid = validateSoloShipContext(state);
  if (!valid.valid) return { ok: false, issues: valid.issues };
  if (state.revision >= Number.MAX_SAFE_INTEGER || state.shipEffect || state.tiles[tileId]?.type !== "ship" || !soloTileHasEffect(state, tileId) || state.resolvedShipTileIds.includes(tileId)) return fail("No new active ship placement to resolve");
  return { ok: true, value: { ...state, shipEffect: { id: `solo:ship:${state.revision + 1}:${tileId}`, tileId, stage: "goods" } } };
}

/** Extension GameAction commands:
 * take-ship-goods {choiceId,depot}; exchange-ship-goods {choiceId,goodsIds,tileId,storageSlot,discardTileId?};
 * finish-ship {choiceId}. Exchange/finish are available only after mandatory goods collection.
 */
export function applySoloShipAction<T extends SoloShipContext>(state: T, action: SoloCommand): EngineResult<{ readonly state: T; readonly events: Transition["events"] }> {
  const valid = validateSoloShipContext(state);
  if (!valid.valid) return { ok: false, issues: valid.issues };
  try {
    const effect = state.shipEffect, payload = action.payload;
    if (action.type !== "extension" || action.extensionId !== "solo-game" || action.playerId !== state.player.id || !effect || !object(payload) || payload.choiceId !== effect.id) return fail("Unknown solo ship actor/window");
    let result: T;
    let spent: readonly string[] = [];
    if (action.command === "take-ship-goods") {
      if (effect.stage !== "goods" || !isDie(payload.depot as number)) return fail("Choose one depot for the new ship");
      const depot = state.market.numberedDepots.find(d => d.number === payload.depot)!;
      const removed = state.market.numberedDepots.filter(d => d.number !== depot.number).flatMap(d => d.goods);
      const merged = [...state.player.goods.flatMap(g => g.tiles), ...depot.goods];
      result = { ...state, player: { ...state.player, goods: [...new Set(merged.map(g => g.type))].sort().map(type => ({ type, tiles: merged.filter(g => g.type === type) })) },
        removedGoods: [...state.removedGoods, ...removed], market: { ...state.market, numberedDepots: state.market.numberedDepots.map(d => ({ ...d, goods: [] })) }, shipEffect: { ...effect, stage: "exchange" } };
    } else if (action.command === "exchange-ship-goods") {
      if (effect.stage !== "exchange" || !Array.isArray(payload.goodsIds) || payload.goodsIds.length !== 5 || new Set(payload.goodsIds).size !== 5 || payload.goodsIds.some(id => typeof id !== "string") || typeof payload.tileId !== "string" || !state.market.blackDepot.includes(payload.tileId) || !Number.isInteger(payload.storageSlot)) return fail("Exchange requires five owned goods and one central black tile");
      const selected = payload.goodsIds as string[], owned = state.player.goods.flatMap(g => g.tiles);
      if (selected.some(id => !owned.some(g => g.id === id))) return fail("Only unsold owned goods may be exchanged");
      if (payload.discardTileId !== undefined && typeof payload.discardTileId !== "string") return fail("Invalid discarded tile ID");
      const destination = { tileId: payload.tileId, storageSlot: payload.storageSlot as number, ...(payload.discardTileId === undefined ? {} : { discardTileId: payload.discardTileId as string }) };
      const problem = destinationIssue(state.player, destination);
      if (problem) return fail(problem);
      spent = selected;
      result = { ...state, player: { ...state.player, storage: state.player.storage.map((id, i) => i === destination.storageSlot ? destination.tileId : id),
        goods: state.player.goods.map(g => ({ ...g, tiles: g.tiles.filter(t => !selected.includes(t.id)) })).filter(g => g.tiles.length) },
        removedGoods: [...state.removedGoods, ...owned.filter(g => selected.includes(g.id))], wildTileIds: [...state.wildTileIds, destination.tileId],
        market: { ...state.market, blackDepot: state.market.blackDepot.map(id => id === destination.tileId ? null : id), removedTileIds: [...state.market.removedTileIds, ...(destination.discardTileId ? [destination.discardTileId] : [])] },
        shipEffect: null, resolvedShipTileIds: [...state.resolvedShipTileIds, effect.tileId] };
    } else if (action.command === "finish-ship") {
      if (effect.stage !== "exchange") return fail("Collect ship goods before declining the exchange");
      result = { ...state, shipEffect: null, resolvedShipTileIds: [...state.resolvedShipTileIds, effect.tileId] };
    } else return fail("Unknown solo ship command");
    result = { ...result, revision: state.revision + 1 };
    const after = validateSoloShipContext(result);
    return after.valid ? { ok: true, value: { state: result, events: [{ type: `solo:${action.command}`, playerId: state.player.id,
      source: { document: "special-edition-rulebook", pages: [16], section: "Solo ship goods and face-down black tile exchange" },
      payload: { sourceShipTileId: effect.tileId, command: action.command, spentGoodsIds: spent,
        depot: action.command === "take-ship-goods" ? payload.depot as number : null,
        acquiredWildTileId: action.command === "exchange-ship-goods" ? payload.tileId as string : null,
        storageSlot: action.command === "exchange-ship-goods" ? payload.storageSlot as number : null,
        removedGoodsIds: result.removedGoods.slice(state.removedGoods.length).map(g => g.id) } }] } } : { ok: false, issues: after.issues };
  } catch (e) { return fail(e instanceof Error ? e.message : "Malformed solo ship command"); }
}
