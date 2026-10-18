import type { DieValue, TileType } from "../../types";
import type { BoardCellDefinition, BoardEvidence } from "../types";
import { deriveRegions } from "../regions";

type PrintedCell = readonly [q: number, r: number, terrain: TileType, number: DieValue];
function area(id: string, printed: readonly PrintedCell[]) {
  const initial = printed.map(([q, r, terrain, number], i) => ({ id: `solo33:${id}:${i}`, coord: { q, r }, terrain, number, regionId: `solo33:${id}:${i}` }));
  const regions = deriveRegions(initial);
  const cells: readonly BoardCellDefinition[] = initial.map(c => ({ ...c, regionId: regions.find(region => region.cellIds.includes(c.id))!.id }));
  return { id, cells };
}

/** DRAFT TRANSCRIPTION, NOT PLAYABLE OR VERIFIED.
 * Local axial coordinates restart in each island. They cannot be combined as a global
 * BoardDefinition until island transforms and exact river contacts are independently audited.
 * PDF p.15 solo setup identifies the pictured beginner side as 33; no printed number is visible.
 */
export const SOLO_33_TRANSCRIPTION = {
  id: "draft:solo-33",
  candidateOfficialNumber: "33",
  status: "draft" as const,
  evidence: [
    { assetPath: "reference/official-rulebook-public.pdf", sha256: "8e5822756333b3efee52a0c0e203d1a16b16a458e0b130a074d360d72c0c038f", locator: "p.15 solo setup lower-left photograph; p.16 specifies 37 spaces" },
    { assetPath: "reference/solo-33-rulebook-source.jpg", sha256: "cf66afe524e9bacbed54b1031df71739c65729f4d74adfa22e05d405154df8a5", locator: "Original embedded Im3.jpg from PDF page 15, 923x693 pixels" },
  ] satisfies readonly BoardEvidence[],
  areas: [
    area("north-west", [
      [0, 0, "livestock", 6], [1, 0, "building", 4],
      [-1, 1, "castle", 3], [0, 1, "monastery", 2], [1, 1, "castle", 1],
      [-1, 2, "mine", 5], [0, 2, "ship", 1],
    ]),
    area("north-east", [
      [0, 0, "ship", 6], [1, 0, "mine", 5], [2, 0, "building", 6], [3, 0, "building", 2],
      [0, 1, "building", 5], [1, 1, "livestock", 1], [2, 1, "castle", 5], [3, 1, "monastery", 4],
      [0, 2, "building", 6], [1, 2, "ship", 3], [2, 2, "building", 2],
    ]),
    area("south-west", [
      [0, 0, "building", 2], [1, 0, "ship", 4],
      [-1, 1, "building", 5], [0, 1, "building", 4],
      [-2, 2, "livestock", 1], [-1, 2, "monastery", 3],
    ]),
    area("south-east", [
      [0, 0, "monastery", 5], [1, 0, "monastery", 3], [2, 0, "monastery", 5], [3, 0, "livestock", 1],
      [-1, 1, "ship", 1], [0, 1, "building", 2], [1, 1, "castle", 3], [2, 1, "livestock", 5], [3, 1, "ship", 3],
      [-1, 2, "building", 5], [0, 2, "mine", 4], [1, 2, "building", 2], [2, 2, "livestock", 2],
    ]),
  ],
  unresolved: [
    "Independently compare all 37 printed terrain/die values and confirm side identity.",
    "Transcribe exact inter-island river contacts from adequate source evidence; do not infer them from nearest cells.",
    "Audit island transforms for a global axial/rendering layout without creating artificial physical adjacency.",
    "Implement and test the actual solo engine before registering a playable board.",
  ],
};
