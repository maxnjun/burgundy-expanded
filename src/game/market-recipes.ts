import type { DieValue, Phase, TileType } from "./types";
/** Official rulebook p.4 diagram, pp.6/10 marked-4 and 3BD rules.
 * Cross-check: reference/public-main-board-render.jpg (retailer-hosted product render).
 * This verifies slots ONLY, not the physical tile-front/back distribution.
 */
const layout: readonly (readonly TileType[])[] = [
    ["monastery", "building", "ship", "livestock"],
    ["building", "monastery", "castle", "building"],
    ["building", "ship", "livestock", "monastery"],
    ["livestock", "ship", "building", "mine"],
    ["mine", "building", "monastery", "building"],
    ["building", "livestock", "castle", "ship"],
];
// User-provided two-player screenshot: clockwise from the top depot.
const twoPlayerLayout: readonly (readonly TileType[])[] = [
    ["building", "ship"], ["monastery", "castle"], ["livestock", "building"],
    ["ship", "building"], ["mine", "monastery"], ["building", "livestock"],
];
export function officialMarketRecipe(playerCount: 2 | 3 | 4, phase: Phase) {
    if (![2, 3, 4].includes(playerCount) || !["A", "B", "C", "D", "E"].includes(phase))
        throw new Error("Unverified market recipe");
    if (playerCount === 2) return { id: "se:main:2" as const, blackSlots: 4, depots: twoPlayerLayout.map((types, i) => ({
        number: (i + 1) as DieValue, slots: types.map((requiredType, j) => ({ id: `se:slot:${i + 1}:${j}`, requiredType })),
    })) };
    return { id: "se:main:3-4", blackSlots: playerCount === 4 ? 8 : 6, depots: layout.map((types, i) => ({ number: (i + 1) as DieValue,
            slots: types.slice(0, playerCount === 4 ? 4 : 3).map((type, j) => ({ id: `se:slot:${i + 1}:${j}`, requiredType: playerCount === 3 && i === 5 && j === 2 && (phase === "B" || phase === "D") ? "mine" as const : type })),
        })) };
}
