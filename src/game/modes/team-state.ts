import type { EngineIssue, EngineResult, ValidationResult } from "../interfaces";
import type { GoodsTile, Tile } from "../types";
import { validateModeBoardDefinition } from "../boards/mode-topology";
import { isCount, isDie } from "../core/state";
import { validPendingChoice } from "../core/effects";
import { teamRuleView } from "./team-rule-view";
import { calculateTeamFinalScores } from "./team-scoring";
import { officialMarketRecipe } from "../market-recipes";
import type { SharedTeamEstate, TeamGameSetup, TeamGameState, TeamId, TeamMember } from "./team-types";

export const teamTurnOrder = (state: TeamGameState): readonly string[] => [...state.turn.orderTrack]
  .sort((a, b) => b.position - a.position).flatMap(s => s.players);
export const teamForPlayer = (state: TeamGameState, id: string): SharedTeamEstate | undefined =>
  state.teams.find(t => t.id === state.players.find(p => p.id === id)?.teamId);
export function accessibleTeamStorage(state: TeamGameState, id: string): readonly (string | null)[] {
  const player = state.players.find(p => p.id === id), team = teamForPlayer(state, id);
  if (!player || !team) throw new Error("Unknown team member");
  return [...player.privateStorage, ...team.sharedStorage];
}

/** Base-only catalog for this partial adapter; extra effects are rejected, never silently ignored. */
function validTile(tile: Tile): boolean {
  if (!tile.id || !["black", "matching-color"].includes(tile.back)) return false;
  switch (tile.type) {
    case "castle": case "ship": case "mine": return true;
    case "building": return ["market", "carpenters-workshop", "church", "warehouse", "boarding-house", "bank", "town-hall", "watchtower"].includes(tile.building);
    case "monastery": return Number.isInteger(tile.number) && tile.number >= 1 && tile.number <= 26;
    case "livestock": return ["cattle", "sheep", "pigs", "chickens"].includes(tile.species) && [2, 3, 4].includes(tile.count);
    default: return false;
  }
}

/** Typed invariant check, not an arbitrary external JSON save parser. */
export function validateTeamState(state: TeamGameState): ValidationResult {
  const issues: EngineIssue[] = [];
  const issue = (message: string) => issues.push({ code: "invalid-config", message });
  try {
    if (state.schemaVersion !== "burgundy-team-v1" || state.mode !== "team" || !isCount(state.revision) || !state.random.seed.trim() || state.random.seed.length > 128 || !isCount(state.random.cursor)) issue("Invalid team schema/revision/randomness");
    if (!["playing", "finished"].includes(state.status) || (state.status === "playing" && state.finalScores !== null)) issue("Invalid team game status");
    if (state.marketRecipeId !== null && state.marketRecipeId !== "se:main:3-4") issue("Invalid team market recipe");
    const players = state.players, ids = players.map(p => p.id);
    if (players.length !== 4 || new Set(ids).size !== 4 || ids.some(id => !id || id.length > 80 || ["__proto__", "constructor", "prototype"].includes(id))) issue("Exactly four uniquely identified members are required");
    if (new Set(players.map(p => p.color)).size !== 4 || players.some(p => !["blue", "red", "green", "yellow"].includes(p.color))) issue("Members need four different colours");
    if (new Set(players.map(p => p.seat)).size !== 4 || players.some(p => !Number.isInteger(p.seat) || p.seat < 0 || p.seat > 3 || !p.name.trim() || p.name.length > 30)) issue("Invalid member names/seats");
    if (state.teams.length !== 2 || !["A", "B"].every(id => state.teams.filter(t => t.id === id).length === 1)) issue("Exactly teams A and B are required");
    const tileLocations: string[] = [], goodsLocations: string[] = [];
    const goods = (tiles: readonly GoodsTile[]) => {
      if (tiles.some(g => !g.id || !isDie(g.type))) issue("Invalid goods");
      goodsLocations.push(...tiles.map(g => g.id));
    };
    for (const p of players) {
      if (p.privateStorage.length !== 2) issue("Each member has exactly two private storage spaces");
      tileLocations.push(...p.privateStorage.filter((id): id is string => id !== null));
      if (!isCount(p.victoryPoints) || p.scoreLedger.some(e => !isCount(e.points)) || p.scoreLedger.reduce((n, e) => n + e.points, 0) !== p.victoryPoints) issue("Individual score ledger must match points");
      if (!state.teams.some(t => t.id === p.teamId) || ![0, 1].includes(p.member)) issue("Unknown team/member position");
    }
    for (const team of state.teams) {
      const members = players.filter(p => p.teamId === team.id);
      if (members.length !== 2 || new Set(members.map(p => p.member)).size !== 2) issue("Each team has members 0 and 1");
      if (!isCount(team.workers) || !isCount(team.silver) || team.sharedStorage.length !== 2) issue("Invalid shared resources/storage");
      tileLocations.push(...team.sharedStorage.filter((id): id is string => id !== null));
      if (team.definition.mode !== "team" || !validateModeBoardDefinition(team.definition).valid || team.duchy.boardId !== team.definition.id) issue("Invalid injected team board");
      if (team.duchy.cells.length !== team.definition.cells.length || new Set(team.duchy.cells.map(c => c.id)).size !== team.duchy.cells.length) issue("Team board cell mismatch");
      for (const cell of team.duchy.cells) {
        const original = team.definition.cells.find(c => c.id === cell.id);
        if (!original || original.coord.q !== cell.coord.q || original.coord.r !== cell.coord.r || original.terrain !== cell.terrain || original.number !== cell.number || original.regionId !== cell.regionId) issue("Team geometry differs from injected definition");
        if (cell.tileId !== null) {
          tileLocations.push(cell.tileId);
          if (state.tiles[cell.tileId]?.type !== cell.terrain) issue("Placed tile terrain mismatch");
        }
      }
      const start = team.duchy.cells.find(c => c.id === team.duchy.startingCastleCellId);
      if (!start || !team.definition.startingCastle.allowedCellIds.includes(start.id) || !start.tileId || state.tiles[start.tileId]?.type !== "castle") issue("Invalid team starting castle");
      const completed = team.duchy.completedRegionIds;
      if (new Set(completed).size !== completed.length || completed.some(id => !team.definition.regions.some(r => r.id === id && r.cellIds.every(c => team.duchy.cells.find(x => x.id === c)?.tileId !== null)))) issue("Invalid completed team regions");
      if (new Set(team.duchy.completedColors).size !== team.duchy.completedColors.length || team.duchy.completedColors.some(type => !team.duchy.cells.some(c => c.terrain === type) || team.duchy.cells.some(c => c.terrain === type && c.tileId === null))) issue("Invalid completed team colours");
      if (team.goods.length > 3 || new Set(team.goods.map(g => g.type)).size !== team.goods.length) issue("Team goods use at most three types");
      for (const stack of team.goods) {
        if (!isDie(stack.type) || !stack.tiles.length || stack.tiles.some(g => g.type !== stack.type)) issue("Invalid shared goods stack");
        goods(stack.tiles);
      }
      goods(team.soldGoods);
      if (new Set(team.bonuses.map(b => b.id)).size !== team.bonuses.length || team.bonuses.some(b => !team.duchy.completedColors.includes(b.color) || ![4, 7].includes(b.points))) issue("Invalid team colour bonuses");
    }
    for (const [id, tile] of Object.entries(state.tiles)) if (tile.id !== id || !validTile(tile)) issue("Unsupported or invalid team base tile");
    const depots = state.market.numberedDepots;
    if (depots.length !== 6 || new Set(depots.map(d => d.number)).size !== 6 || depots.some(d => !isDie(d.number))) issue("Six numbered depots required");
    for (const depot of depots) {
      if (new Set(depot.slots.map(s => s.id)).size !== depot.slots.length || depot.slots.some(s => !["castle", "ship", "mine", "building", "livestock", "monastery"].includes(s.requiredType))) issue("Invalid depot slots");
      for (const slot of depot.slots) if (slot.tileId !== null) {
        tileLocations.push(slot.tileId);
        if (state.tiles[slot.tileId]?.type !== slot.requiredType || state.tiles[slot.tileId]?.back !== "matching-color") issue("Numbered tile source mismatch");
      }
      goods(depot.goods);
    }
    if (state.market.blackDepot.some(id => id !== null && state.tiles[id]?.back !== "black")) issue("Black tile source mismatch");
    tileLocations.push(...state.market.blackDepot.filter((id): id is string => id !== null), ...state.market.removedTileIds, ...state.market.supplyPools.flatMap(p => p.remainingTileIds));
    if (new Set(tileLocations).size !== tileLocations.length || tileLocations.some(id => !state.tiles[id]) || Object.keys(state.tiles).some(id => !tileLocations.includes(id))) issue("Each tile must occupy exactly one physical location");
    if (new Set(state.market.supplyPools.map(p => p.id)).size !== state.market.supplyPools.length) issue("Duplicate supply pool");
    for (const phase of ["A", "B", "C", "D", "E"] as const) goods(state.market.phaseGoods[phase]);
    goods(state.market.roundGoods);
    if (new Set(goodsLocations).size !== goodsLocations.length) issue("Each goods tile has one location");
    const bonuses = [...state.market.bonusTiles, ...state.teams.flatMap(t => t.bonuses)];
    if (new Set(bonuses.map(b => b.id)).size !== bonuses.length || bonuses.some(b => !b.id || b.points !== (b.rank === "first" ? 7 : b.rank === "second" ? 4 : -1))) issue("Invalid/duplicate team colour bonus");
    if (!["A", "B", "C", "D", "E"].includes(state.turn.phase) || !Number.isInteger(state.turn.round) || state.turn.round < 1 || state.turn.round > 5) issue("Invalid team phase/round");
    if (!["round-setup", "player-turn", "phase-end", "finished"].includes(state.turn.stage) || (state.status === "finished") !== (state.turn.stage === "finished")) issue("Unsupported team stage");
    if ((state.turn.pendingChoice || state.turn.pendingEffects.length) && (state.turn.stage !== "player-turn" || !validPendingChoice(teamRuleView(state)))) issue("Invalid pending team choice");
    if (typeof state.turn.monasterySixUsed !== "boolean" || typeof state.turn.blackPurchaseUsed !== "boolean" || typeof state.dice.rolledForRound !== "boolean" || typeof state.dice.roundGoodsDistributed !== "boolean") issue("Invalid turn flags");
    const order = teamTurnOrder(state), acted = state.turn.actedPlayerIds;
    if (order.length !== 4 || new Set(order).size !== 4 || order.some(id => !ids.includes(id)) || new Set(state.turn.orderTrack.map(s => s.position)).size !== state.turn.orderTrack.length || state.turn.orderTrack.some(s => !Number.isInteger(s.position) || s.position < 0 || s.position > 6 || !s.players.length)) issue("Invalid team turn track");
    if (new Set(acted).size !== acted.length || acted.some(id => !ids.includes(id))) issue("Invalid acted members");
    const dieIds: string[] = [];
    if (Object.keys(state.dice.players).length !== 4 || Object.keys(state.dice.players).some(id => !ids.includes(id))) issue("Unknown die owner");
    for (const id of ids) {
      const dice = state.dice.players[id];
      if (!dice || dice.length !== 2 || dice.some(d => !d.id || !isDie(d.value) || typeof d.used !== "boolean")) issue("Each member owns two valid dice");
      else dieIds.push(...dice.map(d => d.id));
    }
    if (new Set(dieIds).size !== dieIds.length) issue("Duplicate die ID");
    if (state.turn.stage === "player-turn") {
      if (!state.turn.activePlayerId || !ids.includes(state.turn.activePlayerId) || acted.includes(state.turn.activePlayerId) || !state.dice.rolledForRound || !state.dice.roundGoodsDistributed || !isDie(state.dice.whiteDie!) || state.market.roundGoods.length !== 5 - state.turn.round) issue("Inconsistent active team turn");
    } else {
      if (state.turn.activePlayerId !== null || acted.length || state.dice.rolledForRound || state.dice.roundGoodsDistributed || state.dice.whiteDie !== null || state.turn.blackPurchaseUsed || state.turn.monasterySixUsed) issue("Inconsistent round boundary");
      if (state.turn.stage === "round-setup" && state.market.roundGoods.length !== 6 - state.turn.round) issue("Missing round goods");
      if (["phase-end", "finished"].includes(state.turn.stage) && (state.turn.round !== 5 || state.market.roundGoods.length)) issue("Inconsistent team phase boundary");
    }
    if (state.marketRecipeId) {
      const recipe = officialMarketRecipe(4, state.turn.phase);
      if (state.market.blackDepot.length !== recipe.blackSlots || state.market.numberedDepots.some(d => {
        const expected = recipe.depots.find(x => x.number === d.number)!;
        return d.slots.length !== expected.slots.length || d.slots.some(s => !expected.slots.some(e => e.id === s.id && e.requiredType === s.requiredType));
      })) issue("Team market geometry differs from its 4-player recipe");
    }
    if (state.status === "finished" && (state.turn.phase !== "E" || JSON.stringify(state.finalScores) !== JSON.stringify(calculateTeamFinalScores(state)) || state.finalScores?.some(s => !isCount(s.total)))) issue("Invalid final team score");
  } catch { issue("Malformed typed team state"); }
  return issues.length ? { valid: false, issues } : { valid: true };
}

export function createTeamGame(setup: TeamGameSetup): EngineResult<TeamGameState> {
  try {
    if (setup.players.length !== 4 || setup.initialGoods.some(g => g.length !== 3)) throw new Error("Team setup needs four members and three goods per team");
    const players: TeamMember[] = setup.players.map((p, i) => ({ ...p, seat: i, teamId: i < 2 ? "A" : "B", member: (i % 2) as 0 | 1,
      privateStorage: [null, null], victoryPoints: 0, scoreLedger: [] }));
    const teams: SharedTeamEstate[] = (["A", "B"] as TeamId[]).map((id, i) => {
      const definition = setup.boards[i], start = setup.startingCastleCellIds[i];
      if (!definition.startingCastle.allowedCellIds.includes(start)) throw new Error("Starting castle is not allowed by the injected team board");
      const goods = setup.initialGoods[i];
      return { id, definition, duchy: { boardId: definition.id, cells: definition.cells.map(c => ({ ...c, tileId: c.id === start ? setup.startingCastleTileIds[i] : null })),
        startingCastleCellId: start, completedRegionIds: definition.regions.filter(r => r.cellIds.every(c => c === start)).map(r => r.id), completedColors: [] },
        sharedStorage: [null, null], workers: i === 0 ? 3 : 5, silver: 2,
        goods: [...new Set(goods.map(g => g.type))].map(type => ({ type, tiles: goods.filter(g => g.type === type) })), soldGoods: [], bonuses: [] };
    });
    const state: TeamGameState = structuredClone({ schemaVersion: "burgundy-team-v1", mode: "team", revision: 0, status: "playing", finalScores: null, marketRecipeId: setup.marketRecipeId ?? null, teams, players,
      tiles: setup.tiles, market: setup.market, random: setup.random,
      dice: { players: Object.fromEntries(players.map(p => [p.id, [{ id: `team-die:${p.id}:1`, value: 1, used: false }, { id: `team-die:${p.id}:2`, value: 1, used: false }]])), whiteDie: null, rolledForRound: false, roundGoodsDistributed: false },
      turn: { phase: "A", round: 1, stage: "round-setup", activePlayerId: null, orderTrack: [{ position: 0, players: [players[0].id, players[2].id, players[1].id, players[3].id] }],
        actedPlayerIds: [], blackPurchaseUsed: false, monasterySixUsed: false, pendingChoice: null, pendingEffects: [] } });
    const valid = validateTeamState(state);
    return valid.valid ? { ok: true, value: state } : { ok: false, issues: valid.issues };
  } catch (e) { return { ok: false, issues: [{ code: "invalid-config", message: e instanceof Error ? e.message : "Invalid team setup" }] }; }
}
