/** Explicit partial runtime API; does not claim the full GameEngine interface. */
export { applyCoreAction, validateCoreAction, advanceCoreTurn, adjustedDie, listCoreActionOptions } from "./engine";
export type { CoreActionOptions } from "./engine";
export { validateCoreState, orderedPlayers } from "./state";
export { drawDie } from "./random";
export { finalScore, checkCoreGameEnd } from "./phases";

export { planAdjustment } from "./modifiers";
