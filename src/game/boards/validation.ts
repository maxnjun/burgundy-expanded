import type { TileType } from "../types";
import type { BoardDefinition, BoardValidationIssue, BoardValidationResult } from "./types";
import { coordinateKey, getAxialNeighbors, isAxialCoord } from "./axial";
import { deriveRegions } from "./regions";
const terrains: readonly TileType[] = ["castle", "ship", "mine", "livestock", "building", "monastery"];
const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && new Set(a).size === a.length && a.every(x => b.includes(x));
/** Structural validator for typed definitions, not a parser for arbitrary external JSON nor proof of authenticity. */
export function validateBoardDefinition(board: BoardDefinition): BoardValidationResult {
  const issues: BoardValidationIssue[] = [];
  const issue = (code: string, path: string, message: string) => issues.push({ code, path, message });
  if (!board.id.trim()) issue("board-id", "id", "Board ID is empty");
  if (!Number.isSafeInteger(board.expectedCellCount) || board.expectedCellCount < 1 || board.cells.length !== board.expectedCellCount) issue("cell-count", "cells", "Cell count differs from declared positive count");
  const ids = new Set<string>(); const coordinates = new Set<string>(); let validCoordinates = true;
  for (const [i, cell] of board.cells.entries()) {
    const path = `cells[${i}]`;
    if (!cell.id.trim() || ids.has(cell.id)) issue("cell-id", path, "Empty or duplicate cell ID");
    ids.add(cell.id);
    if (!isAxialCoord(cell.coord) || Math.abs(cell.coord.q) >= Number.MAX_SAFE_INTEGER || Math.abs(cell.coord.r) >= Number.MAX_SAFE_INTEGER) {
      issue("coordinate", path, "Coordinates must be safe integers with room for neighbors"); validCoordinates = false;
    } else {
      const key = coordinateKey(cell.coord);
      if (coordinates.has(key)) issue("duplicate-coordinate", path, "Duplicate axial coordinates");
      coordinates.add(key);
    }
    if (!terrains.includes(cell.terrain)) issue("terrain", path, "Unknown terrain");
    if (!Number.isInteger(cell.number) || cell.number < 1 || cell.number > 6) issue("die-number", path, "Die number must be 1-6");
    if (!cell.regionId.trim()) issue("region-id", path, "Region ID is empty");
  }
  const regionIds = board.regions.map(r => r.id);
  if (regionIds.some(id => !id.trim()) || new Set(regionIds).size !== regionIds.length) issue("region-id", "regions", "Empty or duplicate region IDs");
  for (const cell of board.cells) if (!regionIds.includes(cell.regionId)) issue("region-reference", cell.id, "Missing declared region");
  if (validCoordinates && coordinates.size === board.cells.length && ids.size === board.cells.length && board.cells.length) {
    const derived = deriveRegions(board.cells);
    if (new Set(derived.map(r => r.id)).size !== derived.length) issue("disconnected-region", "regions", "One region ID spans disconnected components");
    for (const component of derived) {
      const declared = board.regions.find(r => r.id === component.id);
      if (component.cellIds.some(id => board.cells.find(c => c.id === id)!.regionId !== component.id)) issue("split-region", component.id, "Adjacent same-terrain cells have different region IDs");
      if (!declared || declared.terrain !== component.terrain || !sameSet(declared.cellIds, component.cellIds)) issue("region-membership", component.id, "Region terrain/members differ from maximal connected component");
      if (declared && !sameSet(declared.adjacentRegionIds, component.adjacentRegionIds)) issue("region-adjacency", component.id, "Region adjacency does not match geometry");
    }
    for (const region of board.regions) if (!derived.some(r => r.id === region.id)) issue("unused-region", region.id, "Declared region has no component");
    const byCoord = new Map(board.cells.map(c => [coordinateKey(c.coord), c]));
    const visited = new Set([board.cells[0].id]); const queue = [board.cells[0]];
    for (let i = 0; i < queue.length; i++) for (const coord of getAxialNeighbors(queue[i].coord)) {
      const next = byCoord.get(coordinateKey(coord));
      if (next && !visited.has(next.id)) { visited.add(next.id); queue.push(next); }
    }
    if (visited.size !== board.cells.length) issue("disconnected-board", "cells", "Board cells are not connected");
  }
  const start = board.startingCastle;
  if (!start.allowedCellIds.length || new Set(start.allowedCellIds).size !== start.allowedCellIds.length) issue("starting-castle", "startingCastle", "Starting candidates must be nonempty and unique");
  for (const id of start.allowedCellIds) if (board.cells.find(c => c.id === id)?.terrain !== "castle") issue("starting-castle", id, "Starting candidate must reference a castle cell");
  if (start.policy === "any-castle" && !sameSet(start.allowedCellIds, board.cells.filter(c => c.terrain === "castle").map(c => c.id))) issue("starting-policy", "startingCastle", "Any-castle candidates must cover all castle cells");
  if (start.recommendedCellId !== null && !start.allowedCellIds.includes(start.recommendedCellId)) issue("starting-recommendation", "startingCastle", "Recommended start must be allowed");
  if (board.verification.status === "verified") {
    const v = board.verification;
    if (board.family === "synthetic-test" || !board.officialNumber?.trim() || !v.reviewedBy.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(v.reviewedOn) || !v.evidence.length || v.evidence.some(e => !e.assetPath.trim() || !e.locator.trim() || !/^[a-f0-9]{64}$/i.test(e.sha256))) issue("verification-evidence", "verification", "Official verification requires identity, reviewer, date and hashed evidence");
  }
  return { valid: issues.length === 0, issues };
}
