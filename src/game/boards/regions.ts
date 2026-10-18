import type { BoardCellDefinition, BoardRegionDefinition } from "./types";
import { coordinateKey, getAxialNeighbors } from "./axial";

/** Derives maximal same-terrain components; never infers terrain or die numbers. */
export function deriveRegions(cells: readonly BoardCellDefinition[]): readonly BoardRegionDefinition[] {
  const byCoord = new Map(cells.map(c => [coordinateKey(c.coord), c]));
  if (byCoord.size !== cells.length || new Set(cells.map(c => c.id)).size !== cells.length) {
    throw new Error("Duplicate cell IDs or coordinates");
  }
  const visited = new Set<string>();
  const components: BoardRegionDefinition[] = [];
  for (const first of [...cells].sort((a,b) => a.id.localeCompare(b.id, "en"))) {
    if (visited.has(first.id)) continue;
    const queue = [first]; const ids: string[] = []; visited.add(first.id);
    for (let i = 0; i < queue.length; i++) {
      const cell = queue[i]; ids.push(cell.id);
      for (const coord of getAxialNeighbors(cell.coord)) {
        const next = byCoord.get(coordinateKey(coord));
        if (next && next.terrain === first.terrain && !visited.has(next.id)) { visited.add(next.id); queue.push(next); }
      }
    }
    components.push({ id: first.regionId, terrain: first.terrain, cellIds: ids.sort(), adjacentRegionIds: [] });
  }
  const regionByCell = new Map(components.flatMap(region => region.cellIds.map(id => [id, region.id] as const)));
  return components.map(region => {
    const adjacent = new Set<string>();
    for (const cellId of region.cellIds) {
      const cell = cells.find(c => c.id === cellId)!;
      for (const coord of getAxialNeighbors(cell.coord)) {
        const next = byCoord.get(coordinateKey(coord)); const id = next && regionByCell.get(next.id);
        if (id && id !== region.id) adjacent.add(id);
      }
    }
    return { ...region, adjacentRegionIds: [...adjacent].sort() };
  });
}
