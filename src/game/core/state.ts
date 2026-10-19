import { validInns } from "../inns";
import { validFortressScores } from "./fortress-lines";
import { validShieldLayout, hasShield, shieldLayout } from "../shields";
import type { EngineIssue, ValidationResult } from "../interfaces";
import type { GameState, PlayerState } from "../types";

export const isCount = (n: number): boolean => Number.isSafeInteger(n) && n >= 0;
export const isDie = (n: number): boolean => Number.isInteger(n) && n >= 1 && n <= 6;
export function monasteryNumbers(state: Pick<GameState,"tiles"> & {readonly players?:readonly unknown[];readonly extensionStates?:GameState["extensionStates"]}, player: Pick<PlayerState,"duchy"> & Partial<Pick<PlayerState,"id">>): readonly number[] {
  const physical=(p:Pick<PlayerState,"duchy">)=>p.duchy.cells.flatMap(c=>{const t=c.tileId?state.tiles[c.tileId]:null;return t?.type==="monastery"?[t.number]:[];});
  const own=physical(player);
  const target=hasShield(state,player.id,6)?state.players?.find(p=>!!p&&typeof p==="object"&&"id" in p&&p.id===(state.extensionStates?shieldLayout({extensionStates:state.extensionStates})?.rules?.monasteryTarget:null)):undefined;
  return target&&typeof target==="object"&&"duchy" in target?[...new Set([...own,...physical(target as Pick<PlayerState,"duchy">).filter(n=>n!==27)])]:own;
}

/** Larger positions lead; each stack is top-to-bottom, independent of seat order. PDF pp.5-7. */
export function orderedPlayers(state: GameState): readonly string[] {
  return [...state.turn.orderTrack].sort((a, b) => b.position - a.position).flatMap(space => space.players);
}

/** Typed-state invariants, NOT an untrusted JSON save parser or authenticity certificate. */
export function validateCoreState(state: GameState): ValidationResult {
  const issues: EngineIssue[] = [];
  const issue = (message: string) => issues.push({ code: "invalid-config", message });
  try {
    if (state.config.ruleset !== "special-edition-base" || state.config.mode !== "competitive" ||
      state.config.playerCount < 2 || state.config.playerCount > 4 || state.players.length !== state.config.playerCount) issue("Core requires 2-4 competitive players");
    if (state.config.extensions.some(e => !["inns","white-castles","geese","border-posts","additional-hexes","shields"].includes(e.id) || !e.options || (e.id!=="shields" && Object.keys(e.options).length)) || new Set(state.config.extensions.map(e=>e.id)).size !== state.config.extensions.length || Object.keys(state.extensionStates).some(id=>id!=="shields") || !validShieldLayout(state) || state.players.some(p => p.controller !== "human")) {
      issues.push({ code: "unsupported-extension", message: "Core does not resolve extensions or automated players" });
    }
    if (state.schemaVersion !== "0.2.1" || !isCount(state.revision) || !state.random.seed ||
      state.random.seed !== state.config.seed || !isCount(state.random.cursor)) issue("Invalid schema, revision or random state");
    if (!["A", "B", "C", "D", "E"].includes(state.turn.phase) || !Number.isInteger(state.turn.round) || state.turn.round < 1 || state.turn.round > 5) issue("Invalid phase/round");
    const ids = state.players.map(p => p.id);
    if (ids.some(id => !id) || new Set(ids).size !== ids.length || state.config.players.length !== ids.length ||
      new Set(state.config.players.map(p => p.id)).size !== ids.length || state.config.players.some(p => !ids.includes(p.id))) issue("Player/config IDs must match uniquely");
    if (state.config.startingPlayerId !== undefined && !ids.includes(state.config.startingPlayerId)) issue("Unknown starting player");
    const seats = state.players.map(p => p.seat);
    if (new Set(seats).size !== seats.length || seats.some(n => !isCount(n))) issue("Invalid seats");
    const order = orderedPlayers(state);
    if (order.length !== ids.length || new Set(order).size !== ids.length || order.some(id => !ids.includes(id)) ||
      state.turn.orderTrack.some(s => !isCount(s.position)) || new Set(state.turn.orderTrack.map(s => s.position)).size !== state.turn.orderTrack.length) issue("Invalid order track");
    for(const space of state.turn.orderTrack){
      const priority=space.players.findIndex(id=>monasteryNumbers(state,state.players.find(p=>p.id===id)!).includes(27));
      if(priority>0)issue("Monastery27 must stay on top of its turn-order stack");
    }
    if (new Set(state.turn.actedPlayerIds).size !== state.turn.actedPlayerIds.length || state.turn.actedPlayerIds.some(id => !ids.includes(id))) issue("Invalid acted players");
    if (state.turn.activePlayerId !== null && !ids.includes(state.turn.activePlayerId)) issue("Unknown active player");
    if (state.turn.stage === "player-turn" && (state.status !== "playing" || state.turn.activePlayerId === null ||
      state.turn.actedPlayerIds.includes(state.turn.activePlayerId) || !state.dice.rolledForRound || !state.dice.roundGoodsDistributed ||
      state.dice.whiteDie === null || state.market.roundGoods.length !== 5 - state.turn.round)) issue("Inconsistent player turn");
    if (state.turn.stage === "round-setup" && (state.status !== "playing" || state.turn.activePlayerId !== null ||
      state.turn.actedPlayerIds.length || state.dice.rolledForRound || state.dice.roundGoodsDistributed)) issue("Inconsistent round setup");
    if (!validInns(state)) issue("Invalid inn supply or duplicate inn in region");
    if (!validFortressScores(state)) issue("Inconsistent fortress line scores");
    const tileLocations: string[] = [], goodsIds: string[] = [], dieIds: string[] = [];
    for (const tile of Object.values(state.tiles)) {
      if (!["inn","castle","ship","mine","livestock","building","monastery"].includes(tile.type) || !["black","matching-color"].includes(tile.back) ||
        (tile.type === "monastery" && (!Number.isInteger(tile.number) || tile.number < 1 || tile.number > 29 || (tile.number === 29 && !state.config.extensions.some(e=>e.id==="white-castles")) || (tile.number > 26 && tile.number < 29 && !state.config.extensions.some(e=>e.id==="additional-hexes")))) ||
        (tile.type === "building" && (!["market","carpenters-workshop","church","warehouse","boarding-house","bank","town-hall","watchtower","crane","white-castle"].includes(tile.building) || (tile.building==="white-castle" && !state.config.extensions.some(e=>e.id==="white-castles")) || (tile.building==="crane" && !state.config.extensions.some(e=>e.id==="additional-hexes")))) ||
        (tile.type === "livestock" && (![2,3,4].includes(tile.count) || !["cattle","sheep","pigs","chickens","geese"].includes(tile.species) || (tile.species === "geese" && (tile.count !== 2 || tile.back !== "black" || !state.config.extensions.some(e=>e.id==="geese")))))) issue("Invalid base-game tile definition");
    }
    const goods = (tiles: readonly { id: string; type: number }[]) => {
      for (const tile of tiles) { if (!tile.id || !isDie(tile.type)) issue("Invalid goods tile"); goodsIds.push(tile.id); }
    };
    for (const player of state.players) {
      if (![player.workers, player.silver, player.victoryPoints].every(isCount)) issue("Resources and points must be safe nonnegative integers");
      if (player.storage.length < 3 || player.storage.length > Object.keys(state.tiles).length+3 || (player.storage.length !== 3 && !hasShield(state,player.id,4) && !(state.turn.pendingEffects[0]?.payload as {kind?:string}|null)?.kind?.startsWith("shield-storage"))) issue("Base tile storage must have three slots");
      tileLocations.push(...player.storage.filter((id): id is string => id !== null));
      const cellIds = player.duchy.cells.map(c => c.id);
      if (new Set(cellIds).size !== cellIds.length) issue("Duplicate cell ID");
      for (const cell of player.duchy.cells) {
        if (!isDie(cell.number) || !Number.isSafeInteger(cell.coord.q) || !Number.isSafeInteger(cell.coord.r)) issue("Invalid cell coordinate or number");
        if (cell.tileId !== null) tileLocations.push(cell.tileId);
      }
      const start = player.duchy.cells.find(c => c.id === player.duchy.startingCastleCellId);
      if (!start || start.terrain !== "castle" || start.tileId === null || state.tiles[start.tileId]?.type !== "castle") issue("Missing starting castle");
      if (player.goods.length > 3 || new Set(player.goods.map(g => g.type)).size !== player.goods.length) issue("At most three distinct goods stacks are allowed");
      for (const stack of player.goods) {
        if (!isDie(stack.type) || !stack.tiles.length || stack.tiles.some(t => t.type !== stack.type)) issue("Invalid goods stack");
        goods(stack.tiles);
      }
      goods(player.soldGoods);
      const dice = state.dice.players[player.id];
      if (!dice || dice.length !== 2) issue("Each player needs two dice");
      else for (const die of dice) {
        if (!die.id || !isDie(die.value) || typeof die.used !== "boolean") issue("Invalid player die");
        dieIds.push(die.id);
      }
      const ledger = state.scoreLedger[player.id];
      if (!ledger || ledger.some(e => !isCount(e.points)) || ledger.reduce((sum, e) => sum + e.points, 0) !== player.victoryPoints) issue("Score ledger must match earned victory points");
    }
    if (new Set(dieIds).size !== dieIds.length || Object.keys(state.dice.players).some(id => !ids.includes(id))) issue("Duplicate or unknown die owner");
    if (state.dice.whiteDie !== null && !isDie(state.dice.whiteDie)) issue("Invalid white die");
    const depots = state.market.numberedDepots;
    if (depots.length !== 6 || new Set(depots.map(d => d.number)).size !== 6 || depots.some(d => !isDie(d.number))) issue("Six uniquely numbered depots are required");
    for (const depot of depots) {
      if (new Set(depot.slots.map(s => s.id)).size !== depot.slots.length) issue("Duplicate depot slot");
      if (depot.slots.some(s => s.tileId !== null && (state.tiles[s.tileId]?.type !== s.requiredType || state.tiles[s.tileId]?.back !== "matching-color"))) issue("Numbered depot tile must match its slot and pool");
      tileLocations.push(...depot.slots.flatMap(s => s.tileId === null ? [] : [s.tileId]));
      goods(depot.goods);
    }
    tileLocations.push(...(state.market.inns?.stack ?? []), ...state.market.blackDepot.filter((id): id is string => id !== null), ...state.market.removedTileIds,
      ...state.market.supplyPools.flatMap(pool => pool.remainingTileIds));
    if (state.market.blackDepot.some(id => id !== null && state.tiles[id]?.back !== "black")) issue("Black depot requires black-backed tiles");
    for (const phase of ["A", "B", "C", "D", "E"] as const) goods(state.market.phaseGoods[phase]);
    goods(state.market.roundGoods);
    if (new Set(goodsIds).size !== goodsIds.length) issue("Goods IDs must have unique locations");
    if (new Set(tileLocations).size !== tileLocations.length || tileLocations.some(id => !state.tiles[id]) ||
      Object.keys(state.tiles).some(id => state.tiles[id].id !== id || !tileLocations.includes(id))) issue("Each catalog tile must occupy exactly one location");
  } catch {
    issue("Malformed typed state; save data requires a separate parser");
  }
  return issues.length ? { valid: false, issues } : { valid: true };
}
