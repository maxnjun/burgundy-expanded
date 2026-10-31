import {purchaseUsed,numberedPurchaseTile} from '../purchases';
import type { EngineIssue, EngineResult, ValidationResult } from "../interfaces";
import type { DieValue, GameAction, JsonValue, TurnOrderSpace } from "../types";
import { adjustedDie } from "../core/engine";
import { destinationIssue, executeIntent } from "../core/intents";
import { placementIssue } from "../core/placement";
import { prepareTileEffect, refreshPendingChoice, resolveTileChoice } from "../core/effects";
import { validShipChoice } from "../core/ship";
import { adjustmentValid, planAdjustment } from "../core/modifiers";
import { drawDie } from "../core/random";
import { monasteryNumbers } from "../core/state";
import { accessibleTeamStorage, teamForPlayer, teamTurnOrder, validateTeamState } from "./team-state";
import type { TeamGameState, TeamTransition } from "./team-types";
import { commitTeamRuleView, teamRuleView } from "./team-rule-view";
import { advanceTeamPhase } from "./team-phases";
import { rankTeamScores } from "./team-scoring";

type Mutable<T, D extends unknown[] = []> = D["length"] extends 10 ? T : T extends object ? { -readonly [K in keyof T]: Mutable<T[K], [...D, 0]> } : T;
const issue = (message: string, code: EngineIssue["code"] = "illegal-action"): EngineIssue => ({ code, message });

function actionIssue(state: TeamGameState, action: GameAction): EngineIssue | null {
  if (state.status !== "playing") return issue("Team game has finished");
  const player = state.players.find(p => p.id === action.playerId), team = teamForPlayer(state, action.playerId);
  if (!player || !team) return issue("Unknown team member");
  if (action.type === "roll-round") return state.turn.stage === "round-setup" && teamTurnOrder(state)[0] === player.id ? null : issue("Only the round leader can roll");
  if (action.type === "advance-phase") {
    const result = advanceTeamPhase(state, player.id);
    return result.ok ? null : result.issues[0];
  }
  if (state.turn.stage !== "player-turn" || state.turn.activePlayerId !== player.id) return issue("Not this member's turn");
  if (state.turn.pendingChoice) {
    if (action.type === "resolve-choice") return action.choiceId === state.turn.pendingChoice.id && state.turn.pendingChoice.options.some(o => o.id === action.optionId) ? null : issue("Unknown team effect choice");
    if (action.type !== "buy-black-tile" && action.type !== "use-monastery-six") return issue("Resolve the pending team effect first");
  }
  if (action.type === "end-turn") return state.dice.players[player.id].every(d => d.used) ? null : issue("Resolve both personal dice first");
  if (action.type === "use-monastery-six") {
    if (!monasteryNumbers(state, team).includes(6) || team.workers < 2 || purchaseUsed(state.turn) || !numberedPurchaseTile(state,action.depot,action.tileId)) return issue("Monastery6 needs two shared workers and a numbered tile, using the shared purchase for this member turn");
    const destination = destinationIssue({ storage: accessibleTeamStorage(state, player.id) }, action);
    return destination ? issue(destination) : null;
  }
  if (action.type === "buy-black-tile") {
    if (purchaseUsed(state.turn) || team.silver < 2 || !state.market.blackDepot.includes(action.tileId)) return issue("Black purchase needs two shared silver and is once per member turn");
    const destination = destinationIssue({ storage: accessibleTeamStorage(state, player.id) }, action);
    return destination ? issue(destination) : null;
  }
  if (action.type !== "use-die") return issue("This team effect/extension is not implemented", "unresolved-rule");
  const die = state.dice.players[player.id].find(d => d.id === action.dieId);
  if (!die || die.used) return issue("Use an unused die belonging to this member");
  if (!adjustmentValid(state, team, action.intent, action.adjustment)) return issue("Invalid adjustment or insufficient shared workers");
  const value = adjustedDie(die.value, action.adjustment.steps);
  switch (action.intent.kind) {
    case "take-workers": return null;
    case "sell-goods": return action.intent.goodsType === value && team.goods.some(g => g.type === value) ? null : issue("Sell a shared goods type matching the die");
    case "take-tile": {
      const intent = action.intent;
      if (intent.depot !== value || !state.market.numberedDepots.find(d => d.number === intent.depot)?.slots.some(s => s.tileId === intent.tileId)) return issue("Tile is not in the matching depot");
      const destination = destinationIssue({ storage: accessibleTeamStorage(state, player.id) }, intent);
      return destination ? issue(destination) : null;
    }
    case "place-tile": {
      const view = teamRuleView(state);
      return placementIssue(view, view.players.find(p => p.id === player.id)!, action.intent.tileId, action.intent.cellId, value);
    }
    default: return issue("Unknown team intent");
  }
}

export function validateTeamAction(state: TeamGameState, action: GameAction): ValidationResult {
  const valid = validateTeamState(state);
  if (!valid.valid) return valid;
  try {
    const problem = actionIssue(state, action);
    return problem ? { valid: false, issues: [problem] } : { valid: true };
  } catch { return { valid: false, issues: [issue("Malformed team action")] }; }
}

/** p.15 team ship rule: no seventh space; on the last space move to the top.
 * Trusted effect helper only, not a public free-movement action.
 */
export function teamShipTrack(state: TeamGameState, playerId: string): readonly TurnOrderSpace[] {
  const valid = validateTeamState(state);
  if (!valid.valid) throw new Error("Invalid team state");
  const current = state.turn.orderTrack.find(s => s.players.includes(playerId));
  if (!current) throw new Error("Unknown team member");
  const destination = Math.min(6, current.position + 1);
  const track = state.turn.orderTrack.map(s => ({ ...s, players: s.players.filter(id => id !== playerId) }));
  const target = track.find(s => s.position === destination);
  if (target) target.players.unshift(playerId); else track.push({ position: destination, players: [playerId] });
  return track.filter(s => s.players.length);
}

/** Atomic subset of TeamGameAction. No transfer command or teammate private access exists. */
export function applyTeamAction(state: TeamGameState, action: GameAction): EngineResult<TeamTransition> {
  const valid = validateTeamAction(state, action);
  if (!valid.valid) return { ok: false, issues: valid.issues };
  if (action.type === "advance-phase") return advanceTeamPhase(state, action.playerId);
  try {
    let draft = structuredClone(state) as Mutable<TeamGameState>;
    const player = draft.players.find(p => p.id === action.playerId)!, team = draft.teams.find(t => t.id === player.teamId)!;
    let payload: JsonValue = { actionType: action.type };
    const store = (destination: { storageSlot: number; tileId: string; discardTileId?: string }) => {
      if (destination.discardTileId !== undefined) draft.market.removedTileIds.push(destination.discardTileId);
      if (destination.storageSlot < 2) player.privateStorage[destination.storageSlot] = destination.tileId;
      else team.sharedStorage[destination.storageSlot - 2] = destination.tileId;
    };
    if (action.type === "roll-round") {
      for (const member of [...draft.players].sort((a, b) => a.seat - b.seat)) for (const die of draft.dice.players[member.id]) {
        const roll = drawDie(draft.random); draft.random = roll.random; die.value = roll.value; die.used = false;
      }
      const white = drawDie(draft.random); draft.random = white.random; draft.dice.whiteDie = white.value;
      const good = draft.market.roundGoods.shift()!;
      draft.market.numberedDepots.find(d => d.number === white.value)!.goods.push(good);
      draft.dice.rolledForRound = true; draft.dice.roundGoodsDistributed = true;
      draft.turn.stage = "player-turn"; draft.turn.activePlayerId = teamTurnOrder(draft)[0];
      payload = { actionType: action.type, whiteDie: white.value, goodsId: good.id };
    } else if (action.type === "end-turn") {
      draft.turn.actedPlayerIds.push(player.id);
      const next = teamTurnOrder(draft).find(id => !draft.turn.actedPlayerIds.includes(id));
      draft.turn.activePlayerId = next ?? null; draft.turn.blackPurchaseUsed = false; draft.turn.monasterySixUsed = false;
      if (!next) {
        draft.turn.actedPlayerIds = []; draft.dice.whiteDie = null; draft.dice.rolledForRound = false; draft.dice.roundGoodsDistributed = false;
        if (draft.turn.round < 5) { draft.turn.round++; draft.turn.stage = "round-setup"; }
        else draft.turn.stage = "phase-end";
      }
    } else if (action.type === "buy-black-tile") {
      team.silver -= 2; store(action);
      draft.market.blackDepot[draft.market.blackDepot.indexOf(action.tileId)] = null;
      draft.turn.blackPurchaseUsed = true;
      draft = structuredClone(commitTeamRuleView(draft, refreshPendingChoice(teamRuleView(draft)), player.id)) as Mutable<TeamGameState>;
      payload = { actionType: action.type, teamId: team.id, tileId: action.tileId, storageSlot: action.storageSlot, silverDelta: -2, discardedTileId: action.discardTileId ?? null };
    } else if (action.type === "resolve-choice") {
      const view = teamRuleView(draft), next = resolveTileChoice(view, action.optionId);
      // Shared core ship resolution is reused, but team track has a hard last-space cap.
      const bounded = validShipChoice(view) && next.turn.pendingChoice === null ? { ...next, turn: { ...next.turn, orderTrack: teamShipTrack(draft, player.id) } } : next;
      draft = structuredClone(commitTeamRuleView(draft, bounded, player.id)) as Mutable<TeamGameState>;
      payload = { actionType: action.type, choiceId: action.choiceId, optionId: action.optionId };
    } else if (action.type === "use-monastery-six") {
      team.workers -= 2; draft.turn.monasterySixUsed = true; draft.turn.blackPurchaseUsed = true;
      const view = executeIntent(teamRuleView(draft), player.id, { kind: "take-tile", depot: action.depot, tileId: action.tileId, storageSlot: action.storageSlot, ...(action.discardTileId === undefined ? {} : { discardTileId: action.discardTileId }) });
      draft = structuredClone(commitTeamRuleView(draft, refreshPendingChoice(view), player.id)) as Mutable<TeamGameState>;
      payload = { actionType: action.type, teamId: team.id, tileId: action.tileId, storageSlot: action.storageSlot, workersDelta: -2, discardedTileId: action.discardTileId ?? null };
    } else if (action.type === "use-die") {
      const die = draft.dice.players[player.id].find(d => d.id === action.dieId)!;
      die.value = adjustedDie(die.value, action.adjustment.steps); die.used = true;
      const before = { workers: team.workers, silver: team.silver, points: player.victoryPoints };
      team.workers -= action.adjustment.workersSpent;
      let view = executeIntent(teamRuleView(draft), player.id, action.intent);
      if (action.intent.kind === "place-tile") view = prepareTileEffect(view, player.id, action.intent.tileId);
      draft = structuredClone(commitTeamRuleView(draft, view, player.id)) as Mutable<TeamGameState>;
      const updatedTeam = draft.teams.find(t => t.id === player.teamId)!, updatedPlayer = draft.players.find(p => p.id === player.id)!;
      payload = { actionType: action.type, intent: action.intent.kind,
        silverDelta: updatedTeam.silver - before.silver, pointsDelta: updatedPlayer.victoryPoints - before.points, workersDelta: updatedTeam.workers - before.workers, dieId: die.id, dieValue: die.value,
        teamId: team.id, tileId: action.intent.kind === "place-tile" || action.intent.kind === "take-tile" ? action.intent.tileId : null,
        cellId: action.intent.kind === "place-tile" ? action.intent.cellId : null, storageSlot: action.intent.kind === "take-tile" ? action.intent.storageSlot : null,
        discardedTileId: action.intent.kind === "take-tile" ? action.intent.discardTileId ?? null : null };
    }
    draft.revision++;
    const after = validateTeamState(draft);
    if (!after.valid) return { ok: false, issues: after.issues };
    return { ok: true, value: { state: draft, events: [{ type: `team:${action.type}`, playerId: action.playerId,
      source: { document: "special-edition-rulebook", pages: [6, 10, 15], section: "Team shared resources and individual actions" }, payload }] } };
  } catch (e) { return { ok: false, issues: [issue(e instanceof Error ? e.message : "Team transition failed", "invalid-config")] }; }
}

/** Legal representatives for the implemented subset, not a promise of complete team play. */
export function listTeamActions(state: TeamGameState, playerId: string): EngineResult<readonly GameAction[]> {
  const valid = validateTeamState(state);
  if (!valid.valid) return { ok: false, issues: valid.issues };
  const team = teamForPlayer(state, playerId);
  if (!team) return { ok: false, issues: [issue("Unknown team member")] };
  const storage = accessibleTeamStorage(state, playerId), candidates: GameAction[] = [{ type: "roll-round", playerId }, { type: "end-turn", playerId }, { type: "advance-phase", playerId }];
  if (state.turn.pendingChoice) for (const option of state.turn.pendingChoice.options) candidates.push({ type: "resolve-choice", playerId, choiceId: state.turn.pendingChoice.id, optionId: option.id });
  const destinations = storage.map((id, storageSlot) => ({ storageSlot, ...(id !== null && !storage.includes(null) ? { discardTileId: id } : {}) }));
  for (const tileId of state.market.blackDepot) if (tileId !== null) for (const dest of destinations) candidates.push({ type: "buy-black-tile", playerId, tileId, ...dest });
  for (const depot of state.market.numberedDepots) for (const slot of depot.slots) if (slot.tileId) for (const dest of destinations) candidates.push({ type: "use-monastery-six", playerId, depot: depot.number, tileId: slot.tileId, ...dest });
  for (const die of state.dice.players[playerId]) for (let n = 1; n <= 6; n++) {
    const clockwise = (n - die.value + 6) % 6;
    const steps: (1 | -1)[] = clockwise <= 3 ? Array(clockwise).fill(1) : Array(6 - clockwise).fill(-1);
    const intents: Extract<GameAction, { type: "use-die" }>["intent"][] = [{ kind: "take-workers" }, { kind: "sell-goods", goodsType: n as DieValue }];
    for (const slot of state.market.numberedDepots.find(d => d.number === n)!.slots) if (slot.tileId !== null) for (const dest of destinations) intents.push({ kind: "take-tile", depot: n as DieValue, tileId: slot.tileId, ...dest });
    for (const tileId of storage) if (tileId) for (const cell of team.duchy.cells) if (cell.number === n) intents.push({ kind: "place-tile", tileId, cellId: cell.id });
    for (const intent of intents) candidates.push({ type: "use-die", playerId, dieId: die.id, intent, adjustment: planAdjustment(state, team, intent, steps) });
  }
  return { ok: true, value: candidates.filter(action => actionIssue(state, action) === null) };
}

export function checkTeamGameEnd(state: TeamGameState): EngineResult<{ readonly ended: false } | { readonly ended: true; readonly scores: NonNullable<TeamGameState["finalScores"]>; readonly leadingTeamIds: readonly ("A" | "B")[]; readonly tied: boolean }> {
  const valid = validateTeamState(state);
  if (!valid.valid) return { ok: false, issues: valid.issues };
  if (state.status !== "finished" || !state.finalScores) return { ok: true, value: { ended: false } };
  const ranked = rankTeamScores(state.finalScores);
  return ranked.ok ? { ok: true, value: { ended: true, scores: state.finalScores, ...ranked.value } } : ranked;
}
