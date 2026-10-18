import type { BuildingType } from "../types";
/** Official PDF p.12 icons compared with the named building pictures on pp.8-9. */
export const MONASTERY_BUILDINGS: Readonly<Partial<Record<number, BuildingType>>> = Object.freeze({
    16: "warehouse", 17: "watchtower", 18: "carpenters-workshop", 19: "church",
    20: "market", 21: "boarding-house", 22: "bank", 23: "town-hall",
});
