import type { EngineIssue } from "../interfaces";
import type { DieValue, GameState, PlayerState, ScoreEntry, Tile } from "../types";
import { areAxialNeighbors } from "../boards/axial";
import { deriveRegions } from "../boards/regions";
import { validateBoardDefinition } from "../boards/validation";
import { monasteryNumbers } from "./state";
import { borderPostScore } from "./border-posts";

export function supportsPlacement(tile: Tile): boolean {
  return tile.type !== "monastery" || (Number.isInteger(tile.number) && tile.number >= 1 && tile.number <= 26);
}

/** Geometry is injected, not inferred from a board number or certified official here. */
export function placementIssue(state: GameState, player: PlayerState, tileId: string, cellId: string, value: DieValue): EngineIssue | null {
  const fail = (message: string, code: EngineIssue["code"] = "illegal-action"): EngineIssue => ({ code, message });
  const tile = state.tiles[tileId], cell = player.duchy.cells.find(c => c.id === cellId);
  if (!player.storage.includes(tileId) || !tile) return fail("Place a tile from your own storage");
  if (!cell || cell.tileId !== null || cell.terrain !== tile.type || cell.number !== value) return fail("Placement needs an empty matching terrain and die number");
  if (!supportsPlacement(tile)) return fail("This tile's choice or additional action resolver is not implemented", "unresolved-rule");
  if (!player.duchy.cells.some(c => c.tileId !== null && areAxialNeighbors(c.coord, cell.coord))) return fail("Placement must share an edge with an occupied cell");
  const cells = player.duchy.cells;
  let regions: ReturnType<typeof deriveRegions>;
  try { regions = deriveRegions(cells); }
  catch { return fail("Injected board has invalid coordinates or duplicate cells", "invalid-config"); }
  const result = validateBoardDefinition({ id: player.duchy.boardId, officialNumber: null, family: "base", format: "individual-hex",
    expectedCellCount: cells.length, cells, regions, startingCastle: { policy: "any-castle", allowedCellIds: cells.filter(c => c.terrain === "castle").map(c => c.id), recommendedCellId: null }, verification: { status: "draft" } });
  if (!result.valid) return fail("Injected board geometry or regions are inconsistent", "invalid-config");
  const region = cells.filter(c => c.regionId === cell.regionId);
  if (region.length > 8) return fail("Base scoring supports regions of size 1-8 only", "unresolved-rule");
  if (player.duchy.completedRegionIds.includes(cell.regionId) || player.duchy.completedColors.includes(cell.terrain)) return fail("Empty target belongs to an already completed region/color", "invalid-config");
  if (tile.type === "building" && !monasteryNumbers(state, player).includes(1) && region.some(c => {
    const existing = c.tileId && state.tiles[c.tileId];
    return existing && existing.type === "building" && existing.building === tile.building;
  })) return fail("Duplicate building type in the same town");
  const bonus = state.market.bonusTiles.find(b => b.color === cell.terrain);
  if (bonus && bonus.points !== state.config.playerCount + (bonus.rank === "first" ? 3 : 0)) return fail("Invalid injected color bonus value", "invalid-config");
  return null;
}

export function resolvePlacement(state: GameState, player: PlayerState, tileId: string, cellId: string) {
  const tile = state.tiles[tileId], cell = player.duchy.cells.find(c => c.id === cellId)!;
  const cells = player.duchy.cells.map(c => c.id === cellId ? { ...c, tileId } : c);
  const monks = monasteryNumbers(state, player);
  const entries: ScoreEntry[] = [];
  const score = (category: ScoreEntry["category"], points: number, pages: number[]) => entries.push({
    id: `core:${state.revision + 1}:${category}`, category, points, tileId, regionId: cell.regionId,
    source: { document: "special-edition-rulebook", pages, section: "Tile placement scoring" },
  });
  let silver = player.silver, workers = player.workers;
  if (tile.type === "building") {
    if (tile.building === "bank") silver += 2;
    if (tile.building === "boarding-house") workers += 4;
    if (tile.building === "watchtower") score("building", 4, [9]);
  }
  if (tile.type === "livestock") {
    const pasture = cells.filter(c => c.regionId === cell.regionId).map(c => c.tileId && state.tiles[c.tileId])
      .filter((t): t is Extract<Tile, { type: "livestock" }> => !!t && t.type === "livestock");
    const herdFor = (species: string) => pasture.filter(t => t.species === species || t.species === "geese");
    const value = (herd: typeof pasture) => herd.reduce((sum, t) => sum + t.count, 0) + (monks.includes(7) ? herd.length : 0);
    const herd = tile.species === "geese" ? ["cattle","sheep","pigs","chickens"].map(herdFor).sort((a,b) => value(b) - value(a))[0] : herdFor(tile.species);
    score("livestock", herd.reduce((sum, t) => sum + t.count, 0) + (monks.includes(7) ? herd.length : 0), [8, 11]);
  }
  const completedRegionIds = [...player.duchy.completedRegionIds];
  const completedColors = [...player.duchy.completedColors];
  const region = cells.filter(c => c.regionId === cell.regionId);
  if (region.every(c => c.tileId !== null)) {
    completedRegionIds.push(cell.regionId);
    score("region-size", [0, 1, 3, 6, 10, 15, 21, 28, 36][region.length], [4, 9]);
    score("phase-bonus", { A: 10, B: 8, C: 6, D: 4, E: 2 }[state.turn.phase], [4, 9]);
  }
  let bonusTiles = [...state.market.bonusTiles];
  const bonuses = [...player.bonuses];
  if (cells.filter(c => c.terrain === cell.terrain).every(c => c.tileId !== null)) {
    completedColors.push(cell.terrain);
    const bonus = bonusTiles.filter(b => b.color === cell.terrain).sort((a, b) => Number(a.rank === "second") - Number(b.rank === "second"))[0];
    if (bonus) { bonuses.push(bonus); bonusTiles = bonusTiles.filter(b => b.id !== bonus.id); score("color-bonus", bonus.points, [9]); }
  }
  const updated = { ...player, silver, workers, bonuses, storage: player.storage.map(id => id === tileId ? null : id), duchy: { ...player.duchy, cells, completedRegionIds, completedColors } };
  entries.push(...borderPostScore(state, player, updated));
  return { player: { ...updated, victoryPoints: player.victoryPoints + entries.reduce((n, e) => n + e.points, 0) }, entries, bonusTiles };
}
