import {vineIntents,vineValues,keyOccupant} from "../vineyards";
import {refreshVineChoice,validVineChoice,resolveVineChoice,validVineBenefit} from "./vineyard-effects";
import {pendingTradeReward,settleTradeReward} from "../custom-trade-routes";
import { validShieldChoice, resolveShieldChoice, castleShieldOptions, bonusShieldOptions, resolveCastleShield, type BonusShieldTarget } from "./shield-effects";
import { rewardShieldWorkerGain } from "../shields";
import type { ActionIntent, DieAdjustment, DieValue, GameState, JsonValue, PendingChoice, PlayerState } from "../types";
import { adjustmentValid, planAdjustment } from "./modifiers";
import { executeIntent, intentIssue } from "./intents";
import { prepareShipChoice, resolveShipChoice, validShipChoice, refreshShipChoice } from "./ship";
import { prioritizeMonastery27 } from "./monasteries";
type Kind = "castle" | "white-castle" | "town-hall" | "market" | "carpenters-workshop" | "church" | "warehouse" | "crane";
const names: Record<Kind, string> = { "white-castle": "흰 성 · 흰 주사위 추가 행동", crane:"기중기 · 건물 효과 선택", castle: "성 · 자유 추가 행동", "town-hall": "시청 · 보관 타일 추가 배치", market: "시장 · 선박/가축 획득", "carpenters-workshop": "목공소 · 건물 획득", church: "교회 · 성/광산/수도원 획득", warehouse: "창고 · 상품 판매" };
const tileName = (state: GameState, id: string): string => {
    const tile = state.tiles[id];
    const buildings = { "white-castle": "흰 성", crane: "기중기", market: "시장", "carpenters-workshop": "목공소", church: "교회", warehouse: "창고", "boarding-house": "숙소", bank: "은행", "town-hall": "시청", watchtower: "감시탑" };
    return tile.type === "inn" ? "여관" : tile.type === "building" ? buildings[tile.building] : tile.type === "monastery" ? `수도원 ${tile.number}` : tile.type === "livestock" ? `가축 ${tile.count}마리` : tile.type === "castle" ? "성" : tile.type === "mine" ? "광산" : "선박";
};
const isKind = (s: unknown): s is Kind => typeof s === "string" && Object.hasOwn(names, s);
export function immediateOptions(state: GameState, player: PlayerState, kind: Kind,tradeReward=false): PendingChoice["options"] {
    if (kind === "white-castle") {
        const white = state.dice.whiteDie;
        if(white===null)return [{id:"skip",label:"흰 주사위 기록 없음 · 추가 행동 사용하지 않기",payload:null}];
        if (!state.config.extensions.some(e=>e.id==="white-castles") && !tradeReward) return [];
        // Generate ordinary intents, then constrain them to the current white die.
        // The parent benefit is consumed before executing; player dice and white die stay unchanged.
        return immediateOptions(state, player, "castle").flatMap(option => {
            const intent = (option.payload as unknown as { intent?: ActionIntent })?.intent;
            if (!intent) return [];
            const value = intent.kind==="vineyard"?[...vineValues(state,intent)].sort((a,b)=>Math.min((a-white+6)%6,(white-a+6)%6)-Math.min((b-white+6)%6,(white-b+6)%6))[0]:intent.kind === "take-tile" ? intent.depot : intent.kind === "sell-goods" ? intent.goodsType : intent.kind === "place-tile" ? player.duchy.cells.find(c => c.id === intent.cellId)!.number : white;
            const clockwise = (value - white + 6) % 6;
            const steps: (1 | -1)[] = clockwise <= 3 ? Array(clockwise).fill(1) : Array(6 - clockwise).fill(-1);
            const adjustment = planAdjustment(state, player, intent, steps);
            if (!adjustmentValid(state, player, intent, adjustment) || intentIssue(state, player, intent, value as DieValue)) return [];
            const payload = { intent, adjustment };
            return [{ id: JSON.stringify(payload), label: `흰 주사위 ${white} → ${value} · 일꾼 ${adjustment.workersSpent} · ${option.label}`, payload: payload as unknown as JsonValue }];
        }).concat([...bonusShieldOptions(state,player,true),{ id: "skip", label: "흰 성 추가 행동 사용하지 않기", payload: null }]);
    }
    if(kind==="crane")return [...([...(["market","carpenters-workshop","church","warehouse","boarding-house","bank","town-hall","watchtower"] as const), ...(state.config.extensions.some(e=>e.id==="white-castles") ? ["white-castle" as const] : [])]).map(building=>({id:`crane:${building}`,label:({"white-castle":"흰 성",market:"시장","carpenters-workshop":"목공소",church:"교회",warehouse:"창고","boarding-house":"숙소",bank:"은행","town-hall":"시청",watchtower:"감시탑"})[building],payload:{building}})),{id:"skip",label:"기중기 효과 사용하지 않기",payload:null}];
    const intents: {
        intent: ActionIntent;
        label: string;
    }[] = [];
    if (kind === "castle")
        intents.push({ intent: { kind: "take-workers" }, label: "일꾼 획득" });
    if (kind === "castle" || kind === "warehouse")
        for (const g of player.goods)
            if(!intentIssue(state,player,{kind:"sell-goods",goodsType:g.type}))intents.push({ intent: { kind: "sell-goods", goodsType: g.type }, label: `${g.type}번 상품 ${g.tiles.length}개 판매` });
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
                for (let storageSlot = 0; storageSlot < player.storage.length; storageSlot++) {
                    const occupant = keyOccupant(player,storageSlot);
                    const intent: ActionIntent = { kind: "take-tile", depot: depot.number, tileId: slot.tileId, storageSlot, ...(occupant && !player.storage.some((_,i)=>!keyOccupant(player,i)) ? { discardTileId: occupant } : {}) };
                    if (!intentIssue(state, player, intent))
                        intents.push({ intent, label: `${depot.number}번 공급처 ${tileName(state, slot.tileId)} 획득 · 보관${storageSlot + 1}${occupant ? " 교체" : ""}` });
                }
    if(kind==="castle"||kind==="town-hall")for(const intent of vineIntents(state,player))if(kind==="castle"||intent.command==="place")intents.push({intent,label:`포도 ${intent.command==="take"?"획득":"배치"} ${intent.slotId??intent.tileId}${intent.flipped?" · 뒤집기":""}`});
    const options = intents.map(({ intent, label }) => ({ id: JSON.stringify(intent), label, payload: { intent } as unknown as JsonValue }));
    if (kind !== "castle")
        options.push({ id: "skip", label: "건물 효과 사용하지 않기", payload: null });
    return kind==="castle"?[...options,...castleShieldOptions(state,player),...bonusShieldOptions(state,player)]:options;
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
    const source = { document: "special-edition-rulebook" as const, pages: kind==="white-castle"?[14]:kind==="crane"?[13]:[7, 8, 9], section: names[kind] };
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
            tradeSlotId?:string;vineRewardId?:string;
        };
        if(payload?.vineRewardId)return isKind(payload.kind)&&validVineBenefit(state,effect,payload.kind)&&JSON.stringify(choice.options)===JSON.stringify(immediateOptions(state,player,payload.kind));
        if(payload?.tradeSlotId){return isKind(payload.kind)&&effect.id===payload.tradeSlotId&&pendingTradeReward(state,player.id,payload.tradeSlotId)===payload.kind&&JSON.stringify(choice.options)===JSON.stringify(immediateOptions(state,player,payload.kind,true));}
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
export const validPendingChoice = (state: GameState): boolean => validVineChoice(state) || validShipChoice(state) || validImmediateChoice(state) || validShieldChoice(state);
/** Upgrade only the exact pre-v2 town-hall list; malformed choices still fail validation. */
export function upgradeTownHallChoice(state:GameState):GameState {
    const choice=state.turn.pendingChoice,effect=state.turn.pendingEffects[0];
    if(!choice||(effect?.payload as {kind?:string}|null)?.kind!=="town-hall")return state;
    const refreshed=refreshPendingChoice(state),options=refreshed.turn.pendingChoice!.options;
    const legacy=options.filter(o=>(o.payload as unknown as {intent?:ActionIntent})?.intent?.kind!=="vineyard");
    return legacy.length!==options.length&&JSON.stringify(choice.options)===JSON.stringify(legacy)&&validImmediateChoice(refreshed)?refreshed:state;
}
/** Preserve pending old rewards; only the exact menu without the newly added combinations can migrate. */
export function upgradeBonusShieldChoice(state:GameState):GameState {
 const c=state.turn.pendingChoice,p=state.turn.pendingEffects[0]?.payload as {kind?:string}|null;
 if(!c||!['castle','white-castle'].includes(p?.kind??''))return state;
 const next=refreshPendingChoice(state),legacy=next.turn.pendingChoice!.options.filter(o=>!o.id.startsWith('bonus-shield:'));
 return JSON.stringify(c.options)===JSON.stringify(legacy)&&validImmediateChoice(next)?next:state;
}
/** Resolving consumes the parent benefit before scheduling a child: no replay, implicit dice or infinite queue. */
export function resolveTileChoice(state: GameState, optionId: string): GameState {
    if(validVineChoice(state))return resolveVineChoice(state,optionId);
    if(validShieldChoice(state))return resolveShieldChoice(state,optionId);
    if (validShipChoice(state))
        return resolveShipChoice(state, optionId);
    if (!validImmediateChoice(state))
        throw new Error("Invalid pending immediate effect");
    const option = state.turn.pendingChoice!.options.find(o => o.id === optionId);
    if (!option)
        throw new Error("Unknown effect option");
    const tradeSlot=(state.turn.pendingEffects[0].payload as {tradeSlotId?:string})?.tradeSlotId;
    const consumed=tradeSlot?settleTradeReward(state,state.turn.activePlayerId!,tradeSlot,option.id==="skip"):state;
    const cleared = { ...consumed, turn: { ...consumed.turn, pendingChoice: null, pendingEffects: [] } };
    if (option.id === "skip")
        return cleared;
    if(option.id.startsWith("castle-shield:")||option.id.startsWith("bonus-shield:"))return resolveCastleShield(cleared,(option.payload as unknown as {shield:BonusShieldTarget}).shield);
    if(option.id.startsWith("crane:")){
        const building=(option.payload as {building:string}).building,playerId=state.turn.activePlayerId!;
        if(building==="bank"||building==="boarding-house"||building==="watchtower"){
            const points=building==="watchtower"?4:0;
            return rewardShieldWorkerGain({...cleared,players:cleared.players.map(p=>p.id===playerId?{...p,silver:p.silver+(building==="bank"?2:0),workers:p.workers+(building==="boarding-house"?4:0),victoryPoints:p.victoryPoints+points}:p),scoreLedger:points?{...cleared.scoreLedger,[playerId]:[...cleared.scoreLedger[playerId],{id:`core:${state.revision+1}:crane`,category:"building",points,source:{document:"special-edition-rulebook",pages:[13],section:"Crane"}}]}:cleared.scoreLedger},playerId,building==="boarding-house"?4:0);
        }
        if(!isKind(building)||building==="castle"||building==="crane")throw new Error("Invalid crane effect");
        const effect=state.turn.pendingEffects[0],tileId=(effect.payload as {tileId:string}).tileId;
        return {...cleared,turn:{...cleared.turn,pendingEffects:[{...effect,payload:{kind:building,tileId}}],pendingChoice:{...state.turn.pendingChoice!,source:{...effect.source,section:names[building]},options:immediateOptions(cleared,cleared.players.find(p=>p.id===playerId)!,building)}}};
    }
    const { intent, adjustment } = option.payload as unknown as {
        intent: ActionIntent;
        adjustment?: DieAdjustment;
    };
    const paid = adjustment ? { ...cleared, players: cleared.players.map(p => p.id === state.turn.activePlayerId ? { ...p, workers: p.workers - adjustment.workersSpent } : p) } : cleared;
    const next = executeIntent(paid, state.turn.activePlayerId!, intent);
    return intent.kind === "place-tile" ? prepareTileEffect(next, state.turn.activePlayerId!, intent.tileId) : next;
}
/** Purchases during a benefit can change storage/candidate lists; regenerate trusted options. */
export function refreshPendingChoice(state: GameState): GameState {
    if((state.turn.pendingEffects[0]?.payload as {vineChoice?:string}|null)?.vineChoice)return refreshVineChoice(state);
    const effect = state.turn.pendingEffects[0];
    if (!effect || !state.turn.pendingChoice)
        return state;
    const payload = effect.payload as {
        kind: unknown;
    };
    if (isKind(payload.kind))
        return { ...state, turn: { ...state.turn, pendingChoice: { ...state.turn.pendingChoice, options: immediateOptions(state, state.players.find(p => p.id === effect.playerId)!, payload.kind,!!(effect.payload as {tradeSlotId?:string})?.tradeSlotId) } } };
    return refreshShipChoice(state);
}
/** Rebuild choices from the current board, never from stale stored options. */
export function resumeCastleAction(state:GameState):GameState {
    if(state.turn.pendingChoice||state.turn.pendingEffects.length||!state.turn.castleActions?.length)return state;
    const [effect,...remaining]=state.turn.castleActions;
    return {...state,turn:{...state.turn,castleActions:remaining,pendingEffects:[effect],pendingChoice:{id:effect.id,playerId:effect.playerId,source:effect.source,options:immediateOptions(state,state.players.find(p=>p.id===effect.playerId)!,"castle")}}};
}
