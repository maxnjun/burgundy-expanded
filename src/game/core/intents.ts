import {keyOccupant,discardStored,vinePlacementIssue,vineTakeIssue,vineValues,executeVine} from "../vineyards";
import { hasShield, rewardShieldWorkerGain } from "../shields";
import type { ActionIntent, DieValue, GameState, PlayerState } from "../types";
import { placementIssue, resolvePlacement } from "./placement";
import { monasteryNumbers } from "./state";
type Mutable<T, D extends unknown[] = [
]> = D["length"] extends 8 ? T : T extends object ? {
    -readonly [K in keyof T]: Mutable<T[K], [
        ...D,
        0
    ]>;
} : T;
export function destinationIssue(player: Pick<PlayerState, "storage" | "vineyardReserve">, action: {
    storageSlot: number;
    discardTileId?: string;
}): string | null {
    if (!Number.isInteger(action.storageSlot) || action.storageSlot < 0 || action.storageSlot >= player.storage.length)
        return "Invalid tile storage slot";
    const occupant = keyOccupant(player as PlayerState,action.storageSlot);
    if (occupant === null)
        return action.discardTileId === undefined ? null : "Cannot discard from an empty slot";
    if (player.storage.some((_,i)=>!keyOccupant(player as PlayerState,i)))
        return "Use an empty storage slot before discarding";
    return action.discardTileId === occupant ? null : "Explicit discard required";
}
export function intentIssue(state: GameState, player: PlayerState, intent: ActionIntent, value?: DieValue): string | null {
    switch (intent.kind) {
        case "vineyard": return (value!==undefined&&!vineValues(state,intent).includes(value))?"Vineyard die mismatch":intent.command==="take"?vineTakeIssue(state,player,intent):vinePlacementIssue(state,player,intent);
        case "take-workers": return null;
        case "sell-goods": return (value === undefined || intent.goodsType === value) && player.goods.some(g => g.type === intent.goodsType) ? null : "Goods stack or die mismatch";
        case "take-tile": return (value === undefined || intent.depot === value) && state.market.numberedDepots.find(d => d.number === intent.depot)?.slots.some(s => s.tileId === intent.tileId) ? destinationIssue(player, intent) : "Depot or die mismatch";
        case "place-tile": return placementIssue(state, player, intent.tileId, intent.cellId, value ?? player.duchy.cells.find(c => c.id === intent.cellId)?.number ?? 1)?.message ?? null;
        default: return "Unknown intent";
    }
}
/** Shared sale preview and execution. U15 is a user-confirmed project rule, not a publisher ruling. */
export function goodsSaleReward(state: GameState, player: PlayerState, tileCount: number) {
    const shieldSilver = hasShield(state, player.id, 9) ? tileCount : 1;
    return {
        silver: shieldSilver + (monasteryNumbers(state, player).includes(3) ? 1 : 0),
        points: tileCount * state.config.playerCount * (hasShield(state, player.id, 12) ? 2 : 1),
    };
}
/** No dice or effect scheduling here: shared by ordinary actions and immediate tile benefits. */
export function executeIntent(state: GameState, playerId: string, intent: ActionIntent): GameState {
    if(intent.kind==="vineyard"){if(intentIssue(state,state.players.find(p=>p.id===playerId)!,intent))throw new Error("Invalid vineyard intent");return executeVine(state,playerId,intent); }
    const prepared=intent.kind==="take-tile"&&intent.discardTileId?discardStored(state,playerId,[intent.discardTileId]):state;
    const draft = structuredClone(prepared) as Mutable<GameState>;
    let player = draft.players.find(p => p.id === playerId)!;
    if (intentIssue(state, state.players.find(p=>p.id===playerId)!, intent))
        throw new Error("Invalid immediate intent");
    const monks = monasteryNumbers(state, player);
    switch (intent.kind) {
        case "take-workers":
            player.workers += monks.includes(14) ? 4 : 2;
            if (monks.includes(13))
                player.silver++;
            break;
        case "sell-goods": {
            const stack = player.goods.find(g => g.type === intent.goodsType)!;
            const { points, silver } = goodsSaleReward(state, player, stack.tiles.length);
            player.goods = player.goods.filter(g => g.type !== intent.goodsType);
            player.soldGoods.push(...stack.tiles);
            player.silver += silver;
            if (monks.includes(4))
                player.workers++;
            player.victoryPoints += points;
            draft.scoreLedger[playerId].push({ id: `core:${draft.revision + 1}:goods`, category: "goods-sale", points, source: { document: "special-edition-rulebook", pages: [9, 10, 11], section: "Goods sale" } });
            break;
        }
        case "take-tile": {
            draft.market.numberedDepots.find(d => d.number === intent.depot)!.slots.find(s => s.tileId === intent.tileId)!.tileId = null;

            player.storage[intent.storageSlot] = intent.tileId;
            break;
        }
        case "place-tile": {
            const result = resolvePlacement(draft, player, intent.tileId, intent.cellId);
            player = structuredClone(result.player) as Mutable<PlayerState>;
            draft.players[draft.players.findIndex(p => p.id === playerId)] = player;
            draft.scoreLedger[playerId].push(...structuredClone(result.entries) as Mutable<GameState["scoreLedger"][string]>);
            draft.market.bonusTiles = structuredClone(result.bonusTiles) as Mutable<GameState["market"]["bonusTiles"]>;
            break;
        }
    }
    return rewardShieldWorkerGain(draft,playerId,player.workers-state.players.find(p=>p.id===playerId)!.workers);
}
