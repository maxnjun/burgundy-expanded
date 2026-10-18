import { prepareShieldFive } from "./shield-effects";
import { prioritizeMonastery27 } from "./monasteries";
import { monasteryNumbers } from "./state";
import type { GameState, PendingChoice, PlayerState } from "../types";

/** Enumerate goods-type choices, always taking all goods that fit the selected types. PDF p.7. */
export function shipGoodsOptions(state: GameState, player: PlayerState): PendingChoice["options"] {
  return state.market.numberedDepots.flatMap(depot => {
    const held = player.goods.map(g => g.type);
    const fresh = [...new Set(depot.goods.map(g => g.type))].filter(t => !held.includes(t)).sort();
    const takeCount = Math.min(3 - held.length, fresh.length);
    const selections: number[][] = [];
    const choose = (start: number, selected: number[]) => {
      if (selected.length === takeCount) { selections.push(selected); return; }
      for (let i = start; i < fresh.length; i++) choose(i + 1, [...selected, fresh[i]]);
    };
    choose(0, []);
    return selections.map(types => {
      const accepted = [...held, ...types];
      const ids = depot.goods.filter(g => accepted.includes(g.type)).map(g => g.id);
      return { id: `depot:${depot.number}:types:${types.join("-")}`, label: `${depot.number}번 공급처 · 상품 ${ids.length}개${types.length ? ` · 새 종류 ${types.join(", ")}` : ""}`,
        payload: { depot: depot.number, goodsIds: ids } };
    });
  });
}

function secondaryOptions(state: GameState, player: PlayerState, primary: number): PendingChoice["options"] {
  const adjacent = [(primary + 4) % 6 + 1, primary % 6 + 1];
  return [{ id: "decline-adjacent", label: "인접 공급처 상품을 가져오지 않기", payload: null }, ...shipGoodsOptions(state, player).filter(o => adjacent.includes((o.payload as {depot:number}).depot))];
}
function choiceOptions(state: GameState, player: PlayerState, payload: { primary?: number }): PendingChoice["options"] {
  return payload.primary === undefined ? shipGoodsOptions(state, player) : secondaryOptions(state, player, payload.primary);
}

export function validShipChoice(state: GameState): boolean {
  const choice = state.turn.pendingChoice;
  const effect = state.turn.pendingEffects[0];
  const player = state.players.find(p => p.id === state.turn.activePlayerId);
  if (!choice || !player || choice.playerId !== player.id || state.turn.pendingEffects.length !== 1 || effect?.kind !== "tile-benefit" ||
    effect.playerId !== player.id || effect.id !== choice.id || choice.source.section !== "Ship goods" || !effect.payload || typeof effect.payload !== "object" || Array.isArray(effect.payload)) return false;
  const payload = effect.payload as { readonly kind?: string; readonly tileId?: string; readonly primary?: number };
  return (payload.primary === undefined || (Number.isInteger(payload.primary) && payload.primary >= 1 && payload.primary <= 6 && monasteryNumbers(state, player).includes(5))) && payload.kind === "ship" && !!payload.tileId && state.tiles[payload.tileId]?.type === "ship" && player.duchy.cells.some(c => c.tileId === payload.tileId) &&
    JSON.stringify(choice.options) === JSON.stringify(choiceOptions(state, player, payload));
}

export function prepareShipChoice(state: GameState, playerId: string, tileId: string): GameState {
  const player = state.players.find(p => p.id === playerId)!;
  const id = `core:${state.revision + 1}:ship`;
  const source = { document: "special-edition-rulebook" as const, pages: [7], section: "Ship goods" };
  return { ...state, turn: { ...state.turn,
    pendingChoice: { id, playerId, source, options: shipGoodsOptions(state, player) },
    pendingEffects: [{ id, playerId, source, kind: "tile-benefit", payload: { kind: "ship", tileId } }],
  } };
}

/** The command names an engine-generated option; the UI never supplies goods IDs or track changes. */
export function resolveShipChoice(state: GameState, optionId: string): GameState {
  if (!validShipChoice(state)) throw new Error("Invalid pending ship effect");
  const option = state.turn.pendingChoice!.options.find(o => o.id === optionId);
  if (!option) throw new Error("Unknown ship choice");
  const effectPayload = state.turn.pendingEffects[0].payload as { kind: string; tileId: string; primary?: number };
  const payload = option.payload as { readonly depot: number; readonly goodsIds: readonly string[] } | null;
  const playerId = state.turn.activePlayerId!;
  const depot = state.market.numberedDepots.find(d => d.number === payload?.depot);
  const taken = depot?.goods.filter(g => payload!.goodsIds.includes(g.id)) ?? [];
  const player = state.players.find(p => p.id === playerId)!;
  const goods = [...new Set([...player.goods.map(g => g.type), ...taken.map(g => g.type)])].map(type => ({ type,
    tiles: [...(player.goods.find(g => g.type === type)?.tiles ?? []), ...taken.filter(g => g.type === type)] }));
  const withGoods: GameState = { ...state, players: state.players.map(p => p.id === playerId ? { ...p, goods } : p),
    market: { ...state.market, numberedDepots: state.market.numberedDepots.map(d => d.number === depot?.number ? { ...d, goods: d.goods.filter(g => !payload!.goodsIds.includes(g.id)) } : d) } };
  if (effectPayload.primary === undefined && monasteryNumbers(state, player).includes(5)) {
    const primary = payload!.depot;
    const updatedPlayer = withGoods.players.find(p => p.id === playerId)!;
    return { ...withGoods, turn: { ...state.turn,
      pendingChoice: { ...state.turn.pendingChoice!, options: secondaryOptions(withGoods, updatedPlayer, primary) },
      pendingEffects: [{ ...state.turn.pendingEffects[0], payload: { ...effectPayload, primary } }],
    } };
  }
  const oldPosition = state.turn.orderTrack.find(s => s.players.includes(playerId))!.position;
  const destination = oldPosition + 1;
  const orderTrack = state.turn.orderTrack.map(s => ({ ...s, players: s.players.filter(id => id !== playerId) }));
  const target = orderTrack.find(s => s.position === destination);
  if (target) target.players.unshift(playerId); else orderTrack.push({ position: destination, players: [playerId] });
  return prepareShieldFive({ ...withGoods, turn: { ...withGoods.turn, orderTrack: prioritizeMonastery27(withGoods,orderTrack.filter(s => s.players.length)), pendingChoice: null, pendingEffects: [] } },playerId,effectPayload.tileId);
}

/** Rebuild trusted ship options after an anytime shield6 target selection. */
export function refreshShipChoice(state:GameState):GameState {
  const effect=state.turn.pendingEffects[0],choice=state.turn.pendingChoice;
  const payload=effect?.payload as {kind?:string;primary?:number}|null;
  const player=state.players.find(p=>p.id===choice?.playerId);
  return choice&&player&&payload?.kind==="ship"?{...state,turn:{...state.turn,pendingChoice:{...choice,options:choiceOptions(state,player,payload)}}}:state;
}
