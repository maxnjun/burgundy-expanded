import { finalScore } from "../core/phases";
import type { EngineResult } from "../interfaces";
import type { TeamFinalScore, TeamGameState, TeamId } from "./team-types";
import { teamRuleView } from "./team-rule-view";

/** Shared remaining resources/monasteries score ONCE, not once per player projection.
 * Keep the shared additions separate instead of arbitrarily assigning them to one teammate.
 */
export function calculateTeamFinalScores(state: TeamGameState): readonly TeamFinalScore[] {
  const view = teamRuleView(state);
  return state.teams.map(team => {
    const members = state.players.filter(p => p.teamId === team.id);
    const representative = view.players.find(p => p.id === members.find(p => p.member === 0)!.id)!;
    const score = finalScore(view, representative);
    if (!score.ok) throw new Error("Unresolved team final score");
    const earnedTotal = members.reduce((n, p) => n + p.victoryPoints, 0), sharedTotal = score.value.finalAdditionsTotal;
    return { teamId: team.id, members: members.map(p => ({ playerId: p.id, earned: p.victoryPoints })), earnedTotal,
      sharedAdditions: score.value.finalAdditions, sharedTotal, total: earnedTotal + sharedTotal, emptySpaces: team.duchy.cells.filter(c => c.tileId === null).length };
  });
}

/** Official p.15 team tiebreak: MORE empty spaces wins (opposite of competitive).
 * An exact remaining tie stays a tie; no extra unofficial tiebreak is invented.
 */
export function rankTeamScores(scores: readonly Pick<TeamFinalScore, "teamId" | "total" | "emptySpaces">[]): EngineResult<{ readonly leadingTeamIds: readonly TeamId[]; readonly tied: boolean }> {
  if (scores.length !== 2 || !["A", "B"].every(id => scores.filter(s => s.teamId === id).length === 1) || scores.some(s => !Number.isSafeInteger(s.total) || s.total < 0 || !Number.isSafeInteger(s.emptySpaces) || s.emptySpaces < 0)) {
    return { ok: false, issues: [{ code: "invalid-config", message: "Invalid final team totals" }] };
  }
  const ranked = [...scores].sort((a, b) => b.total - a.total || b.emptySpaces - a.emptySpaces), best = ranked[0];
  const leadingTeamIds = ranked.filter(s => s.total === best.total && s.emptySpaces === best.emptySpaces).map(s => s.teamId);
  return { ok: true, value: { leadingTeamIds, tied: leadingTeamIds.length > 1 } };
}
