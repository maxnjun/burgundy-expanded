import type { Tile } from "./types";

/** SE rulebook pp.3,12–14; official acrylic labels pp.5–6: six beige, two black, monk29. */
export function whiteCastleTiles(): Tile[] {
  return [
    ...Array.from({ length: 8 }, (_, i): Tile => ({ id: `white-castle:${i + 1}`, type: "building", building: "white-castle", back: i < 6 ? "matching-color" : "black" })),
    { id: "white-castle:monastery-29", type: "monastery", number: 29, back: "matching-color" },
  ];
}
