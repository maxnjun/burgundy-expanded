import type { CellId } from "../types";
import { areAxialNeighbors } from "./axial";
import type { BoardDefinition, BoardValidationIssue, BoardValidationResult } from "./types";
import { validateBoardDefinition } from "./validation";

/** Injected graph only: not a team/solo game implementation or an official catalog entry.
 * Reuses cell/region/evidence contracts without relaxing individual-board validation.
 * River links must be transcribed from an identified source, never guessed from distance.
 */
export interface ModeBoardDefinition extends Omit<BoardDefinition, "format" | "family"> {
  readonly format: "mode-graph";
  readonly family: "solo" | "team" | "synthetic-test";
  readonly mode: "solo" | "team";
  /** Geographic land areas/islands, distinct from same-colour scoring regions. */
  readonly areas: readonly { readonly id: string; readonly cellIds: readonly CellId[] }[];
  readonly riverLinks: readonly { readonly from: CellId; readonly to: CellId }[];
}

/** Solo p.16: expanding to another land area must use a river. Team uses base adjacency.
 * This expresses contact only; dice, occupancy, terrain and effects remain engine checks.
 */
export function modeBoardNeighbors(board: ModeBoardDefinition, cellId: CellId): readonly CellId[] {
  const cell = board.cells.find(c => c.id === cellId);
  if (!cell) throw new RangeError("Unknown topology cell");
  const linked = new Set(board.mode === "solo" ? board.riverLinks.flatMap(link =>
    link.from === cellId ? [link.to] : link.to === cellId ? [link.from] : []) : []);
  const area = board.areas.find(a => a.cellIds.includes(cellId));
  return board.cells.filter(other => other.id !== cell.id &&
    ((areAxialNeighbors(cell.coord, other.coord) && (board.mode === "team" || area?.cellIds.includes(other.id))) || linked.has(other.id)))
    .map(c => c.id).sort();
}

/** Typed structural validation, not an untrusted JSON parser or proof of authenticity. */
export function validateModeBoardDefinition(board: ModeBoardDefinition): BoardValidationResult {
  // Keep all existing cell/region/start/evidence checks. Physical disconnection alone is
  // allowed here; connectivity is checked again using the explicitly injected mode graph.
  const base = validateBoardDefinition({ ...board, format: "individual-hex" });
  const issues: BoardValidationIssue[] = base.issues.filter(i => i.code !== "disconnected-board");
  const issue = (code: string, path: string, message: string) => issues.push({ code, path, message });
  if (board.format !== "mode-graph") issue("mode-format", "format", "Expected a mode graph");
  if (!["solo", "team"].includes(board.mode)) issue("board-mode", "mode", "Unknown mode");
  if (board.family !== "synthetic-test" && board.family !== board.mode) issue("mode-family", "family", "Board family must match mode");
  if (board.mode === "team" && board.riverLinks.length) issue("team-river", "riverLinks", "Team uses base adjacency, not solo river links");
  const byId = new Map(board.cells.map(c => [c.id, c]));
  const assignments = board.areas.flatMap(a => a.cellIds);
  if (!board.areas.length || new Set(board.areas.map(a => a.id)).size !== board.areas.length || board.areas.some(a => !a.id.trim() || !a.cellIds.length)) {
    issue("area-id", "areas", "Areas need unique nonempty IDs and members");
  }
  if (assignments.length !== board.cells.length || new Set(assignments).size !== assignments.length || assignments.some(id => !byId.has(id))) {
    issue("area-membership", "areas", "Each cell must belong to exactly one geographic area");
  }
  // Do not accept a made-up area that teleports between disconnected islands.
  if (!issues.length) for (const area of board.areas) {
    const visited = new Set([area.cellIds[0]]), queue = [area.cellIds[0]];
    for (let i = 0; i < queue.length; i++) for (const id of area.cellIds) {
      if (!visited.has(id) && areAxialNeighbors(byId.get(queue[i])!.coord, byId.get(id)!.coord)) { visited.add(id); queue.push(id); }
    }
    if (visited.size !== area.cellIds.length) issue("disconnected-area", area.id, "A land area must be physically connected");
  }
  const seen = new Set<string>();
  for (const [i, link] of board.riverLinks.entries()) {
    const from = byId.get(link.from), to = byId.get(link.to);
    if (!from || !to || link.from === link.to) issue("river-endpoint", `riverLinks[${i}]`, "River endpoints must be two different known cells");
    else if (board.areas.some(a => a.cellIds.includes(from.id) && a.cellIds.includes(to.id))) issue("river-area", `riverLinks[${i}]`, "River links join different land areas");
    const key = JSON.stringify([link.from, link.to].sort());
    if (seen.has(key)) issue("duplicate-river", `riverLinks[${i}]`, "Duplicate undirected river link");
    seen.add(key);
  }
  if (!issues.length && board.cells.length) {
    const visited = new Set([board.cells[0].id]);
    const queue = [board.cells[0].id];
    for (let i = 0; i < queue.length; i++) for (const next of modeBoardNeighbors(board, queue[i])) {
      if (!visited.has(next)) { visited.add(next); queue.push(next); }
    }
    if (visited.size !== board.cells.length) issue("disconnected-mode-board", "riverLinks", "Some cells cannot be reached through the declared mode graph");
  }
  return { valid: !issues.length, issues };
}

/** Empty contact candidates only, NOT legal GameActions. Does not permit chain traversal
 * through empty cells. Board and occupied IDs are checked before returning candidates.
 */
export function modePlacementFrontier(board: ModeBoardDefinition, occupiedCellIds: readonly CellId[]): readonly CellId[] {
  if (!validateModeBoardDefinition(board).valid) throw new Error("Invalid mode board topology");
  const occupied = new Set(occupiedCellIds);
  if (occupied.size !== occupiedCellIds.length || occupiedCellIds.some(id => !board.cells.some(c => c.id === id))) {
    throw new Error("Invalid occupied topology cells");
  }
  const candidates = new Set(occupiedCellIds.flatMap(id => modeBoardNeighbors(board, id)));
  return [...candidates].filter(id => !occupied.has(id)).sort();
}
