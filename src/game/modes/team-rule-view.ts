import type { GameState, PlayerState } from "../types";
import type { TeamGameState } from "./team-types";

/** Internal ephemeral rule context, NOT a canonical/persistable GameState.
 * The tested low-level effect functions read an actor-shaped view. Shared state is
 * temporarily visible through both teammates; this is never sent to core validation,
 * a save parser, a server client or a public game engine. The canonical team validator
 * counts each physical tile/resource exactly once in TeamGameState instead.
 */
export function teamRuleView(state: TeamGameState): GameState {
  const players: PlayerState[] = state.players.map(p => {
    const team = state.teams.find(t => t.id === p.teamId)!;
    return { id: p.id, name: p.name, seat: p.seat, color: p.color, controller: "human", duchy: team.duchy,
      storage: [...p.privateStorage, ...team.sharedStorage], goods: team.goods, soldGoods: team.soldGoods,
      silver: team.silver, workers: team.workers, victoryPoints: p.victoryPoints, bonuses: team.bonuses };
  });
  return { schemaVersion: "0.2.1", revision: state.revision, status: "playing", players, tiles: state.tiles,
    market: state.market, dice: state.dice, turn: state.turn, random: state.random,
    config: { ruleset: "special-edition-base", mode: "team", playerCount: 4, seed: state.random.seed, catalogId: "practice:team-injected",
      extensions: [], players: players.map(p => ({ id: p.id, name: p.name, seat: p.seat, color: p.color, controller: "human", boardId: p.duchy.boardId, startingCastleCellId: p.duchy.startingCastleCellId })) },
    scoreLedger: Object.fromEntries(state.players.map(p => [p.id, p.scoreLedger])), extensionStates: {}, finalScores: null };
}

/** Fold only the acting member and their single shared estate back into canonical ownership. */
export function commitTeamRuleView(state: TeamGameState, view: GameState, playerId: string): TeamGameState {
  const member = state.players.find(p => p.id === playerId), actor = view.players.find(p => p.id === playerId);
  if (!member || !actor || actor.storage.length !== 4) throw new Error("Invalid team rule projection");
  return { ...state, market: view.market, dice: view.dice, turn: view.turn, random: view.random,
    players: state.players.map(p => p.id === playerId ? { ...p, privateStorage: [actor.storage[0], actor.storage[1]], victoryPoints: actor.victoryPoints, scoreLedger: view.scoreLedger[playerId] } : p),
    teams: state.teams.map(t => t.id === member.teamId ? { ...t, duchy: actor.duchy, sharedStorage: [actor.storage[2], actor.storage[3]],
      goods: actor.goods, soldGoods: actor.soldGoods, workers: actor.workers, silver: actor.silver, bonuses: actor.bonuses } : t) };
}
