import type { EngineResult } from "../interfaces";
import type { Phase, Tile } from "../types";
import { monasteryNumbers } from "../core/state";
import { drawSupplyTile } from "../core/supply";
import { officialMarketRecipe } from "../market-recipes";
import { teamTurnOrder, validateTeamState } from "./team-state";
import { calculateTeamFinalScores } from "./team-scoring";
import type { TeamGameState, TeamTransition } from "./team-types";

type Mutable<T, D extends unknown[] = []> = D["length"] extends 10 ? T : T extends object ? { -readonly [K in keyof T]: Mutable<T[K], [...D, 0]> } : T;
const failure = (message: string): EngineResult<never> => ({ ok: false, issues: [{ code: "incomplete-catalog", message }] });

export function advanceTeamPhase(state: TeamGameState, playerId: string): EngineResult<TeamTransition> {
  const valid = validateTeamState(state);
  if (!valid.valid) return { ok: false, issues: valid.issues };
  if (state.status !== "playing" || state.turn.stage !== "phase-end" || state.turn.round !== 5 || state.turn.activePlayerId !== null || state.turn.pendingChoice || state.turn.pendingEffects.length || teamTurnOrder(state)[0] !== playerId) {
    return { ok: false, issues: [{ code: "illegal-action", message: "Only the track leader can advance a completed team phase" }] };
  }
  try {
    const draft = structuredClone(state) as Mutable<TeamGameState>;
    const income = draft.teams.map(team => {
      const mines = team.duchy.cells.filter(c => c.tileId && draft.tiles[c.tileId].type === "mine").length;
      const workers = monasteryNumbers(draft, team).includes(2) ? mines : 0;
      team.silver += mines; team.workers += workers;
      return { teamId: team.id, silver: mines, workers };
    });
    if (state.turn.phase === "E") {
      draft.finalScores = structuredClone(calculateTeamFinalScores(draft)) as Mutable<TeamGameState["finalScores"]>;
      draft.status = "finished"; draft.turn.stage = "finished";
    } else {
      const next = String.fromCharCode(state.turn.phase.charCodeAt(0) + 1) as Phase;
      if (draft.market.phaseGoods[next].length !== 5) return failure("Next team phase requires five goods");
      if (draft.marketRecipeId) {
        const recipe = officialMarketRecipe(4, next);
        if (draft.market.blackDepot.length !== recipe.blackSlots) return failure("Team black supply recipe mismatch");
        for (const depot of draft.market.numberedDepots) {
          const expected = recipe.depots.find(d => d.number === depot.number)!;
          if (depot.slots.length !== expected.slots.length) return failure("Team numbered supply recipe mismatch");
          for (const slot of depot.slots) {
            const match = expected.slots.find(s => s.id === slot.id);
            if (!match) return failure("Unknown team supply recipe slot");
            slot.requiredType = match.requiredType;
          }
        }
      }
      for (const type of ["castle", "ship", "mine", "building", "livestock", "monastery"] as const) {
        const needed = draft.market.numberedDepots.flatMap(d => d.slots).filter(s => s.requiredType === type).length;
        const available = draft.market.supplyPools.flatMap(p => p.remainingTileIds).filter(id => draft.tiles[id].back === "matching-color" && draft.tiles[id].type === type).length;
        if (available < needed) return failure(`Insufficient team supply: ${type}`);
      }
      if (draft.market.supplyPools.flatMap(p => p.remainingTileIds).filter(id => draft.tiles[id].back === "black").length < draft.market.blackDepot.length) return failure("Insufficient team black supply");
      for (const depot of draft.market.numberedDepots) for (const slot of depot.slots) {
        if (slot.tileId !== null) draft.market.removedTileIds.push(slot.tileId);
        slot.tileId = null;
      }
      for (const id of draft.market.blackDepot) if (id !== null) draft.market.removedTileIds.push(id);
      const draw = (back: Tile["back"], type?: Tile["type"]) => {
        const result = drawSupplyTile(draft, back, type); draft.random = result.random;
        draft.market.supplyPools = structuredClone(result.market.supplyPools) as Mutable<TeamGameState["market"]["supplyPools"]>;
        return result.tileId;
      };
      for (const depot of draft.market.numberedDepots) for (const slot of depot.slots) slot.tileId = draw("matching-color", slot.requiredType);
      draft.market.blackDepot = draft.market.blackDepot.map(() => draw("black"));
      draft.market.roundGoods = draft.market.phaseGoods[next]; draft.market.phaseGoods[next] = [];
      draft.turn.phase = next; draft.turn.round = 1; draft.turn.stage = "round-setup";
    }
    draft.revision++;
    const after = validateTeamState(draft);
    return after.valid ? { ok: true, value: { state: draft, events: [{ type: "team:advance-phase", playerId,
      source: { document: "special-edition-rulebook", pages: [10, 15], section: "Team shared phase income and scoring" }, payload: { income, phase: draft.turn.phase, finished: draft.status === "finished" } }] } } : { ok: false, issues: after.issues };
  } catch (e) { return failure(e instanceof Error ? e.message : "Team phase transition failed"); }
}
