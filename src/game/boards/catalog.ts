import type { RuleSource } from "../types";
import type { BoardDefinition, BoardFamily, BoardInventoryEntry, BoardPreview } from "./types";
import { validateBoardDefinition } from "./validation";
import { SE_BASE_2 } from "./se-base-2";
import { SHEET_BOARD_DEFINITIONS } from "./se-duchy-sheet";

/** Only fully transcribed layouts with source evidence belong here. */
export const VERIFIED_BOARD_DEFINITIONS: readonly BoardDefinition[] = Object.freeze(
  SHEET_BOARD_DEFINITIONS.map(board => board.id === SE_BASE_2.id ? SE_BASE_2 : board),
);

function entry(number: string, family: BoardFamily, pages: readonly number[]): BoardInventoryEntry {
  const source: RuleSource = { document: "special-edition-rulebook", pages, section: "Duchy board inventory" };
  const id = `se:${family}:${number}`;
  return Object.freeze({ id, officialNumber: number, family, label: `Special Edition ${number}`, geometryStatus: VERIFIED_BOARD_DEFINITIONS.some(b => b.id === id) ? "verified" : "missing", sources: [source] });
}
const range = (from: number, to: number, family: BoardFamily, pages: readonly number[]) => Array.from({ length: to-from+1 }, (_,i) => entry(String(from+i), family, pages));
/** 38 numbered faces/halves, NOT 38 interchangeable individual boards. */
export const BOARD_INVENTORY: readonly BoardInventoryEntry[] = Object.freeze([
  ...range(1,10,"base",[2,5]), ...range(11,18,"additional-duchies",[3,13]),
  ...range(19,20,"championship",[3]), ...range(21,22,"special-edition",[3]),
  ...range(23,30,"border-posts",[3,14]),
  ...["31a","31b","32a","32b"].map(n => entry(n,"team",[3,15])),
  ...range(33,34,"solo",[3,15,16]), ...range(35,36,"chateauma",[22]),
]);

export function getSelectableBoards(): readonly BoardInventoryEntry[] {
  return BOARD_INVENTORY.filter(entry => entry.family !== "team" && entry.family !== "solo" && entry.family !== "chateauma" &&
    VERIFIED_BOARD_DEFINITIONS.some(board => board.id === entry.id && board.verification.status === "verified" && validateBoardDefinition(board).valid));
}
export function getBoardPreview(boardId: string): BoardPreview {
  const inventory = BOARD_INVENTORY.find(entry => entry.id === boardId);
  if (!inventory) return { status: "unavailable", boardId, reason: "unknown-board" };
  const board = VERIFIED_BOARD_DEFINITIONS.find(board => board.id === boardId);
  if (!board || board.verification.status !== "verified" || !validateBoardDefinition(board).valid) return { status: "unavailable", boardId, reason: "unverified-geometry" };
  return { status: "ready", boardId, cells: board.cells, regions: board.regions, startingCastle: board.startingCastle };
}
