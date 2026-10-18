import type { EngineResult, Transition } from "../interfaces";
import type { DieValue, GameAction, GameState, Phase, PlayerDie, RoundNumber } from "../types";
import { drawDie } from "../core/random";
import { isCount, isDie } from "../core/state";

/** Board-independent component of the future solo state, NOT a complete solo game. */
export interface SoloRoundContext extends Pick<GameState, "tiles" | "market" | "random" | "revision"> {
  readonly playerId: string;
  readonly phase: Phase;
  readonly round: RoundNumber;
  readonly stage: "round-setup" | "player-turn";
  readonly dice: readonly [PlayerDie, PlayerDie];
  readonly whiteDie: DieValue | null;
}
/** Trusted physical removal order, supplied separately from actions/save data.
 * Numbered depots run clockwise 1..6. Slots within a depot must come from an audited
 * layout (including a left/right tie policy for horizontal slots), NOT array position.
 */
export interface SoloRemovalPlan {
  readonly depots: readonly { readonly depot: DieValue; readonly slotIds: readonly string[] }[];
}

export function validateSoloRemovalPlan(state: Pick<SoloRoundContext, "market">, plan: SoloRemovalPlan): boolean {
  try {
    const depots = state.market.numberedDepots;
    if (depots.length !== 6 || plan.depots.length !== 6 || new Set(depots.map(d => d.number)).size !== 6 || new Set(plan.depots.map(d => d.depot)).size !== 6) return false;
    return depots.every(d => {
      const order = plan.depots.find(p => p.depot === d.number);
      return isDie(d.number) && !!order && order.slotIds.length === d.slots.length && new Set(order.slotIds).size === order.slotIds.length && new Set(d.slots.map(s => s.id)).size === d.slots.length && order.slotIds.every(id => d.slots.some(s => s.id === id));
    });
  } catch { return false; }
}

/** PDF p.16: topmost available hex in indicated depot, then clockwise fallback.
 * An exhausted numbered supply yields null; the black depot is never a fallback.
 */
export function soloRemovalTarget(state: Pick<SoloRoundContext, "market">, whiteDie: DieValue, plan: SoloRemovalPlan): { readonly depot: DieValue; readonly slotId: string; readonly tileId: string } | null {
  if (!isDie(whiteDie) || !validateSoloRemovalPlan(state, plan)) throw new Error("Invalid solo removal layout");
  for (let offset = 0; offset < 6; offset++) {
    const number = ((whiteDie - 1 + offset) % 6 + 1) as DieValue;
    const depot = state.market.numberedDepots.find(d => d.number === number)!;
    for (const slotId of plan.depots.find(p => p.depot === number)!.slotIds) {
      const slot = depot.slots.find(s => s.id === slotId)!;
      if (slot.tileId !== null) return { depot: number, slotId, tileId: slot.tileId };
    }
  }
  return null;
}

/** Atomic roll-round GameAction component. The full solo adapter must validate its
 * board/resources/choices first and merge this result; this is never a competitive state.
 */
export function applySoloRoundAction<T extends SoloRoundContext>(state: T, action: Extract<GameAction, { type: "roll-round" }>, plan: SoloRemovalPlan): EngineResult<{ readonly state: T; readonly events: Transition["events"] }> {
  try {
    if (action.type !== "roll-round" || !state.playerId || action.playerId !== state.playerId || state.stage !== "round-setup" || state.whiteDie !== null || !isCount(state.revision) ||
      !["A", "B", "C", "D", "E"].includes(state.phase) || !Number.isInteger(state.round) || state.round < 1 || state.round > 5 ||
      state.market.roundGoods.length !== 6 - state.round || state.dice.length !== 2 || new Set(state.dice.map(d => d.id)).size !== 2 || state.dice.some(d => !d.id || !isDie(d.value) || typeof d.used !== "boolean") || !validateSoloRemovalPlan(state, plan)) throw new Error("Invalid solo round boundary, owner or removal plan");
    const firstGood = state.market.roundGoods[0];
    if (!firstGood.id || !isDie(firstGood.type)) throw new Error("Missing solo round goods");
    const numbered = state.market.numberedDepots.flatMap(d => d.slots.flatMap(s => s.tileId === null ? [] : [s.tileId]));
    const locations = [...numbered, ...state.market.blackDepot.filter((id): id is string => id !== null), ...state.market.removedTileIds, ...state.market.supplyPools.flatMap(p => p.remainingTileIds)];
    if (new Set(locations).size !== locations.length || locations.some(id => !state.tiles[id]) || state.market.numberedDepots.some(d => d.slots.some(s => s.tileId !== null && (state.tiles[s.tileId]?.back !== "matching-color" || state.tiles[s.tileId]?.type !== s.requiredType)))) throw new Error("Invalid market tile ownership");
    const goods = [...state.market.roundGoods, ...state.market.numberedDepots.flatMap(d => d.goods), ...Object.values(state.market.phaseGoods).flat()];
    if (new Set(goods.map(g => g.id)).size !== goods.length || goods.some(g => !g.id || !isDie(g.type))) throw new Error("Invalid market goods ownership");
    let random = state.random;
    const dice = state.dice.map(d => { const roll = drawDie(random); random = roll.random; return { ...d, value: roll.value, used: false }; }) as unknown as readonly [PlayerDie, PlayerDie];
    const white = drawDie(random); random = white.random;
    const removed = soloRemovalTarget(state, white.value, plan);
    const result = { ...state, revision: state.revision + 1, random, dice, whiteDie: white.value, stage: "player-turn" as const,
      market: { ...state.market, roundGoods: state.market.roundGoods.slice(1), removedTileIds: [...state.market.removedTileIds, ...(removed ? [removed.tileId] : [])],
        numberedDepots: state.market.numberedDepots.map(d => ({ ...d, goods: d.number === white.value ? [...d.goods, firstGood] : d.goods,
          slots: d.slots.map(s => s.id === removed?.slotId && d.number === removed.depot ? { ...s, tileId: null } : s) })) } };
    if (!isCount(result.revision)) throw new Error("Solo revision exhausted");
    return { ok: true, value: { state: result, events: [{ type: "solo:roll-round", playerId: state.playerId,
      source: { document: "special-edition-rulebook", pages: [16], section: "Solo round roll, goods and hex removal" },
      payload: { whiteDie: white.value, dice: dice.map(d => d.value), goodsId: firstGood.id, goodsDepot: white.value, removedTileId: removed?.tileId ?? null, removedDepot: removed?.depot ?? null, removedSlotId: removed?.slotId ?? null } }] } };
  } catch (e) { return { ok: false, issues: [{ code: "invalid-config", message: e instanceof Error ? e.message : "Solo round preparation failed" }] }; }
}
