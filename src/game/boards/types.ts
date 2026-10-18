import type { AxialCoord, CellId, DieValue, PlayerId, RuleSource, TileType } from "../types";

export type BoardFamily = "base" | "additional-duchies" | "championship" | "special-edition" | "border-posts" | "team" | "solo" | "chateauma";
/** Inventory evidence proves existence, not geometry or eligibility for live play. */
export interface BoardInventoryEntry {
  readonly id: string;
  readonly officialNumber: string;
  readonly family: BoardFamily;
  readonly label: string;
  readonly geometryStatus: "missing" | "verified";
  readonly sources: readonly RuleSource[];
}
export interface BoardCellDefinition {
  readonly id: CellId;
  readonly coord: AxialCoord;
  readonly terrain: TileType;
  readonly number: DieValue;
  readonly regionId: string;
}
export interface BoardRegionDefinition {
  readonly id: string;
  readonly terrain: TileType;
  readonly cellIds: readonly CellId[];
  readonly adjacentRegionIds: readonly string[];
}
export interface BoardEvidence {
  readonly assetPath: string;
  readonly sha256: string;
  readonly locator: string;
}
/** Empty initial layout, not a mutable player's DuchyBoard. Does not assume all boards have 37 cells. */
export interface BoardDefinition {
  readonly id: string;
  readonly officialNumber: string | null;
  readonly family: BoardFamily | "synthetic-test";
  readonly format: "individual-hex";
  readonly expectedCellCount: number;
  readonly cells: readonly BoardCellDefinition[];
  readonly regions: readonly BoardRegionDefinition[];
  readonly startingCastle: {
    readonly policy: "any-castle" | "listed-castles";
    readonly allowedCellIds: readonly CellId[];
    readonly recommendedCellId: CellId | null;
  };
  readonly verification:
    | { readonly status: "draft" | "synthetic-test" }
    | { readonly status: "verified"; readonly reviewedBy: string; readonly reviewedOn: string; readonly evidence: readonly BoardEvidence[] };
}
export interface BoardValidationIssue { readonly code: string; readonly path: string; readonly message: string }
export interface BoardValidationResult { readonly valid: boolean; readonly issues: readonly BoardValidationIssue[] }
/** Selection intent only; assignment algorithm and RNG are intentionally not implemented. */
export type BoardSelection =
  | { readonly mode: "official"; readonly boardId: string }
  | { readonly mode: "random"; readonly eligibleBoardIds: readonly string[] };
export interface BoardAssignmentPlan {
  readonly playerSelections: readonly { readonly playerId: PlayerId; readonly selection: BoardSelection }[];
  readonly duplicatePolicy: "allow" | "disallow";
  readonly randomSeed: string;
}
export interface ResolvedBoardAssignment {
  readonly playerId: PlayerId;
  readonly boardId: string;
  readonly startingCastleCellId: CellId;
}
export type BoardPreview =
  | { readonly status: "unavailable"; readonly boardId: string; readonly reason: "unknown-board" | "unverified-geometry" }
  | { readonly status: "ready"; readonly boardId: string; readonly cells: readonly BoardCellDefinition[]; readonly regions: readonly BoardRegionDefinition[]; readonly startingCastle: BoardDefinition["startingCastle"] };
