import type { DieValue, TileType } from "../types";
import type { BoardCellDefinition, BoardDefinition } from "./types";
import { deriveRegions } from "./regions";

/** Manual transcription of the frontmost duchy #2, official rulebook p.2.
 * Rows run top to bottom in the printed page, cells left to right.
 * Source image is /Im23 (630x492), NOT a generated/2019/BGA layout.
 * Full per-cell visual audit and provenance: docs/boards/se-base-2.md.
 */
const key: Record<string, TileType> = { C: "castle", M: "mine", S: "ship", L: "livestock", B: "building", Y: "monastery" };
const rows = [
  ["C3", "M4", "S3", "S1"],
  ["Y4", "L5", "L2", "B4", "B2"],
  ["Y5", "S6", "S1", "Y5", "Y1", "M6"],
  ["Y6", "B1", "B3", "C6", "L3", "B5", "C3"],
  ["B2", "B4", "S2", "B4", "L2", "B1"],
  ["M5", "B1", "S5", "B1", "L4"],
  ["C6", "Y2", "B6", "L3"],
] as const;
const cells: BoardCellDefinition[] = rows.flatMap((row, i) => {
  const r = i - 3;
  return row.map((token, j) => {
    const q = Math.max(-3, -r - 3) + j;
    const id = `${q},${r}`;
    return { id, coord: { q, r }, terrain: key[token[0]], number: Number(token[1]) as DieValue, regionId: `se2:${id}` };
  });
});
// Colored touching cells in this base duchy form regions; no special boundaries.
for (const region of deriveRegions(cells)) for (const id of region.cellIds) {
  const cell = cells.find(c => c.id === id)!;
  cells[cells.indexOf(cell)] = { ...cell, regionId: region.id };
}
export const SE_BASE_2: BoardDefinition = {
  id: "se:base:2", officialNumber: "2", family: "base", format: "individual-hex",
  expectedCellCount: 37, cells, regions: deriveRegions(cells),
  startingCastle: { policy: "any-castle", allowedCellIds: cells.filter(c => c.terrain === "castle").map(c => c.id), recommendedCellId: "0,0" },
  verification: {
    status: "verified", reviewedBy: "Codex visual transcription (single official artwork; not independent human review)", reviewedOn: "2026-10-17",
    evidence: [{ assetPath: "reference/official-rulebook-public.pdf", sha256: "8E5822756333B3EFEE52A0C0E203D1A16B16A458E0B130A074D360D72C0C038F",
      locator: "p.2 /Im23 630x492: frontmost duchy, printed #2; all 37 cells. p.5 setup item 10: any castle, center 6 recommended." }],
  },
};
