import type { DieValue, TileType } from "../types";
import type { BoardCellDefinition, BoardDefinition, BoardFamily } from "./types";
import { deriveRegions } from "./regions";

/** User-supplied Burgundy_boards_v2.jpg. Seven rows, top to bottom, left to right.
 * C=castle, M=mine, S=ship, L=livestock, B=building, Y=monastery.
 * Numbers are printed die pips, not generated from a balancing rule.
 * Fan diagram geometry only: optional connection / border-post rules are separate.
 */
export const DUCHY_SHEET_ROWS: Readonly<Record<number, readonly string[]>> = {
  1: ["L6 C5 C4 Y3","L2 L1 C6 Y5 B4","L5 L4 B3 Y1 B2 B3","S6 S1 S2 C6 S5 S4 S1","B2 B5 M4 B3 B1 L2","B6 M1 Y2 B5 B6","M3 Y4 Y1 B3"],
  2: ["Y6 Y5 Y4 C3","B2 B1 S6 L5 M4","M5 B4 B3 S1 L2 S3","C6 B1 S2 C6 Y5 B4 S1","Y2 S5 B4 L3 Y1 B2","B6 B1 L2 B5 M6","L3 L4 B1 C3"],
  3: ["L6 L5 L4 L3","S2 S1 C6 S5 S4","B5 M4 Y3 Y1 S2 B3","B6 B1 Y2 C6 Y5 B4 B1","B2 B5 Y4 Y3 B1 B2","C6 L1 M2 M5 C6","B3 L4 S1 B3"],
  4: ["C6 B5 S4 B3","L2 L1 B6 S5 S4","B5 L4 B3 S1 C2 M3","L6 L1 L2 Y6 Y5 M4 S1","B2 C5 Y4 B3 B1 Y2","B6 M1 B2 Y5 B6","S3 B4 Y1 C3"],
  5: ["L6 B5 B4 S3","L2 L1 B6 M5 M4","B5 C4 Y3 S1 S2 S3","B6 B1 L2 Y6 C5 B4 B1","Y2 C5 L4 Y3 S1 B2","B6 L1 B2 C5 S6","Y3 Y4 B1 M3"],
  6: ["Y6 Y5 C4 S3","Y2 B1 B6 S5 B4","L5 L4 M3 S1 B2 B3","Y6 B1 B2 C6 S5 B4 B1","Y2 B5 B4 M3 S1 B2","Y6 M1 L2 L5 S6","C3 L4 L1 C3"],
  7: ["Y6 C5 C4 S3","Y2 L1 L6 L5 S4","S5 M4 B3 B1 M2 L3","S6 Y1 B2 B6 B5 L4 B1","B2 Y5 B4 B3 L1 B2","B6 S1 M2 Y5 B6","S3 C4 C1 Y3"],
  8: ["B6 B5 S4 B3","B2 C1 Y6 C5 B4","B5 Y4 M3 Y1 Y2 S3","S6 L1 Y2 M6 L5 Y4 S1","S2 L5 L4 M3 L1 B2","B6 C1 L2 C5 B6","B3 S4 B1 B3"],
  9: ["B6 B5 C4 Y3","B2 B1 L6 L5 S4","B5 B4 L3 L1 S2 S3","C6 Y1 Y2 M6 S5 C4 Y1","S2 S5 Y4 M3 B1 L2","Y6 B1 B2 B5 L6","M3 C4 B1 B3"],
  10: ["S6 B5 L4 C3","L2 S1 B6 L5 B4","L5 L4 L3 B1 Y2 B3","B6 B1 B2 B6 B5 Y4 C1","Y2 Y5 M4 Y3 M1 S2","B6 B1 M2 Y5 S6","C3 S4 S1 C3"],
  11: ["B6 B5 B4 B3","Y2 Y1 C6 L5 L4","Y5 Y4 S3 S1 L2 L3","C6 B1 B2 B6 B5 B4 C1","S2 L5 L4 Y3 Y1 M2","S6 S1 C2 M5 M6","S3 B4 B1 B3"],
  12: ["L6 L5 L4 L3","B2 B1 B6 L5 B4","S5 M4 M3 C1 B2 B3","S6 C1 S2 L6 S5 S4 M1","S2 Y5 B4 B3 Y1 C2","Y6 Y1 B2 Y5 B6","Y3 C4 B1 B3"],
  13: ["B6 B5 Y4 B3","M2 C1 Y6 Y5 B4","M5 B4 Y3 Y1 Y2 C3","C6 L1 B2 L6 L5 L4 B1","B2 M5 C4 S3 L1 B2","B6 S1 B2 S5 L6","S3 S4 B1 S3"],
  14: ["M6 B5 B4 S3","B2 C1 M6 C5 B4","B5 L4 L3 M1 L2 B3","Y6 B1 L2 Y6 L5 B4 S1","Y2 B5 L4 Y3 B1 S2","Y6 C1 S2 C5 S6","Y3 B4 B1 S3"],
  15: ["M6 Y5 Y4 C3","C2 Y1 B6 B5 L4","S5 L4 B3 B1 B2 L3","S6 L1 M2 B6 B5 B4 L1","S2 S5 M4 S3 S1 L2","Y6 C1 B2 B5 C6","Y3 Y4 B1 B3"],
  16: ["B6 B5 B4 B3","C2 Y1 Y6 Y5 L4","Y5 B4 Y3 Y1 L2 L3","B6 B1 M2 M6 C5 S4 S1","B2 M5 S4 S3 L1 L2","C6 B1 B2 B5 L6","S3 S4 B1 C3"],
  17: ["Y6 Y5 C4 B3","S2 S1 B6 B5 B4","B5 S4 L3 L1 L2 C3","B6 B1 C2 M6 L5 L4 Y1","S2 S5 S4 L3 M1 Y2","B6 B1 C2 M5 Y6","B3 Y4 B1 B3"],
  18: ["B6 B5 B4 B3","B2 B1 C6 S5 S4","L5 L4 L3 C1 S2 S3","M6 M1 M2 C6 B5 B4 B1","S2 S5 C4 Y3 Y1 B2","Y6 Y1 L2 L5 B6","Y3 Y4 L1 B3"],
  19: ["B6 L5 B4 C3","L2 L1 L6 Y5 M4","C5 L4 M3 S1 M2 B3","Y6 Y1 B2 S6 S5 B4 S1","Y2 B5 B4 Y3 B1 S2","B6 L1 B2 Y5 C6","C3 B4 B1 S3"],
  20: ["B6 B5 B4 C3","C2 B1 B6 M5 M4","Y5 Y4 L3 M1 Y2 Y3","S6 S1 L2 B6 Y5 L4 L1","B2 S5 B4 L3 L1 C2","B6 C1 S2 B5 B6","B3 S4 S1 Y3"],
  21: ["C6 M5 M4 S3","C2 B1 B6 M5 S4","B5 B4 B3 Y1 B2 L3","B6 B1 C2 L6 B5 B4 L1","S2 L5 L4 Y3 C1 L2","Y6 B1 B2 Y5 S6","Y3 S4 Y1 S3"],
  22: ["Y6 Y5 B4 B3","Y2 C1 B6 C5 B4","B5 S4 B3 B1 S2 B3","B6 B1 M2 M6 M5 S4 B1","B2 Y5 L4 Y3 Y1 L2","S6 C1 L2 C5 L6","S3 S4 L1 L3"],
  23: ["C6 B5 B4 C3","Y2 Y1 Y6 Y5 Y4","S5 L4 B3 B1 S2 L3","B6 S1 B2 B6 B5 L4 M1","B2 S5 B4 B3 L1 M2","C6 S1 Y2 L5 C6","M3 S4 L1 B3"],
  24: ["B6 B5 B4 C3","B2 M1 Y6 Y5 B4","B5 M4 M3 L1 Y2 B3","C6 S1 S2 L6 Y5 Y4 B1","S2 S5 S4 L3 Y1 C2","S6 L1 L2 L5 B6","B3 C4 B1 B3"],
  25: ["C6 B5 B4 Y3","M2 L1 B6 B5 L4","B5 B4 C3 L1 L2 L3","Y6 B1 B2 M6 S5 S4 L1","Y2 Y5 Y4 C3 S1 S2","S6 B1 B2 Y5 M6","S3 B4 B1 C3"],
  26: ["S6 C5 C4 B3","S2 S1 Y6 B5 B4","S5 S4 S3 B1 B2 B3","L6 L1 M2 M6 M5 Y4 Y1","L2 B5 L4 L3 B1 Y2","B6 B1 L2 Y5 B6","C3 B4 Y1 C3"],
  27: ["M6 M5 Y4 Y3","Y2 B1 B6 S5 B4","C5 Y4 B3 Y1 S2 C3","L6 L1 L2 Y6 B5 B4 M1","L2 S5 S4 B3 B1 B2","L6 S1 S2 B5 B6","L3 C4 C1 B3"],
  28: ["B6 B5 B4 S3","Y2 Y1 C6 B5 S4","S5 B4 B3 M1 B2 B3","C6 B1 B2 M6 L5 S4 C1","Y2 B5 M4 L3 S1 S2","Y6 B1 C2 Y5 Y6","L3 L4 L1 L3"],
  29: ["B6 B5 M4 S3","B2 L1 L6 B5 B4","B5 C4 B3 Y1 C2 B3","S6 S1 B2 C6 Y5 B4 S1","L2 L5 B4 Y3 S1 S2","M6 L1 C2 B5 Y6","L3 Y4 Y1 M3"],
  30: ["S6 S5 Y4 M3","S2 B1 Y6 Y5 S4","L5 B4 B3 B1 B2 C3","C6 S1 C2 L6 L5 L4 L1","B2 B5 B4 Y3 B1 C2","B6 B1 Y2 Y5 B6","M3 L4 S1 M3"],
};

const terrainKey: Record<string, TileType> = { C: "castle", M: "mine", S: "ship", L: "livestock", B: "building", Y: "monastery" };
export function sheetBoardFamily(number: number): BoardFamily {
  return number <= 10 ? "base" : number <= 18 ? "additional-duchies" : number <= 20 ? "championship" : number <= 22 ? "special-edition" : "border-posts";
}
function transcribeBoard(number: number, rows: readonly string[]): BoardDefinition {
  if (rows.length !== 7) throw new Error("Expected seven transcribed rows");
  const cells: BoardCellDefinition[] = rows.flatMap((row, i) => {
    const r = i - 3, tokens = row.split(" ");
    if (tokens.length !== 7 - Math.abs(r)) throw new Error("Invalid transcribed row length");
    return tokens.map((token, j) => {
      if (!/^[CMSLBY][1-6]$/.test(token)) throw new Error("Invalid transcribed cell");
      const q = Math.max(-3, -r - 3) + j, id = `${q},${r}`;
      return { id, coord: { q, r }, terrain: terrainKey[token[0]], number: Number(token[1]) as DieValue, regionId: id };
    });
  });
  for (const region of deriveRegions(cells)) for (const id of region.cellIds) {
    const index = cells.findIndex(c => c.id === id);
    cells[index] = { ...cells[index], regionId: region.id };
  }
  const family = sheetBoardFamily(number);
  return {
    id: `se:${family}:${number}`, officialNumber: String(number), family, format: "individual-hex",
    expectedCellCount: 37, cells, regions: deriveRegions(cells),
    startingCastle: { policy: "any-castle", allowedCellIds: cells.filter(c => c.terrain === "castle").map(c => c.id), recommendedCellId: number <= 2 ? "0,0" : null },
    verification: { status: "verified", reviewedBy: "Codex image extraction and visual review of user-supplied fan diagram; SE2 cross-checked under rotation", reviewedOn: "2026-10-18",
      evidence: [{ assetPath: "reference/Burgundy_boards_v2.jpg", sha256: "C787C20AEF6DF8C8F6C5B0D0A684FC7E950DAE6CDC1D2F68AD8798D44F1361A5", locator: `Fan reference sheet, printed duchy #${number}; all 37 terrain/die cells. No border-post markers supplied.` }] },
  };
}
export const SHEET_BOARD_DEFINITIONS: readonly BoardDefinition[] = Object.freeze(
  Object.entries(DUCHY_SHEET_ROWS).map(([number, rows]) => transcribeBoard(Number(number), rows)),
);
