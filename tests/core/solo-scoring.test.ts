import { test } from "node:test";
import assert from "node:assert/strict";
import { applySoloScore, soloCompletion } from "../../src/game/modes/solo-scoring";

test("solo scoring gains points without mutating its input and purchases one point per silver", () => {
  const track = Object.freeze({ position: 10, target: 50, silver: 4 });
  assert.deepEqual(applySoloScore(track, 6, 3), { track: { position: 19, target: 50, silver: 1 }, earnedPoints: 6, purchasedPoints: 3, discardedOverflow: 0, extraActionGranted: false });
  assert.deepEqual(track, { position: 10, target: 50, silver: 4 });
});
test("reaching the target resets position, lowers target and grants one extra-action decision", () => {
  const result = applySoloScore({ position: 40, target: 50, silver: 1 }, 9, 1);
  assert.deepEqual(result.track, { position: 0, target: 45, silver: 0 });
  assert.equal(result.extraActionGranted, true);
  assert.equal(result.discardedOverflow, 0);
});
test("overflow is lost instead of carried or repeatedly generating threshold actions", () => {
  const result = applySoloScore({ position: 49, target: 50, silver: 0 }, 120);
  assert.deepEqual(result.track, { position: 0, target: 45, silver: 0 });
  assert.equal(result.discardedOverflow, 119);
  assert.equal(result.extraActionGranted, true);
});
test("target never decreases below five and a custom initial target need not be a multiple of five", () => {
  assert.equal(applySoloScore({ position: 4, target: 5, silver: 0 }, 1).track.target, 5);
  assert.equal(applySoloScore({ position: 6, target: 7, silver: 0 }, 1).track.target, 5);
  assert.equal(applySoloScore({ position: 41, target: 42, silver: 0 }, 1).track.target, 37);
});
test("zero points do not allow a free-standing purchase or threshold action", () => {
  const track = { position: 4, target: 5, silver: 2 };
  assert.throws(() => applySoloScore(track, 0, 1), RangeError);
  assert.deepEqual(applySoloScore(track, 0).track, track);
  assert.equal(applySoloScore(track, 0).extraActionGranted, false);
});
test("invalid resources, positions, purchases and unsafe sums reject atomically", () => {
  const valid = { position: 1, target: 50, silver: 2 };
  for (const n of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => applySoloScore({ ...valid, position: n }, 1), RangeError);
    assert.throws(() => applySoloScore({ ...valid, silver: n }, 1), RangeError);
    assert.throws(() => applySoloScore(valid, n), RangeError);
    assert.throws(() => applySoloScore(valid, 1, n), RangeError);
  }
  for (const n of [4, -1, 1.5, Infinity]) assert.throws(() => applySoloScore({ ...valid, target: n }, 1), RangeError);
  assert.throws(() => applySoloScore({ ...valid, position: 50 }, 1), RangeError);
  assert.throws(() => applySoloScore(valid, 1, 3), RangeError);
  assert.throws(() => applySoloScore(valid, Number.MAX_SAFE_INTEGER), RangeError);
  assert.deepEqual(valid, { position: 1, target: 50, silver: 2 });
});
test("solo victory requires all 37 spaces, including on the final round", () => {
  assert.equal(soloCompletion(0, 1), "playing");
  assert.equal(soloCompletion(24, 36), "playing");
  assert.equal(soloCompletion(24, 37), "won");
  assert.equal(soloCompletion(25, 37), "won");
  assert.equal(soloCompletion(25, 36), "lost");
});
test("completion rejects invalid rounds and impossible space counts", () => {
  for (const n of [-1, 0.5, NaN, Infinity, 26]) assert.throws(() => soloCompletion(n, 1), RangeError);
  for (const n of [-1, 0.5, NaN, Infinity, 38]) assert.throws(() => soloCompletion(1, n), RangeError);
});
