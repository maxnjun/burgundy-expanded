import type { ActionIntent, GameState, JsonValue, PendingChoice, PlayerState } from "../types";
import { executeIntent, intentIssue } from "./intents";
import { prepareShipChoice, resolveShipChoice, validShipChoice } from "./ship";
import { prioritizeMonastery27 } from "./monasteries";
type Kind = "castle" | "town-hall" | "market" | "carpenters-workshop" | "church" | "warehouse" | "crane";
const names: Record<Kind, string> = { crane:"기중기 · 건물 효과 선택", castle: "성 · 자유 추가 행동", "town-hall": "시청 · 보관 타일 추가 배치", market: "시장 · 선박/가축 획득", "carpenters-workshop": "목공소 · 건물 획득", church: "교회 · 성/광산/수도원 획득", warehouse: "창고 · 상품 판매" };
const tileName = (state: GameState, id: string): string => {
    const tile = state.tiles[id];
    const buildings = { crane: "기중기", market: "시장", "carpenters-workshop": "목공소", church: "교회", warehouse: "창고", "boarding-house": "숙소", bank: "은행", "town-hall": "시청", watchtower: "감시탑" };
    return tile.type === "building" ? buildings[tile.building] : tile.type === "monastery" ? `수도원 ${tile.number}` : tile.type === "livestock" ? `가축 ${tile.count}마리` : tile.type === "castle" ? "성" : tile.type === "mine" ? "광산" : "선박";
};
const isKind = (s: unknown): s is Kind => typeof s === "string" && Object.hasOwn(names, s);
export function immediateOptions(state: GameState, player: PlayerState, kind: Kind): PendingChoice["options"] {
    if(kind==="crane")return [...(["market","carpenters-workshop","church","warehouse","boarding-house","bank","town-hall","watchtower"] as const).map(building=>({id:`crane:${building}`,label:({market:"시장","carpenters-workshop":"목공소",church:"교회",warehouse:"창고","boarding-house":"숙소",bank:"은행","town-hall":"시청",watchtower:"감시탑"})[building],payload:{building}})),{id:"skip",label:"기중기 효과 사용하지 않기",payload:null}];
    const intents: {
        intent: ActionIntent;
        label: string;
    }[] = [];
    if (kind === "castle")
        intents.push({ intent: { kind: "take-workers" }, label: "일꾼 획득" });
    if (kind === "castle" || kind === "warehouse")
        for (const g of player.goods)
            intents.push({ intent: { kind: "sell-goods", goodsType: g.type }, label: `${g.type}번 상품 ${g.tiles.length}개 판매` });
    if (kind === "castle" || kind === "town-hall")
        for (const id of player.storage)
            if (id)
                for (const c of player.duchy.cells) {
                    const intent: ActionIntent = { kind: "place-tile", tileId: id, cellId: c.id };
                    if (!intentIssue(state, player, intent))
                        intents.push({ intent, label: `${tileName(state, id)} → 눈 ${c.number} (${c.id}) 배치` });
                }
    const allowed = kind === "market" ? ["ship", "livestock"] : kind === "carpenters-workshop" ? ["building"] : kind === "church" ? ["castle", "mine", "monastery"] : kind === "castle" ? ["castle", "mine", "monastery", "building", "livestock", "ship"] : [];
    for (const depot of state.market.numberedDepots)
        for (const slot of depot.slots)
            if (slot.tileId && allowed.includes(state.tiles[slot.tileId].type))
                for (let storageSlot = 0; storageSlot < 3; storageSlot++) {
                    const occupant = player.storage[storageSlot];
                    const intent: ActionIntent = { kind: "take-tile", depot: depot.number, tileId: slot.tileId, storageSlot, ...(occupant && !player.storage.includes(null) ? { discardTileId: occupant } : {}) };
                    if (!intentIssue(state, player, intent))
                        intents.push({ intent, label: `${depot.number}번 공급처 ${tileName(state, slot.tileId)} 획득 · 보관${storageSlot + 1}${occupant ? " 교체" : ""}` });
                }
    const options = intents.map(({ intent, label }) => ({ id: JSON.stringify(intent), label, payload: { intent } as unknown as JsonValue }));
    if (kind !== "castle")
        options.push({ id: "skip", label: "건물 효과 사용하지 않기", payload: null });
    return options;
}
export function prepareTileEffect(state: GameState, playerId: string, tileId: string): GameState {
    const tile = state.tiles[tileId];
    if(tile.type==="monastery"&&tile.number===27)return {...state,turn:{...state.turn,orderTrack:prioritizeMonastery27(state,state.turn.orderTrack)}};
    if (tile.type === "ship")
        return prepareShipChoice(state, playerId, tileId);
    const kind = tile.type === "castle" ? "castle" : tile.type === "building" && isKind(tile.building) ? tile.building : null;
    if (!kind)
        return state;
    const player = state.players.find(p => p.id === playerId)!;
    const id = `core:${state.revision + 1}:benefit:${tileId}`;
    const source = { document: "special-edition-rulebook" as const, pages: kind==="crane"?[13]:[7, 8, 9], section: names[kind] };
    const options = immediateOptions(state, player, kind);
    // Keep even a skip-only window: a black purchase during a town-hall effect can create a new target.
    return { ...state, turn: { ...state.turn, pendingEffects: [{ id, playerId, kind: "tile-benefit", source, payload: { kind, tileId } }], pendingChoice: { id, playerId, source, options } } };
}
export function validImmediateChoice(state: GameState): boolean {
    try {
        const choice = state.turn.pendingChoice, effect = state.turn.pendingEffects[0], player = state.players.find(p => p.id === state.turn.activePlayerId);
        if (!choice || !effect || !player || state.turn.pendingEffects.length !== 1 || effect.id !== choice.id || effect.playerId !== player.id || choice.playerId !== player.id || effect.kind !== "tile-benefit")
            return false;
        const payload = effect.payload as {
            kind: unknown;
            tileId: unknown;
        };
        if (!payload || !isKind(payload.kind) || typeof payload.tileId !== "string" || !player.duchy.cells.some(c => c.tileId === payload.tileId))
            return false;
        const tile = state.tiles[payload.tileId];
        if (!(tile.type === "castle" && payload.kind === "castle") && !(tile.type === "building" && (payload.kind === tile.building || (tile.building==="crane" && payload.kind!=="castle"))))
            return false;
        return JSON.stringify(choice.options) === JSON.stringify(immediateOptions(state, player, payload.kind));
    }
    catch {
        return false;
    }
}
export const validPendingChoice = (state: GameState): boolean => validShipChoice(state) || validImmediateChoice(state);
/** Resolving consumes the parent benefit before scheduling a child: no replay, implicit dice or infinite queue. */
export function resolveTileChoice(state: GameState, optionId: string): GameState {
    if (validShipChoice(state))
        return resolveShipChoice(state, optionId);
    if (!validImmediateChoice(state))
        throw new Error("Invalid pending immediate effect");
    const option = state.turn.pendingChoice!.options.find(o => o.id === optionId);
    if (!option)
        throw new Error("Unknown effect option");
    const cleared = { ...state, turn: { ...state.turn, pendingChoice: null, pendingEffects: [] } };
    if (option.id === "skip")
        return cleared;
    if(option.id.startsWith("crane:")){
        const building=(option.payload as {building:string}).building,playerId=state.turn.activePlayerId!;
        if(building==="bank"||building==="boarding-house"||building==="watchtower"){
            const points=building==="watchtower"?4:0;
            return {...cleared,players:cleared.players.map(p=>p.id===playerId?{...p,silver:p.silver+(building==="bank"?2:0),workers:p.workers+(building==="boarding-house"?4:0),victoryPoints:p.victoryPoints+points}:p),scoreLedger:points?{...cleared.scoreLedger,[playerId]:[...cleared.scoreLedger[playerId],{id:`core:${state.revision+1}:crane`,category:"building",points,source:{document:"special-edition-rulebook",pages:[13],section:"Crane"}}]}:cleared.scoreLedger};
        }
        if(!isKind(building)||building==="castle"||building==="crane")throw new Error("Invalid crane effect");
        const effect=state.turn.pendingEffects[0],tileId=(effect.payload as {tileId:string}).tileId;
        return {...cleared,turn:{...cleared.turn,pendingEffects:[{...effect,payload:{kind:building,tileId}}],pendingChoice:{...state.turn.pendingChoice!,source:{...effect.source,section:names[building]},options:immediateOptions(cleared,cleared.players.find(p=>p.id===playerId)!,building)}}};
    }
    const { intent } = option.payload as unknown as {
        intent: ActionIntent;
    };
    const next = executeIntent(cleared, state.turn.activePlayerId!, intent);
    return intent.kind === "place-tile" ? prepareTileEffect(next, state.turn.activePlayerId!, intent.tileId) : next;
}
/** Purchases during a benefit can change storage/candidate lists; regenerate trusted options. */
export function refreshPendingChoice(state: GameState): GameState {
    const effect = state.turn.pendingEffects[0];
    if (!effect || !state.turn.pendingChoice)
        return state;
    const payload = effect.payload as {
        kind: unknown;
    };
    if (isKind(payload.kind))
        return { ...state, turn: { ...state.turn, pendingChoice: { ...state.turn.pendingChoice, options: immediateOptions(state, state.players.find(p => p.id === effect.playerId)!, payload.kind) } } };
    return state;
}
