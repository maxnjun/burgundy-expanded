import type { GameState } from "./types";
import { validateCoreState } from "./core/state";
import { validateBoardDefinition } from "./boards/validation";
import { deriveRegions } from "./boards/regions";
import { VERIFIED_BOARD_DEFINITIONS } from "./boards/catalog";
import { practiceBoard } from "./practice";
import { validPendingChoice } from "./core/effects";
import { officialMarketRecipe } from "./market-recipes";
import { parseBoundedGameJson } from "./bounded-json";

export interface SavedGame {
  readonly format: "burgundy-local-v1";
  readonly randomAlgorithm: "counter-v1";
  readonly game: GameState;
  readonly logs: readonly string[];
  readonly view: { readonly zoom: number; readonly focus: boolean; readonly table?: boolean; readonly commonZoom?: number; readonly computerPlayerIds?: readonly string[]; readonly computerPaused?: boolean; readonly boardZooms: Readonly<Record<string, number>> };
}
const terrains = ["castle", "ship", "mine", "livestock", "building", "monastery"];
const buildings = ["market", "carpenters-workshop", "church", "warehouse", "boarding-house", "bank", "town-hall", "watchtower", "crane"];
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const boundedZoom = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= .5 && v <= 2;
const reject = (): never => { throw new Error("저장 파일의 형식·규칙 상태가 올바르지 않거나 지원하지 않는 버전입니다."); };

/** Untrusted JSON is bounded and checked before being offered to the UI. No executable data. */
export function parseSavedGame(text: string): SavedGame {
  let value: unknown;
  try { value = parseBoundedGameJson(text); } catch { return reject(); }
  if (!object(value) || value.format !== "burgundy-local-v1" || value.randomAlgorithm !== "counter-v1" ||
    !object(value.game) || !Array.isArray(value.logs) || value.logs.length > 60 || value.logs.some(x => typeof x !== "string" || x.length > 2000) ||
    !object(value.view) || !boundedZoom(value.view.zoom) || typeof value.view.focus !== "boolean" || (value.view.table !== undefined && typeof value.view.table !== "boolean") ||
    (value.view.computerPaused !== undefined && typeof value.view.computerPaused !== "boolean") ||
    (value.view.commonZoom !== undefined && (!boundedZoom(value.view.commonZoom) || value.view.commonZoom < .75)) ||
    !object(value.view.boardZooms) || Object.values(value.view.boardZooms).some(z => !boundedZoom(z))) return reject();
  const saved = value as unknown as SavedGame;
  const game = saved.game;
  if (saved.view.computerPlayerIds !== undefined && (!Array.isArray(saved.view.computerPlayerIds) || saved.view.computerPlayerIds.length > 4 || new Set(saved.view.computerPlayerIds).size !== saved.view.computerPlayerIds.length || saved.view.computerPlayerIds.some(id => typeof id !== "string" || !game.players.some(p=>p.id===id)))) return reject();
  if (!validateCoreState(game).valid) return reject();
  if(game.config.marketRecipeId!==undefined){
    if(!["se:main:2", "se:main:3-4"].includes(game.config.marketRecipeId)||(game.config.playerCount!==2&&game.config.playerCount!==3&&game.config.playerCount!==4))return reject();
    const recipe=officialMarketRecipe(game.config.playerCount,game.turn.phase);
    if(recipe.id!==game.config.marketRecipeId)return reject();
    if(game.market.blackDepot.length!==recipe.blackSlots)return reject();
    for(const depot of game.market.numberedDepots){const expected=recipe.depots.find(d=>d.number===depot.number)!;
      if(depot.slots.length!==expected.slots.length||depot.slots.some(s=>!expected.slots.some(e=>e.id===s.id&&e.requiredType===s.requiredType)))return reject();
    }
  }
  // Save v1 supports only this application's known practice setup, not arbitrary catalogs or extensions.
  if (!["practice:non-official-supply", "project:base-160-v1"].includes(game.config.catalogId) || game.config.seed.length > 128 ||
    !["playing", "finished"].includes(game.status) || !["round-setup", "player-turn", "phase-end", "finished"].includes(game.turn.stage) ||
    typeof game.turn.blackPurchaseUsed !== "boolean" || typeof game.turn.monasterySixUsed !== "boolean" ||
    typeof game.dice.rolledForRound !== "boolean" || typeof game.dice.roundGoodsDistributed !== "boolean" ||
    ((game.turn.pendingChoice !== null || game.turn.pendingEffects.length > 0) && !validPendingChoice(game))) return reject();
  for (const tile of Object.values(game.tiles)) {
    if (!terrains.includes(tile.type) || !["black", "matching-color"].includes(tile.back) ||
      (tile.type === "building" && !buildings.includes(tile.building)) ||
      (tile.type === "livestock" && (!["cattle", "sheep", "pigs", "chickens", "geese"].includes(tile.species) || ![2,3,4].includes(tile.count))) ||
      (tile.type === "monastery" && (!Number.isInteger(tile.number) || tile.number < 1 || tile.number > 28))) return reject();
  }
  const colors = game.players.map(p=>p.color).filter(c=>c!==undefined);
  if (new Set(colors).size !== colors.length || colors.some(c=>!["blue","red","green","yellow"].includes(c))) return reject();
  for (const player of game.players) {
    if (typeof player.name !== "string" || !player.name.trim() || player.name.length > 30) return reject();
    const board = VERIFIED_BOARD_DEFINITIONS.find(b => b.id === player.duchy.boardId) ?? [practiceBoard(0), practiceBoard(1)].find(b => b.id === player.duchy.boardId);
    if (!board || player.duchy.cells.length !== board.cells.length || !board.startingCastle.allowedCellIds.includes(player.duchy.startingCastleCellId)) return reject();
    for (const cell of player.duchy.cells) {
      const original = board.cells.find(c => c.id === cell.id);
      if (!original || original.coord.q !== cell.coord.q || original.coord.r !== cell.coord.r || original.number !== cell.number || original.terrain !== cell.terrain || original.regionId !== cell.regionId ||
        (cell.tileId !== null && game.tiles[cell.tileId]?.type !== cell.terrain)) return reject();
    }
    if (!validateBoardDefinition({ ...board, cells: player.duchy.cells, regions: deriveRegions(player.duchy.cells) }).valid) return reject();
    const config = game.config.players.find(p => p.id === player.id);
    if (config?.boardId !== player.duchy.boardId || config.startingCastleCellId !== player.duchy.startingCastleCellId || config.seat !== player.seat || config.color !== player.color) return reject();
  }
  const phases = ["A", "B", "C", "D", "E"] as const;
  for (const phase of phases) if (game.market.phaseGoods[phase].length !== (phase > game.turn.phase ? 5 : 0)) return reject();
  if (game.turn.stage === "round-setup" && game.market.roundGoods.length !== 6 - game.turn.round) return reject();
  if (game.turn.stage === "phase-end" && (game.turn.round !== 5 || game.market.roundGoods.length || game.turn.activePlayerId !== null || game.dice.rolledForRound)) return reject();
  if (game.status === "finished") {
    if (game.turn.stage !== "finished" || game.turn.phase !== "E" || game.turn.round !== 5 || game.turn.activePlayerId !== null || !game.finalScores || game.finalScores.length !== game.players.length || new Set(game.finalScores.map(s => s.playerId)).size !== game.players.length) return reject();
    for (const p of game.players) {
      const s = game.finalScores.find(s => s.playerId === p.id);
      if (!s || s.total !== p.victoryPoints || !Array.isArray(s.earned) || !Array.isArray(s.finalAdditions) ||
        [...s.earned, ...s.finalAdditions].some(e => !Number.isSafeInteger(e.points) || e.points < 0) ||
        s.earnedTotal !== s.earned.reduce((n,e) => n+e.points,0) || s.finalAdditionsTotal !== s.finalAdditions.reduce((n,e) => n+e.points,0) || s.total !== s.earnedTotal+s.finalAdditionsTotal) return reject();
    }
  } else if (game.turn.stage === "finished" || game.finalScores !== null) return reject();
  return saved;
}

export function serializeSavedGame(save: SavedGame): string {
  const text = JSON.stringify(save);
  parseSavedGame(text);
  return text;
}
