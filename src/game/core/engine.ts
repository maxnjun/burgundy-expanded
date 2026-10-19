import { settleShieldState, shieldSpecialIssue, applyShieldSpecial } from "./shield-effects";
import { acquireShieldPreview, shieldAcquireIssue, rewardShieldWorkerGain, shieldLayout, shieldWorkerSteps, type ShieldAcquireAction } from "../shields";
import type { EngineIssue, EngineResult, Transition, ValidationResult } from "../interfaces";
import type { DieValue, GameAction, GameState, JsonValue, PlayerState } from "../types";
import { drawDie } from "./random";
import { monasteryNumbers, orderedPlayers, validateCoreState } from "./state";
import { placementIssue } from "./placement";
import { advancePhase } from "./phases";
import { prepareTileEffect, resolveTileChoice, validPendingChoice, refreshPendingChoice } from "./effects";
import { executeIntent, destinationIssue as tileDestination } from "./intents";
import { adjustmentValid, planAdjustment } from "./modifiers";

type Mutable<T, D extends unknown[] = []> = D["length"] extends 8 ? T : T extends object ? { -readonly [K in keyof T]: Mutable<T[K], [...D, 0]> } : T;
type Draft = Mutable<GameState>;
const source = (pages: number[], section: string) => ({ document: "special-edition-rulebook" as const, pages, section });
const failure = (code: EngineIssue["code"], message: string): EngineResult<never> => ({ ok: false, issues: [{ code, message }] });

/** One step per worker; 1 <-> 6 wraps. No monastery modifier is inferred. */
export function adjustedDie(value: DieValue, steps: readonly (1 | -1)[]): DieValue {
  return steps.reduce<DieValue>((n, step) => ((n - 1 + step + 6) % 6 + 1) as DieValue, value);
}


function actionIssue(state: GameState, action: GameAction, pendingValid?: boolean): EngineResult<never> | null {
  if (state.status !== "playing") return failure("illegal-action", "Game is not playing");
  if (action.type === "buy-workers") {
    const owner=state.players.find(p=>p.id===action.playerId);
    return owner && owner.silver>=1 && monasteryNumbers(state,owner).includes(28) ? null : failure("illegal-action","Monastery28 requires one silver");
  }
  if(action.type==="extension"&&action.extensionId==="shields"&&(action.command==="choose-monastery-target"||(action.command==="change-die"&&state.turn.stage==="player-turn"&&state.turn.activePlayerId===action.playerId))){
    if((state.turn.pendingChoice||state.turn.pendingEffects.length)&&!(pendingValid??validPendingChoice(state)))return failure("unresolved-rule","Invalid pending choice");
    const issue=shieldSpecialIssue(state,action);return issue?failure("illegal-action",issue):null;
  }
  if (state.turn.pendingChoice || state.turn.pendingEffects.length) {
    if (action.type === "resolve-choice" && (state.turn.stage === "player-turn" || (state.turn.stage==="phase-end"&&!!shieldLayout(state)?.rules?.phase)) && action.playerId === state.turn.activePlayerId && (pendingValid??validPendingChoice(state)) &&
      action.choiceId === state.turn.pendingChoice?.id && state.turn.pendingChoice.options.some(o => o.id === action.optionId)) return null;
    if (!(pendingValid??validPendingChoice(state)) || (action.type !== "buy-black-tile" && action.type !== "use-monastery-six")) return failure("unresolved-rule", "Resolve the pending tile choice first");
  }
  const player = state.players.find(p => p.id === action.playerId);
  if (!player) return failure("illegal-action", "Unknown player");
  if (action.type === "advance-phase") {
    const result = advancePhase(state, action.playerId);
    return result.ok ? null : result;
  }
  if (action.type === "roll-round") {
    if (state.turn.stage !== "round-setup" || action.playerId !== orderedPlayers(state)[0]) return failure("illegal-action", "Only the round leader can start an unrolled round");
    if (state.market.roundGoods.length !== 6 - state.turn.round) return failure("incomplete-catalog", "Inject remaining round goods in bottom-first order");
    return null;
  }
  if (state.turn.stage !== "player-turn" || state.turn.activePlayerId !== action.playerId) return failure("illegal-action", "Not this player's turn");
  if (action.type === "end-turn") {
    if (state.dice.players[player.id].some(d => !d.used)) return failure("illegal-action", "Both dice actions must be resolved before ending the turn");
    return null;
  }
  if (action.type === "extension") {
    if(action.extensionId!=="shields" || !state.config.extensions.some(e=>e.id==="shields"))return failure("unsupported-extension", "Extensions are outside this core subset");
    const issue=action.command==="change-die"?shieldSpecialIssue(state,action):shieldAcquireIssue(state,action);return issue?failure("illegal-action",issue):null;
  }
  if (action.type === "resolve-choice") return failure("illegal-action", "No pending choice");
  if (action.type === "use-monastery-six") {
    if (!monasteryNumbers(state, player).includes(6) || player.workers < 2 || state.turn.monasterySixUsed) return failure("illegal-action", "Monastery 6 requires two workers once per turn");
    const tile = state.tiles[action.tileId];
    if (tile?.type !== "building" || !state.market.numberedDepots.find(d => d.number === action.depot)?.slots.some(s => s.tileId === action.tileId)) return failure("illegal-action", "Monastery 6 takes a numbered-depot building");
    const issue = tileDestination(player, action); return issue ? failure("illegal-action", issue) : null;
  }
  if (action.type === "buy-black-tile") {
    if (state.turn.blackPurchaseUsed || player.silver < 2) return failure("illegal-action", "Black purchase requires two silver and is limited to once per turn");
    if (!state.market.blackDepot.includes(action.tileId) && state.market.inns?.stack.at(-1)!==action.tileId) return failure("illegal-action", "Tile is not in the black depot");
    const issue = tileDestination(player, action);
    return issue ? failure("illegal-action", issue) : null;
  }
  if (action.type !== "use-die") return failure("illegal-action", "Unknown action");
  const die = state.dice.players[player.id].find(d => d.id === action.dieId);
  if (!die || die.used) return failure("illegal-action", "Die is not owned or has already been used; white die is not an action die");
  const adjustment = action.adjustment;
  if (!adjustmentValid(state, player, action.intent, adjustment)) return failure("illegal-action", "Invalid or unaffordable die/monastery adjustment");
  const value = adjustedDie(die.value, adjustment.steps);
  switch (action.intent.kind) {
    case "take-workers": return null;
    case "sell-goods":
      return action.intent.goodsType === value && player.goods.some(g => g.type === value && g.tiles.length)
        ? null : failure("illegal-action", "Selling requires an owned goods stack matching the adjusted die");
    case "take-tile": {
      const intent = action.intent;
      const depot = state.market.numberedDepots.find(d => d.number === intent.depot);
      if (value !== intent.depot || !depot?.slots.some(s => s.tileId === intent.tileId)) return failure("illegal-action", "Tile must be in the depot matching the adjusted die");
      const issue = tileDestination(player, intent);
      return issue ? failure("illegal-action", issue) : null;
    }
    case "place-tile": {
      const issue = placementIssue(state, player, action.intent.tileId, action.intent.cellId, value);
      return issue ? { ok: false, issues: [issue] } : null;
    }
    default: return failure("illegal-action", "Unknown die intent");
  }
}

/** Partial core validator; unsupported rules return explicit issues rather than permission. */
export function validateCoreAction(state: GameState, action: GameAction): ValidationResult {
  const valid = validateCoreState(state);
  if (!valid.valid) return valid;
  try {
    const issue = actionIssue(state, action);
    return issue && !issue.ok ? { valid: false, issues: issue.issues } : { valid: true };
  } catch {
    return { valid: false, issues: [{ code: "illegal-action", message: "Malformed action" }] };
  }
}

function storeTile(draft: Draft, player: Mutable<PlayerState>, action: { tileId: string; storageSlot: number; discardTileId?: string }) {
  if (action.discardTileId !== undefined) draft.market.removedTileIds.push(action.discardTileId);
  player.storage[action.storageSlot] = action.tileId;
}

function finishTurn(draft: Draft) {
  draft.turn.actedPlayerIds.push(draft.turn.activePlayerId!);
  const next = orderedPlayers(draft).find(id => !draft.turn.actedPlayerIds.includes(id));
  draft.turn.activePlayerId = next ?? null;
  draft.turn.blackPurchaseUsed = false;
  draft.turn.monasterySixUsed = false;
  if (next) return;
  draft.dice.rolledForRound = false;
  draft.dice.roundGoodsDistributed = false;
  draft.dice.whiteDie = null;
  draft.turn.actedPlayerIds = [];
  if (draft.turn.round < 5) {
    draft.turn.round++;
    draft.turn.stage = "round-setup";
  } else {
    // Phase income and replenishment are separate boundaries, never silently skipped.
    draft.turn.stage = "phase-end";
  }
}

/** Atomic, immutable supported transitions; no official board is manufactured or selected here. */
export function applyCoreAction(state: GameState, action: GameAction): EngineResult<Transition> {
  const validation = validateCoreAction(state, action);
  if (!validation.valid) return { ok: false, issues: validation.issues };
  if (action.type === "advance-phase") return advancePhase(state, action.playerId);
  let draft = structuredClone(state) as Draft;
  let player = draft.players.find(p => p.id === action.playerId)!;
  let pages = [6];
  let payload: JsonValue = { actionType: action.type };
  try {
    if (action.type === "extension") {
      draft=structuredClone(action.command==="choose-monastery-target"||action.command==="change-die"?applyShieldSpecial(draft,action):acquireShieldPreview(draft,action as ShieldAcquireAction)) as Draft;
      pages=[17,18];payload={actionType:action.command,extensionId:"shields",...action.payload as object};
    } else if (action.type === "buy-workers") {
      player.silver--;player.workers+=2;draft=structuredClone(refreshPendingChoice(rewardShieldWorkerGain(draft,player.id,2))) as Draft;pages=[13];payload={actionType:action.type,workersDelta:2,silverDelta:-1};
    } else if (action.type === "resolve-choice") {
      draft = structuredClone(resolveTileChoice(draft, action.optionId)) as Draft;
      payload = { actionType: action.type, choiceId: action.choiceId, optionId: action.optionId };
      pages = (state.turn.pendingEffects[0]?.payload as {kind?:string}|null)?.kind === "white-castle" ? [14] : [7];
    } else if (action.type === "roll-round") {
      for (const p of [...draft.players].sort((a, b) => a.seat - b.seat)) for (const die of draft.dice.players[p.id]) {
        const roll = drawDie(draft.random);
        draft.random = roll.random; die.value = roll.value; die.used = false;
      }
      const white = drawDie(draft.random);
      draft.random = white.random; draft.dice.whiteDie = white.value;
      const good = draft.market.roundGoods.shift()!;
      draft.market.numberedDepots.find(d => d.number === white.value)!.goods.push(good);
      draft.dice.rolledForRound = true;
      draft.dice.roundGoodsDistributed = true;
      draft.turn.stage = "player-turn";
      draft.turn.activePlayerId = orderedPlayers(draft)[0];
      draft.turn.blackPurchaseUsed = false;
      draft.turn.monasterySixUsed = false;
      payload = { actionType: action.type, whiteDie: white.value, goodsId: good.id, dice: Object.fromEntries(
        draft.players.map(p => [p.id, draft.dice.players[p.id].map(d => d.value)])) };
    } else if (action.type === "end-turn") {
      finishTurn(draft);
      payload = { actionType: action.type, nextPlayerId: draft.turn.activePlayerId, round: draft.turn.round, stage: draft.turn.stage };
    } else if (action.type === "use-monastery-six") {
      draft = structuredClone(executeIntent(draft, player.id, { ...action, kind: "take-tile" })) as Draft;
      player = draft.players.find(p => p.id === action.playerId)!; player.workers -= 2; draft.turn.monasterySixUsed = true;
      draft = structuredClone(refreshPendingChoice(draft)) as Draft;
      pages = [11]; payload = { actionType: action.type, tileId: action.tileId, workersDelta: -2 };
    } else if (action.type === "buy-black-tile") {
      pages = [10];
      player.silver -= 2;
      if(draft.market.inns?.stack.includes(action.tileId))draft.market.inns.stack=draft.market.inns.stack.filter(id=>id!==action.tileId);
      else draft.market.blackDepot[draft.market.blackDepot.indexOf(action.tileId)] = null;
      storeTile(draft, player, action);
      draft.turn.blackPurchaseUsed = true;
      draft = structuredClone(refreshPendingChoice(draft)) as Draft;
      payload = { actionType: action.type, tileId: action.tileId, silverDelta: -2, discardedTileId: action.discardTileId ?? null };
    } else if (action.type === "use-die") {
      const die = draft.dice.players[player.id].find(d => d.id === action.dieId)!;
      die.value = adjustedDie(die.value, action.adjustment.steps); die.used = true;
      const before = { workers: player.workers, silver: player.silver, points: player.victoryPoints };
      player.workers -= action.adjustment.workersSpent;
      draft = structuredClone(executeIntent(draft, player.id, action.intent)) as Draft;
      player = draft.players.find(p => p.id === action.playerId)!;
      if (action.intent.kind === "place-tile") draft = structuredClone(prepareTileEffect(draft, player.id, action.intent.tileId)) as Draft;
      pages = action.intent.kind === "sell-goods" || action.intent.kind === "take-workers" ? [6,10,11] : action.intent.kind === "take-tile" ? [6,7,9] : [7,8,9,11];
      payload = { actionType: action.type, intent: action.intent.kind, dieId: die.id, dieValue: die.value,
        workersDelta: player.workers - before.workers, silverDelta: player.silver - before.silver,
        pointsDelta: player.victoryPoints - before.points,
        tileId: action.intent.kind === "take-tile" || action.intent.kind === "place-tile" ? action.intent.tileId : null,
        cellId: action.intent.kind === "place-tile" ? action.intent.cellId : null,
        discardedTileId: action.intent.kind === "take-tile" ? action.intent.discardTileId ?? null : null };
    }
    draft=structuredClone(settleShieldState(draft)) as Draft;
    draft.revision++;
    const valid = validateCoreState(draft);
    if (!valid.valid) return { ok: false, issues: valid.issues };
    return { ok: true, value: { state: draft, events: [{ type: `core:${action.type}`, playerId: action.playerId,
      source: (action.type==="buy-black-tile"&&state.tiles[action.tileId]?.type==="inn") || (action.type==="use-die"&&action.intent.kind==="place-tile"&&state.tiles[action.intent.tileId]?.type==="inn") ? {document:"project-user-rule",pages:[],section:"Inn purchase or joker placement"} : source(pages, "Core supported transition"), payload }] } };
  } catch (error) {
    return failure("invalid-config", error instanceof Error ? error.message : "Transition failed");
  }
}

/** End a current resolved turn only; does not skip phase income/refill. */
export function advanceCoreTurn(state: GameState): EngineResult<Transition> {
  const valid = validateCoreState(state);
  if (!valid.valid) return { ok: false, issues: valid.issues };
  if (state.turn.stage !== "player-turn" || state.turn.activePlayerId === null) return failure("unresolved-rule", "Core advances resolved player turns only");
  return applyCoreAction(state, { type: "end-turn", playerId: state.turn.activePlayerId });
}

export interface CoreActionOptions {
  /** Valid representatives, NOT the full GameEngine.getLegalActions contract. */
  readonly actions: readonly GameAction[];
  readonly unsupported: readonly string[];
}

/** Supported representatives with shortest worker paths; each returned action passes validation. */
export function listCoreActionOptions(state: GameState, playerId: string): EngineResult<CoreActionOptions> {
  const valid = validateCoreState(state);
  if (!valid.valid) return { ok: false, issues: valid.issues };
  if (!state.players.some(p => p.id === playerId)) return failure("illegal-action", "Unknown player");
  const candidates: GameAction[] = [{type:"buy-workers",playerId},{ type: "roll-round", playerId }, { type: "end-turn", playerId }, { type: "advance-phase", playerId }];
  const player = state.players.find(p => p.id === playerId)!;
  if (state.turn.pendingChoice) for (const option of state.turn.pendingChoice.options) candidates.push({ type: "resolve-choice", playerId, choiceId: state.turn.pendingChoice.id, optionId: option.id });
  const layout=shieldLayout(state);
  if(layout?.effectsActive){
    if(layout.mounted.some(m=>m.playerId===playerId&&m.shieldNumber===6)&&layout.rules?.monasteryTarget===null)
      for(const target of state.players)candidates.push({type:"extension",extensionId:"shields",command:"choose-monastery-target",playerId,payload:{targetPlayerId:target.id}});
    if(state.turn.stage==="player-turn"&&state.turn.activePlayerId===playerId){
      if(layout.mounted.some(m=>m.playerId===playerId&&m.shieldNumber===16))for(const die of state.dice.players[playerId])for(let value=1;value<=6;value++)if(value!==die.value)candidates.push({type:"extension",extensionId:"shields",command:"change-die",playerId,payload:{dieId:die.id,value}});
      if(!state.turn.pendingChoice&&!state.turn.pendingEffects.length&&!state.dice.players[playerId].some(d=>d.used))for(const slot of layout.slots)if(slot.shieldNumber!==null)for(const cell of player.duchy.cells)if(cell.tileId&&state.tiles[cell.tileId].type==="castle")
        candidates.push({type:"extension",extensionId:"shields",command:"acquire",playerId,payload:{slotId:slot.id,castleCellId:cell.id,steps:state.dice.players[playerId].map(d=>shieldWorkerSteps(d.value,slot.depot)),replaceShieldNumber:layout.mounted.find(m=>m.playerId===playerId&&m.cellId===cell.id)?.shieldNumber??null}});
    }
  }
  const destinations = player.storage.map((tileId, storageSlot) => ({ storageSlot,
    ...(tileId !== null && !player.storage.includes(null) ? { discardTileId: tileId } : {}) }));
  for (const tileId of [...state.market.blackDepot,...(state.market.inns?.stack.slice(-1)??[])]) if (tileId !== null) for (const dest of destinations) candidates.push({ type: "buy-black-tile", playerId, tileId, ...dest });
  for (const depot of state.market.numberedDepots) for (const slot of depot.slots) if (slot.tileId && state.tiles[slot.tileId].type === "building") for (const dest of destinations) candidates.push({type:"use-monastery-six",playerId,depot:depot.number,tileId:slot.tileId,...dest});
  for (const die of state.dice.players[playerId]) for (let value = 1; value <= 6; value++) {
    const clockwise = (value - die.value + 6) % 6;
    const steps: (1 | -1)[] = clockwise <= 3 ? Array(clockwise).fill(1) : Array(6 - clockwise).fill(-1);
    const pushIntent = (intent: Extract<GameAction, {type:"use-die"}>["intent"]) => candidates.push({type:"use-die",playerId,dieId:die.id,adjustment:planAdjustment(state,player,intent,steps),intent});
    pushIntent({ kind: "take-workers" }); pushIntent({ kind: "sell-goods", goodsType: value as DieValue });
    for (const slot of state.market.numberedDepots.find(d => d.number === value)!.slots) if (slot.tileId !== null) for (const dest of destinations) {
      pushIntent({ kind: "take-tile", depot: value as DieValue, tileId: slot.tileId, ...dest });
    }
    for (const tileId of player.storage) if (tileId !== null) for (const cell of player.duchy.cells) {
      pushIntent({ kind: "place-tile", tileId, cellId: cell.id });
    }
  }
  // Canonical pending options are pure for this immutable query; validate once, not per candidate.
  const pendingValid=state.turn.pendingChoice||state.turn.pendingEffects.length?validPendingChoice(state):undefined;
  return { ok: true, value: { actions: candidates.filter(a => { try { return actionIssue(state,a,pendingValid) === null; } catch { return false; } }),
    unsupported: ["official-supply-recipes-and-setup", "extensions"] } };
}
