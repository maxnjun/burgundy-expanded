import type { DieValue, GameState } from "../types";

/** counter-v1: local simulation RNG, not cryptographic. Seed/cursor completely define replay. */
export function drawDie(random: GameState["random"]): { value: DieValue; random: GameState["random"] } {
  if (!random.seed || !Number.isSafeInteger(random.cursor) || random.cursor < 0) throw new RangeError("Invalid random state");
  let cursor = random.cursor;
  for (;;) {
    if (cursor >= Number.MAX_SAFE_INTEGER) throw new RangeError("Random cursor exhausted");
    let word = 2166136261;
    const input = `${random.seed}:${cursor++}`;
    for (let i = 0; i < input.length; i++) word = Math.imul(word ^ input.charCodeAt(i), 16777619);
    word ^= word >>> 16;
    word = Math.imul(word, 0x85ebca6b);
    word ^= word >>> 13;
    word = Math.imul(word, 0xc2b2ae35);
    word = (word ^ (word >>> 16)) >>> 0;
    // Reject the final four uint32 values so modulo six introduces no remainder bias.
    if (word < 4294967292) return { value: (word % 6 + 1) as DieValue, random: { seed: random.seed, cursor } };
  }
}
