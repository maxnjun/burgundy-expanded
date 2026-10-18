import type { AxialCoord } from "../types";

export const AXIAL_DIRECTIONS: readonly AxialCoord[] = Object.freeze([
  Object.freeze({ q: 1, r: 0 }), Object.freeze({ q: 1, r: -1 }),
  Object.freeze({ q: 0, r: -1 }), Object.freeze({ q: -1, r: 0 }),
  Object.freeze({ q: -1, r: 1 }), Object.freeze({ q: 0, r: 1 }),
]);
export function isAxialCoord(coord: AxialCoord): boolean {
  return Number.isSafeInteger(coord.q) && Number.isSafeInteger(coord.r);
}
export function coordinateKey(coord: AxialCoord): string {
  if (!isAxialCoord(coord)) throw new RangeError("Axial coordinates must be safe integers");
  return `${coord.q},${coord.r}`;
}
export function getAxialNeighbors(coord: AxialCoord): readonly AxialCoord[] {
  coordinateKey(coord);
  return AXIAL_DIRECTIONS.map(d => {
    const neighbor = { q: coord.q + d.q, r: coord.r + d.r };
    coordinateKey(neighbor);
    return neighbor;
  });
}
export function areAxialNeighbors(a: AxialCoord, b: AxialCoord): boolean {
  coordinateKey(a); coordinateKey(b);
  return AXIAL_DIRECTIONS.some(d => b.q - a.q === d.q && b.r - a.r === d.r);
}
