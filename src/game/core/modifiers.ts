import type { ActionIntent, DieAdjustment, GameState, PlayerState } from "../types";
import { monasteryNumbers } from "./state";
function freeModifier(state: Pick<GameState, "tiles">, intent: ActionIntent): 9 | 10 | 11 | 12 | undefined {
    if (intent.kind === "take-tile")
        return 12;
    if (intent.kind !== "place-tile")
        return undefined;
    const type = state.tiles[intent.tileId]?.type;
    return type === "building" ? 9 : type === "ship" || type === "livestock" ? 10 : type === "castle" || type === "mine" || type === "monastery" ? 11 : undefined;
}
function minimumWorkers(steps: readonly (1 | -1)[], double: boolean): number {
    if (!double)
        return steps.length;
    let cost = 0;
    for (let i = 0; i < steps.length;) {
        let end = i + 1;
        while (end < steps.length && steps[end] === steps[i])
            end++;
        cost += Math.ceil((end - i) / 2);
        i = end;
    }
    return cost;
}
export function adjustmentValid(state: Pick<GameState, "tiles">, player: Pick<PlayerState, "duchy" | "workers">, intent: ActionIntent, adjustment: DieAdjustment): boolean {
    if (!adjustment || !Number.isSafeInteger(adjustment.workersSpent) || adjustment.workersSpent < 0 || adjustment.workersSpent > player.workers || !Array.isArray(adjustment.steps) || adjustment.steps.length > 64 || adjustment.steps.some(s => s !== 1 && s !== -1))
        return false;
    const monks = monasteryNumbers(state, player), free = adjustment.monasteryNumber;
    if (free !== undefined && (!monks.includes(free) || free !== freeModifier(state, intent) || adjustment.steps.length === 0))
        return false;
    const variants = free === undefined ? [adjustment.steps] : adjustment.steps.map((_, i) => adjustment.steps.filter((_, j) => j !== i));
    return variants.some(steps => adjustment.workersSpent >= minimumWorkers(steps, monks.includes(8)) && adjustment.workersSpent <= steps.length);
}
/** Canonical shortest cost for the UI and action enumeration; the engine validates it again. */
export function planAdjustment(state: Pick<GameState, "tiles">, player: Pick<PlayerState, "duchy" | "workers">, intent: ActionIntent, steps: readonly (1 | -1)[]): DieAdjustment {
    const monks = monasteryNumbers(state, player), candidate = freeModifier(state, intent);
    const free = steps.length && candidate && monks.includes(candidate) ? candidate : undefined;
    const variants = free === undefined ? [steps] : steps.map((_, i) => steps.filter((_, j) => j !== i));
    return { steps, workersSpent: Math.min(...variants.map(v => minimumWorkers(v, monks.includes(8)))), ...(free ? { monasteryNumber: free } : {}) };
}
