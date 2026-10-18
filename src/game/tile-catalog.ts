import type { BuildingType, MonasteryNumber, Tile } from "./types";
type TileFace<T = Tile> = T extends Tile ? Omit<T, "id"> : never;

/** Project base set: 136 sourced non-livestock tiles + user-specified 24 livestock.
 * Geese are an optional expansion and are not silently added to the base supply.
 */
export function createProjectBaseTiles(): Tile[] {
  const tiles: Tile[] = [];
  const add = (tile: TileFace) => tiles.push({ ...tile, id: `project-tile:${tiles.length}` } as Tile);
  for (const building of ["market", "carpenters-workshop", "church", "warehouse", "boarding-house", "bank", "town-hall", "watchtower"] as BuildingType[]) {
    for (let i = 0; i < 7; i++) add({ type: "building", building, back: i < 5 ? "matching-color" : "black" });
  }
  for (const species of ["cattle", "sheep", "pigs", "chickens"] as const) {
    for (const count of [2, 3, 4] as const) for (let copy = 0; copy < 2; copy++) {
      add({ type: "livestock", species, count, back: count !== 2 && copy === 1 ? "black" : "matching-color" });
    }
  }
  for (const [type, regular, black] of [["castle", 14, 2], ["mine", 10, 2], ["ship", 20, 6]] as const) {
    for (let i = 0; i < regular + black; i++) add({ type, back: i < regular ? "matching-color" : "black" });
  }
  for (let n = 1; n <= 26; n++) add({ type: "monastery", number: n as MonasteryNumber, back: [7, 12, 14, 15, 24, 25].includes(n) ? "black" : "matching-color" });
  return tiles;
}
