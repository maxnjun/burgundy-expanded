import type { RuleSource } from "../types";

export const SOLO_SCORING_SOURCE: RuleSource = {
  document: "special-edition-rulebook", pages: [16], section: "Solo: victory point target and end of game",
};
export interface SoloPointTrack {
  readonly position: number;
  readonly target: number;
  readonly silver: number;
}
export interface SoloScoreResult {
  readonly track: SoloPointTrack;
  readonly earnedPoints: number;
  readonly purchasedPoints: number;
  readonly discardedOverflow: number;
  readonly extraActionGranted: boolean;
}
const count = (n: number) => Number.isSafeInteger(n) && n >= 0;

/** One explicitly ordered scoring event (PDF p.16), independent of board geometry.
 * Buying points is a decision made while scoring, not an arbitrary free-standing action.
 * Overflow is discarded and the threshold grants exactly one optional castle-style action.
 * A future solo adapter must queue that action and order separate scoring events/choices.
 * This helper neither enables solo mode in competitive GameState nor executes a free action.
 */
export function applySoloScore(track: SoloPointTrack, earnedPoints: number, purchasedPoints = 0): SoloScoreResult {
  if (!count(track.position) || !Number.isSafeInteger(track.target) || track.target < 5 || track.position >= track.target || !count(track.silver)) {
    throw new RangeError("Invalid solo point track");
  }
  if (!count(earnedPoints) || !count(purchasedPoints) || purchasedPoints > track.silver || (earnedPoints === 0 && purchasedPoints !== 0)) {
    throw new RangeError("Invalid solo scoring or unaffordable point purchase");
  }
  const total = track.position + earnedPoints + purchasedPoints;
  if (!Number.isSafeInteger(total)) throw new RangeError("Solo scoring exceeds safe integer range");
  const reset = total >= track.target;
  return {
    track: { position: reset ? 0 : total, target: reset ? Math.max(5, track.target - 5) : track.target, silver: track.silver - purchasedPoints },
    earnedPoints, purchasedPoints, discardedOverflow: reset ? total - track.target : 0, extraActionGranted: reset,
  };
}

/** Called after actions/effects have resolved, using elapsed complete rounds, not round index.
 * The official goal is all 37 spaces filled within 25 rounds, not a high-score victory.
 */
export function soloCompletion(roundsCompleted: number, filledSpaces: number): "playing" | "won" | "lost" {
  if (!count(roundsCompleted) || roundsCompleted > 25 || !count(filledSpaces) || filledSpaces > 37) {
    throw new RangeError("Invalid solo round or filled-space count");
  }
  if (filledSpaces === 37) return "won";
  return roundsCompleted === 25 ? "lost" : "playing";
}
